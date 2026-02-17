# Next Thread Prompt — Remove Band Locking from SIM Profiles + Connection Scenarios Planning

## Context

We just completed the **Custom SIM Profiles** feature for QManager — a dashboard for the Quectel RM551E-GL 5G modem on OpenWRT. The feature allows users to save and apply bundles of modem settings (APN, IMEI, TTL/HL, network mode, band locks) as named profiles.

However, we've decided on an **architectural change**: band locking and network mode should NOT live in SIM Profiles. They will be owned by a future **Connection Scenarios** feature instead. Connection Scenarios will have priority over SIM Profiles for radio configuration (bands, network mode). This gives us a clean separation:

- **SIM Profiles** = SIM identity & connectivity settings (APN, IMEI, TTL/HL)
- **Connection Scenarios** = Radio/RF configuration (bands, network mode, scan strategies)

---

## Task 1: Remove Band Locking & Network Mode from Custom SIM Profiles

Strip all band locking and network mode fields from the SIM Profile feature across all layers. After this change, a SIM Profile contains only: profile name, MNO, SIM ICCID, APN (name, CID, PDP type), IMEI, TTL, and HL.

### Files to Modify

**Frontend — Types:**
- `types/sim-profile.ts`
  - Remove from `ProfileSettings`: `network_mode`, `lte_bands`, `nsa_nr_bands`, `sa_nr_bands`, `band_lock_enabled`
  - Remove `NetworkModePreference` type export
  - Remove `NETWORK_MODE_LABELS` constant
  - Remove band/mode fields from `CurrentModemSettings` (`lte_bands`, `nsa_nr_bands`, `sa_nr_bands`, `supported_lte_bands`, `supported_nsa_nr_bands`, `supported_sa_nr_bands`, `network_mode`)

**Frontend — Hooks:**
- `hooks/use-sim-profiles.ts`
  - Remove from `ProfileFormData`: `network_mode`, `lte_bands`, `nsa_nr_bands`, `sa_nr_bands`, `band_lock_enabled`

- `hooks/use-current-settings.ts`
  - Remove band/mode fields from response handling (the CGI endpoint will no longer return them)

**Frontend — Components:**
- `components/cellular/custom-profiles/custom-profile-form.tsx`
  - Remove the Network Mode `<Select>` dropdown
  - Remove the "Enable Band Locking" `<Switch>` with its Tooltip and the entire conditional band input section (LTE Bands, NSA NR5G Bands, SA NR5G Bands inputs)
  - Remove band validation from `validate()` (the three `bandRegex` checks)
  - Remove `NETWORK_MODE_LABELS`, `NetworkModePreference` imports
  - Remove `atModeToFormMode()` helper function
  - Remove band/mode pre-fill from the `currentSettings` render-time comparison block (the lines setting `network_mode`, `lte_bands`, `nsa_nr_bands`, `sa_nr_bands`)
  - Re-balance the 2-column grid layout after field removal — IMEI currently shares a row with Network Mode

- `components/cellular/custom-profiles/custom-profile.tsx` (page coordinator)
  - Update the activate confirmation dialog description — remove mention of "band locks" and "network mode"

**Backend — Shell Scripts:**
- `scripts/usr/lib/qmanager/profile_mgr.sh`
  - Remove from profile JSON construction: `network_mode`, `lte_bands`, `nsa_nr_bands`, `sa_nr_bands`, `band_lock_enabled`
  - Remove extraction of these fields in `profile_save()`
  - Remove `mode_to_at()` conversion helper
  - Remove `get_all_bands()` function

- `scripts/usr/bin/qmanager_profile_apply`
  - Remove apply steps: network_mode, lte_bands, nsa_nr_bands, sa_nr_bands
  - Remove variable extractions: `p_network_mode`, `p_lte_bands`, `p_nsa_nr_bands`, `p_sa_nr_bands`, `p_band_lock`
  - Remove `cached_policy_band` variable and its `AT+QNWPREFCFG="policy_band"` query
  - Update `total_steps` count and `init_state_file()` step list
  - Remaining apply steps after removal: APN → TTL/HL → IMEI (3 steps)

- `scripts/cgi/quecmanager/profiles/current_settings.sh`
  - Remove AT command queries: `AT+QNWPREFCFG="mode_pref"`, `AT+QNWPREFCFG="lte_band"`, `AT+QNWPREFCFG="nsa_nr5g_band"`, `AT+QNWPREFCFG="nr5g_band"`, `AT+QNWPREFCFG="policy_band"`
  - Remove from JSON output: `network_mode`, `lte_bands`, `nsa_nr_bands`, `sa_nr_bands`, `supported_lte_bands`, `supported_nsa_nr_bands`, `supported_sa_nr_bands`
  - Endpoint simplifies to only: `AT+CGDCONT?` (APN), `AT+CGSN` (IMEI), `AT+QCCID` (ICCID)

### Important Constraints

