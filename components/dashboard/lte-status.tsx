"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { FaCircle } from "react-icons/fa6";
import {
  MdSignalCellular0Bar,
  MdSignalCellular1Bar,
  MdSignalCellular2Bar,
  MdSignalCellular3Bar,
  MdSignalCellular4Bar,
  MdSignalCellularOff,
} from "react-icons/md";

import type { LteStatus } from "@/types/modem-status";
import { RSRP_THRESHOLDS, getSignalQuality } from "@/types/modem-status";

interface LTEStatusComponentProps {
  data: LteStatus | null;
  isLoading: boolean;
}

// --- Signal bar icon based on RSRP quality ---
function getSignalBarIcon(quality: string) {
  const iconClass = "w-10 h-10 text-primary";
  switch (quality) {
    case "excellent":
      return <MdSignalCellular4Bar className={iconClass} />;
    case "good":
      return <MdSignalCellular3Bar className={iconClass} />;
    case "fair":
      return <MdSignalCellular2Bar className={iconClass} />;
    case "poor":
      return <MdSignalCellular1Bar className={iconClass} />;
    case "none":
      return <MdSignalCellular0Bar className={iconClass} />;
    default:
      return <MdSignalCellularOff className={iconClass} />;
  }
}

// --- Connection state display ---
function getStateDisplay(state: string) {
  switch (state) {
    case "connected":
      return { color: "text-green-500", label: "Connected" };
    case "disconnected":
      return { color: "text-red-500", label: "Disconnected" };
    case "searching":
      return { color: "text-yellow-500", label: "Searching" };
    case "limited":
      return { color: "text-yellow-500", label: "Limited Service" };
    case "inactive":
      return { color: "text-muted-foreground", label: "Inactive" };
    default:
      return { color: "text-muted-foreground", label: "Unknown" };
  }
}

const LTEStatusComponent = ({ data, isLoading }: LTEStatusComponentProps) => {
  const state = data?.state ?? "unknown";
  const stateDisplay = getStateDisplay(state);
  const signalQuality = getSignalQuality(data?.rsrp ?? null, RSRP_THRESHOLDS);

  // Helper to format a signal value with unit, or show "-" if null
  const fmt = (value: number | null | undefined, unit: string) => {
    if (value === null || value === undefined) return "-";
    return `${value} ${unit}`;
  };

  const rows = [
    { label: "Band", value: data?.band || "-" },
    { label: "EARFCN", value: data?.earfcn?.toString() ?? "-" },
    { label: "PCI", value: data?.pci?.toString() ?? "-" },
    { label: "RSRP", value: fmt(data?.rsrp, "dBm") },
    { label: "RSRQ", value: fmt(data?.rsrq, "dB") },
    { label: "RSSI", value: fmt(data?.rssi, "dBm") },
    { label: "SINR", value: fmt(data?.sinr, "dB") },
  ];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold tabular-nums">
            4G Primary Status
          </CardTitle>
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <div className="grid gap-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="w-10 h-10" />
            </div>
            <div className="grid gap-2">
              {Array.from({ length: 7 }).map((_, i) => (
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
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold tabular-nums">
          4G Primary Status
        </CardTitle>
        <div className="grid gap-4">
          <div className="flex items-center justify-between">
            <div className="grid gap-0.5">
              <h3 className="text-sm font-semibold">Signal Strength</h3>
              <div className="flex items-center gap-x-1">
                <FaCircle className={`${stateDisplay.color} w-2 h-2`} />
                <p className="text-muted-foreground text-xs">
                  {stateDisplay.label}
                </p>
              </div>
            </div>
            {getSignalBarIcon(signalQuality)}
          </div>
          <div className="grid gap-2">
            {rows.map((row) => (
              <div key={row.label}>
                <Separator />
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-muted-foreground text-sm">
                    {row.label}
                  </p>
                  <p className="font-semibold text-sm">{row.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardHeader>
    </Card>
  );
};

export default LTEStatusComponent;
