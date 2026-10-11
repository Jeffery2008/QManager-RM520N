#!/bin/sh
. /usr/lib/qmanager/cgi_base.sh
# =============================================================================
# sites.sh — CGI Endpoint: Sites monitor (GET + POST)
# =============================================================================
# GET  ?range=1h|3h|6h|12h|24h|7d|30d|90d : latest result + history per site.
# POST {"action":"check_now"}             : raise the sweep flag for the daemon.
# POST {"action":"save","enabled":b,"interval_sec":n,"sites":[{"host","label"}]}
#
# Config : /etc/qmanager/sites.json      (this CGI writes; the daemon reads)
# State  : /tmp/qmanager_sites*.json|ndjson, /usrdata/qmanager/sites/*.jsonl
#          (all written by the root daemon qmanager_sites; read-only here)
# Flag   : /tmp/qmanager_sites_now       (created here as www-data)
#
# Endpoint: GET/POST /cgi-bin/quecmanager/monitoring/sites.sh
# =============================================================================

qlog_init "cgi_sites"
cgi_headers
cgi_handle_options

TMP_DIR="${QM_SITES_TMP_DIR:-/tmp}"
DATA_DIR="${QM_SITES_DATA_DIR:-/usrdata/qmanager/sites}"
CONF_FILE="${QM_SITES_CONF:-/etc/qmanager/sites.json}"

LATEST_FILE="$TMP_DIR/qmanager_sites.json"
RAW_FILE="$TMP_DIR/qmanager_sites_raw.ndjson"
FLUSHED_FILE="$TMP_DIR/qmanager_sites_flushed"
NOW_FLAG="$TMP_DIR/qmanager_sites_now"
CHECKING_FILE="$TMP_DIR/qmanager_sites_checking"

SANE_EPOCH=1700000000
DEFAULT_SITES="google.com facebook.com tiktok.com youtube.com roblox.com spotify.com x.com cellmapper.net reddit.com github.com discord.com instagram.com messenger.com"

# Conservative hostname / IPv4 check, no regex (device jq has none).
valid_host() {
    local h="$1"
    [ "${#h}" -ge 3 ] && [ "${#h}" -le 253 ] || return 1
    case "$h" in
        *[!A-Za-z0-9.-]*|-*|.*|*.|*-|*..*|*.-*|*-.*) return 1 ;;
        *.*) return 0 ;;
    esac
    return 1
}

reject_field() {
    jq -n --arg field "$1" --arg reason "$2" \
        '{success:false, error:"invalid_field", field:$field, reason:$reason}'
    exit 0
}

