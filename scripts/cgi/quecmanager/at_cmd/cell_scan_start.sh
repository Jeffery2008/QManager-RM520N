#!/bin/sh
# =============================================================================
# cell_scan_start.sh — CGI Endpoint: Start Cell Scan
# =============================================================================
# Spawns the qmanager_cell_scanner background worker.
# Enforces singleton — only ONE scan may run at a time.
#
# Endpoint: POST /cgi-bin/quecmanager/at_cmd/cell_scan_start.sh
# Response: {"success": true}
#       or: {"success": false, "error": "already_running|modem_busy"}
#
# Install location: /www/cgi-bin/quecmanager/at_cmd/cell_scan_start.sh
# =============================================================================

# --- Logging -----------------------------------------------------------------
. /usr/lib/qmanager/qlog.sh 2>/dev/null || {
    qlog_init() { :; }
    qlog_info() { :; }
    qlog_warn() { :; }
    qlog_error() { :; }
}
qlog_init "cgi_cell_scan"

# --- Configuration -----------------------------------------------------------
PID_FILE="/tmp/qmanager_cell_scan.pid"
RESULT_FILE="/tmp/qmanager_cell_scan_result.json"
ERROR_FILE="/tmp/qmanager_cell_scan_error"
SCANNER_BIN="/usr/bin/qmanager_cell_scanner"
LONG_FLAG="/tmp/qmanager_long_running"

# --- HTTP Headers ------------------------------------------------------------
echo "Content-Type: application/json"
echo "Cache-Control: no-cache, no-store, must-revalidate"
echo "Access-Control-Allow-Origin: *"
echo "Access-Control-Allow-Methods: POST, OPTIONS"
echo "Access-Control-Allow-Headers: Content-Type"
echo ""

# --- Handle CORS preflight ---------------------------------------------------
if [ "$REQUEST_METHOD" = "OPTIONS" ]; then
    exit 0
fi

# --- Validate method ---------------------------------------------------------
if [ "$REQUEST_METHOD" != "POST" ]; then
    echo '{"success":false,"error":"method_not_allowed","detail":"Use POST"}'
    exit 0
fi

# --- Check: scan already running? --------------------------------------------
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE" 2>/dev/null)
    if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
        qlog_warn "Cell scan already running (PID: $OLD_PID)"
        echo '{"success":false,"error":"already_running","detail":"A cell scan is already in progress"}'
        exit 0
    fi
    # Stale PID file — clean up
    qlog_info "Cleaning stale cell scan PID file (PID: $OLD_PID)"
    rm -f "$PID_FILE"
fi

# --- Check: modem already busy with another long command? --------------------
if [ -f "$LONG_FLAG" ]; then
    CURRENT_CMD=$(cat "$LONG_FLAG" 2>/dev/null)
    qlog_warn "Modem busy with long command: $CURRENT_CMD"
    echo '{"success":false,"error":"modem_busy","detail":"Modem is busy with another long command"}'
    exit 0
fi

# --- Clean up previous results -----------------------------------------------
rm -f "$RESULT_FILE" "$ERROR_FILE"

# --- Launch scanner in background --------------------------------------------
( "$SCANNER_BIN" ) </dev/null >/dev/null 2>&1 &

# Brief pause to let PID file be written
sleep 0.3

if [ -f "$PID_FILE" ]; then
    NEW_PID=$(cat "$PID_FILE" 2>/dev/null)
    qlog_info "Cell scan started (PID: $NEW_PID)"
    jq -n --argjson pid "$NEW_PID" '{"success": true, "pid": $pid}'
else
    qlog_error "Cell scanner failed to start"
    echo '{"success":false,"error":"start_failed","detail":"Scanner process did not start"}'
fi
