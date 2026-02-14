#!/bin/sh
# =============================================================================
# send_command.sh — CGI Endpoint for AT Terminal Commands
# =============================================================================
# Accepts a user's AT command, passes it through qcmd, and returns the
# raw modem response as JSON.
#
# Endpoint: POST /cgi-bin/quecmanager/at_cmd/send_command.sh
# Request body: {"command": "AT+COPS?"}
# Response: {"success": true, "response": "...", "command": "AT+COPS?"}
#
# Install location: /www/cgi-bin/quecmanager/at_cmd/send_command.sh
# =============================================================================

# --- Logging -----------------------------------------------------------------
. /usr/lib/qmanager/qlog.sh 2>/dev/null || {
    qlog_init() { :; }
    qlog_debug() { :; }
    qlog_info() { :; }
    qlog_warn() { :; }
    qlog_error() { :; }
}
qlog_init "cgi_terminal"

# --- HTTP Headers ------------------------------------------------------------
echo "Content-Type: application/json"
echo "Cache-Control: no-cache"
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

# --- Read POST body ----------------------------------------------------------
if [ -n "$CONTENT_LENGTH" ] && [ "$CONTENT_LENGTH" -gt 0 ] 2>/dev/null; then
    POST_DATA=$(dd bs=1 count="$CONTENT_LENGTH" 2>/dev/null)
else
    echo '{"success":false,"error":"no_body","detail":"POST body is empty"}'
    exit 0
fi

# --- Extract command from JSON ------------------------------------------------
# Minimal JSON parsing using sed (no jq on OpenWRT by default)
COMMAND=$(echo "$POST_DATA" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')

if [ -z "$COMMAND" ]; then
    qlog_warn "Terminal request with missing command field"
    echo '{"success":false,"error":"no_command","detail":"Missing command field in JSON body"}'
    exit 0
fi

qlog_info "Terminal command: ${COMMAND}"

# --- Safety check: Block long commands from the raw terminal ------------------
case "$COMMAND" in
    *QSCAN*|*QSCANFREQ*)
        qlog_warn "Terminal blocked long command: ${COMMAND}"
        echo '{"success":false,"error":"blocked","detail":"Use the Cell Scanner page for this command."}'
        exit 0
        ;;
esac

# --- Execute via qcmd ---------------------------------------------------------
RESULT=$(qcmd -j "$COMMAND")

echo "$RESULT"
