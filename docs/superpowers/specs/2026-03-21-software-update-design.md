# Software Update Feature — Design Spec

## Overview

Add an OTA software update capability to QManager, allowing users to check for new releases, view changelogs, install updates, and rollback to the previous version — all from the System Settings page. Updates are sourced from GitHub Releases on the public QManager repository.

## Requirements

- **Check on page load**: Silently check GitHub Releases API when the System Settings page opens
- **Manual re-check**: "Check for Updates" button for on-demand checking
- **Changelog display**: Show release notes from the GitHub release before user commits to installing
- **One-click install**: Download tar.gz → install → reboot, with simple progress states
- **Rollback**: Restore previous version from its archived tar.gz
- **Pre-release toggle**: User can opt in/out of pre-release updates (default: on, since all current releases are pre-release)
- **No new daemons or cron jobs**: Lightweight, check-on-demand only

## Prerequisites

Before this feature works, `install.sh` needs two changes:

1. **Write VERSION file**: Add `echo "$VERSION" > /etc/qmanager/VERSION` during installation so the device knows its current version.
2. **Add `--no-reboot` flag**: The update process owns the reboot timing. `install.sh` must support suppressing its built-in `sleep 5 && reboot` at the end. When invoked from the update CGI, it runs with `--no-reboot`.

**Existing installs without a VERSION file**: The CGI GET handler falls back to `"0.0.0"` if `/etc/qmanager/VERSION` does not exist. This means any GitHub release will be seen as "newer," prompting the user to update — which will then write the VERSION file going forward.

## Architecture

### Version Tracking

- `/etc/qmanager/VERSION` — plain text file written by `install.sh` during installation, contains the version string (e.g. `0.1.0-beta.1`)
- Compared against the latest GitHub release tag via the public Releases API

### Storage on Device

| Path | Purpose |
|------|---------|
| `/etc/qmanager/VERSION` | Current installed version |
| `/etc/qmanager/updates/current.tar.gz` | Archive from the last successful update |
| `/etc/qmanager/updates/previous.tar.gz` | Archive from the version before (rollback target) |
| `/tmp/qmanager_update.json` | Transient status file during install |
| `/tmp/qmanager_update.pid` | PID file to prevent concurrent installs |

**Storage cost**: ~13MB persistent flash for two archives. Typical OpenWRT overlay is 64MB+, but tight devices may need to delete the rollback archive. The UI should display the rollback archive size and offer a delete action if storage is a concern in the future.

### CGI Endpoint

**Single file:** `scripts/www/cgi-bin/quecmanager/system/update.sh`

| Method / Action | What it does |
|-----------------|-------------|
| `GET` (default) | Read `/etc/qmanager/VERSION` + local state (rollback availability, prerelease setting), then query GitHub Releases API, compare versions, return full response |
| `POST action=install` | Acquire lock → download tar.gz → verify → rotate archives → background `install.sh --no-reboot` → reboot |
| `POST action=rollback` | Acquire lock → swap archives → background `install.sh --no-reboot` → reboot |
| `POST action=save_prerelease` | Save UCI toggle |
| `GET action=status` | Read `/tmp/qmanager_update.json` for install progress |

### Concurrency Guard

A PID file at `/tmp/qmanager_update.pid` prevents concurrent install/rollback operations. Before spawning the background process, the CGI checks if the PID file exists and if the process is still running. If so, return `{"success": false, "error": "Update already in progress"}`. The background process writes its PID on start and removes it on completion or failure.

### GitHub API Integration

- **Endpoint**: `https://api.github.com/repos/<owner>/<repo>/releases`
- **Public repo**: No auth token needed (60 requests/hour unauthenticated)
- **Rate limit handling**: If GitHub returns HTTP 403, check for `X-RateLimit-Remaining: 0` header. Return a user-friendly message: `"Rate limit reached. Try again in X minutes."` Parse `X-RateLimit-Reset` (Unix timestamp) to calculate the wait time.
- **Pre-release filter**: When `include_prerelease` is off, filter to releases where `prerelease == false`
- **Version comparison**: Semantic versioning (see Version Comparison section below)
- **Asset matching**: Find the asset named `qmanager.tar.gz` in the release's `assets` array
- **Changelog**: Use the release's `body` field (GitHub-flavored Markdown rendered to plain text)

