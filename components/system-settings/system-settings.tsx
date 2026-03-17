"use client";

import SystemSettingsCard from "@/components/system-settings/system-settings-card";
import ScheduledOperationsCard from "@/components/system-settings/scheduled-operations-card";

const SystemSettings = () => {
  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">System Settings</h1>
        <p className="text-muted-foreground">
          Configure device preferences and scheduled operations.
        </p>
      </div>
      <div className="grid grid-cols-1 @xl/main:grid-cols-2 grid-flow-row gap-4">
        <SystemSettingsCard />
        <ScheduledOperationsCard />
      </div>
    </div>
  );
};

export default SystemSettings;
