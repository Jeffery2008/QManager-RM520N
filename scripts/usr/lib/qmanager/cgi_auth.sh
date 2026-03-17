#!/bin/sh
# cgi_auth.sh — Authentication library for QManager CGI scripts.
# Sourced by cgi_base.sh. Provides require_auth() and password helpers.
#
# Storage:
#   /etc/qmanager/auth.json            — password hash + salt (persistent)
#   /tmp/qmanager_session.json         — active session token (RAM, cleared on reboot)
#   /tmp/qmanager_auth_attempts.json   — rate limiting state (RAM)

[ -n "$_CGI_AUTH_LOADED" ] && return 0
_CGI_AUTH_LOADED=1

AUTH_CONFIG="/etc/qmanager/auth.json"
SESSION_FILE="/tmp/qmanager_session.json"
ATTEMPTS_FILE="/tmp/qmanager_auth_attempts.json"

# Session timeout (seconds) — single absolute timeout from login time.
# No idle timeout: avoids race conditions from concurrent last_seen writes.
SESSION_ABSOLUTE_TIMEOUT=28800  # 8 hours

# Rate limiting
MAX_ATTEMPTS=5
LOCKOUT_WINDOW=300    # 5-minute window for counting attempts
LOCKOUT_DURATION=300  # 5-minute lockout after max attempts

# ---------------------------------------------------------------------------
# Setup check
# ---------------------------------------------------------------------------
is_setup_required() {
    # Returns 0 (true) if no password has been configured yet
    [ ! -f "$AUTH_CONFIG" ] && return 0
    [ ! -s "$AUTH_CONFIG" ] && return 0
    return 1
}

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

# Generate a random 32-char hex salt
qm_generate_salt() {
    head -c 16 /dev/urandom | openssl dgst -sha256 -hex 2>/dev/null | awk '{print substr($NF,1,32)}'
}

# Hash a password with a salt: qm_hash_password <password> <salt>
# Output: 64-char hex SHA-256 digest
qm_hash_password() {
    printf '%s' "${2}${1}" | openssl dgst -sha256 -hex 2>/dev/null | awk '{print $NF}'
}

