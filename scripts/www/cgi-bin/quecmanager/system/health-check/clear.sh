#!/bin/sh
. /usr/lib/qmanager/cgi_base.sh
. /usr/lib/qmanager/platform.sh
# =============================================================================
# clear.sh — POST: delete previous System Health Check run artifacts.
#   Refuses if a job is currently running.
# =============================================================================

qlog_init "cgi_health_check_clear"
cgi_headers
cgi_handle_options

STATUS_FILE="/tmp/qmanager_health_check.json"

if [ "$REQUEST_METHOD" != "POST" ]; then
    cgi_method_not_allowed
fi

# Pre-check: refuse if a runner is alive. Worker double-checks under privilege.
if [ -f "$STATUS_FILE" ]; then
    existing_status=$(jq -r '.status // ""' "$STATUS_FILE" 2>/dev/null)
    existing_pid=$(jq -r '.pid // 0' "$STATUS_FILE" 2>/dev/null)
    if [ "$existing_status" = "running" ] && [ "$existing_pid" -gt 0 ] && pid_alive "$existing_pid"; then
        cgi_error "job_running" "a diagnostic job is currently running"
        exit 0
    fi
fi

# Delegate to privileged worker. Output is already JSON.
out=$(sudo -n /usr/bin/qmanager_health_check --clear 2>&1)
rc=$?
if [ "$rc" -ne 0 ]; then
    qlog_error "clear failed rc=$rc out=$out"
    # If worker emitted JSON, pass through; else wrap.
    if printf '%s' "$out" | jq -e . >/dev/null 2>&1; then
        printf '%s\n' "$out"
    else
        cgi_error "clear_failed" "$out"
    fi
    exit 0
fi

qlog_info "cleared health check artifacts"
printf '%s\n' "$out"
