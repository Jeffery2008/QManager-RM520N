"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckIcon,
  AlertTriangleIcon,
  DownloadIcon,
  LoaderCircleIcon,
  RotateCcwIcon,
  RefreshCwIcon,
  ArrowRightIcon,
} from "lucide-react";

import { useSoftwareUpdate } from "@/hooks/use-software-update";
import type { UpdateStatus } from "@/hooks/use-software-update";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STEPS = ["Download", "Install", "Reboot"] as const;
const STEP_MAP: Record<string, number> = {
  downloading: 0,
  installing: 1,
  rebooting: 2,
};

function getStepState(
  stepIndex: number,
  activeIndex: number
): "done" | "active" | "pending" {
  if (stepIndex < activeIndex) return "done";
  if (stepIndex === activeIndex) return "active";
  return "pending";
}

// ─── Status badge helper ────────────────────────────────────────────────────

function StatusBadge({
  updateAvailable,
  isUpdating,
  updateStatus,
}: {
  updateAvailable: boolean;
  isUpdating: boolean;
  updateStatus: UpdateStatus;
}) {
  if (isUpdating && updateStatus.status !== "error") {
    return (
      <Badge variant="info">
        <DownloadIcon />
        Updating
      </Badge>
    );
  }
  if (updateAvailable) {
    return (
      <Badge variant="warning">
        <AlertTriangleIcon />
        Update available
      </Badge>
    );
  }
  return (
    <Badge variant="success">
      <CheckIcon />
      Up to date
    </Badge>
  );
}

// ─── Step indicators during update ──────────────────────────────────────────

