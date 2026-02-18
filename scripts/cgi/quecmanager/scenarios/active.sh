#!/bin/sh
# =============================================================================
# active.sh — CGI Endpoint: Get Active Connection Scenario
# =============================================================================
# Returns the currently active connection scenario ID.
# Defaults to "balanced" if no scenario has been explicitly activated.
#
# Endpoint: GET /cgi-bin/quecmanager/scenarios/active.sh
# Response: {"active_scenario_id":"balanced"}
#
# Install location: /www/cgi-bin/quecmanager/scenarios/active.sh
# =============================================================================

# --- Configuration -----------------------------------------------------------
ACTIVE_SCENARIO_FILE="/etc/qmanager/active_scenario"

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

# --- Read active scenario ----------------------------------------------------
ACTIVE_ID=""
if [ -f "$ACTIVE_SCENARIO_FILE" ]; then
    ACTIVE_ID=$(cat "$ACTIVE_SCENARIO_FILE" 2>/dev/null | tr -d ' \n\r')
fi

# Default to balanced if not set or empty
[ -z "$ACTIVE_ID" ] && ACTIVE_ID="balanced"

printf '{"active_scenario_id":"%s"}\n' "$ACTIVE_ID"
