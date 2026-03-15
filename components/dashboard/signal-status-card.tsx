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

import { RSRP_THRESHOLDS, getSignalQuality } from "@/types/modem-status";

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

export interface SignalStatusRow {
  label: string;
  value: string;
}

interface SignalStatusCardProps {
  title: string;
  state: string;
  rsrp: number | null;
  rows: SignalStatusRow[];
  isLoading: boolean;
}

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
          <dl className="grid divide-y divide-border border-y border-border">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between py-2">
                <dt className="font-semibold text-muted-foreground text-sm">
                  {row.label}
                </dt>
                <dd className="font-semibold text-sm">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}