# Timing-safe string comparison via awk
# Returns 0 if equal, 1 if not. Always examines all characters.
qm_timing_safe_compare() {
    _result=$(printf '%s\n%s' "$1" "$2" | awk '
        NR==1 { a=$0 }
        NR==2 {
            b=$0
            # Always iterate the longer string length — no early exit
            len = length(a)
            if (length(b) > len) len = length(b)
            diff = (length(a) != length(b))
            for (i=1; i<=len; i++)
                if (substr(a,i,1) != substr(b,i,1)) diff=1
            print diff
        }')
    [ "$_result" = "0" ]
}

# Verify a password against stored hash
# Returns 0 if correct, 1 if wrong
qm_verify_password() {
    _input_password="$1"
    [ ! -f "$AUTH_CONFIG" ] && return 1

    # Single jq call to read both fields (tab-separated)
    _auth_fields=$(jq -r '[.salt // "", .hash // ""] | @tsv' "$AUTH_CONFIG" 2>/dev/null)
    _stored_salt=$(printf '%s' "$_auth_fields" | cut -f1)
    _stored_hash=$(printf '%s' "$_auth_fields" | cut -f2)

    [ -z "$_stored_salt" ] && return 1
    [ -z "$_stored_hash" ] && return 1

    _computed_hash=$(qm_hash_password "$_input_password" "$_stored_salt")
    qm_timing_safe_compare "$_computed_hash" "$_stored_hash"
}

# Save a new password (generates new salt)
# qm_save_password <password>
qm_save_password() {
    _new_salt=$(qm_generate_salt)
    _new_hash=$(qm_hash_password "$1" "$_new_salt")

    jq -n --arg hash "$_new_hash" --arg salt "$_new_salt" \
        '{"hash":$hash,"salt":$salt,"version":1}' > "$AUTH_CONFIG"
    chmod 600 "$AUTH_CONFIG"
}

# ---------------------------------------------------------------------------
# Token management
# ---------------------------------------------------------------------------

# Generate a cryptographically random 64-hex-char token
qm_generate_token() {
    head -c 32 /dev/urandom | openssl dgst -sha256 -hex 2>/dev/null | awk '{print $NF}'
}

# Create a new session, invalidating any existing one
# qm_create_session -> prints the new token to stdout
qm_create_session() {
    _token=$(qm_generate_token)
    _now=$(date +%s)

    jq -n --arg token "$_token" --argjson created "$_now" \
        '{"token":$token,"created":$created}' > "$SESSION_FILE"
    chmod 600 "$SESSION_FILE"

    printf '%s' "$_token"
}

# Validate a token and check expiry
# Returns 0 if valid, 1 if invalid/expired
# Read-only — no writes to avoid race conditions from concurrent CGI requests
qm_validate_token() {
    _check_token="$1"
    [ -z "$_check_token" ] && return 1
    [ ! -f "$SESSION_FILE" ] && return 1

    # Single jq call to read token and created timestamp (tab-separated)
    _session_fields=$(jq -r '[.token // "", (.created // 0 | tostring)] | @tsv' "$SESSION_FILE" 2>/dev/null)
    _session_token=$(printf '%s' "$_session_fields" | cut -f1)
    _created=$(printf '%s' "$_session_fields" | cut -f2)

    [ -z "$_session_token" ] && return 1

    # Compare tokens (timing-safe)
    qm_timing_safe_compare "$_check_token" "$_session_token" || return 1

    # Absolute timeout from login time
    _now=$(date +%s)
    _age=$(( _now - _created ))
    [ "$_age" -gt "$SESSION_ABSOLUTE_TIMEOUT" ] && {
        rm -f "$SESSION_FILE"
        return 1
    }

    return 0
}

# Destroy the current session
qm_destroy_session() {
    rm -f "$SESSION_FILE"
}

# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------

# Check if login attempts are rate-limited
# Returns 0 if OK to proceed, 1 if locked out
# Sets RATE_LIMIT_RETRY_AFTER (seconds) on lockout
qm_check_rate_limit() {
    RATE_LIMIT_RETRY_AFTER=0

    [ ! -f "$ATTEMPTS_FILE" ] && return 0

    _now=$(date +%s)
    _locked_until=$(jq -r '.locked_until // 0' "$ATTEMPTS_FILE" 2>/dev/null)
    _first_attempt=$(jq -r '.first_attempt // 0' "$ATTEMPTS_FILE" 2>/dev/null)
    _count=$(jq -r '.count // 0' "$ATTEMPTS_FILE" 2>/dev/null)

    # Currently locked?
    if [ "$_locked_until" -gt "$_now" ] 2>/dev/null; then
        RATE_LIMIT_RETRY_AFTER=$(( _locked_until - _now ))
        return 1
    fi

    # Window expired? Reset
    _window_age=$(( _now - _first_attempt ))
    if [ "$_window_age" -gt "$LOCKOUT_WINDOW" ] 2>/dev/null; then
        rm -f "$ATTEMPTS_FILE"
        return 0
    fi

    # Too many attempts in window?
    if [ "$_count" -ge "$MAX_ATTEMPTS" ] 2>/dev/null; then
        _new_locked_until=$(( _now + LOCKOUT_DURATION ))
        jq -n --argjson count "$_count" --argjson first "$_first_attempt" \
            --argjson locked "$_new_locked_until" \
            '{"count":$count,"first_attempt":$first,"locked_until":$locked}' > "$ATTEMPTS_FILE"
        RATE_LIMIT_RETRY_AFTER=$LOCKOUT_DURATION
        return 1
    fi

    return 0
}

# Record a failed login attempt
qm_record_failed_attempt() {
    _now=$(date +%s)

    if [ ! -f "$ATTEMPTS_FILE" ]; then
        jq -n --argjson now "$_now" \
            '{"count":1,"first_attempt":$now,"locked_until":0}' > "$ATTEMPTS_FILE"
        return
    fi

    _first_attempt=$(jq -r '.first_attempt // 0' "$ATTEMPTS_FILE" 2>/dev/null)
    _window_age=$(( _now - _first_attempt ))

    if [ "$_window_age" -gt "$LOCKOUT_WINDOW" ] 2>/dev/null; then
        # Window expired, start fresh
        jq -n --argjson now "$_now" \
            '{"count":1,"first_attempt":$now,"locked_until":0}' > "$ATTEMPTS_FILE"
    else
        # Increment within window
        jq '.count += 1' "$ATTEMPTS_FILE" > "${ATTEMPTS_FILE}.tmp" \
            && mv "${ATTEMPTS_FILE}.tmp" "$ATTEMPTS_FILE"
    fi
}

# Clear rate limiting (on successful login)
qm_clear_attempts() {
    rm -f "$ATTEMPTS_FILE"
}

# ---------------------------------------------------------------------------
# Auth enforcement — called by cgi_base.sh on every request
# ---------------------------------------------------------------------------

# Extract Bearer token from Authorization header
_extract_bearer_token() {
    # uhttpd sets HTTP_AUTHORIZATION from the Authorization header
    _auth_header="$HTTP_AUTHORIZATION"
    [ -z "$_auth_header" ] && return 1

    # Strip "Bearer " prefix (case-insensitive match)
    case "$_auth_header" in
        Bearer\ *|bearer\ *)
            printf '%s' "$_auth_header" | cut -c8-
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# Main auth gate — rejects unauthenticated requests
# Emits Status: 401 + JSON error and exits if invalid
require_auth() {
    # Setup mode: allow access so frontend can detect it
    if is_setup_required; then
        echo "Status: 401 Unauthorized"
        cgi_headers
        jq -n '{"success":false,"error":"setup_required","detail":"No password configured"}'
        exit 0
    fi

    # Handle CORS preflight (OPTIONS must pass without auth)
    [ "$REQUEST_METHOD" = "OPTIONS" ] && return 0

    _token=$(_extract_bearer_token)
    if [ -z "$_token" ] || ! qm_validate_token "$_token"; then
        echo "Status: 401 Unauthorized"
        cgi_headers
        jq -n '{"success":false,"error":"unauthorized","detail":"Invalid or missing authentication token"}'
        exit 0
    fi
}
