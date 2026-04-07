"use client";

import { useWatchdogSettings } from "@/hooks/use-watchdog-settings";
import { WatchdogSettingsCard } from "./watchdog-settings-card";
import { WatchdogStatusCard } from "./watchdog-status-card";

const WatchdogComponent = () => {
  const hookData = useWatchdogSettings();

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">看门狗</h1>
        <p className="text-muted-foreground">
          自动检测互联网中断，并通过递进式恢复步骤自动处理。
        </p>
      </div>
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <WatchdogSettingsCard {...hookData} />
        <WatchdogStatusCard
          revertSim={hookData.revertSim}
          settingsEnabled={hookData.settings?.enabled}
        />
      </div>
    </div>
  );
};

export default WatchdogComponent;
