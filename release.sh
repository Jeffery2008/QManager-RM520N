#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$ROOT_DIR/qmanager-build"
ARCHIVE="$BUILD_DIR/qmanager.tar.gz"
CHECKSUM="$BUILD_DIR/sha256sum.txt"

# Colors
if [ -t 1 ]; then
  GREEN='\033[0;32m' BOLD='\033[1m' RED='\033[0;31m' YELLOW='\033[1;33m' CYAN='\033[0;36m' NC='\033[0m'
else
  GREEN='' BOLD='' RED='' YELLOW='' CYAN='' NC=''
fi

step()    { printf "\n${CYAN}==>${NC} ${BOLD}%s${NC}\n" "$1"; }
info()    { printf "  ${GREEN}✓${NC} %s\n" "$1"; }
warn()    { printf "  ${YELLOW}!${NC} %s\n" "$1"; }
fail()    { printf "  ${RED}✗${NC} %s\n" "$1"; exit 1; }

# =============================================================================
# Step 1: Pre-flight checks
# =============================================================================
step "Pre-flight checks"

command -v gh >/dev/null 2>&1 || fail "gh CLI not found — install from https://cli.github.com"
gh auth status >/dev/null 2>&1 || fail "gh CLI not authenticated — run 'gh auth login'"
info "gh CLI authenticated"

[ -z "$(git status --porcelain)" ] || fail "Working tree is dirty — commit or stash changes first"
info "Working tree clean"

current_branch=$(git branch --show-current)
[ "$current_branch" = "development-home" ] || fail "Not on development-home branch (on: $current_branch)"
info "On development-home branch"

current_version=$(node -p "require('./package.json').version")
info "Current version: $current_version"

# =============================================================================
# Step 2: Version prompt
# =============================================================================
step "Version bump"

# Parse current version (strip leading v)
ver="${current_version#v}"
IFS='.' read -r major minor patch <<EOF
$ver
EOF

patch_ver="v${major}.${minor}.$(( patch + 1 ))"
minor_ver="v${major}.$(( minor + 1 )).0"

printf "  Current version: ${BOLD}%s${NC}\n" "$current_version"
printf "\n"
printf "  ${BOLD}[p]${NC}atch  → %s\n" "$patch_ver"
printf "  ${BOLD}[m]${NC}inor  → %s\n" "$minor_ver"
printf "  ${BOLD}[c]${NC}ustom → type a version\n"
printf "\n"
printf "  Select [p/m/c]: "
read -r bump_type

case "$bump_type" in
  p|P|patch) new_version="$patch_ver" ;;
  m|M|minor) new_version="$minor_ver" ;;
  c|C|custom)
    printf "  Enter version (e.g., v0.2.0): "
    read -r new_version
    # Ensure v prefix
    case "$new_version" in v*) ;; *) new_version="v$new_version" ;; esac
    ;;
  *) fail "Invalid selection: $bump_type" ;;
esac

printf "\n  Release ${BOLD}%s${NC} → ${GREEN}${BOLD}%s${NC}? [y/N] " "$current_version" "$new_version"
read -r confirm
case "$confirm" in y|Y|yes|YES) ;; *) printf "\n  Aborted.\n"; exit 0 ;; esac

# =============================================================================
# Step 3: Version bump in files
# =============================================================================
step "Bumping version to $new_version"

# package.json
sed -i "s/\"version\": \"${current_version}\"/\"version\": \"${new_version}\"/" "$ROOT_DIR/package.json"
info "Updated package.json"

# scripts/install.sh — VERSION="vX.Y.Z"
sed -i "s/^VERSION=\"v[0-9]*\.[0-9]*\.[0-9]*[^\"]*\"/VERSION=\"${new_version}\"/" "$ROOT_DIR/scripts/install.sh"
info "Updated scripts/install.sh"

# =============================================================================
# Step 4: Build
# =============================================================================
step "Building"

bun --bun next build
info "Frontend build complete"

