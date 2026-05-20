import EthernetStatusCard from "./ethernet-card";

const EthernetStatusComponent = () => {
  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Ethernet Status</h1>
        <p className="text-muted-foreground">
          Monitor the host ethernet link and configure its negotiated speed.
        </p>
      </div>
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <EthernetStatusCard />
      </div>
    </div>
  );
};

export default EthernetStatusComponent;
