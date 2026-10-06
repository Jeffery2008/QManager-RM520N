# Colour System — roles, hue arithmetic, and the CVD floor

QManager's palette is a **role system**, not a swatch list: every colour in `app/globals.css` answers a question about *what a thing is*, and a surface picks a token by answering that question rather than by picking a colour it likes. `DESIGN.md` > Colors is the binding canon for what each role means and what its OKLCH values are. **This doc is the other half** — the measurements, the arithmetic, and the traps that explain *why* those values are what they are, and which of them must not be "tidied up" by a future pass.

Read this before adding a colour, retuning one, or looking at a token that seems out of line with its siblings. At least one of them is out of line on purpose.

> ℹ️ NOTE — jargon used throughout. **OKLCH** is a perceptual colour space: `oklch(L C H)` is lightness (0–1), chroma (saturation), hue angle (0–360°). Unlike hex or HSL, equal steps in L look like equal steps to the eye, which is what makes the measurements below meaningful. **CVD** is colour-vision deficiency; **deuteranopia** and **protanopia** are the two common red-green forms, together affecting roughly 1 in 12 men. **Container** vs **strong fill**: Material 3 pairs every role as a pale tinted surface (`--x-container`, for large blocks) and a saturated fill (`--x`, for small emphatic marks), each with its own guaranteed-legible ink.

## Quick Reference

| Thing | Where |
| ----- | ----- |
| Token definitions (both themes) | `app/globals.css` |
| Tailwind mappings | `@theme inline` block in the same file |
| Canon (meanings, values, rules) | `DESIGN.md` > Colors |
| Chip roles | `components/ui/badge.tsx` |
| Separation rule | **Measured, not hue arithmetic** (`DESIGN.md` > The Measured-Separation Rule). The old 40-degree rule is retired; see below |
| CVD collapse floor between two tones | **0.05** simulated separation, on the layer the colour ships on |
| Signal-quality ramp (the one scale, not a role) | `--quality-{1..5}` / `--quality-{1..5}-bar`; mapped by `components/cellular/signal-quality-display.ts` |

## The role families

| Family | Tokens | Means | Axis |
| ------ | ------ | ----- | ---- |
| Primary / NR blue | `--primary-*`, followed by `--info`, `--ring`, `--sidebar-primary`; `--chart-nr` tracks `--primary-on-surface` | 5G NR **identity**, the brand, "in progress", info | Identity |
| Carrier Violet | `--lte-*`, `--chart-lte` | 4G LTE **identity** | Identity |
| **Downlink Rose** | `--downlink`, `-foreground`, `-on-surface`, `-container`, `--on-downlink-container` | The **download direction**, and nothing else | Direction |
| **Uplink Cyan** | `--uplink`, `-foreground`, `-on-surface`, `-container`, `--on-uplink-container` | The **upload direction**, and nothing else | Direction |
| **Spatial Azure** | `--spatial`, `-foreground`, `-on-surface`, `-container`, `--on-spatial-container` | **Antenna and spatial-stream readouts** — MIMO layer counts, per-antenna chains | Spatial |
| Success / Warning / Destructive | `--success-*`, `--warning-*`, `--destructive-*` | Functional verdicts only | Status |
| Neutral ramp | `--surface-*`, `--on-surface*`, `--outline` | No claim at all | — |

Each family ships the same five-token shape: the **strong fill**, its `-foreground` ink, an `-on-surface` **tinted-ink** step for text on a plain card, the `-container`, and the container's `on-` ink. Take a **pair**, never a crossed one: `bg-downlink` goes with `text-downlink-foreground`, `bg-downlink-container` with `text-on-downlink-container`. A container fill under a strong fill's ink is the single most common way this system goes wrong.

## The Direction-Is-Not-A-Radio rule

**Short version: which way the bytes are going and which radio is carrying them are two independent facts, so they get two independent hue axes.** Before 2026-08-16 they shared one, and the damage only showed up across pages.

Download used to be `--primary` — which is simultaneously the 5G NR identity, the brand, and "in progress". Upload used to be `--lte`, the 4G LTE identity (except on the dashboard data-usage row, which had always used cyan). So a user learned *blue = download* on the speedtest dialog and met *blue = NR* two clicks later on the Radio Information page; and an LTE speedtest painted its upload figure in the LTE hue for reasons that had nothing to do with LTE.

