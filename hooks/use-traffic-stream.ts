"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { authFetch } from "@/lib/auth-fetch";
import type { TrafficStream } from "@/types/modem-status";

// =============================================================================
// useTrafficStream — 1 Hz Cellular Traffic Counter Hook
// =============================================================================
// Polls the qmanager_traffic side-channel CGI at 1 Hz. Decoupled from the 2 s
// useModemStatus path so live speed and cumulative totals can update faster.
// The hook does NOT touch the modem.
// =============================================================================

const DEFAULT_POLL_INTERVAL = 1000;
const STALE_THRESHOLD_SECONDS = 5;
const FETCH_ENDPOINT = "/cgi-bin/quecmanager/at_cmd/fetch_traffic.sh";

export interface UseTrafficStreamOptions {
  /** Polling interval in ms (default: 1000) */
  pollInterval?: number;
  /** Whether polling is active (default: true) */
  enabled?: boolean;
}

export interface UseTrafficStreamReturn {
  data: TrafficStream | null;
  isLoading: boolean;
  isStale: boolean;
  error: string | null;
  refresh: () => void;
}

export function useTrafficStream(
  options: UseTrafficStreamOptions = {},
): UseTrafficStreamReturn {
  const { pollInterval = DEFAULT_POLL_INTERVAL, enabled = true } = options;

  const [data, setData] = useState<TrafficStream | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);

  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await authFetch(FETCH_ENDPOINT);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const json: TrafficStream = await response.json();
      if (!mountedRef.current) return;

      setData(json);
      setError(null);

      // Trust the CGI's stale flag first (file mtime > 5 s).
      // Also independently check by ts: if ts is too old, mark stale.
      if (json.stale) {
        setIsStale(true);
      } else {
        const now = Math.floor(Date.now() / 1000);
        const age = now - json.ts;
        setIsStale(age > STALE_THRESHOLD_SECONDS);
      }

      setIsLoading(false);
    } catch (err) {
      if (!mountedRef.current) return;
      const message =
        err instanceof Error ? err.message : "Failed to fetch traffic stream";
      setError(message);
      setIsStale(true);
      setIsLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    mountedRef.current = true;

    if (!enabled) {
      return () => {
        mountedRef.current = false;
      };
    }

    fetchData();
    intervalRef.current = setInterval(fetchData, pollInterval);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchData, pollInterval, enabled]);

  return { data, isLoading, isStale, error, refresh };
}
