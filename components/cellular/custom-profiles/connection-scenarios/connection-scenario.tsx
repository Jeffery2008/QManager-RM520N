"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import ConnectionScenariosCard from "./connection-scenario-card";

const ConnectionScenariosComponent = () => {
  // Deep-link support: ?action=create opens the "New Scenario" dialog on
  // mount. Set by the SIM Profile form's "Create new custom scenario…" path
  // — see custom-profile-form.tsx.
  const searchParams = useSearchParams();
  const autoOpenAdd = searchParams.get("action") === "create";

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">连接场景</h1>
        <p className="text-muted-foreground">
          为蜂窝配置管理并自定义连接场景，以优化网络性能与稳定性。
        </p>
      </div>
      <ConnectionScenariosCard autoOpenAddDialog={autoOpenAdd} />
    </div>
  );
};

export default ConnectionScenariosComponent;