Downlink Rose exists to break that overload. Both direction roles now hold hues that **cannot** be confused for a radio, which is what lets a rose download chip sit *inside* a violet LTE block and read as two independent facts rather than one muddled one.

### Where each direction hue lands

| Surface | Download | Upload |
| ------- | -------- | ------ |
| Speedtest dialog `ROLE` map (`speedtest-dialog.tsx`) | `downlink-*` | `uplink-*` |
| Cached speedtest figures (`live-latency.tsx`) and Device Metrics data-usage glyphs (`device-metrics.tsx`), via `DIRECTION` in `dashboard/shapes.ts` | `text-downlink-on-surface` + `arrow_circle_down` | `text-uplink-on-surface` + `arrow_circle_up` |
| AMBR rate chips (`RATE_CHIP.ON_DOWNLOAD` / `.ON_UPLOAD`, `cellular/settings/shapes.ts`) | `bg-downlink` | `bg-uplink` |

Three consequences that are easy to get wrong:

- **A capacity or a count takes neither.** An aggregate channel width, a negotiated link rate or a client or carrier count is not a direction. Rose would claim a download it is not, cyan an upload. These were rose and cyan until 2026-08-16 (the old rule gave rose "and capacity" and cyan "and counts"), which made the axis untrue; `DESIGN.md` > Colors > Direction deleted both second meanings. The Radio Information Carriers tile, the antenna-statistics chain-count tile, the Traffic Engine counts and the Ethernet link-rate tile are neutral now (The Neutral-Default Rule).
- **A directionless figure takes neither.** Latency has no direction, so the speedtest's ping role is neutral. Packet loss on the Live Latency chart is neutral for the same reason plus one more: painting it from the functional ramp would draw a healthy 0% line permanently red, and this product reports rather than alarms.
- **Direction always pairs its hue with an arrow glyph.** Hue alone never says which way.

> ⚠️ Residual deviations, tracked in `DESIGN.md` > Migration Deltas (grep `bg-downlink|bg-uplink|text-uplink` over `components app`, 2026-10-06): `BANDWIDTH_DISC` in `components/cellular/radio/summary-tiles.tsx` and `DISC_RATE` in `components/cellular/settings/shapes.ts` still colour a capacity on `bg-downlink`, and the Donate glyph in `components/nav-section.tsx` wears `text-uplink`. All three contradict the rule above. Move them to neutral when you next touch the surface, and correct the comment beside each in the same change.

## The Fact-Is-Info Rule

**A fact worth knowing that is neither a fault nor health uses the `info` role: a filled `Badge variant="info"` with a glyph, shown only while the fact applies.** A grey outline reads as disabled or unavailable, amber as a problem and green as healthy, so none of them can honestly say "this will take a minute" or "this is a preview". `info` is the brand ramp (The Info-Is-Brand Rule), so it adds no hue; and because the chip appears only while the fact holds, the exception wears the fill and the default stays quiet (The Quiet-Default Rule).

> ⚠️ `Badge variant="info"` is `bg-primary-container text-on-primary-container`, the exact pair a promoted `primary-container` row uses, so on such a row the chip dissolves to a bare glyph and a word. Re-ground the chip on the row's own ink (see `.claude/agent-memory/ui-builder/reference-info-chip-dissolves-on-primary-container.md`). `muted`, `success`, `warning` and `destructive` do not collide.

> ℹ️ NOTE — open case, tracked in `DESIGN.md` > Migration Deltas: Frequency Locking's "No automatic recovery" chip (`cellular/frequency-locking/freq-lock-hero.tsx`, `verdict.no_recovery`) is still `Badge variant="muted"`. It sits on the amber locked-verdict panel, where `info` has not been measured, so measure the pair in both themes before switching it and do not claim the chip conforms until then.

## Hue slots, and the retired 40-degree rule

> ℹ️ NOTE — **superseded as a rule, kept as history.** This section used to state a 40-degree minimum between a decorative hue and a functional one. `DESIGN.md` retired it: **The Measured-Separation Rule** says colour is measured (deuteranopia and protanopia, OKLab ΔE, the 0.05 floor, on the layer the colour ships on), never reasoned from degrees of hue. The rule behaved like the proxy it was, permitting pairs that collapsed and forbidding pairs that were fine. The slot table and the two traps below still describe real constraints; the arithmetic no longer decides anything.

Hues in `app/globals.css`:

