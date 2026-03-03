#!/bin/sh
# =============================================================================
# ttl.sh — CGI Endpoint: TTL / Hop Limit Configuration (GET + POST)
# =============================================================================
# GET:  Reads current TTL and HL values from the firewall rules file.
# POST: Applies new TTL/HL via iptables/ip6tables and persists to file.
#
# Files:
#   /etc/firewall.user.ttl          — Persistent firewall rules (iptables cmds)
#   /etc/init.d/quecmanager_ttl     — Boot persistence init script
#
# POST body: { "ttl": 64, "hl": 64 }
#   - ttl: 0-255  (0 = disable / use default)
#   - hl:  0-255  (0 = disable / use default)
#
# This endpoint is the standalone TTL/HL manager. The same firewall rules
# file is shared with the Custom SIM Profile apply script
# (qmanager_profile_apply), so both paths write the same canonical format.
#
# Endpoint: GET/POST /cgi-bin/quecmanager/network/ttl.sh
# Install location: /www/cgi-bin/quecmanager/network/ttl.sh
# =============================================================================

# --- Logging -----------------------------------------------------------------
. /usr/lib/qmanager/qlog.sh 2>/dev/null || {
    qlog_init() { :; }
    qlog_info() { :; }
    qlog_warn() { :; }
    qlog_error() { :; }
    qlog_debug() { :; }
}
qlog_init "cgi_ttl"

# --- Configuration -----------------------------------------------------------
TTL_FILE="/etc/firewall.user.ttl"
TTL_INIT="/etc/init.d/quecmanager_ttl"

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

# --- Helper: parse current values from the firewall rules file ----------------
get_current_values() {
    local ttl=0 hl=0
    if [ -s "$TTL_FILE" ]; then
        ttl=$(grep 'iptables.*--ttl-set' "$TTL_FILE" 2>/dev/null \
            | awk '{for(i=1;i<=NF;i++){if($i=="--ttl-set"){print $(i+1)}}}' \
            | head -1)
        hl=$(grep 'ip6tables.*--hl-set' "$TTL_FILE" 2>/dev/null \
            | awk '{for(i=1;i<=NF;i++){if($i=="--hl-set"){print $(i+1)}}}' \
            | head -1)
    fi
    [ -z "$ttl" ] && ttl=0
    [ -z "$hl" ] && hl=0
    echo "$ttl $hl"
}

# =============================================================================
# GET — Read current TTL/HL configuration
# =============================================================================
if [ "$REQUEST_METHOD" = "GET" ]; then
    qlog_info "Reading TTL/HL configuration"

    # Parse current values
    read cur_ttl cur_hl <<EOF
$(get_current_values)
EOF

    # Determine enabled status
    is_enabled="false"
    if [ "$cur_ttl" -gt 0 ] 2>/dev/null || [ "$cur_hl" -gt 0 ] 2>/dev/null; then
        is_enabled="true"
    fi

    # Check autostart status
    autostart="false"
    if [ -f "$TTL_INIT" ] && "$TTL_INIT" enabled 2>/dev/null; then
        autostart="true"
    fi

    qlog_info "Current: TTL=$cur_ttl HL=$cur_hl enabled=$is_enabled autostart=$autostart"

    jq -n \
        --argjson is_enabled "$is_enabled" \
        --argjson ttl "$cur_ttl" \
        --argjson hl "$cur_hl" \
        --argjson autostart "$autostart" \
        '{
            success: true,
            is_enabled: $is_enabled,
            ttl: $ttl,
            hl: $hl,
            autostart: $autostart
        }'
    exit 0
fi

