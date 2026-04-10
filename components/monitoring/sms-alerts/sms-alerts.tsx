"use client";

import { useState, useCallback } from "react";
import SmsAlertsSettingsCard from "./sms-alerts-settings-card";
import SmsAlertsLogCard from "./sms-alerts-log-card";

const SmsAlertsComponent = () => {
  const [logRefreshKey, setLogRefreshKey] = useState(0);

  const handleTestSmsSent = useCallback(() => {
    setLogRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">短信告警</h1>
        <p className="text-muted-foreground">
          Get notified by SMS when your connection goes down for longer than a
          set duration. Delivered over the cellular control channel, so alerts
          can reach you even while your data connection is offline.
        </p>
      </div>
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <SmsAlertsSettingsCard onTestSmsSent={handleTestSmsSent} />
        <SmsAlertsLogCard refreshKey={logRefreshKey} />
      </div>
    </div>
  );
};

export default SmsAlertsComponent;