| Hue | Role |
| --- | ---- |
| 27 | destructive |
| 72 | warning |
| 149 | success |
| 200 | uplink |
| 232 | spatial |
| 262 | primary / NR / info |
| 296 | lte |
| 341 | downlink |

**Why 341.** Under the old rule, sweeping all 360 degrees against the then-taken slots (27, 72, 149, 200, 262, 296) left exactly one window clearing 40 degrees of every one of them, h in [336, 347]. Downlink Rose sat at the middle of it, so 341 was the only wholly-unconstrained slot, not an eyeballed one. It is kept because the measurements later confirmed it rather than because the arithmetic demanded it: rose against destructive red, the riskiest adjacency, measured **0.47 separation in dark and 0.25 in light** against the 0.05 floor (2026-08-16, not re-run since).

**The real failure mode.** A decorative hue mistaken for a functional one is a lie about the device: a tile that reads as `warning` when nothing is wrong. Two decorative hues sitting close is a legibility question, not an honesty one, and legibility has other channels (a glyph, a label, a lightness step). The system has always accepted this: NR 262 and LTE 296 are 34 degrees apart, and Spatial Azure at 232 is 30 degrees from the brand ramp and 32 from Uplink Cyan. Spatial Azure's nearest functional hue is success, 83 degrees away.

**The trap, and it is counter-intuitive.** The widest unused position on the circle is hue ~110, at 38.5 degrees from both warning (72) and success (149). It looks like the best remaining slot and is the worst one: a yellow-green sitting precisely where deuteranopia merges amber into green, so it is maximally confusable with the two functional states it is nearest. Anyone hunting for "the biggest gap" finds 110 first. Do not take it.

**What a fifth role costs.** No wholly-unconstrained slot remains. A new role must accept decorative crowding (measure the functional distance first and the decorative second, and state both), or take a neutral, a lightness step or a non-chromatic channel. It should also justify a *class* of readout rather than one surface: Spatial Azure was minted because MIMO layers, per-antenna chains and the alignment surfaces are a whole family with no axis, not because one tile looked plain.

> ℹ️ NOTE — precedent. Uplink Cyan sits at 200 rather than the design bundle's literal 185 because 185 was 36 degrees from success at 149. The old rule bit once, and the measurement agreed.

## Dark-mode identity fills

On 2026-08-16 the three identity fills were first toned down from L 0.79–0.81 to 0.72–0.74 on a near-black ground, because the brightest objects in the interface were carrying the least information. **That interim step was superseded by the bolder-chroma retune; the shipped dark fills are now the `.dark` block of `app/globals.css`:**

| Token | Dark L (C) | Light L (C) |
| ----- | ---------- | ----------- |
| `--primary` (hue 262) | **0.605** (0.200) | 0.565 (0.235) |
| `--lte` (296) | **0.70** (0.175) | 0.51 (0.24) |
| `--uplink` (200) | **0.82** (0.137) | 0.545 (0.091) |
| `--downlink` (341) | **0.66** (0.200) | 0.48 (0.204) |
| `--spatial` (232) | **0.79** (0.127) | 0.55 (0.11) |

The aliases follow their sources: `--info`, `--ring`, `--sidebar-primary` and `--sidebar-ring` track `--primary` (dark 0.605), while `--chart-nr` and `--chart-lte` track the `-on-surface` inks (dark 0.65 and 0.74), not the fills. Retuning one without its aliases silently splits the brand.

The ink-contrast and CVD figures quoted when the interim step landed (ink 7.2–7.7:1; NR and LTE 0.094 apart under protanopia at 0.72 / 0.73, with 0.76 skipped because it measured 0.047) were taken at the earlier values and **have not been re-run** at 0.605 / 0.70. Do not cite them as current. `DESIGN.md` carries the current claim (ink pairs separate in 0 of 28 pairs, both themes).

> ⚠️ Toning a token is not the strongest lever available. Moving a block from a **strong fill** to a **container** was worth roughly a 0.47 lightness drop in dark mode at the interim values, an order of magnitude more than any token nudge. When a surface reads loud, check the role choice before reaching for the value. The Radio Information summary strip is the worked example ([radio-information.md](radio-information.md)).

## `--lte-container` light: a correctness fix, not a taste change

Light-mode `--lte-container` was moved down from **L 0.90**, and ships at **L 0.85** now (`oklch(0.85 0.082 296)`); `--primary-container` is **0.89**.

