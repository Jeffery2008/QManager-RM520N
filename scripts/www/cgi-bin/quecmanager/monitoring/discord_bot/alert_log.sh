#!/bin/sh
. /usr/lib/qmanager/cgi_base.sh

qlog_init "cgi_discord_log"
cgi_headers
cgi_handle_options

LOG="/tmp/qmanager_discord_log.json"

if [ "$REQUEST_METHOD" = "GET" ]; then
    if [ -f "$LOG" ]; then
        entries=$(tail -n 20 "$LOG" | jq -s '.' 2>/dev/null || printf '[]')
    else
        entries="[]"
    fi
    jq -n --argjson entries "$entries" '{success:true, entries:$entries}'
fi
