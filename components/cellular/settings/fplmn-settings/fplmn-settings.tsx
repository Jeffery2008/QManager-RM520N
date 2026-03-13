import React from "react";
import FPLMNCard from "./fplmn-card";

const FPLMNSettingsComponent = () => {
  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">FPLMN Device Settings</h1>
        <p className="text-muted-foreground">
          Check and clear the forbidden network list on your SIM.
        </p>
      </div>
      <div className="grid grid-cols-1 @xl/main:grid-cols-2 grid-flow-row gap-4">
        <FPLMNCard />
      </div>
    </div>
  );
};

export default FPLMNSettingsComponent;