At 0.90 it measured **0.007** separation from `--primary-container` (then L 0.885) under protanopia simulation. In plain terms: **light-mode NR and LTE were the same object to a red-blind user**, the exact failure mode `DESIGN.md` bans the generic `--chart-1..5` ramp for. The fix took the separation to **0.156** at the 2026-08-16 values (0.855 against 0.885, ink 10.1:1). The shipped lightness gap is wider now (0.04 against 0.03), so the direction is the same, but that figure was not re-measured at the current values.

This is why the change is filed as a correctness fix. Anyone reverting it on aesthetic grounds is reintroducing a defect, not a preference. Note that `DESIGN.md` also restricts large containers to the functional roles, because identity containers collapse in light mode (8 of 10 pairs), so an identity container is rarely drawn at all; the tokens still have to be right for the places they are.

## The trap: never equalise `--primary-container` and `--lte-container` in dark

**Dark `--primary-container` sits at L 0.375 and `--lte-container` at 0.27, a 0.105 lightness gap. That can look like a calibration defect. It is not, and closing the gap breaks the system.**

Why the gap has to be there: NR blue (262) and LTE violet (296) are **34 degrees apart**, so hue cannot separate them and **lightness carries the whole distinction**. Equalising them collapsed the pair to **0.049** against **0.216** for the shipped pair (measured 2026-08-16 against the earlier 0.40 / 0.325 pair; not re-run at the current values, but the mechanism is unchanged).

The gap has a cost, and the cost is paid by *routing around it*, never by levelling it. On a dark tile `primary-container` lifts further off the page ground than its quiet siblings did (2.06:1 against 1.49–1.53:1 when measured), which is why Recent Activities keeps routine events on the neutral ramp: a routine handoff must not out-shout an outage ([recent-activities.md](recent-activities.md)). The Radio Information doc previously carried a "known token asymmetry" note proposing exactly this levelling in a future token pass. That note is **retracted**.

Before touching either token, re-run the CVD simulation on the pair.

## The CVD floor, and what colour can actually do on a dark surface

**Short version: in dark mode, container tints are decoration. The glyph and the label are the information.**

Simulating deuteranopia and protanopia across this system's **container** tones in dark mode, nearly every pair collapses below the 0.05 separation floor — **including pairs that already ship**: success/warning, warning/destructive, and uplink against a plain `surface-container`. Light-mode containers are clean, and **strong fills separate cleanly in both themes**.

Three design consequences follow, and they are not optional:

1. **Every status chip carries an icon**, and two states in one slot never share a glyph. `success-container` and `warning-container` measure ~1.03:1 apart in ordinary vision *before* any simulation — the glyph is the only thing separating healthy from degraded.
2. **Every direction chip carries an arrow.** Same mechanism, same non-negotiability.
3. **Colour that must survive belongs on the small strong-filled element** — a 52px disc, a chip — not on the large tinted body. This is why the `/cellular/` summary tiles put the fill on the disc and leave the tile body neutral ([radio-information.md](radio-information.md)).
4. **Identity never renders as a container at all.** It renders as **ink** or as an **outline tag** (`components/ui/tag.tsx`, variants `nr` / `lte` / `spatial` / `neutral`, consuming `--tag-*-text` / `--tag-*-border`), or as a strong **fill** on a glyph disc. Those tag tokens shipped without consumers on 2026-08-16 and were wired up on 2026-08-17, when all 11 identity chip sites moved off `Badge`; `nr` / `lte` / `spatial` / `downlink` / `uplink` were then deleted from `badge.tsx`, so `BadgeVariant` is now status-only and the split is compiler-enforced.

A useful way to hold it: on a dark surface, a container tint groups things; a strong fill and a glyph distinguish them. Ask a tint to distinguish and it will fail for one reader in twelve.

## The signal-quality ramp

**Short version: this is the one scale in the system that deliberately breaks the 0.05 floor above, and it is only safe because colour is never the ramp's only channel. A bar carries the magnitude and `QUALITY_GLYPH` carries the stop.**

`--quality-1` … `--quality-5` (plus a `-bar` sibling for each) are a **five-stop continuous scale** for measured signal quality: RSRP, RSRQ, SINR, aim score. Every other colour in this document is a *category* — it answers "what kind of thing is this". The ramp is a **position on a scale**, and that difference drives everything below.

They shipped in `fefba29` with no consumer at all. As of **2026-08-17** ten surfaces read them, through the single canonical map in `components/cellular/signal-quality-display.ts`.

