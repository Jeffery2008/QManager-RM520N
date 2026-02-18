// =============================================================================
// connection-scenario.ts — QManager Connection Scenario Types
// =============================================================================
// TypeScript interfaces and default scenario constants for the Connection
// Scenarios feature. Connection Scenarios control radio/RF configuration
// (network mode, band locks) and sit above SIM Profiles in the hierarchy.
//
// SIM Profiles = identity/connectivity (APN, IMEI, TTL/HL)
// Connection Scenarios = radio/RF config (network mode, bands)
//
// Backend contract:
//   Active scenario: /etc/qmanager/active_scenario
//   Activate endpoint: POST /cgi-bin/quecmanager/scenarios/activate.sh
//   Status endpoint:   GET  /cgi-bin/quecmanager/scenarios/active.sh
//
// See: CUSTOM_SIM_PROFILE_ARCHITECTURE_v2.md (Connection Scenarios section)
// =============================================================================

// --- Scenario Data Model -----------------------------------------------------

/** Configuration settings for a connection scenario */
export interface ScenarioConfig {
  /** Display-friendly band list (e.g., ["Auto"], ["N41", "N78"]) */
  bands: string[];
  /** Display-friendly network mode (e.g., "Auto", "5G SA Preferred") */
  mode: string;
  /** Display-friendly optimization label (e.g., "Balanced", "Latency") */
  optimization: string;
}

/** Full connection scenario definition */
export interface ConnectionScenario {
  /** Unique scenario ID (default: "balanced"|"gaming"|"streaming", custom: "custom-<ts>") */
  id: string;
  /** Display name */
  name: string;
  /** Short description */
  description: string;
  /** Tailwind gradient classes for the card background */
  gradient: string;
  /** SVG pattern type for the card overlay */
  pattern: "balanced" | "gaming" | "streaming" | "custom";
  /** Scenario configuration (display values) */
  config: ScenarioConfig;
  /** Whether this is a built-in default (cannot be deleted/edited) */
  isDefault: boolean;
  /**
   * AT command value for AT+QNWPREFCFG="mode_pref".
   * null means "no override" (used by Balanced).
   */
  atModeValue: string;
}

// --- Default Scenarios -------------------------------------------------------

export const DEFAULT_SCENARIOS: ConnectionScenario[] = [
  {
    id: "balanced",
    name: "Balanced",
    description: "Auto band selection",
    gradient: "from-emerald-500 via-teal-500 to-cyan-500",
    pattern: "balanced",
    config: {
      bands: ["Auto"],
      mode: "Auto",
      optimization: "Balanced",
    },
    isDefault: true,
    atModeValue: "AUTO",
  },
  {
    id: "gaming",
    name: "Gaming",
    description: "Low latency, SA priority",
    gradient: "from-violet-600 via-purple-600 to-indigo-700",
    pattern: "gaming",
    config: {
      bands: ["Auto"],
      mode: "5G SA Only",
      optimization: "Latency",
    },
    isDefault: true,
    atModeValue: "NR5G",
  },
  {
    id: "streaming",
    name: "Streaming",
    description: "High bandwidth, stable connection",
    gradient: "from-rose-500 via-pink-500 to-orange-400",
    pattern: "streaming",
    config: {
      bands: ["Auto"],
      mode: "5G SA / NSA",
      optimization: "Throughput",
    },
    isDefault: true,
    atModeValue: "LTE:NR5G",
  },
];

// --- API Response Types ------------------------------------------------------

/** Response from GET /cgi-bin/quecmanager/scenarios/active.sh */
export interface ScenarioActiveResponse {
  /** Currently active scenario ID, or "balanced" if none set */
  active_scenario_id: string;
}

/** Response from POST /cgi-bin/quecmanager/scenarios/activate.sh */
export interface ScenarioActivateResponse {
  success: boolean;
  /** Activated scenario ID */
  id?: string;
  /** Error code on failure */
  error?: string;
  /** Human-readable error detail */
  detail?: string;
}
