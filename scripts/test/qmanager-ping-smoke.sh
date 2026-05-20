#!/bin/sh
# Workstation/on-device smoke test for the Rust qmanager_ping binary.
# Stops the systemd service, runs the binary against a local stub HTTP server,
# then validates the JSON output.
#
# Run on the device or in WSL2 with the binary built. Requires: jq, python3.
#
# NOTE: the Rust daemon hardcodes /tmp/qmanager_ping.json, /tmp/qmanager_ping_history,
# /tmp/qmanager_ping.pid, etc. This smoke runs against those production paths —
# stop the live qmanager-ping service first if it's running on this host, and
# expect /tmp/qmanager_ping.json to be overwritten by the test cycles.
# Run this smoke on a dev machine (WSL2) or on a device where the service is stopped.
set -eu

if ! command -v jq >/dev/null; then
    echo "FAIL: jq not found" >&2
    exit 1
fi
if ! command -v python3 >/dev/null; then
    echo "FAIL: python3 not found (install with: opkg install python3-light)" >&2
    exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BIN="${PING_BIN:-$REPO_ROOT/scripts/usr/bin/qmanager_ping}"
if [ ! -x "$BIN" ]; then
    echo "FAIL: $BIN not executable" >&2
    exit 1
fi

WORK=$(mktemp -d)
SERVER_PID=""
DAEMON_PID=""

cleanup() {
    [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true
    [ -n "$DAEMON_PID" ] && kill -9 "$DAEMON_PID" 2>/dev/null || true
    rm -rf "$WORK"
}
trap cleanup EXIT INT TERM

# Remove any stale state from previous runs so we never read old cache data.
rm -f /tmp/qmanager_ping.json /tmp/qmanager_ping.pid /tmp/qmanager_ping_history

# Tiny always-204 server (HTTP/1.1 keepalive so the Rust probe's TCP reuse works)
python3 -c '
import http.server, socketserver, threading
class H(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    def do_GET(self):
        self.send_response(204); self.send_header("Content-Length","0"); self.end_headers()
    def log_message(self, *a, **k): pass
class S(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
with S(("127.0.0.1", 18204), H) as s:
    s.serve_forever()
' &
SERVER_PID=$!
sleep 0.5

PING_INTERVAL=1 \
FAIL_SECS=3 \
RECOVER_SECS=2 \
INTERCEPT_SECS=4 \
HISTORY_SECS=10 \
PING_TARGET_1="http://127.0.0.1:18204/" \
PING_TARGET_2="http://127.0.0.1:18204/" \
"$BIN" >/tmp/qping_smoke.log 2>&1 &
DAEMON_PID=$!

sleep 4

if [ ! -f /tmp/qmanager_ping.json ]; then
    echo "FAIL: /tmp/qmanager_ping.json was not created"
    exit 1
fi

CONN=$(jq -r .connectivity /tmp/qmanager_ping.json)
RTT_TYPE=$(jq -r '.last_rtt_ms | type' /tmp/qmanager_ping.json)
TCP_REUSED=$(jq -r .tcp_reused /tmp/qmanager_ping.json)
PROFILE=$(jq -r .profile /tmp/qmanager_ping.json)

[ "$CONN" = "connected" ] || { echo "FAIL: connectivity=$CONN expected connected"; exit 1; }
[ "$RTT_TYPE" = "number" ] || { echo "FAIL: last_rtt_ms type=$RTT_TYPE expected number"; exit 1; }
[ "$TCP_REUSED" = "true" ] || echo "WARN: tcp_reused=$TCP_REUSED (may be ok on first cycle, but should flip true within 4s)"
[ "$PROFILE" = "custom" ] || { echo "FAIL: profile=$PROFILE expected custom (env overrides)"; exit 1; }
echo "PASS: connected path"

# ─── Test: primary unreachable, fallback to secondary ────────────────────────
echo
echo "TEST: primary down → fallback to secondary"

# Reset state for this scenario.
rm -f /tmp/qmanager_ping.json /tmp/qmanager_ping.pid /tmp/qmanager_ping_history

# Kill the previous daemon instance (already dead from timeout, but be sure).
kill "$DAEMON_PID" 2>/dev/null || true
wait "$DAEMON_PID" 2>/dev/null || true

# Point primary at port 18203 (no listener → refused) so it always fails.
# Secondary points at the still-running stub on port 18204.
# Path "/" is a custom URL (not /generate_204) so any HTTP response = Connected.
PING_INTERVAL=1 \
FAIL_SECS=3 \
RECOVER_SECS=2 \
INTERCEPT_SECS=4 \
HISTORY_SECS=10 \
PING_TARGET_1="http://127.0.0.1:18203/" \
PING_TARGET_2="http://127.0.0.1:18204/" \
"$BIN" >>/tmp/qping_smoke.log 2>&1 &
DAEMON_PID=$!

sleep 4

if [ ! -f /tmp/qmanager_ping.json ]; then
    echo "FAIL: /tmp/qmanager_ping.json was not created in fallback test"
    exit 1
fi

CONN=$(jq -r .connectivity /tmp/qmanager_ping.json)
TARGET_USED=$(jq -r '.probe_target_used' /tmp/qmanager_ping.json)

kill "$DAEMON_PID" 2>/dev/null || true
wait "$DAEMON_PID" 2>/dev/null || true
DAEMON_PID=""

if [ "$CONN" != "connected" ]; then
    echo "FAIL: expected connectivity=connected with working fallback, got '$CONN'"
    exit 1
fi

if [ "$TARGET_USED" != "http://127.0.0.1:18204/" ]; then
    echo "FAIL: expected probe_target_used=http://127.0.0.1:18204/, got '$TARGET_USED'"
    exit 1
fi

echo "PASS: fallback to secondary works"

echo
echo "All smoke checks passed."
