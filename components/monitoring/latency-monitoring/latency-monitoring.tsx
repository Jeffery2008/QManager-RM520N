"use client";

import LatencyMonitoringCard, {
  useLatencyMonitoring,
} from "./latency-monitoring-card";
import PingEntriesCard from "./ping-entries-card";

const LatencyMonitoringComponent = () => {
  const { viewMode, setViewMode, chartData, total, tableData } =
    useLatencyMonitoring();

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">延迟监控</h1>
        <p className="text-muted-foreground">
          监控并分析延迟与丢包，以便定位问题并优化连接表现。
        </p>
      </div>
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <LatencyMonitoringCard
          viewMode={viewMode}
          setViewMode={setViewMode}
          chartData={chartData}
          total={total}
        />
        <PingEntriesCard
          entries={tableData.entries}
          emptyMessage={tableData.emptyMessage}
          isRealtime={tableData.isRealtime}
        />
      </div>
    </div>
  );
};

export default LatencyMonitoringComponent;
