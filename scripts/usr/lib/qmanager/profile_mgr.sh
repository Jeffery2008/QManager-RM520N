#!/bin/sh
# =============================================================================
# profile_mgr.sh — QManager SIM Profile Manager Library
# =============================================================================
# A sourceable library providing profile CRUD operations, validation,
# AT command conversion helpers, and active profile management.
#
# This is a LIBRARY — no persistent process, no polling.
# CGI scripts and the apply script source it and call functions directly.
#
# Dependencies: qlog_* functions (from qlog.sh)
# Install location: /usr/lib/qmanager/profile_mgr.sh
#
# Usage:
#   . /usr/lib/qmanager/profile_mgr.sh
#   profile_list        → JSON array of profile summaries
#   profile_get <id>    → Full profile JSON
#   profile_save        → Create/update profile (reads JSON from stdin)
#   profile_delete <id> → Remove profile + cleanup
#   profile_count       → Current number of profiles
#   get_active_profile  → Read active profile ID
#   set_active_profile <id> → Write active profile ID
#   clear_active_profile    → Clear active profile
# =============================================================================

# --- Configuration -----------------------------------------------------------
PROFILE_DIR="/etc/qmanager/profiles"
ACTIVE_PROFILE_FILE="/etc/qmanager/active_profile"
MAX_PROFILES=10

# Ensure profile directory exists
mkdir -p "$PROFILE_DIR" 2>/dev/null

# --- JSON Utilities ----------------------------------------------------------
# Escape a string for safe inclusion in JSON values.
# Handles: backslash, double-quote, tab, newlines, carriage returns.
_json_str_escape() {
    printf '%s' "$1" | sed \
        -e 's/\\/\\\\/g' \
        -e 's/"/\\"/g' \
        -e 's/	/\\t/g' \
        -e ':a' -e 'N' -e '$!ba' \
        -e 's/\n/\\n/g' \
        -e 's/\r//g'
}

# Output a JSON string field: "key": "value"
# Args: $1=key, $2=value
_json_field_str() {
    local escaped
    escaped=$(_json_str_escape "$2")
    printf '"%s":"%s"' "$1" "$escaped"
}

# Output a JSON numeric field: "key": value
# If value is empty or non-numeric, outputs null.
# Args: $1=key, $2=value
_json_field_num() {
    case "$2" in
        ''|*[!0-9-]*) printf '"%s":null' "$1" ;;
        *) printf '"%s":%s' "$1" "$2" ;;
    esac
}

# Output a JSON boolean field: "key": true/false
# Args: $1=key, $2=value (true/false/1/0)
_json_field_bool() {
    case "$2" in
        true|1) printf '"%s":true' "$1" ;;
        *)      printf '"%s":false' "$1" ;;
    esac
}

# Extract a string value from a JSON object by key.
# Returns the FIRST match only (prevents nested key collisions,
# e.g., top-level "name" vs "apn.name").
# Args: $1=json_string, $2=key
# Output: value (unquoted) on stdout
_json_extract() {
    printf '%s' "$1" | sed -n 's/.*"'"$2"'"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1
}

# Extract a numeric or boolean value from a JSON object by key.
# Returns the FIRST match only.
# Args: $1=json_string, $2=key
# Output: value on stdout
_json_extract_raw() {
    printf '%s' "$1" | sed -n 's/.*"'"$2"'"[[:space:]]*:[[:space:]]*\([^,}]*\).*/\1/p' | head -1 | tr -d ' \r\n'
}

# --- Profile ID Generation ---------------------------------------------------
# Format: p_<unix_timestamp>_<3-char-hex>
# Uses /dev/urandom with hexdump (BusyBox-safe).
_generate_profile_id() {
    local ts suffix
    ts=$(date +%s)
    suffix=$(hexdump -n 2 -e '"%04x"' /dev/urandom 2>/dev/null | cut -c1-3)
    # Fallback if hexdump fails
    [ -z "$suffix" ] && suffix=$(printf '%03x' $$)
    echo "p_${ts}_${suffix}"
}

# --- Validation Helpers -------------------------------------------------------

# Validate IMEI: exactly 15 digits
_validate_imei() {
    case "$1" in
        [0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]) return 0 ;;
        '') return 0 ;; # Empty IMEI allowed (means "don't change")
        *) return 1 ;;
    esac
}

# Validate TTL/HL: integer 0-255
_validate_ttl_hl() {
    case "$1" in
        ''|*[!0-9]*) return 1 ;;
        *)
            [ "$1" -ge 0 ] && [ "$1" -le 255 ] 2>/dev/null && return 0
            return 1
            ;;
    esac
}

# Validate PDP type
_validate_pdp_type() {
    case "$1" in
        IP|IPV6|IPV4V6) return 0 ;;
        *) return 1 ;;
    esac
}

# Validate CID: 1-15
_validate_cid() {
    case "$1" in
        ''|*[!0-9]*) return 1 ;;
        *)
            [ "$1" -ge 1 ] && [ "$1" -le 15 ] 2>/dev/null && return 0
            return 1
            ;;
    esac
}

