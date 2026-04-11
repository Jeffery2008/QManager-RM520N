"use client";

import { useState, useCallback } from "react";
import EmailAlertsSettingsCard from "./email-alerts-settings-card";
import EmailAlertsLogCard from "./email-alerts-log-card";

const EmailAlertsComponent = () => {
  const [logRefreshKey, setLogRefreshKey] = useState(0);

  const handleTestEmailSent = useCallback(() => {
    setLogRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">邮件告警</h1>
        <p className="text-muted-foreground">
          当连接中断超过设定时间后，通过电子邮件通知你。
        </p>
      </div>
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <EmailAlertsSettingsCard onTestEmailSent={handleTestEmailSent} />
        <EmailAlertsLogCard refreshKey={logRefreshKey} />
      </div>
    </div>
  );
};

export default EmailAlertsComponent;