### Two channels, one step apart

| Token | Drawn as | Reached through |
| ----- | -------- | --------------- |
| `--quality-N` | The **numeral** ink | `qualityInkClass()` → `text-quality-N` |
| `--quality-N-bar` | The **bar** fill, one lightness step bolder | `qualityMeterTone()` → `MetricBar`'s `TONE_CLASS` |

The bar value is bolder because a 4px fill needs more weight than a text figure to read as the same colour. They are not interchangeable.

### It is a lightness staircase, not a hue wheel

This is the load-bearing fact. Under deuteranopia, hues 27 / 45 / 72 / 115 / 149 flatten onto a **single yellow axis** — the ramp cannot separate by hue *at all* for those readers. So each ramp is monotone in lightness (light 0.385 → 0.505 in 0.030 steps; dark 0.620 → 0.800 in 0.045 steps), and the staircase is what carries it.

**Adjacent stops sit deliberately below the 0.05 floor.** Every non-adjacent pair clears it (worst: 0.055 light, 0.077 dark). That is a designed trade, not an oversight — and the thing bought with it is resolution, five levels where the functional roles could only afford four.

**What each channel actually carries.** Bar **length** carries *magnitude within the scale*, not the stop boundary. `signalToProgress()` is a continuous map, so at any cut it draws both sides nearly the same (an RSRP of -80 dBm is 100% and -81 dBm is 98.3%), and that is honest: two readings 1 dB apart *are* nearly the same signal. What separates one **stop** from the next is `QUALITY_GLYPH`'s monotonic wedge ladder, which survives greyscale and every CVD type. Widening the map would not change this; it would reproduce the same near-identity at every cut while shortening every bar. Recorded 2026-08-23 after a review proposed exactly that widening.

> ⚠️ WARNING: the trade only pays if a **second channel is present**. Ramp ink on a numeral with no bar beside it is a **bug**, not a shortcut: it leaves colour as the only carrier, which for one reader in twelve is no carrier at all. Two independent guards exist in code: `qualityMeterTone()` returns `null` rather than a colour for `none`, and `MetricBar value={null}` draws the track with no fill element at all. A caller that `??`-es a fallback colour past either one re-creates the exact bug this migration removed, where an unread antenna painted green.

### Light-mode stops 1–3 are deep reds and browns, and that is a ceiling

4.5:1 against a near-white ground caps those hues at **L ≈ 0.50**, and the non-adjacent floor then forces the whole span downward from that cap. The result reads as maroon and umber rather than vivid red-orange. **Do not "fix" it by brightening** — the contrast requirement is what put it there. Dark mode is genuinely vivid (#ed4b43 → #42e071) because a dark ground has the headroom light does not. Verified on screen in both themes, 2026-08-17.

Where a numeral is large enough to fall under the 3:1 threshold instead of 4.5:1, use the `-bar` value as its ink.

### The ramp is a scale; chips are categories. They did not merge

`BadgeVariant` still carries only the five status roles. So `bad` and `poor` both key onto `destructive`, and their **glyphs** separate them (`signal_cellular_0_bar` vs `signal_cellular_1_bar`) — the same Every-Chip-Has-A-Glyph obligation the CVD floor imposes on every other chip above.

Giving chips a fifth failure step would mean minting a `--quality-N-container` / `--on-quality-N-container` pair for every stop, each needing its own contrast and CVD work against both grounds. That was deliberately not attempted. If a future pass wants it, it is a token-layer change with the arithmetic in this document, not a component tweak.

## Related docs

- [radio-information.md](radio-information.md) — the four summary tiles: the worked example of role choice beating token tuning, and of the tile bodies going neutral so colour survives only where it is true.
- [speedtest.md](speedtest.md) — the direction contract from tile to dialog to result.
- [dashboard-chart-cards.md](dashboard-chart-cards.md) — why the packet-loss series is neutral ink.
- [ethernet.md](ethernet.md) — the link-speed tile, which went neutral because a rate is not a direction.
- [cellular-settings-family.md](cellular-settings-family.md) — the AMBR rate chips, and why direction chips sit *on* a radio container rather than borrowing from it.
- [icon-system.md](icon-system.md) — the identity outline `Tag` variants, and the glyph obligations that come with them.
- [recent-activities.md](recent-activities.md) — routing around the `primary-container` lightness outlier.
