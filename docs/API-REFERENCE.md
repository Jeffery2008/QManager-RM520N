# QManager API Reference

Complete reference for all CGI endpoints. All endpoints are under `/cgi-bin/quecmanager/`.

All authenticated endpoints require a valid `qm_session` cookie (auto-sent by the browser). A `401` response means the session is expired or missing.

---

## Response Format

All endpoints return JSON with a consistent structure:

```json
// Success
{ "success": true, ... }

// Error
{ "success": false, "error": "error_code", "detail": "Human-readable message" }
```

---

## Platform Notes

### RM520N-GL Variant

On the RM520N-GL, CGI endpoints are served by lighttpd instead of uhttpd, and AT commands go through the socat PTY bridge instead of `sms_tool`. The API contract (request/response format) remains the same — only the transport layer differs.

Key differences:
- **Base URL**: Same (`/cgi-bin/quecmanager/`), but served from `/usrdata/www/cgi-bin/quecmanager/`
- **Auth**: Same cookie-based session mechanism (adapted for lighttpd)
- **AT execution**: `microcom` + `flock` instead of `qcmd`/`sms_tool`
- **UCI-dependent endpoints**: Features that read/write UCI config (watchdog, system settings, DPI, bandwidth monitor) require adaptation to file-based config on RM520N-GL

Endpoints marked with "(OpenWRT only)" in the reference below are not available on the RM520N-GL variant.

---

## Authentication

### GET `/auth/check.sh`

Check if first-time setup is required and rate limit status.

**Response:**
```json
{
  "setup_required": true,
  "rate_limited": false,
  "retry_after": 0
}
```

### POST `/auth/login.sh`

Login or first-time password setup.

**Login Request:**
```json
{ "password": "user_password" }
```

**Setup Request (first-time):**
```json
{ "password": "new_password", "confirm": "new_password" }
```

**Success Response:**
```json
{ "success": true }
```
Sets `qm_session` (HttpOnly) and `qm_logged_in=1` cookies.

**Error Response:**
```json
{
  "success": false,
  "error": "invalid_password",
  "detail": "Invalid password",
  "retry_after": 30
}
```

### POST `/auth/logout.sh`

Destroy current session.

**Response:**
```json
{ "success": true }
```
Clears session cookies.

### POST `/auth/password.sh`

Change password. Requires authentication.

**Request:**
```json
{
  "current_password": "old_password",
  "new_password": "new_password"
}
```

**Response:**
```json
{ "success": true }
```
Destroys all sessions (forces re-login).

---

## Modem Data

### GET `/at_cmd/fetch_data.sh`

Main polling endpoint. Returns the cached modem status JSON (built by `qmanager_poller`).

**Response:** Full `ModemStatus` object (see `types/modem-status.ts`)

