#!/bin/sh
# check-crlf.sh — Dev utility: detect and optionally fix CRLF line endings
# Usage:
#   check-crlf.sh <file> [<file2> ...]   — report CRLF status for each file
#   check-crlf.sh --fix <file> [...]     — convert CRLF -> LF in-place (requires sed or tr)
#   check-crlf.sh --scan                 — scan all shell scripts in scripts/ dir
#
# Exit codes:
#   0 = all files are LF-only
#   1 = one or more files have CRLF (or errors)

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FIX=0
SCAN=0
FILES=""
ERRORS=0

usage() {
    printf 'Usage: %s [--fix] [--scan] [file ...]\n' "$0"
    printf '  --fix   Convert CRLF to LF in-place\n'
    printf '  --scan  Scan all shell scripts under scripts/\n'
    exit 1
}

# Parse arguments
while [ $# -gt 0 ]; do
    case "$1" in
        --fix)  FIX=1 ;;
        --scan) SCAN=1 ;;
        --help|-h) usage ;;
        -*)     printf 'Unknown option: %s\n' "$1" >&2; usage ;;
        *)      FILES="$FILES $1" ;;
    esac
    shift
done

check_file() {
    local f="$1"
    if [ ! -f "$f" ]; then
        printf 'ERROR: not a file: %s\n' "$f" >&2
        ERRORS=1
        return
    fi

    # Count CR bytes — works with BusyBox tr + wc, and GNU tr + wc
    local cr_count
    cr_count=$(tr -cd '\r' < "$f" | wc -c)

    if [ "$cr_count" -eq 0 ]; then
        printf 'OK   (LF)   %s\n' "$f"
    else
        printf 'CRLF [%d CR bytes]  %s\n' "$cr_count" "$f"
        ERRORS=1
        if [ "$FIX" -eq 1 ]; then
            # sed -i is not available everywhere; use tr + temp file pattern
            local tmp="${f}.crlf_tmp"
            tr -d '\r' < "$f" > "$tmp" && mv "$tmp" "$f"
            if [ $? -eq 0 ]; then
                printf '  -> Fixed: CR bytes removed\n'
            else
                printf '  -> Fix FAILED for %s\n' "$f" >&2
                rm -f "$tmp"
            fi
        fi
    fi
}

if [ "$SCAN" -eq 1 ]; then
    # Find all shell scripts in scripts/ — files with .sh extension or #!/bin/sh shebang
    printf '=== Scanning %s/scripts/ ===\n' "$SCRIPT_DIR"
    find "$SCRIPT_DIR/scripts" -type f | while read -r f; do
        case "$f" in
            *.sh) check_file "$f" ;;
            *)
                # Check for shell shebang in first line
                head -1 "$f" 2>/dev/null | grep -q '#!/bin/sh' && check_file "$f"
                ;;
        esac
    done
fi

# Process explicitly named files
for f in $FILES; do
    check_file "$f"
done

if [ "$SCAN" -eq 0 ] && [ -z "$FILES" ]; then
    usage
fi

exit $ERRORS
