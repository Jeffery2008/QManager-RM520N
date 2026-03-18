"use client";

import { motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { FaCircle } from "react-icons/fa6";
import {
  MdSignalCellular0Bar,
  MdSignalCellular1Bar,
  MdSignalCellular2Bar,
  MdSignalCellular3Bar,
  MdSignalCellular4Bar,
  MdSignalCellularOff,
  MdOutlineSignalCellularConnectedNoInternet0Bar,
} from "react-icons/md";

import {
  RSRP_THRESHOLDS,
  getSignalQuality,
  type SignalThresholds,
} from "@/types/modem-status";

// --- Signal bar icon based on RSRP quality ---
function getSignalBarIcon(quality: string) {
  const iconClass = "size-10 text-primary";
  const props = { className: iconClass, "aria-hidden": true as const };
  switch (quality) {
    case "excellent":
      return <MdSignalCellular4Bar {...props} />;
    case "good":
      return <MdSignalCellular3Bar {...props} />;
    case "fair":
      return <MdSignalCellular2Bar {...props} />;
    case "poor":
      return <MdSignalCellular1Bar {...props} />;
    case "none":
      return <MdSignalCellular0Bar {...props} />;
    default:
      return <MdSignalCellularOff {...props} />;
  }
}

// --- Connection state display ---
function getStateDisplay(state: string) {
  switch (state) {
    case "connected":
      return { color: "text-success", label: "Connected" };
    case "disconnected":
      return { color: "text-destructive", label: "Disconnected" };
    case "searching":
      return { color: "text-warning", label: "Searching" };
    case "limited":
      return { color: "text-warning", label: "Limited Service" };
    case "inactive":
      return { color: "text-muted-foreground", label: "Inactive" };
    default:
      return { color: "text-muted-foreground", label: "Unknown" };
  }
}

// --- Value color based on signal quality threshold ---
function getValueColorClass(quality: string): string {
  switch (quality) {
    case "excellent":
    case "good":
      return "text-success";
    case "fair":
      return "text-warning";
    case "poor":
      return "text-destructive";
    default:
      return "";
  }
}

export interface SignalStatusRow {
  label: string;
  value: string;
  /** Raw numeric value — enables quality-based color coding */
  rawValue?: number | null;
  /** Threshold set to use for color coding (RSRP, RSRQ, or SINR) */
  thresholds?: SignalThresholds;
}

interface SignalStatusCardProps {
  title: string;
  state: string;
  rsrp: number | null;
  rows: SignalStatusRow[];
  isLoading: boolean;
}

// Stagger variants for metric rows
const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};
const rowVariants = {
  hidden: { opacity: 0, y: 5 },
  visible: { opacity: 1, y: 0 },
};

export function SignalStatusCard({
  title,
  state,
  rsrp,
  rows,
  isLoading,
}: SignalStatusCardProps) {
  const stateDisplay = getStateDisplay(state);
  const isInactive = state === "inactive";
  const signalQuality = getSignalQuality(rsrp, RSRP_THRESHOLDS);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <div className="grid gap-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="size-10" />
            </div>
            <div className="grid gap-2">
              {Array.from({ length: rows.length || 7 }).map((_, i) => (
                <div key={i}>
                  <Separator />
                  <div className="flex items-center justify-between py-1">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="flex items-center justify-between">
            <div className="grid gap-0.5">
              <h3 className="text-sm font-semibold">Signal Strength</h3>
              <div className="flex items-center gap-x-1">
                <FaCircle
                  className={`${stateDisplay.color} w-2 h-2`}
                  aria-hidden
                />
                <p className="text-muted-foreground text-xs">
                  {stateDisplay.label}
                </p>
              </div>
            </div>
            {isInactive ? (
              <MdOutlineSignalCellularConnectedNoInternet0Bar
                className="size-10 text-muted-foreground"
                aria-hidden
              />
            ) : (
              getSignalBarIcon(signalQuality)
            )}
          </div>

          {/* Metric rows — stagger in on first render */}
          <motion.dl
            className="grid divide-y divide-border border-y border-border"
            variants={listVariants}
            initial="hidden"
            animate="visible"
          >
            {rows.map((row) => {
              const quality =
                row.rawValue != null && row.thresholds
                  ? getSignalQuality(row.rawValue, row.thresholds)
                  : "none";
              const valueColor = getValueColorClass(quality);

              return (
                <motion.div
                  key={row.label}
                  variants={rowVariants}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="flex items-center justify-between py-2"
                >
                  <dt className="font-semibold text-muted-foreground text-sm">
                    {row.label}
                  </dt>
                  <dd className={cn("font-semibold text-sm tabular-nums", valueColor)}>
                    {row.value}
                  </dd>
                </motion.div>
              );
            })}
          </motion.dl>
        </div>
      </CardContent>
    </Card>
  );
}
