#!/bin/sh
# discord_alerts.sh — Discord Bot shell helper
# Sourced by CGI scripts for sending test DMs via the bot status file.
# Install location: /usr/lib/qmanager/discord_alerts.sh

[ -n "$_DISCORD_ALERTS_LOADED" ] && return 0
_DISCORD_ALERTS_LOADED=1

_DA_CONFIG="/etc/qmanager/discord_bot.json"
_DA_STATUS="/tmp/qmanager_discord_status.json"
_DA_LOG="/tmp/qmanager_discord_log.json"
_DA_RELOAD_FLAG="/tmp/qmanager_discord_reload"

da_is_installed() {
    [ -x /usr/bin/qmanager_discord ]
}

da_is_running() {
    # svc_is_running comes from platform.sh (sourced via cgi_base.sh) — uses sudo for www-data context.
    if command -v svc_is_running >/dev/null 2>&1; then
        svc_is_running qmanager_discord
    else
        [ -f /run/qmanager-discord.pid ]
    fi
}

da_is_connected() {
    [ -f "$_DA_STATUS" ] || return 1
    jq -r '.connected // false' "$_DA_STATUS" 2>/dev/null | grep -q "^true$"
}

da_touch_reload() {
    touch "$_DA_RELOAD_FLAG" 2>/dev/null
}

da_bot_status_json() {
    if [ -f "$_DA_STATUS" ]; then
        cat "$_DA_STATUS"
    else
        printf '{"connected":false,"error":"not_started"}'
    fi
}
