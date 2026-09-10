# 🚀 QManager RM520N BETA v0.1.15

The important one: turning on Video Optimizer or Full Bypass can no longer take your whole network down with it. Also in here — SMS Center tells you the real reason a message failed to send instead of always blaming a busy modem, and Software Update drops its duplicate buttons and status pills.

> One-click OTA from **System Settings → Software Update** if you're on v0.1.5 or newer.

## 🛠️ Improvements

- **Software Update now has one button, not three.** **System Settings → Software Update** keeps a single **Check again** at the top and moves **Download** / **Install** down onto the version row inside the update card, where the package size and channel tags used to sit. The duplicate status pills — the one beside the card title and the one in the Update status row — are gone; the step list underneath already reports what is running.

## 🐛 Fixes

- **Turning on the Traffic Engine can no longer kill every device on your network — including your access to QManager itself.** If the engine failed to start (or was never installed), **Local Network → Traffic Engine** still sent all LAN web traffic to it, so nothing loaded and the settings page you'd use to switch it back off was unreachable too. The redirect now goes up only once the engine is confirmed listening, and is removed the instant it stops or crashes.
- **Switching between Video Optimizer and Full Bypass now actually switches.** Picking the other mode in **Traffic Engine → Bypass mode** used to save your choice while the engine quietly kept running the old one, so Full Bypass never applied. The engine is now restarted on the switch, and a start failure reports as an error instead of a false success.
- **The Traffic Engine no longer listens on every interface, including the carrier side.** It now binds only your LAN address, closing a proxy port that was reachable from outside the modem. No action needed on your side — update and it's closed.
- **Full Bypass survives an update or reinstall.** The installer only ever restarted the engine for Video Optimizer users, so a Full Bypass setup came back with the feature switched on in the UI and nothing running behind it.
- **The bypass test says what it measures.** Renamed to **Bypass benefit test** and given a scope line, because it tests whether the technique helps on your connection using its own temporary proxy — it never checked the engine you have running, and a passing result was easy to read as "the engine is fine". Engine health is the live status row above it.
- **SMS Center no longer blames "modem busy" for a message that actually failed to send.** A genuine send failure — a bad number, no SMS center configured, the modem not registered — was being reported as "Could not acquire AT lock" purely by coincidence: the two very different failures shared one internal status code. Send failures now show their real reason, and a true busy-modem retry still reports as busy.
- **The Cell Scanner results panel no longer resizes the page when you start your first sweep.** It's mounted from the start now, showing its empty state up front instead of popping in and pushing the layout down.

## 📥 Installation

### Upgrading from v0.1.14

**System Settings → Software Update** → Download → Install. No SSH/ADB needed. All settings preserved.

### Fresh Install

> **No SimpleAdmin required.** QManager installs completely standalone — you do **not** need to install (or uninstall) SimpleAdmin or the RGMII toolkit first. The installer bootstraps everything itself (Entware, web server, users, services).

SSH or ADB into the modem and run:

```sh
curl -fsSL -o /tmp/qmanager-installer.sh \
  https://github.com/dr-dolomite/QManager-RM520N/raw/refs/heads/main/qmanager-installer.sh && \
  bash /tmp/qmanager-installer.sh
```

No `curl`? Use `wget` — the installer works either way:

```sh
wget -O /tmp/qmanager-installer.sh \
  https://github.com/dr-dolomite/QManager-RM520N/raw/refs/heads/main/qmanager-installer.sh && \
  bash /tmp/qmanager-installer.sh
```

## 💙 Thank You!

Bug reports and feature requests welcome on [GitHub Issues](https://github.com/dr-dolomite/QManager-RM520N/issues).

Like what's new? QManager is built and maintained for free — if these updates have made your setup a little better, you can show your support via [Wise](https://wise.com/pay/business/blackcatdev?currency=USD) or [PayPal](https://paypal.me/iamrusss). Every bit helps keep this project alive. [GitHub Sponsors](https://github.com/sponsors/dr-dolomite) works too.

**License:** MIT + Commons Clause — **Happy connecting!**
