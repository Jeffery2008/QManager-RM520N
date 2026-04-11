#!/bin/sh
. /usr/lib/qmanager/cgi_base.sh
. /usr/lib/qmanager/config.sh
# =============================================================================
# update.sh — CGI Endpoint: Software Update (GET + POST)
# =============================================================================
# GET:                   Check for updates via GitHub Releases API
# GET action=status:     Read update progress from status file
# POST action=download:  Stage a version (download + SHA-256 verify)
# POST action=install_staged: Install the staged tarball
# POST action=install:   Legacy one-step install (used by auto-updater)
# POST action=save_prerelease: Toggle pre-release preference
# POST action=save_auto_update: Configure auto-update schedule
#
# Config: UCI quecmanager.update.*
# State:  /tmp/qmanager_update.json, /tmp/qmanager_update.pid
#         /tmp/qmanager_staged.tar.gz, /tmp/qmanager_staged_version
#
# Endpoint: GET/POST /cgi-bin/quecmanager/system/update.sh
# =============================================================================

qlog_init "cgi_system_update"
cgi_headers
cgi_handle_options

# --- Configuration -----------------------------------------------------------

GITHUB_REPO="Jeffery2008/QManager-RM520N"
VERSION_FILE="/etc/qmanager/VERSION"
UPDATES_DIR="/etc/qmanager/updates"
STATUS_FILE="/tmp/qmanager_update.json"
PID_FILE="/tmp/qmanager_update.pid"
UPDATER="/usr/bin/qmanager_update"

# --- Helpers -----------------------------------------------------------------

get_current_version() {
    if [ -f "$VERSION_FILE" ]; then
        tr -d '[:space:]' < "$VERSION_FILE"
    else
        echo "0.0.0"
    fi
}

uci_update_get() {
    qm_config_get update "$1" "$2"
}

ensure_update_config() {
    qm_config_init
}

strip_leading_zero() {
    local v
    v=$(echo "$1" | sed 's/^0*//')
    [ -z "$v" ] && v=0
    echo "$v"
}

# Check if an update process is already running
check_lock() {
    if [ -f "$PID_FILE" ]; then
        local pid
        pid=$(cat "$PID_FILE" 2>/dev/null)
        if pid_alive "$pid"; then
            cgi_error "update_in_progress" "An update is already in progress"
            exit 0
        fi
        rm -f "$PID_FILE"
    fi
}

# Fetch URL to a file, capturing HTTP headers for rate-limit detection.
# curl first — BusyBox wget on RM520N-GL lacks TLS support for HTTPS URLs.
http_api_fetch() {
    local url="$1" out_file="$2" header_file="$3" timeout="${4:-15}"

    # curl — supports HTTPS, -D captures response headers
    if command -v curl >/dev/null 2>&1; then
        curl -sL --max-time "$timeout" -o "$out_file" -D "$header_file" "$url" && return 0
    fi

    # wget (full wget-ssl supports -S; BusyBox wget may not handle HTTPS)
    if command -v wget >/dev/null 2>&1; then
        wget -qO "$out_file" -T "$timeout" -S "$url" 2>"$header_file" && return 0
    fi

    # uclient-fetch — OpenWRT only
    if command -v uclient-fetch >/dev/null 2>&1; then
        uclient-fetch -qO "$out_file" --timeout="$timeout" "$url" 2>"$header_file" && return 0
    fi

    return 1
}

# Semver comparison. Exit codes: 0 = $1 newer, 1 = same, 2 = $1 older
semver_compare() {
    local a="$1" b="$2"
    a="${a#v}"; b="${b#v}"
    local a_ver="${a%%-*}" a_pre="" b_ver="${b%%-*}" b_pre=""
    case "$a" in *-*) a_pre="${a#*-}" ;; esac
    case "$b" in *-*) b_pre="${b#*-}" ;; esac

    local a1 a2 a3 b1 b2 b3
    IFS='.' read a1 a2 a3 <<EOF
