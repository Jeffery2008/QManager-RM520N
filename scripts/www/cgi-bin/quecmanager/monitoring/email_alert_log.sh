#!/bin/sh
. /usr/lib/qmanager/cgi_base.sh
# =============================================================================
# email_alert_log.sh — CGI Endpoint: Email Alert Log (GET only)
# =============================================================================
# Returns the NDJSON email alert log as a JSON array.
#
# Log file: /tmp/qmanager_email_log.json (NDJSON, max 100 entries)
#
# Endpoint: GET /cgi-bin/quecmanager/monitoring/email_alert_log.sh
# Install location: /www/cgi-bin/quecmanager/monitoring/email_alert_log.sh
# =============================================================================

qlog_init "cgi_email_log"
cgi_headers
cgi_handle_options

LOG_FILE="/tmp/qmanager_email_log.json"

if [ "$REQUEST_METHOD" = "GET" ]; then
    if [ -f "$LOG_FILE" ] && [ -s "$LOG_FILE" ]; then
        total=$(wc -l < "$LOG_FILE" 2>/dev/null || echo 0)
        # Convert NDJSON to JSON array, newest first
        # tac is not available on BusyBox — use jq -s 'reverse' directly
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
