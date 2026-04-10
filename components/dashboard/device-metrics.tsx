"use client";

import React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  TbAlertTriangleFilled,
  TbCircleArrowDownFilled,
  TbCircleArrowUpFilled,
  TbInfoCircleFilled,
} from "react-icons/tb";

import type {
  DeviceStatus,
  TrafficStatus,
  LteStatus,
  NrStatus,
} from "@/types/modem-status";
import {
  formatBytesPerSec,
  formatUptime,
  calculateLteDistance,
  calculateNrDistance,
  formatDistance,
  formatTemperature,
} from "@/types/modem-status";
import { useUnitPreferences } from "@/hooks/use-system-settings";

interface DeviceMetricsComponentProps {
  deviceData: DeviceStatus | null;
  trafficData: TrafficStatus | null;
  lteData: LteStatus | null;
  nrData: NrStatus | null;
  isLoading: boolean;
}

// --- Warning thresholds ---
const TEMP_WARN = 60; // °C
const TEMP_DANGER = 75; // °C
const CPU_WARN = 70; // percentage
const CPU_DANGER = 90; // percentage

// --- Animated metric progress bar ---
function MetricBar({
  value,
  max = 100,
  warnAt,
  dangerAt,
}: {
  value: number;
  max?: number;
  warnAt: number;
  dangerAt: number;
}) {
  const pct = Math.min((value / max) * 100, 100);
  const colorClass =
    value >= dangerAt
      ? "bg-destructive"
      : value >= warnAt
        ? "bg-warning"
        : "bg-primary";
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
      <motion.div
        className={cn("h-full rounded-full", colorClass)}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: pct / 100 }}
        style={{ originX: 0 }}
        transition={{ type: "spring", stiffness: 180, damping: 24 }}
      />
    </div>
  );
}

const DeviceMetricsComponent = ({
  deviceData,
  trafficData,
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

  const rxSpeed = trafficData?.rx_bytes_per_sec ?? 0;
  const txSpeed = trafficData?.tx_bytes_per_sec ?? 0;
  const isTempHigh = temp !== null && temp >= TEMP_WARN;
  const isCpuHigh = cpu !== null && cpu >= CPU_WARN;
  const memPct = memTotal > 0 ? (memUsed / memTotal) * 100 : 0;

  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader className="-mb-4">
          <CardTitle className="text-lg font-semibold">
            Device Metrics
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
          Device Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2">
          {/* Modem Temperature */}
          <Separator />
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-muted-foreground text-sm">
                Modem Temperature
              </p>
              <div className="flex items-center gap-1.5">
                {isTempHigh && (
                  <Badge className="bg-warning/15 text-warning hover:bg-warning/20 border-warning/30">
                    <TbAlertTriangleFilled className="text-warning" />
                    High Temp
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
                CPU Usage
              </p>
              <div className="flex items-center gap-1.5">
                {isCpuHigh && (
                  <Badge className="bg-warning/15 text-warning hover:bg-warning/20 border-warning/30">
                    <TbAlertTriangleFilled className="text-warning" />
                    High CPU
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
                Memory Usage
              </p>
              <p className="font-semibold text-sm tabular-nums">
                {memTotal > 0 ? `${memUsed} MB / ${memTotal} MB` : "-"}
              </p>
            </div>
            {memTotal > 0 && (
              <MetricBar value={memPct} max={100} warnAt={70} dangerAt={90} />
            )}
          </div>

          {/* Live Traffic */}
          <Separator />
          <div className="flex items-center justify-between">
            <p className="font-semibold text-muted-foreground text-sm">
              Live Traffic
            </p>
            <div className="flex items-center gap-x-2">
              <div className="flex items-center gap-1">
                <TbCircleArrowDownFilled className="text-info size-5" />
                <p className="font-semibold text-sm tabular-nums">
                  {formatBytesPerSec(rxSpeed)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <TbCircleArrowUpFilled className="text-purple-500 size-5" />
                <p className="font-semibold text-sm tabular-nums">
                  {formatBytesPerSec(txSpeed)}
                </p>
              </div>
            </div>
          </div>

          {/* LTE Cell Distance */}
          <Separator />
          <div className="flex items-center justify-between">
            <p className="font-semibold text-muted-foreground text-sm">
              LTE Cell Distance
            </p>

            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="inline-flex" aria-label="More info">
                    <TbInfoCircleFilled className="size-5 text-info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {lteData?.ta ? (
                    <p>
                      This is only an approximation based <br /> on the LTE
                      Timing Advance value of{" "}
                      <span className="font-semibold">{lteData.ta}</span>.
                    </p>
                  ) : (
                    <p>Timing Advance value is not available.</p>
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
              NR Cell Distance
            </p>
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="inline-flex" aria-label="More info">
                    <TbInfoCircleFilled className="size-5 text-info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {nrData?.ta ? (
                    <p>
                      This is only an approximation based <br /> on the NR
                      Timing Advance value of{" "}
                      <span className="font-semibold">{nrData.ta}</span>.
                    </p>
                  ) : (
                    <p>Timing Advance value is not available.</p>
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
              Connection Uptime
            </p>
            <p className="font-semibold text-sm tabular-nums">
              {displayConnUptime > 0 ? formatUptime(displayConnUptime) : "-"}
            </p>
          </div>

          {/* Device Uptime */}
          <Separator />
          <div className="flex items-center justify-between">
            <p className="font-semibold text-muted-foreground text-sm">
              Device Uptime
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
