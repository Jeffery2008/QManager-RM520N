#!/bin/sh
. /usr/lib/qmanager/cgi_base.sh
. /usr/lib/qmanager/cgi_at.sh
# =============================================================================
# about.sh -- CGI Endpoint: About Device (GET-only)
# =============================================================================
# Gathers device identity, network addresses, 3GPP release info, public IPs,
# and OpenWRT system info into a single JSON response.
#
# Data sources:
#   /tmp/qmanager_status.json       -> Poller cache (firmware, IMEI, WAN IPs)
#   AT+QNWCFG="3gpp_rel"           -> 3GPP release versions (LTE, NR5G)
#   AT+QMAP="LANIP"                -> Device LAN IP and gateway
#   http://ipv4.icanhazip.com      -> Public IPv4 (3s timeout, non-blocking)
#   http://ipv6.icanhazip.com      -> Public IPv6 (3s timeout, non-blocking)
#   /etc/openwrt_release            -> OpenWRT version
#   uname -r                       -> Linux kernel version
#
# Endpoint: GET /cgi-bin/quecmanager/device/about.sh
# Install location: /www/cgi-bin/quecmanager/device/about.sh
# =============================================================================

qlog_init "cgi_about"
cgi_headers
cgi_handle_options

CACHE_FILE="/tmp/qmanager_status.json"
CMD_GAP=0.2
PUB_IP_TIMEOUT=3

# --- Cleanup for temp files --------------------------------------------------
pub4_file="/tmp/qmanager_pub_ipv4.$$"
pub6_file="/tmp/qmanager_pub_ipv6.$$"
cleanup() {
    rm -f "$pub4_file" "$pub6_file"
}
trap cleanup EXIT INT TERM

# --- GET only ----------------------------------------------------------------
if [ "$REQUEST_METHOD" != "GET" ]; then
    cgi_method_not_allowed
    exit 0
fi

