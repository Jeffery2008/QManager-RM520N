# semver.sh — Shared semantic version comparison library
# Usage: semver_compare <a> <b>
# Exit codes: 0 = a is newer, 1 = same version, 2 = a is older
# Example: semver_compare v1.2.0 v1.1.9 && echo "upgrade available"
[ -n "${_QM_SEMVER_LOADED:-}" ] && return 0; _QM_SEMVER_LOADED=1

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
