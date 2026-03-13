"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  MdOutlineSignalCellularConnectedNoInternet0Bar,
} from "react-icons/md";

import type { NrStatus } from "@/types/modem-status";
import { RSRP_THRESHOLDS, getSignalQuality } from "@/types/modem-status";

interface NrStatusComponentProps {
  data: NrStatus | null;
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

const NrStatusComponent = ({ data, isLoading }: NrStatusComponentProps) => {
  const state = data?.state ?? "unknown";
  const stateDisplay = getStateDisplay(state);
  const isInactive = state === "inactive";
  const signalQuality = getSignalQuality(data?.rsrp ?? null, RSRP_THRESHOLDS);

  // Helper to format a signal value with unit, or show "-" if null
  const fmt = (value: number | null | undefined, unit: string) => {
    if (value === null || value === undefined) return "-";
    return `${value} ${unit}`;
  };

  const rows = [
    { label: "Band", value: data?.band || "-" },
    { label: "ARFCN", value: data?.arfcn?.toString() ?? "-" },
    { label: "PCI", value: data?.pci?.toString() ?? "-" },
    { label: "RSRP", value: fmt(data?.rsrp, "dBm") },
    { label: "RSRQ", value: fmt(data?.rsrq, "dB") },
    { label: "SINR", value: fmt(data?.sinr, "dB") },
    { label: "SCS", value: fmt(data?.scs, "kHz") },
  ];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            5G Primary Status
          </CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          5G Primary Status
        </CardTitle>
      </CardHeader>
      <CardContent>
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
            {isInactive ? (
              <MdOutlineSignalCellularConnectedNoInternet0Bar className="w-10 h-10 text-muted-foreground" />
            ) : (
              getSignalBarIcon(signalQuality)
            )}
          </div>
          <div className="grid">
            {rows.map((row) => (
              <div key={row.label}>
                <Separator className="mb-2" />
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-muted-foreground text-sm">
                    {row.label}
                  </p>
                  <p className="font-semibold text-sm">{row.value}</p>
                </div>
              </div>
            ))}
            <Separator />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default NrStatusComponent;
