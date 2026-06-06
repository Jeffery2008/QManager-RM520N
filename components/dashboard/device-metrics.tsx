"use client";

import React, { useState, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricBar } from "@/components/ui/metric-bar";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RotateCcwIcon } from "lucide-react";
import {
  TbAlertTriangleFilled,
  TbCircleArrowDownFilled,
  TbCircleArrowUpFilled,
  TbInfoCircleFilled,
} from "react-icons/tb";

import type {
  DeviceStatus,
  LteStatus,
  NrStatus,
} from "@/types/modem-status";
import {
  formatBytes,
  formatUptime,
  calculateLteDistance,
  calculateNrDistance,
  formatDistance,
  formatTemperature,
} from "@/types/modem-status";
import { useUnitPreferences } from "@/hooks/use-system-settings";
import { useDataUsed } from "@/hooks/use-data-used";
import { useModemSubsys } from "@/hooks/use-modem-subsys";

interface DeviceMetricsComponentProps {
  deviceData: DeviceStatus | null;
  lteData: LteStatus | null;
  nrData: NrStatus | null;
  isLoading: boolean;
}

// --- Warning thresholds ---
const TEMP_WARN = 60; // °C
const TEMP_DANGER = 75; // °C
const CPU_WARN = 70; // percentage
const CPU_DANGER = 90; // percentage

