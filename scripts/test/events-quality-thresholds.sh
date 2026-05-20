#!/usr/bin/env bash
# Test the quality-threshold helpers in events.sh in isolation.
# Sources events.sh, exercises _qt_load + _qt_check_reload, asserts the
# four module-level threshold globals end up at the right values.
set -eu

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
EVENTS="$REPO_ROOT/scripts/usr/lib/qmanager/events.sh"

if [ ! -f "$EVENTS" ]; then
    echo "FAIL: events.sh not found at $EVENTS" >&2
    exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
    echo "SKIP: jq not on PATH" >&2
    exit 0
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

PASS=0
FAIL=0
ok()  { PASS=$((PASS + 1)); printf '  PASS  %s\n' "$1"; }
bad() { FAIL=$((FAIL + 1)); printf '  FAIL  %s\n' "$1" >&2; }

# Stub the qlog_* helpers events.sh expects from cgi_base.sh.
stub() {
    cat <<'STUB'
qlog_init()  { :; }
qlog_debug() { :; }
qlog_info()  { :; }
qlog_warn()  { :; }
qlog_error() { :; }
EVENTS_FILE="${EVENTS_FILE:-/dev/null}"
MAX_EVENTS="${MAX_EVENTS:-100}"
STUB
}

# --- Test 1: defaults match "tolerant" when JSON is absent --------------
(
    set +eu
    eval "$(stub)"
    export QUALITY_CONFIG="$work/missing.json"
    export QUALITY_RELOAD_FLAG="$work/missing.flag"
    . "$EVENTS"
    [ "$_qt_lat_thresh" = "250" ]    || { echo "lat_thresh=$_qt_lat_thresh"; exit 1; }
    [ "$_qt_lat_debounce" = "3" ]    || { echo "lat_debounce=$_qt_lat_debounce"; exit 1; }
    [ "$_qt_loss_thresh" = "30" ]    || { echo "loss_thresh=$_qt_loss_thresh"; exit 1; }
    [ "$_qt_loss_debounce" = "3" ]   || { echo "loss_debounce=$_qt_loss_debounce"; exit 1; }
) && ok "defaults = tolerant when config missing" || bad "defaults = tolerant when config missing"

# --- Test 2: standard preset resolves to 150ms / 15% --------------------
(
    set +eu
    eval "$(stub)"
    cfg="$work/std.json"
    printf '{"latency":{"preset":"standard"},"loss":{"preset":"standard"}}\n' > "$cfg"
    export QUALITY_CONFIG="$cfg"
    export QUALITY_RELOAD_FLAG="$work/std.flag"
    . "$EVENTS"
    [ "$_qt_lat_thresh" = "150" ]  || { echo "lat_thresh=$_qt_lat_thresh"; exit 1; }
    [ "$_qt_lat_debounce" = "3" ]  || { echo "lat_debounce=$_qt_lat_debounce"; exit 1; }
    [ "$_qt_loss_thresh" = "15" ]  || { echo "loss_thresh=$_qt_loss_thresh"; exit 1; }
    [ "$_qt_loss_debounce" = "3" ] || { echo "loss_debounce=$_qt_loss_debounce"; exit 1; }
) && ok "standard preset resolves to 150ms / 15%" || bad "standard preset resolves to 150ms / 15%"

# --- Test 3: very-tolerant preset resolves to 500ms / 50% --------------
(
    set +eu
    eval "$(stub)"
    cfg="$work/vt.json"
    printf '{"latency":{"preset":"very-tolerant"},"loss":{"preset":"very-tolerant"}}\n' > "$cfg"
    export QUALITY_CONFIG="$cfg"
    export QUALITY_RELOAD_FLAG="$work/vt.flag"
    . "$EVENTS"
    [ "$_qt_lat_thresh" = "500" ]  || { echo "lat_thresh=$_qt_lat_thresh"; exit 1; }
    [ "$_qt_lat_debounce" = "2" ]  || { echo "lat_debounce=$_qt_lat_debounce"; exit 1; }
    [ "$_qt_loss_thresh" = "50" ]  || { echo "loss_thresh=$_qt_loss_thresh"; exit 1; }
    [ "$_qt_loss_debounce" = "2" ] || { echo "loss_debounce=$_qt_loss_debounce"; exit 1; }
) && ok "very-tolerant preset resolves to 500ms / 50%" || bad "very-tolerant preset resolves to 500ms / 50%"

# --- Test 4: invalid preset name falls back to defaults ----------------
(
    set +eu
    eval "$(stub)"
    cfg="$work/bad.json"
    printf '{"latency":{"preset":"bogus"},"loss":{"preset":"bogus"}}\n' > "$cfg"
    export QUALITY_CONFIG="$cfg"
    export QUALITY_RELOAD_FLAG="$work/bad.flag"
    . "$EVENTS"
    [ "$_qt_lat_thresh" = "250" ]  || { echo "lat_thresh=$_qt_lat_thresh"; exit 1; }
    [ "$_qt_loss_thresh" = "30" ]  || { echo "loss_thresh=$_qt_loss_thresh"; exit 1; }
) && ok "invalid preset name keeps tolerant defaults" || bad "invalid preset name keeps tolerant defaults"

# --- Test 5: malformed JSON falls back to defaults ---------------------
(
    set +eu
    eval "$(stub)"
    cfg="$work/malformed.json"
    printf 'not valid json' > "$cfg"
    export QUALITY_CONFIG="$cfg"
    export QUALITY_RELOAD_FLAG="$work/malformed.flag"
    . "$EVENTS"
    [ "$_qt_lat_thresh" = "250" ]  || { echo "lat_thresh=$_qt_lat_thresh"; exit 1; }
    [ "$_qt_loss_thresh" = "30" ]  || { echo "loss_thresh=$_qt_loss_thresh"; exit 1; }
) && ok "malformed JSON keeps tolerant defaults" || bad "malformed JSON keeps tolerant defaults"

# --- Test 6: reload flag triggers re-read and is consumed --------------
(
    set +eu
    eval "$(stub)"
    cfg="$work/reload.json"
    flag="$work/reload.flag"
    printf '{"latency":{"preset":"tolerant"},"loss":{"preset":"tolerant"}}\n' > "$cfg"
    export QUALITY_CONFIG="$cfg"
    export QUALITY_RELOAD_FLAG="$flag"
    . "$EVENTS"
    # Mutate config and touch flag.
    printf '{"latency":{"preset":"standard"},"loss":{"preset":"standard"}}\n' > "$cfg"
    touch "$flag"
    _qt_check_reload
    [ "$_qt_lat_thresh" = "150" ]  || { echo "after reload lat_thresh=$_qt_lat_thresh"; exit 1; }
    [ "$_qt_loss_thresh" = "15" ]  || { echo "after reload loss_thresh=$_qt_loss_thresh"; exit 1; }
    [ ! -f "$flag" ]               || { echo "reload flag not consumed"; exit 1; }
) && ok "reload flag triggers re-read and is consumed" || bad "reload flag triggers re-read and is consumed"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
