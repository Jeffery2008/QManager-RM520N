import CustomDNSCard from "./custom-dns-card";

const CustomDNSComponent = () => {
  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Custom DNS Settings</h1>
        <p className="text-muted-foreground">
          Override carrier-assigned DNS servers with your preferred resolvers
          for all devices on the local network.
        </p>
      </div>
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <CustomDNSCard />
      </div>
    </div>
  );
};

export default CustomDNSComponent;
