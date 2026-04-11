"use client";

import { useTailscale } from "@/hooks/use-tailscale";
import { TailscaleConnectionCard } from "./tailscale-connection-card";
import { TailscalePeersCard } from "./tailscale-peers-card";

const TailscaleComponent = () => {
  const hookData = useTailscale();

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Tailscale 网络</h1>
        <p className="text-muted-foreground">
          管理你的 Tailscale Mesh VPN 连接与网络节点。
        </p>
      </div>
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <TailscaleConnectionCard {...hookData} />
        <TailscalePeersCard
          status={hookData.status}
          isLoading={hookData.isLoading}
          error={hookData.error}
        />
      </div>
    </div>
  );
};

export default TailscaleComponent;
