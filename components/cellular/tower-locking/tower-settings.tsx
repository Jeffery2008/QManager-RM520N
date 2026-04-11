"use client";

import React, { useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SaveButton, useSaveFlash } from "@/components/ui/save-button";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TbInfoCircleFilled } from "react-icons/tb";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  PercentIcon,
  CheckCircle2Icon,
  TriangleAlertIcon,
  XCircleIcon,
  MinusCircleIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

import type {
  TowerLockConfig,
  TowerFailoverState,
} from "@/types/tower-locking";
import type { ModemStatus } from "@/types/modem-status";
import { rsrpToQualityPercent, qualityLevel } from "@/types/tower-locking";

interface TowerLockingSettingsProps {
  config: TowerLockConfig | null;
  failoverState: TowerFailoverState | null;
  modemData: ModemStatus | null;
  isLoading: boolean;
  onPersistChange: (persist: boolean) => void;
  onFailoverChange: (enabled: boolean) => void;
  onThresholdChange: (threshold: number) => Promise<boolean>;
}

const TowerLockingSettingsComponent = ({
  config,
  failoverState,
  modemData,
  isLoading,
  onPersistChange,
  onFailoverChange,
  onThresholdChange,
}: TowerLockingSettingsProps) => {
  // Whether any tower lock is active (from config — matches what failover daemon checks)
  const hasActiveLock = (config?.lte?.enabled || config?.nr_sa?.enabled) ?? false;

  // Local state for threshold input
  const [thresholdInput, setThresholdInput] = useState<string>("");
  const [isSavingThreshold, setIsSavingThreshold] = useState(false);
  const { saved: thresholdSaved, markSaved: markThresholdSaved } = useSaveFlash();

  // Sync threshold from config (adjust state during render)
  const [prevThreshold, setPrevThreshold] = useState<number | undefined>(
    undefined,
  );
  if (
    config?.failover?.threshold !== undefined &&
    config.failover.threshold !== prevThreshold
  ) {
    setPrevThreshold(config.failover.threshold);
    setThresholdInput(String(config.failover.threshold));
  }

  // Whether the input differs from the saved config value
  const thresholdDirty =
    thresholdInput !== String(config?.failover?.threshold ?? "");

  // Save threshold via Update button
  const handleThresholdSave = useCallback(async () => {
    const val = parseInt(thresholdInput, 10);
    if (isNaN(val) || val < 0 || val > 100) return;
    setIsSavingThreshold(true);
    const ok = await onThresholdChange(val);
    setIsSavingThreshold(false);
    if (ok) {
      markThresholdSaved();
      toast.success("Failover threshold updated");
    }
  }, [thresholdInput, onThresholdChange, markThresholdSaved]);

  // --- Determine which RSRP to use based on network type ---
  const networkType = modemData?.network?.type ?? "";
  let activeRsrp: number | null = null;
  let activeEarfcn: number | string = "-";
  let activePci: number | string = "-";

  if (networkType === "5G-SA") {
    activeRsrp = modemData?.nr?.rsrp ?? null;
    activeEarfcn = modemData?.nr?.arfcn ?? "-";
    activePci = modemData?.nr?.pci ?? "-";
  } else {
    // LTE or 5G-NSA — use LTE PCell
    activeRsrp = modemData?.lte?.rsrp ?? null;
    activeEarfcn = modemData?.lte?.earfcn ?? "-";
    activePci = modemData?.lte?.pci ?? "-";
  }

  const signalQualityPct = rsrpToQualityPercent(activeRsrp);
  const qualityLvl = qualityLevel(signalQualityPct);

  // --- Signal quality badge styling ---
  const qualityBadgeStyles: Record<string, string> = {
    good: "bg-success/15 text-success hover:bg-success/20 border-success/30",
    fair: "bg-warning/15 text-warning hover:bg-warning/20 border-warning/30",
    poor: "bg-warning/15 text-warning hover:bg-warning/20 border-warning/30",
    critical:
      "bg-destructive/15 text-destructive hover:bg-destructive/20 border-destructive/30",
    none: "bg-muted/50 text-muted-foreground border-muted-foreground/30",
  };

  const qualityIcons: Record<string, React.ReactNode> = {
    good: <CheckCircle2Icon className="h-3 w-3" />,
    fair: <TriangleAlertIcon className="h-3 w-3" />,
    poor: <TriangleAlertIcon className="h-3 w-3" />,
    critical: <XCircleIcon className="h-3 w-3" />,
    none: null,
  };

  // --- Failover status badge ---
  const renderFailoverBadge = () => {
    // Show loading only during initial load; after that show a fallback
    if (!failoverState && isLoading) {
      return (
        <Badge
          variant="outline"
          className="bg-muted/50 text-muted-foreground border-muted-foreground/30"
        >
          <Loader2 className="h-3 w-3 animate-spin" />
          加载中
        </Badge>
      );
    }

    if (!failoverState) {
      return (
        <Badge
          variant="outline"
          className="bg-muted/50 text-muted-foreground border-muted-foreground/30"
        >
          <MinusCircleIcon className="h-3 w-3" />
          未知
        </Badge>
      );
    }

    if (failoverState.watcher_running) {
      return (
        <Badge
          variant="outline"
          className="bg-success/15 text-success hover:bg-success/20 border-success/30"
        >
          <CheckCircle2Icon className="h-3 w-3" />
          监控中
        </Badge>
      );
    }

    if (failoverState.activated) {
      return (
        <Badge
          variant="outline"
          className="bg-warning/15 text-warning hover:bg-warning/20 border-warning/30"
        >
          <TriangleAlertIcon className="h-3 w-3" />
          因信号较差已解锁
        </Badge>
      );
    }

    if (!failoverState.enabled) {
      return (
        <Badge
          variant="outline"
          className="bg-muted/50 text-muted-foreground border-muted-foreground/30"
        >
          <MinusCircleIcon className="h-3 w-3" />
          已禁用
        </Badge>
      );
    }

    return (
      <Badge
        variant="outline"
        className="bg-success/15 text-success hover:bg-success/20 border-success/30"
      >
        <CheckCircle2Icon className="h-3 w-3" />
        就绪
      </Badge>
    );
  };

  // --- Schedule status badge ---
  const renderScheduleBadge = () => {
    // Show loading only during initial load; after that show a fallback
    if (!config && isLoading) {
      return (
        <Badge
          variant="outline"
          className="bg-muted/50 text-muted-foreground border-muted-foreground/30"
        >
          <Loader2 className="h-3 w-3 animate-spin" />
          加载中
        </Badge>
      );
    }

    if (!config) {
      return (
        <Badge
          variant="outline"
          className="bg-muted/50 text-muted-foreground border-muted-foreground/30"
        >
          <MinusCircleIcon className="h-3 w-3" />
          未知
        </Badge>
      );
    }

    if (config.schedule.enabled) {
      return (
        <Badge
          variant="outline"
          className="bg-success/15 text-success hover:bg-success/20 border-success/30"
        >
          <CheckCircle2Icon className="h-3 w-3" />
          已启用
        </Badge>
      );
    }

    return (
      <Badge
        variant="outline"
        className="bg-muted/50 text-muted-foreground border-muted-foreground/30"
      >
        <MinusCircleIcon className="h-3 w-3" />
        未启用
      </Badge>
    );
  };

  // --- Connection state badge ---
  const renderConnectionStateBadge = () => {
    const serviceStatus = modemData?.network?.service_status;

    if (!modemData && isLoading) {
      return (
        <Badge
          variant="outline"
          className="bg-muted/50 text-muted-foreground border-muted-foreground/30"
        >
          <Loader2 className="h-3 w-3 animate-spin" />
          加载中
        </Badge>
      );
    }

    if (!modemData || !serviceStatus) {
      return (
        <Badge
          variant="outline"
          className="bg-muted/50 text-muted-foreground border-muted-foreground/30"
        >
          <MinusCircleIcon className="h-3 w-3" />
          未知
        </Badge>
      );
    }

    switch (serviceStatus) {
      case "optimal":
      case "connected":
        return (
          <Badge
            variant="outline"
            className="bg-success/15 text-success hover:bg-success/20 border-success/30"
          >
            <CheckCircle2Icon className="h-3 w-3" />
            已连接
          </Badge>
        );
      case "limited":
        return (
          <Badge
            variant="outline"
            className="bg-warning/15 text-warning hover:bg-warning/20 border-warning/30"
          >
            <TriangleAlertIcon className="h-3 w-3" />
            服务受限
          </Badge>
        );
      case "searching":
        return (
          <Badge
            variant="outline"
            className="bg-warning/15 text-warning hover:bg-warning/20 border-warning/30"
          >
            <TriangleAlertIcon className="h-3 w-3" />
            搜索中
          </Badge>
        );
      case "no_service":
        return (
          <Badge
            variant="outline"
            className="bg-destructive/15 text-destructive hover:bg-destructive/20 border-destructive/30"
          >
            <XCircleIcon className="h-3 w-3" />
            无服务
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="bg-muted/50 text-muted-foreground border-muted-foreground/30"
          >
            {serviceStatus}
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Tower Locking Settings</CardTitle>
          <CardDescription>
            Lock the modem to a specific cell tower. Keeps your connection stable instead of roaming between towers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            <Separator />
            {/* Persist Locking */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Separator />
            {/* Failover */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Separator />
            {/* Failover Threshold */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-16 rounded-md" />
            </div>
            <Separator />
            {/* Current Signal Quality */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <Separator />
            {/* Failover Status */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Separator />
            {/* Connection State */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Separator />
            {/* Schedule Locking Status */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Separator />
            {/* Active PCell E/AFRCN */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-12" />
            </div>
            <Separator />
            {/* Active PCell ID (PCI) */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-12" />
            </div>
            <Separator />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>基站锁定设置</CardTitle>
        <CardDescription>
          将调制解调器锁定到指定的小区基站，避免在不同基站之间频繁切换。与 5G NSA 不兼容。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2">
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="inline-flex" aria-label="重启后保持锁定说明">
                    <TbInfoCircleFilled className="size-5 text-info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    启用后，设备重启时会自动恢复基站锁定。
                  </p>
                </TooltipContent>
              </Tooltip>
              <span className="font-semibold text-muted-foreground text-sm">
                重启后保持锁定
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="tower-persist"
                checked={config?.persist ?? false}
                disabled={!config}
                onCheckedChange={onPersistChange}
              />
              <Label htmlFor="tower-persist">
                {config?.persist ? "已启用" : "已禁用"}
              </Label>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="inline-flex" aria-label="信号故障切换说明">
                    <TbInfoCircleFilled className="size-5 text-info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    启用后，当信号质量低于设定阈值或信号不可用时，
                    <br />
                    设备会自动解除当前基站锁定。
                  </p>
                </TooltipContent>
              </Tooltip>
              <span className="font-semibold text-muted-foreground text-sm">
                信号故障切换
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="tower-failover"
                checked={config?.failover?.enabled ?? false}
                disabled={!config || !hasActiveLock}
                onCheckedChange={(checked) => {
                  onFailoverChange(checked);
                  if (!checked) {
                    toast.warning("已禁用故障切换");
                  }
                }}
              />
              <Label htmlFor="tower-failover">
                {!hasActiveLock
                  ? "当前无锁定"
                  : (config?.failover?.enabled ?? false)
                    ? "已启用"
                    : "已禁用"}
              </Label>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="inline-flex" aria-label="故障切换阈值说明">
                    <TbInfoCircleFilled className="size-5 text-info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    仅在启用故障切换后生效。设置一个信号质量阈值，
                    <br />
                    当低于该阈值时，设备会自动解除基站锁定。
                  </p>
                </TooltipContent>
              </Tooltip>
              <label
                htmlFor="failover-threshold"
                className="font-semibold text-muted-foreground text-sm"
              >
                故障切换阈值（%）
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <InputGroup>
                <InputGroupInput
                  id="failover-threshold"
                  type="text"
                  placeholder="输入阈值"
                  className="w-10 h-6"
                  value={thresholdInput}
                  onChange={(e) => setThresholdInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleThresholdSave();
                  }}
                />
                <InputGroupAddon align="inline-end">
                  <PercentIcon />
                </InputGroupAddon>
              </InputGroup>
              {(thresholdDirty || thresholdSaved) && (
                <SaveButton
                  size="sm"
                  className="h-8"
                  isSaving={isSavingThreshold}
                  saved={thresholdSaved}
                  label="更新"
                  disabled={thresholdInput !== "" && (isNaN(Number(thresholdInput)) || Number(thresholdInput) < 0 || Number(thresholdInput) > 100)}
                  onClick={handleThresholdSave}
                />
              )}
            </div>
            {thresholdInput !== "" && (isNaN(Number(thresholdInput)) || Number(thresholdInput) < 0 || Number(thresholdInput) > 100) && (
              <p className="text-sm text-destructive" role="alert">
                阈值必须在 0 到 100 之间
              </p>
            )}
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-muted-foreground">
              当前信号质量
            </span>
            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className={qualityBadgeStyles[qualityLvl]}
              >
                {qualityIcons[qualityLvl]}
                {activeRsrp !== null ? `${signalQualityPct}%` : "不适用"}
              </Badge>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-muted-foreground">
              故障切换状态
            </span>
            <div className="flex items-center gap-1.5">
              {renderFailoverBadge()}
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-muted-foreground">
              连接状态
            </span>
            <div className="flex items-center gap-1.5">
              {renderConnectionStateBadge()}
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-muted-foreground">
              定时锁定状态
            </span>
            <div className="flex items-center gap-1.5">
              {renderScheduleBadge()}
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-muted-foreground">
              当前信道（EARFCN）
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold">
                {activeEarfcn !== null ? String(activeEarfcn) : "-"}
              </span>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-muted-foreground">
              当前小区 ID（PCI）
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold">
                {activePci !== null ? String(activePci) : "-"}
              </span>
            </div>
          </div>
          <Separator />
        </div>
      </CardContent>
    </Card>
  );
};

export default TowerLockingSettingsComponent;
