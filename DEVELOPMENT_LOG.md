# QManager Backend Development Log

**Project:** QManager — Custom GUI for Quectel RM551E-GL 5G Modem  
**Platform:** OpenWRT (Embedded Linux)  
**Last Updated:** February 14, 2026

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Files Created & Deployment Map](#2-files-created--deployment-map)
3. [AT Command Reference (Verified)](#3-at-command-reference-verified)
4. [JSON Data Contract](#4-json-data-contract)
5. [Component Wiring Progress](#5-component-wiring-progress)
6. [Deployment Notes](#6-deployment-notes)
7. [Remaining Work](#7-remaining-work)

---

## 1. System Architecture Overview

```
┌─────────────────┐     ┌──────────────┐     ┌──────────────────┐     ┌───────────┐
│  React Frontend │────▶│ fetch_data   │────▶│ status.json      │◀────│  Poller   │
│  useModemStatus │ GET │   .sh (CGI)  │ cat │ (/tmp/ RAM disk) │write│  Daemon   │
└─────────────────┘     └──────────────┘     └──────────────────┘     └─────┬─────┘
                                                                            │
                                                                      ┌─────▼─────┐
                                                                      │   qcmd    │
                                                                      │ (flock)   │
                                                                      └─────┬─────┘
                                                                            │
                                                                      ┌─────▼─────┐
                                                                      │ sms_tool  │
                                                                      │ (serial)  │
                                                                      └───────────┘
```

### Core Principles

- **Single Pipe Constraint:** The modem serial port (`/dev/ttyUSB2`) is single-channel. All AT commands MUST go through `qcmd` which uses `flock` to serialize access.
- **State Cache Pattern:** The poller daemon writes to `/tmp/qmanager_status.json` (RAM disk). The frontend reads from this cache. The UI **never** touches the modem directly.
- **"Sip, Don't Gulp":** The poller acquires the lock, runs ONE AT command, releases, sleeps briefly, then repeats. This leaves gaps for the terminal and watchdog to access the modem.
- **Flash Protection:** All volatile writes go to `/tmp/` (tmpfs/RAM). No flash wear.
- **Atomic Writes:** The poller writes to `status.json.tmp`, then uses `mv` (atomic rename) to replace `status.json`. The frontend never reads a half-written file.

### Three Competing Actors

| Actor | Purpose | Access Pattern |
|-------|---------|----------------|
| Dashboard Poller | Continuous signal/status updates | Every 2–30s, multiple AT commands |
| User Terminal | Manual AT commands from web UI | Random, on-demand |
| Watchdog | Connectivity health checks | Periodic, infrequent |

---

## 2. Files Created & Deployment Map

### Backend Scripts (Shell)

| Local Path | Deploys To (Modem) | Purpose |
|---|---|---|
| `scripts/usr/bin/qcmd` | `/usr/bin/qcmd` | **Gatekeeper** — flock-based mutex, stale lock recovery, command classification (short/long), timeout wrapping |
| `scripts/usr/bin/qmanager_poller` | `/usr/bin/qmanager_poller` | **Poller Daemon** — Tier 1/2/Boot polling, AT command parsing, JSON cache writer |
| `scripts/etc/init.d/qmanager` | `/etc/init.d/qmanager` | **procd init script** — manages poller lifecycle with auto-respawn |
| `scripts/usr/lib/qmanager/qlog.sh` | `/usr/lib/qmanager/qlog.sh` | **Logging Library** — sourceable centralized logging with levels, rotation, dual output (file + syslog) |
| `scripts/usr/bin/qmanager_logread` | `/usr/bin/qmanager_logread` | **Log Viewer** — CLI utility for filtering, tailing, and inspecting QManager logs |
| `scripts/cgi/quecmanager/at_cmd/fetch_data.sh` | `/www/cgi-bin/quecmanager/at_cmd/fetch_data.sh` | **Dashboard CGI** — serves cached JSON, zero modem contact |
| `scripts/cgi/quecmanager/at_cmd/send_command.sh` | `/www/cgi-bin/quecmanager/at_cmd/send_command.sh` | **Terminal CGI** — POST endpoint for manual AT commands via qcmd |

### Logging System

All backend scripts use the centralized logging library (`/usr/lib/qmanager/qlog.sh`). Logs are written to `/tmp/qmanager.log` (RAM disk — no flash wear).

**Log Format:**
```
[2026-02-14 15:30:45] INFO  [poller:1234] QManager Poller starting
[2026-02-14 15:30:45] DEBUG [qcmd:1235] AT_CMD: AT+QENG="servingcell" → +QENG: "servingcell",...
[2026-02-14 15:30:46] WARN  [qcmd:1236] LOCK: Timeout waiting for lock (short command: AT+COPS?)
[2026-02-14 15:30:47] INFO  [poller:1234] STATE: network_type: LTE → 5G-NSA
```

**Components Logged:**
| Component | Tag | What's Logged |
|-----------|-----|---------------|
| Gatekeeper | `qcmd` | Lock acquire/release/timeout/stale recovery, AT command execution, timeouts |
| Poller | `poller` | Boot data collection, state transitions, modem reachability changes, poll failures |
| Dashboard CGI | `cgi_fetch` | Cache file missing (fallback) |
| Terminal CGI | `cgi_terminal` | Commands received, blocked long commands |

**Configuration:**
- Log level: Set via `/etc/qmanager/log_level` (DEBUG, INFO, WARN, ERROR). Default: INFO
- Max log size: 256KB per file (configurable via `QLOG_MAX_SIZE_KB`)
- Rotation: Keeps 2 rotated files (`qmanager.log.1`, `qmanager.log.2`)
- Also logs to syslog (viewable via `logread`)

**Log Viewer — `qmanager_logread`:**
```bash
qmanager_logread                   # Last 50 lines
qmanager_logread -f                # Follow live output (tail -f)
qmanager_logread -f -c qcmd        # Follow only qcmd messages
qmanager_logread -l ERROR          # Show only errors
qmanager_logread -l WARN -n 100   # Last 100 warnings
qmanager_logread -s "LOCK"         # Search for lock events
qmanager_logread -s "STATE"        # Search for state transitions
qmanager_logread --status          # Show log file stats and level distribution
qmanager_logread --clear           # Clear all logs
```

**Changing Log Level at Runtime:**
```bash
echo "DEBUG" > /etc/qmanager/log_level
/etc/init.d/qmanager restart
```

### Frontend (TypeScript/React)

| Local Path | Purpose |
|---|---|
| `types/modem-status.ts` | JSON data contract as TypeScript interfaces + utility functions (signal quality, formatting) |
| `hooks/use-modem-status.ts` | Polling hook — fetches `/cgi-bin/quecmanager/at_cmd/fetch_data.sh` every 2s, provides `data`, `isLoading`, `isStale`, `error`, `refresh()` |
| `components/dashboard/home-component.tsx` | **Updated** — Now `"use client"`, calls `useModemStatus()`, passes data down to child components |
| `components/dashboard/network-status.tsx` | **Updated** — Accepts `data`, `isLoading`, `isStale` props, renders dynamic network status |

---

## 3. AT Command Reference (Verified)

All commands below have been tested against the actual RM551E-GL hardware and their response formats verified.

### Tier 1 — Hot Data (Every 2 Seconds)

#### `AT+QENG="servingcell"`

Primary serving cell info. Three response modes:

**LTE-Only (single line):**
```
+QENG: "servingcell","NOCONN","LTE","FDD",515,03,233B76D,135,1350,3,4,4,BF82,-118,-14,-85,11,7,230,-
```
Field positions (1-indexed after stripping `+QENG:`):
```
1=servingcell 2=state 3=LTE 4=is_tdd 5=MCC 6=MNC 7=cellID
8=PCID 9=earfcn 10=freq_band_ind 11=UL_bw 12=DL_bw 13=TAC
14=RSRP 15=RSRQ 16=RSSI 17=SINR 18=CQI 19=tx_power 20=srxlev
```

**EN-DC / NSA (three lines):**
```
+QENG: "servingcell","CONNECT"
+QENG: "LTE","FDD",<MCC>,<MNC>,<cellID>,<PCID>,<earfcn>,<freq_band_ind>,<UL_bw>,<DL_bw>,<TAC>,<RSRP>,<RSRQ>,<RSSI>,<SINR>,<CQI>,<tx_power>,<srxlev>
+QENG: "NR5G-NSA",<MCC>,<MNC>,<PCID>,<RSRP>,<SINR>,<RSRQ>,<ARFCN>,<band>,<NR_DL_bw>,<scs>
```
Note: LTE line is SEPARATE from the "servingcell" line. NR5G-NSA field order: PCID(4), RSRP(5), **SINR(6)**, RSRQ(7) — SINR before RSRQ!

**SA (single line):**
```
+QENG: "servingcell","CONNECT","NR5G-SA",<duplex>,<MCC>,<MNC>,<cellID>,<PCID>,<TAC>,<ARFCN>,<band>,<NR_DL_bw>,<RSRP>,<RSRQ>,<SINR>,<scs>,<srxlev>
```

**Key parsing note:** In LTE-only mode, `"LTE"` appears on the SAME line as `"servingcell"` (field positions shift +2 compared to EN-DC mode where they're on separate lines).

#### `/proc` reads (no modem lock needed)

| Source | Data |
|--------|------|
| `/proc/net/dev` | RX/TX bytes for traffic calculation |
| `/proc/loadavg` | CPU load average |
| `/proc/uptime` | Device uptime |
| `/proc/meminfo` | MemTotal, MemAvailable |

### Tier 2 — Warm Data (Every ~30 Seconds)

#### `AT+QTEMP`
```
+QTEMP: "sdr0","33"
+QTEMP: "mmw0","-273"       ← -273 = sensor unavailable, SKIP
+QTEMP: "cpuss-0","37"
+QTEMP: "cpuss-1","38"
...
```
**Parsing:** Extract all quoted temperature values, filter out `-273`, compute **average** of remaining values.

#### `AT+COPS?`
```
+COPS: 0,0,"Smart",7
```
Carrier name is field 3 (quoted string).

#### `AT+CPIN?`
```
+CPIN: READY
```
Values: `READY`, `SIM PIN`, `SIM PUK`, `NOT INSERTED`, `ERROR`

#### `AT+QUIMSLOT?`
```
+QUIMSLOT: 1
```
Active SIM slot number.

#### `AT+CNUM`
```
+CNUM: ,"+639391513538",145
```
Phone number is field 2 (quoted).

#### `AT+QCAINFO=1;+QCAINFO;+QCAINFO=0`
Semicolon-chained command — works as a single `sms_tool` call (one lock acquisition).
```
+QCAINFO: "PCC",1350,75,"LTE BAND 3",1,135,-115,-15,-82,5
+QCAINFO: "SCC",9485,75,"LTE BAND 28",1,135,-108,-10,-89,0,0,-,-
```
**Parsing:** Count `"SCC"` lines. If > 0, carrier aggregation is active.

### Boot-Only — Static Data (Once at Startup)

#### `AT+CVERSION`
```
VERSION: RM551EGL00AAR01A04M8G
Jun 25 2025 08:57:52
Authors: Quectel
```
Replaces `AT+QGMR`. Provides firmware version, build date, and manufacturer.

#### `AT+CGSN`
```
356303480863545
```
IMEI (15-digit hardware identifier).

#### `AT+CIMI`
```
515031726432435
```
IMSI (SIM identifier).

#### `AT+QCCID`
```
+QCCID: <iccid>
```
SIM card serial number.

#### `AT+QGETCAPABILITY`
```
+QGETCAPABILITY: NR:41,78
+QGETCAPABILITY: LTE-FDD:1,3,28
+QGETCAPABILITY: LTE-TDD:40,41
+QGETCAPABILITY: WCDMA:1,2,4,5,8,19
+QGETCAPABILITY: LTE-CATEGORY:20
+QGETCAPABILITY: LTE-CA:1
```
We extract: `LTE-CATEGORY:20` → stored as `"20"`.

#### `AT+QNWCFG="lte_mimo_layers"`
```
+QNWCFG: "lte_mimo_layers",1,4
```
Fields: `<ulmimo>,<dlmimo>`. Stored as `"LTE 1x4"`.

### Commands NOT Used

| Command | Reason |
|---------|--------|
| `AT+QGMR` | Replaced by `AT+CVERSION` (provides build date + manufacturer) |
| `AT+QNWINFO` | Network type derived from `AT+QENG="servingcell"` response directly |

---

## 4. JSON Data Contract

Full schema for `/tmp/qmanager_status.json`. TypeScript interfaces are in `types/modem-status.ts`.

```json
{
  "timestamp": 1707900000,
  "system_state": "normal | degraded | scan_in_progress | initializing",
  "modem_reachable": true,
  "last_successful_poll": 1707900000,
  "errors": [],
  "network": {
    "type": "LTE | 5G-NSA | 5G-SA | ",
    "sim_slot": 1,
    "carrier": "Smart",
    "service_status": "optimal | connected | limited | no_service | searching | sim_error | unknown",
    "ca_active": false,
    "ca_count": 0
  },
  "lte": {
    "state": "connected | disconnected | searching | limited | inactive | unknown | error",
    "band": "B3",
    "earfcn": 1350,
    "bandwidth": 4,
    "pci": 135,
    "rsrp": -118,
    "rsrq": -14,
    "sinr": 11,
    "rssi": -85
  },
  "nr": {
    "state": "connected | inactive | unknown",
    "band": "N41",
    "arfcn": 499200,
    "pci": 200,
    "rsrp": -88,
    "rsrq": -9,
    "sinr": 15,
    "scs": 30
  },
  "device": {
    "temperature": 36,
    "cpu_usage": 0.5,
    "memory_used_mb": 150,
    "memory_total_mb": 512,
    "uptime_seconds": 45910,
    "conn_uptime_seconds": 19412,
    "firmware": "RM551EGL00AAR01A04M8G",
    "build_date": "Jun 25 2025",
    "manufacturer": "Quectel",
    "imei": "356303480863545",
    "imsi": "515031726432435",
    "iccid": "8901260420001234567",
    "phone_number": "+639391513538",
    "lte_category": "20",
    "mimo": "LTE 1x4"
  },
  "traffic": {
    "rx_bytes_per_sec": 0,
    "tx_bytes_per_sec": 0,
    "total_rx_bytes": 0,
    "total_tx_bytes": 0
  }
}
```

### Schema Rules

1. Signal values (`rsrp`, `rsrq`, `sinr`) are always numbers or `null`, never strings with units.
2. Band names use 3GPP notation: `"B3"` for LTE Band 3, `"N41"` for NR Band 41.
3. `timestamp` is Unix epoch (seconds).
4. `errors` array contains string codes, not human-readable messages.
5. Traffic values are raw bytes per second. Frontend converts to Mbps/Kbps.
6. Numeric fields that may be unavailable use `null` (not `0` or `""`).

---

## 5. Component Wiring Progress

### Home Page Dashboard (`/dashboard`)

| Component | File | Status | Data Source |
|-----------|------|--------|-------------|
| **Network Status** | `network-status.tsx` | ✅ **DONE** | `data.network` — network type icon (5G/LTE+/LTE/3G), carrier, SIM slot, service status with pulsating rings, loading skeletons, stale indicator |
| **4G Primary Status** | `lte-status.tsx` | ❌ Hardcoded | `data.lte` — band, EARFCN, PCI, RSRP, RSRQ, RSSI, SINR |
| **5G Primary Status** | `nr-status.tsx` | ❌ Hardcoded | `data.nr` — band, ARFCN, PCI, RSRP, RSRQ, SINR, SCS |
| **Device Information** | `device-status.tsx` | ❌ Hardcoded | `data.device` — firmware, build date, manufacturer, IMEI, IMSI, ICCID, phone, LTE category, MIMO |
| **Device Metrics** | `device-metrics.tsx` | ❌ Hardcoded | `data.device` (temp, CPU, memory, uptime) + `data.traffic` (live traffic, data usage) |
| **Live Latency** | `live-latency.tsx` | ❌ Hardcoded | Separate implementation (not from poller cache) |
| **Recent Activities** | `recent-activities.tsx` | ❌ Hardcoded | Separate implementation (event log) |
| **Signal History** | `signal-history.tsx` | ❌ Mock data | `data.lte.rsrp/sinr` + `data.nr.rsrp/sinr` (accumulated client-side) |

### Network Status Icon Logic

| Condition | Icon | Label |
|-----------|------|-------|
| `5G-NSA` | `MdOutline5G` | "5G Signal / Non-Standalone" |
| `5G-SA` | `MdOutline5G` | "5G Signal / Standalone" |
| `LTE` + CA active | `Md4gPlusMobiledata` | "LTE+ Signal / 4G Carrier Aggregation" |
| `LTE` no CA | `Md4gMobiledata` | "LTE Signal / 4G Connected" |
| No 4G/5G | `Md3gMobiledata` | "Signal / No 4G/5G" |

---

## 6. Deployment Notes

### Current State (Feb 14, 2026)

- Static export built with `async rewrites()` block **commented out** in `next.config.ts` (rewrites are server-side only, not compatible with `output: "export"`).
- Init script deployed to `/etc/init.d/qmanager` with proper permissions.
- Scripts deployed to their respective modem paths (see Section 2).
- Modem rebooted after deployment.

### Development Proxy

During development (`bun dev`), the `next.config.ts` rewrites proxy `/cgi-bin/*` to `http://192.168.224.1/cgi-bin/*`. This must be **uncommented** for local dev and **commented out** for production builds.

```typescript
// next.config.ts — uncomment for dev, comment for build
async rewrites() {
  return [
    {
      source: '/cgi-bin/:path*',
      destination: 'http://192.168.224.1/cgi-bin/:path*',
      basePath: false,
    },
  ];
},
```

### File Permissions on Modem

All shell scripts need executable permission:
```bash
chmod +x /usr/bin/qcmd
chmod +x /usr/bin/qmanager_poller
chmod +x /usr/bin/qmanager_logread
chmod +x /usr/lib/qmanager/qlog.sh
chmod +x /etc/init.d/qmanager
chmod +x /www/cgi-bin/quecmanager/at_cmd/fetch_data.sh
chmod +x /www/cgi-bin/quecmanager/at_cmd/send_command.sh
```

### Service Management

```bash
/etc/init.d/qmanager enable    # Enable at boot
/etc/init.d/qmanager start     # Start now
/etc/init.d/qmanager restart   # Restart after updating scripts
/etc/init.d/qmanager stop      # Stop
```

### Verifying the Cache

```bash
cat /tmp/qmanager_status.json   # Should show valid JSON with current data
```

### Verifying Logs

```bash
qmanager_logread --status        # Check log file sizes and distribution
qmanager_logread -n 20           # Last 20 log entries
qmanager_logread -f              # Follow live (Ctrl+C to stop)
```

---

## 7. Remaining Work

### Immediate Next Steps (Home Page)

1. **Wire `LTEStatusComponent`** — Accept `data.lte` props, replace hardcoded band/EARFCN/PCI/signal values.
2. **Wire `NrStatusComponent`** — Accept `data.nr` props, same pattern.
3. **Wire `DeviceStatus`** — Accept `data.device` props for firmware, IMEI, IMSI, ICCID, phone, LTE category, MIMO, build date, manufacturer.
4. **Wire `DeviceMetricsComponent`** — Accept `data.device` (temperature, CPU, memory, uptime) and `data.traffic` (live traffic, data usage). Implement warning badges for high temp/CPU.
5. **Wire `SignalHistoryComponent`** — Replace mock data generator with real-time accumulation of `data.lte.rsrp/sinr` and `data.nr.rsrp/sinr` values using a client-side ring buffer.

### Subsequent Pages

6. **Terminal Page** — Wire to `send_command.sh` CGI endpoint (POST). Block `QSCAN` commands with user-facing message.
7. **Cell Scanner Page** — Dedicated endpoint for `AT+QSCAN` with progress indicator and long-command flag coordination.
8. **Cellular Information Page** — Detailed CA info, neighbor cells, band configuration.
9. **Band Locking / APN Management** — Write-path CGI endpoints (currently only read-path exists).

### Backend Improvements

10. **Watchdog** — Connectivity health checks (periodic ping), modem restart on extended failure.
11. **Error recovery testing** — SIM ejection, modem unresponsive, `sms_tool` crash, stale lock scenarios.
12. **Long command support** — Verify `AT+QSCAN` flag-based coordination between poller and Cell Scanner page.
13. **NR MIMO layers** — Currently only LTE MIMO is fetched. May need a separate command for NR MIMO (investigate `AT+QNWCFG="nr_mimo_layers"` or similar).

---

*End of Development Log*
