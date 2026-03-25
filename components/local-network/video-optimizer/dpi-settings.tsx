"use client";

import { useVideoOptimizer } from "@/hooks/use-video-optimizer";
import { useTrafficMasquerade } from "@/hooks/use-traffic-masquerade";
import VideoOptimizerSettingsCard from "./video-optimizer-settings-card";
import TrafficMasqueradeSettingsCard from "./traffic-masquerade-settings-card";

const DPISettingsComponent = () => {
  const videoOptimizer = useVideoOptimizer();
  const trafficMasquerade = useTrafficMasquerade();

  const voActive = videoOptimizer.settings?.enabled === true;
  const masqActive = trafficMasquerade.settings?.enabled === true;

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">DPI Settings</h1>
        <p className="text-muted-foreground">
          Bypass carrier traffic restrictions using Deep Packet Inspection
          evasion
        </p>
      </div>
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <VideoOptimizerSettingsCard
          hook={videoOptimizer}
          otherActive={masqActive}
          onSaved={() => trafficMasquerade.refresh(true)}
        />
        <TrafficMasqueradeSettingsCard
          hook={trafficMasquerade}
          otherActive={voActive}
          onSaved={() => videoOptimizer.refresh(true)}
        />
      </div>
    </div>
  );
};

export default DPISettingsComponent;
