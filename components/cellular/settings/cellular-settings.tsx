"use client";

import CellularSettingsCard from "./cellular-settings-card";
import CellularAMBRCard from "./cellular-ambr";
import { useCellularSettings } from "@/hooks/use-cellular-settings";

const CellularSettingsComponent = () => {
  const { settings, ambr, isLoading, isSaving, error, saveSettings, refresh } =
    useCellularSettings();

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Cellular Basic Settings</h1>
        <p className="text-muted-foreground">
          SIM slot, radio state, and network mode preferences.
        </p>
      </div>
      {error && !isLoading && (
        <div role="alert" className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load cellular settings. Displayed values may be outdated.
          <button type="button" className="ml-2 underline" onClick={refresh}>
            Retry
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <CellularSettingsCard
          settings={settings}
          isLoading={isLoading}
          isSaving={isSaving}
          onSave={saveSettings}
        />
        <CellularAMBRCard ambr={ambr} isLoading={isLoading} />
      </div>
    </div>
  );
};

export default CellularSettingsComponent;
