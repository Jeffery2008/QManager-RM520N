# 🚀 QManager RM520N BETA v0.1.16

Upstream resolvers can be switched back off again, and a visual pass: every page looks a little tighter this time — smaller, squarer corners throughout — and in dark mode, cards and every panel that opens over the page now catch a little light along their top edge.

> One-click OTA from **System Settings → Software Update** if you're on v0.1.5 or newer.

## 🛠️ Improvements

- **Corners are tighter across the whole app, and dark mode cards now catch a little light.** Cards, tiles, inputs and dialogs everywhere moved to a smaller corner radius, so a panel reads as a panel rather than a lozenge; in dark mode each card also picks up a faint highlight along its top edge that lifts it off the background. (One radius scale in the stylesheet — no page was re-laid-out.)
- **Confirmation prompts and slide-out panels no longer look flatter than the dialogs beside them.** In dark mode the same top-edge highlight now reaches every panel that opens over the page, not just the main dialog, so a "are you sure?" prompt sits at the same depth as the window it came from.

## 🐛 Fixes

- **Turning off custom upstream resolvers no longer fails with "enabled must be true or false".** In **Local Network → Upstream resolvers**, switching *Use my own resolvers* off and pressing **Save and apply** now clears the QManager block and hands DNS back to the carrier, instead of rejecting the save. (The endpoint read the flag with jq's `//` operator, which treats a literal `false` as a missing value — so every disable request arrived as an empty string.)

## 📥 Installation

### Upgrading from v0.1.15

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