const DeviceMetricsComponent = ({
  deviceData,
  lteData,
  nrData,
  isLoading,
}: DeviceMetricsComponentProps) => {
  const unitPrefs = useUnitPreferences();
  const temp = deviceData?.temperature ?? null;
  const cpu = deviceData?.cpu_usage ?? null;
  const memUsed = deviceData?.memory_used_mb ?? 0;
  const memTotal = deviceData?.memory_total_mb ?? 0;

  // Uptime values — read directly from poll data (no seconds displayed,
  // so no need for 1-second client-side interpolation)
  const displayDevUptime = deviceData?.uptime_seconds ?? 0;
  const displayConnUptime = deviceData?.conn_uptime_seconds ?? 0;

  const isTempHigh = temp !== null && temp >= TEMP_WARN;
  const isCpuHigh = cpu !== null && cpu >= CPU_WARN;
  const memPct = memTotal > 0 ? (memUsed / memTotal) * 100 : 0;

  // Persistent data-usage counter — polled independently at 2 s cadence
  const {
    data: dataUsed,
    isResetting,
    resetCounter,
  } = useDataUsed();

  // /usrdata partition usage — sourced from the poller cache via modem-subsys
  const { data: subsysData } = useModemSubsys();
  const storageTotalKb = subsysData?.storage?.total_kb ?? 0;
  const storageUsedKb = subsysData?.storage?.used_kb ?? 0;
  const storagePct = storageTotalKb > 0 ? (storageUsedKb / storageTotalKb) * 100 : 0;

  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const handleResetConfirm = useCallback(async () => {
    const ok = await resetCounter();
    if (ok) {
      toast.success("重置请求已加入队列，计数器会在几秒内更新。");
    } else {
      toast.error("重置请求加入队列失败，请重试。");
    }
    setResetDialogOpen(false);
  }, [resetCounter]);

  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader className="-mb-4">
          <CardTitle className="text-lg font-semibold">
            设备指标
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i}>
                <Separator />
                <div className="flex items-center justify-between py-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="@container/card">
      <CardHeader className="-mb-4">
        <CardTitle className="text-lg font-semibold tabular-nums">
          设备指标
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2">
          {/* Modem Temperature */}
          <Separator />
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-muted-foreground text-sm">
                调制解调器温度
              </p>
              <div className="flex items-center gap-1.5">
                {isTempHigh && (
                  <Badge className="bg-warning/15 text-warning hover:bg-warning/20 border-warning/30">
                    <TbAlertTriangleFilled className="text-warning" />
                    温度偏高
                  </Badge>
                )}
                <p className="font-semibold text-sm tabular-nums">
                  {formatTemperature(temp, unitPrefs?.tempUnit)}
                </p>
              </div>
            </div>
            {temp !== null && (
              <MetricBar value={temp} max={100} warnAt={TEMP_WARN} dangerAt={TEMP_DANGER} />
            )}
          </div>

          {/* CPU Usage */}
          <Separator />
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-muted-foreground text-sm">
                CPU 使用率
              </p>
              <div className="flex items-center gap-1.5">
                {isCpuHigh && (
                  <Badge className="bg-warning/15 text-warning hover:bg-warning/20 border-warning/30">
                    <TbAlertTriangleFilled className="text-warning" />
                    CPU 偏高
                  </Badge>
                )}
                <p className="font-semibold text-sm tabular-nums">
                  {cpu !== null ? `${cpu}%` : "-"}
                </p>
              </div>
            </div>
            {cpu !== null && (
              <MetricBar value={cpu} max={100} warnAt={CPU_WARN} dangerAt={CPU_DANGER} />
            )}
          </div>

          {/* Memory Usage */}
          <Separator />
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-muted-foreground text-sm">
                内存使用率
              </p>
              <p className="font-semibold text-sm tabular-nums">
                {memTotal > 0 ? `${memUsed} MB / ${memTotal} MB` : "-"}
              </p>
            </div>
            {memTotal > 0 && (
              <MetricBar value={memPct} max={100} warnAt={70} dangerAt={90} />
            )}
          </div>

          {/* Storage (/usrdata partition) */}
          <Separator />
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-muted-foreground text-sm">
                存储
              </p>
              <p className="font-semibold text-sm tabular-nums">
                {storageTotalKb > 0
                  ? `${formatBytes(storageUsedKb * 1024)} / ${formatBytes(storageTotalKb * 1024)}`
                  : "-"}
              </p>
            </div>
            {storageTotalKb > 0 && (
              <MetricBar value={storagePct} max={100} warnAt={80} dangerAt={95} />
            )}
          </div>

          {/* Data Used (persistent cumulative counter from AT+QGDCNT/QGDNRCNT) */}
          <Separator />
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="font-semibold text-muted-foreground text-sm shrink-0">
                已用流量
              </p>
              {/* Reset button */}
              <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-muted-foreground hover:text-foreground"
                    aria-label="重置流量计数器"
                    disabled={isResetting}
                  >
                    <RotateCcwIcon className="size-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>重置已用流量计数器？</AlertDialogTitle>
                    <AlertDialogDescription>
                      这会清零累计下载和上传总量，计数器会立即重新开始统计。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={handleResetConfirm}>
                      重置计数器
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <div className="flex items-center gap-x-2">
              <div className="flex items-center gap-1">
                <TbCircleArrowDownFilled className="text-info size-5 shrink-0" />
                <p className="font-semibold text-sm tabular-nums">
                  {formatBytes(dataUsed?.accumulated_rx_bytes ?? 0)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <TbCircleArrowUpFilled className="text-purple-500 size-5 shrink-0" />
                <p className="font-semibold text-sm tabular-nums">
                  {formatBytes(dataUsed?.accumulated_tx_bytes ?? 0)}
                </p>
              </div>
            </div>
          </div>

          {/* LTE Cell Distance */}
          <Separator />
          <div className="flex items-center justify-between">
            <p className="font-semibold text-muted-foreground text-sm">
              LTE 小区距离
            </p>

            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="inline-flex" aria-label="更多信息">
                    <TbInfoCircleFilled className="size-5 text-info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {lteData?.ta ? (
                    <p>
                      这是基于 LTE Timing Advance 值{" "}
                      <span className="font-semibold">{lteData.ta}</span>
                      <br /> 推算出的近似距离。
                    </p>
                  ) : (
                    <p>Timing Advance 值不可用。</p>
                  )}
                </TooltipContent>
              </Tooltip>
              <p className="font-semibold text-sm tabular-nums">
                {formatDistance(calculateLteDistance(lteData?.ta ?? null), unitPrefs?.distanceUnit)}
              </p>
            </div>
          </div>

          {/* NR Cell Distance */}
          <Separator />
          <div className="flex items-center justify-between">
            <p className="font-semibold text-muted-foreground text-sm">
              NR 小区距离
            </p>
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="inline-flex" aria-label="更多信息">
                    <TbInfoCircleFilled className="size-5 text-info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {nrData?.ta ? (
                    <p>
                      这是基于 NR Timing Advance 值{" "}
                      <span className="font-semibold">{nrData.ta}</span>
                      <br /> 推算出的近似距离。
                    </p>
                  ) : (
                    <p>Timing Advance 值不可用。</p>
                  )}
                </TooltipContent>
              </Tooltip>
              <p className="font-semibold text-sm tabular-nums">
                {formatDistance(calculateNrDistance(nrData?.ta ?? null), unitPrefs?.distanceUnit)}
              </p>
            </div>
          </div>

          {/* Connection Uptime */}
          <Separator />
          <div className="flex items-center justify-between">
            <p className="font-semibold text-muted-foreground text-sm">
              连接运行时间
            </p>
            <p className="font-semibold text-sm tabular-nums">
              {displayConnUptime > 0 ? formatUptime(displayConnUptime) : "-"}
            </p>
          </div>

          {/* Device Uptime */}
          <Separator />
          <div className="flex items-center justify-between">
            <p className="font-semibold text-muted-foreground text-sm">
              设备运行时间
            </p>
            <p className="font-semibold text-sm tabular-nums">
              {displayDevUptime > 0 ? formatUptime(displayDevUptime) : "-"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DeviceMetricsComponent;
