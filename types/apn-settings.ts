// =============================================================================
// apn-settings.ts — APN Management Types
// =============================================================================
// TypeScript interfaces for the APN Management CGI endpoint.
//
// Backend endpoint: GET/POST /cgi-bin/quecmanager/cellular/apn.sh
//
// Reuses CurrentApnProfile from sim-profile.ts for carrier profile entries.
// =============================================================================

import type { CurrentApnProfile } from "./sim-profile";

/** Response from GET /cgi-bin/quecmanager/cellular/apn.sh */
export interface ApnSettingsResponse {
  success: boolean;
  /** All configured APN/CID pairs from AT+CGDCONT? */
  profiles: CurrentApnProfile[];
  /** CID that currently has WAN connectivity */
  active_cid: number;
  error?: string;
}

/** POST body for /cgi-bin/quecmanager/cellular/apn.sh */
export interface ApnSaveRequest {
  /** PDP context ID (1-15) */
  cid: number;
  /** PDP type: IP, IPV6, or IPV4V6 */
  pdp_type: string;
  /** APN name */
  apn: string;
  /** IPv4 TTL (0-255, 0 = don't set). Set by Auto APN presets. */
  ttl?: number;
  /** IPv6 Hop Limit (0-255, 0 = don't set). Set by Auto APN presets. */
  hl?: number;
}

/** Response from POST /cgi-bin/quecmanager/cellular/apn.sh */
export interface ApnSaveResponse {
  success: boolean;
  error?: string;
  detail?: string;
}
