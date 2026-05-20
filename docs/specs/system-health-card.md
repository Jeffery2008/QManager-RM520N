# SPEC: System Health Card (rename + telemetry expansion of Modem Subsystem Card)

**Status:** Locked, 2026-05-08. Lightweight spec — falsifiable requirements, in-scope/out-of-scope explicit, acceptance criteria as pass/fail.

**Background:** Follow-on to `docs/specs/modem-subsystem-card.md` (already shipped, commit `017ee04`). The shipped card has a `firmware_name` row that always reads `"modem"` (the Q6 image identifier — uninformative). The actual modem firmware revision is already surfaced on the Dashboard via `components/dashboard/device-status.tsx:40`. Sysfs/procfs investigation in `docs/rm520n-sysfs-fetch-sources.md` § "CPU / memory / uptime" identified host telemetry sources we can surface in the now-empty space.

**Goal:** Remove the redundant `Firmware` row from the existing card and replace it with host system telemetry (CPU load + frequency, memory, storage). Rename card to "System Health" so the title accurately reflects the mixed modem-and-host scope.

## In Scope

1. **Backend (extend existing endpoint):** Add `cpu`, `memory`, and `storage` fields to the JSON response of `scripts/www/cgi-bin/quecmanager/system/modem-subsys.sh`. Same endpoint, same hook, same single fetch — no new CGI file.
2. **Backend reads:**
   - CPU load 1-min from `/proc/loadavg` (first field).
   - CPU core count from `nproc` (or `/proc/cpuinfo` count) for load-relative bar scaling.
   - CPU current frequency from `/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq` (kHz → display GHz).
   - CPU max frequency from `/sys/devices/system/cpu/cpu0/cpufreq/scaling_max_freq` (kHz, used for freq bar).
   - Memory: parse `/proc/meminfo` for `MemTotal` and `MemAvailable`. Used = `MemTotal − MemAvailable`. Display in MB.
   - Storage: `df -P /usrdata` parsed for total/used/percent. Display in MB.
3. **Frontend:**
   - Remove "Firmware" row from `components/system-settings/modem-subsystem-card.tsx`.
   - Add four new metric rows: **CPU Load**, **CPU Frequency**, **Memory**, **Storage** (`/usrdata`).
   - Each new metric row uses the existing `MetricBar` pattern from `components/dashboard/device-metrics.tsx:53-82` (1px animated progress bar with warn/danger color thresholds).
   - Rename `CardTitle` from "Modem Subsystem" to "System Health".
   - Update `CardDescription` to "Live modem firmware health and host system telemetry."
4. **Type definitions:** Extend `types/modem-subsys.ts` with `cpu`, `memory`, `storage` shapes (each nullable for graceful degradation).
5. **Hook:** No code change to `hooks/use-modem-subsys.ts` beyond consuming the wider response shape (response is the same JSON, just more fields).
6. **MetricBar reuse strategy:** Either (a) lift `MetricBar` to a shared location (e.g. `components/ui/metric-bar.tsx`) and import from both `device-metrics.tsx` and `modem-subsystem-card.tsx`, or (b) duplicate the small component locally. **Locked decision: lift to shared location** — the duplication would drift, and the component is < 30 lines.

## Out of Scope (explicit, with reasoning)

- **Migrating Device Metrics card to read from this new endpoint.** The Dashboard's Device Metrics card already gets `cpu_usage` / `memory_used_mb` from the poller's `device` block — different data flow, different cadence. No migration. Reason: the Dashboard's metrics use the poller cache (2s tier) for snappy live updates; the System Settings card uses the on-demand CGI (5s polling). Different consumers, different latency budgets.
- **CPU `% busy` calculation.** We are NOT computing `(jiffies user+sys)/total` deltas across reads. We display load-average instead because it's a single sysfs read and is the canonical Linux convention. Reason: keeping CGI stateless and cheap (< 100 ms p95).
- **Per-CPU breakdowns.** Single aggregate row only. Reason: SDX65 has 4 cores; per-core rows would over-fill the card.
- **Disk I/O rates / IOPS.** No `/proc/diskstats` parsing. Reason: not in user request, would need delta computation across reads (stateless CGI again).
- **Rootfs (`/`) usage.** Not surfaced — it's read-only and effectively static. Reason: noise, not signal.
- **`/opt` (Entware) usage as separate row.** `/opt` is bind-mounted from `/usrdata/opt`, so its usage is already counted in `/usrdata`. Surfacing it separately would double-count. Reason: avoid confusion.
- **Storage growth alerts / email or SMS notifications when `/usrdata` fills.** No alert pipeline integration. Reason: matches the same v1-scoping decision from the modem-subsystem-card spec — prove the data shape first, hook alerts later.
- **Historical sparklines / trends.** Card shows current snapshot only. Reason: would need a poller-side ring buffer; out of scope.
- **Free / used swap.** No swap reporting. Reason: this device may not even have swap configured; not in user request.
- **CPU governor display.** `scaling_governor` reads `ondemand` and rarely changes. Reason: low-information row.
- **RM551E (OpenWRT) compatibility for the new system-telemetry fields.** All four new sources (`/proc/loadavg`, `/proc/meminfo`, `cpufreq` paths, `/usrdata` mount point) exist on Linux generally, but the `/usrdata` partition is RM520N-GL-specific. On RM551E, storage will fall back to `/` or report null. Reason: dev-rm520 branch is RM520N-GL-targeted; RM551E parity is not a v1 requirement for this card.

