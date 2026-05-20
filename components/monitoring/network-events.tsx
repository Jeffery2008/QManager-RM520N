import NetworkEventsCard from "./network-events-card";

const NetworkEventsComponent = () => {
  return (
    <div className="@container/main px-4 lg:px-6 pb-6">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">网络事件</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          轮询器记录的频段变化、连接中断、信号切换和其他蜂窝网络事件。
        </p>
      </div>
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 gap-4">
        <NetworkEventsCard />
      </div>
    </div>
  );
};

export default NetworkEventsComponent;