# =============================================================================
# Profile CRUD Operations
# =============================================================================

# --- profile_count -----------------------------------------------------------
# Returns the number of profile files in the profiles directory.
profile_count() {
    local count=0
    for f in "$PROFILE_DIR"/p_*.json; do
        [ -f "$f" ] && count=$((count + 1))
    done
    echo "$count"
}

# --- profile_list ------------------------------------------------------------
# Returns a JSON object with a profiles array (summaries) and active_profile_id.
# Output: {"profiles":[...],"active_profile_id":"..."}
profile_list() {
    local active_id
    active_id=$(get_active_profile)
    local first=1

    printf '{"profiles":['

    for f in "$PROFILE_DIR"/p_*.json; do
        [ -f "$f" ] || continue
        local id name mno iccid created updated

        # Read file content once
        local content
        content=$(cat "$f" 2>/dev/null)
        [ -z "$content" ] && continue

        id=$(_json_extract "$content" "id")
        name=$(_json_extract "$content" "name")
        mno=$(_json_extract "$content" "mno")
        iccid=$(_json_extract "$content" "sim_iccid")
        created=$(_json_extract_raw "$content" "created_at")
        updated=$(_json_extract_raw "$content" "updated_at")

        [ -z "$id" ] && continue

        [ "$first" -eq 1 ] && first=0 || printf ','

        printf '{'
        _json_field_str "id" "$id"
        printf ','
        _json_field_str "name" "$name"
        printf ','
        _json_field_str "mno" "$mno"
        printf ','
        _json_field_str "sim_iccid" "$iccid"
        printf ','
        _json_field_num "created_at" "$created"
        printf ','
        _json_field_num "updated_at" "$updated"
        printf '}'
    done

    printf '],'
    if [ -n "$active_id" ]; then
        _json_field_str "active_profile_id" "$active_id"
    else
        printf '"active_profile_id":null'
    fi
    printf '}\n'
}

# --- profile_get <id> --------------------------------------------------------
# Returns the full profile JSON for a given ID.
# Outputs the raw file content (it's already valid JSON).
# Returns 1 if profile not found.
profile_get() {
    local id="$1"
    local file="$PROFILE_DIR/${id}.json"

    if [ ! -f "$file" ]; then
        qlog_warn "Profile not found: $id" 2>/dev/null
        return 1
    fi

    cat "$file"
}

# --- profile_save ------------------------------------------------------------
# Creates or updates a profile. Reads JSON from stdin.
# On create: generates ID, sets created_at/updated_at, enforces 10-limit.
# On update: preserves ID + created_at, updates updated_at.
# Output: {"success":true,"id":"<profile_id>"} on stdout.
# Returns 1 on validation failure (error JSON on stdout).
profile_save() {
    local input
    input=$(cat)

    if [ -z "$input" ]; then
        printf '{"success":false,"error":"empty_input","detail":"No profile data provided"}\n'
        return 1
    fi

    # --- Extract all fields from input JSON ---
    local name mno sim_iccid
    local apn_cid apn_name apn_pdp_type
    local imei ttl hl
    local existing_id

    name=$(_json_extract "$input" "name")
    mno=$(_json_extract "$input" "mno")
    sim_iccid=$(_json_extract "$input" "sim_iccid")
    existing_id=$(_json_extract "$input" "id")

    # APN settings — frontend sends these as flat keys for BusyBox-safe parsing
    apn_cid=$(_json_extract_raw "$input" "cid")
    apn_name=$(_json_extract "$input" "apn_name")
    apn_pdp_type=$(_json_extract "$input" "pdp_type")

    imei=$(_json_extract "$input" "imei")
    ttl=$(_json_extract_raw "$input" "ttl")
    hl=$(_json_extract_raw "$input" "hl")
    # --- Apply defaults for optional fields ---
    [ -z "$apn_cid" ] || [ "$apn_cid" = "null" ] && apn_cid=1
    [ -z "$apn_pdp_type" ] && apn_pdp_type="IPV4V6"
    [ -z "$ttl" ] || [ "$ttl" = "null" ] && ttl=0
    [ -z "$hl" ] || [ "$hl" = "null" ] && hl=0

    # --- Validation ---
    local errors=""

    if [ -z "$name" ]; then
        errors="${errors}Profile name is required. "
    fi

    if ! _validate_cid "$apn_cid"; then
        errors="${errors}CID must be 1-15. "
    fi

    if [ -n "$apn_pdp_type" ] && ! _validate_pdp_type "$apn_pdp_type"; then
        errors="${errors}Invalid PDP type (must be IP, IPV6, or IPV4V6). "
    fi

    if [ -n "$imei" ] && ! _validate_imei "$imei"; then
        errors="${errors}IMEI must be exactly 15 digits. "
    fi

    if ! _validate_ttl_hl "$ttl"; then
        errors="${errors}TTL must be 0-255. "
    fi

    if ! _validate_ttl_hl "$hl"; then
        errors="${errors}HL must be 0-255. "
    fi

    if [ -n "$errors" ]; then
        local escaped_errors
        escaped_errors=$(_json_str_escape "$errors")
        printf '{"success":false,"error":"validation_failed","detail":"%s"}\n' "$escaped_errors"
        return 1
    fi

    # --- Determine if create or update ---
    local id created_at updated_at
    updated_at=$(date +%s)

    if [ -n "$existing_id" ] && [ -f "$PROFILE_DIR/${existing_id}.json" ]; then
        # UPDATE: preserve ID and created_at
        id="$existing_id"
        local old_content
        old_content=$(cat "$PROFILE_DIR/${id}.json" 2>/dev/null)
        created_at=$(_json_extract_raw "$old_content" "created_at")
        [ -z "$created_at" ] && created_at="$updated_at"
        qlog_info "Updating profile: $id ($name)" 2>/dev/null
    else
        # CREATE: enforce limit, generate ID
        local count
        count=$(profile_count)
        if [ "$count" -ge "$MAX_PROFILES" ]; then
            printf '{"success":false,"error":"limit_reached","detail":"Maximum %d profiles allowed"}\n' "$MAX_PROFILES"
            return 1
        fi
        id=$(_generate_profile_id)
        created_at="$updated_at"
        qlog_info "Creating profile: $id ($name)" 2>/dev/null
    fi

    # --- Write profile JSON to temp file, then atomic mv ---
    local tmp_file="$PROFILE_DIR/${id}.json.tmp"
    local final_file="$PROFILE_DIR/${id}.json"

    cat > "$tmp_file" << PROFILE_EOF
{
  "id": "$(printf '%s' "$id")",
  "name": "$(_json_str_escape "$name")",
  "mno": "$(_json_str_escape "$mno")",
  "sim_iccid": "$(_json_str_escape "$sim_iccid")",
  "created_at": $created_at,
  "updated_at": $updated_at,
  "settings": {
    "apn": {
      "cid": $apn_cid,
      "name": "$(_json_str_escape "$apn_name")",
      "pdp_type": "$apn_pdp_type"
    },
    "imei": "$(_json_str_escape "$imei")",
    "ttl": $ttl,
    "hl": $hl
  }
}
PROFILE_EOF

    # Atomic replace
    mv "$tmp_file" "$final_file"

    if [ $? -ne 0 ]; then
        qlog_error "Failed to write profile: $id" 2>/dev/null
        rm -f "$tmp_file"
        printf '{"success":false,"error":"write_failed","detail":"Failed to save profile to disk"}\n'
        return 1
    fi

    printf '{"success":true,"id":"%s"}\n' "$id"
    return 0
}