## Requirements

### R1 — Endpoint response shape (extension)

- **Current state:** `modem-subsys.sh` returns `{state, state_raw, crash_count, firmware_name, coredump_present, last_crash_at, total_logged_crashes, uptime_seconds}`.
- **Target state:** Same endpoint additionally returns `cpu`, `memory`, `storage` objects. `firmware_name` is REMOVED from the response (one less field for the frontend to consume).
- **Acceptance:**
  - [ ] `firmware_name` no longer appears as a top-level key.
  - [ ] Response time stays under 100 ms at p95 on the live device (sysfs + procfs + one `df` call only).
  - [ ] When any individual reading is unavailable, that specific sub-field is `null` — the parent object is still emitted with the other available fields.
  - [ ] When `/proc/meminfo` is unreadable entirely, `memory` top-level value is `null` (not an object with all-null fields).
  - [ ] When `/proc/loadavg` is unreadable, `cpu.load_1m` is `null`. When `cpufreq` is unreadable, `cpu.freq_khz` and `cpu.max_freq_khz` are `null`. The `cpu` object is still present unless BOTH `loadavg` and `cpufreq` are unreadable.
  - [ ] When `df /usrdata` fails (mount missing on non-RM520N-GL), `storage` is `null`.
  - [ ] All numeric fields are JSON numbers (not strings).

**New response shape:**
```json
{
  "state": "online",
  "state_raw": "ONLINE",
  "crash_count": 0,
  "coredump_present": false,
  "last_crash_at": null,
  "total_logged_crashes": 0,
  "uptime_seconds": 7758,
  "cpu": {
    "load_1m": 1.20,
    "core_count": 4,
    "freq_khz": 1804800,
    "max_freq_khz": 1804800
  },
  "memory": {
    "total_kb": 182516,
    "available_kb": 23152,
    "used_kb": 159364
  },
  "storage": {
    "mount": "/usrdata",
    "total_kb": 524288,
    "used_kb": 348160,
    "available_kb": 176128
  }
}
```

`firmware_name` is intentionally absent — removed in this phase.

### R2 — CPU Load row

- **Current state:** No CPU row exists.
- **Target state:** Row labelled "CPU Load" displaying `load_1m` as a number (2 decimal places) plus a `MetricBar` whose percentage = `(load_1m / core_count) × 100`. Warn at 75%, danger at 100% (load equals or exceeds core count).
- **Acceptance:**
  - [ ] When `cpu.load_1m` is null, value renders `—` and bar is not rendered (matches existing pattern in `device-metrics.tsx:185-187`).
  - [ ] Bar color follows MetricBar convention: `bg-primary` < warn, `bg-warning` ≥ warn, `bg-destructive` ≥ danger.
  - [ ] Value text uses `tabular-nums` for stable column alignment on update.
  - [ ] No "High Load" badge — for v1 we keep the row tighter than the Dashboard's variant. Color on the bar is sufficient signal at this density.

### R3 — CPU Frequency row

- **Current state:** No frequency row exists.
- **Target state:** Row labelled "CPU Frequency" displaying current frequency as GHz with one decimal place (e.g. `1.8 GHz`) plus a `MetricBar` whose percentage = `(freq_khz / max_freq_khz) × 100`. **Inverse coloring: low frequency → muted/primary, high frequency → primary (NOT warning).** A hot-running CPU is not an error condition, so this bar uses a single neutral color (`bg-primary`) regardless of value.
- **Acceptance:**
  - [ ] When `freq_khz` is null, value renders `—` and bar is not rendered.
  - [ ] When `max_freq_khz` is null but `freq_khz` is available, value text renders but bar is not rendered (no max → no scale).
  - [ ] Bar color is always `bg-primary` regardless of value.
  - [ ] Value uses `tabular-nums`.

### R4 — Memory row