# =============================================================================
# 1. Fire off public IP fetches FIRST (background, non-blocking)
#    These run in parallel while we do everything else.
# =============================================================================
if command -v curl >/dev/null 2>&1; then
    ( curl -s --max-time "$PUB_IP_TIMEOUT" http://ipv4.icanhazip.com > "$pub4_file" 2>/dev/null ) &
    pid4=$!
    ( curl -s --max-time "$PUB_IP_TIMEOUT" http://ipv6.icanhazip.com > "$pub6_file" 2>/dev/null ) &
    pid6=$!
elif command -v wget >/dev/null 2>&1; then
    ( wget -qO- -T "$PUB_IP_TIMEOUT" http://ipv4.icanhazip.com > "$pub4_file" 2>/dev/null ) &
    pid4=$!
    ( wget -qO- -T "$PUB_IP_TIMEOUT" http://ipv6.icanhazip.com > "$pub6_file" 2>/dev/null ) &
    pid6=$!
else
    pid4=""
    pid6=""
fi

# =============================================================================
# 2. Read poller cache (single jq call)
# =============================================================================
c_firmware=""
c_build_date=""
c_manufacturer=""
c_model=""
c_imei=""
c_wan_ipv4=""
c_wan_ipv6=""

if [ -f "$CACHE_FILE" ]; then
    eval "$(jq -r '
        @sh "c_firmware=\(.device.firmware // "")",
        @sh "c_build_date=\(.device.build_date // "")",
        @sh "c_manufacturer=\(.device.manufacturer // "")",
        @sh "c_model=\(.device.model // "")",
        @sh "c_imei=\(.device.imei // "")",
        @sh "c_wan_ipv4=\(.network.wan_ipv4 // "")",
        @sh "c_wan_ipv6=\(.network.wan_ipv6 // "")"
    ' "$CACHE_FILE" 2>/dev/null)"
fi

# =============================================================================
# 3. AT commands for data not in the poller cache
# =============================================================================
rel_lte=""
rel_nr5g=""
lan_ip=""
lan_gateway=""

# 3GPP release versions -- AT+QNWCFG="3gpp_rel"
# Response: +QNWCFG: "3gpp_rel",R17,R17
result=$(run_at 'AT+QNWCFG="3gpp_rel"')
if [ -n "$result" ]; then
    line=$(printf '%s' "$result" | grep '+QNWCFG:' | head -1 | tr -d '\r ')
    rel_lte=$(printf '%s' "$line" | cut -d',' -f2)
    rel_nr5g=$(printf '%s' "$line" | cut -d',' -f3)
fi
sleep "$CMD_GAP"

# LAN IP and gateway -- AT+QMAP="LANIP"
# Response: +QMAP: "LANIP",192.168.224.100,192.168.227.99,192.168.224.1
result=$(run_at 'AT+QMAP="LANIP"')
if [ -n "$result" ]; then
    line=$(printf '%s' "$result" | grep '+QMAP:' | head -1 | tr -d '\r ')
    lan_ip=$(printf '%s' "$line" | cut -d',' -f2 | tr -d '"')
    lan_gateway=$(printf '%s' "$line" | cut -d',' -f4 | tr -d '"')
fi

# =============================================================================
# 4. OpenWRT system info
# =============================================================================
sys_hostname=$(cat /proc/sys/kernel/hostname 2>/dev/null || echo "")
sys_kernel=$(uname -r 2>/dev/null || echo "")
sys_openwrt=""
if [ -f /etc/openwrt_release ]; then
    sys_openwrt=$(. /etc/openwrt_release && echo "$DISTRIB_RELEASE")
fi

# =============================================================================
# 5. Collect public IP results (wait for background jobs, bounded by timeout)
# =============================================================================
public_ipv4=""
public_ipv6=""

[ -n "$pid4" ] && wait "$pid4" 2>/dev/null
[ -n "$pid6" ] && wait "$pid6" 2>/dev/null

# Read and validate (basic sanity: no HTML, no error pages)
if [ -f "$pub4_file" ]; then
    raw=$(cat "$pub4_file" 2>/dev/null | tr -d '\n\r ')
    case "$raw" in
        *"<"*|"") ;;  # HTML or empty — skip
        *) public_ipv4="$raw" ;;
    esac
fi
if [ -f "$pub6_file" ]; then
    raw=$(cat "$pub6_file" 2>/dev/null | tr -d '\n\r ')
    case "$raw" in
        *"<"*|"") ;;
        *) public_ipv6="$raw" ;;
    esac
fi

# =============================================================================
# 6. Build JSON response
# =============================================================================
jq -n \
    --arg model "$c_model" \
    --arg mfr "$c_manufacturer" \
    --arg firmware "$c_firmware" \
    --arg build_date "$c_build_date" \
    --arg imei "$c_imei" \
    --arg rel_lte "$rel_lte" \
    --arg rel_nr5g "$rel_nr5g" \
    --arg device_ip "$lan_ip" \
    --arg lan_gw "$lan_gateway" \
    --arg wan4 "$c_wan_ipv4" \
    --arg wan6 "$c_wan_ipv6" \
    --arg pub4 "$public_ipv4" \
    --arg pub6 "$public_ipv6" \
    --arg hostname "$sys_hostname" \
    --arg kernel "$sys_kernel" \
    --arg owrt "$sys_openwrt" \
    '{
        success: true,
        device: {
            model: $model,
            manufacturer: $mfr,
            firmware: $firmware,
            build_date: $build_date,
            imei: $imei
        },
        "3gpp_release": {
            lte: $rel_lte,
            nr5g: $rel_nr5g
        },
        network: {
            device_ip: $device_ip,
            lan_gateway: $lan_gw,
            wan_ipv4: $wan4,
            wan_ipv6: $wan6,
            public_ipv4: $pub4,
            public_ipv6: $pub6
        },
        system: {
            hostname: $hostname,
            kernel_version: $kernel,
            openwrt_version: $owrt
        }
    }'
