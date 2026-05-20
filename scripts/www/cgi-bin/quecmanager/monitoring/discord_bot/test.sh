#!/bin/sh
. /usr/lib/qmanager/cgi_base.sh
. /usr/lib/qmanager/discord_alerts.sh

qlog_init "cgi_discord_test"
cgi_headers
cgi_handle_options

if [ "$REQUEST_METHOD" = "POST" ]; then
    if ! da_is_installed; then
        jq -n '{success:false, error:"Bot binary not installed"}'
        exit 0
    fi
    if ! da_is_connected; then
        jq -n '{success:false, error:"Bot is not connected to Discord"}'
        exit 0
    fi

    TRIGGER="/tmp/qmanager_discord_test"
    RESULT="/tmp/qmanager_discord_test_result"

    # Clear any stale result from a previous run before triggering, so we
    # don't read an old success/failure as the answer to this request.
    rm -f "$RESULT"

    # Signal the bot to send a test DM by writing a trigger file.
    printf '{"action":"test_dm","ts":%s}' "$(date +%s)" > "$TRIGGER"

    # Poll for the bot's result file. Bot watcher ticks every 1s and writes
    # the result after attempting Discord API calls, so 8 seconds is plenty
    # for a healthy gateway. Returns whatever the bot reports — success only
    # when the DM actually went through.
    i=0
    while [ $i -lt 40 ]; do
        if [ -f "$RESULT" ]; then
            payload=$(cat "$RESULT" 2>/dev/null)
            rm -f "$RESULT"
            # Validate JSON before echoing — fall through to timeout case if malformed.
            if printf '%s' "$payload" | jq -e . >/dev/null 2>&1; then
                printf '%s' "$payload"
                exit 0
            fi
            break
        fi
        sleep 0.2
        i=$((i + 1))
    done

    # Timeout — bot didn't respond. Could mean the watcher isn't running,
    # the daemon is wedged, or the trigger file was deleted by something else.
    rm -f "$TRIGGER"
    jq -n '{success:false, error:"Bot did not respond in time. Check that qmanager_discord is running and the bot is added to your Discord account."}'
fi
