#!/bin/sh
# conn_state.sh — the one reader of /tmp/qmanager_ping.json (poller + watchcat).
# POSIX sh / BusyBox ash safe. Fail-closed: any read problem is STALE, never "up".

[ -n "${_CONN_STATE_LOADED:-}" ] && return 0
_CONN_STATE_LOADED=1

CQ_PING_CACHE="${CQ_PING_CACHE:-/tmp/qmanager_ping.json}"
CQ_PING_CONFIG="${CQ_PING_CONFIG:-/etc/qmanager/ping_profile.json}"
_CQ_TAB=$(printf '\t')

# Neutral values: reachable is "null" (unknown), never true.
_cq_reset() {
    CQ_STALE=1; CQ_STALE_REASON=""; CQ_AGE_SEC=""; CQ_STALE_THRESHOLD=15
    CQ_TIMESTAMP=""; CQ_MONO=""; CQ_REACHABLE="null"; CQ_RTT_MS="null"
    CQ_STREAK_SUCCESS=0; CQ_STREAK_FAIL=0; CQ_FAIL_ELAPSED_SEC=0
    CQ_DURING_RECOVERY="false"; CQ_INTERVAL_SEC=5
    CQ_PROFILE=""; CQ_LAST_FAMILY=""; CQ_LAST_TARGET=""; CQ_TARGET=""
}
_cq_reset

# conn_state_read: one jq read into CQ_* vars. Returns 0 fresh, 1 stale/missing/unreadable
# (verdict vars are then neutral). Stale = age > max(3*interval_sec, 15), interval outside
# 1-300 clamped to 5; age is cache `mono` vs /proc/uptime, wall clock only if mono is absent.
conn_state_read() {
    _cq_reset
    if [ ! -f "$CQ_PING_CACHE" ]; then
        CQ_STALE_REASON="missing"
        return 1
    fi

    _cq_row=$(jq -r 'def s: if . == null or . == "" then "-" else tostring end;
        [(.timestamp|s), (.mono|s), (.reachable|s), (.last_rtt_ms|s),
         (.streak_success|s), (.streak_fail|s), (.fail_elapsed_sec|s),
         (.during_recovery|s), (.interval_sec|s), (.profile|s),
         (.last_family|s), (.last_target|s), (.targets[0]?|s)] | @tsv' \
        "$CQ_PING_CACHE" 2>/dev/null </dev/null)
    if [ -z "$_cq_row" ]; then
        CQ_STALE_REASON="unreadable"
        return 1
    fi

    IFS="$_CQ_TAB" read -r _cq_ts _cq_mono _cq_reach _cq_rtt _cq_ss _cq_sf _cq_fe \
        _cq_dr _cq_iv CQ_PROFILE CQ_LAST_FAMILY CQ_LAST_TARGET CQ_TARGET <<EOF
$_cq_row
EOF

    case "$_cq_ts" in ''|*[!0-9]*)
        CQ_STALE_REASON="no timestamp"
        return 1 ;;
    esac
    case "$_cq_iv" in ''|*[!0-9]*) _cq_iv=5 ;; esac
    { [ "$_cq_iv" -ge 1 ] && [ "$_cq_iv" -le 300 ]; } 2>/dev/null || _cq_iv=5
    CQ_INTERVAL_SEC="$_cq_iv"
    CQ_STALE_THRESHOLD=$((3 * _cq_iv))
    [ "$CQ_STALE_THRESHOLD" -lt 15 ] && CQ_STALE_THRESHOLD=15

    _cq_age=""
    case "$_cq_mono" in
        ''|*[!0-9]*|0) ;;
        *)
            _cq_up=""
            { read -r _cq_up _cq_idle < /proc/uptime; } 2>/dev/null
            _cq_up="${_cq_up%%.*}"
            case "$_cq_up" in ''|*[!0-9]*) ;; *)
                _cq_age=$((_cq_up - _cq_mono))
                CQ_MONO="$_cq_mono"
                if [ "$_cq_age" -lt 0 ]; then
                    CQ_AGE_SEC="$_cq_age"
                    CQ_STALE_REASON="mono ahead of uptime"
                    return 1
                fi ;;
            esac ;;
    esac
    [ -z "$_cq_age" ] && _cq_age=$(( $(date +%s) - _cq_ts ))
    CQ_AGE_SEC="$_cq_age"
    if [ "$_cq_age" -gt "$CQ_STALE_THRESHOLD" ]; then
        CQ_STALE_REASON="age ${_cq_age}s > ${CQ_STALE_THRESHOLD}s"
        return 1
    fi

    CQ_STALE=0
    CQ_TIMESTAMP="$_cq_ts"
    case "$_cq_reach" in true|false) CQ_REACHABLE="$_cq_reach" ;; esac
    case "$_cq_rtt" in ''|-|*[!0-9.]*) CQ_RTT_MS="null" ;; *) CQ_RTT_MS="$_cq_rtt" ;; esac
    case "$_cq_ss" in ''|*[!0-9]*) ;; *) CQ_STREAK_SUCCESS="$_cq_ss" ;; esac
    case "$_cq_sf" in ''|*[!0-9]*) ;; *) CQ_STREAK_FAIL="$_cq_sf" ;; esac
    case "$_cq_fe" in ''|*[!0-9]*) ;; *) CQ_FAIL_ELAPSED_SEC="$_cq_fe" ;; esac
    [ "$_cq_dr" = "true" ] && CQ_DURING_RECOVERY="true"
    [ "$CQ_PROFILE" = "-" ] && CQ_PROFILE=""
    [ "$CQ_LAST_FAMILY" = "-" ] && CQ_LAST_FAMILY=""
    [ "$CQ_LAST_TARGET" = "-" ] && CQ_LAST_TARGET=""
    [ "$CQ_TARGET" = "-" ] && CQ_TARGET=""
    return 0
}

