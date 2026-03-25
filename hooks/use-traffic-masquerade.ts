"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { authFetch } from "@/lib/auth-fetch";
import type {
  MasqueradeTestResult,
  TrafficMasqueradeResponse,
  TrafficMasqueradeSettings,
} from "@/types/video-optimizer";

const API_URL = "/cgi-bin/quecmanager/network/video_optimizer.sh";

export function useTrafficMasquerade() {
  const [settings, setSettings] = useState<TrafficMasqueradeSettings | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchSettings = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);

    try {
      const response = await authFetch(`${API_URL}?section=masquerade`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data: TrafficMasqueradeResponse = await response.json();
      if (!mountedRef.current) return;

      if (!data.success) {
        setError("Failed to load settings");
        return;
      }

      setSettings({
        enabled: data.enabled,
        status: data.status,
        uptime: data.uptime,
        packets_processed: data.packets_processed,
        sni_domain: data.sni_domain,
        binary_installed: data.binary_installed,
        kernel_module_loaded: data.kernel_module_loaded,
      });
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to fetch settings");
    } finally {
      if (mountedRef.current && !silent) setIsLoading(false);
    }
  }, []);

  const saveSettings = useCallback(
    async (enabled: boolean, sniDomain: string): Promise<boolean> => {
      setIsSaving(true);
      setError(null);

      try {
        const response = await authFetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_masquerade",
            enabled,
            sni_domain: sniDomain,
          }),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (!data.success) {
          setError(data.detail || "Failed to save settings");
          return false;
        }

        await fetchSettings(true);
        return true;
      } catch (err) {
        if (mountedRef.current) {
          setError(
            err instanceof Error ? err.message : "Failed to save settings"
          );
        }
        return false;
      } finally {
        if (mountedRef.current) setIsSaving(false);
      }
    },
    [fetchSettings]
  );

  const [testResult, setTestResult] = useState<MasqueradeTestResult>({
    status: "idle",
  });

  const runTest = useCallback(async () => {
    setTestResult({ status: "running" });

    try {
      const response = await authFetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test_masquerade" }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (!mountedRef.current) return;

      if (!data.success) {
        setTestResult({
          status: "error",
          error: data.error || "Test failed",
        });
        return;
      }

      setTestResult({
        status: "complete",
        injected: data.injected,
        packets: data.packets,
        message: data.message,
      });
    } catch (err) {
      if (!mountedRef.current) return;
      setTestResult({
        status: "error",
        error: err instanceof Error ? err.message : "Test failed",
      });
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    isLoading,
    isSaving,
    error,
    saveSettings,
    testResult,
    runTest,
    refresh: fetchSettings,
  };
}
