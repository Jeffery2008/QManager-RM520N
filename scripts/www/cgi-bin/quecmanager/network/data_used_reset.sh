#!/bin/sh
. /usr/lib/qmanager/cgi_base.sh
# =============================================================================
# data_used_reset.sh — CGI Endpoint: Queue a Data Usage Counter Reset (POST)
# =============================================================================
# Touches /tmp/qmanager_data_used_reset. The qmanager_poller detects this
# flag on its next tick, zeroes the accumulated counters in
# /usrdata/qmanager/data_used.json, and removes the flag.
#
# No direct writes to the persistent state file are made here — the poller
# is the sole writer, avoiding any root-vs-www-data race.
#
# POST body: (none required)
# Response:  {"status":"queued","ts":<epoch>}
#
# Endpoint: POST /cgi-bin/quecmanager/network/data_used_reset.sh
# Install location: /www/cgi-bin/quecmanager/network/data_used_reset.sh
# =============================================================================

# --- Logging -----------------------------------------------------------------
qlog_init "cgi_data_used_reset"
cgi_headers
cgi_handle_options

# --- Method guard ------------------------------------------------------------
if [ "$REQUEST_METHOD" != "POST" ]; then
    cgi_method_not_allowed
    exit 0
fi

# --- Signal the poller -------------------------------------------------------
RESET_FLAG="/tmp/qmanager_data_used_reset"

qlog_info "Data usage reset requested; touching flag $RESET_FLAG"

if touch "$RESET_FLAG" 2>/dev/null; then
    ts=$(date +%s)
    qlog_info "Reset flag created ts=$ts"
    jq -n --argjson ts "$ts" '{"status":"queued","ts":$ts}'
else
    err="Failed to create reset flag: $RESET_FLAG"
    qlog_error "$err"
    jq -n --arg error "$err" '{"status":"error","error":$error}'
fi