bash "$ROOT_DIR/build.sh"
info "Package complete"

# Generate SHA256 checksum
cd "$BUILD_DIR"
sha256sum qmanager.tar.gz > sha256sum.txt
cd "$ROOT_DIR"
info "Generated sha256sum.txt"

sha_value=$(awk '{print $1}' "$CHECKSUM")
archive_size=$(du -h "$ARCHIVE" | cut -f1)
printf "  Archive: %s (%s)\n" "$archive_size" "${sha_value:0:16}..."

# =============================================================================
# Step 5: Release notes
# =============================================================================
step "Generating release notes"

last_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -z "$last_tag" ]; then
  commit_range="HEAD"
else
  commit_range="${last_tag}..HEAD"
fi

RELEASE_FILE="$ROOT_DIR/RELEASE-${new_version}.md"

# Collect commits grouped by type
feats=""
fixes=""
others=""

while IFS= read -r line; do
  case "$line" in
    feat*) feats="${feats}- ${line}
" ;;
    fix*)  fixes="${fixes}- ${line}
" ;;
    *)     others="${others}- ${line}
" ;;
  esac
done <<EOF
$(git log "$commit_range" --oneline --no-decorate 2>/dev/null)
EOF

cat > "$RELEASE_FILE" <<NOTES
# QManager ${new_version}

---

## What's New

${feats:-_No new features in this release._}

## Bug Fixes

${fixes:-_No bug fixes in this release._}

## Other Changes

${others:-_No other changes._}

---

## Installation

### Fresh Install

\`\`\`sh
wget -O /tmp/qmanager-installer.sh \\
  https://github.com/dr-dolomite/QManager/raw/refs/heads/development-home/qmanager-installer.sh && \\
  sh /tmp/qmanager-installer.sh
\`\`\`

### Upgrading

Head to **System Settings → Software Update** and hit "Check for Updates" — or re-run the installer command above.
NOTES

info "Generated $RELEASE_FILE"
printf "\n"
printf "  ${YELLOW}Review the release notes before continuing.${NC}\n"
printf "  File: %s\n" "$RELEASE_FILE"
printf "\n  Press Enter to continue (or Ctrl+C to abort)..."
read -r _

# =============================================================================
# Step 6: Commit & tag
# =============================================================================
step "Committing and tagging"

git add "$ROOT_DIR/package.json" "$ROOT_DIR/scripts/install.sh" "$RELEASE_FILE"
git commit -m "release: ${new_version}"
info "Committed: release: ${new_version}"

git tag -a "$new_version" -m "Release ${new_version}"
info "Tagged: $new_version"

# =============================================================================
# Step 7: Publish
# =============================================================================
step "Publishing to GitHub"

printf "  Push commit + tag and create GitHub Release? [y/N] "
read -r confirm
case "$confirm" in y|Y|yes|YES) ;; *) printf "\n  Aborted. Commit and tag are local only.\n"; exit 0 ;; esac

if ! git push origin "$current_branch"; then
  fail "Push failed. Fix the issue and run: git push origin $current_branch && git push origin $new_version"
fi
info "Pushed commit"

if ! git push origin "$new_version"; then
  fail "Tag push failed. Run: git push origin $new_version"
fi
info "Pushed tag"

if ! gh release create "$new_version" \
  "$ARCHIVE" \
  "$CHECKSUM" \
  --title "QManager ${new_version}" \
  --notes-file "$RELEASE_FILE"; then
  printf "\n"
  warn "GitHub Release creation failed. Retry manually:"
  printf "  gh release create %s %s %s --title \"QManager %s\" --notes-file %s\n" \
    "$new_version" "$ARCHIVE" "$CHECKSUM" "$new_version" "$RELEASE_FILE"
  exit 1
fi

release_url="https://github.com/dr-dolomite/QManager/releases/tag/${new_version}"

printf "\n"
printf "  ${GREEN}${BOLD}Release published!${NC}\n"
printf "  %s\n\n" "$release_url"