### Pre-release Toggle

- Stored in UCI: `quecmanager.update.include_prerelease` (default: `1`)
- Toggling saves immediately (same pattern as WAN Guard toggle in system settings)
- When off, the GitHub API response is filtered to exclude pre-releases

### Install Flow (Backgrounded)

```
Frontend POSTs action=install
  → CGI acquires PID lock (fail if already locked)
  → CGI returns {"success": true, "status": "starting"} immediately
  → Background process (double-forked, no setsid):
    1. Write PID to /tmp/qmanager_update.pid
    2. Stop watchdog (prevent interference during download/install)
    3. Write /tmp/qmanager_update.json: {"status": "downloading", "version": "...", "size": "6.5 MB"}
    4. Download tar.gz via uclient-fetch (preferred) / wget / curl with timeout
    5. Verify archive integrity: tar tzf "$DOWNLOAD_PATH" >/dev/null 2>&1
       - On failure: write error status, clean up PID, exit
    6. Verify install.sh exists inside archive
    7. Write status: "installing"
    8. Rotate archives: current.tar.gz → previous.tar.gz, downloaded → current.tar.gz
    9. Extract archive to /tmp/qmanager_install/
    10. Run install.sh --no-reboot (stops services → installs → fixes CRLF → enables → starts)
    11. Write status: "rebooting"
    12. Clean up PID file
    13. Reboot device
```

### Rollback Flow

```
Frontend POSTs action=rollback
  → CGI acquires PID lock
  → CGI checks /etc/qmanager/updates/previous.tar.gz exists
  → Returns {"success": true, "status": "starting"}
  → Background process:
    1. Write PID to /tmp/qmanager_update.pid
    2. Stop watchdog
    3. Write status: "installing" (rollback)
    4. Swap archives: current.tar.gz ↔ previous.tar.gz
       (so current always matches the running version, and the user can "undo" a rollback)
    5. Extract current.tar.gz (the just-swapped previous) to /tmp/qmanager_install/
    6. Run install.sh --no-reboot
    7. Write status: "rebooting"
    8. Clean up PID file
    9. Reboot device
```

### Error Handling

- **No internet / API unreachable**: Return `{"success": true, "update_available": false, "check_error": "Unable to check for updates"}` — not a hard error, just informational
- **Rate limited**: Return `{"success": true, "update_available": false, "check_error": "Rate limit reached. Try again in X minutes."}`
- **Download failure**: Write `{"status": "error", "message": "Download failed"}` to status file, clean up PID
- **Archive verification failure**: Write `{"status": "error", "message": "Downloaded file is corrupt. Please try again."}`, clean up PID and partial download
- **Install failure**: Write error status, clean up PID — device remains on current version
- **No rollback archive**: GET response includes `rollback_available: false`, UI hides rollback section
- **Concurrent install attempt**: Return `{"success": false, "error": "Update already in progress"}`

## Frontend

### Location

New card in the System Settings page, rendered alongside `SystemSettingsCard` and `ScheduledOperationsCard`.

### Files

| File | Purpose |
|------|---------|
| `hooks/use-software-update.ts` | Hook: check, install, rollback, poll status |
| `components/system-settings/software-update-card.tsx` | Card component with all states |

### Hook: `use-software-update.ts`