# --- profile_delete <id> -----------------------------------------------------
# Removes a profile file. Clears active_profile if it was the deleted one.
# Returns 1 if profile not found.
profile_delete() {
    local id="$1"

    if [ -z "$id" ]; then
        printf '{"success":false,"error":"no_id","detail":"Profile ID is required"}\n'
        return 1
    fi

    local file="$PROFILE_DIR/${id}.json"

    if [ ! -f "$file" ]; then
        printf '{"success":false,"error":"not_found","detail":"Profile not found"}\n'
        return 1
    fi

    # Remove the file
    rm -f "$file"

    if [ $? -ne 0 ]; then
        qlog_error "Failed to delete profile: $id" 2>/dev/null
        printf '{"success":false,"error":"delete_failed","detail":"Failed to remove profile file"}\n'
        return 1
    fi

    # If this was the active profile, clear it
    local active_id
    active_id=$(get_active_profile)
    if [ "$active_id" = "$id" ]; then
        clear_active_profile
        qlog_info "Cleared active profile (deleted: $id)" 2>/dev/null
    fi

    qlog_info "Deleted profile: $id" 2>/dev/null
    printf '{"success":true,"id":"%s"}\n' "$id"
    return 0
}

# =============================================================================
# Active Profile Management
# =============================================================================

# Returns the currently active profile ID, or empty string if none.
get_active_profile() {
    if [ -f "$ACTIVE_PROFILE_FILE" ]; then
        local id
        id=$(cat "$ACTIVE_PROFILE_FILE" 2>/dev/null | tr -d ' \n\r')
        # Verify the profile still exists
        if [ -n "$id" ] && [ -f "$PROFILE_DIR/${id}.json" ]; then
            echo "$id"
        fi
    fi
}

# Set the active profile ID.
set_active_profile() {
    local id="$1"
    if [ -z "$id" ]; then
        return 1
    fi
    # Verify profile exists
    if [ ! -f "$PROFILE_DIR/${id}.json" ]; then
        qlog_warn "Cannot set active profile — not found: $id" 2>/dev/null
        return 1
    fi
    printf '%s' "$id" > "$ACTIVE_PROFILE_FILE"
    qlog_info "Active profile set: $id" 2>/dev/null
}

# Clear the active profile.
clear_active_profile() {
    rm -f "$ACTIVE_PROFILE_FILE"
}

# =============================================================================
# AT Command Conversion Helpers
# =============================================================================

# NOTE: mode_to_at() and at_to_mode() removed — band locking and network mode
# are now owned by Connection Scenarios, not SIM Profiles. These helpers will
# be reimplemented in the Connection Scenarios library when that feature is built.
