#!/bin/sh
. /usr/lib/qmanager/cgi_base.sh
# =============================================================================
# fetch_traffic.sh — CGI Endpoint for Live Cellular Traffic Stream
# =============================================================================
# Serves /tmp/qmanager_traffic.json (written by qmanager_traffic daemon).
# Adds a "stale" boolean if the file mtime is older than STALE_SECONDS.
# Emits a zeroed payload with stale=true if the file is missing entirely.
#
# Endpoint: GET /cgi-bin/quecmanager/at_cmd/fetch_traffic.sh
# Response: application/json
# Install location: /www/cgi-bin/quecmanager/at_cmd/fetch_traffic.sh
# =============================================================================

qlog_init "cgi_traffic"
cgi_headers
cgi_handle_options

CACHE_FILE="/tmp/qmanager_traffic.json"
STALE_SECONDS=5

now=$(date +%s)

if [ ! -f "$CACHE_FILE" ]; then
    cat << 'FALLBACK'
{
  "ts": 0,
  "iface": null,
  "total_rx_bytes": 0,
  "total_tx_bytes": 0,
  "rx_bytes_per_sec": 0,
  "tx_bytes_per_sec": 0,
  "stale": true
}
FALLBACK
    exit 0
fi

mtime=$(stat -c %Y "$CACHE_FILE" 2>/dev/null || echo 0)
age=$((now - mtime))

if [ "$age" -gt "$STALE_SECONDS" ]; then
    # Inject stale=true into the existing payload; fall back to raw cache
    # if jq is missing or fails to parse, so the response is never empty.
    jq --argjson stale true '. + { stale: $stale }' < "$CACHE_FILE" \
        || cat "$CACHE_FILE"
else
    cat "$CACHE_FILE"
fi
