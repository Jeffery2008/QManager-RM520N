# RM520N-GL Architecture Report — AT Command Handling & System Analysis

This document provides a comprehensive technical analysis of the Quectel RM520N-GL modem's internal architecture, focusing on the AT command transport layer, system services, and CGI infrastructure. It serves as the primary reference for porting QManager from its current RM551E-on-OpenWRT target to the RM520N-GL's vanilla Linux environment.

The RM520N-GL is a fundamentally different platform: it runs its own Linux OS internally (not OpenWRT on an external host), uses systemd instead of procd, and relies on a socat-based PTY bridge for AT command access instead of `sms_tool`. Every subsystem — init, packaging, config storage, serial transport, web serving, and firewall — requires adaptation.

---

## Table of Contents

- [Quick Reference](#quick-reference)
- [Platform Comparison](#platform-comparison)
- [AT Command Transport Layer](#at-command-transport-layer)
  - [Physical Layer: SMD Ports](#physical-layer-smd-ports)
  - [PTY Bridge Architecture](#pty-bridge-architecture)
  - [Data Flow Diagram](#data-flow-diagram)
  - [AT Command Tools](#at-command-tools)
  - [Systemd Service Dependency Graph](#systemd-service-dependency-graph)
  - [Porting Considerations: AT Transport](#porting-considerations-at-transport)
- [System Architecture](#system-architecture)
  - [Platform Specs](#platform-specs)
  - [Filesystem Layout](#filesystem-layout)
  - [Service Hierarchy](#service-hierarchy)
  - [Package Management (Entware)](#package-management-entware)
- [CGI and Web UI Layer](#cgi-and-web-ui-layer)
  - [Web Server: lighttpd](#web-server-lighttpd)
  - [CGI AT Command Execution](#cgi-at-command-execution)
  - [Existing CGI Endpoints](#existing-cgi-endpoints)
  - [Security Concerns](#security-concerns)
  - [Frontend (Existing)](#frontend-existing)
- [Networking and Firewall](#networking-and-firewall)
  - [RGMII Ethernet](#rgmii-ethernet)
  - [Firewall and TTL](#firewall-and-ttl)
  - [LAN Configuration](#lan-configuration)
- [Watchdog Services](#watchdog-services)
- [VPN (Tailscale)](#vpn-tailscale)
- [Porting Strategy Summary](#porting-strategy-summary)
- [Appendix: AT Commands Unique to RM520N-GL](#appendix-at-commands-unique-to-rm520n-gl)

---

## Quick Reference

| Item | Value |
|------|-------|
| **SoC / Kernel** | Qualcomm SDXLEMUR, Linux 5.4.180, ARMv7l (32-bit) |
| **Init system** | systemd |
| **Shell** | `/bin/bash` (native, not BusyBox) |
| **AT primary port** | `/dev/smd7` (claimed by `port_bridge` at boot — must kill) |
| **AT secondary port** | `/dev/smd11` (free, immediately available) |
| **AT bridge devices** | `/dev/ttyOUT` (smd11), `/dev/ttyOUT2` (smd7) |
| **AT tools** | `microcom` (production), `atcmd`/`atcmd11` (interactive) |
| **Web server** | lighttpd (Entware, HTTPS on 443) |
| **Config storage** | `/usrdata/` (persistent, writable) |
| **LAN config** | `/etc/data/mobileap_cfg.xml` (xmlstarlet) |
| **Root filesystem** | Read-only by default (`mount -o remount,rw /` to modify) |
| **Persistent partition** | `/usrdata/` |
| **Package manager** | Entware opkg at `/opt` (bind-mounted from `/usrdata/opt`) |
| **Firewall** | iptables (direct rules, no framework like fw4) |
| **TTL interface** | `rmnet+` (wildcard, not `wwan0`) |
| **Default gateway** | `192.168.225.1` |

---

## Platform Comparison

This table maps every major subsystem between the current QManager target (RM551E on OpenWRT) and the RM520N-GL. Every row represents a porting decision.

| Aspect | RM551E (OpenWRT) | RM520N-GL (Vanilla Linux) | Porting Impact |
|--------|------------------|---------------------------|----------------|
| **OS** | OpenWRT on host router | SDXLEMUR vanilla Linux (on-modem) | Different userspace assumptions |
| **Init** | procd + rc.d | systemd | Rewrite all init.d scripts as `.service` units |
| **Package mgr** | opkg (built-in) | Entware opkg at `/opt` | Different package names, install paths |
| **Root FS** | Writable (SquashFS + overlay) | Read-only (remount required) | Must stage writes, prefer `/usrdata/` |
| **AT transport** | `sms_tool` via USB CDC ACM | socat PTY bridge via internal SMD | Replace `qcmd` wrapper entirely |
| **AT device** | USB device (host-side) | `/dev/smd7`, `/dev/smd11` (internal) | No USB enumeration dependency |
| **AT locking** | Implicit (single `sms_tool` call) | **None** (must add `flock`) | Critical: concurrent AT = garbage |
| **Web server** | uhttpd (built-in) | lighttpd (Entware) | Different CGI config, auth mechanism |
| **Firewall** | nftables (fw4) | iptables (direct) | Rewrite all firewall rules |
| **TTL interface** | `wwan0` | `rmnet+` (wildcard) | Update interface names in rules |
| **CGI shell** | `/bin/sh` (BusyBox ash) | `/bin/bash` | More features available; decide on POSIX compat |
| **Config system** | UCI (`/etc/config/`) | Files in `/usrdata/` + XML for LAN | Replace all `uci` calls |
| **Persistent storage** | `/overlay/`, `/etc/` | `/usrdata/` | Different backup/restore paths |
| **Auth** | Cookie-based multi-session | HTTP Basic Auth (`.htpasswd`) | Different auth middleware |
| **LAN config** | UCI network config | XML (`mobileap_cfg.xml`) via xmlstarlet | Completely different API |
| **Compound AT** | Semicolon batching via `qcmd` | Supported, but needs serialization | Add `flock` around compound commands |

---

## AT Command Transport Layer

This is the most critical section for the port. The entire QManager backend communicates with the modem through AT commands, and the transport mechanism is completely different on the RM520N-GL.

### Physical Layer: SMD Ports

The RM520N-GL exposes AT command channels as Shared Memory Driver (SMD) character devices — kernel-level IPC channels between the application processor and the modem baseband processor. Unlike the RM551E (where the host accesses the modem over USB CDC ACM), these are internal device files.

| Port | Path | Default State | Notes |
|------|------|---------------|-------|
| Primary | `/dev/smd7` | **Claimed** by `port_bridge` | Must kill `port_bridge` to use |
| Secondary | `/dev/smd11` | **Free** | Immediately available, no contention |

**`port_bridge`** is a Qualcomm process that runs at boot:

```
/usr/bin/port_bridge smd7 at_usb2 1
```

It bridges `/dev/smd7` to the USB-exposed AT port (`at_usb2`), making AT commands available to an external host over USB. Since QManager runs on the modem itself, this bridge is unnecessary and must be killed to reclaim `/dev/smd7`.

> **NOTE:** `/dev/smd11` is the safer default for QManager's poller. It requires no process killing and is available immediately at boot. Reserve `/dev/smd7` for secondary uses (e.g., a dedicated channel for user AT terminal commands).

### PTY Bridge Architecture

The raw SMD devices cannot be opened by multiple processes safely, and they lack terminal discipline (echo control, line buffering). The socat PTY bridge solves both problems by creating virtual TTY pairs that front-end the SMD devices.

```
                    socat PTY Pair                    cat Bridges
                ┌──────────────────┐          ┌────────────────────┐
                │                  │          │                    │
  Callers       │  /dev/ttyOUT     │          │                    │
  (microcom,    │  (readable side) │◄──PTY──► │  /dev/ttyIN        │
   atcmd, CGI)  │  echo=1, raw     │ loopback │  (writable side)   │
                │                  │          │  echo=0, raw       │
                └──────────────────┘          └──────┬─────────────┘
                                                     │
                                          ┌──────────┴──────────┐
                                          │                     │
                                    ┌─────▼──────┐     ┌───────┴────┐
                                    │ cat ttyIN   │     │ cat smd11  │
                                    │  > smd11    │     │  > ttyIN   │
                                    │ (cmd path)  │     │ (rsp path) │
                                    └─────┬──────┘     └───────┬────┘
                                          │                     │
                                          ▼                     ▲
                                    ┌─────────────────────────────┐
                                    │       /dev/smd11            │
                                    │   (modem AT processor)      │
                                    └─────────────────────────────┘
```

Key design details:

- **socat creates PTY pairs only** — it does NOT connect to the SMD device. It creates two linked pseudo-terminals (`/dev/ttyIN` + `/dev/ttyOUT` for smd11; `/dev/ttyIN2` + `/dev/ttyOUT2` for smd7).
- **Four `cat` processes do the actual bridging** — two per channel, one for each direction.
- **`echo=0` on the IN side** prevents command echo from being looped back.
- **`echo=1` on the OUT side** allows callers to see what they wrote (for interactive use).
- Both sides run in `raw` mode (no line discipline transformations).

> **WARNING:** This architecture means 7 processes (1 socat + 2 cats per channel, plus `killsmd7bridge`) must be running for AT commands to work. If any `cat` process dies, that direction of the bridge goes silent. The `BindsTo=` systemd directive handles automatic restart.

### Data Flow Diagram

Complete round-trip for an AT command sent via smd11:

```
1. Caller writes "AT+CSQ\r\n" to /dev/ttyOUT
                    │
2. socat PTY ───────┤ (loopback: ttyOUT ↔ ttyIN)
                    │
3. /dev/ttyIN receives "AT+CSQ\r\n"
                    │
4. cat /dev/ttyIN ──┤──► writes to /dev/smd11
                    │
5. Modem baseband processes AT+CSQ
                    │
6. /dev/smd11 ◄─────┤── modem writes "+CSQ: 20,99\r\nOK\r\n"
                    │
7. cat /dev/smd11 ──┤──► writes response to /dev/ttyIN
                    │
8. socat PTY ───────┤ (loopback: ttyIN ↔ ttyOUT)
                    │
9. /dev/ttyOUT now contains "+CSQ: 20,99\r\nOK\r\n"
                    │
10. Caller reads response from /dev/ttyOUT
```

For smd7, substitute: `ttyIN2`/`ttyOUT2` for `ttyIN`/`ttyOUT`, and `smd7` for `smd11`.

### AT Command Tools

Two tools are available for sending AT commands. QManager's CGI layer should use `microcom` (Approach A) for its superior timing characteristics.

#### microcom (Production — Recommended)

```bash
runcmd=$(echo -en "${command}\r\n" | microcom -t ${wait_time} /dev/ttyOUT2)
```

- BusyBox minimal terminal emulator
- `-t` accepts timeout in **milliseconds**
- Adaptive wait strategy: starts at 200ms, increments 1ms per retry until `OK` or `ERROR` is found in output
- No background processes spawned
- **Synchronous** — blocks until response or timeout

Used by: `get_atcommand`, `send_sms` (the production CGI scripts).

#### atcmd / atcmd11 (Interactive — Not Recommended for CGI)

```bash
# atcmd targets /dev/ttyOUT2 (smd7 bridge)
atcmd 'AT+CSQ'

# atcmd11 targets /dev/ttyOUT (smd11 bridge)
atcmd11 'AT+CSQ'
```

- Two modes: single-command (with argument) and interactive REPL (no argument)
- Single-command mode: configures stty, flushes device, echoes command, spawns background `cat` to tmpfile, polls for `OK`/`ERROR` with **1-second sleep** granularity
- **No hard timeout** — infinite loop until response marker found (can hang forever)
- **No file locking** — concurrent calls produce garbage
- **ANSI color codes in output** — must be stripped with `awk '{ gsub(/\x1B\[[0-9;]*[mG]/, "") }1'`

> **WARNING:** The existing `user_atcommand` CGI script uses `atcmd` with a quoting bug: `'$x'` (single quotes) prevents variable expansion, so the actual AT command is never sent. This endpoint is effectively broken.

### Systemd Service Dependency Graph

```
multi-user.target
│
├── socat-killsmd7bridge.service
│   Type=oneshot, RemainAfterExit=yes
│   No After= (runs ASAP)
│   ExecStart: pkill -f "/usr/bin/port_bridge smd7 at_usb2 1"
│   Purpose: Free /dev/smd7 from Qualcomm's USB-AT bridge
│
├── socat-smd11.service
│   After=ql-netd.service
│   Restart=always, RestartSec=1s
│   ExecStart: socat (creates /dev/ttyIN + /dev/ttyOUT)
│   ExecStartPost: sleep 2s (wait for PTY creation)
│   │
│   ├── socat-smd11-to-ttyIN.service
│   │   BindsTo=socat-smd11.service
│   │   ExecStart: cat /dev/ttyIN > /dev/smd11
│   │
│   └── socat-smd11-from-ttyIN.service
│       BindsTo=socat-smd11.service
│       ExecStart: cat /dev/smd11 > /dev/ttyIN
│
└── socat-smd7.service
    After=ql-netd.service
    Restart=always, RestartSec=1s
    ExecStart: socat (creates /dev/ttyIN2 + /dev/ttyOUT2)
    │
    ├── socat-smd7-to-ttyIN2.service
    │   BindsTo=socat-smd7.service
    │   ExecStart: cat /dev/ttyIN2 > /dev/smd7
    │
    └── socat-smd7-from-ttyIN2.service
        BindsTo=socat-smd7.service
        ExecStart: cat /dev/smd7 > /dev/ttyIN2
```

**Critical dependency:** `After=ql-netd.service` — Qualcomm's network daemon (`ql-netd`) must be running before the AT bridge starts. `ql-netd` manages the cellular data path and initializes the baseband. Starting the AT bridge before `ql-netd` can cause SMD read failures or stale responses.

**`BindsTo=` semantics:** If the parent socat service stops or fails, all child `cat` bridge services are automatically stopped too. Combined with `Restart=always` on the socat service, this provides automatic recovery of the entire bridge stack.

### Porting Considerations: AT Transport

This is the highest-risk area of the port. The entire QManager backend depends on `qcmd` (a wrapper around `sms_tool`), which does not exist on the RM520N-GL.

#### 1. Replace `qcmd` with a new AT wrapper

Create a `qcmd`-compatible wrapper that uses `microcom` internally:

```bash
#!/bin/bash
# /usr/bin/qcmd — AT command wrapper for RM520N-GL
# Drop-in replacement for OpenWRT's qcmd (sms_tool wrapper)

DEVICE="/dev/ttyOUT"    # smd11 bridge (primary)
LOCK="/var/lock/at_smd11.lock"
TIMEOUT_MS=2000

command="$*"
[ -z "$command" ] && { echo "Usage: qcmd <AT command>"; exit 1; }

# Serialize access — NO built-in locking on this platform
exec 9>"$LOCK"
flock -w 5 9 || { echo "ERROR: AT port busy (lock timeout)"; exit 1; }

result=$(echo -en "${command}\r\n" | microcom -t "$TIMEOUT_MS" "$DEVICE" 2>/dev/null)

exec 9>&-
echo "$result"
```

> **CRITICAL: `flock` is mandatory.** Unlike the RM551E (where `sms_tool` implicitly serializes access), the RM520N-GL's PTY bridge has no locking. Concurrent AT commands from the poller, CGI scripts, and user terminal will interleave on the wire, producing corrupt responses. Every AT access must go through a single locked wrapper.

#### 2. Compound AT command support

The RM520N-GL modem firmware supports semicolon-batched commands (same as RM551E):

```
AT+CSQ;+QTEMP;+QUIMSLOT?
```

The existing compound-AT batching strategy from QManager's poller should work unchanged, but the wrapper must hold the `flock` for the entire batch duration to prevent interleaving.

#### 3. Dual-channel strategy

With two independent SMD channels, QManager could dedicate each to a specific purpose:

| Channel | Device | Use Case |
|---------|--------|----------|
| smd11 (`/dev/ttyOUT`) | Primary | Poller (Tier 1/2/Boot), CGI read commands |
| smd7 (`/dev/ttyOUT2`) | Secondary | User AT terminal, long-running commands (QSCAN), write operations |

This eliminates contention between the high-frequency poller and user-initiated commands. Each channel needs its own `flock` file.

#### 4. Timeout handling

The `microcom` approach with adaptive wait is superior to `atcmd`'s 1-second polling. However, some commands need longer timeouts:

| Command | Expected Duration | Recommended Timeout |
|---------|-------------------|---------------------|
| `AT+CSQ`, `AT+QTEMP` | <100ms | 2000ms (default) |
| `AT+QENG="servingcell"` | 100-500ms | 3000ms |
| `AT+QSCAN` (cell scan) | 30-120s | 180000ms |
| `AT+EGMR=1,7,"..."` (IMEI write) | 1-5s | 10000ms |
| `AT+CFUN=0` / `AT+CFUN=1` | 2-10s | 15000ms |

The `qcmd` wrapper should accept an optional timeout parameter or use command-specific defaults.

---

## System Architecture

### Platform Specs

| Property | Value |
|----------|-------|
| SoC | Qualcomm SDXLEMUR |
| Kernel | Linux 5.4.180 |
| Architecture | ARMv7l (32-bit ARM) |
| C library | glibc 2.27 |
| Init system | systemd |
| Shell | `/bin/bash` (native) |
| Root FS | Read-only by default |
| Writable partition | `/usrdata/` |

> **NOTE:** The ARMv7l (32-bit) architecture affects binary compatibility. Any precompiled tools (like `nfqws` for the Video Optimizer feature) must be compiled for ARM32, not ARM64. The existing `qmanager_dpi_install` script's architecture detection logic will need updating.

### Filesystem Layout

```
/                           ← Read-only root (remount-rw for changes)
├── bin/
│   └── bash                ← Native bash (not BusyBox)
├── dev/
│   ├── smd7                ← Primary AT channel (raw SMD)
│   ├── smd11               ← Secondary AT channel (raw SMD)
│   ├── ttyIN, ttyOUT       ← socat PTY pair for smd11
│   └── ttyIN2, ttyOUT2     ← socat PTY pair for smd7
├── etc/
│   └── data/
│       └── mobileap_cfg.xml  ← LAN/DHCP config (xmlstarlet)
├── opt/ → /usrdata/opt     ← Entware (bind mount)
│   ├── bin/                ← Entware binaries
│   ├── sbin/               ← Entware system binaries
│   └── etc/lighttpd/       ← Web server config
├── usr/
│   └── bin/
│       ├── port_bridge     ← Qualcomm USB-AT bridge (killed at boot)
│       ├── socat-armel-static  ← Static socat binary
│       ├── atcmd            ← AT tool for smd7
│       └── atcmd11          ← AT tool for smd11
├── usrdata/                ← Persistent writable partition
│   ├── opt/                ← Entware installation
│   ├── simplefirewall/     ← TTL value, firewall scripts
│   ├── tailscale/          ← Tailscale state
│   └── ...                 ← QManager config would go here
└── tmp/                    ← Tmpfs (volatile)
    └── watchcat.json       ← Watchdog state
```

**Key difference from OpenWRT:** On OpenWRT, `/etc/config/` (UCI) is the canonical config store and survives reboots via the overlay filesystem. On the RM520N-GL, the root FS is read-only. All persistent data must live under `/usrdata/`. QManager's config directory should be `/usrdata/qmanager/` instead of `/etc/qmanager/`.

### Service Hierarchy

```
systemd
├── ql-netd.service              ← Qualcomm network daemon (MUST start first)
│   ├── socat-smd11.service      ← AT bridge for smd11
│   │   ├── socat-smd11-to-ttyIN.service
│   │   └── socat-smd11-from-ttyIN.service
│   ├── socat-smd7.service       ← AT bridge for smd7
│   │   ├── socat-smd7-to-ttyIN2.service
│   │   └── socat-smd7-from-ttyIN2.service
│   └── socat-killsmd7bridge.service (oneshot)
│
├── opt.mount                    ← Bind-mount /usrdata/opt → /opt
│   └── rc.unslung.service       ← Entware startup
│       ├── lighttpd.service     ← Web server (HTTP→HTTPS, CGI)
│       └── sshd.service         ← SSH access
│
├── simplefirewall.service       ← Port blocking, TTL rules
├── ttl-override.service         ← iptables TTL on rmnet+
├── ttyd.service                 ← Web terminal (port 8080)
└── tailscaled.service           ← Tailscale VPN
```

### Package Management (Entware)

Entware is the RM520N-GL's equivalent of OpenWRT's built-in opkg. It is installed at `/usrdata/opt` and bind-mounted to `/opt` via a systemd `.mount` unit.

Packages available via Entware that QManager depends on or could use:

| Package | Purpose | Notes |
|---------|---------|-------|
| `lighttpd` | Web server | Replaces uhttpd |
| `sudo` | Privilege escalation for CGI | `www-data` needs root for iptables |
| `xmlstarlet` | LAN config editing | Parses `mobileap_cfg.xml` |
| `curl` | HTTP client (full, not BusyBox) | Already available |
| `openssh` | SSH server | Already available |
| `jq` | JSON processing | Check for regex/oniguruma support |

> **NOTE:** Verify whether Entware's `jq` includes oniguruma (regex support). OpenWRT's `jq` lacks it, and QManager's scripts already avoid `test()` / regex. If Entware's `jq` has regex, it would be an improvement but not worth depending on for portability.

---

## CGI and Web UI Layer

### Web Server: lighttpd

The RM520N-GL uses lighttpd (from Entware) instead of OpenWRT's uhttpd. Key configuration differences:

| Aspect | uhttpd (RM551E) | lighttpd (RM520N-GL) |
|--------|-----------------|----------------------|
| HTTPS | Self-signed cert, built-in | Self-signed cert, `mod_openssl` |
| Auth | QManager's cookie-based sessions | HTTP Basic Auth (`.htpasswd`) |
| CGI | Built-in interpreter support | `mod_cgi` module |
| Reverse proxy | Not used | `/console` → ttyd on 127.0.0.1:8080 |
| Process user | root (typically) | `www-data:dialout` |

**Process permissions:** lighttpd runs as `www-data:dialout`. The `dialout` group grants access to serial devices (`/dev/ttyOUT`, `/dev/ttyOUT2`). For operations requiring root (iptables, service management), a sudoers rule allows:

```
www-data ALL = (root) NOPASSWD: /usr/sbin/iptables, /usr/sbin/iptables-restore, ...
```

QManager's scripts that call `iptables`, `service`, `reboot`, etc., will need `sudo` prefixes when running under lighttpd's `www-data` user.

### CGI AT Command Execution

The existing RM520N-GL firmware uses two approaches for AT commands in CGI scripts. QManager should standardize on microcom.

#### Approach A: microcom (Recommended)

```bash
# Adaptive wait with millisecond granularity
wait_time=200
while true; do
    runcmd=$(echo -en "${command}\r\n" | microcom -t "$wait_time" /dev/ttyOUT2)
    if echo "$runcmd" | grep -q "OK\|ERROR"; then
        break
    fi
    wait_time=$((wait_time + 1))
done
```

Advantages over `atcmd`:
- Millisecond timeout resolution (vs. 1-second polling)
- No background processes spawned
- No tmpfile management
- No ANSI escape codes to strip

#### Approach B: atcmd wrapper (Not Recommended)

```bash
runcmd=$(atcmd '$x' | awk '{ gsub(/\x1B\[[0-9;]*[mG]/, "") }1')
```

Problems:
- Single-quoted `'$x'` prevents variable expansion (bug)
- 1-second polling granularity
- No timeout (can hang forever)
- ANSI codes require stripping
- No concurrent access protection

### Existing CGI Endpoints

The RM520N-GL ships with these CGI endpoints. They represent the existing firmware's capabilities and are useful as a reference for what functionality exists, but QManager will replace them with its own CGI layer.

| Script | Method | AT Tool | Function |
|--------|--------|---------|----------|
| `get_atcommand` | `GET ?atcmd=` | microcom | General AT command execution |
| `user_atcommand` | `GET ?atcmd=` | atcmd | User AT terminal (**broken** — quoting bug) |
| `get_ping` | `GET` | — | `ping -c 1 8.8.8.8` → OK/ERROR |
| `get_ttl_status` | `GET` | — | iptables mangle read → JSON |
| `get_uptime` | `GET` | — | `uptime` → text |
| `get_watchcat_status` | `GET` | — | Read `/tmp/watchcat.json` |
| `send_sms` | `GET ?number=&msg=` | microcom | Two-step SMS (AT+CMGS) |
| `set_ttl` | `GET ?ttlvalue=` | — | iptables TTL rules via `ttl_script.sh` |
| `set_watchcat` | `GET ?WATCHCAT_ENABLED=&...` | — | Create/destroy watchcat systemd service |
| `watchcat_maker` | `GET ?WATCHCAT_ENABLED=&...` | — | Older watchcat (systemd unit writer) |

**Dashboard polling:** The existing dashboard issues a single compound AT command every 3 seconds:

```
AT+QTEMP;+QUIMSLOT?;+QSPN;+CGCONTRDP=1;+QMAP="WWANIP";
+QENG="servingcell";+QCAINFO;+QSIMSTAT?;+CSQ;+QGDNRCNT?;+QGDCNT?
```

Responses are parsed by line-prefix matching (e.g., `line.includes('+QTEMP')`) and CSV-splitting on fixed field indices — similar to QManager's poller but done in the browser instead of a backend daemon.

**Signal normalization (existing firmware):**

| Metric | Range | 0% | 100% |
|--------|-------|-----|------|
| RSRP | -135 to -65 dBm | -135 dBm | -65 dBm |
| RSRQ | -20 to -8 dB | -20 dB | -8 dB |
| SINR | -10 to +35 dB | -10 dB | +35 dB |

A minimum floor of 15% is applied to all values. QManager's poller uses similar ranges — these can be cross-referenced during the port.

### Security Concerns

The existing RM520N-GL CGI layer has a critical vulnerability:

```bash
# Every CGI script parses query strings like this:
eval $key=$value
```

This allows **shell injection** via crafted query parameters. QManager's `cgi_base.sh` with its safe query string parser will fix this, but it is worth noting in case any existing scripts are reused during the port.

### Frontend (Existing)

The RM520N-GL ships with a static HTML frontend (Alpine.js + Bootstrap 5). QManager will completely replace this with its Next.js app. No code reuse is expected, but the existing frontend's AT command patterns (compound batching, response parsing) validated that the approach works.

| Aspect | RM520N-GL (Existing) | QManager |
|--------|---------------------|----------|
| Framework | Alpine.js + Bootstrap 5 | Next.js 16 + shadcn/ui |
| Routing | Static HTML files | App Router (static export) |
| State management | Alpine.js `x-data` | React hooks + poller cache |
| Polling | `setInterval()` 3s | `useModemStatus()` 2s tiered |
| Data flow | Browser → CGI → AT | Browser → CGI → cache/AT |

---

## Networking and Firewall

### RGMII Ethernet

The RM520N-GL has an internal RGMII Ethernet controller. The modem itself acts as a NAT gateway — this is architecturally different from the RM551E, where the modem is a WAN device on an OpenWRT router.

```
                  ┌─────────────────────────────────┐
                  │         RM520N-GL Modem          │
                  │                                  │
  Cellular ──────►│  rmnet+ (data)                  │
                  │     │                            │
                  │     ▼                            │
                  │  bridge0 ─── NAT ─── eth0 ──────┼──► LAN (192.168.225.0/24)
                  │  (internal)                      │
                  │                                  │
                  │  Gateway: 192.168.225.1          │
                  └─────────────────────────────────┘
```

- **`bridge0`** — Internal bridge interface (LAN side)
- **`eth0`** — Physical Ethernet (RGMII to external device)
- **`rmnet+`** — Cellular data interfaces (wildcard, multiple PDN support)
- **IP Passthrough:** `AT+QMAP="MPDN_rule",0,1,0,1,1,"FF:FF:FF:FF:FF:FF"` (passes cellular IP directly to LAN client)

### Firewall and TTL

The RM520N-GL uses iptables directly (no framework like OpenWRT's fw4/nftables). QManager features that manipulate firewall rules will need adaptation:

| Feature | RM551E (OpenWRT) | RM520N-GL |
|---------|------------------|-----------|
| TTL set | `iptables -t mangle ... -o wwan0` | `iptables -t mangle -I POSTROUTING -o rmnet+ -j TTL --ttl-set N` |
| TTL persist | `/etc/firewall.user.ttl` | `/usrdata/simplefirewall/ttlvalue` |
| Port blocking | nftables via fw4 | iptables on `bridge0`, `eth0` |
| DPI (nfqws) | nftables NFQUEUE | iptables NFQUEUE (if kmod available) |
| Firewall restart | `fw4 reload` | `systemctl restart simplefirewall` |

> **WARNING:** The `rmnet+` wildcard syntax works with iptables `-o` matching. It is NOT the same as `wwan0`. All firewall rules in QManager's scripts that reference `wwan0` must be updated.

### LAN Configuration

On OpenWRT, LAN settings are managed through UCI (`/etc/config/network`). On the RM520N-GL, LAN configuration is stored in an XML file and edited with `xmlstarlet`:

```
/etc/data/mobileap_cfg.xml
```

AT commands also control some LAN settings:

| Setting | AT Command |
|---------|-----------|
| LAN IP / DHCP | `AT+QMAP="LANIP"` |
| DNS proxy | `AT+QMAP="DHCPV4DNS"` |
| Auto-connect | `AT+QMAPWAC=1` |
| 2.5GbE driver | `AT+QETH="eth_driver","r8125",1` |
| PCIe RC mode | `AT+QCFG="pcie/mode",1` |

QManager features that modify network configuration (MTU, DNS, LAN IP) will need to use these AT commands and/or xmlstarlet instead of UCI.

---

## Watchdog Services

The RM520N-GL has three independent watchdog mechanisms, compared to QManager's single integrated `qmanager_watchcat`:

| Watchdog | Monitors | Action | Config |
|----------|----------|--------|--------|
| Ethernet watchdog | `dmesg` for eth0 errors | `AT+CFUN=1,1` (reboot) | Systemd service |
| Ping watchdog | `ping google.com` x6 | Reboot on all-fail | Systemd service |
| Watchcat (web) | Configurable IP | Configurable timeout/action | Dynamic systemd unit |

QManager's `qmanager_watchcat` (5-state machine with 4-tier escalation) is significantly more sophisticated. For the port, QManager's watchdog should replace all three existing mechanisms. The systemd service units will need to replace the current procd-based init.d scripts.

---

## VPN (Tailscale)

The RM520N-GL already has Tailscale support, making the port of QManager's Tailscale feature straightforward:

| Aspect | RM551E (OpenWRT) | RM520N-GL |
|--------|------------------|-----------|
| Binary | opkg package | Static ARM binary from pkgs.tailscale.com |
| State dir | `/var/lib/tailscale/` | `/usrdata/tailscale/` |
| Init | procd init.d service | `tailscaled.service` (systemd) |
| Flags | `--accept-dns=false` | `--accept-dns=false` (same constraint) |
| Web UI | Not available | Optional, port 8088 |
| Firewall | fw4 zone + mwan3 ipset | iptables rules (SimpleFIrewall) |

> **NOTE:** The `--accept-routes` prohibition documented in QManager's memory (`feedback_accept-routes-forbidden.md`) applies equally here.

---

## Porting Strategy Summary

Organized by priority and risk level.

### Phase 1: AT Transport Layer (Critical Path)

1. **Create `qcmd` wrapper** using `microcom` + `flock` serialization (see [example above](#1-replace-qcmd-with-a-new-at-wrapper))
2. **Validate compound AT commands** work through the PTY bridge with the new wrapper
3. **Implement dual-channel strategy** (smd11 for poller, smd7 for interactive/writes)
4. **Add timeout profiles** for different command categories

### Phase 2: Init System Migration

1. **Convert procd init.d scripts to systemd units** — 8 services to port:
   - `qmanager_poller` → `qmanager-poller.service`
   - `qmanager_ping` → `qmanager-ping.service`
   - `qmanager_watchcat` → `qmanager-watchcat.service`
   - `qmanager_wan_guard` → `qmanager-wan-guard.service` (oneshot)
   - `qmanager_dpi` → `qmanager-dpi.service`
   - `qmanager_bandwidth` → `qmanager-bandwidth.service`
   - `qmanager_low_power` → `qmanager-low-power.timer` + `.service`
   - `qmanager_low_power_check` → `qmanager-low-power-check.service` (oneshot)
2. **Replace `procd_set_param` patterns** with systemd unit directives
3. **Add `After=socat-smd11.service`** to all services that use AT commands

### Phase 3: Config System Migration

1. **Replace all UCI calls** with file-based config in `/usrdata/qmanager/`
2. **Decide config format** — JSON files (already used for some QManager configs) vs. flat key-value
3. **Implement LAN config** via xmlstarlet and AT commands instead of UCI
4. **Migrate firewall rules** from nftables to iptables syntax

### Phase 4: Web Server and Auth

1. **Configure lighttpd** for QManager's CGI scripts and static frontend
2. **Port auth system** — either adapt cookie-based sessions to lighttpd or extend HTTP Basic Auth
3. **Handle `www-data` permissions** — add `sudo` rules for privileged operations
4. **Deploy frontend** to lighttpd's document root

### Phase 5: Feature-Specific Adaptation

1. **TTL/HL** — Update interface from `wwan0` to `rmnet+`, persist to `/usrdata/`
2. **Video Optimizer / DPI** — Verify kernel NFQUEUE support, adapt nfqws installer for ARM32
3. **Bandwidth Monitor** — Verify `/proc/net/dev` interface names, update binary for ARM32
4. **Ethernet Settings** — Adapt for RGMII (bridge0/eth0) vs. USB Ethernet
5. **NetBird VPN** — Verify ARM32 binary availability

---

## Appendix: AT Commands Unique to RM520N-GL

These AT commands are specific to the RM520N-GL platform and do not exist on the RM551E. They may be needed for new features or platform-specific configuration.

| Command | Function | Example |
|---------|----------|---------|
| `AT+QETH="eth_driver","r8125",1` | Enable Realtek 2.5GbE driver | Enable 2.5G Ethernet |
| `AT+QCFG="pcie/mode",1` | Enable PCIe Root Complex mode | For external PCIe devices |
| `AT+QMAP="LANIP"` | Query/set LAN DHCP settings | LAN IP configuration |
| `AT+QMAP="DHCPV4DNS"` | DNS proxy control | Enable/disable DNS forwarding |
| `AT+QMAPWAC=1` | Auto-connect for Ethernet clients | Enable auto data connection |
| `AT+QMAP="MPDN_rule",0,1,0,1,1,"FF:FF:FF:FF:FF:FF"` | IP Passthrough mode | Pass cellular IP to LAN |
| `AT+QGDNRCNT?` | NR5G data counter | Traffic stats (NR) |
| `AT+QGDCNT?` | LTE data counter | Traffic stats (LTE) |
