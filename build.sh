#!/usr/bin/env bash
set -eu

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="$ROOT_DIR/out"
SCRIPTS_DIR="$ROOT_DIR/scripts"
DEPS_DIR="$ROOT_DIR/dependencies"
BUILD_DIR="$ROOT_DIR/qmanager-build"
STAGING_DIR="$BUILD_DIR/qmanager_install"
ARCHIVE="$BUILD_DIR/qmanager.tar.gz"

# Colors
if [ -t 1 ]; then
  GREEN='\033[0;32m' BOLD='\033[1m' RED='\033[0;31m' NC='\033[0m'
else
  GREEN='' BOLD='' RED='' NC=''
fi

step() { printf "${GREEN}[%s]${NC} %s\n" "$(date +%H:%M:%S)" "$1"; }
fail() { printf "${RED}[%s] ERROR:${NC} %s\n" "$(date +%H:%M:%S)" "$1"; exit 1; }

# --- Preflight checks --------------------------------------------------------
[ -d "$OUT_DIR" ] || fail "'out/' not found — run 'bun run build' first"
[ -d "$DEPS_DIR" ] || fail "'dependencies/' not found at repo root"
[ -f "$DEPS_DIR/atcli_smd11" ] || fail "Missing required binary: dependencies/atcli_smd11"
[ -f "$DEPS_DIR/sms_tool" ]    || fail "Missing required binary: dependencies/sms_tool"
[ -f "$DEPS_DIR/jq.ipk" ]      || fail "Missing required package: dependencies/jq.ipk"
DROPBEAR_IPK=$(ls "$DEPS_DIR"/dropbear_*.ipk 2>/dev/null | head -n1)
[ -n "$DROPBEAR_IPK" ] || fail "Missing required package: dependencies/dropbear_*.ipk"

step "Preparing staging directory..."
mkdir -p "$BUILD_DIR"
rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR"

step "Copying frontend build output..."
cp -r "$OUT_DIR" "$STAGING_DIR/out"

step "Copying backend scripts..."
mkdir -p "$STAGING_DIR/scripts"
for item in "$SCRIPTS_DIR"/*; do
  name="$(basename "$item")"
  case "$name" in install_rm520n.sh|uninstall_rm520n.sh) continue ;; esac
  cp -r "$item" "$STAGING_DIR/scripts/$name"
done

step "Copying install & uninstall scripts..."
cp "$SCRIPTS_DIR/install_rm520n.sh"   "$STAGING_DIR/install_rm520n.sh"
cp "$SCRIPTS_DIR/uninstall_rm520n.sh" "$STAGING_DIR/uninstall_rm520n.sh"

step "Stamping version from package.json..."
PKG_VERSION=$(sed -n 's/.*"version":[[:space:]]*"\([^"]*\)".*/\1/p' "$ROOT_DIR/package.json" | head -n1)
[ -n "$PKG_VERSION" ] || fail "Could not read version from package.json"
tmp="$STAGING_DIR/install_rm520n.sh.tmp"
sed "s|^VERSION=\"[^\"]*\"|VERSION=\"$PKG_VERSION\"|" "$STAGING_DIR/install_rm520n.sh" > "$tmp" && mv "$tmp" "$STAGING_DIR/install_rm520n.sh"
chmod +x "$STAGING_DIR/install_rm520n.sh" "$STAGING_DIR/uninstall_rm520n.sh"
grep -q "^VERSION=\"$PKG_VERSION\"" "$STAGING_DIR/install_rm520n.sh" \
  || fail "Failed to stamp install_rm520n.sh with version $PKG_VERSION — is VERSION= line present?"
step "Stamped install_rm520n.sh with version: $PKG_VERSION"

step "Linting install_rm520n.sh (systemd service coverage)..."
# Verify every core QManager service unit actually exists in the source tree.
# A missing .service file here means the installer will enable a non-existent
# unit — silent failure on the device.
SYSTEMD_SCRIPTS_DIR="$SCRIPTS_DIR/etc/systemd/system"
CORE_SERVICES="lighttpd qmanager-firewall qmanager-setup qmanager-ping qmanager-poller qmanager-ttl qmanager-mtu qmanager-imei-check qmanager-watchcat qmanager-tower-failover"
LINT_ERRORS=0

for svc in $CORE_SERVICES; do
  if [ ! -f "$SYSTEMD_SCRIPTS_DIR/$svc.service" ]; then
    printf "  ${RED}MISSING:${NC} %s.service not found in scripts/etc/systemd/system/\n" "$svc"
    LINT_ERRORS=$((LINT_ERRORS + 1))
  fi
done

if [ "$LINT_ERRORS" -gt 0 ]; then
  fail "Lint failed with $LINT_ERRORS missing service unit(s)"
fi
step "Lint passed ($CORE_SERVICES)"

step "Copying bundled dependencies..."
mkdir -p "$STAGING_DIR/dependencies"
cp "$DEPS_DIR/atcli_smd11" "$STAGING_DIR/dependencies/atcli_smd11"
cp "$DEPS_DIR/sms_tool"    "$STAGING_DIR/dependencies/sms_tool"
cp "$DEPS_DIR/jq.ipk"      "$STAGING_DIR/dependencies/jq.ipk"
cp "$DEPS_DIR"/dropbear_*.ipk "$STAGING_DIR/dependencies/"
chmod 755 "$STAGING_DIR/dependencies/atcli_smd11" "$STAGING_DIR/dependencies/sms_tool"

step "Creating qmanager.tar.gz..."
tar czf "$ARCHIVE" -C "$BUILD_DIR" qmanager_install

step "Generating sha256sum.txt..."
(cd "$BUILD_DIR" && sha256sum qmanager.tar.gz > sha256sum.txt)

# Clean up staging only after both release artifacts exist.
if [ -f "$ARCHIVE" ] && [ -f "$BUILD_DIR/sha256sum.txt" ]; then
  step "Cleaning up staging directory..."
  rm -rf "$STAGING_DIR"
fi

ARCHIVE_SIZE=$(du -h "$ARCHIVE" | cut -f1)
FILE_COUNT=$(tar tzf "$ARCHIVE" | wc -l)
SHA_VALUE=$(awk '{print $1}' "$BUILD_DIR/sha256sum.txt")
printf "\n${GREEN}${BOLD}Build complete!${NC} qmanager.tar.gz (%s, %d files)\n" "$ARCHIVE_SIZE" "$FILE_COUNT"
printf "SHA-256: %s\n\n" "$SHA_VALUE"