```json
{
  "timestamp": 1710700000,
  "system_state": "normal",
  "modem_reachable": true,
  "last_successful_poll": 1710700000,
  "errors": [],
  "network": {
    "type": "5G-NSA",
    "sim_slot": 1,
    "carrier": "T-Mobile",
    "service_status": "optimal",
    "ca_active": true,
    "ca_count": 2,
    "nr_ca_active": false,
    "nr_ca_count": 0,
    "total_bandwidth_mhz": 135,
    "bandwidth_details": "B66: 20 MHz + B2: 15 MHz + N41: 100 MHz",
    "apn": "fast.t-mobile.com",
    "wan_ipv4": "10.0.0.1",
    "wan_ipv6": "",
    "primary_dns": "8.8.8.8",
    "secondary_dns": "8.8.4.4",
    "carrier_components": [...]
  },
  "lte": {
    "state": "connected",
    "band": "B66",
    "earfcn": 66486,
    "bandwidth": 20,
    "pci": 123,
    "cell_id": 12345678,
    "enodeb_id": 48225,
    "sector_id": 78,
    "tac": 12345,
    "rsrp": -95,
    "rsrq": -11,
    "sinr": 15,
    "rssi": -65,
    "ta": 3
  },
  "nr": {
    "state": "connected",
    "band": "N41",
    "arfcn": 520110,
    "pci": 456,
    "rsrp": -100,
    "rsrq": -12,
    "sinr": 18,
    "scs": 30,
    "ta": null
  },
  "device": {
    "temperature": 45,
    "cpu_usage": 12,
    "memory_used_mb": 85,
    "memory_total_mb": 256,
    "uptime_seconds": 86400,
    "conn_uptime_seconds": 43200,
    "firmware": "RM520NGLAAR03A04M4GA",
    "build_date": "Jun 25 2025",
    "manufacturer": "Quectel",
    "model": "RM520N-GL",
    "imei": "123456789012345",
    "imsi": "310260123456789",
    "iccid": "89012345678901234567",
    "phone_number": "+15551234567",
    "lte_category": "20",
    "mimo": "LTE 1x4 | NR 2x4",
    "supported_lte_bands": "B1:B2:B3:B5:B7:...",
    "supported_nsa_nr5g_bands": "N41:N71:N77:...",
    "supported_sa_nr5g_bands": "N41:N71:N77:..."
  },
  "traffic": {
    "rx_bytes_per_sec": 1562500,
    "tx_bytes_per_sec": 125000,
    "total_rx_bytes": 1073741824,
    "total_tx_bytes": 134217728
  },
  "connectivity": {
    "internet_available": true,
    "status": "connected",
    "latency_ms": 34.2,
    "avg_latency_ms": 38.5,
    "min_latency_ms": 22.1,
    "max_latency_ms": 89.3,
    "jitter_ms": 4.8,
    "packet_loss_pct": 0,
    "ping_target": "8.8.8.8",
    "latency_history": [34.2, 36.1, 38.0, ...],
    "history_interval_sec": 5,
    "history_size": 60,
    "during_recovery": false
  },
  "signal_per_antenna": {
    "lte_rsrp": [-95, -97, -102, null],
    "lte_rsrq": [-11, -12, -13, null],
    "lte_sinr": [15, 14, 12, null],
    "nr_rsrp": [-100, -103, null, null],
    "nr_rsrq": [-12, -13, null, null],
    "nr_sinr": [18, 16, null, null]
  },
  "watchcat": {
    "enabled": true,
    "state": "monitor",
    "current_tier": 0,
    "failure_count": 0,
    "last_recovery_time": null,
    "last_recovery_tier": null,
    "total_recoveries": 0,
    "cooldown_remaining": 0,
    "reboots_this_hour": 0
  },
  "sim_failover": {
    "active": false,
    "original_slot": null,
    "current_slot": null,
    "switched_at": null
  },
  "sim_swap": {
    "detected": false,
    "matching_profile_id": null,
    "matching_profile_name": null
  }
}
```

### GET `/at_cmd/fetch_events.sh`

Returns network events as a JSON array.

**Response:**
```json
[
  {
    "timestamp": 1710700000,
    "type": "band_change",
    "message": "LTE band changed from B2 to B66",
    "severity": "info"
  }
]
```

### GET `/at_cmd/fetch_signal_history.sh`

Returns signal history entries as a JSON array.

**Response:**
```json
[
  {
    "ts": 1710700000,
    "lte_rsrp": [-95, -97, -102, null],
    "lte_rsrq": [-11, -12, -13, null],
    "lte_sinr": [15, 14, 12, null],
    "nr_rsrp": [-100, -103, null, null],
    "nr_rsrq": [-12, -13, null, null],
    "nr_sinr": [18, 16, null, null]
  }
]
```

### GET `/at_cmd/fetch_ping_history.sh`

Returns ping history entries as a JSON array.

**Response:**
```json
[
  {
    "ts": 1710700000,
    "lat": 34.2,
    "avg": 38.5,
    "min": 22.1,
    "max": 89.3,
    "loss": 0,
    "jit": 4.8
  }
]
```

### POST `/at_cmd/send_command.sh`

Execute a raw AT command.

**Request:**
```json
{ "command": "AT+QENG=\"servingcell\"" }
```

**Response:**
```json
{ "success": true, "response": "+QENG: \"servingcell\",..." }
```

### POST `/at_cmd/cell_scan_start.sh`

Start the cell scanner daemon.

**Response:**
```json
{ "success": true }
```

### GET `/at_cmd/cell_scan_status.sh`

Get cell scan results.

**Response:**
```json
{
  "success": true,
  "status": "complete",
  "cells": [...]
}
```

### POST `/at_cmd/neighbour_scan_start.sh` / GET `neighbour_scan_status.sh`

Same pattern as cell scanner for neighbor cells.

### POST `/at_cmd/speedtest_start.sh` / GET `speedtest_status.sh` / GET `speedtest_check.sh`

Start speed test, check results, and check if speedtest binary is available.

---

## Cellular Settings

### GET/POST `/cellular/settings.sh`