$a_ver
EOF
    IFS='.' read b1 b2 b3 <<EOF
$b_ver
EOF
    a1=${a1:-0}; a2=${a2:-0}; a3=${a3:-0}
    b1=${b1:-0}; b2=${b2:-0}; b3=${b3:-0}

    [ "$a1" -gt "$b1" ] 2>/dev/null && return 0
    [ "$a1" -lt "$b1" ] 2>/dev/null && return 2
    [ "$a2" -gt "$b2" ] 2>/dev/null && return 0
    [ "$a2" -lt "$b2" ] 2>/dev/null && return 2
    [ "$a3" -gt "$b3" ] 2>/dev/null && return 0
    [ "$a3" -lt "$b3" ] 2>/dev/null && return 2

    # Localized fork revision scheme:
    #   v0.1.5-cn.1 < v0.1.5-cn.2 and both are newer than plain v0.1.5
    local a_cn="" b_cn=""
    case "$a_pre" in cn.*) a_cn="${a_pre#cn.}" ;; esac
    case "$b_pre" in cn.*) b_cn="${b_pre#cn.}" ;; esac

    if [ -n "$a_cn" ] || [ -n "$b_cn" ]; then
        a_cn=${a_cn:-0}
        b_cn=${b_cn:-0}
        [ "$a_cn" -gt "$b_cn" ] 2>/dev/null && return 0
        [ "$a_cn" -lt "$b_cn" ] 2>/dev/null && return 2
        return 1
    fi

    # Equal major.minor.patch — no pre-release > any pre-release
    [ -z "$a_pre" ] && [ -n "$b_pre" ] && return 0
    [ -n "$a_pre" ] && [ -z "$b_pre" ] && return 2
    [ -z "$a_pre" ] && [ -z "$b_pre" ] && return 1

    # Both have pre-release — lexical comparison (POSIX: sort, no \> \< in [ ])
    if [ "$a_pre" != "$b_pre" ]; then
        _lesser=$(printf '%s\n%s\n' "$a_pre" "$b_pre" | sort | head -1)
        if [ "$_lesser" = "$a_pre" ]; then
            return 2  # a_pre is lexically lesser → a is older
        else
            return 0  # b_pre is lexically lesser → a is newer
        fi
    fi
    return 1
}

