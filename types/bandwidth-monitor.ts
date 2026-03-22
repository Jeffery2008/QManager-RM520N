// =============================================================================
// bandwidth-monitor.ts — Types for Live Bandwidth Monitoring
// =============================================================================
// WebSocket messages from bridge_traffic_monitor_rm551 binary and
// CGI settings/status from /cgi-bin/quecmanager/monitoring/bandwidth.sh.
// =============================================================================

// --- WebSocket Message Types ------------------------------------------------

/** Per-interface traffic data from the binary */
export interface BandwidthInterfaceData {
  name: string;
  state: "up" | "down";
  tx: { bps: number };
  rx: { bps: number };
}

/** JSON message received via WebSocket from bridge_traffic_monitor_rm551 */
export interface BandwidthMessage {
  type: string;
  channel: string;
  data: {
    timestamp: string;
    upload: number;
    download: number;
  };
  interfaces: BandwidthInterfaceData[];
}

// --- CGI Response Types -----------------------------------------------------

/** Bandwidth monitor configuration stored in UCI */
export interface BandwidthSettings {
  enabled: boolean;
  refresh_rate_ms: number;
  ws_port: number;
  interfaces: string;
}

/** Runtime status of bandwidth monitor processes */
export interface BandwidthStatus {
  websocat_running: boolean;
  monitor_running: boolean;
  ssl_cert_exists: boolean;
}

/** System dependency availability */
export interface BandwidthDependencies {
  websocat_installed: boolean;
  openssl_installed: boolean;
}

/** Full GET response from bandwidth.sh */
export interface BandwidthSettingsResponse {
  success: boolean;
  settings: BandwidthSettings;
  status: BandwidthStatus;
  dependencies: BandwidthDependencies;
}

// --- Chart Types ------------------------------------------------------------

/** A single data point for the real-time bandwidth chart */
export interface BandwidthChartPoint {
  /** Unix epoch in milliseconds */
  timestamp: number;
  /** Aggregate download speed in bits per second */
  download: number;
  /** Aggregate upload speed in bits per second */
  upload: number;
}