function UpdateSteps({ status }: { status: string }) {
  const activeIndex = STEP_MAP[status] ?? 0;

  return (
    <div className="flex items-center gap-5">
      {STEPS.map((label, i) => {
        const state = getStepState(i, activeIndex);
        return (
          <div key={label} className="flex items-center gap-1.5">
            <span
              className={`size-2 rounded-full ${
                state === "done"
                  ? "bg-success"
                  : state === "active"
                    ? "bg-primary"
                    : "bg-muted-foreground/40"
              }`}
            />
            <span
              className={`text-xs font-medium ${
                state === "done"
                  ? "text-success"
                  : state === "active"
                    ? "text-primary"
                    : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function SoftwareUpdateCard() {
  const {
    updateInfo,
    updateStatus,
    isLoading,
    isChecking,
    isUpdating,
    error,
    lastChecked,
    checkForUpdates,
    installUpdate,
    rollback,
    togglePrerelease,
  } = useSoftwareUpdate();

  // Dialog state
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);

  // Pre-release toggle (optimistic)
  const [prereleaseToggling, setPrereleaseToggling] = useState(false);

  const handleTogglePrerelease = useCallback(
    async (checked: boolean) => {
      setPrereleaseToggling(true);
      try {
        await togglePrerelease(checked);
        toast.success(
          checked ? "Pre-release updates enabled" : "Pre-release updates disabled"
        );
      } catch {
        toast.error("Failed to update preference");
      } finally {
        setPrereleaseToggling(false);
      }
    },
    [togglePrerelease]
  );

  const handleInstall = useCallback(async () => {
    setShowInstallDialog(false);
    try {
      await installUpdate();
    } catch {
      toast.error("Failed to start update");
    }
  }, [installUpdate]);

  const handleRollback = useCallback(async () => {
    setShowRollbackDialog(false);
    try {
      await rollback();
    } catch {
      toast.error("Failed to start rollback");
    }
  }, [rollback]);

  const handleCheckForUpdates = useCallback(async () => {
    await checkForUpdates();
  }, [checkForUpdates]);

  // ── Loading skeleton ────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle>Software Update</CardTitle>
              <CardDescription>
                Manage QManager software updates.
              </CardDescription>
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            <Separator />
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-28" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-6 w-12" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-36" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Fatal error (no data at all) ────────────────────────────────────────

  if (error && !updateInfo) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Software Update</CardTitle>
          <CardDescription>
            Manage QManager software updates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangleIcon className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              onClick={handleCheckForUpdates}
              disabled={isChecking}
            >
              {isChecking ? (
                <>
                  <LoaderCircleIcon className="size-4 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCwIcon className="size-4" />
                  Retry
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Updating state (takes over the card body) ───────────────────────────

  if (isUpdating && updateStatus.status !== "error") {
    const statusMessages: Record<string, string> = {
      downloading: "Downloading update...",
      installing: "Installing update...",
      rebooting: "Rebooting device...",
    };

    return (
      <Card className="@container/card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle>Software Update</CardTitle>
              <CardDescription>
                Manage QManager software updates.
              </CardDescription>
            </div>
            <StatusBadge
              updateAvailable={false}
              isUpdating={true}
              updateStatus={updateStatus}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 py-6">
            <LoaderCircleIcon className="size-9 animate-spin text-primary" />
            <div className="text-center">
              <p className="text-sm font-medium">
                {updateStatus.message ||
                  statusMessages[updateStatus.status] ||
                  "Updating..."}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {updateStatus.version && `${updateStatus.version} — `}
                Do not power off the device
              </p>
            </div>
            <UpdateSteps status={updateStatus.status} />
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Normal state (up-to-date or update available) ───────────────────────

  const updateAvailable = updateInfo?.update_available ?? false;

  return (
    <>
      <Card className="@container/card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle>Software Update</CardTitle>
              <CardDescription>
                Manage QManager software updates.
              </CardDescription>
            </div>
            {updateInfo && (
              <StatusBadge
                updateAvailable={updateAvailable}
                isUpdating={false}
                updateStatus={updateStatus}
              />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Non-fatal update error (e.g., rate limited) */}
          {error && updateInfo && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangleIcon className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Non-fatal check error from backend (e.g., rate limited, network issue) */}
          {updateInfo?.check_error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangleIcon className="size-4" />
              <AlertDescription>{updateInfo.check_error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2">
            {/* ── Version display ─────────────────────────────────── */}
            <Separator />
            {updateAvailable && updateInfo?.latest_version ? (
              <div className="flex items-center gap-3 py-1">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Installed
                  </span>
                  <span className="text-sm font-medium">
                    {updateInfo.current_version}
                  </span>
                </div>
                <ArrowRightIcon className="size-4 text-muted-foreground" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Available
                  </span>
                  <span className="text-sm font-medium text-primary">
                    {updateInfo.latest_version}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">
                  Installed Version
                </span>
                <span className="text-sm font-medium">
                  {updateInfo?.current_version ?? "Unknown"}
                </span>
              </div>
            )}

            {/* ── Release notes (when update available) ───────────── */}
            {updateAvailable && updateInfo?.changelog && (
              <>
                <Separator />
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-muted-foreground">
                    Release Notes
                  </span>
                  <div className="rounded-lg border bg-muted/50 p-3 max-h-[140px] overflow-y-auto">
                    <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground font-[inherit]">
                      {updateInfo.changelog}
                    </pre>
                  </div>
                </div>
              </>
            )}

            {/* ── Rollback row ────────────────────────────────────── */}
            {updateInfo?.rollback_available && updateInfo?.rollback_version && (
              <>
                <Separator />
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-muted-foreground">
                    Rollback
                  </span>
                  <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">
                        Previous version
                      </span>
                      <span className="text-sm font-medium">
                        {updateInfo.rollback_version}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRollbackDialog(true)}
                      disabled={isUpdating}
                    >
                      <RotateCcwIcon className="size-4" />
                      Restore
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* ── Pre-release toggle ──────────────────────────────── */}
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-muted-foreground">
                Include pre-releases
              </span>
              <div className="flex items-center space-x-2">
                <Switch
                  id="include-prerelease"
                  checked={updateInfo?.include_prerelease ?? false}
                  onCheckedChange={handleTogglePrerelease}
                  disabled={prereleaseToggling || isUpdating}
                />
                <Label htmlFor="include-prerelease">
                  {updateInfo?.include_prerelease ? "Enabled" : "Disabled"}
                </Label>
              </div>
            </div>

            {/* ── Footer: timestamp + action button ───────────────── */}
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {lastChecked
                  ? `Last checked ${formatRelativeTime(lastChecked)}`
                  : "Never checked"}
              </span>
              {updateAvailable ? (
                <Button
                  onClick={() => setShowInstallDialog(true)}
                  disabled={isUpdating || !updateInfo?.download_url}
                >
                  <DownloadIcon className="size-4" />
                  Install Update
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleCheckForUpdates}
                  disabled={isChecking || isUpdating}
                >
                  {isChecking ? (
                    <>
                      <LoaderCircleIcon className="size-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <RefreshCwIcon className="size-4" />
                      Check for Updates
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Install confirmation dialog ──────────────────────────────── */}
      <AlertDialog open={showInstallDialog} onOpenChange={setShowInstallDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Install Update</AlertDialogTitle>
            <AlertDialogDescription>
              This will update QManager from{" "}
              <strong>{updateInfo?.current_version}</strong> to{" "}
              <strong>{updateInfo?.latest_version}</strong>.
              {updateInfo?.download_size && (
                <> Download size: {updateInfo.download_size}.</>
              )}{" "}
              The device will reboot automatically after installation. Do not
              power off the device during the update.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleInstall}>
              <DownloadIcon className="size-4" />
              Install Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Rollback confirmation dialog ─────────────────────────────── */}
      <AlertDialog
        open={showRollbackDialog}
        onOpenChange={setShowRollbackDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Previous Version</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore QManager to{" "}
              <strong>{updateInfo?.rollback_version}</strong>. The device will
              reboot automatically after the rollback. Do not power off the
              device during this process.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRollback}>
              <RotateCcwIcon className="size-4" />
              Restore Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
