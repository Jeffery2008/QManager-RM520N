import SystemLogsCard from "./system-logs-card";

const SystemLogsComponent = () => {
  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">系统日志</h1>
        <p className="text-muted-foreground">
          筛选并搜索 QManager 事件日志。
        </p>
      </div>
      <div className="grid grid-cols-1 grid-flow-row gap-4">
        <SystemLogsCard />
      </div>
    </div>
  );
};

export default SystemLogsComponent;
