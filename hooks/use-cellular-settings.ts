"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type {
  CellularSettings,
  AmbrData,
  CellularSettingsResponse,
  CellularSettingsApplyResponse,
} from "@/types/cellular-settings";

// =============================================================================
// useCellularSettings — One-Shot Settings + AMBR Fetch & Save Hook
// =============================================================================
// Fetches current cellular settings and AMBR data on mount.
// Provides a saveSettings function for applying changes via POST.
//
// The CGI endpoint queries the modem via qcmd (6 AT commands), so the
// initial fetch may take a few seconds.
//
// Usage:
//   const { settings, ambr, isLoading, isSaving, error, saveSettings, refresh }
//     = useCellularSettings();
//
// Backend endpoint:
//   GET/POST /cgi-bin/quecmanager/cellular/settings.sh
// =============================================================================

const CGI_ENDPOINT = "/cgi-bin/quecmanager/cellular/settings.sh";

export interface UseCellularSettingsReturn {
  /** Current modem settings (null before first fetch) */
  settings: CellularSettings | null;
  /** AMBR data (null before first fetch) */
  ambr: AmbrData | null;
  /** True while initial fetch is in progress */
  isLoading: boolean;
  /** True while a save operation is in progress */
  isSaving: boolean;
  /** Error message if fetch or save failed */
  error: string | null;
  /** Apply settings changes to the modem. Returns true on full success. */
  saveSettings: (changes: Partial<CellularSettings>) => Promise<boolean>;
  /** Re-fetch all settings from the modem */
  refresh: () => void;
}

export function useCellularSettings(): UseCellularSettingsReturn {
  const [settings, setSettings] = useState<CellularSettings | null>(null);
  const [ambr, setAmbr] = useState<AmbrData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch settings + AMBR
  // ---------------------------------------------------------------------------
  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const resp = await fetch(CGI_ENDPOINT);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const data: CellularSettingsResponse = await resp.json();
      if (!mountedRef.current) return;

      if (!data.success) {
        setError(data.error || "Failed to fetch cellular settings");
        return;
      }

      setSettings(data.settings);
      setAmbr(data.ambr);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(
        err instanceof Error
          ? err.message
          : "Failed to fetch cellular settings"
      );
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // ---------------------------------------------------------------------------
  // Save settings
  // ---------------------------------------------------------------------------
  const saveSettings = useCallback(
    async (changes: Partial<CellularSettings>): Promise<boolean> => {
      setError(null);
      setIsSaving(true);

      try {
        const resp = await fetch(CGI_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changes),
        });

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        }

        const data: CellularSettingsApplyResponse = await resp.json();
        if (!mountedRef.current) return false;

        if (!data.success) {
          const detail = data.failed_fields
            ? `Failed to apply: ${data.failed_fields.join(", ")}`
            : data.error || "Failed to apply settings";
          setError(detail);
          return false;
        }

        // Wait for modem to settle after sensitive changes
        const hasSensitiveChange =
          changes.sim_slot !== undefined || changes.cfun !== undefined;
        if (hasSensitiveChange) {
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }

        // Re-fetch to show actual modem state
        await fetchSettings();
        return true;
      } catch (err) {
        if (!mountedRef.current) return false;
        setError(
          err instanceof Error ? err.message : "Failed to apply settings"
        );
        return false;
      } finally {
        if (mountedRef.current) {
          setIsSaving(false);
        }
      }
    },
    [fetchSettings]
  );

  return {
    settings,
    ambr,
    isLoading,
    isSaving,
    error,
    saveSettings,
    refresh: fetchSettings,
  };
}
