#!/bin/sh
# =============================================================================
# apn.sh — CGI Endpoint: APN Management (GET + POST)
# =============================================================================
# GET:  Reads all carrier profiles (AT+CGDCONT?) and determines the active CID
#       (the one with WAN connectivity via AT+CGPADDR / AT+QMAP="WWAN").
# POST: Applies APN change via AT+CGDCONT and optionally sets TTL/HL via
#       iptables (for Auto APN presets).
#
# AT commands used (GET):
#   AT+CGDCONT?        -> All PDP contexts (CID, PDP type, APN)
#   AT+CGPADDR         -> IP addresses per CID (find active WAN CID)
#   AT+QMAP="WWAN"     -> Fallback: confirm WAN-connected CID
#
# AT commands used (POST):
#   AT+CGDCONT=<cid>,"<pdp_type>","<apn>"  -> Set APN for a CID
#
# Endpoint: GET/POST /cgi-bin/quecmanager/cellular/apn.sh
# Install location: /www/cgi-bin/quecmanager/cellular/apn.sh
# =============================================================================

# --- Logging -----------------------------------------------------------------
. /usr/lib/qmanager/qlog.sh 2>/dev/null || {
    qlog_init() { :; }
    qlog_info() { :; }
    qlog_warn() { :; }
    qlog_error() { :; }
    qlog_debug() { :; }
}
qlog_init "cgi_apn"

# --- Configuration -----------------------------------------------------------
CMD_GAP=0.2
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

# --- Helper: Execute AT command via qcmd, return stripped response -----------
strip_at_response() {
    printf '%s' "$1" | tr -d '\r' | sed '1d' | sed '/^OK$/d' | sed '/^ERROR$/d'
}

run_at() {
    local raw
    raw=$(qcmd "$1" 2>/dev/null)
    local rc=$?
    if [ $rc -ne 0 ] || [ -z "$raw" ]; then
        return 1
    fi
    case "$raw" in
        *ERROR*) return 1 ;;
    esac
    strip_at_response "$raw"
}