# =============================================================================
# GET — Check for updates / Read status
# =============================================================================
if [ "$REQUEST_METHOD" = "GET" ]; then
    action=$(echo "$QUERY_STRING" | sed -n 's/.*action=\([^&]*\).*/\1/p')

    # --- Status polling ---
    if [ "$action" = "status" ]; then
        if [ -f "$STATUS_FILE" ]; then
            cat "$STATUS_FILE"
        else
            jq -n '{"status":"idle"}'
        fi
        exit 0
    fi

    # --- Update check ---
    qlog_info "Checking for updates"
    ensure_update_config

    current_version=$(get_current_version)
    include_prerelease=$(uci_update_get include_prerelease "1")
    auto_enabled=$(uci_update_get auto_update_enabled "0")
    auto_time=$(uci_update_get auto_update_time "03:00")

    # Query GitHub Releases API with header capture for rate-limit detection
    api_url="https://api.github.com/repos/$GITHUB_REPO/releases"
    tmp_body="/tmp/qm_update_api_body.json"
    tmp_headers="/tmp/qm_update_api_headers.txt"
    rm -f "$tmp_body" "$tmp_headers"

    if ! http_api_fetch "$api_url" "$tmp_body" "$tmp_headers"; then
        rm -f "$tmp_body" "$tmp_headers"
        jq -n \
            --arg cv "$current_version" \
            --argjson prerelease "$include_prerelease" \
            --arg auto_en "$auto_enabled" \
            --arg auto_time "$auto_time" \
            '{
                success: true, current_version: $cv,
                latest_version: null, update_available: false,
                changelog: null, current_changelog: null,
                download_url: null, download_size: null,
                available_versions: [], download_state: null,
                include_prerelease: ($prerelease == 1),
                auto_update_enabled: ($auto_en == "1"),
                auto_update_time: $auto_time,
                check_error: "Unable to check for updates. Check your internet connection."
            }'
        exit 0
    fi

    # Check for rate limiting (HTTP 403)
    if grep -qi "403 Forbidden\|HTTP/[0-9.]* 403" "$tmp_headers" 2>/dev/null; then
        # Try to parse reset time
        reset_ts=$(grep -i 'x-ratelimit-reset' "$tmp_headers" | sed 's/.*: *//;s/\r//' | head -1)
        wait_msg="Rate limit reached. Try again later."
        if [ -n "$reset_ts" ]; then
            now_ts=$(date +%s 2>/dev/null)
            if [ -n "$now_ts" ] && [ -n "$reset_ts" ] && [ "$reset_ts" -gt "$now_ts" ] 2>/dev/null; then
                wait_mins=$(( (reset_ts - now_ts + 59) / 60 ))
                wait_msg="Rate limit reached. Try again in ${wait_mins} minute(s)."
            fi
        fi
        rm -f "$tmp_body" "$tmp_headers"
        jq -n \
            --arg cv "$current_version" \
            --argjson prerelease "$include_prerelease" \
            --arg err "$wait_msg" \
            --arg auto_en "$auto_enabled" \
            --arg auto_time "$auto_time" \
            '{
                success: true, current_version: $cv,
                latest_version: null, update_available: false,
                changelog: null, current_changelog: null,
                download_url: null, download_size: null,
                available_versions: [], download_state: null,
                include_prerelease: ($prerelease == 1),
                auto_update_enabled: ($auto_en == "1"),
                auto_update_time: $auto_time,
                check_error: $err
            }'
        exit 0
    fi

    api_response=$(cat "$tmp_body" 2>/dev/null)
    rm -f "$tmp_body" "$tmp_headers"

    # Filter by pre-release preference
    if [ "$include_prerelease" = "1" ]; then
        release_filter='.[0]'
    else
        release_filter='[ .[] | select(.prerelease == false) ] | .[0]'
    fi

    # Extract release info
    latest_tag=$(echo "$api_response" | jq -r "$release_filter | .tag_name // empty")
    changelog=$(echo "$api_response" | jq -r "$release_filter | .body // empty")

    # Extract current version's changelog from the same API response
    current_changelog=""
    if [ -n "$current_version" ] && [ "$current_version" != "0.0.0" ]; then
        current_changelog=$(echo "$api_response" | jq -r \
            --arg cv "$current_version" \
            '[ .[] | select(.tag_name == $cv) ] | .[0].body // empty')
    fi

    # Detect staged download state
    download_state="null"
    staged_tarball="/tmp/qmanager_staged.tar.gz"
    staged_version_file="/tmp/qmanager_staged_version"

    if [ -f "$PID_FILE" ]; then
        pid=$(cat "$PID_FILE" 2>/dev/null)
        if pid_alive "$pid" && [ -f "$STATUS_FILE" ]; then
            download_state=$(cat "$STATUS_FILE" 2>/dev/null)
        fi
    elif [ -f "$staged_tarball" ] && [ -f "$staged_version_file" ]; then
        staged_ver=$(cat "$staged_version_file" 2>/dev/null)
        staged_size=$(du -k "$staged_tarball" 2>/dev/null | awk '{printf "%.1f MB", $1/1024}')
        download_state=$(jq -n \
            --arg status "ready" \
            --arg version "$staged_ver" \
            --arg message "Download verified ($staged_size)" \
            --arg size "$staged_size" \
            '{status: $status, version: $version, message: $message, size: $size}')
    fi

    # Build available_versions list from API response
    available_versions=$(echo "$api_response" | jq \
        --arg cv "$current_version" \
        '[ .[] | {
            tag: .tag_name,
            has_assets: ((.assets | length) > 0),
            asset_size: (if (.assets | length) > 0 then
                (.assets[0].size / 1048576 * 10 | floor / 10 | tostring + " MB")
            else null end),
            is_current: (.tag_name == $cv)
        }]')

    # Download URL from GitHub Releases (stable, redirect handled by uclient-fetch/curl)
    download_url=""
    if [ -n "$latest_tag" ]; then
        download_url="https://github.com/${GITHUB_REPO}/releases/download/${latest_tag}/qmanager.tar.gz"
    fi
    download_size=""

    update_available="false"
    if [ -n "$latest_tag" ]; then
        semver_compare "$latest_tag" "$current_version"
        case $? in
            0) update_available="true" ;;
        esac
    fi

    jq -n \
        --arg cv "$current_version" \
        --arg lv "${latest_tag:-}" \
        --argjson ua "$update_available" \
        --arg cl "$changelog" \
        --arg ccl "$current_changelog" \
        --arg dl "${download_url:-}" \
        --arg ds "$download_size" \
        --argjson av "$available_versions" \
        --argjson ds_obj "$download_state" \
        --argjson prerelease "$include_prerelease" \
        --arg auto_en "$auto_enabled" \
        --arg auto_time "$auto_time" \
        '{
            success: true,
            current_version: $cv,
            latest_version: (if $lv == "" then null else $lv end),
            update_available: $ua,
            changelog: (if $cl == "" then null else $cl end),
            current_changelog: (if $ccl == "" then null else $ccl end),
            download_url: (if $dl == "" then null else $dl end),
            download_size: (if $ds == "" then null else $ds end),
            available_versions: $av,
            download_state: $ds_obj,
            include_prerelease: ($prerelease == 1),
            auto_update_enabled: ($auto_en == "1"),
            auto_update_time: $auto_time,
            check_error: null
        }'
    exit 0