- Do NOT remove band locking AT commands from `qcmd` or the backend infrastructure — they'll be reused by Connection Scenarios
- Do NOT remove band-related AT command references from the architecture docs
- `apply-progress-dialog.tsx` is generic (reads step names from state file) — should work with fewer steps without changes, but verify
- `custom-profile-table.tsx` doesn't display band info — no changes needed
- `constants/mno-presets.ts` has no band fields — no changes needed
- Existing saved profiles on hardware may have stale band fields in their JSON — backend already extracts fields by name so unknown fields are ignored

---

## Task 2: Plan Connection Scenarios Architecture

After the band removal is complete, begin designing the Connection Scenarios feature architecture. This is a planning/design discussion first, not implementation.

**Connection Scenarios** are higher-level radio configuration bundles that control how the modem connects to the network. They sit above SIM Profiles in the hierarchy:

```
Connection Scenario (radio/RF layer)
  ├── Band locks (LTE, NSA NR, SA NR)
  ├── Network mode (AUTO, LTE_ONLY, NR_ONLY, LTE_NR)
  └── [Future: scan strategies, CA policies, etc.]

SIM Profile (identity/connectivity layer)
  ├── APN (name, CID, PDP type)
  ├── IMEI
  └── TTL / HL
```

**Design questions to address:**
1. Can a Connection Scenario reference a SIM Profile? (e.g., "Use Smart SIM profile + B3-only band lock")
2. Should Connection Scenarios have their own async apply pipeline or reuse the SIM Profile pattern?
3. Where do Connection Scenarios live in the nav? Separate page under `/cellular/connection-scenarios`?
4. What's the storage model? Same pattern as profiles (`/etc/qmanager/scenarios/<id>.json`)?
5. What happens when both a SIM Profile and Connection Scenario are active? Apply order?

---

## Current File State Reference

### Target `ProfileFormData` (after band removal):
```typescript
interface ProfileFormData {
  name: string;
  mno: string;
  sim_iccid: string;
  cid: number;
  apn_name: string;
  pdp_type: string;
  imei: string;
  ttl: number;
  hl: number;
}
```

### Target `ProfileSettings` (after band removal):
```typescript
interface ProfileSettings {
  apn: ApnSettings;
  imei: string;
  ttl: number;
  hl: number;
}
```

### Current Form Layout (custom-profile-form.tsx) — User's Custom UI
Key patterns the user applied — preserve these:
- `react-icons/tb` for icons (TbInfoCircleFilled)
- Tooltip components for field info hints
- `toast` from `sonner` for success/error notifications
- 2-column responsive grid: `grid-cols-1 @md/card:grid-cols-2 gap-4`
- NO `FieldSeparator` components (user removed them)
- NO `useEffect` — all prop-to-state syncing uses render-time comparison pattern (React-recommended "store previous prop" pattern)
- `useMemo` for derived `selectedMno` state (no separate useState)
- "Load Current SIM" button positioned top-right above form with `DownloadIcon`
- `@container/card` queries for responsive breakpoints

### Current Form Row Layout (for re-balancing after removal):
```
Row 1: [Profile Name]     [SIM ICCID]
Row 2: [MNO Dropdown]     [APN Name]
Row 3: [PDP Type]         [CID]
Row 4: [Network Mode]     [Preferred IMEI]    ← Network Mode removed, IMEI needs new partner
Row 5: [TTL]              [HL]
Row 6: [Band Lock Switch]                     ← Entire row removed
Row 7: [LTE Bands (full width)]               ← Removed (conditional)
Row 8: [NSA NR Bands]     [SA NR Bands]       ← Removed (conditional)
Row 9: [Create/Reset buttons]
```

### Apply Steps (after removal — 3 remaining):
1. **APN** — `AT+CGDCONT=<cid>,"<pdp_type>","<apn>"` (no auth step)
2. **TTL/HL** — iptables/ip6tables via `/etc/firewall.user.ttl` (no modem lock needed)
3. **IMEI** — `AT+EGMR=1,7,"<imei>"` + `AT+CFUN=1,1` reboot if changed

### MNO Presets (constants/mno-presets.ts):
```typescript
// Only Smart carrier for now. User will provide more carriers later.
{ id: "smart", label: "Smart", apn_name: "SMARTBRO", cid: 1, ttl: 64, hl: 64 }
// Plus MNO_CUSTOM_ID = "custom" for manual entry
```

### Key Architecture Patterns (preserve these):
- **Gatekeeper pattern**: All AT commands through `qcmd` with flock serialization
- **Sip-don't-gulp**: One AT command at a time, sleep gaps between
- **Async apply**: CGI spawns detached process via `setsid`, frontend polls status
- **Render-time state sync**: No useEffect for prop→state, use "store previous prop" pattern
- **Atomic file writes**: Write to `.tmp`, then `mv` to final path
- **BusyBox compatible**: No jq, no rev, awk/sed for JSON construction