**GET Response:**
```json
{
  "success": true,
  "mode_pref": "AUTO",
  "nr5g_disable_mode": 0,
  "roam_pref": 255,
  "sim_slot": 1,
  "ambr_dl": "1000",
  "ambr_ul": "500"
}
```

**POST Request:**
```json
{
  "mode_pref": "NR5G",
  "nr5g_disable_mode": 0,
  "roam_pref": 1,
  "sim_slot": 1
}
```

### GET/POST `/cellular/apn.sh`

**GET Response:**
```json
{
  "success": true,
  "profiles": [
    {
      "cid": 1,
      "apn": "fast.t-mobile.com",
      "pdp_type": "IPV4V6",
      "is_data": true
    }
  ],
  "active_cid": 1
}
```

**POST Request (create/update):**
```json
{
  "action": "set",
  "cid": 1,
  "apn": "fast.t-mobile.com",
  "pdp_type": "IPV4V6"
}
```

**POST Request (delete):**
```json
{
  "action": "delete",
  "cid": 3
}
```

### GET/POST `/cellular/mbn.sh`

**GET Response:**
```json
{
  "success": true,
  "profiles": [
    { "name": "Commercial-TMO", "active": true }
  ],
  "auto_sel": true
}
```

**POST Actions:** `"apply_profile"`, `"auto_sel"`, `"reboot"`

### GET/POST `/cellular/imei.sh`

**GET Response:**
```json
{
  "success": true,
  "imei": "123456789012345",
  "backup": { "enabled": true, "imei": "123456789012345" }
}
```

**POST Actions:** `"set_imei"`, `"save_backup"`, `"reboot"`

### GET/POST `/cellular/network_priority.sh`

**GET Response:**
```json
{
  "success": true,
  "mode_pref": "AUTO",
  "nr5g_disable_mode": 0
}
```

### GET/POST `/cellular/fplmn.sh`

**GET Response:**
```json
{
  "success": true,
  "has_entries": true
}
```

**POST Request:**
```json
{ "action": "clear" }
```

### GET/POST `/cellular/sms.sh`

SMS inbox and send functionality.

---

## Band Locking

### GET `/bands/current.sh`

Current locked band configuration.

### GET/POST `/bands/lock.sh`

**POST Request:**
```json
{
  "lte_bands": "B2:B66",
  "nr_bands": "N41:N71"
}
```

### GET `/bands/failover_status.sh`

Band failover daemon status.

### POST `/bands/failover_toggle.sh`

Enable/disable band failover automation.

---

## Frequency Locking

### GET/POST `/frequency/lock.sh`

**POST Request:**
```json
{
  "earfcn": 66486,
  "pci": 123
}
```

### GET `/frequency/status.sh`

Current frequency lock state.

---

## Tower Locking

### GET/POST `/tower/lock.sh`

**POST Request:**
```json
{
  "lte_pci": 123,
  "nr_pci": 456,
  "lte_earfcn": 66486,
  "nr_arfcn": 520110
}
```

### GET `/tower/status.sh`

Current tower lock state.

### GET/POST `/tower/settings.sh`

Tower locking general settings.

### GET `/tower/failover_status.sh`

Tower failover daemon status.

### GET/POST `/tower/schedule.sh`

Scheduled tower lock changes (time-based).

---

## Network Settings

### GET/POST `/network/ethernet.sh`

**GET Response:**
```json
{
  "success": true,
  "operstate": "up",
  "speed": 1000,
  "duplex": "full",
  "autoneg": "on",
  "speed_limit": "auto"
}
```

**POST Request:**
```json
{ "speed_limit": "auto" }
```
Values: `"auto"`, `"10"`, `"100"`, `"1000"`

### GET/POST `/network/ttl.sh`

**GET Response:**
```json
{
  "success": true,
  "ttl": 65,
  "hl": 65,
  "autostart": true
}
```

**POST Request:**
```json
{ "ttl": 65, "hl": 65 }
```
`0` = disabled.

### GET/POST `/network/mtu.sh`

**GET Response:**
```json
{
  "success": true,
  "mtu": 1500,
  "active": true
}
```

**POST Request:**
```json
{ "mtu": 1500 }
```
`"disable"` POST to remove MTU override.

### GET/POST `/network/dns.sh`

Custom DNS override settings.

### GET/POST `/network/ip_passthrough.sh`

IP passthrough mode configuration.

---

## Custom Profiles

### GET `/profiles/list.sh`

