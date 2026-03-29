# QManager

<div align="center">
  <img src="public/qmanager-logo.svg" alt="QManager Logo" width="120" />
  <h3>A modern, custom GUI for Quectel modem management</h3>
  <p>Visualize, configure, and optimize your cellular modem's performance with an intuitive web interface</p>

  ![Version](https://img.shields.io/badge/version-v0.1.8-blue?style=flat-square)
  ![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
  ![Platform](https://img.shields.io/badge/platform-OpenWRT-orange?style=flat-square)
  ![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square)
  ![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square)
</div>

---

> **Note:** QManager is the successor to [SimpleAdmin](https://github.com/dr-dolomite/simpleadmin-mockup), rebuilt from the ground up with a modern tech stack and improved user experience for managing Quectel modems like the RM520N-GL, RM551E-GL, and similar devices.

---

## Features

### Signal & Network Monitoring
- **Live Signal Dashboard** — Real-time RSRP, RSRQ, SINR with per-antenna values (4x4 MIMO) and 30-minute historical charts
- **Network Events** — Automatic detection of band changes, cell handoffs, carrier aggregation changes, and connectivity events
- **Latency Monitoring** — Real-time ping with 24-hour history, jitter, packet loss, and aggregated views (hourly/12h/daily)
- **Bandwidth Monitor** — Live throughput tracking via WebSocket with real-time area charts on the dashboard
- **Traffic Statistics** — Live throughput (Mbps) and cumulative data usage

### Cellular Configuration
- **Band Locking** — Select and lock specific LTE/NR bands for optimal performance
- **Tower Locking** — Lock to a specific cell tower by PCI, with automatic failover and scheduled changes
- **Frequency Locking** — Lock to exact EARFCN/ARFCN channels
- **APN Management** — Create, edit, delete APN profiles with MNO presets (T-Mobile, AT&T, Verizon, etc.)
- **Custom SIM Profiles** — Save complete configurations (APN + TTL/HL + optional IMEI) and apply with one click
- **Connection Scenarios** — Save and restore full network configuration snapshots
- **Network Priority** — Configure preferred network types and selection modes
- **Cell Scanner** — Active and neighbor cell scanning with signal comparison
- **Frequency Calculator** — EARFCN/ARFCN to frequency conversion tool
- **SMS Center** — Send and receive SMS messages directly from the interface
- **IMEI Settings** — Read, backup, and modify device IMEI
- **FPLMN Management** — View and manage the Forbidden PLMN list
- **MBN Configuration** — Select and activate modem broadband configuration files

### Network Settings
- **Ethernet Link Speed** — Control and monitor link speed, duplex, and auto-negotiation
- **TTL/HL Settings** — IPv4 TTL and IPv6 Hop Limit configuration (iptables-based)
- **MTU Configuration** — Dynamic MTU application for rmnet interfaces
- **IP Passthrough** — Direct IP assignment to downstream devices
- **Custom DNS** — DNS server override
- **Video Optimizer** — DPI-based video streaming optimization using nfqws (TCP SNI split + QUIC desync with configurable CDN hostlist)
- **Traffic Masquerade** — SNI spoofing via fake TLS ClientHello to bypass carrier traffic shaping (mutually exclusive with Video Optimizer)

### Reliability & Monitoring

- **Connection Watchdog** — 4-tier auto-recovery: ifup → CFUN toggle → SIM failover → full reboot (with token bucket rate limiting)
- **Email Alerts** — Downtime notifications via Gmail SMTP (msmtp), sent on recovery with duration details
- **WAN Interface Guard** — Automatically disables phantom WAN profiles to prevent netifd CPU-wasting retry loops
- **Low Power Mode** — Scheduled CFUN power-down windows via cron
- **Tailscale VPN** — One-click installation, authentication, and status monitoring
- **Software Updates** — In-app OTA update checking, download, verification, and installation
- **System Logs** — Centralized log viewer with search

### Interface
- **Dark/Light Mode** — Full theme support with OKLCH perceptual color system
- **Responsive Design** — Works on desktop monitors and tablets in the field
- **Cookie-Based Auth** — Secure session management with rate limiting
- **AT Terminal** — Direct AT command interface for advanced users
- **Initial Setup Wizard** — Guided onboarding for first-time configuration

---

## Quick Install

SSH into your OpenWRT device and run:

```sh
wget -O /tmp/qmanager-installer.sh \
  https://github.com/dr-dolomite/QManager/raw/refs/heads/main/qmanager-installer.sh && \
  sh /tmp/qmanager-installer.sh
```

The installer automatically detects your architecture, downloads the latest release, verifies the checksum, and runs the install script. You can pin a specific version with `QMANAGER_VERSION=v0.1.8`.

### Upgrading

From v0.1.7+, go to **Monitoring → Software Update** and use the built-in update flow — download, verify, and install without SSH.

### Uninstalling

```sh
wget -O /tmp/qmanager-installer.sh \
  https://github.com/dr-dolomite/QManager/raw/refs/heads/main/qmanager-installer.sh && \
  sh /tmp/qmanager-installer.sh --uninstall
```

---

## Prerequisites

- Compatible Quectel modem (RM520N-GL, RM551E-GL, RM500Q, etc.) with AT command support
- OpenWRT device with the modem connected
- **Required packages:** `jq`, `sms-tool`
- **Optional packages:** `msmtp` (email alerts), `ethtool` (link speed control), `ookla-speedtest` (speed testing)

> Optional packages can be installed from within the app — no manual `opkg` needed.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, TypeScript 5 |
| **Styling** | Tailwind CSS v4, OKLCH colors, Euclid Circular B + Manrope |
| **Components** | shadcn/ui (42+ components), Recharts, React Hook Form + Zod |
| **Backend** | POSIX shell scripts (OpenWRT/BusyBox), CGI endpoints |
| **Real-time** | WebSocket (bandwidth monitor via websocat) |
| **AT Commands** | `qcmd` wrapper for Quectel modem serial communication |
| **Package Manager** | Bun |

---

## Architecture

```
Browser ─── authFetch() ─── CGI Scripts ─── qcmd ─── Modem (AT commands)
                │                  │
                │          Shell Libraries (11)
                │
        reads /tmp/qmanager_status.json
                │
         qmanager_poller
       (tiered polling: 2s/10s/30s)
```

The frontend is a statically-exported Next.js app served from the device. The backend is POSIX shell scripts running on OpenWRT — CGI endpoints for API requests and long-running daemons for data collection.

**Key Data Flow:**

- **Poller daemon** queries the modem via AT commands every 2–30s (3 tiers) and writes a JSON cache file
- **CGI endpoints** (58 scripts) read the cache for GET requests, execute AT commands for POST requests
- **React hooks** (38 custom hooks) poll the CGI layer and provide loading/error/staleness states
- **WebSocket** provides real-time bandwidth data directly to the dashboard

See [full documentation](docs/README.md) for architecture details, API reference, and development guides.

---

## Development

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or Node.js 18+

### Getting Started

```bash
# Clone the repository
git clone https://github.com/dr-dolomite/qmanager.git
cd qmanager

# Install dependencies
bun install

# Start development server (proxies API to modem at 192.168.224.1)
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
# Static export to out/
bun run build

# Full package (frontend + backend tarball + checksum)
bun run package
```

The `package` script builds the frontend, bundles it with backend scripts into a tarball, and generates a SHA-256 checksum — ready for distribution via GitHub Releases.

---

## Project Structure

```
QManager/
├── app/                        # Next.js App Router pages (39 routes)
│   ├── dashboard/              # Home — live signal monitoring
│   ├── cellular/               # Cellular info, SMS, profiles, band/tower/freq locking,
│   │                           #   cell scanner, APN, IMEI, FPLMN, network priority
│   ├── local-network/          # Ethernet, IP passthrough, DNS, TTL, MTU,
│   │                           #   video optimizer, traffic masquerade
│   ├── monitoring/             # Network events, latency, email alerts, watchdog,
│   │                           #   Tailscale, logs, software updates
│   ├── system-settings/        # System config, bandwidth monitor, AT terminal
│   └── (login, setup, reboot, about-device, support)
├── components/                 # React components (~185 files)
│   ├── ui/                     # shadcn/ui primitives (42+ components)
│   ├── cellular/               # Cellular management UI
│   ├── dashboard/              # Home dashboard cards
│   ├── local-network/          # Network settings UI
│   ├── monitoring/             # Monitoring & alerts UI
│   └── system-settings/        # System configuration UI
├── hooks/                      # Custom React hooks (38 files)
├── types/                      # TypeScript interfaces (17 files)
├── lib/                        # Utilities (auth-fetch, earfcn, csv)
├── constants/                  # Static data (MNO presets, event labels)
├── scripts/                    # Backend shell scripts
│   ├── etc/init.d/             # Init.d services (11)
│   ├── usr/bin/                # Daemons & utilities (35)
│   ├── usr/lib/qmanager/       # Shared libraries (11)
│   ├── www/cgi-bin/            # CGI endpoints (58 scripts)
│   ├── install.sh              # Device installation script
│   └── uninstall.sh            # Clean removal script
├── docs/                       # Documentation
└── qmanager-installer.sh       # One-liner installer (fetches release + runs install.sh)
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [Documentation Index](docs/README.md) | Overview and links to all docs |
| [Architecture](docs/ARCHITECTURE.md) | System architecture, data flow, polling tiers |
| [Frontend Guide](docs/FRONTEND.md) | Components, hooks, pages, routing |
| [Backend Guide](docs/BACKEND.md) | Shell scripts, daemons, CGI endpoints |
| [API Reference](docs/API-REFERENCE.md) | Complete CGI endpoint reference |
| [Design System](docs/DESIGN-SYSTEM.md) | Colors, typography, UI conventions |
| [Deployment Guide](docs/DEPLOYMENT.md) | Building and deploying to OpenWRT |

---

## Backend Services

QManager runs 11 init.d services on the device:

| Service | Purpose |
|---------|---------|
| `qmanager` | Main poller daemon — tiered AT polling, JSON cache, event detection |
| `qmanager_watchcat` | Connection watchdog — 4-tier auto-recovery state machine |
| `qmanager_bandwidth` | Live bandwidth monitor — WebSocket + traffic binary |
| `qmanager_dpi` | DPI service — nfqws in video optimizer or traffic masquerade mode |
| `qmanager_wan_guard` | WAN guard — disables phantom CID profiles at boot |
| `qmanager_tower_failover` | Tower failover — restores lock after cell loss |
| `qmanager_eth_link` | Ethernet link speed — applies saved speed/duplex settings |
| `qmanager_ttl` | TTL/HL — applies iptables rules at boot |
| `qmanager_mtu` | MTU — applies interface MTU settings |
| `qmanager_imei_check` | IMEI integrity — verifies IMEI backup on boot |
| `qmanager_low_power_check` | Low power — re-enters CFUN=0 if inside scheduled window |

---

## Support the Project

<div align="center">
  <h3>Support QManager's Development</h3>
  <p>Your contribution helps maintain the project and fund continued development, testing on new cellular networks, and hardware costs.</p>
  <br/>
  <a href="https://ko-fi.com/drdolomite" target="_blank">
    <img height="64" style="border:0;height:64px;" src="https://storage.ko-fi.com/cdn/kofi1.png?v=3" alt="Buy Me a Coffee at ko-fi.com" />
  </a>
  <br/><br/>
  <a href="https://paypal.me/iamrusss" target="_blank">
    <img height="40" src="https://img.shields.io/badge/PayPal-00457C?style=for-the-badge&logo=paypal&logoColor=white" alt="Donate via PayPal" />
  </a>
</div>

---

## License

This project is licensed under the [MIT License](LICENSE) — see the LICENSE file for details.

---

<div align="center">
  <p>Built with care by <a href="https://github.com/dr-dolomite">DrDolomite</a></p>
</div>
