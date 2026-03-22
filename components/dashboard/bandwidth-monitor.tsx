"use client";

import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { SettingsIcon } from "lucide-react";
import Link from "next/link";

import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { useBandwidthMonitor } from "@/hooks/use-bandwidth-monitor";
import { formatBitsPerSec } from "@/types/modem-status";

// =============================================================================
// BandwidthMonitorComponent — Real-time bandwidth chart via WebSocket
// =============================================================================

const chartConfig = {
  download: {
    label: "Download",
    color: "var(--chart-1)",
  },
  upload: {
    label: "Upload",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

/** Format a chart timestamp as relative seconds ago */
function formatTimeLabel(timestamp: number, latestTimestamp: number): string {
  const diff = Math.round((latestTimestamp - timestamp) / 1000);
  if (diff <= 0) return "Now";
  return `-${diff}s`;
}

export default function BandwidthMonitorComponent() {
  const gradientId = useId();
  const dlGradient = `${gradientId}-dl`;
  const ulGradient = `${gradientId}-ul`;

  const {
    chartData,
    interfaces,
    isConnected,
    isEnabled,
    isLoading,
    wsError,
    certAccepted,
    checkCertAcceptance,
  } = useBandwidthMonitor();

  // Determine WebSocket host for cert acceptance link
  const wsHost =
    typeof window !== "undefined" && window.location.hostname === "localhost"
      ? "192.168.224.1"
      : typeof window !== "undefined"
        ? window.location.hostname
        : "192.168.224.1";

  // ─── Loading state ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold @[250px]/card:text-3xl">
            Bandwidth Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[250px] items-center justify-center text-muted-foreground text-sm">
            Loading bandwidth monitor...
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─── Disabled state ────────────────────────────────────────────────────────
  if (!isEnabled) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold @[250px]/card:text-3xl">
            Bandwidth Monitor
          </CardTitle>
          <CardAction>
            <Link href="/system-settings/">
              <Button variant="outline" size="sm">
                <SettingsIcon className="size-4" />
                Configure
              </Button>
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="flex h-[250px] flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
            <p>Bandwidth monitoring is not enabled.</p>
            <p className="text-xs">
              Enable it in System Settings to see real-time network throughput.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─── Certificate not accepted ──────────────────────────────────────────────
  if (!certAccepted && !isConnected) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold @[250px]/card:text-3xl">
            Bandwidth Monitor
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="text-amber-500 border-amber-500/30">
              Certificate Required
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="flex h-[250px] flex-col items-center justify-center gap-4">
            <Alert>
              <AlertDescription>
                The bandwidth monitor uses a secure WebSocket connection with a
                self-signed certificate. You need to accept the certificate in
                your browser before data can stream.
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <a
                href={`https://${wsHost}:8838/`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm">
                  Accept Certificate
                </Button>
              </a>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => checkCertAcceptance()}
              >
                Check Again
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─── Prepare chart data with relative time labels ──────────────────────────
  const latestTs = chartData.length > 0 ? chartData[chartData.length - 1].timestamp : Date.now();
  const displayData = chartData.map((point) => ({
    ...point,
    time: formatTimeLabel(point.timestamp, latestTs),
  }));

  // ─── Active interfaces for footer (exclude rmnet_ipa0, only "up") ─────────
  const activeInterfaces = interfaces.filter(
    (iface) => iface.state === "up" && iface.name !== "rmnet_ipa0",
  );

  // ─── Connected state with chart ────────────────────────────────────────────
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold @[250px]/card:text-3xl">
          Bandwidth Monitor
        </CardTitle>
        <CardAction>
          <Badge
            variant="outline"
            className={
              isConnected
                ? "text-emerald-500 border-emerald-500/30"
                : "text-amber-500 border-amber-500/30"
            }
          >
            <span
              className={`mr-1 inline-block size-2 rounded-full ${
                isConnected ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
              }`}
            />
            {isConnected ? "Connected" : "Reconnecting"}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {wsError && !isConnected && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{wsError}</AlertDescription>
          </Alert>
        )}

        {displayData.length === 0 ? (
          <div className="flex h-[250px] items-center justify-center text-muted-foreground text-sm">
            {isConnected
              ? "Waiting for bandwidth data..."
              : "Connecting to bandwidth monitor..."}
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[250px] w-full"
          >
            <AreaChart data={displayData}>
              <defs>
                <linearGradient id={dlGradient} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-download)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-download)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
                <linearGradient id={ulGradient} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-upload)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-upload)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="time"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => formatBitsPerSec(value)}
                domain={[0, "auto"]}
                width={80}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => `${value}`}
                    formatter={(value) => formatBitsPerSec(value as number)}
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="download"
                type="monotone"
                fill={`url(#${dlGradient})`}
                stroke="var(--color-download)"
                baseValue={0}
              />
              <Area
                dataKey="upload"
                type="monotone"
                fill={`url(#${ulGradient})`}
                stroke="var(--color-upload)"
                baseValue={0}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
      {activeInterfaces.length > 0 && (
        <CardFooter>
          <div className="flex w-full flex-wrap items-center gap-3 text-sm">
            {activeInterfaces.map((iface) => (
              <div
                key={iface.name}
                className="flex items-center gap-1.5 text-muted-foreground"
              >
                <span className="inline-block size-2 rounded-full bg-emerald-500" />
                <span className="font-medium">{iface.name}</span>
                <span className="tabular-nums text-xs">
                  {formatBitsPerSec(iface.rx.bps + iface.tx.bps)}
                </span>
              </div>
            ))}
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