- **Current state:** No memory row exists.
- **Target state:** Row labelled "Memory" displaying `<used_mb> MB (<percent>%)` (e.g. `156 MB (88%)`) plus a `MetricBar` whose percentage = `(used_kb / total_kb) × 100`. Warn at 70%, danger at 90% (mirrors `device-metrics.tsx:202` precedent).
- **Acceptance:**
  - [ ] When `memory` is null, value renders `—` and bar is not rendered.
  - [ ] `used_mb` displayed is `Math.round(used_kb / 1024)`.
  - [ ] Percent displayed is `Math.round((used_kb / total_kb) * 100)`.
  - [ ] Bar warn/danger thresholds: 70% / 90%.
  - [ ] When `total_kb` is 0 (impossible, but defensive), bar is not rendered.

### R5 — Storage row

- **Current state:** No storage row exists.
- **Target state:** Row labelled "Storage" with secondary muted-foreground text "(/usrdata)" plus a value of `<used_mb> / <total_mb> MB` (e.g. `340 / 512 MB`) and a `MetricBar` whose percentage = `(used_kb / total_kb) × 100`. Warn at 70%, danger at 90%.
- **Acceptance:**
  - [ ] When `storage` is null, value renders `—` and bar is not rendered.
  - [ ] Mount label "/usrdata" is shown next to the row label in muted-foreground (smaller or same size, not eye-catching).
  - [ ] Used and total are rounded to nearest MB.
  - [ ] Bar warn/danger thresholds: 70% / 90%.
  - [ ] Single row only — rootfs is NOT shown.

### R6 — Card title and description rename

- **Current state:** Title "Modem Subsystem", description "Live modem firmware health and crash history."
- **Target state:** Title "System Health", description "Live modem firmware health and host system telemetry."
- **Acceptance:**
  - [ ] `<CardTitle>` text matches exactly (case-sensitive).
  - [ ] `<CardDescription>` text matches exactly.
  - [ ] No icons added to the header (CLAUDE.md: "CardHeader: Always plain CardTitle + CardDescription without icons").
  - [ ] Loading and error variants of the card use the same new title and description.

### R7 — Firmware row removal

- **Current state:** Card renders a "Firmware" row showing `firmware_name` (always `"modem"` on RM520N-GL).
- **Target state:** Row is deleted from the card. Backend stops returning the field.
- **Acceptance:**
  - [ ] No "Firmware" label appears anywhere on the card.
  - [ ] No reference to `firmware_name` remains in `modem-subsystem-card.tsx`.
  - [ ] No reference to `firmware_name` remains in `types/modem-subsys.ts` (`ModemSubsysData`).
  - [ ] No reference to `firmware_name` remains in `modem-subsys.sh` (CGI).
  - [ ] `bunx tsc --noEmit` reports zero errors after removal.

### R8 — Type definitions

- **Current state:** `ModemSubsysData` includes `firmware_name`.
- **Target state:** `firmware_name` removed; `cpu`, `memory`, `storage` added with explicit nullable shapes (`{ ... } | null`).
- **Acceptance:**
  - [ ] `ModemSubsysData['cpu']` is `{ load_1m: number | null; core_count: number | null; freq_khz: number | null; max_freq_khz: number | null } | null`.
  - [ ] `ModemSubsysData['memory']` is `{ total_kb: number; available_kb: number; used_kb: number } | null`.
  - [ ] `ModemSubsysData['storage']` is `{ mount: string; total_kb: number; used_kb: number; available_kb: number } | null`.
  - [ ] All three new types compile under strict mode.
  - [ ] `firmware_name` is not present in the type.

### R9 — MetricBar relocation

- **Current state:** `MetricBar` is defined locally inside `components/dashboard/device-metrics.tsx` (lines 53–82).
- **Target state:** `MetricBar` is exported from a shared location (`components/ui/metric-bar.tsx` recommended). Both `device-metrics.tsx` and `modem-subsystem-card.tsx` import it.
- **Acceptance:**
  - [ ] One canonical `MetricBar` file exists; old local definition is removed from `device-metrics.tsx`.
  - [ ] `device-metrics.tsx` still renders identically (visual parity check by user).
  - [ ] `modem-subsystem-card.tsx` imports from the same path.
  - [ ] No regressions in `bunx tsc --noEmit`.

### R10 — Card layout / row ordering

- **Current state:** Order: State → Crashes since boot → Last crashed → Firmware → Coredump (conditional).
- **Target state:** Order: State → Crashes since boot → Last crashed → CPU Load → CPU Frequency → Memory → Storage → Coredump (conditional).
- **Acceptance:**
  - [ ] DOM order matches the above exactly.
  - [ ] All rows are separated by `<Separator />` (existing pattern).
  - [ ] Container animation (`motion/react` stagger) still applies — new rows fade in alongside existing ones.

