import React from "react";
import IPPassthroughCard from "./ip-passthrough-card";

const IPPassthroughComponent = () => {
  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          IP Passthrough Settings (IPPT)
        </h1>
        <p className="text-muted-foreground">
          Configure and manage IP Passthrough settings for your network devices,
          allowing seamless integration and connectivity.
        </p>
      </div>
      <div className="grid grid-cols-1 @xl/main:grid-cols-2 grid-flow-row gap-4">
        <IPPassthroughCard />
      </div>
    </div>
  );
};

export default IPPassthroughComponent;