# Prints the effective config as compact JSON (defaults when absent/unreadable).
read_config() {
    local defaults cfg
    defaults=$(jq -cn --arg s "$DEFAULT_SITES" '$s | split(" ") | map({host: ., label: .})')
    cfg=""
    if [ -f "$CONF_FILE" ]; then
        cfg=$(jq -c --argjson d "$defaults" '
            {enabled: (if .enabled == false then false else true end),
             interval_sec: (.interval_sec | if type == "number"
                 then (floor | if . < 60 then 60 elif . > 3600 then 3600 else . end)
                 else 300 end),
             sites: (if has("sites") and (.sites | type == "array")
                 then [.sites[:32][] | select(type == "object" and (.host | type) == "string")
                       | {host: (.host | ascii_downcase),
                          label: (if (.label | type) == "string" and (.label | length) > 0
                                  then .label else .host end)}]
                 else $d end)}' "$CONF_FILE" 2>/dev/null)
    fi
    if [ -z "$cfg" ]; then
        cfg=$(jq -cn --argjson d "$defaults" '{enabled: true, interval_sec: 300, sites: $d}')
    fi
    printf '%s' "$cfg"
}

# yyyy-mm-dd -> yyyymmdd for numeric comparison (ash `[` has no string <).
daynum() {
    local y="${1%%-*}" r="${1#*-}"
    printf '%s%s%s' "$y" "${r%%-*}" "${r#*-}"
}

# =============================================================================
# GET
# =============================================================================
NUM='([0-9.]+|null)'
ROW_RE="^\{\"ts\":[0-9]+,\"host\":\"[A-Za-z0-9.-]+\",\"ms\":$NUM,\"ok\":(true|false)\}\$|^\{\"ts_hour\":[0-9]+,\"host\":\"[A-Za-z0-9.-]+\",\"n\":[0-9]+,\"ok\":[0-9]+,\"min\":$NUM,\"avg\":$NUM,\"max\":$NUM\}\$"

# awk does the per-row work (jq is far too slow on 28k rows): selects, buckets, one TSV line per
# host+bucket. The raw file streams first so rawfirst is known; FS splits both row shapes.
AWK_AGG='
function keep(raw, t) {
    if (raw) return rawmode ? (t >= start) : (t > flushed && t >= start)
    if (t + 3600 <= start) return 0
    return rawmode ? (rawfirst == "" || t + 3600 <= rawfirst) : 1
}
$2 == "ts" {
    t = $3 + 0
    if (rawfirst == "" || t < rawfirst) rawfirst = t
    if (!keep(1, t)) next
    n = 1; ok = ($9 == "true") ? 1 : 0
    mn = $7; mx = $7; sum = ($7 == "null") ? 0 : $7 + 0
    host = $5
}
$2 == "ts_hour" {
    t = $3 + 0
    if (!keep(0, t)) next
    n = $7 + 0; ok = $9 + 0; mn = $11; mx = $15
    sum = ($13 == "null") ? 0 : $13 * ok
    host = $5
}
$2 == "ts" || $2 == "ts_hour" {
    b = (bucket == 0) ? t : int(t / bucket) * bucket
    k = host SUBSEP b
    if (!(k in N)) { H[k] = host; B[k] = b }
    N[k] += n; OK[k] += ok; SUM[k] += sum
    if (mn != "null") { v = mn + 0; if (!(k in MN) || v < MN[k]) MN[k] = v }
    if (mx != "null") { v = mx + 0; if (!(k in MX) || v > MX[k]) MX[k] = v }
}
END {
    for (k in N)
        printf "%s\t%d\t%d\t%d\t%.3f\t%s\t%s\n", H[k], B[k], N[k], OK[k], SUM[k],
            (k in MN) ? MN[k] : "null", (k in MX) ? MX[k] : "null"
}
'

JQ_GET='
def r1: (. * 10 | round) / 10;
def nul: if . == "null" then null else tonumber end;

[inputs | split("\t")
 | {host: .[0], ts: (.[1] | tonumber), n: (.[2] | tonumber), ok: (.[3] | tonumber),
    sum: (.[4] | tonumber), min: (.[5] | nul), max: (.[6] | nul)}] as $all
| ($all | group_by(.host) | map({key: .[0].host, value: .}) | from_entries) as $byhost
| ($cfg.sites) as $cs
| ($latest.results // []) as $lr
| ([$lr[] | select(.kind == "gateway" or (.host as $h | $cs | any(.host == $h)))]
   + [$cs[] | .host as $h | select($lr | any(.host == $h) | not) | {host: $h, kind: "site", ms: null, ok: false, ts: null, absent: true}]) as $list
| [$list[] | . as $e
   | ($cs | map(select(.host == $e.host)) | .[0].label) as $cl
   | {host: $e.host,
      label: ($cl // (if $e.kind == "gateway" then "Gateway" else $e.host end)),
      kind: $e.kind,
      latest: (if $e.absent then null else {ts: $e.ts, ms: $e.ms, ok: $e.ok, wan: "cellular"} end),
      series: (($byhost[$e.host] // [])
        | map({ts, ms: (if .ok > 0 then ((.sum / .ok) | r1) else null end), min, max, n, ok})
        | sort_by(.ts))}] as $sites
| {success: true,
   enabled: $cfg.enabled,
   interval_sec: $cfg.interval_sec,
   checked_at: ($latest.checked_at // null),
   next_check_at: (if $cfg.enabled then ($latest.next_check_at // null) else null end),
   checking: $checking,
   wans: ["cellular"],
   summary: {answered: ([$sites[] | select(.latest != null and .latest.ok)] | length), total: ($sites | length)},
   sites: $sites}
'

handle_get() {
    local query range span bucket rawmode now start cfg latest checking flushed
    local startday startnum f name num files

    query="$QUERY_STRING"
    range=24h
    case "&$query" in
        *"&range="*) range="${query#*range=}"; range="${range%%&*}" ;;
    esac
    case "$range" in
        1h)  span=3600;    bucket=0 ;;
        3h)  span=10800;   bucket=0 ;;
        6h)  span=21600;   bucket=0 ;;
        12h) span=43200;   bucket=600 ;;
        24h) span=86400;   bucket=1200 ;;
        7d)  span=604800;  bucket=7200 ;;
        30d) span=2592000; bucket=28800 ;;
        90d) span=7776000; bucket=86400 ;;
        *) cgi_error "invalid_range" "range must be 1h, 3h, 6h, 12h, 24h, 7d, 30d or 90d"; exit 0 ;;
    esac
    rawmode=false
    [ "$span" -le 86400 ] && rawmode=true

    now=$(date +%s)
    if [ "$now" -lt "$SANE_EPOCH" ]; then
        start=0
    else
        start=$((now - span))
    fi

    cfg=$(read_config)
    latest=$(jq -c . "$LATEST_FILE" 2>/dev/null)
    case "$latest" in '{'*) ;; *) latest=null ;; esac
    checking=false
    { [ -e "$CHECKING_FILE" ] || [ -e "$NOW_FLAG" ]; } && checking=true
    flushed=$(cat "$FLUSHED_FILE" 2>/dev/null)
    case "$flushed" in ''|*[!0-9]*) flushed=0 ;; esac

    files="/dev/null"
    if [ "$start" -gt 0 ]; then
        [ -f "$RAW_FILE" ] && files="$files $RAW_FILE"
        startday=$(date -u -d "@$start" +%Y-%m-%d 2>/dev/null)
        startnum=$(daynum "$startday")
        for f in "$DATA_DIR"/*.jsonl; do
            [ -f "$f" ] || continue
            name="${f##*/}"; name="${name%.jsonl}"
            num=$(daynum "$name")
            case "$num" in ''|*[!0-9]*) continue ;; esac
            [ "$num" -ge "$startnum" ] && files="$files $f"
        done
    fi

    # grep keeps only well-formed rows (torn lines never reach awk); awk
    # aggregates; one small jq pass assembles the response.
    local rawflag=0
    [ "$rawmode" = "true" ] && rawflag=1
    # shellcheck disable=SC2086
    grep -hE "$ROW_RE" $files 2>/dev/null \
        | awk -F'[{}",:]+' -v rawmode="$rawflag" -v start="$start" -v bucket="$bucket" \
            -v flushed="$flushed" "$AWK_AGG" \
        | jq -nR \
            --argjson cfg "$cfg" --argjson latest "$latest" \
            --argjson checking "$checking" \
            "$JQ_GET"
}