```typescript
interface UpdateInfo {
  current_version: string;
  latest_version: string | null;
  update_available: boolean;
  changelog: string | null;
  download_url: string | null;
  download_size: string | null;       // e.g. "6.5 MB"
  rollback_available: boolean;
  rollback_version: string | null;
  include_prerelease: boolean;
  check_error: string | null;         // Non-fatal: rate limit, no internet
}

interface UpdateStatus {
  status: "idle" | "downloading" | "installing" | "rebooting" | "error";
  message?: string;
  version?: string;
  size?: string;                      // File size for "Downloading 6.5 MB..."
}

interface UseSoftwareUpdateReturn {
  updateInfo: UpdateInfo | null;
  updateStatus: UpdateStatus;
  isLoading: boolean;       // Initial fetch
  isChecking: boolean;      // Manual re-check
  isUpdating: boolean;      // Install/rollback in progress
  error: string | null;
  lastChecked: string | null;         // From localStorage
  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;
  rollback: () => Promise<void>;
  togglePrerelease: (enabled: boolean) => Promise<void>;
}
```

**Behavior:**
- On mount: `GET /cgi-bin/quecmanager/system/update.sh` (silent check). On success, store timestamp in `localStorage` key `qm_update_last_checked`.
- `checkForUpdates()`: Same GET, but sets `isChecking` for button feedback. Updates localStorage timestamp.
- `installUpdate()`: POST `action=install` → set `isUpdating` → poll `GET action=status` every 2s → on "rebooting", navigate to `/reboot/` page (reuses existing reboot reconnection logic)
- `rollback()`: POST `action=rollback` → same polling flow as install
- `togglePrerelease()`: POST `action=save_prerelease` → re-check after save
- `lastChecked`: Read from `localStorage` on mount, formatted as relative time ("2 minutes ago")

### Card States

1. **Loading**: Skeleton (matches existing card skeleton pattern)
2. **Up to date**: Installed version, green badge, pre-release toggle, "Check for Updates" button, last-checked timestamp
3. **Update available**: Version comparison (installed → available), release notes in recessed container, "Install Update" primary button
4. **Updating**: Centered spinner, status text with size info, step indicators (Download → Install → Reboot)
5. **Error**: Alert banner with retry option
6. **Rollback available**: Shown as a recessed row below version when `previous.tar.gz` exists

### Visual Design (UniFi-Inspired)

- **Status badge** in card header: green "Up to date" / amber "Update available" / blue "Updating"
- **Version compare**: Side-by-side with arrow separator
- **Release notes**: Recessed surface container with categorized sections (Improvements, Bug Fixes)
- **Step indicators**: Dot + label for Download → Install → Reboot, active step highlighted in primary blue
- **Rollback row**: Recessed surface with previous version label and ghost "Restore" button
- **Pre-release toggle**: Standard Switch component in a separator row
- **Footer**: Left-aligned "Last checked" timestamp (from localStorage), right-aligned action button

### Confirmation Dialog

Before installing, show an AlertDialog:
- Title: "Install Update"
- Description: "QManager will update to v{version}. The device will reboot during installation. This may take a few minutes."
- Actions: "Cancel" / "Install & Reboot"

Before rolling back, show an AlertDialog:
- Title: "Restore Previous Version"
- Description: "QManager will be restored to v{version}. The device will reboot during this process."
- Actions: "Cancel" / "Restore & Reboot"

### Reboot Handling

After the status transitions to "rebooting", the frontend navigates to `/reboot/` — the same page used by SMS Tool Port and MBN changes. This page handles polling for device availability and redirects to login on reconnect.

## Backend Details

### VERSION File

`install.sh` must be updated to write the version to `/etc/qmanager/VERSION` during installation:

```sh
echo "$VERSION" > /etc/qmanager/VERSION
```

### Version Comparison (Shell)

POSIX shell semver comparison:

1. Strip `v` prefix from both versions
2. Split on `-` to separate `major.minor.patch` from pre-release suffix
3. Compare major, minor, patch numerically
4. If major.minor.patch are equal:
   - A version **without** a pre-release suffix is **newer** than one with (e.g. `0.1.0` > `0.1.0-beta.1`)
   - Pre-release identifiers compared segment-by-segment: numeric segments compared numerically, string segments compared lexically
