# 🚀 QManager RM520N BETA v0.1.17-draft

Every settings card in the app now saves from the same place — a row along the bottom edge of the card — and the separate save bars on Watchdog and Cellular Settings are gone.

> One-click OTA from **System Settings → Software Update** if you're on v0.1.5 or newer.

## ✨ New Features

- **Sites monitor (backend only, page coming).** QManager now checks how quickly 13 popular sites (Google, YouTube, Discord and others) answer over your cellular link every 5 minutes and keeps up to 90 days of history; there is no page to show it yet. (New `qmanager_sites` service; the number is the TCP connect time, so DNS is not counted.)
- **DNS lookup time is measured.** QManager now times a name lookup against your carrier's DNS server once a minute and right after a drop, and shows it as the **DNS lookup** row on the dashboard's Connection Quality card. (`connectivity.dns_lookup_ms` in the status data; the row shows an empty bar while lookups fail.)

## 🛠️ Improvements

- **One outage, one alert.** An internet drop now appears in **Monitoring → Network Events** as one "Internet Lost" / "Internet Restored" pair, without extra high packet loss rows, and SMS, email and Discord only hear about drops that last longer than your alert wait (5 minutes by default). (The wait you set on **Monitoring → Alerts** now applies to every channel; the down SMS is no longer held back while the Watchdog is mid-recovery.)
- **Connection Quality card on the dashboard.** The Live Latency chart is replaced by a card in the middle of the dashboard's three-card row that shows your current internet and DNS response times, 30 minutes of reachability and jitter, and typical, worst and loss figures, with the speed test along its bottom. (The latency bars and the reachability strip turn amber and red at the latency and loss thresholds you set in **System Settings → Connection Quality**.)
- **Watchdog and Connection Quality share one probe setting.** **Probe every** on **Monitoring → Watchdog** now shows and changes the same probe interval Connection Quality uses, and the Watchdog decides a link is down by how long it has been failing rather than by counting probes.
- **"Unstable" follows your loss threshold.** The dashboard's Internet chip now reads Unstable only when packet loss reaches the threshold you chose in **System Settings → Connection Quality** (30% by default), instead of a fixed 10%.
- **Settings cards save from a bottom row on the card itself.** Band, frequency and tower locking, IMEI, APN, MBN, Network Priority, SMS Forwarding, TTL, MTU, Custom DNS, IP Passthrough, System Settings, SSH password, Connection Quality and Alerts now show status on the left and **Discard** then **Save** on the right, instead of a button mid-card or a bar under the cards. (21 `SaveButton` sites moved to `CardFoot`; Discard is always shown and greyed out until you change something.)
- **A compact, easier-to-scan Watchdog page.** **Monitoring → Watchdog** now opens with one status card (current state, the key counts and a strip of recent probes), with the Recovery ladder and Detection side by side below it, each with its own Save, so saving one card never commits the other's edits. (Recovery steps are On/Off pills, the backup SIM is one Slot 1 / Slot 2 / Off choice, Detection shows roughly when each step would run, and Recovery activity lists the newest five events with a link to the full log.)
- **Cellular Settings saves from the Network card.** On **Cellular → Settings**, the SIM and Network cards still share one Save, now in the Network card's footer, and **Re-read from modem** moved into that footer too.
- **Buttons beside Save are quieter.** **Restore all supported** (band locking), **Clear LTE/NR lock** (frequency locking), **Remove Lock** (tower locking) and **Add resolver** (Custom DNS) are now plain tinted buttons with no outline or icon, so **Save** is the one button that stands out.
- **On/off settings are now a pill, not a bare switch.** The enable toggles on the cards that moved to a bottom Save row (Custom DNS, TTL, MTU, tower locking, watchdog master, alerts channels, MBN auto-select, backup IMEI, SMS forwarding) now show an **On / Off** pill with a check on the active side. (`SegmentedField`, 11 `Switch` sites; per-row toggles and autosave toggles stay switches.)
- **Saving is confirmed by a toast, not a label that fades.** The "Saved" text that blinked beside the Save button in Alerts, Watchdog, Scheduled Reboot and the Ethernet speed limit is gone, and **Cellular → Settings** now shows a toast when your changes apply (or names the settings that failed). (The five fading labels all ran on a 1.8 s timer; the toast already existed on four of them.)
- **"No automatic recovery" is now blue.** On **Cellular → Frequency Locking**, the chip on the locked verdict is a filled info chip instead of a grey one, so it reads as a fact rather than a disabled state.
- **Frequency Calculator channel label has a separator.** On **Cellular → Cell Scanner → Frequency Calculator**, the answer now reads "EARFCN 1350 · downlink" instead of running the two together. (`readout.channel_lte` / `channel_nr` in all five language packs.)
- **Buttons and fields look the same everywhere.** Every button is a rounded pill, main page actions share one 42px size (the Monitoring pages' buttons grew to match), and text boxes and dropdowns share one shape and fill on every page. (`Button size="action"`; `Input`, `Select`, `Textarea` and `InputGroup` share one field style with a `host` fill.)
- **Cell Scanner and Neighboring Cells have a new layout.** Both pages start as a compact launch bar and show results as one summary card (the total, then a row per carrier with your SIM's first, or per neighbour type) above a table sorted strongest signal first, with **Download CSV** beside the filter. The sweep shows an estimated progress bar, and **Lock to this cell** is greyed out, with the reason, for cells on another carrier. (The bar is an estimate: the modem reports nothing until the sweep ends.)
- **Cards no longer show file paths.** The "Read back from: /etc/qmanager/…" and "Saved to the modem" lines are gone from **Ethernet**, **IP Passthrough**, **TTL & MTU** and **Custom DNS**, so the pages read as a finished product instead of a debug build. (Six `provenance` keys removed from all five language packs.)
- **Animations are consistent across the app.** The **Animations** setting in the sidebar account menu (Full / Reduced / System) now applies on every page, and transitions share one timing and style throughout.

## 🐛 Fixes

- **Watchdog no longer escalates on missing data.** If probe results go missing after a recovery step, the Watchdog now goes back to monitoring instead of trying the next step, and switches back to your main SIM if it was trying the backup. (Before, missing data counted as a failed step and could walk the ladder toward a reboot.)
- **TTL & MTU Apply buttons match their Discard buttons.** On **Local Network → TTL & MTU Settings**, the Apply buttons were smaller and squarer than the Discard pill beside them; they are now the same 42px pill.
- **Neighboring Cells "Read failed" card gives the right advice.** It used to tell you to run the sweep again; it now says to read again.
- **Neighboring Cells counts cells, not bands.** After a read, the summary on **Cell Scanner → Neighboring Cells** now shows a check and "9 neighbours" instead of "9 available bands", and the per-type rows count cells; Cell Scanner's summary gets the same check-and-total layout.

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
