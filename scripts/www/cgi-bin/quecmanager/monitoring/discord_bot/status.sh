#!/bin/sh
. /usr/lib/qmanager/cgi_base.sh
. /usr/lib/qmanager/discord_alerts.sh

qlog_init "cgi_discord_status"
cgi_headers
cgi_handle_options

if [ "$REQUEST_METHOD" = "GET" ]; then
    status_json=$(da_bot_status_json)
    installed="false"
    da_is_installed && installed="true"
    # `authorized` reflects whether the bot has captured the owner's DM channel
    # (from a slash-command interaction or an inbound DM). Without that cache,
    # ChannelMessageSend can't reach the owner — Discord error 50007 — so this
    # is the only reliable proof the bot is fully wired up. Cleared by reset.
    authorized="false"
    [ -s /etc/qmanager/discord_dm_channel ] && authorized="true"
    printf '%s' "$status_json" | jq \
        --argjson installed "$installed" \
        --argjson authorized "$authorized" \
        '. + {success:true, installed:$installed, authorized:$authorized}'
fi
