#!/bin/sh
. /usr/lib/qmanager/cgi_base.sh
# =============================================================================
# status.sh — GET: serve current System Health Check status JSON.
#   ?test_id=<id>   → return last 4 KB of that test's raw output
# =============================================================================

qlog_init "cgi_health_check_status"
cgi_headers

STATUS_FILE="/tmp/qmanager_health_check.json"

if [ "$REQUEST_METHOD" != "GET" ]; then
    cgi_method_not_allowed
fi

# Parse query string for test_id (POSIX-only, no curl/awk dependency tricks).
test_id=""
case "$QUERY_STRING" in
    *test_id=*) test_id=$(printf '%s' "$QUERY_STRING" | sed -n 's/.*test_id=\([^&]*\).*/\1/p') ;;
esac

if [ -n "$test_id" ]; then
    # Validate test_id: lowercase letters, digits, dot, underscore.
    if ! printf '%s' "$test_id" | grep -qE '^[a-z0-9_.]{1,64}$'; then
        cgi_error "invalid_test_id" "test_id contains invalid characters"
        exit 0
    fi
    if [ ! -f "$STATUS_FILE" ]; then
        cgi_error "no_run" "no diagnostic run found"
        exit 0
    fi
    job_id=$(jq -r '.job_id // ""' "$STATUS_FILE")
    out_file="/tmp/qmanager_health_check_${job_id}/tests/${test_id}.txt"
    if [ ! -f "$out_file" ]; then
        jq -n --arg id "$test_id" '{success:true, test_id:$id, output:"", truncated:false}'
        exit 0
    fi
    # Tail last 4 KB.
    body=$(tail -c 4096 "$out_file")
    truncated=false
    [ "$(stat -c %s "$out_file" 2>/dev/null || echo 0)" -gt 4096 ] && truncated=true
    jq -n --arg id "$test_id" --arg body "$body" --argjson trunc "$truncated" \
        '{success:true, test_id:$id, output:$body, truncated:$trunc}'
    exit 0
fi

# Default path — return the full status JSON.
if [ -f "$STATUS_FILE" ]; then
    cat "$STATUS_FILE"
else
    jq -n '{success:true, status:"none", tests:[], summary:{pass:0,fail:0,warn:0,skip:0,total:0}}'
fi