```json
{
  "success": true,
  "profiles": [
    {
      "id": "abc123",
      "name": "T-Mobile Optimized",
      "active": true,
      "created_at": 1710700000
    }
  ]
}
```

### GET `/profiles/get.sh?id=abc123`

Full profile details including APN, TTL/HL, and optional IMEI.

### POST `/profiles/save.sh`

Create or update a profile.

### POST `/profiles/delete.sh`

```json
{ "id": "abc123" }
```

### POST `/profiles/apply.sh`

Start the 3-step async apply process.

```json
{ "id": "abc123" }
```

### GET `/profiles/apply_status.sh`

```json
{
  "success": true,
  "status": "running",
  "step": 2,
  "total_steps": 3,
  "message": "Applying TTL/HL settings..."
}
```

Status values: `"idle"`, `"running"`, `"complete"`, `"error"`

### POST `/profiles/deactivate.sh`

Deactivate the currently active profile.

### GET `/profiles/current_settings.sh`

Get current modem settings for pre-filling profile creation forms.

---

## Connection Scenarios

### GET `/scenarios/list.sh`

List all saved connection scenarios (preset templates).

### POST `/scenarios/save.sh`

Create or update a scenario.

### POST `/scenarios/delete.sh`

Delete a scenario.

### POST `/scenarios/activate.sh`

Activate a scenario (applies it as a profile).

### GET `/scenarios/active.sh`

Get the currently active scenario.

---

## Monitoring

### GET/POST `/monitoring/email_alerts.sh`

**GET Response:**
```json
{
  "success": true,
  "settings": {
    "enabled": true,
    "sender_email": "alerts@gmail.com",
    "recipient_email": "admin@example.com",
    "app_password_set": true,
    "threshold_minutes": 5
  }
}
```

**POST (save settings):**
```json
{
  "action": "save_settings",
  "enabled": true,
  "sender_email": "alerts@gmail.com",
  "recipient_email": "admin@example.com",
  "app_password": "xxxx xxxx xxxx xxxx",
  "threshold_minutes": 5
}
```
`app_password` only sent when changed. Backend returns `app_password_set: boolean` (never the actual password).

**POST (send test):**
```json
{ "action": "send_test" }
```

### GET `/monitoring/email_alert_log.sh`

```json
{
  "success": true,
  "entries": [
    {
      "timestamp": 1710700000,
      "trigger": "downtime_recovery",
      "status": "sent",
      "recipient": "admin@example.com"
    }
  ],
  "total": 5
}
```

### GET/POST `/monitoring/watchdog.sh`

**GET Response:**
```json
{
  "success": true,
  "enabled": true,
  "state": "monitor",
  "config": {
    "check_interval": 10,
    "suspect_threshold": 3,
    "recovery_timeout": 60,
    "cooldown_period": 120,
    "max_tier": 4,
    "sim_failover_enabled": true,
    "reboot_enabled": true
  },
  "status": {
    "current_tier": 0,
    "failure_count": 0,
    "total_recoveries": 0,
    "reboots_this_hour": 0
  }
}
```

---

## Device

### GET `/device/about.sh`

Device hardware and firmware information.

---

## System

### GET `/system/logs.sh`

System log output.

### GET/POST `/system/settings.sh`

System preferences, scheduled reboot, and low power mode.

**GET Response:**
```json
{
  "success": true,
  "settings": {
    "wan_guard_enabled": true,
    "temp_unit": "celsius",
    "distance_unit": "km",
    "timezone": "UTC0",
    "zonename": "UTC"
  },
  "scheduled_reboot": {
    "enabled": false,
    "time": "04:00",
    "days": [0, 1, 2, 3, 4, 5, 6]
  },
  "low_power": {
    "enabled": false,
    "start_time": "23:00",
    "end_time": "06:00",
    "days": [0, 1, 2, 3, 4, 5, 6]
  }
}
```

**POST (save_settings):**
```json
{
  "action": "save_settings",
  "wan_guard_enabled": true,
  "temp_unit": "celsius",
  "distance_unit": "km",
  "timezone": "EST5EDT,M3.2.0,M11.1.0",
  "zonename": "America/New_York"
}
```

- `temp_unit`: `"celsius"` or `"fahrenheit"`
- `distance_unit`: `"km"` or `"miles"`
- `wan_guard_enabled`: toggles init.d symlink (enable/disable)
- `timezone`/`zonename`: written to UCI `system.@system[0]`

**POST (save_scheduled_reboot):**

