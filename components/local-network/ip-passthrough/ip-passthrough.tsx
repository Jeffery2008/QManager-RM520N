import IPPassthroughCard from "./ip-passthrough-card";

const IPPassthroughComponent = () => {
  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          IP 透传设置（IPPT）
        </h1>
        <p className="text-muted-foreground">
          将调制解调器的公网 IP 直接分配给已连接设备，绕过路由器的 NAT 层。
        </p>
      </div>
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <IPPassthroughCard />
      </div>
    </div>
  );
};

export default IPPassthroughComponent;
