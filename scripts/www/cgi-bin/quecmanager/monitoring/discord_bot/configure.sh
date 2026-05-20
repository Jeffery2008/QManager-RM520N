#!/bin/sh
. /usr/lib/qmanager/cgi_base.sh
. /usr/lib/qmanager/discord_alerts.sh
# =============================================================================
# configure.sh — Discord Bot configuration CGI (GET + POST)
# GET:  Returns current config (token masked) + bot status.
# POST: action=save_settings | action=install | action=uninstall | action=reset | action=enable | action=disable
# =============================================================================

qlog_init "cgi_discord_configure"
cgi_headers
cgi_handle_options

CONFIG="/etc/qmanager/discord_bot.json"
RELOAD_FLAG="/tmp/qmanager_discord_reload"
BOT_BIN="/usr/bin/qmanager_discord"

if [ "$REQUEST_METHOD" = "GET" ]; then
    installed="false"
    da_is_installed && installed="true"

    connected="false"
    da_is_connected && connected="true"

    enabled="false"
    owner_discord_id=""
    threshold_minutes=5
    token_set="false"

    if [ -f "$CONFIG" ]; then
        token=$(jq -r '.bot_token // ""' "$CONFIG" 2>/dev/null)
        [ -n "$token" ] && token_set="true"
        owner_discord_id=$(jq -r '.owner_discord_id // ""' "$CONFIG" 2>/dev/null)
        enabled=$(jq -r '(.enabled) | if . == null then "false" else tostring end' "$CONFIG" 2>/dev/null)
        threshold_minutes=$(jq -r '.threshold_minutes // 5' "$CONFIG" 2>/dev/null)
    fi

    jq -n \
        --argjson success true \
        --argjson installed "$installed" \
        --argjson connected "$connected" \
        --argjson enabled "$enabled" \
        --argjson token_set "$token_set" \
        --arg owner_discord_id "$owner_discord_id" \
        --argjson threshold_minutes "$threshold_minutes" \
        '{success:$success, installed:$installed, connected:$connected,
          settings:{enabled:$enabled, token_set:$token_set,
                    owner_discord_id:$owner_discord_id, threshold_minutes:$threshold_minutes}}'
    exit 0
fi

if [ "$REQUEST_METHOD" = "POST" ]; then
    body=$(cat)
    action=$(printf '%s' "$body" | jq -r '.action // "save_settings"' 2>/dev/null)

    case "$action" in
    save_settings)
        enabled=$(printf '%s' "$body" | jq -r '.enabled // false' 2>/dev/null)
        owner=$(printf '%s' "$body" | jq -r '.owner_discord_id // ""' 2>/dev/null)
        threshold=$(printf '%s' "$body" | jq -r '.threshold_minutes // 5' 2>/dev/null)
        token=$(printf '%s' "$body" | jq -r '.bot_token // ""' 2>/dev/null)

        # Preserve existing token if not provided
        existing_token=""
        [ -f "$CONFIG" ] && existing_token=$(jq -r '.bot_token // ""' "$CONFIG" 2>/dev/null)
        [ -z "$token" ] && token="$existing_token"

        tmp="${CONFIG}.tmp"
        jq -n \
            --argjson enabled "$enabled" \
            --arg bot_token "$token" \
            --arg owner_discord_id "$owner" \
            --argjson threshold_minutes "$threshold" \
            '{enabled:$enabled, bot_token:$bot_token,
              owner_discord_id:$owner_discord_id, threshold_minutes:$threshold_minutes}' > "$tmp" \
            && mv "$tmp" "$CONFIG"

        touch "$RELOAD_FLAG"

        # Drive the service state to match the saved `enabled` flag.
        # We use svc_restart (not svc_start) because the daemon caches
        # token, owner_discord_id, and dmChannelID in memory at startup —
        # svc_start is a no-op for an already-running unit, so config
        # changes (new token after Reset, new owner ID) would never take
        # effect. svc_restart picks them up cleanly. systemctl restart
        # also starts a stopped unit, so this covers both transitions.
        if [ "$enabled" = "true" ]; then
            svc_enable qmanager_discord
            svc_restart qmanager_discord
        else
            svc_stop qmanager_discord
        fi

        jq -n '{success:true}'
        ;;
    install)
        if da_is_installed; then
            jq -n '{success:true, detail:"already installed"}'
        else
            jq -n '{success:false, detail:"Binary not found. Re-run the QManager installer to deploy qmanager_discord."}'
        fi
        ;;
    uninstall)
        svc_stop qmanager_discord
        svc_disable qmanager_discord
        rm -f "$BOT_BIN" "$CONFIG"
        jq -n '{success:true}'
        ;;
    reset)
        svc_stop qmanager_discord
        svc_disable qmanager_discord
        rm -f "$CONFIG"
        rm -f /etc/qmanager/discord_dm_channel
        rm -f "$RELOAD_FLAG"
        rm -f /tmp/qmanager_discord_test
        # Clear the daemon's status cache so post-reset GET /status.sh
        # doesn't keep reporting connected=true from the stopped bot.
        rm -f /tmp/qmanager_discord_status.json
        jq -n '{success:true}'
        ;;
    enable)
        # Persist enabled=true in JSON so the bot doesn't exit on next restart
        if [ -f "$CONFIG" ]; then
            tmp="${CONFIG}.tmp"
            jq '.enabled = true' "$CONFIG" > "$tmp" && mv "$tmp" "$CONFIG"
            touch "$RELOAD_FLAG"
        fi
        svc_enable qmanager_discord
        svc_start qmanager_discord
        jq -n '{success:true}'
        ;;
    disable)
        if [ -f "$CONFIG" ]; then
            tmp="${CONFIG}.tmp"
            jq '.enabled = false' "$CONFIG" > "$tmp" && mv "$tmp" "$CONFIG"
            touch "$RELOAD_FLAG"
        fi
        svc_stop qmanager_discord
        jq -n '{success:true}'
        ;;
    *)
        jq -n --arg e "unknown action: $action" '{success:false, error:$e}'
        ;;
    esac
    exit 0
fi
