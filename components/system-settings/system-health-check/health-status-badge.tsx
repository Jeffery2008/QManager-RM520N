"use client";

import {
  CheckCircle2Icon,
  XCircleIcon,
  TriangleAlertIcon,
  MinusCircleIcon,
  Loader2Icon,
  ClockIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TestStatus } from "@/types/system-health-check";

interface HealthStatusBadgeProps {
  status: TestStatus;
}

export default function HealthStatusBadge({ status }: HealthStatusBadgeProps) {
  switch (status) {
    case "pass":
      return (
        <Badge variant="outline" className="bg-success/15 text-success hover:bg-success/20 border-success/30">
          <CheckCircle2Icon className="size-3" />
          通过
        </Badge>
      );
    case "fail":
      return (
        <Badge variant="outline" className="bg-destructive/15 text-destructive hover:bg-destructive/20 border-destructive/30">
          <XCircleIcon className="size-3" />
          失败
        </Badge>
      );
    case "warn":
      return (
        <Badge variant="outline" className="bg-warning/15 text-warning hover:bg-warning/20 border-warning/30">
          <TriangleAlertIcon className="size-3" />
          警告
        </Badge>
      );
    case "skip":
      return (
        <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-muted-foreground/30">
          <MinusCircleIcon className="size-3" />
          已跳过
        </Badge>
      );
    case "running":
      return (
        <Badge variant="outline" className="bg-info/15 text-info hover:bg-info/20 border-info/30">
          <Loader2Icon className="size-3 animate-spin" />
          运行中
        </Badge>
      );
    case "pending":
    default:
      return (
        <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-muted-foreground/30">
          <ClockIcon className="size-3" />
          等待中
        </Badge>
      );
  }
}
