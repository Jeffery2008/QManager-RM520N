"use client";

import APNSettingsCard from "./apn-card";
import MBNCard from "./mbn-card";
import { useApnSettings } from "@/hooks/use-apn-settings";
import { useMbnSettings } from "@/hooks/use-mbn-settings";

const APNSettingsComponent = () => {
  const { profiles, activeCid, isLoading, isSaving, error, saveApn, refresh } =
    useApnSettings();

  const {
    profiles: mbnProfiles,
    autoSel,
    isLoading: mbnLoading,
    isSaving: mbnSaving,
    saveMbn,
    rebootDevice,
  } = useMbnSettings();

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">APN Management</h1>
        <p className="text-muted-foreground">
          Configure APNs and carrier firmware profiles.
        </p>
      </div>
      {error && !isLoading && (
        <div role="alert" className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load APN settings. Displayed values may be outdated.
          <button type="button" className="ml-2 underline" onClick={refresh}>
            Retry
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <APNSettingsCard
          profiles={profiles}
          activeCid={activeCid}
          isLoading={isLoading}
          isSaving={isSaving}
          onSave={saveApn}
        />
        <MBNCard
          profiles={mbnProfiles}
          autoSel={autoSel}
          isLoading={mbnLoading}
          isSaving={mbnSaving}
          onSave={saveMbn}
          onReboot={rebootDevice}
        />
      </div>
    </div>
  );
};

export default APNSettingsComponent;
