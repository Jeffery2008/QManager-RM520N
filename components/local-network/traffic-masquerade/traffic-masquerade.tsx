"use client";

import { useTrafficMasquerade } from "@/hooks/use-traffic-masquerade";
import TrafficMasqueradeSettingsCard from "./traffic-masquerade-settings-card";

export default function TrafficMasqueradeComponent() {
  const trafficMasquerade = useTrafficMasquerade();

  const voActive = trafficMasquerade.settings?.other_enabled === true;

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Traffic Masquerade</h1>
        <p className="text-muted-foreground">
          Make all HTTPS traffic appear as a whitelisted service to carrier DPI
        </p>
      </div>
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <TrafficMasqueradeSettingsCard
          hook={trafficMasquerade}
          otherActive={voActive}
        />
      </div>
    </div>
  );
}
