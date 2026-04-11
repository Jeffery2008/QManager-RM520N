import { RefreshCcwIcon, ScanSearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

interface ScannerEmptyViewProps {
  onStartScan?: () => void;
}

const ScannerEmptyView = ({ onStartScan }: ScannerEmptyViewProps) => {
  return (
    <Empty className="from-muted/50 to-background h-full bg-linear-to-b from-30%">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ScanSearchIcon />
        </EmptyMedia>
        <EmptyTitle>暂无扫描结果</EmptyTitle>
        <EmptyDescription>
          扫描附近各运营商与频段下可见的基站。
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onStartScan}>
          <RefreshCcwIcon />
          开始新扫描
        </Button>
      </EmptyContent>
    </Empty>
  );
};

export default ScannerEmptyView;
