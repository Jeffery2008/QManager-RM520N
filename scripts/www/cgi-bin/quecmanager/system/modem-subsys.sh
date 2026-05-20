#!/bin/sh
. /usr/lib/qmanager/cgi_base.sh
# =============================================================================
# modem-subsys.sh — CGI Endpoint: System Health (GET only)
# =============================================================================
# Thin reader over the poller cache (/tmp/qmanager_status.json). The poller
# refreshes system_health on every Tier 1 cycle (~2s); this CGI just reshapes
# that block into the historical response schema so the frontend hook is
# unaware of the source change.
#
# Falls back to a degraded null-shaped response if the cache is missing or
# stale, rather than re-implementing live computation. The poller is the
# single source of truth.
#
# Endpoint: GET /cgi-bin/quecmanager/system/modem-subsys.sh
# Install location: /www/cgi-bin/quecmanager/system/modem-subsys.sh
# =============================================================================

qlog_init "cgi_modem_subsys"
cgi_headers
cgi_handle_options

CACHE_FILE="/tmp/qmanager_status.json"
CACHE_MAX_AGE=30        # seconds; refuse to serve cache older than this.
                        # Poller Tier 1 runs ~every 2s; Tier 2 cycles can
                        # stretch to ~10s. 30s comfortably absorbs that
                        # while still flagging a dead poller.

if [ "$REQUEST_METHOD" = "GET" ]; then

    # Serve degraded (all-null) shape when the cache hasn't been written yet
    # or is stale. Frontend treats null fields the same as missing — UI shows
    # em-dashes, never blanks out.
    serve_empty() {
        jq -n '{
            state: "unknown",
            state_raw: null,
            crash_count: null,
            coredump_present: false,
            last_crash_at: null,
            total_logged_crashes: 0,
            uptime_seconds: 0,
            cpu: null,
            memory: null,
            storage: null
        }'
        exit 0
    }

    [ -r "$CACHE_FILE" ] || serve_empty

    cache_mtime=$(stat -c %Y "$CACHE_FILE" 2>/dev/null || echo 0)
    now_ts=$(date +%s)
    cache_age=$((now_ts - cache_mtime))
    if [ "$cache_age" -gt "$CACHE_MAX_AGE" ] 2>/dev/null; then
        qlog_warn "cache stale (age=${cache_age}s) — serving empty shape"
        serve_empty
    fi

    # Compose the response from cache fields. uptime_seconds lives under
    # device.uptime_seconds in the cache; everything else is in system_health.
    jq '{
        state:                (.system_health.state // "unknown"),
        state_raw:            .system_health.state_raw,
        crash_count:          .system_health.crash_count,
        coredump_present:     (.system_health.coredump_present // false),
        last_crash_at:        .system_health.last_crash_at,
        total_logged_crashes: (.system_health.total_logged_crashes // 0),
        uptime_seconds:       (.device.uptime_seconds // 0),
        cpu:                  .system_health.cpu,
        memory:               .system_health.memory,
        storage:              .system_health.storage
    }' "$CACHE_FILE" 2>/dev/null || serve_empty

    exit 0
fi

cgi_method_not_allowed