# =============================================================================
# POST — Apply TTL/HL configuration
# =============================================================================
if [ "$REQUEST_METHOD" = "POST" ]; then

    # --- Read POST body ---
    if [ -n "$CONTENT_LENGTH" ] && [ "$CONTENT_LENGTH" -gt 0 ] 2>/dev/null; then
        POST_DATA=$(dd bs=1 count="$CONTENT_LENGTH" 2>/dev/null)
    else
        echo '{"success":false,"error":"no_body","detail":"POST body is empty"}'
        exit 0
    fi

    new_ttl=$(printf '%s' "$POST_DATA" | jq -r '.ttl // "0"' | tr -d '"')
    new_hl=$(printf '%s' "$POST_DATA" | jq -r '.hl // "0"' | tr -d '"')

    # --- Validate TTL ---
    case "$new_ttl" in
        ''|*[!0-9]*)
            echo '{"success":false,"error":"invalid_ttl","detail":"TTL must be a number between 0 and 255"}'
            exit 0
            ;;
    esac
    if [ "$new_ttl" -gt 255 ] 2>/dev/null; then
        echo '{"success":false,"error":"invalid_ttl","detail":"TTL must be between 0 and 255"}'
        exit 0
    fi

    # --- Validate HL ---
    case "$new_hl" in
        ''|*[!0-9]*)
            echo '{"success":false,"error":"invalid_hl","detail":"HL must be a number between 0 and 255"}'
            exit 0
            ;;
    esac
    if [ "$new_hl" -gt 255 ] 2>/dev/null; then
        echo '{"success":false,"error":"invalid_hl","detail":"HL must be between 0 and 255"}'
        exit 0
    fi

    qlog_info "Applying TTL=$new_ttl HL=$new_hl"

    # --- Clear existing iptables rules ---
    read cur_ttl cur_hl <<EOF
$(get_current_values)
EOF

    if [ "$cur_ttl" -gt 0 ] 2>/dev/null; then
        iptables -t mangle -D POSTROUTING -o rmnet+ -j TTL --ttl-set "$cur_ttl" 2>/dev/null
    fi
    if [ "$cur_hl" -gt 0 ] 2>/dev/null; then
        ip6tables -t mangle -D POSTROUTING -o rmnet+ -j HL --hl-set "$cur_hl" 2>/dev/null
    fi

    # --- Write new rules file ---
    > "$TTL_FILE"
    if [ "$new_ttl" -gt 0 ] 2>/dev/null; then
        echo "iptables -t mangle -A POSTROUTING -o rmnet+ -j TTL --ttl-set $new_ttl" >> "$TTL_FILE"
        iptables -t mangle -A POSTROUTING -o rmnet+ -j TTL --ttl-set "$new_ttl"
    fi
    if [ "$new_hl" -gt 0 ] 2>/dev/null; then
        echo "ip6tables -t mangle -A POSTROUTING -o rmnet+ -j HL --hl-set $new_hl" >> "$TTL_FILE"
        ip6tables -t mangle -A POSTROUTING -o rmnet+ -j HL --hl-set "$new_hl"
    fi

    # --- Manage init.d script for boot persistence ---
    if [ "$new_ttl" -gt 0 ] 2>/dev/null || [ "$new_hl" -gt 0 ] 2>/dev/null; then
        # Ensure init.d script exists
        if [ ! -f "$TTL_INIT" ]; then
            cat > "$TTL_INIT" << 'INITEOF'
#!/bin/sh /etc/rc.common
# QManager TTL/HL persistence
START=99

start() {
    sleep 5
    [ -f /etc/firewall.user.ttl ] && . /etc/firewall.user.ttl
}

stop() {
    :
}
INITEOF
            chmod +x "$TTL_INIT"
        fi
        "$TTL_INIT" enable 2>/dev/null
    else
        # No custom values — disable init script
        if [ -f "$TTL_INIT" ]; then
            "$TTL_INIT" disable 2>/dev/null
        fi
    fi

    # Determine new enabled state
    is_enabled="false"
    if [ "$new_ttl" -gt 0 ] 2>/dev/null || [ "$new_hl" -gt 0 ] 2>/dev/null; then
        is_enabled="true"
    fi

    qlog_info "TTL/HL applied: TTL=$new_ttl HL=$new_hl enabled=$is_enabled"

    jq -n \
        --argjson is_enabled "$is_enabled" \
        --argjson ttl "$new_ttl" \
        --argjson hl "$new_hl" \
        '{
            success: true,
            is_enabled: $is_enabled,
            ttl: $ttl,
            hl: $hl
        }'
    exit 0
fi

# --- Method not allowed -------------------------------------------------------
echo '{"success":false,"error":"method_not_allowed","detail":"Use GET or POST"}'
