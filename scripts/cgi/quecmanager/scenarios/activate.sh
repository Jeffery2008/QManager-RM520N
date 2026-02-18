#!/bin/sh
# =============================================================================
# activate.sh — CGI Endpoint: Activate Connection Scenario
# =============================================================================
# Applies a connection scenario's network mode to the modem via qcmd.
# Synchronous — single AT command (~200ms), returns result immediately.
#
# Scenario → AT command mapping:
#   balanced  → AT+QNWPREFCFG="mode_pref",AUTO     (modem decides)
#   gaming    → AT+QNWPREFCFG="mode_pref",NR5G     (SA only)
#   streaming → AT+QNWPREFCFG="mode_pref",LTE:NR5G (SA + NSA)
#   custom-*  → (future: read from /etc/qmanager/scenarios/<id>.json)
#
# Endpoint: POST /cgi-bin/quecmanager/scenarios/activate.sh
# Request body: {"id": "<scenario_id>"}
# Response: {"success":true,"id":"<scenario_id>"}
#       or: {"success":false,"error":"...","detail":"..."}
#
# Install location: /www/cgi-bin/quecmanager/scenarios/activate.sh
# =============================================================================

# --- Logging -----------------------------------------------------------------
. /usr/lib/qmanager/qlog.sh 2>/dev/null || {
    qlog_init() { :; }
    qlog_info() { :; }
    qlog_warn() { :; }
    qlog_error() { :; }
}
qlog_init "cgi_scenario_activate"

# --- Configuration -----------------------------------------------------------
ACTIVE_SCENARIO_FILE="/etc/qmanager/active_scenario"

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

# --- Extract scenario ID from JSON body --------------------------------------
SCENARIO_ID=$(echo "$POST_DATA" | sed -n 's/.*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')

if [ -z "$SCENARIO_ID" ]; then
    echo '{"success":false,"error":"no_id","detail":"Missing id field in request body"}'
    exit 0
fi

# --- Map scenario ID to AT mode_pref value -----------------------------------
AT_MODE=""
case "$SCENARIO_ID" in
    balanced)
        AT_MODE="AUTO"
        ;;
    gaming)
        AT_MODE="NR5G"
        ;;
    streaming)
        AT_MODE="LTE:NR5G"
        ;;
    custom-*)
        # Future: read mode from /etc/qmanager/scenarios/<id>.json
        # For now, custom scenarios are not supported for activation
        echo '{"success":false,"error":"not_implemented","detail":"Custom scenario activation not yet supported"}'
        exit 0
        ;;
    *)
        echo '{"success":false,"error":"invalid_id","detail":"Unknown scenario ID"}'
        exit 0
        ;;
esac

qlog_info "Activating scenario: $SCENARIO_ID (mode_pref=$AT_MODE)"

# --- Send AT command via qcmd ------------------------------------------------
AT_CMD="AT+QNWPREFCFG=\"mode_pref\",${AT_MODE}"
RESULT=$(qcmd "$AT_CMD" 2>/dev/null)
RC=$?

# Check for failure
if [ $RC -ne 0 ] || [ -z "$RESULT" ]; then
    qlog_error "AT command failed (rc=$RC): $AT_CMD"
    echo '{"success":false,"error":"modem_error","detail":"Failed to send AT command to modem"}'
    exit 0
fi

# Check for ERROR in response
case "$RESULT" in
    *ERROR*)
        qlog_error "AT command returned ERROR: $AT_CMD -> $RESULT"
        echo '{"success":false,"error":"at_error","detail":"Modem rejected the network mode command"}'
        exit 0
        ;;
esac

# --- Persist active scenario to flash ----------------------------------------
mkdir -p "$(dirname "$ACTIVE_SCENARIO_FILE")" 2>/dev/null
printf '%s' "$SCENARIO_ID" > "$ACTIVE_SCENARIO_FILE"

qlog_info "Scenario activated: $SCENARIO_ID"
printf '{"success":true,"id":"%s"}\n' "$SCENARIO_ID"