```json
{
  "action": "save_scheduled_reboot",
  "enabled": true,
  "time": "04:00",
  "days": [0, 1, 2, 3, 4, 5, 6]
}
```

- `days`: array of integers 0-6 (0=Sunday, 6=Saturday)
- Manages cron entries for `/usr/bin/qmanager_scheduled_reboot`
- Config persisted in UCI `quecmanager.settings.sched_reboot_*`

**POST (save_low_power):**

```json
{
  "action": "save_low_power",
  "enabled": true,
  "start_time": "23:00",
  "end_time": "06:00",
  "days": [0, 1, 2, 3, 4, 5, 6]
}
```

- Creates two cron entries: `enter` at start_time on selected days, `exit` at end_time on all 7 days
- Exit cron fires on all days to handle overnight windows (e.g., 23:00-06:00) — no-ops if flag absent
- Enables/disables `qmanager_low_power_check` init.d (boot-time window check)
- Disabling while active immediately triggers `qmanager_low_power exit` (restores CFUN=1)

### POST `/system/reboot.sh`

Triggers a device reboot. POST-only, no request body required.

**Response:**

```json
{ "success": true }
```

The HTTP response is flushed before the device reboots asynchronously. The connection will drop shortly after.

---

## DPI Settings

The DPI Settings page manages two features through a single CGI endpoint: **Video Optimizer** (SNI splitting for video throttle bypass) and **Traffic Masquerade** (fake TLS ClientHello with spoofed SNI). Both share the nfqws binary and kernel module but run as separate nfqws instances on different NFQUEUE numbers.

### GET `/network/video_optimizer.sh`

Read video optimizer settings and service status.

**Response:**
```json
{
  "success": true,
  "enabled": true,
  "status": "running",
  "uptime": "2h 34m",
  "packets_processed": 48291,
  "domains_loaded": 22,
  "binary_installed": true,
  "kernel_module_loaded": true
}
```

Status values: `running`, `stopped`, `restarting`, `error`

### GET `/network/video_optimizer.sh?section=masquerade`

Read traffic masquerade settings and service status.

**Response:**
```json
{
  "success": true,
  "enabled": true,
  "status": "running",
  "uptime": "1h 12m",
  "packets_processed": 15320,
  "sni_domain": "speedtest.net",
  "binary_installed": true,
  "kernel_module_loaded": true
}
```

Status values: `running`, `stopped`

### GET `/network/video_optimizer.sh?action=verify_status`

Poll verification test progress/results.

**Response (running):**
```json
{"success": true, "status": "running"}
```

**Response (complete):**
```json
{
  "success": true,
  "status": "complete",
  "timestamp": "2026-03-24T14:30:00Z",
  "without_bypass": {"speed_mbps": 2.4, "throttled": true},
  "with_bypass": {"speed_mbps": 47.2, "throttled": false},
  "improvement": "19.7x"
}
```

### GET `/network/video_optimizer.sh?action=install_status`

Poll nfqws installation progress/results.

**Response (idle — no install started):**
```json
{"success": true, "status": "idle"}
```

**Response (running):**
```json
{"success": false, "status": "running", "message": "Downloading zapret v69...", "detail": ""}
```

**Response (complete):**
```json
{"success": true, "status": "complete", "message": "nfqws installed successfully", "detail": "v69"}
```

**Response (error):**
```json
{"success": false, "status": "error", "message": "Binary not found in archive", "detail": "No nfqws for linux-arm64 in tarball"}
```

### POST `/network/video_optimizer.sh`

**Save video optimizer settings:**
```json
{"action": "save", "enabled": true}
```

**Save traffic masquerade settings:**
```json
{"action": "save_masquerade", "enabled": true, "sni_domain": "speedtest.net"}
```

- `enabled` (boolean, required): Enable or disable traffic masquerade.
- `sni_domain` (string, optional): Domain to spoof in fake TLS ClientHello. Must contain at least one dot, max 253 characters. Defaults to `speedtest.net` if not provided.

Saving masquerade settings restarts the entire `qmanager_dpi` service (both instances) to apply changes.

**Start verification:**
```json
{"action": "verify"}
```

**Install nfqws binary** (downloads from zapret GitHub releases):
```json
{"action": "install"}
```

Returns `{"success": true, "status": "started"}` if the installer was spawned, or `{"success": true, "status": "running"}` if an install is already in progress. Poll `?action=install_status` for progress.

---

## VPN

### GET/POST `/vpn/tailscale.sh`

Tailscale VPN status and configuration.
