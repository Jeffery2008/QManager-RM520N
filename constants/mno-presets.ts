// =============================================================================
// mno-presets.ts — Mobile Network Operator Preset Configurations
// =============================================================================
// Config-driven carrier presets for the Custom SIM Profile form.
// Selecting a preset pre-fills APN, CID, TTL, and HL fields.
// Fields remain editable — the user can override any pre-filled value.
//
// To add a new carrier: append an entry to MNO_PRESETS below.
// The "Custom" option is always appended automatically by the form.
// =============================================================================

export interface MnoPreset {
  /** Unique key for this preset (used as Select value) */
  id: string;
  /** Display name in the dropdown */
  label: string;
  /** APN name to pre-fill */
  apn_name: string;
  /** PDP context ID (1-15) */
  cid: number;
  /** IPv4 TTL value (0-255) */
  ttl: number;
  /** IPv6 Hop Limit value (0-255) */
  hl: number;
}

/**
 * Carrier preset list.
 * Add new carriers here — the form will automatically pick them up.
 */
export const MNO_PRESETS: MnoPreset[] = [
  {
    id: "smart",
    label: "Smart",
    apn_name: "SMARTBRO",
    cid: 1,
    ttl: 64,
    hl: 64,
  },
];

/**
 * Special value for the "Custom" option in the MNO dropdown.
 * When selected, all pre-filled fields are cleared for manual entry.
 */
export const MNO_CUSTOM_ID = "custom";

/**
 * Look up a preset by ID. Returns undefined if not found or if "custom".
 */
export function getMnoPreset(id: string): MnoPreset | undefined {
  if (id === MNO_CUSTOM_ID) return undefined;
  return MNO_PRESETS.find((p) => p.id === id);
}

// =============================================================================
// Auto APN Presets — Predefined APN configurations for the APN Management page
// =============================================================================
// Selecting a preset auto-fills APN, CID, and optionally TTL/HL.
// TTL/HL of 0 means "don't change".
// =============================================================================

/**
 * Auto APN preset list for the APN Management page.
 * Add new carriers here — the APN form will automatically pick them up.
 */
export const AUTO_APN_PRESETS: MnoPreset[] = [
  {
    id: "vzw",
    label: "Verizon",
    apn_name: "vzwinternet",
    cid: 1,
    ttl: 64,
    hl: 64,
  },
  {
    id: "att_5g_phone",
    label: "AT&T 5G Phone",
    apn_name: "enhancedphone",
    cid: 1,
    ttl: 0,
    hl: 0,
  },
];

/**
 * Look up an Auto APN preset by ID. Returns undefined if not found.
 */
export function getAutoApnPreset(id: string): MnoPreset | undefined {
  return AUTO_APN_PRESETS.find((p) => p.id === id);
}