fi

# =============================================================================
# POST — Install / Rollback / Save preferences
# =============================================================================
if [ "$REQUEST_METHOD" = "POST" ]; then
    cgi_read_post

    ACTION=$(printf '%s' "$POST_DATA" | jq -r '.action // empty')
    if [ -z "$ACTION" ]; then
        cgi_error "missing_action" "action field is required"
        exit 0
    fi

    # --- Save pre-release preference ---
    if [ "$ACTION" = "save_prerelease" ]; then
        ensure_update_config
        enabled=$(printf '%s' "$POST_DATA" | jq -r '(.enabled) | if . == null then empty else tostring end')
        case "$enabled" in
            true)  qm_config_set update include_prerelease 1 ;;
            false) qm_config_set update include_prerelease 0 ;;
            *) cgi_error "invalid_value" "enabled must be true or false"; exit 0 ;;
        esac
        cgi_success
        exit 0
    fi

    # --- Save auto-update preference ---
    if [ "$ACTION" = "save_auto_update" ]; then
        ensure_update_config
        enabled=$(printf '%s' "$POST_DATA" | jq -r '(.enabled) | if . == null then empty else tostring end')
        auto_time=$(printf '%s' "$POST_DATA" | jq -r '.time // empty')

        case "$enabled" in
            true|false) ;;
            *) cgi_error "invalid_value" "enabled must be true or false"; exit 0 ;;
        esac
        echo "$auto_time" | grep -qE '^[0-9]{2}:[0-9]{2}$' || {
            cgi_error "invalid_value" "time must be HH:MM format"; exit 0
        }

        case "$enabled" in
            true)  qm_config_set update auto_update_enabled 1 ;;
            false) qm_config_set update auto_update_enabled 0 ;;
        esac
        qm_config_set update auto_update_time "$auto_time"

        # Manage crontab (write directly to root's crontab file)
        CRON_MARKER="# qmanager_auto_update"
        AUTO_UPDATE_SCRIPT="/usr/bin/qmanager_auto_update"
        CRON_FILE="/var/spool/cron/crontabs/root"
        current_cron=$(cat "$CRON_FILE" 2>/dev/null || true)
        filtered_cron=$(printf '%s\n' "$current_cron" | grep -v "$CRON_MARKER")

        if [ "$enabled" = "true" ]; then
            sched_hour=$(printf '%s' "$auto_time" | cut -d: -f1)
            sched_min=$(printf '%s' "$auto_time" | cut -d: -f2)
            sched_hour=$(strip_leading_zero "$sched_hour")
            sched_min=$(strip_leading_zero "$sched_min")

            new_cron=$(printf '%s\n%s %s * * * %s  %s' \
                "$filtered_cron" "$sched_min" "$sched_hour" "$AUTO_UPDATE_SCRIPT" "$CRON_MARKER")
            printf '%s\n' "$new_cron" > "$CRON_FILE"
        else
            if [ -z "$(printf '%s' "$filtered_cron" | tr -d '[:space:]')" ]; then
                rm -f "$CRON_FILE"
            else
                printf '%s\n' "$filtered_cron" > "$CRON_FILE"
            fi
        fi

        cgi_success
        exit 0
    fi

    # --- Download update (stage without installing) ---
    if [ "$ACTION" = "download" ]; then
        check_lock

        version=$(printf '%s' "$POST_DATA" | jq -r '.version // empty')
        if [ -z "$version" ]; then
            cgi_error "missing_version" "version is required"; exit 0
        fi

        download_url="https://github.com/${GITHUB_REPO}/releases/download/${version}/qmanager.tar.gz"
        checksum_url="https://github.com/${GITHUB_REPO}/releases/download/${version}/sha256sum.txt"

        jq -n '{"success":true,"status":"starting"}'
        ( "$UPDATER" download "$download_url" "$checksum_url" "$version" </dev/null >>/tmp/qmanager_update.log 2>&1 & )
        exit 0
    fi

    # --- Install staged tarball ---
    if [ "$ACTION" = "install_staged" ]; then
        check_lock

        if [ ! -f "/tmp/qmanager_staged.tar.gz" ]; then
            cgi_error "no_staged" "No staged download found. Download first."
            exit 0
        fi

        jq -n '{"success":true,"status":"starting"}'
        ( "$UPDATER" install_staged </dev/null >>/tmp/qmanager_update.log 2>&1 & )
        exit 0
    fi

    # --- Install update ---
    if [ "$ACTION" = "install" ]; then
        check_lock

        download_url=$(printf '%s' "$POST_DATA" | jq -r '.download_url // empty')
        version=$(printf '%s' "$POST_DATA" | jq -r '.version // empty')
        download_size=$(printf '%s' "$POST_DATA" | jq -r '.download_size // empty')

        if [ -z "$download_url" ]; then
            cgi_error "missing_url" "download_url is required"; exit 0
        fi

        # Respond immediately, spawn background updater (double-fork)
        jq -n '{"success":true,"status":"starting"}'
        ( "$UPDATER" install "$download_url" "$version" "$download_size" </dev/null >>/tmp/qmanager_update.log 2>&1 & )
        exit 0
    fi

    # --- Rollback ---
    if [ "$ACTION" = "rollback" ]; then
        check_lock

        if [ ! -f "$UPDATES_DIR/previous_version" ]; then
            cgi_error "no_rollback" "No previous version available for rollback"
            exit 0
        fi

        rollback_version=$(cat "$UPDATES_DIR/previous_version" 2>/dev/null)
        rollback_url="https://github.com/${GITHUB_REPO}/releases/download/${rollback_version}/qmanager.tar.gz"
        jq -n --arg v "$rollback_version" '{"success":true,"status":"starting","version":$v}'
        ( "$UPDATER" rollback "$rollback_url" "$rollback_version" </dev/null >>/tmp/qmanager_update.log 2>&1 & )
        exit 0
    fi

    cgi_error "unknown_action" "Unknown action: $ACTION"
    exit 0
fi

cgi_method_not_allowed
