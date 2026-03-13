import React from "react";
import NetworkPriorityCard from "./network-priority-card";

const NetworkPrioritySettings = () => {
  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Network Priority Settings</h1>
        <p className="text-muted-foreground">
          Set the preferred order of network connections.
        </p>
      </div>
      <div className="grid grid-cols-1 @xl/main:grid-cols-2 grid-flow-row gap-4">
        <NetworkPriorityCard />
      </div>
    </div>
  );
};

export default NetworkPrioritySettings;
