"use client";

import IMEISettingsCard from "./imei-settings-card";
import BackupIMEICard from "./backup-imei-card";
import IMEIToolsCard from "./imei-tools-card";
import { useImeiSettings } from "@/hooks/use-imei-settings";

const IMEISettings = () => {
  const {
    currentImei,
    backupEnabled,
    backupImei,
    isLoading,
    isSaving,
    saveImei,
    saveBackup,
    rebootDevice,
  } = useImeiSettings();

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">IMEI 设置</h1>
        <p className="text-muted-foreground">
          查看、修改或备份设备 IMEI。
        </p>
      </div>
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <IMEISettingsCard
          currentImei={currentImei}
          isLoading={isLoading}
          isSaving={isSaving}
          onSave={saveImei}
          onReboot={rebootDevice}
        />
        <BackupIMEICard
          backupEnabled={backupEnabled}
          backupImei={backupImei}
          isLoading={isLoading}
          isSaving={isSaving}
          onSave={saveBackup}
        />
        <IMEIToolsCard />
      </div>
    </div>
  );
};

export default IMEISettings;