# =============================================================================
# GET — Fetch carrier profiles and active CID
# =============================================================================
if [ "$REQUEST_METHOD" = "GET" ]; then
    qlog_info "Fetching APN settings"

    # --- 1. All carrier profiles from AT+CGDCONT? ---
    cgdcont_resp=$(run_at "AT+CGDCONT?")
    sleep "$CMD_GAP"

    # Parse: +CGDCONT: <cid>,"<pdp_type>","<apn>",...
    if [ -n "$cgdcont_resp" ]; then
        profiles_json=$(printf '%s' "$cgdcont_resp" | awk -F'"' '
            /\+CGDCONT:/ {
                split($0, a, /[,]/)
                gsub(/[^0-9]/, "", a[1])
                cid = a[1]
                pdp = $2
                apn = $4
                if (cid != "") {
                    printf "%s\t%s\t%s\n", cid, pdp, apn
                }
            }
        ' | jq -Rsc '
            split("\n") | map(select(length > 0) | split("\t") |
                {cid: (.[0] | tonumber), pdp_type: .[1], apn: .[2]}
            )
        ')
    else
        profiles_json="[]"
    fi

    # --- 2. Determine active CID (cross-reference CGPADDR + QMAP) ---
    active_cid=""

    # 2a. AT+CGPADDR — collect ALL CIDs with a real IPv4 address
    cgpaddr_resp=$(run_at "AT+CGPADDR")
    sleep "$CMD_GAP"

    cgpaddr_cids=""
    if [ -n "$cgpaddr_resp" ]; then
        cgpaddr_cids=$(printf '%s' "$cgpaddr_resp" | awk -F'[,"]' '
            /\+CGPADDR:/ {
                cid = $1; gsub(/[^0-9]/, "", cid)
                ip = $3
                if (ip != "" && ip != "0.0.0.0" && ip !~ /^0+(\.0+)*$/) {
                    split(ip, octets, ".")
                    if (length(octets) == 4 && octets[1]+0 > 0) {
                        print cid
                    }
                }
            }
        ')
    fi

    # 2b. AT+QMAP="WWAN" — get the WAN-connected CID
    qmap_cid=""
    qmap_resp=$(run_at 'AT+QMAP="WWAN"')
    if [ -n "$qmap_resp" ]; then
        # +QMAP: "WWAN",<connected>,<cid>,"<type>","<ip>"
        qmap_cid=$(printf '%s' "$qmap_resp" | awk -F',' '
            /\+QMAP:/ {
                gsub(/"/, "", $5)
                ip = $5
                cid = $3
                gsub(/[^0-9]/, "", cid)
                if (ip != "" && ip != "0.0.0.0" && ip != "0:0:0:0:0:0:0:0") {
                    print cid
                    exit
                }
            }
        ')
    fi

    # 2c. Cross-reference: QMAP is authoritative (knows WAN CID),
    #     CGPADDR confirms IP presence. Use QMAP when available,
    #     fall back to first CGPADDR CID only if QMAP failed.
    if [ -n "$qmap_cid" ]; then
        active_cid="$qmap_cid"
        qlog_debug "Active CID from QMAP: $qmap_cid (CGPADDR CIDs: $cgpaddr_cids)"
    elif [ -n "$cgpaddr_cids" ]; then
        active_cid=$(printf '%s\n' "$cgpaddr_cids" | head -1)
        qlog_debug "Active CID from CGPADDR fallback: $active_cid"
    fi

    # Default to CID 1 if both detection methods failed
    [ -z "$active_cid" ] && active_cid="1"

    qlog_info "Profiles: $(printf '%s' "$profiles_json" | jq -c length) entries, active_cid=$active_cid"

    jq -n \
        --argjson profiles "$profiles_json" \
        --arg active_cid "$active_cid" \
        '{
            success: true,
            profiles: $profiles,
            active_cid: ($active_cid | tonumber)
        }'
    exit 0
fi

# =============================================================================
# POST — Apply APN change + optional TTL/HL
# =============================================================================
if [ "$REQUEST_METHOD" = "POST" ]; then

    # --- Read POST body ---
    if [ -n "$CONTENT_LENGTH" ] && [ "$CONTENT_LENGTH" -gt 0 ] 2>/dev/null; then
        POST_DATA=$(dd bs=1 count="$CONTENT_LENGTH" 2>/dev/null)
    else
        echo '{"success":false,"error":"no_body","detail":"POST body is empty"}'
        exit 0
    fi

    # --- Extract fields ---
    CID=$(printf '%s' "$POST_DATA" | jq -r '.cid // empty | tostring')
    PDP_TYPE=$(printf '%s' "$POST_DATA" | jq -r '.pdp_type // empty')
    APN=$(printf '%s' "$POST_DATA" | jq -r '.apn // empty')
    TTL=$(printf '%s' "$POST_DATA" | jq -r 'if has("ttl") then (.ttl | tostring) else "0" end')
    HL=$(printf '%s' "$POST_DATA" | jq -r 'if has("hl") then (.hl | tostring) else "0" end')

    qlog_info "Apply APN: cid=$CID pdp=$PDP_TYPE apn=$APN ttl=$TTL hl=$HL"

    # --- Validate ---
    if [ -z "$CID" ] || [ -z "$PDP_TYPE" ] || [ -z "$APN" ]; then
        echo '{"success":false,"error":"missing_fields","detail":"cid, pdp_type, and apn are required"}'
        exit 0
    fi

    # CID must be 1-15
    if [ "$CID" -lt 1 ] 2>/dev/null || [ "$CID" -gt 15 ] 2>/dev/null; then
        echo '{"success":false,"error":"invalid_cid","detail":"CID must be 1-15"}'
        exit 0
    fi
    # Catch non-numeric CID
    case "$CID" in
        *[!0-9]*|"")
            echo '{"success":false,"error":"invalid_cid","detail":"CID must be a number 1-15"}'
            exit 0
            ;;
    esac

    case "$PDP_TYPE" in
        IP|IPV6|IPV4V6) ;;
        *)
            echo '{"success":false,"error":"invalid_pdp_type","detail":"PDP type must be IP, IPV6, or IPV4V6"}'
            exit 0
            ;;
    esac

    # TTL/HL must be 0-255
    case "$TTL" in *[!0-9]*|"") TTL=0 ;; esac
    case "$HL" in *[!0-9]*|"") HL=0 ;; esac
    if [ "$TTL" -gt 255 ] 2>/dev/null; then
        echo '{"success":false,"error":"invalid_ttl","detail":"TTL must be 0-255"}'
        exit 0
    fi
    if [ "$HL" -gt 255 ] 2>/dev/null; then
        echo '{"success":false,"error":"invalid_hl","detail":"HL must be 0-255"}'
        exit 0
    fi

    # --- Step 1: Apply APN via AT+CGDCONT ---
    result=$(qcmd "AT+CGDCONT=$CID,\"$PDP_TYPE\",\"$APN\"" 2>/dev/null)
    case "$result" in
        *ERROR*)
            qlog_error "AT+CGDCONT failed: $result"
            echo '{"success":false,"error":"cgdcont_failed","detail":"AT+CGDCONT returned ERROR"}'
            exit 0
            ;;
        *)
            qlog_info "AT+CGDCONT=$CID,\"$PDP_TYPE\",\"$APN\" OK"
            ;;
    esac

    # --- Step 2: Apply TTL/HL if requested (from Auto APN presets) ---
    if [ "$TTL" -gt 0 ] 2>/dev/null || [ "$HL" -gt 0 ] 2>/dev/null; then
        qlog_info "Applying TTL=$TTL, HL=$HL"

        # Read current values from firewall rules file
        current_ttl=0
        current_hl=0
        if [ -s "$TTL_FILE" ]; then
            current_ttl=$(grep 'iptables.*--ttl-set' "$TTL_FILE" 2>/dev/null | awk '{for(i=1;i<=NF;i++){if($i=="--ttl-set"){print $(i+1)}}}' | head -1)
            current_hl=$(grep 'ip6tables.*--hl-set' "$TTL_FILE" 2>/dev/null | awk '{for(i=1;i<=NF;i++){if($i=="--hl-set"){print $(i+1)}}}' | head -1)
        fi
        [ -z "$current_ttl" ] && current_ttl=0
        [ -z "$current_hl" ] && current_hl=0

        # Only apply if values actually changed
        if [ "$current_ttl" != "$TTL" ] || [ "$current_hl" != "$HL" ]; then
            # Clear existing rules
            if [ "$current_ttl" -gt 0 ] 2>/dev/null; then
                iptables -t mangle -D POSTROUTING -o rmnet+ -j TTL --ttl-set "$current_ttl" 2>/dev/null
            fi
            if [ "$current_hl" -gt 0 ] 2>/dev/null; then
                ip6tables -t mangle -D POSTROUTING -o rmnet+ -j HL --hl-set "$current_hl" 2>/dev/null
            fi

            # Write new rules file
            > "$TTL_FILE"
            if [ "$TTL" -gt 0 ] 2>/dev/null; then
                echo "iptables -t mangle -A POSTROUTING -o rmnet+ -j TTL --ttl-set $TTL" >> "$TTL_FILE"
                iptables -t mangle -A POSTROUTING -o rmnet+ -j TTL --ttl-set "$TTL"
            fi
            if [ "$HL" -gt 0 ] 2>/dev/null; then
                echo "ip6tables -t mangle -A POSTROUTING -o rmnet+ -j HL --hl-set $HL" >> "$TTL_FILE"
                ip6tables -t mangle -A POSTROUTING -o rmnet+ -j HL --hl-set "$HL"
            fi

            # Manage init.d script for boot persistence
            if [ "$TTL" -gt 0 ] 2>/dev/null || [ "$HL" -gt 0 ] 2>/dev/null; then
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
                    "$TTL_INIT" enable 2>/dev/null
                fi
            else
                if [ -f "$TTL_INIT" ]; then
                    "$TTL_INIT" disable 2>/dev/null
                fi
            fi

            qlog_info "TTL/HL applied: TTL=$TTL, HL=$HL"
        else
            qlog_info "TTL/HL unchanged (TTL=$TTL, HL=$HL)"
        fi
    fi

    jq -n '{"success":true}'
    exit 0
fi

# --- Method not allowed -------------------------------------------------------
echo '{"success":false,"error":"method_not_allowed","detail":"Use GET or POST"}'
