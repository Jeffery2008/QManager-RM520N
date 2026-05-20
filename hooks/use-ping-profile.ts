"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { authFetch } from "@/lib/auth-fetch";
import type { PingProfile } from "@/types/modem-status";

// =============================================================================
// usePingProfile — Fetch & Save Hook for Connectivity Sensitivity
// =============================================================================
// Backend: GET/POST /cgi-bin/quecmanager/settings/ping_profile.sh
//
// GET returns { success: true, settings: { profile: PingProfile, target_1, target_2 } }.
// POST { action: "save_settings", profile: PingProfile, target_1, target_2 } writes
// the file and pokes /tmp/qmanager_ping_reload; daemon picks up the change on its
// next probe cycle (1-10s depending on the previous profile's interval).
// =============================================================================

const ENDPOINT = "/cgi-bin/quecmanager/settings/ping_profile.sh";

interface PingProfileSettings {
  profile: PingProfile;
  target_1: string;
  target_2: string;
}

interface PingProfileResponse {
  success: boolean;
  settings?: PingProfileSettings;
  error?: string;
  detail?: string;
}

export interface UsePingProfileReturn {
  profile: PingProfile | undefined;
  target1: string | undefined;
  target2: string | undefined;
  isLoading: boolean;
  error: string | null;
  isSaving: boolean;
  saveError: string | null;
  save: (settings: {
    profile: PingProfile;
    target_1: string;
    target_2: string;
  }) => Promise<PingProfileResponse>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePingProfile(): UsePingProfileReturn {
  const [profile, setProfile] = useState<PingProfile | undefined>(undefined);
  const [target1, setTarget1] = useState<string | undefined>(undefined);
  const [target2, setTarget2] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchProfile = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);

    try {
      const resp = await authFetch(ENDPOINT);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const json: PingProfileResponse = await resp.json();
      if (!mountedRef.current) return;

      if (!json.success || !json.settings) {
        throw new Error(json.detail ?? json.error ?? "Failed to load profile");
      }

      setProfile(json.settings.profile);
      setTarget1(json.settings.target_1);
      setTarget2(json.settings.target_2);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      if (mountedRef.current && !silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const save = useCallback(
    async (settings: {
      profile: PingProfile;
      target_1: string;
      target_2: string;
    }): Promise<PingProfileResponse> => {
      setSaveError(null);
      setIsSaving(true);

      try {
        const resp = await authFetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_settings",
            profile: settings.profile,
            target_1: settings.target_1,
            target_2: settings.target_2,
          }),
        });

        const json: PingProfileResponse = await resp.json();
        if (!mountedRef.current) return json;

        if (!json.success) {
          throw new Error(json.detail ?? json.error ?? "Save failed");
        }

        setProfile(settings.profile);
        setTarget1(settings.target_1);
        setTarget2(settings.target_2);
        fetchProfile(true);

        return json;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Save failed";
        if (mountedRef.current) setSaveError(msg);
        throw err;
      } finally {
        if (mountedRef.current) setIsSaving(false);
      }
    },
    [fetchProfile],
  );

  return {
    profile,
    target1,
    target2,
    isLoading,
    error,
    isSaving,
    saveError,
    save,
  };
}
