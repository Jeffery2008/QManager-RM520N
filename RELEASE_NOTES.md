# 🚀 QManager RM520N BETA v0.1.17-draft

Save buttons now live in one consistent place — the bottom edge of the card they belong to — starting with the cellular locking cards, then Local Network, then Monitoring (where the Watchdog page loses its separate save bar).

> One-click OTA from **System Settings → Software Update** if you're on v0.1.5 or newer.

## 🛠️ Improvements

- **Settings cards now save from a bottom row on the card itself.** On the cellular locking cards, the Local Network pages and the Monitoring pages, status sits on the left and **Discard** then **Save** sit on the right, instead of a button in the middle of the card, a bar under the card grid, or a bar that floats over the page. (Card-Foot Apply sweep: the remaining `SaveButton` sites move to `CardFoot`, grouped by route family.)
- **Watchdog saves from its card.** **Monitoring → Watchdog** no longer has a page-level save bar; each card carries its own Save row.
- **Secondary buttons beside Save are quieter.** Actions such as **Restore all** in the band grid now use a plain or softly tinted button instead of a stroked outline, so **Save** stays the one button that stands out.
- **Saving is confirmed by a toast, not a label that fades.** The "Saved" text that blinked beside the Save button in Alerts, Watchdog, Scheduled Reboot and the Ethernet speed limit is gone, and **Cellular → Settings** now shows a toast when your changes apply (or names the settings that failed). (The five fading labels all ran on a 1.8 s timer; the toast already existed on four of them.)

## 📥 Installation

### Upgrading from v0.1.16

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
