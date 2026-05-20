#!/bin/bash
# Workstation fixtures for parse_at.sh parsers not covered by poller-phase-bcd.sh.
# Run from repo root: bash scripts/test/parse-at.sh
#
# Each test sources scripts/usr/lib/qmanager/parse_at.sh in a subshell, calls
# the parser with fixture AT-command output, and asserts on the resulting
# global vars. jq-dependent assertions are guarded so the harness runs
# cleanly on workstations without jq (Windows dev box).
set -eu

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

fail=0
pass_count=0
fail_count=0

ok()   { printf '  PASS  %s\n' "$1"; pass_count=$((pass_count + 1)); }
bad()  { printf '  FAIL  %s\n' "$1"; fail_count=$((fail_count + 1)); fail=1; }
section() { printf '\n== %s ==\n' "$1"; }

PARSE_AT="$REPO_ROOT/scripts/usr/lib/qmanager/parse_at.sh"
jq_available=$(command -v jq 2>/dev/null || true)

section "harness self-check"
if [ -f "$PARSE_AT" ]; then
    ok "parse_at.sh found"
else
    bad "parse_at.sh missing at $PARSE_AT"
fi

# ---------------------------------------------------------------------------
section "parse_serving_cell — LTE-only mode"

sample_lte=$'+QENG: "servingcell","CONNECT","LTE","FDD",515,03,FCB04A0,222,1350,3,5,5,1A2B,-95,-12,-58,11,0\nOK'

result=$(
    set +eu
    qlog_warn() { :; }
    qlog_info() { :; }
    qlog_debug() { :; }
    qlog_error() { :; }
    service_status="unknown"
    . "$PARSE_AT"
    parse_serving_cell "$sample_lte"
    printf '%s|%s|%s|%s|%s|%s|%s|%s|%s|%s\n' \
        "$network_type" "$lte_state" "$nr_state" \
        "$lte_band" "$lte_pci" "$lte_earfcn" "$lte_bandwidth" \
        "$lte_rsrp" "$lte_rsrq" "$lte_sinr"
)

case "$result" in
    'LTE|connected|inactive|B3|222|1350|5|-95|-12|11')
        ok "parse_serving_cell populated LTE fields correctly"
        ;;
    *)
        bad "parse_serving_cell LTE output mismatch: '$result'"
        ;;
esac

# ---------------------------------------------------------------------------
section "parse_serving_cell — 5G-SA mode"

# Single +QENG: line — servingcell,state,NR5G-SA,duplex,MCC,MNC,cellID,PCID,
#                     TAC,ARFCN,band,NR_DL_bw,RSRP,RSRQ,SINR,scs,srxlev
# Field positions:    1           2     3       4      5   6   7      8
#                     9   10     11   12       13   14   15   16  17
sample_sa=$'+QENG: "servingcell","CONNECT","NR5G-SA","TDD",515,03,12345AB,500,5A2B,627264,78,2,-90,-10,15,1,32\nOK'

result=$(
    set +eu
    qlog_warn() { :; }
    qlog_info() { :; }
    qlog_debug() { :; }
    qlog_error() { :; }
    service_status="unknown"
    . "$PARSE_AT"
    parse_serving_cell "$sample_sa"
    printf '%s|%s|%s|%s|%s|%s|%s|%s|%s\n' \
        "$network_type" "$lte_state" "$nr_state" \
        "$nr_band" "$nr_pci" "$nr_arfcn" \
        "$nr_rsrp" "$nr_rsrq" "$nr_sinr"
)

case "$result" in
    '5G-SA|inactive|connected|N78|500|627264|-90|-10|15')
        ok "parse_serving_cell populated 5G-SA fields correctly"
        ;;
    *)
        bad "parse_serving_cell 5G-SA output mismatch: '$result'"
        ;;
esac

# ---------------------------------------------------------------------------
section "parse_qrsrp — per-antenna LTE + NR"

if [ -z "$jq_available" ]; then
    printf '  SKIP  parse_qrsrp (jq not available on workstation)\n'
else
    sample_qrsrp=$'+QRSRP: -95,-91,-89,-93,LTE\n+QRSRP: -90,-88,-86,-92,NR5G\nOK'

    result=$(
        set +eu
        qlog_warn() { :; }
        qlog_info() { :; }
        qlog_debug() { :; }
        qlog_error() { :; }
        . "$PARSE_AT"
        parse_qrsrp "$sample_qrsrp"
        printf '%s\n%s\n' "$sig_lte_rsrp" "$sig_nr_rsrp"
    )

    lte_json=$(printf '%s\n' "$result" | sed -n '1p')
    nr_json=$(printf '%s\n' "$result" | sed -n '2p')

    lte_first=$(printf '%s' "$lte_json" | jq '.[0]' 2>/dev/null)
    lte_last=$(printf '%s' "$lte_json" | jq '.[3]' 2>/dev/null)
    nr_first=$(printf '%s' "$nr_json" | jq '.[0]' 2>/dev/null)
    nr_last=$(printf '%s' "$nr_json" | jq '.[3]' 2>/dev/null)

    if [ "$lte_first" = "-95" ] && [ "$lte_last" = "-93" ]; then
        ok "sig_lte_rsrp first/last antennas match (-95, -93)"
    else
        bad "sig_lte_rsrp antenna mismatch: first='$lte_first' last='$lte_last' (json='$lte_json')"
    fi

    if [ "$nr_first" = "-90" ] && [ "$nr_last" = "-92" ]; then
        ok "sig_nr_rsrp first/last antennas match (-90, -92)"
    else
        bad "sig_nr_rsrp antenna mismatch: first='$nr_first' last='$nr_last' (json='$nr_json')"
    fi
