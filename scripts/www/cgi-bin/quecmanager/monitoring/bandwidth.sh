#!/bin/sh
. /usr/lib/qmanager/cgi_base.sh
# =============================================================================
# bandwidth.sh — CGI Endpoint: Bandwidth Monitor Settings & Status (GET + POST)
# =============================================================================
# GET:  Returns bandwidth monitor settings (UCI), live status, and dependencies.
# POST: Saves settings (enable/disable, refresh rate) or regenerates SSL cert.
#
# Config: UCI quecmanager.bridge_monitor.*
# Binary: /usr/bin/bridge_traffic_monitor_rm551
# WebSocket: websocat on configurable port (default 8838)
#
# Endpoint: GET/POST /cgi-bin/quecmanager/monitoring/bandwidth.sh
# Install location: /www/cgi-bin/quecmanager/monitoring/bandwidth.sh
# =============================================================================

qlog_init "cgi_bandwidth"
cgi_headers
cgi_handle_options

SSL_CERT="/etc/qmanager/bandwidth_certs/ws.p12"

# Ensure UCI section exists with defaults
ensure_bandwidth_config() {
    uci -q get quecmanager.bridge_monitor >/dev/null 2>&1 && return
    uci set quecmanager.bridge_monitor=bridge_monitor
    uci set quecmanager.bridge_monitor.enabled=0
    uci set quecmanager.bridge_monitor.refresh_rate_ms=1000
    uci set quecmanager.bridge_monitor.ws_port=8838
    uci set quecmanager.bridge_monitor.interfaces="br-lan,eth0,rmnet_data0,rmnet_data1,rmnet_ipa0"
    uci set quecmanager.bridge_monitor.json_mode=yes
    uci set quecmanager.bridge_monitor.channel=network-monitor
    uci commit quecmanager
}

# Read a UCI value with fallback
uci_get() {
    local val
    val=$(uci -q get "quecmanager.bridge_monitor.$1" 2>/dev/null)
    if [ -z "$val" ]; then echo "$2"; else echo "$val"; fi
}

# =============================================================================
# GET — Fetch settings + status + dependencies
# =============================================================================
if [ "$REQUEST_METHOD" = "GET" ]; then
    qlog_info "Fetching bandwidth monitor settings"
    ensure_bandwidth_config

    # Read settings from UCI
    enabled=$(uci_get enabled 0)
    refresh_rate_ms=$(uci_get refresh_rate_ms 1000)
    ws_port=$(uci_get ws_port 8838)
    interfaces=$(uci_get interfaces "br-lan,eth0,rmnet_data0,rmnet_data1,rmnet_ipa0")

    # Check process status
    websocat_running="false"
    pidof websocat >/dev/null 2>&1 && websocat_running="true"

    monitor_running="false"
    pidof bridge_traffic_monitor_rm551 >/dev/null 2>&1 && monitor_running="true"

    ssl_cert_exists="false"
    [ -f "$SSL_CERT" ] && ssl_cert_exists="true"

    # Check dependencies
    websocat_installed="false"
    command -v websocat >/dev/null 2>&1 && websocat_installed="true"

    openssl_installed="false"
    command -v openssl >/dev/null 2>&1 && openssl_installed="true"

    jq -n \
        --argjson enabled "$enabled" \
        --argjson refresh_rate_ms "$refresh_rate_ms" \
        --argjson ws_port "$ws_port" \
        --arg interfaces "$interfaces" \
        --argjson websocat_running "$websocat_running" \
        --argjson monitor_running "$monitor_running" \
        --argjson ssl_cert_exists "$ssl_cert_exists" \
        --argjson websocat_installed "$websocat_installed" \
        --argjson openssl_installed "$openssl_installed" \
        '{
            success: true,
            settings: {
                enabled: ($enabled == 1),
                refresh_rate_ms: $refresh_rate_ms,
                ws_port: $ws_port,
                interfaces: $interfaces
            },
            status: {
                websocat_running: $websocat_running,
                monitor_running: $monitor_running,
                ssl_cert_exists: $ssl_cert_exists
            },
            dependencies: {
                websocat_installed: $websocat_installed,
                openssl_installed: $openssl_installed
            }
        }'
    exit 0
