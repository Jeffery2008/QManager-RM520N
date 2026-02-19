#!/bin/sh
# =============================================================================
# failover_toggle.sh — CGI Endpoint: Toggle Band Failover
# =============================================================================
# Enables or disables the band failover safety mechanism. When enabled,
# a one-shot watcher is spawned after each band lock operation that reverts
# to all supported bands if the modem loses service within 15 seconds.
#
# The setting persists on flash (/etc/qmanager/band_failover_enabled).
#
# POST body:
#   {"enabled": true}   — enable failover
#   {"enabled": false}  — disable failover
#
# Endpoint: POST /cgi-bin/quecmanager/bands/failover_toggle.sh
# Install location: /www/cgi-bin/quecmanager/bands/failover_toggle.sh
# =============================================================================

# --- Logging -----------------------------------------------------------------
. /usr/lib/qmanager/qlog.sh 2>/dev/null || {
    qlog_init() { :; }
    qlog_info() { :; }
    qlog_warn() { :; }
    qlog_error() { :; }
}
qlog_init "cgi_bands_failover"

# --- Configuration -----------------------------------------------------------
FAILOVER_ENABLED_FILE="/etc/qmanager/band_failover_enabled"

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

# --- Parse enabled value -----------------------------------------------------
# Handle both "enabled":true and "enabled":"true" formats
ENABLED_VAL=$(echo "$POST_DATA" | sed -n 's/.*"enabled"[[:space:]]*:[[:space:]]*\(true\|false\|"true"\|"false"\).*/\1/p' | tr -d '"')

if [ -z "$ENABLED_VAL" ]; then
    echo '{"success":false,"error":"no_enabled","detail":"Missing or invalid enabled field (expected true or false)"}'
    exit 0
fi

# --- Persist setting ---------------------------------------------------------
mkdir -p "$(dirname "$FAILOVER_ENABLED_FILE")" 2>/dev/null

if [ "$ENABLED_VAL" = "true" ]; then
    printf '1' > "$FAILOVER_ENABLED_FILE"
    qlog_info "Band failover ENABLED"
    printf '{"success":true,"enabled":true}\n'
else
    printf '0' > "$FAILOVER_ENABLED_FILE"
    qlog_info "Band failover DISABLED"
    printf '{"success":true,"enabled":false}\n'
fi