fi

# ---------------------------------------------------------------------------
section "parse_qrsrq — per-antenna LTE + NR"

if [ -z "$jq_available" ]; then
    printf '  SKIP  parse_qrsrq (jq not available on workstation)\n'
else
    sample_qrsrq=$'+QRSRQ: -12,-13,-11,-14,LTE\n+QRSRQ: -10,-11,-9,-12,NR5G\nOK'

    result=$(
        set +eu
        qlog_warn() { :; }
        qlog_info() { :; }
        qlog_debug() { :; }
        qlog_error() { :; }
        . "$PARSE_AT"
        parse_qrsrq "$sample_qrsrq"
        printf '%s\n%s\n' "$sig_lte_rsrq" "$sig_nr_rsrq"
    )

    lte_json=$(printf '%s\n' "$result" | sed -n '1p')
    nr_json=$(printf '%s\n' "$result" | sed -n '2p')

    lte_first=$(printf '%s' "$lte_json" | jq '.[0]' 2>/dev/null)
    nr_first=$(printf '%s' "$nr_json" | jq '.[0]' 2>/dev/null)

    if [ "$lte_first" = "-12" ] && [ "$nr_first" = "-10" ]; then
        ok "parse_qrsrq populated LTE and NR JSON arrays"
    else
        bad "parse_qrsrq mismatch: lte_first='$lte_first' nr_first='$nr_first'"
    fi
fi

# ---------------------------------------------------------------------------
section "parse_qsinr — per-antenna LTE + NR"

if [ -z "$jq_available" ]; then
    printf '  SKIP  parse_qsinr (jq not available on workstation)\n'
else
    sample_qsinr=$'+QSINR: 11,12,10,9,LTE\n+QSINR: 15,14,16,13,NR5G\nOK'

    result=$(
        set +eu
        qlog_warn() { :; }
        qlog_info() { :; }
        qlog_debug() { :; }
        qlog_error() { :; }
        . "$PARSE_AT"
        parse_qsinr "$sample_qsinr"
        printf '%s\n%s\n' "$sig_lte_sinr" "$sig_nr_sinr"
    )

    lte_json=$(printf '%s\n' "$result" | sed -n '1p')
    nr_json=$(printf '%s\n' "$result" | sed -n '2p')

    lte_first=$(printf '%s' "$lte_json" | jq '.[0]' 2>/dev/null)
    nr_first=$(printf '%s' "$nr_json" | jq '.[0]' 2>/dev/null)

    if [ "$lte_first" = "11" ] && [ "$nr_first" = "15" ]; then
        ok "parse_qsinr populated LTE and NR JSON arrays"
    else
        bad "parse_qsinr mismatch: lte_first='$lte_first' nr_first='$nr_first'"
    fi
fi

# ---------------------------------------------------------------------------
section "parse_temperature — average across active sensors"

# Includes -273 (unavailable) and 0 (idle PA) sentinels that must be excluded.
# Active values: 30, 45, 60. Average = (30 + 45 + 60) / 3 = 45.
sample_qtemp=$'+QTEMP: "modem-tsens","-273"\n+QTEMP: "qfe_lb","30"\n+QTEMP: "tsens-pa","45"\n+QTEMP: "tsens-mmw","0"\n+QTEMP: "modem-cpu","60"\nOK'

result=$(
    set +eu
    qlog_warn() { :; }
    qlog_info() { :; }
    qlog_debug() { :; }
    qlog_error() { :; }
    . "$PARSE_AT"
    parse_temperature "$sample_qtemp"
    printf '%s' "$t2_temperature"
)

case "$result" in
    45) ok "parse_temperature averaged active sensors (excluding -273 and 0)" ;;
    *)  bad "parse_temperature mismatch: got '$result' (expected 45)" ;;
esac

# ---------------------------------------------------------------------------
printf '\n%d passed, %d failed' "$pass_count" "$fail_count"
if [ "$fail" -eq 0 ]; then
    printf ', ALL PASS\n'
    exit 0
else
    printf ', FAILURES\n'
    exit 1
fi