fi

# =============================================================================
# POST — Save settings or regenerate SSL
# =============================================================================
if [ "$REQUEST_METHOD" = "POST" ]; then

    cgi_read_post

    ACTION=$(printf '%s' "$POST_DATA" | jq -r '.action // empty')

    if [ -z "$ACTION" ]; then
        cgi_error "missing_action" "action field is required"
        exit 0
    fi

    # ─── action: save_settings ──────────────────────────────────────────
    if [ "$ACTION" = "save_settings" ]; then
        qlog_info "Saving bandwidth monitor settings"
        ensure_bandwidth_config

        val=""

        # enabled (boolean → 0/1)
        val=$(printf '%s' "$POST_DATA" | jq -r '.enabled | if . == null then empty else tostring end')
        if [ -n "$val" ]; then
            case "$val" in
                true) uci set quecmanager.bridge_monitor.enabled=1 ;;
                false) uci set quecmanager.bridge_monitor.enabled=0 ;;
            esac
        fi

        # refresh_rate_ms (number)
        val=$(printf '%s' "$POST_DATA" | jq -r '.refresh_rate_ms // empty')
        [ -n "$val" ] && uci set quecmanager.bridge_monitor.refresh_rate_ms="$val"

        # ws_port (number)
        val=$(printf '%s' "$POST_DATA" | jq -r '.ws_port // empty')
        [ -n "$val" ] && uci set quecmanager.bridge_monitor.ws_port="$val"

        # interfaces (string)
        val=$(printf '%s' "$POST_DATA" | jq -r '.interfaces // empty')
        [ -n "$val" ] && uci set quecmanager.bridge_monitor.interfaces="$val"

        uci commit quecmanager

        # Regenerate config file from updated UCI
        /usr/bin/qmanager_bandwidth_genconf 2>/dev/null

        # Enable/disable and restart service based on new state
        new_enabled=$(uci -q get quecmanager.bridge_monitor.enabled 2>/dev/null)
        if [ "$new_enabled" = "1" ]; then
            /etc/init.d/qmanager_bandwidth enable 2>/dev/null
            ( /etc/init.d/qmanager_bandwidth restart >/dev/null 2>&1 & )
            qlog_info "Bandwidth monitor enabled and started"
        else
            /etc/init.d/qmanager_bandwidth stop >/dev/null 2>&1
            /etc/init.d/qmanager_bandwidth disable 2>/dev/null
            qlog_info "Bandwidth monitor stopped and disabled"
        fi

        echo '{"success":true}'
        exit 0
    fi

    # ─── action: regenerate_ssl ─────────────────────────────────────────
    if [ "$ACTION" = "regenerate_ssl" ]; then
        qlog_info "Regenerating SSL certificate"

        # Remove existing certificate
        rm -f /etc/qmanager/bandwidth_certs/key.pem
        rm -f /etc/qmanager/bandwidth_certs/cert.pem
        rm -f "$SSL_CERT"

        # Regenerate
        /usr/bin/qmanager_bandwidth_ssl_setup
        if [ $? -ne 0 ]; then
            cgi_error "ssl_failed" "Failed to regenerate SSL certificate"
            exit 0
        fi

        # Restart service if enabled
        enabled=$(uci -q get quecmanager.bridge_monitor.enabled 2>/dev/null)
        if [ "$enabled" = "1" ]; then
            ( /etc/init.d/qmanager_bandwidth restart >/dev/null 2>&1 & )
        fi

        echo '{"success":true}'
        exit 0
    fi

    # Unknown action
    cgi_error "unknown_action" "Unknown action: $ACTION"
    exit 0
fi

# Method not allowed
cgi_error "method_not_allowed" "Only GET and POST are supported"
