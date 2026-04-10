#!/bin/sh
. /usr/lib/qmanager/cgi_base.sh
# =============================================================================
# sms_alerts.sh — CGI Endpoint: SMS Alert Settings (GET + POST)
# =============================================================================
# GET:  Returns current SMS alert configuration.
# POST: Saves settings, or sends a test SMS.
#
# Config file: /etc/qmanager/sms_alerts.json
# Reload flag: /tmp/qmanager_sms_reload
#
# Endpoint: GET/POST /cgi-bin/quecmanager/monitoring/sms_alerts.sh
# Install location: /www/cgi-bin/quecmanager/monitoring/sms_alerts.sh
# =============================================================================

qlog_init "cgi_sms_alerts"
cgi_headers
cgi_handle_options

CONFIG="/etc/qmanager/sms_alerts.json"
RELOAD_FLAG="/tmp/qmanager_sms_reload"

# =============================================================================
# GET — Fetch current settings
# =============================================================================
if [ "$REQUEST_METHOD" = "GET" ]; then
    qlog_info "Fetching SMS alert settings"

    if [ -f "$CONFIG" ]; then
        enabled=$(jq -r '(.enabled) | if . == null then "false" else tostring end' "$CONFIG" 2>/dev/null)
        recipient_phone=$(jq -r '.recipient_phone // ""' "$CONFIG" 2>/dev/null)
        threshold_minutes=$(jq -r '.threshold_minutes // 5' "$CONFIG" 2>/dev/null)

        jq -n \
            --argjson enabled "$enabled" \
            --arg recipient_phone "$recipient_phone" \
            --argjson threshold_minutes "$threshold_minutes" \
            '{
                success: true,
                settings: {
                    enabled: $enabled,
                    recipient_phone: $recipient_phone,
                    threshold_minutes: $threshold_minutes
                }
            }'
    else
        printf '{"success":true,"settings":{"enabled":false,"recipient_phone":"","threshold_minutes":5}}'
    fi
    exit 0
fi

# =============================================================================
# POST — Save settings or send test SMS
# =============================================================================
if [ "$REQUEST_METHOD" = "POST" ]; then

    cgi_read_post

    ACTION=$(printf '%s' "$POST_DATA" | jq -r '.action // empty')

    if [ -z "$ACTION" ]; then
        cgi_error "missing_action" "action field is required"
        exit 0
    fi

    # -------------------------------------------------------------------------
    # action: save_settings
    # -------------------------------------------------------------------------
    if [ "$ACTION" = "save_settings" ]; then
        qlog_info "Saving SMS alert settings"

        new_enabled=$(printf '%s' "$POST_DATA" | jq -r 'if has("enabled") then (.enabled | tostring) else "false" end')
        new_recipient=$(printf '%s' "$POST_DATA" | jq -r '.recipient_phone // ""')
        new_threshold=$(printf '%s' "$POST_DATA" | jq -r '.threshold_minutes // 5')

        # Validate enabled — must be literal "true" or "false" for --argjson
        case "$new_enabled" in
            true|false) ;;
            *)
                cgi_error "invalid_enabled" "enabled must be a boolean"
                exit 0
                ;;
        esac

        # Validate threshold — guard against non-numeric input first
        case "$new_threshold" in
            ''|*[!0-9]*)
                cgi_error "invalid_threshold" "Threshold must be a number between 1 and 60"
                exit 0
                ;;
        esac
        if [ "$new_threshold" -lt 1 ] || [ "$new_threshold" -gt 60 ]; then
            cgi_error "invalid_threshold" "Threshold must be between 1 and 60 minutes"
            exit 0
        fi

        # Validate phone number (E.164-ish): optional +, 7–15 digits, first non-zero
        if [ "$new_enabled" = "true" ]; then
            case "$new_recipient" in
                '')
                    cgi_error "invalid_phone" "Recipient phone is required when alerts are enabled"
                    exit 0
                    ;;
            esac
            # Strip a leading + for the regex check
            _phone_check="${new_recipient#+}"
            case "$_phone_check" in
                ''|*[!0-9]*)
                    cgi_error "invalid_phone" "Phone must contain only digits (with optional leading +)"
                    exit 0
                    ;;
            esac
            _len=${#_phone_check}
            if [ "$_len" -lt 7 ] || [ "$_len" -gt 15 ]; then
                cgi_error "invalid_phone" "Phone must be 7–15 digits"
                exit 0
            fi
            # First digit must not be 0
            case "$_phone_check" in
                0*)
                    cgi_error "invalid_phone" "Phone must start with a country code (not 0)"
                    exit 0
                    ;;
            esac
        fi

        mkdir -p /etc/qmanager

        # Atomic write via temp file + mv (avoids zero-byte config on jq failure)
        if ! jq -n \
            --argjson enabled "$new_enabled" \
            --arg recipient_phone "$new_recipient" \
            --argjson threshold_minutes "$new_threshold" \
            '{
                enabled: $enabled,
                recipient_phone: $recipient_phone,
                threshold_minutes: $threshold_minutes
            }' > "${CONFIG}.tmp"; then
            rm -f "${CONFIG}.tmp"
            cgi_error "write_failed" "Failed to generate config JSON"
            exit 0
        fi
        mv "${CONFIG}.tmp" "$CONFIG"

        qlog_info "SMS alerts config written: enabled=$new_enabled recipient=$new_recipient threshold=${new_threshold}m"

        # Signal poller to reload config
        touch "$RELOAD_FLAG"

        cgi_success
        exit 0
    fi

    # -------------------------------------------------------------------------
    # action: send_test
    # -------------------------------------------------------------------------
    if [ "$ACTION" = "send_test" ]; then
        qlog_info "Sending test SMS"

        . /usr/lib/qmanager/sms_alerts.sh 2>/dev/null || {
            cgi_error "library_missing" "SMS alerts library not found"
            exit 0
        }

        _sa_read_config
        if [ "$_sa_enabled" != "true" ]; then
            cgi_error "not_configured" "SMS alerts must be enabled and fully configured before sending a test"
            exit 0
        fi

        # CGI doesn't have poller globals (modem_reachable, lte_state, nr_state).
        # For test sends, skip the registration guard — the user explicitly asked.
        # Override _sa_is_registered with a permissive version for this invocation.
        _sa_is_registered() { return 0; }

        if _sa_send_test_sms; then
            cgi_success
        else
            cgi_error "send_failed" "Failed to send test SMS. Check signal, SIM credits, and recipient number."
        fi
        exit 0
    fi

    # Unknown action
    cgi_error "unknown_action" "Unknown action: $ACTION"
    exit 0
fi

# Unsupported method
cgi_error "method_not_allowed" "Only GET and POST are supported"
