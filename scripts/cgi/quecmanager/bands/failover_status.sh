#!/bin/sh
# =============================================================================
# failover_status.sh — CGI Endpoint: Get Failover State (Lightweight)
# =============================================================================
# Reads only filesystem flags — zero modem contact. Designed for frequent
# polling (~2-3s) by the frontend after a band lock to detect when the
# failover watcher has completed its check.
#
# Endpoint: GET /cgi-bin/quecmanager/bands/failover_status.sh
# Response: {
#   "enabled": true,
#   "activated": false,
#   "watcher_running": true
# }
#
# Install location: /www/cgi-bin/quecmanager/bands/failover_status.sh
# =============================================================================

# --- Configuration -----------------------------------------------------------
FAILOVER_ENABLED_FILE="/etc/qmanager/band_failover_enabled"
FAILOVER_ACTIVATED_FLAG="/tmp/qmanager_band_failover"
WATCHER_PID_FILE="/tmp/qmanager_band_failover.pid"

# --- HTTP Headers ------------------------------------------------------------
echo "Content-Type: application/json"
echo "Cache-Control: no-cache"
echo "Access-Control-Allow-Origin: *"
echo "Access-Control-Allow-Methods: GET, OPTIONS"
echo "Access-Control-Allow-Headers: Content-Type"
echo ""

# --- Handle CORS preflight ---------------------------------------------------
if [ "$REQUEST_METHOD" = "OPTIONS" ]; then
    exit 0
fi

# --- Read failover enabled flag (persistent, flash) --------------------------
enabled="false"
if [ -f "$FAILOVER_ENABLED_FILE" ]; then
    val=$(cat "$FAILOVER_ENABLED_FILE" 2>/dev/null | tr -d ' \n\r')
    [ "$val" = "1" ] && enabled="true"
fi

# --- Read failover activated flag (RAM, written by watcher) ------------------
activated="false"
if [ -f "$FAILOVER_ACTIVATED_FLAG" ]; then
    activated="true"
fi

# --- Check if watcher process is still running -------------------------------
watcher_running="false"
if [ -f "$WATCHER_PID_FILE" ]; then
    watcher_pid=$(cat "$WATCHER_PID_FILE" 2>/dev/null | tr -d ' \n\r')
    if [ -n "$watcher_pid" ] && kill -0 "$watcher_pid" 2>/dev/null; then
        watcher_running="true"
    fi
fi

# --- Response ----------------------------------------------------------------
printf '{"enabled":%s,"activated":%s,"watcher_running":%s}\n' \
    "$enabled" "$activated" "$watcher_running"
