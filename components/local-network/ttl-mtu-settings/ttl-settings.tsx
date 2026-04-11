import TTLSettingsCard from "./ttl-settings-card";
import MTUSettingsCard from "./mtu-settings-card";

const TTLandMTUSettingsComponent = () => {
  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">TTL 与 MTU 设置</h1>
        <p className="text-muted-foreground">
          为蜂窝数据接口设置自定义的 TTL、Hop Limit 和 MTU。
        </p>
      </div>
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <TTLSettingsCard />
        <MTUSettingsCard />
      </div>
    </div>
  );
};

export default TTLandMTUSettingsComponent;
