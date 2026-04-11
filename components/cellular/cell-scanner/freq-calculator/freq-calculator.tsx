import FrequencyCalculator from "./calculator";

const FrequencyCalculatorComponent = () => {
  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">频点计算器</h1>
        <p className="text-muted-foreground">
          在 EARFCN / NR-ARFCN、频率和频段之间进行换算，支持 LTE 和 5G NR。
        </p>
      </div>
      <FrequencyCalculator />
    </div>
  );
};

export default FrequencyCalculatorComponent;
