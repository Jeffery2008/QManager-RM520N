"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { authFetch } from "@/lib/auth-fetch";
import type {
  VideoOptimizerResponse,
  VideoOptimizerSettings,
  VerifyResult,
  InstallResult,
} from "@/types/video-optimizer";

const API_URL = "/cgi-bin/quecmanager/network/video_optimizer.sh";

export function useVideoOptimizer() {
  const [settings, setSettings] = useState<VideoOptimizerSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult>({
    success: true,
    status: "idle",
  });
  const [installResult, setInstallResult] = useState<InstallResult>({
    success: true,
    status: "idle",
  });
  const mountedRef = useRef(true);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const installPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
      if (installPollRef.current) {
        clearInterval(installPollRef.current);
      }
    };
  }, []);

  const fetchSettings = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);

    try {
      const response = await authFetch(API_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data: VideoOptimizerResponse = await response.json();
      if (!mountedRef.current) return;

      if (!data.success) {
        setError("Failed to load settings");
        return;
      }

      setSettings({
        enabled: data.enabled,
        other_enabled: data.other_enabled,
        status: data.status,
        uptime: data.uptime,
        packets_processed: data.packets_processed,
        domains_loaded: data.domains_loaded,
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
    async (enabled: boolean): Promise<boolean> => {
      setIsSaving(true);
      setError(null);

      try {
        const response = await authFetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "save", enabled }),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (!data.success) {
          setError(data.detail || "Failed to save settings");
          return false;
        }

        // Silent re-fetch to get updated status
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

  const stopVerifyPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const pollVerifyStatus = useCallback(async () => {
    try {
      const response = await authFetch(
        `${API_URL}?action=verify_status`
      );
      if (!response.ok) return;

      const data: VerifyResult = await response.json();
      if (!mountedRef.current) return;

      setVerifyResult(data);

      if (data.status === "complete" || data.status === "error") {
        stopVerifyPolling();
        // Refresh settings to get updated status/stats
        await fetchSettings(true);
      }
    } catch {
      // Silently retry on next poll interval
    }
  }, [stopVerifyPolling, fetchSettings]);

  const runVerification = useCallback(async () => {
    setVerifyResult({ success: true, status: "running" });

    try {
      const response = await authFetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify" }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      // Start polling for results every 2 seconds
      pollTimerRef.current = setInterval(pollVerifyStatus, 2000);
    } catch (err) {
      if (mountedRef.current) {
        setVerifyResult({
          success: false,
          status: "error",
          error:
            err instanceof Error ? err.message : "Failed to start verification",
        });
      }
    }
  }, [pollVerifyStatus]);

  const stopInstallPolling = useCallback(() => {
    if (installPollRef.current) {
      clearInterval(installPollRef.current);
      installPollRef.current = null;
    }
  }, []);

  const pollInstallStatus = useCallback(async () => {
    try {
      const response = await authFetch(`${API_URL}?action=install_status`);
      if (!response.ok) return;

      const data: InstallResult = await response.json();
      if (!mountedRef.current) return;

      setInstallResult(data);

      if (data.status === "complete" || data.status === "error") {
        stopInstallPolling();
        // Refresh settings to pick up binary_installed change
        await fetchSettings(true);
      }
    } catch {
      // Silently retry on next poll interval
    }
  }, [stopInstallPolling, fetchSettings]);

  const runInstall = useCallback(async () => {
    setInstallResult({ success: true, status: "running", message: "Starting installation..." });

    try {
      const response = await authFetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "install" }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      // Start polling for results every 2 seconds
      installPollRef.current = setInterval(pollInstallStatus, 2000);
    } catch (err) {
      if (mountedRef.current) {
        setInstallResult({
          success: false,
          status: "error",
          message: err instanceof Error ? err.message : "Failed to start installation",
        });
      }
    }
  }, [pollInstallStatus]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    isLoading,
    isSaving,
    error,
    saveSettings,
    verifyResult,
    runVerification,
    installResult,
    runInstall,
    refresh: fetchSettings,
  };
}
