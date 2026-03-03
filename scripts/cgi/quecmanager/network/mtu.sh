#!/bin/sh
# =============================================================================
# mtu.sh — CGI Endpoint: MTU Configuration (GET + POST)
# =============================================================================
# GET:  Reads the current MTU from the rmnet_data0 interface and checks
#       whether a custom MTU configuration file exists.
# POST: Applies a new MTU value to all rmnet_data interfaces, persists to
#       /etc/firewall.user.mtu, and updates lanUtils.sh for boot persistence.
#       Send { "mtu": "disable" } to remove custom MTU and revert to default.
#
# Files:
#   /etc/firewall.user.mtu          — Persistent MTU commands (ip link set)
#   /etc/data/lanUtils.sh           — Boot-time network configuration script
#
# POST body: { "mtu": 1420 }   or   { "mtu": "disable" }
#
# Endpoint: GET/POST /cgi-bin/quecmanager/network/mtu.sh
# Install location: /www/cgi-bin/quecmanager/network/mtu.sh
# =============================================================================

# --- Logging -----------------------------------------------------------------
. /usr/lib/qmanager/qlog.sh 2>/dev/null || {
    qlog_init() { :; }
    qlog_info() { :; }
    qlog_warn() { :; }
    qlog_error() { :; }
    qlog_debug() { :; }
}
qlog_init "cgi_mtu"

# --- Configuration -----------------------------------------------------------
MTU_FIREWALL_FILE="/etc/firewall.user.mtu"
NETWORK_INTERFACE="rmnet_data0"
LAN_UTILS_SCRIPT="/etc/data/lanUtils.sh"

# --- HTTP Headers ------------------------------------------------------------
echo "Content-Type: application/json"
echo "Cache-Control: no-cache, no-store, must-revalidate"
echo "Access-Control-Allow-Origin: *"
echo "Access-Control-Allow-Methods: GET, POST, OPTIONS"
echo "Access-Control-Allow-Headers: Content-Type"
echo ""

# --- Handle CORS preflight ---------------------------------------------------
if [ "$REQUEST_METHOD" = "OPTIONS" ]; then
    exit 0
fi

# --- Helper: get current MTU from the primary interface ----------------------
get_current_mtu() {
    ip link show "$NETWORK_INTERFACE" 2>/dev/null \
        | grep -o "mtu [0-9]*" | cut -d' ' -f2
}

# --- Helper: add or remove MTU reference in lanUtils.sh ----------------------
update_lanutils_mtu_config() {
    local action="$1"
    if [ "$action" = "add" ]; then
        if [ -f "$LAN_UTILS_SCRIPT" ]; then
            if ! grep -q "local mtu_firewall_file=/etc/firewall.user.mtu" "$LAN_UTILS_SCRIPT"; then
                sed -i '/local ttl_firewall_file=\/etc\/firewall.user.ttl/a local mtu_firewall_file=/etc/firewall.user.mtu' "$LAN_UTILS_SCRIPT"
            fi
        fi
    elif [ "$action" = "remove" ]; then
        if [ -f "$LAN_UTILS_SCRIPT" ]; then
            sed -i '/local mtu_firewall_file=\/etc\/firewall.user.mtu/d' "$LAN_UTILS_SCRIPT"
        fi
    fi
}

# =============================================================================
# GET — Read current MTU status
# =============================================================================
if [ "$REQUEST_METHOD" = "GET" ]; then
    qlog_info "Reading MTU configuration"

    current_mtu=$(get_current_mtu)
    current_mtu=${current_mtu:-1500}

    is_enabled="false"
    if [ -f "$MTU_FIREWALL_FILE" ]; then
        is_enabled="true"
    fi

    qlog_info "Current MTU=$current_mtu enabled=$is_enabled"

    jq -n \
        --argjson is_enabled "$is_enabled" \
        --argjson current_value "$current_mtu" \
        '{
            success: true,
            is_enabled: $is_enabled,
            current_value: $current_value
        }'
    exit 0
fi

# =============================================================================
# POST — Apply or disable MTU configuration
# =============================================================================
if [ "$REQUEST_METHOD" = "POST" ]; then

    # --- Read POST body ---
    if [ -n "$CONTENT_LENGTH" ] && [ "$CONTENT_LENGTH" -gt 0 ] 2>/dev/null; then
        POST_DATA=$(dd bs=1 count="$CONTENT_LENGTH" 2>/dev/null)
    else
        echo '{"success":false,"error":"no_body","detail":"POST body is empty"}'
        exit 0
    fi

    mtu_value=$(printf '%s' "$POST_DATA" | jq -r '.mtu // empty')

    if [ -z "$mtu_value" ]; then
        echo '{"success":false,"error":"missing_field","detail":"mtu field is required"}'
        exit 0
    fi

    # --- Handle disable ---
    if [ "$mtu_value" = "disable" ]; then
        qlog_info "Disabling custom MTU"

        rm -f "$MTU_FIREWALL_FILE"
        update_lanutils_mtu_config "remove"

        default_mtu=$(get_current_mtu)
        default_mtu=${default_mtu:-1500}

        qlog_info "MTU disabled, current=$default_mtu"

        jq -n \
            --argjson current_value "$default_mtu" \
            '{
                success: true,
                message: "MTU configuration disabled",
                current_value: $current_value
            }'
        exit 0
    fi

    # --- Validate MTU (numeric, reasonable range) ---
    case "$mtu_value" in
        ''|*[!0-9]*)
            echo '{"success":false,"error":"invalid_mtu","detail":"MTU must be a number"}'
            exit 0
            ;;
    esac
    if [ "$mtu_value" -lt 576 ] 2>/dev/null || [ "$mtu_value" -gt 9000 ] 2>/dev/null; then
        echo '{"success":false,"error":"invalid_mtu","detail":"MTU must be between 576 and 9000"}'
        exit 0
    fi

    qlog_info "Setting MTU=$mtu_value"

    # --- Write firewall MTU configuration file ---
    > "$MTU_FIREWALL_FILE"
    for iface in $(ls /sys/class/net 2>/dev/null | grep '^rmnet_data'); do
        echo "ip link set $iface mtu $mtu_value" >> "$MTU_FIREWALL_FILE"
    done

    # --- Immediately apply MTU ---
    for iface in $(ls /sys/class/net 2>/dev/null | grep '^rmnet_data'); do
        ip link set "$iface" mtu "$mtu_value" 2>/dev/null
    done

    # --- Update lanUtils.sh ---
    update_lanutils_mtu_config "add"

    # --- Run lanUtils.sh to update network configuration ---
    if [ -f "$LAN_UTILS_SCRIPT" ]; then
        . "$LAN_UTILS_SCRIPT" 2>/dev/null
    fi

    qlog_info "MTU set to $mtu_value"

    jq -n \
        --argjson current_value "$mtu_value" \
        '{
            success: true,
            message: "MTU configuration updated",
            current_value: $current_value
        }'
    exit 0
fi

# --- Method not allowed -------------------------------------------------------
echo '{"success":false,"error":"method_not_allowed","detail":"Use GET or POST"}'
