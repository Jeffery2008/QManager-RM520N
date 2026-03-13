"use client";

import React, { useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

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
import {
  TbAlertTriangleFilled,
  TbInfoCircleFilled,
  TbSquareRoundedCheckFilled,
  TbCircleXFilled,
} from "react-icons/tb";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, PercentIcon } from "lucide-react";
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
    if (isNaN(val) || val < 0 || val > 100) {
      toast.error("Threshold must be a number between 0 and 100");
      return;
    }
    setIsSavingThreshold(true);
    const ok = await onThresholdChange(val);
    setIsSavingThreshold(false);
    if (ok) {
      toast.success("Failover threshold updated");
    }
  }, [thresholdInput, onThresholdChange]);

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
    none: "bg-muted text-muted-foreground border-border",
  };

  const qualityIcons: Record<string, React.ReactNode> = {
    good: <TbSquareRoundedCheckFilled />,
    fair: <TbAlertTriangleFilled />,
    poor: <TbAlertTriangleFilled />,
    critical: <TbCircleXFilled />,
    none: null,
  };

  // --- Failover status badge ---
  const renderFailoverBadge = () => {
    // Show loading only during initial load; after that show a fallback
    if (!failoverState && isLoading) {
      return (
        <Badge
          variant="outline"
          className="bg-muted text-muted-foreground border-border"
        >
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading
        </Badge>
      );
    }

    if (!failoverState) {
      return (
        <Badge
          variant="outline"
          className="bg-muted text-muted-foreground border-border"
        >
          Unknown
        </Badge>
      );
    }

    if (failoverState.watcher_running) {
      return (
        <Badge
          variant="outline"
          className="bg-success/15 text-success hover:bg-success/20 border-success/30"
        >
          <TbSquareRoundedCheckFilled />
          Monitoring
        </Badge>
      );
    }

    if (failoverState.activated) {
      return (
        <Badge
          variant="outline"
          className="bg-warning/15 text-warning hover:bg-warning/20 border-warning/30"
        >
          <TbAlertTriangleFilled />
          Unlocked due to Poor Signal
        </Badge>
      );
    }

    if (!failoverState.enabled) {
      return (
        <Badge
          variant="outline"
          className="bg-muted text-muted-foreground border-border"
        >
          Disabled
        </Badge>
      );
    }

    return (
      <Badge
        variant="outline"
        className="bg-success/15 text-success hover:bg-success/20 border-success/30"
      >
        <TbSquareRoundedCheckFilled />
        Ready
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
          className="bg-muted text-muted-foreground border-border"
        >
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading
        </Badge>
      );
    }

    if (!config) {
      return (
        <Badge
          variant="outline"
          className="bg-muted text-muted-foreground border-border"
        >
          Unknown
        </Badge>
      );
    }

    if (config.schedule.enabled) {
      return (
        <Badge
          variant="outline"
          className="bg-success/15 text-success hover:bg-success/20 border-success/30"
        >
          <TbSquareRoundedCheckFilled />
          Active
        </Badge>
      );
    }

    return (
      <Badge
        variant="outline"
        className="bg-muted text-muted-foreground border-border"
      >
        Inactive
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
          className="bg-muted text-muted-foreground border-border"
        >
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading
        </Badge>
      );
    }

    if (!modemData || !serviceStatus) {
      return (
        <Badge
          variant="outline"
          className="bg-muted text-muted-foreground border-border"
        >
          Unknown
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
            <TbSquareRoundedCheckFilled />
            Connected
          </Badge>
        );
      case "limited":
        return (
          <Badge
            variant="outline"
            className="bg-warning/15 text-warning hover:bg-warning/20 border-warning/30"
          >
            <TbAlertTriangleFilled />
            Limited Service
          </Badge>
        );
      case "searching":
        return (
          <Badge
            variant="outline"
            className="bg-warning/15 text-warning hover:bg-warning/20 border-warning/30"
          >
            <TbAlertTriangleFilled />
            Searching
          </Badge>
        );
      case "no_service":
        return (
          <Badge
            variant="outline"
            className="bg-destructive/15 text-destructive hover:bg-destructive/20 border-destructive/30"
          >
            <TbCircleXFilled />
            No Service
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="bg-muted text-muted-foreground border-border"
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
            Configure cellular tower locking for the Primary Cell (PCell).
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
        <CardTitle>Tower Locking Settings</CardTitle>
        <CardDescription>
          Configure cellular tower locking for the Primary Cell (PCell). Not
          compatible with NR5G-NSA.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2">
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <TbInfoCircleFilled className="w-5 h-5 text-blue-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    When enabled, the device will persist tower locking settings
                    across reboots.
                  </p>
                </TooltipContent>
              </Tooltip>
              <p className="font-semibold text-muted-foreground text-sm">
                Persist Locking
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="tower-persist"
                checked={config?.persist ?? false}
                disabled={!config}
                onCheckedChange={onPersistChange}
              />
              <Label htmlFor="tower-persist">
                {config?.persist ? "Enabled" : "Disabled"}
              </Label>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <TbInfoCircleFilled className="w-5 h-5 text-blue-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    When enabled, the device will unlock from the tower if
                    signal quality
                    <br />
                    degrades below a certain threshold or becomes unavailable.
                  </p>
                </TooltipContent>
              </Tooltip>
              <p className="font-semibold text-muted-foreground text-sm">
                Failover
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="tower-failover"
                checked={config?.failover?.enabled ?? false}
                disabled={!config || !hasActiveLock}
                onCheckedChange={(checked) => {
                  onFailoverChange(checked);
                  if (!checked) {
                    toast.warning("Failover disabled");
                  }
                }}
              />
              <Label htmlFor="tower-failover">
                {!hasActiveLock
                  ? "No active lock"
                  : (config?.failover?.enabled ?? false)
                    ? "Enabled"
                    : "Disabled"}
              </Label>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <TbInfoCircleFilled className="w-5 h-5 text-blue-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    This will only take effect if Failover is enabled. Set the
                    signal quality
                    <br />
                    threshold below which the device will unlock from the tower.
                  </p>
                </TooltipContent>
              </Tooltip>
              <p className="font-semibold text-muted-foreground text-sm">
                Failover Threshold
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <InputGroup>
                <InputGroupInput
                  type="text"
                  placeholder="Enter threshold"
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
              {thresholdDirty && (
                <Button
                  size="sm"
                  className="h-8"
                  disabled={isSavingThreshold}
                  onClick={handleThresholdSave}
                >
                  {isSavingThreshold ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Update"
                  )}
                </Button>
              )}
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground ">
              Current Signal Quality
            </p>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold ">
                <Badge
                  variant="outline"
                  className={qualityBadgeStyles[qualityLvl]}
                >
                  {qualityIcons[qualityLvl]}
                  {activeRsrp !== null ? `${signalQualityPct}%` : "N/A"}
                </Badge>
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground ">
              Failover Status
            </p>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold ">{renderFailoverBadge()}</p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground ">
              Connection State
            </p>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold ">
                {renderConnectionStateBadge()}
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground ">
              Schedule Locking Status
            </p>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold ">{renderScheduleBadge()}</p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground ">
              Active PCell E/AFRCN
            </p>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold ">
                {activeEarfcn !== null ? String(activeEarfcn) : "-"}
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground ">
              Active PCell ID (PCI)
            </p>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold ">
                {activePci !== null ? String(activePci) : "-"}
              </p>
            </div>
          </div>
          <Separator />
        </div>
      </CardContent>
    </Card>
  );
};

export default TowerLockingSettingsComponent;
