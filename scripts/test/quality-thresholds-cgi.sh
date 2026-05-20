#!/bin/sh
# Smoke test for /cgi-bin/quecmanager/settings/quality_thresholds.sh
# Mirrors scripts/test/ping-profile-cgi.sh.
set -eu

if ! command -v jq >/dev/null; then
    echo "FAIL: jq not found" >&2
    exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CGI="$REPO_ROOT/scripts/www/cgi-bin/quecmanager/settings/quality_thresholds.sh"

if [ ! -f "$CGI" ]; then
    echo "FAIL: CGI script not found at $CGI" >&2
    exit 1
fi

TEST_DIR=$(mktemp -d)
trap 'rm -rf "$TEST_DIR"' EXIT
export QUALITY_CONFIG="$TEST_DIR/quality_thresholds.json"
export QUALITY_RELOAD_FLAG="$TEST_DIR/qmanager_events_reload"

STUB_LIB="$TEST_DIR/usr/lib/qmanager"
mkdir -p "$STUB_LIB"
cat > "$STUB_LIB/cgi_base.sh" <<'STUB'
[ -n "$_CGI_BASE_LOADED" ] && return 0
_CGI_BASE_LOADED=1
qlog_init()  { :; }
qlog_debug() { :; }
qlog_info()  { :; }
qlog_warn()  { :; }
qlog_error() { :; }
cgi_headers()        { :; }
cgi_handle_options() { :; }
cgi_read_post() {
    POST_DATA=""
    if [ -n "${CONTENT_LENGTH:-}" ] && [ "$CONTENT_LENGTH" -gt 0 ]; then
        POST_DATA=$(dd bs=1 count="$CONTENT_LENGTH" 2>/dev/null)
    fi
}
cgi_success() { printf '{"success":true}\n'; }
cgi_error()   { printf '{"success":false,"error":"%s","detail":"%s"}\n' "$1" "$2"; }
STUB

run_cgi() {
    env REQUEST_METHOD="$1" \
        CONTENT_TYPE="${2:-}" \
        CONTENT_LENGTH="${3:-0}" \
        QM_LIB_DIR="$STUB_LIB" \
        QUALITY_CONFIG="$QUALITY_CONFIG" \
        QUALITY_RELOAD_FLAG="$QUALITY_RELOAD_FLAG" \
        _SKIP_AUTH=1 \
        sh "$CGI"
}

PASS=0
FAIL=0
pass() { PASS=$((PASS+1)); echo "PASS: $1"; }
fail() { FAIL=$((FAIL+1)); echo "FAIL: $1" >&2; }

# Test 1: GET with no config returns tolerant default + is_default=true
rm -f "$QUALITY_CONFIG"
RES=$(run_cgi GET)
if echo "$RES" | jq -e '.success == true and .settings.latency.preset == "tolerant" and .settings.loss.preset == "tolerant" and .is_default == true' >/dev/null; then
    pass "GET with no config returns tolerant defaults + is_default=true"
else
    fail "GET with no config — got: $RES"
fi

# Test 2: POST each valid preset combination, verify file + reload flag
for lat in standard tolerant very-tolerant; do
    for loss in standard tolerant very-tolerant; do
        rm -f "$QUALITY_RELOAD_FLAG"
        BODY=$(printf '{"action":"save_settings","latency":{"preset":"%s"},"loss":{"preset":"%s"}}' "$lat" "$loss")
        LEN=${#BODY}
        RES=$(printf '%s' "$BODY" | run_cgi POST application/json "$LEN")
        if ! echo "$RES" | jq -e '.success == true' >/dev/null; then
            fail "POST lat=$lat loss=$loss — got: $RES"
            continue
        fi
        if [ "$(jq -r .latency.preset "$QUALITY_CONFIG")" != "$lat" ] \
            || [ "$(jq -r .loss.preset "$QUALITY_CONFIG")" != "$loss" ]; then
            fail "POST lat=$lat loss=$loss — config not updated"
            continue
        fi
        if [ ! -f "$QUALITY_RELOAD_FLAG" ]; then
            fail "POST lat=$lat loss=$loss — reload flag not touched"
            continue
        fi
        pass "POST lat=$lat loss=$loss (config+flag)"
    done
done

# Test 3: GET after POST returns saved values + is_default=false
RES=$(run_cgi GET)
if echo "$RES" | jq -e '.success == true and .settings.latency.preset == "very-tolerant" and .settings.loss.preset == "very-tolerant" and .is_default == false' >/dev/null; then
    pass "GET after POST reflects saved values + is_default=false"
else
    fail "GET after POST — got: $RES"
fi

# Test 4: Invalid latency preset rejected
BODY='{"action":"save_settings","latency":{"preset":"bogus"},"loss":{"preset":"tolerant"}}'
LEN=${#BODY}
RES=$(printf '%s' "$BODY" | run_cgi POST application/json "$LEN")
if echo "$RES" | jq -e '.success == false and .error == "invalid_latency_preset"' >/dev/null; then
    pass "Invalid latency preset rejected"
else
    fail "Invalid latency preset — got: $RES"
fi

# Test 5: Invalid loss preset rejected
BODY='{"action":"save_settings","latency":{"preset":"tolerant"},"loss":{"preset":"bogus"}}'
LEN=${#BODY}
RES=$(printf '%s' "$BODY" | run_cgi POST application/json "$LEN")
if echo "$RES" | jq -e '.success == false and .error == "invalid_loss_preset"' >/dev/null; then
    pass "Invalid loss preset rejected"
else
    fail "Invalid loss preset — got: $RES"
fi

# Test 6: Missing action rejected
BODY='{}'
LEN=${#BODY}
RES=$(printf '%s' "$BODY" | run_cgi POST application/json "$LEN")
if echo "$RES" | jq -e '.success == false and .error == "missing_action"' >/dev/null; then
    pass "Missing action rejected"
else
    fail "Missing action — got: $RES"
fi

# Test 7: Unknown action rejected
BODY='{"action":"delete"}'
LEN=${#BODY}
RES=$(printf '%s' "$BODY" | run_cgi POST application/json "$LEN")
if echo "$RES" | jq -e '.success == false and .error == "unknown_action"' >/dev/null; then
    pass "Unknown action rejected"
else
    fail "Unknown action — got: $RES"
fi

# Test 8: Atomic write — no .tmp lingers
if [ -f "${QUALITY_CONFIG}.tmp" ]; then
    fail "Atomic write — .tmp file lingers after success"
else
    pass "Atomic write — no .tmp file lingers"
fi

# Test 9: Malformed JSON config falls back to tolerant on GET, is_default=true
echo 'not valid json' > "$QUALITY_CONFIG"
RES=$(run_cgi GET)
if echo "$RES" | jq -e '.success == true and .settings.latency.preset == "tolerant" and .settings.loss.preset == "tolerant" and .is_default == true' >/dev/null; then
    pass "GET with malformed config falls back to tolerant + is_default=true"
else
    fail "GET with malformed config — got: $RES"
fi

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