# =============================================================================
# POST
# =============================================================================
handle_check_now() {
    local cfg
    cfg=$(read_config)
    if [ "$(printf '%s' "$cfg" | jq -r '.enabled')" != "true" ]; then
        cgi_error "disabled" "Sites monitor is turned off"
        return
    fi
    if : > "$NOW_FLAG" 2>/dev/null; then
        cgi_success
    else
        cgi_error "flag_failed" "Could not request a check"
    fi
}

handle_save() {
    local enabled interval nsites hosts nlines h lines new tmp

    enabled=$(printf '%s' "$POST_DATA" | jq -r '.enabled | if type == "boolean" then tostring else "invalid" end' 2>/dev/null)
    case "$enabled" in true|false) ;; *) reject_field "enabled" "must be true or false" ;; esac

    interval=$(printf '%s' "$POST_DATA" | jq -r '.interval_sec
        | if type == "number" then (floor | if . < 60 then 60 elif . > 3600 then 3600 else . end | tostring)
          else "invalid" end' 2>/dev/null)
    case "$interval" in ''|invalid|*[!0-9]*) reject_field "interval_sec" "must be a number of seconds" ;; esac

    nsites=$(printf '%s' "$POST_DATA" | jq -r '.sites | if type == "array" then length | tostring else "invalid" end' 2>/dev/null)
    case "$nsites" in ''|invalid|*[!0-9]*) reject_field "sites" "must be a list" ;; esac
    [ "$nsites" -le 32 ] || reject_field "sites" "at most 32 sites"

    hosts=""
    nlines=0
    if [ "$nsites" -gt 0 ]; then
        lines=$(printf '%s' "$POST_DATA" | jq -r '.sites[]
            | if type == "object" and (.host | type) == "string" then (.host | ascii_downcase) else "" end')
        while IFS= read -r h; do
            nlines=$((nlines + 1))
            valid_host "$h" || reject_field "sites" "invalid host"
            hosts="$hosts $h"
        done <<EOF
$lines
EOF
        [ "$nlines" -eq "$nsites" ] || reject_field "sites" "invalid host"
    fi

    new=$(printf '%s' "$POST_DATA" | jq -c --argjson en "$enabled" --argjson iv "$interval" '
        {enabled: $en, interval_sec: $iv,
         sites: ([.sites[] | (.host | ascii_downcase) as $h
                  | {host: $h,
                     label: (((.label | if type == "string" then . else "" end)
                              | explode | map(select(. >= 32 and . != 127)) | implode | .[:40])
                             | if . == "" then $h else . end)}]
                 | reduce .[] as $s ([]; if any(.[]; .host == $s.host) then . else . + [$s] end))}') || {
        cgi_error "save_failed" "Could not build the configuration"
        return
    }

    tmp=$(mktemp "${CONF_FILE}.XXXXXX" 2>/dev/null) || {
        qlog_error "mktemp in $(dirname "$CONF_FILE") failed"
        cgi_error "save_failed" "Could not write the configuration"
        return
    }
    if printf '%s\n' "$new" > "$tmp" && chmod 0644 "$tmp" && mv -f "$tmp" "$CONF_FILE"; then
        [ "$enabled" = "true" ] && : > "$NOW_FLAG" 2>/dev/null
        qlog_info "Saved sites config ($nsites sites, enabled=$enabled)"
        printf '%s' "$new" | jq '{success: true} + .'
    else
        rm -f "$tmp"
        cgi_error "save_failed" "Could not write the configuration"
    fi
}

case "$REQUEST_METHOD" in
    GET)
        handle_get
        ;;
    POST)
        ACTION=""
        case "&$QUERY_STRING" in
            *"&action="*) ACTION="${QUERY_STRING#*action=}"; ACTION="${ACTION%%&*}" ;;
        esac
        if [ -z "$ACTION" ]; then
            cgi_read_post
            ACTION=$(printf '%s' "$POST_DATA" | jq -r '.action // empty' 2>/dev/null)
        fi
        case "$ACTION" in
            check_now) handle_check_now ;;
            save)
                [ -n "$POST_DATA" ] || cgi_read_post
                handle_save
                ;;
            *) cgi_error "invalid_action" "Unknown action" ;;
        esac
        ;;
    *)
        cgi_method_not_allowed
        ;;
esac
exit 0
