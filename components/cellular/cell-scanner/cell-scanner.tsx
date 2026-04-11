import FullScannerComponent from "./scanner";

const CellScannerComponent = () => {
  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">小区扫描</h1>
        <p className="text-muted-foreground">
          扫描附近各运营商的小区。未插入活动 SIM 卡时通常效果更好。
        </p>
      </div>
      <FullScannerComponent />
    </div>
  );
};

export default CellScannerComponent;
