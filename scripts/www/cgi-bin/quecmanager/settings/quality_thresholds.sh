#!/bin/sh
# =============================================================================
# quality_thresholds.sh — CGI Endpoint: Latency & Loss Thresholds (GET + POST)
# =============================================================================
# GET:  Returns current per-row preset selections + is_default flag.
# POST: Saves preset selections (one of standard/tolerant/very-tolerant per row),
#       writes /etc/qmanager/quality_thresholds.json atomically, pokes the
#       events.sh reload flag at /tmp/qmanager_events_reload.
#
# Threshold values themselves resolve in scripts/usr/lib/qmanager/events.sh
# (single source of truth) — this CGI writes only preset names.
#
# Endpoint: GET/POST /cgi-bin/quecmanager/settings/quality_thresholds.sh
# Install location: /www/cgi-bin/quecmanager/settings/quality_thresholds.sh
# =============================================================================

LIB_DIR="${QM_LIB_DIR:-/usr/lib/qmanager}"
. "$LIB_DIR/cgi_base.sh"

qlog_init "cgi_quality_thresholds"
cgi_headers
cgi_handle_options

CONFIG="${QUALITY_CONFIG:-/etc/qmanager/quality_thresholds.json}"
RELOAD_FLAG="${QUALITY_RELOAD_FLAG:-/tmp/qmanager_events_reload}"

VALID_PRESETS='standard tolerant very-tolerant'

is_valid_preset() {
    case "$1" in
        standard|tolerant|very-tolerant) return 0 ;;
        *) return 1 ;;
    esac
}

# =============================================================================
# GET — Fetch current presets
# =============================================================================
if [ "$REQUEST_METHOD" = "GET" ]; then
    qlog_info "Fetching quality thresholds"

    lat="tolerant"
    loss="tolerant"
    lat_ok=false
    loss_ok=false

    if [ -f "$CONFIG" ]; then
        v_lat=$(jq -r '.latency.preset // empty' "$CONFIG" 2>/dev/null) || v_lat=""
        v_loss=$(jq -r '.loss.preset // empty' "$CONFIG" 2>/dev/null) || v_loss=""
        case "$v_lat" in
            standard|tolerant|very-tolerant) lat="$v_lat"; lat_ok=true ;;
            *) qlog_warn "quality_thresholds.json had unexpected latency preset '$v_lat', returning default" ;;
        esac
        case "$v_loss" in
            standard|tolerant|very-tolerant) loss="$v_loss"; loss_ok=true ;;
            *) qlog_warn "quality_thresholds.json had unexpected loss preset '$v_loss', returning default" ;;
        esac
    fi

    if [ "$lat_ok" = "true" ] && [ "$loss_ok" = "true" ]; then
        is_default=false
    else
        is_default=true
    fi

    jq -n --arg lat "$lat" --arg loss "$loss" --argjson is_default "$is_default" \
        '{success: true, settings: {latency: {preset: $lat}, loss: {preset: $loss}}, is_default: $is_default}'
    exit 0
fi

# =============================================================================
# POST — Save presets
# =============================================================================
if [ "$REQUEST_METHOD" = "POST" ]; then
    cgi_read_post

    ACTION=$(printf '%s' "$POST_DATA" | jq -r '.action // empty' 2>/dev/null)
    if [ -z "$ACTION" ]; then
        cgi_error "missing_action" "action field is required"
        exit 0
    fi

    if [ "$ACTION" != "save_settings" ]; then
        cgi_error "unknown_action" "Unknown action: $ACTION"
        exit 0
    fi

    new_lat=$(printf '%s' "$POST_DATA" | jq -r '.latency.preset // empty' 2>/dev/null)
    if ! is_valid_preset "$new_lat"; then
        cgi_error "invalid_latency_preset" "latency.preset must be one of: $VALID_PRESETS"
        exit 0
    fi

    new_loss=$(printf '%s' "$POST_DATA" | jq -r '.loss.preset // empty' 2>/dev/null)
    if ! is_valid_preset "$new_loss"; then
        cgi_error "invalid_loss_preset" "loss.preset must be one of: $VALID_PRESETS"
        exit 0
    fi

    mkdir -p "$(dirname "$CONFIG")"

    # Atomic write: jq into .tmp, then mv. Avoids zero-byte config on jq failure.
    if ! jq -n --arg lat "$new_lat" --arg loss "$new_loss" \
        '{latency: {preset: $lat}, loss: {preset: $loss}}' > "${CONFIG}.tmp"; then
        rm -f "${CONFIG}.tmp"
        cgi_error "write_failed" "Failed to generate config JSON"
        exit 0
    fi

    if ! mv "${CONFIG}.tmp" "$CONFIG"; then
        rm -f "${CONFIG}.tmp"
        cgi_error "write_failed" "Failed to write config file"
        exit 0
    fi

    qlog_info "Quality thresholds saved: latency=$new_lat loss=$new_loss"

    # Poke events.sh reload (failure non-fatal; old config remains active).
    if ! touch "$RELOAD_FLAG" 2>/dev/null; then
        qlog_warn "Failed to touch reload flag at $RELOAD_FLAG (poller may not reload until restart)"
    fi

    cgi_success
    exit 0
fi

# =============================================================================
# Unsupported method
# =============================================================================
cgi_error "method_not_allowed" "Only GET and POST are supported"
