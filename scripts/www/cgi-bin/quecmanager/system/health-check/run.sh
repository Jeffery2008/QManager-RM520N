#!/bin/sh
. /usr/lib/qmanager/cgi_base.sh
. /usr/lib/qmanager/platform.sh
# =============================================================================
# run.sh — POST: launch System Health Check runner. Idempotent.
# =============================================================================

qlog_init "cgi_health_check_run"
cgi_headers
cgi_handle_options

STATUS_FILE="/tmp/qmanager_health_check.json"

if [ "$REQUEST_METHOD" != "POST" ]; then
    cgi_method_not_allowed
fi

# Idempotency: if a job is already running, return its job_id.
if [ -f "$STATUS_FILE" ]; then
    existing_status=$(jq -r '.status // ""' "$STATUS_FILE" 2>/dev/null)
    existing_pid=$(jq -r '.pid // ""' "$STATUS_FILE" 2>/dev/null)
    existing_id=$(jq -r '.job_id // ""' "$STATUS_FILE" 2>/dev/null)
    if [ "$existing_status" = "running" ] && pid_alive "$existing_pid"; then
        existing_started=$(jq -r '.started_at // 0' "$STATUS_FILE")
        jq -n --arg id "$existing_id" --argjson s "$existing_started" \
            '{success:true, job_id:$id, started_at:$s, resumed:true}'
        exit 0
    fi
    # Stale "running" with dead PID — the runner crashed. Mark error.
    if [ "$existing_status" = "running" ]; then
        tmp="${STATUS_FILE}.tmp"
        jq '.status = "error" | .error = "runner exited unexpectedly"' "$STATUS_FILE" > "$tmp" && mv "$tmp" "$STATUS_FILE"
    fi
fi

# Generate a job id: YYYYMMDD-HHMMSS-<rand4>
ts=$(date -u +'%Y%m%d-%H%M%S')
rand=$(head -c 2 /dev/urandom 2>/dev/null | od -An -tx1 | tr -d ' \n' | head -c 4)
[ -n "$rand" ] || rand=$(printf '%04x' $$)
job_id="${ts}-${rand}"

# Spawn detached. setsid + & + disowned redirects let the CGI return
# immediately while the runner continues under init.
setsid sudo -n /usr/bin/qmanager_health_check "$job_id" \
    </dev/null >/tmp/qmanager_health_check.log 2>&1 &
disown 2>/dev/null || true

started=$(date +%s)
qlog_info "spawned health check job $job_id"
jq -n --arg id "$job_id" --argjson s "$started" \
    '{success:true, job_id:$id, started_at:$s, resumed:false}'
