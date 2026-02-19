#!/bin/sh
# =============================================================================
# lock.sh — CGI Endpoint: Apply Band Lock
# =============================================================================
# Locks bands for a single category (lte, nsa_nr5g, or sa_nr5g).
# Per-card operation — each band card sends its own independent lock request.
#
# POST body:
#   {"band_type":"lte","bands":"1:3:7:28"}
#   {"band_type":"nsa_nr5g","bands":"41:78"}
#   {"band_type":"sa_nr5g","bands":"41:78"}
#
# On success, clears any previous failover activation flag and spawns the
# failover watcher (if failover is enabled) to monitor connectivity.
#
# Endpoint: POST /cgi-bin/quecmanager/bands/lock.sh
# Install location: /www/cgi-bin/quecmanager/bands/lock.sh
# =============================================================================

# --- Logging -----------------------------------------------------------------
. /usr/lib/qmanager/qlog.sh 2>/dev/null || {
    qlog_init() { :; }
    qlog_info() { :; }
    qlog_warn() { :; }
    qlog_error() { :; }
    qlog_debug() { :; }
}
qlog_init "cgi_bands_lock"

# --- Configuration -----------------------------------------------------------
FAILOVER_ENABLED_FILE="/etc/qmanager/band_failover_enabled"
FAILOVER_ACTIVATED_FLAG="/tmp/qmanager_band_failover"
FAILOVER_PID_FILE="/tmp/qmanager_band_failover.pid"
FAILOVER_SCRIPT="/usr/bin/qmanager_band_failover"

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

# --- Parse JSON fields -------------------------------------------------------
json_field() {
    echo "$POST_DATA" | sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p"
}

BAND_TYPE=$(json_field "band_type")
BANDS=$(json_field "bands")

# --- Validate inputs ---------------------------------------------------------
if [ -z "$BAND_TYPE" ]; then
    echo '{"success":false,"error":"no_band_type","detail":"Missing band_type field"}'
    exit 0
fi

if [ -z "$BANDS" ]; then
    echo '{"success":false,"error":"no_bands","detail":"Missing bands field"}'
    exit 0
fi

# Validate band_type is one of the allowed values
AT_PARAM=""
case "$BAND_TYPE" in
    lte)        AT_PARAM="lte_band" ;;
    nsa_nr5g)   AT_PARAM="nsa_nr5g_band" ;;
    sa_nr5g)    AT_PARAM="nr5g_band" ;;
    *)
        echo '{"success":false,"error":"invalid_band_type","detail":"band_type must be lte, nsa_nr5g, or sa_nr5g"}'
        exit 0
        ;;
esac

# Validate bands format: must be colon-delimited numbers only
cleaned=$(echo "$BANDS" | tr -d '0-9:')
if [ -n "$cleaned" ]; then
    echo '{"success":false,"error":"invalid_bands","detail":"bands must be colon-delimited numbers (e.g. 1:3:7:28)"}'
    exit 0
fi

qlog_info "Band lock request: type=$BAND_TYPE param=$AT_PARAM bands=$BANDS"

# --- Send AT command ---------------------------------------------------------
AT_CMD="AT+QNWPREFCFG=\"${AT_PARAM}\",${BANDS}"

result=$(qcmd "$AT_CMD" 2>/dev/null)
rc=$?

if [ $rc -ne 0 ] || [ -z "$result" ]; then
    qlog_error "Band lock failed (rc=$rc): $AT_CMD"
    echo '{"success":false,"error":"modem_error","detail":"Failed to send band lock command"}'
    exit 0
fi

case "$result" in
    *ERROR*)
        qlog_error "Band lock AT ERROR: $AT_CMD -> $result"
        echo '{"success":false,"error":"at_error","detail":"Modem rejected band lock command"}'
        exit 0
        ;;
esac

qlog_info "Band lock applied: $AT_PARAM=$BANDS"

# --- Clear failover activation flag (new lock supersedes previous failover) --
rm -f "$FAILOVER_ACTIVATED_FLAG"

# --- Spawn failover watcher if enabled ---------------------------------------
failover_armed="false"

failover_enabled="false"
if [ -f "$FAILOVER_ENABLED_FILE" ]; then
    val=$(cat "$FAILOVER_ENABLED_FILE" 2>/dev/null | tr -d ' \n\r')
    [ "$val" = "1" ] && failover_enabled="true"
fi

if [ "$failover_enabled" = "true" ] && [ -x "$FAILOVER_SCRIPT" ]; then
    # Kill any existing watcher (latest lock is the one we monitor)
    if [ -f "$FAILOVER_PID_FILE" ]; then
        old_pid=$(cat "$FAILOVER_PID_FILE" 2>/dev/null | tr -d ' \n\r')
        if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
            kill "$old_pid" 2>/dev/null
            qlog_debug "Killed previous failover watcher (PID=$old_pid)"
        fi
        rm -f "$FAILOVER_PID_FILE"
    fi

    # Spawn new watcher (detached, one-shot)
    setsid "$FAILOVER_SCRIPT" &
    qlog_info "Failover watcher spawned"
    failover_armed="true"
fi

# --- Response ----------------------------------------------------------------
printf '{"success":true,"band_type":"%s","bands":"%s","failover_armed":%s}\n' \
    "$BAND_TYPE" "$BANDS" "$failover_armed"
