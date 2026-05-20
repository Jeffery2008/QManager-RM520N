"use client";

import ConnectivitySensitivityCard from "@/components/system-settings/connection-quality/connectivity-sensitivity-card";
import QualityThresholdsCard from "@/components/system-settings/connection-quality/quality-thresholds-card";

const ConnectionQualitySettings = () => {
  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">连接质量</h1>
        <p className="text-muted-foreground">
          配置探测敏感度，以及何时将延迟或丢包标记为网络事件。
        </p>
      </div>
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <ConnectivitySensitivityCard />
        <QualityThresholdsCard />
      </div>
    </div>
  );
};

export default ConnectionQualitySettings;
