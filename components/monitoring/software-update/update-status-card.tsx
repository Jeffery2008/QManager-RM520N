"use client";

import { useState, useCallback } from "react";
import Markdown from "react-markdown";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  DownloadIcon,
  FileTextIcon,
  LoaderCircle,
  RefreshCwIcon,
} from "lucide-react";
import { toast } from "sonner";

import type { UpdateInfo, UpdateStatus } from "@/hooks/use-software-update";
import { StatusBadge } from "./software-update";

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

// ─── Props ──────────────────────────────────────────────────────────────────

interface UpdateStatusCardProps {
  updateInfo: UpdateInfo | null;
  updateStatus: UpdateStatus;
  isLoading: boolean;
  isChecking: boolean;
  isUpdating: boolean;
  error: string | null;
  lastChecked: string | null;
  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function UpdateStatusCard({
  updateInfo,
  updateStatus,
  isLoading,
  isChecking,
  isUpdating,
  error,
  lastChecked,
  checkForUpdates,
  installUpdate,
}: UpdateStatusCardProps) {
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);

  const handleInstall = useCallback(async () => {
    setShowInstallDialog(false);
    try {
      await installUpdate();
    } catch {
      toast.error("Failed to start update");
    }
  }, [installUpdate]);

  // ── Loading skeleton ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Update Status</CardTitle>
          <CardDescription>
            Current version and available updates.
          </CardDescription>
          <CardAction>
            <Skeleton className="h-5 w-24 rounded-full" />
          </CardAction>
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
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-36" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const updateAvailable = updateInfo?.update_available ?? false;
  const displayError = updateInfo?.check_error || error;

  return (
    <>
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Update Status</CardTitle>
          <CardDescription>
            Current version and available updates.
          </CardDescription>
          {updateInfo && (
            <CardAction>
              <StatusBadge
                updateAvailable={updateAvailable}
                isUpdating={false}
                updateStatus={updateStatus}
              />
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          {/* Non-fatal error (rate limited, network issue, etc.) */}
          {displayError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangleIcon className="size-4" />
              <AlertDescription>{displayError}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2">
            {/* ── Version display ─────────────────────────────────── */}
            <Separator />
            {updateAvailable && updateInfo?.latest_version ? (
              <div className="flex items-center gap-3 py-1">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Installed
                  </span>
                  <span className="text-sm font-medium">
                    {updateInfo.current_version}
                  </span>
                </div>
                <ArrowRightIcon className="size-4 text-muted-foreground" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Available
                  </span>
                  <span className="text-sm font-medium text-primary">
                    {updateInfo.latest_version}
                  </span>
                </div>
                {updateInfo.download_size && (
                  <Badge variant="secondary" className="ml-auto">
                    {updateInfo.download_size}
                  </Badge>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="font-semibold text-muted-foreground text-sm">
                  Installed Version
                </p>
                <span className="text-sm font-medium">
                  {updateInfo?.current_version ?? "Unknown"}
                </span>
              </div>
            )}

            {/* ── Inline release notes (clickable → dialog) ────────── */}
            {updateAvailable && updateInfo?.changelog && (
              <>
                <Separator />
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">Release Notes</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto px-2 py-1 text-xs text-muted-foreground"
                      onClick={() => setShowChangelog(true)}
                    >
                      <FileTextIcon className="size-3.5" />
                      View full
                    </Button>
                  </div>
                  <div className="max-h-64 overflow-y-auto rounded-lg border bg-muted/50 p-4
                    prose prose-sm dark:prose-invert max-w-none
                    prose-headings:text-foreground prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2 first:prose-headings:mt-0
                    prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:my-1.5
                    prose-li:text-muted-foreground prose-li:my-0.5
                    prose-ul:my-1.5 prose-ol:my-1.5
                    prose-strong:text-foreground
                    prose-code:text-foreground prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
                    prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                    prose-hr:border-border prose-hr:my-3"
                  >
                    <Markdown>{updateInfo.changelog}</Markdown>
                  </div>
                </div>
              </>
            )}

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
                  onClick={checkForUpdates}
                  disabled={isChecking || isUpdating}
                >
                  {isChecking ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
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

      {/* ── Release notes dialog ──────────────────────────────────────── */}
      <Dialog open={showChangelog} onOpenChange={setShowChangelog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Release Notes — {updateInfo?.latest_version}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-lg border bg-muted/50 p-5
            prose prose-sm dark:prose-invert max-w-none
            prose-headings:text-foreground prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2 first:prose-headings:mt-0
            prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:my-1.5
            prose-li:text-muted-foreground prose-li:my-0.5
            prose-ul:my-1.5 prose-ol:my-1.5
            prose-strong:text-foreground
            prose-code:text-foreground prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-hr:border-border prose-hr:my-3"
          >
            <Markdown>{updateInfo?.changelog ?? ""}</Markdown>
          </div>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>

      {/* ── Install confirmation dialog ──────────────────────────────── */}
      <AlertDialog
        open={showInstallDialog}
        onOpenChange={setShowInstallDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Install Update</AlertDialogTitle>
            <AlertDialogDescription>
              This will update QManager from{" "}
              <strong>{updateInfo?.current_version}</strong> to{" "}
              <strong>{updateInfo?.latest_version}</strong>.
              {updateInfo?.download_size && (
                <>
                  {" "}
                  Download size:{" "}
                  <strong>{updateInfo.download_size}</strong>.
                </>
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
    </>
  );
}
