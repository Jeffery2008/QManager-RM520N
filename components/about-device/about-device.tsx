"use client";

import { useAboutDevice } from "@/hooks/use-about-device";
import DeviceInformationCard from "./device-information-card";
import AboutQManagerCard from "./about-qmanager-card";

const AboutDeviceComponent = () => {
  const { data, isLoading, error, refresh } = useAboutDevice();

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">关于设备</h1>
        <p className="text-muted-foreground">
          查看设备身份信息、网络地址与系统信息。
        </p>
      </div>
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <DeviceInformationCard
          data={data}
          isLoading={isLoading}
          error={error}
          onRetry={refresh}
        />
        <AboutQManagerCard data={data} isLoading={isLoading} />
      </div>
    </div>
  );
};

export default AboutDeviceComponent;
