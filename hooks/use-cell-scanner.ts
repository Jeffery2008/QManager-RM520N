"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { CellScanResult } from "@/components/cellular/cell-scanner/scan-result";

// Poll interval while a scan is running (ms)
const SCAN_POLL_INTERVAL = 2000;

type ScanStatus = "idle" | "running" | "complete" | "error";

interface CellScanStatusResponse {
  status: ScanStatus;
  results?: CellScanResult[];
  message?: string;
}

interface UseCellScannerReturn {
  status: ScanStatus;
  results: CellScanResult[];
  error: string | null;
  startScan: () => Promise<void>;
}

export function useCellScanner(): UseCellScannerReturn {
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [results, setResults] = useState<CellScanResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Poll for scan status --------------------------------------------------
  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(
        `/cgi-bin/quecmanager/at_cmd/cell_scan_status.sh?_t=${Date.now()}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: CellScanStatusResponse = await res.json();

      switch (data.status) {
        case "running":
          setStatus("running");
          break;

        case "complete":
          setStatus("complete");
          setResults(data.results ?? []);
          setError(null);
          // Stop polling
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          break;

        case "error":
          setStatus("error");
          setError(data.message ?? "Scan failed");
          // Stop polling
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          break;

        default:
          // "idle" — scan might have finished between start and first poll
          // If we were running, this means the process died without writing results
          if (pollRef.current) {
            setStatus("idle");
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          }
          break;
      }
    } catch {
      // Network error during poll — keep retrying
    }
  }, []);

  // --- Start a new scan ------------------------------------------------------
  const startScan = useCallback(async () => {
    setStatus("running");
    setError(null);

    try {
      const res = await fetch(
        "/cgi-bin/quecmanager/at_cmd/cell_scan_start.sh",
        { method: "POST" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      if (!data.success) {
        if (data.error === "already_running") {
          // A scan is already in progress — just start polling
          setStatus("running");
        } else {
          setStatus("error");
          setError(data.detail || data.error || "Failed to start scan");
          return;
        }
      }

      // Begin polling for results
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(pollStatus, SCAN_POLL_INTERVAL);
    } catch {
      setStatus("error");
      setError("Failed to connect to scanner");
    }
  }, [pollStatus]);

  // --- Check for existing results on mount -----------------------------------
  useEffect(() => {
    // On mount, check if there are already results or a running scan
    pollStatus();
    // Cleanup on unmount
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [pollStatus]);

  return { status, results, error, startScan };
}
