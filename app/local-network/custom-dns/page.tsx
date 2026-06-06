import CustomDnsCard from "@/components/local-network/custom-dns/custom-dns-card";

const CustomDnsPage = () => {
  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">自定义 DNS</h1>
        <p className="text-muted-foreground">
          指定调制解调器为局域网客户端查询时使用的上游 DNS 服务器。
        </p>
      </div>
      <div className="grid gap-4 @4xl:grid-cols-2">
        <CustomDnsCard />
      </div>
    </div>
  );
};

export default CustomDnsPage;