5. Return: "newer", "same", or "older"

### GitHub API Response Parsing

Use `jq` to extract from the releases array:
- `.[0].tag_name` — latest version
- `.[0].body` — changelog (Markdown)
- `.[0].assets[] | select(.name == "qmanager.tar.gz") | .browser_download_url` — download URL
- `.[0].assets[] | select(.name == "qmanager.tar.gz") | .size` — file size in bytes (convert to human-readable)
- `.[0].prerelease` — filter flag

### HTTP Client Priority

Follow the same priority as the existing `qmanager-installer.sh`:

```sh
if command -v uclient-fetch >/dev/null 2>&1; then
    uclient-fetch -qO "$DOWNLOAD_PATH" --timeout=60 "$URL"
elif command -v wget >/dev/null 2>&1; then
    wget -qO "$DOWNLOAD_PATH" -T 60 "$URL"
elif command -v curl >/dev/null 2>&1; then
    curl -sL --max-time 60 -o "$DOWNLOAD_PATH" "$URL"
else
    # Error: no HTTP client available
fi
```

Note: No `-k` flag on curl — proper TLS verification is required. If the device lacks CA certificates, `ca-certificates` or `ca-bundle` should be installed as a dependency.

### Archive Rotation (Safe)

```sh
# Verify the downloaded archive before rotating
if ! tar tzf "$DOWNLOAD_PATH" >/dev/null 2>&1; then
    write_status "error" "Downloaded file is corrupt"
    rm -f "$DOWNLOAD_PATH"
    exit 1
fi

# Verify install.sh exists inside
if ! tar tzf "$DOWNLOAD_PATH" | grep -q "install.sh"; then
    write_status "error" "Invalid update package"
    rm -f "$DOWNLOAD_PATH"
    exit 1
fi

# Safe rotation
[ -f "$UPDATES_DIR/current.tar.gz" ] && \
    mv "$UPDATES_DIR/current.tar.gz" "$UPDATES_DIR/previous.tar.gz"
mv "$DOWNLOAD_PATH" "$UPDATES_DIR/current.tar.gz"
```

### Archive Swap (Rollback)

```sh
# Swap so current always matches running version
tmp_swap="/tmp/qmanager_swap.tar.gz"
mv "$UPDATES_DIR/current.tar.gz" "$tmp_swap"
mv "$UPDATES_DIR/previous.tar.gz" "$UPDATES_DIR/current.tar.gz"
mv "$tmp_swap" "$UPDATES_DIR/previous.tar.gz"
```

### Watchdog Interaction

The background update process stops the watchdog **before** starting the download (not just during install), because:
- A slow download could trigger watchdog recovery (CFUN toggle, SIM failover, or reboot)
- `install.sh` already stops services during install, but the download phase is unprotected

```sh
# Stop watchdog early
/etc/init.d/qmanager_watchcat stop 2>/dev/null
```

### install.sh Invocation

The update process runs the `install.sh` **from the downloaded archive**, not the currently-installed one. This is correct because the new install.sh may have different flags, service lists, or behavior. It is invoked with:

```sh
cd /tmp/qmanager_install && sh install.sh --no-reboot
```

## Scope Boundaries

**In scope:**
- Software update check, download, install, reboot
- Rollback to previous version (archive swap)
- Pre-release toggle
- Confirmation dialogs before destructive actions
- Concurrency guard (PID file)
- Archive integrity verification
- Watchdog suppression during update

**Out of scope:**
- Automatic/scheduled update checks (no cron, no daemon)
- Partial updates (frontend-only or backend-only via UI — `install.sh` handles this internally)
- Multi-version rollback history (only one previous version kept)
- Update notifications outside of System Settings page
- Checksum/signature verification against a published hash — future enhancement
- Download progress percentage (status shows file size but not bytes transferred)