## Constraints

- **Performance:** CGI endpoint p95 < 100 ms (unchanged from existing budget — adding ~3–4 file reads + one `df` call should add < 10 ms).
- **Memory:** No new persistent state. CGI is stateless. Hook caches in-memory only.
- **Storage:** No new disk writes. (Crash log writes from previous phase are unchanged.)
- **Compatibility:** Same graceful-degradation principle as the parent spec — every field is null-tolerant. RM551E or any other Linux without `/usrdata` simply gets `storage: null` and the row renders `—`.
- **Permissions:** All new sources are world-readable (`/proc/loadavg`, `/proc/meminfo`, `/sys/devices/system/cpu/cpu0/cpufreq/*`). `df` requires no privileges. `www-data` does not need new sudoers rules.
- **No new dependencies:** No new npm package, no new shell tool. `df`, `awk`, `sed`, `jq`, `cat` only.
- **Theme:** Card must render correctly in both light and dark mode (per CLAUDE.md design context).

## Acceptance Criteria (top-level pass/fail)

Once all of these can be checked, the change is complete:

- [ ] Visiting `/system-settings` on a live RM520N-GL displays the renamed "System Health" card.
- [ ] All seven base rows render with values: State, Crashes since boot, Last crashed, CPU Load, CPU Frequency, Memory, Storage.
- [ ] Coredump warning row still renders only when `coredump_present === true`.
- [ ] No "Firmware" row appears anywhere on the card.
- [ ] `curl http://192.168.225.1/cgi-bin/quecmanager/system/modem-subsys.sh` returns valid JSON matching R1's response shape, including `cpu`, `memory`, `storage` objects.
- [ ] CPU Load `MetricBar` color shifts to warning when synthesized load (e.g. `stress -c 4` for 30s) crosses 75% of core_count.
- [ ] Memory `MetricBar` percent matches the value text when both are visible (e.g. value says "88%" → bar fills ~88%).
- [ ] Storage `MetricBar` percent matches `used_kb / total_kb` from the JSON.
- [ ] `bunx tsc --noEmit` reports zero errors.
- [ ] No new ESLint warnings introduced.
- [ ] Card renders correctly in both light and dark mode (user visual confirmation).
- [ ] Loading state shows skeletons matching the NEW row layout (more rows than before).
- [ ] Error state still renders an `Alert` with retry, unchanged from parent spec.
- [ ] Dashboard's Device Metrics card still renders correctly after `MetricBar` relocation (visual parity check).

## Ambiguity Report

| Dimension | Score | Min | Status |
|---|---|---|---|
| Goal Clarity | 0.92 | 0.75 | ✓ |
| Boundary Clarity | 0.85 | 0.70 | ✓ |
| Constraint Clarity | 0.75 | 0.65 | ✓ |
| Acceptance Criteria | 0.85 | 0.70 | ✓ |
| **Ambiguity** | **0.15** | **≤ 0.20** | **✓ Gate passed** |

## Locked decisions (do not relitigate during implementation)

1. **Single endpoint extension over new endpoint.** Same CGI, same hook, wider JSON. Rationale: card is one component with one data source; splitting now would just add a second hook with no payoff.
2. **Card rename to "System Health".** Card no longer covers only the modem subsystem.
3. **CPU = load average (1m) + current frequency.** No `% busy` jiffies-delta calculation; CGI stays stateless.
4. **Memory format: `<used_mb> MB (<percent>%)`.** Both absolute and relative in one line.
5. **Storage = `/usrdata` only.** Rootfs is read-only noise; `/opt` would double-count.
6. **MetricBar is the visual pattern for all four new resource rows.** Per Device Metrics card precedent (CLAUDE.md "data-viz" exception applies — these are gauges).
7. **No "High X" badges on CPU/memory/storage rows** at this density. Bar color is sufficient. (Dashboard's Device Metrics card uses badges for CPU and temp because that card is the primary device-glance surface; this card is secondary.)
8. **CPU Frequency bar uses neutral primary color regardless of value.** A hot-running CPU is not an error.
9. **Warn/danger thresholds:** Memory and Storage at 70% / 90% (matches Device Metrics convention). CPU Load at 75% / 100% of core count.
10. **`firmware_name` removed entirely from the response.** Not just hidden in UI — fully deleted from CGI, type, and component.
11. **MetricBar lifted to `components/ui/metric-bar.tsx`.** Shared between Device Metrics and System Health cards.

## Next steps

Once spec is reviewed and committed:
1. Implementation order: types → CGI extension → MetricBar relocation → component refactor → manual verify on live device.
2. Stop the moment any step diverges from the locked decisions above — discuss-phase territory only if a NEW question surfaces.
