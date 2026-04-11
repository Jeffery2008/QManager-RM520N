import NeighbourCellScanner from "./neighbour-scanner";

const NeighbourcellComponent = () => {
  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">邻区扫描</h1>
        <p className="text-muted-foreground">
          分析当前服务小区可见的邻近基站。
        </p>
      </div>
      <NeighbourCellScanner />
    </div>
  );
};

export default NeighbourcellComponent;
