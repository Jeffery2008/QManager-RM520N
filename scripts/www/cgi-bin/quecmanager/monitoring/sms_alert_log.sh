#!/bin/sh
. /usr/lib/qmanager/cgi_base.sh
# =============================================================================
# sms_alert_log.sh — CGI Endpoint: SMS Alert Log (GET only)
# =============================================================================
# Returns the NDJSON SMS alert log as a JSON array (newest first).
#
# Log file: /tmp/qmanager_sms_log.json (NDJSON, max 100 entries)
#
# Endpoint: GET /cgi-bin/quecmanager/monitoring/sms_alert_log.sh
# Install location: /www/cgi-bin/quecmanager/monitoring/sms_alert_log.sh
# =============================================================================

qlog_init "cgi_sms_log"
cgi_headers
cgi_handle_options

LOG_FILE="/tmp/qmanager_sms_log.json"

if [ "$REQUEST_METHOD" = "GET" ]; then
    if [ -f "$LOG_FILE" ] && [ -s "$LOG_FILE" ]; then
        total=$(wc -l < "$LOG_FILE" 2>/dev/null || echo 0)
        entries=$(jq -s 'reverse' "$LOG_FILE" 2>/dev/null) || entries="[]"

        jq -n \
            --argjson entries "$entries" \
            --argjson total "$total" \
            '{ success: true, entries: $entries, total: $total }'
    else
        echo '{"success":true,"entries":[],"total":0}'
    fi
    exit 0
fi

cgi_error "method_not_allowed" "Only GET is supported"
