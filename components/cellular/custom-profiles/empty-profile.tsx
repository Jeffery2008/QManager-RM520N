import React from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { SmartphoneIcon, RefreshCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { motion } from "motion/react";

interface EmptyProfileViewProps {
  onRefresh?: () => void;
}

const EmptyProfileViewComponent = ({ onRefresh }: EmptyProfileViewProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="h-full"
    >
    <Card className="@container/card h-full">
      <CardHeader>
        <CardTitle>已保存配置</CardTitle>
        <CardDescription>
          在这里管理你的自定义 SIM 配置。
        </CardDescription>
      </CardHeader>
      <CardContent className="h-full flex items-center justify-center">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SmartphoneIcon />
            </EmptyMedia>
            <EmptyTitle>暂无自定义配置</EmptyTitle>
            <EmptyDescription>
              你还没有创建任何自定义 SIM 配置。使用表单来创建你的第一个配置。
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {onRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh}>
                <RefreshCcwIcon className="size-4" />
                刷新
              </Button>
            )}
          </EmptyContent>
        </Empty>
      </CardContent>
    </Card>
    </motion.div>
  );
};

export default EmptyProfileViewComponent;