# One-line reason for the last conn_state_read failure (for the caller's log).
conn_state_why() {
    printf '%s' "${CQ_STALE_REASON:-unknown}"
}

# conn_state_down_for N: link is DOWN for >= N s (reachable=false, fresh read).
# during_recovery is deliberately not consulted.
conn_state_down_for() {
    case "${1:-}" in ''|*[!0-9]*) return 1 ;; esac
    [ "$CQ_STALE" = "0" ] && [ "$CQ_REACHABLE" = "false" ] && [ "$CQ_FAIL_ELAPSED_SEC" -ge "$1" ]
}

# conn_state_is_up: fresh read with reachable=true (independent of during_recovery).
conn_state_is_up() {
    [ "$CQ_STALE" = "0" ] && [ "$CQ_REACHABLE" = "true" ]
}

# conn_state_cadence [config]: effective probe cadence the daemon runs, from
# ping_profile.json. Mirrors resolve_profile() in qmanager_ping (profile table, then
# numeric per-field overrides). Sets CQ_CFG_PROFILE/INTERVAL_SEC/FAIL_SECS/RECOVER_SECS.
conn_state_cadence() {
    _cq_cfg="${1:-$CQ_PING_CONFIG}"
    CQ_CFG_PROFILE="relaxed"; _cq_pi=""; _cq_pf=""; _cq_pr=""
    if [ -f "$_cq_cfg" ]; then
        _cq_row=$(jq -r 'def s: if . == null or . == "" then "-" else tostring end;
            [(.profile|s), (.interval_sec|s), (.fail_secs|s), (.recover_secs|s)] | @tsv' \
            "$_cq_cfg" 2>/dev/null </dev/null)
        if [ -n "$_cq_row" ]; then
            IFS="$_CQ_TAB" read -r CQ_CFG_PROFILE _cq_pi _cq_pf _cq_pr <<EOF
$_cq_row
EOF
        fi
    fi
    case "$CQ_CFG_PROFILE" in
        sensitive) CQ_CFG_INTERVAL_SEC=1;  CQ_CFG_FAIL_SECS=15; CQ_CFG_RECOVER_SECS=3 ;;
        regular)   CQ_CFG_INTERVAL_SEC=2;  CQ_CFG_FAIL_SECS=20; CQ_CFG_RECOVER_SECS=6 ;;
        quiet)     CQ_CFG_INTERVAL_SEC=10; CQ_CFG_FAIL_SECS=60; CQ_CFG_RECOVER_SECS=20 ;;
        *) CQ_CFG_PROFILE="relaxed"
           CQ_CFG_INTERVAL_SEC=5;  CQ_CFG_FAIL_SECS=30; CQ_CFG_RECOVER_SECS=10 ;;
    esac
    case "$_cq_pi" in ''|*[!0-9]*) ;; *) CQ_CFG_INTERVAL_SEC="$_cq_pi" ;; esac
    case "$_cq_pf" in ''|*[!0-9]*) ;; *) CQ_CFG_FAIL_SECS="$_cq_pf" ;; esac
    case "$_cq_pr" in ''|*[!0-9]*) ;; *) CQ_CFG_RECOVER_SECS="$_cq_pr" ;; esac
    [ "$CQ_CFG_INTERVAL_SEC" -gt 0 ] 2>/dev/null || CQ_CFG_INTERVAL_SEC=1
    return 0
}
