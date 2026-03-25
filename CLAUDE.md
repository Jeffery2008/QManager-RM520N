## Design Context

### Users
- **Hobbyist power users** optimizing home cellular setups for better speeds, band locking, and coverage
- **Field technicians** deploying and maintaining Quectel modems on OpenWRT devices
- Context: users are technically literate but not necessarily developers. They want clear, actionable information without needing to memorize AT commands. Sessions range from quick checks (signal status) to focused configuration (APN, band locking, profiles).

### Brand Personality
**Modern, Approachable, Smart** — a friendly expert. Not intimidating or overly technical in presentation, but deeply capable underneath. The interface should feel like a premium tool that respects the user's intelligence without requiring them to be a modem engineer.

### Aesthetic Direction
- **Visual tone:** Clean and modern with purposeful density where data matters. Polish of Vercel/Linear meets the functional depth of Grafana/UniFi.
- **References:** Apple System Preferences (clarity, hierarchy), Vercel/Linear (typography, motion, whitespace), Grafana/Datadog (data visualization density), UniFi (network management UX patterns)
- **Anti-references:** Avoid raw terminal aesthetics, cluttered legacy network tools, or overly playful/consumer app styling. Never sacrificial clarity for visual flair.
- **Theme:** Light and dark mode, both first-class. OKLCH color system already in place.
- **Typography:** Euclid Circular B (primary), Manrope (secondary). Clean, geometric, professional.
- **Radius:** 0.65rem base — softly rounded, not pill-shaped.

### Design Principles
1. **Data clarity first** — Signal metrics, latency charts, and network status are the core experience. Every pixel should serve readability and quick comprehension. Use color, spacing, and hierarchy to make numbers scannable at a glance.
2. **Progressive disclosure** — Show the essential information upfront; advanced controls and details are accessible but not overwhelming. A quick-check user and a deep-configuration user should both feel served.
3. **Confidence through feedback** — Every action (save, reboot, apply profile) must have clear visual feedback: loading states, success confirmations, error messages. Users are changing real device settings — they need to trust what happened.
4. **Consistent, systematic** — Use the established shadcn/ui components and design tokens uniformly. No one-off styles. Cards, forms, tables, and dialogs should feel like they belong to one coherent system.
5. **Responsive and resilient** — Works on desktop monitors and tablets in the field. Degrade gracefully. Handle loading, empty, and error states intentionally — never show a blank screen.

## CGI Endpoint Reference (Additions)

| Feature      | CGI Script                   | Hook                                                   | Types                | Reboot? |
|--------------|------------------------------|--------------------------------------------------------|----------------------|---------|
| DPI Settings | `network/video_optimizer.sh` | `use-video-optimizer.ts` + `use-traffic-masquerade.ts` | `video-optimizer.ts` | No      |

## Feature-Specific Notes

### DPI Settings (DPI Evasion)

- **Page renamed** from "Video Optimizer" to "DPI Settings" — contains Video Optimizer + Traffic Masquerade cards
- **Binary**: nfqws from zapret project, installed at `/usr/bin/nfqws`
- **Not bundled**: nfqws is downloaded on demand from [zapret GitHub releases](https://github.com/bol-van/zapret/releases) via `qmanager_dpi_install` — avoids opkg dependency issues on custom firmware
- **Installer**: `qmanager_dpi_install` — detects arch, fetches `openwrt-embedded.tar.gz`, extracts arch-specific binary, installs to `/usr/bin/nfqws`
- **Installer state**: `/tmp/qmanager_dpi_install.json` (progress file), `/tmp/qmanager_dpi_install.pid` (singleton guard)
- **Hostname list**: `/etc/qmanager/video_domains.txt` (curated video CDNs, excludes generic CDN domains)
- **Video Optimizer nftables**: NFQUEUE on wwan0, queue 200, `bypass` flag for graceful failure
- **Video Optimizer strategies**: TCP SNI split (`--dpi-desync=split2`) + QUIC desync (`--dpi-desync-udplen-increment`)
- **Traffic Masquerade**: second nfqws instance (queue 201) injects fake TLS ClientHello with spoofed SNI (default: `speedtest.net`) using `--dpi-desync=fake --dpi-desync-fake-tls-mod=sni=<domain> --dpi-desync-fooling=badseq`
- **Masquerade helper**: `masq_helper.sh` — rule insertion/removal, status, uptime, packet count for the masquerade instance
- **Verification**: `qmanager_dpi_verify` — curl with `--connect-to` SNI spoofing against speed.cloudflare.com
- **Kernel support**: `dpi_check_kmod()` checks `/proc/config.gz` for `CONFIG_NETFILTER_NETLINK_QUEUE=y` (built-in) before trying lsmod/modprobe
- **Init.d**: `qmanager_dpi` (procd, START=99, UCI-gated, manages both nfqws instances)
- **Dependencies**: `libnetfilter-queue`, `libnfnetlink`, `libmnl`, full `curl` (not BusyBox); kernel NFQUEUE support (built-in or `kmod-nft-queue`)
