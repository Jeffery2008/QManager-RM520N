"use client";

import { useState, useCallback } from "react";
import { motion, type Variants } from "motion/react";
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
  CheckCircle2Icon,
  DownloadIcon,
  FileTextIcon,
  LoaderCircle,
  RefreshCwIcon,
} from "lucide-react";
import { toast } from "sonner";

import type { UpdateInfo, UpdateStatus, DownloadState } from "@/hooks/use-software-update";
import { StatusBadge } from "./software-update";

// ─── Helpers ────────────────────────────────────────────────────────────────

const PROSE_CLASSES = [
  "prose prose-sm dark:prose-invert max-w-none",
  "prose-headings:text-foreground prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2 first:prose-headings:mt-0",
  "prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:my-1.5",
  "prose-li:text-muted-foreground prose-li:my-0.5",
  "prose-ul:my-1.5 prose-ol:my-1.5",
  "prose-strong:text-foreground",
  "prose-code:text-foreground prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none",
  "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
  "prose-hr:border-border prose-hr:my-3",
].join(" ");

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小时前`;
  return `${Math.floor(hrs / 24)} 天前`;
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface UpdateStatusCardProps {
  updateInfo: UpdateInfo | null;
  updateStatus: UpdateStatus;
  downloadState: DownloadState | null;
  isLoading: boolean;
  isChecking: boolean;
  isUpdating: boolean;
  isDownloading: boolean;
  error: string | null;
  lastChecked: string | null;
  checkForUpdates: () => Promise<void>;
  downloadUpdate: (version?: string) => Promise<void>;
  installStaged: () => Promise<void>;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function UpdateStatusCard({
  updateInfo,
  updateStatus,
  downloadState,
  isLoading,
  isChecking,
  isUpdating,
  isDownloading,
  error,
  lastChecked,
  checkForUpdates,
  downloadUpdate,
  installStaged,
}: UpdateStatusCardProps) {
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);

  const handleDownload = useCallback(async () => {
    try {
      await downloadUpdate();
    } catch {
      toast.error("启动下载失败");
    }
  }, [downloadUpdate]);

  const handleInstall = useCallback(async () => {
    setShowInstallDialog(false);
    try {
      await installStaged();
    } catch {
      toast.error("启动安装失败");
    }
  }, [installStaged]);

  // ── Loading skeleton ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>更新状态</CardTitle>
          <CardDescription>
            当前版本与可用更新。
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
          <CardTitle>更新状态</CardTitle>
          <CardDescription>
            当前版本与可用更新。
          </CardDescription>
          {updateInfo && (
            <CardAction>
              <StatusBadge
                updateAvailable={updateAvailable}
                isUpdating={false}
                isDownloading={isDownloading}
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

          <motion.div
            className="grid gap-2 min-w-0"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* ── Version display ─────────────────────────────────── */}
            <Separator />
            {updateAvailable && updateInfo?.latest_version ? (
              <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      已安装
                    </span>
                    <span className="text-sm font-medium">
                      {updateInfo.current_version}
                    </span>
                  </div>
                  <ArrowRightIcon className="size-4 text-muted-foreground" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      可更新
                    </span>
                    <span className="text-sm font-medium text-primary">
                      {updateInfo.latest_version}
                    </span>
                  </div>
                </div>
                {updateInfo.download_size && (
                  <Badge variant="secondary" className="ml-auto">
                    {updateInfo.download_size}
                  </Badge>
                )}
              </motion.div>
            ) : (
              <motion.div variants={itemVariants} className="flex items-center justify-between">
                <p className="font-semibold text-muted-foreground text-sm">
                  当前版本
                </p>
                <span className="text-sm font-medium">
                  {updateInfo?.current_version ?? "未知"}
                </span>
              </motion.div>
            )}

            {/* ── Inline release notes (clickable → dialog) ────────── */}
            {(() => {
              const displayChangelog = updateAvailable
                ? updateInfo?.changelog
                : updateInfo?.current_changelog;
              if (!displayChangelog) return null;
              return (
                <>
                  <Separator />
                  <motion.div variants={itemVariants} className="flex flex-col gap-2 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm">
                        {updateAvailable ? "发布说明" : "当前版本说明"}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground"
                        onClick={() => setShowChangelog(true)}
                      >
                        <FileTextIcon className="size-3.5" />
                        查看全文
                      </Button>
                    </div>
                    <div
                      role="region"
                      aria-label="Release notes"
                      tabIndex={0}
                      className={`max-h-64 overflow-y-auto overflow-x-hidden wrap-break-word rounded-lg border bg-muted/50 p-4 ${PROSE_CLASSES}`}
                    >
                      <Markdown>{displayChangelog}</Markdown>
                    </div>
                  </motion.div>
                </>
              );
            })()}

            {/* ── Download progress / verified badge ──────────────── */}
            {updateAvailable && downloadState && (
              <>
                <Separator />
                <motion.div variants={itemVariants}>
                  {(downloadState.status === "downloading" || downloadState.status === "verifying") && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {downloadState.status === "downloading" ? "正在下载 qmanager.tar.gz..." : "正在验证 SHA-256..."}
                        </span>
                        {downloadState.size && (
                          <span className="text-xs text-muted-foreground">{downloadState.size}</span>
                        )}
                      </div>
                      <div
                        className="h-1.5 rounded-full bg-muted overflow-hidden"
                        role="progressbar"
                        aria-label={downloadState.status === "downloading" ? "下载更新中" : "校验完整性中"}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div className="h-full rounded-full bg-primary animate-pulse" style={{ width: downloadState.status === "verifying" ? "90%" : "60%" }} />
                      </div>
                    </div>
                  )}
                  {downloadState.status === "ready" && (
                    <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 p-2.5">
                      <CheckCircle2Icon className="size-4 text-success shrink-0" />
                      <span className="text-xs text-success">
                        下载完成并已通过 SHA-256 校验{downloadState.size ? `（${downloadState.size}）` : ""}
                      </span>
                    </div>
                  )}
                  {downloadState.status === "error" && (
                    <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-2.5">
                      <AlertTriangleIcon className="size-4 text-destructive shrink-0" />
                      <span className="text-xs text-destructive">
                        {downloadState.message || "下载失败"}
                      </span>
                    </div>
                  )}
                </motion.div>
              </>
            )}

            {/* ── Footer: timestamp + action button ───────────────── */}
            <Separator />
            <motion.div variants={itemVariants} className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {lastChecked
                  ? `上次检查：${formatRelativeTime(lastChecked)}`
                  : "从未检查"}
              </span>
              {updateAvailable ? (
                downloadState?.status === "ready" ? (
                  <Button
                    onClick={() => setShowInstallDialog(true)}
                    disabled={isUpdating}
                  >
                    <DownloadIcon className="size-4" />
                    安装更新
                  </Button>
                ) : (
                  <Button
                    onClick={handleDownload}
                    disabled={isDownloading || isUpdating}
                  >
                    {isDownloading ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin" />
                        下载中...
                      </>
                    ) : downloadState?.status === "error" ? (
                      <>
                        <RefreshCwIcon className="size-4" />
                        重新下载
                      </>
                    ) : (
                      <>
                        <DownloadIcon className="size-4" />
                        下载更新
                      </>
                    )}
                  </Button>
                )
              ) : (
                <Button
                  variant="outline"
                  onClick={checkForUpdates}
                  disabled={isChecking || isUpdating}
                >
                  {isChecking ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      检查中...
                    </>
                  ) : (
                    <>
                      <RefreshCwIcon className="size-4" />
                      检查更新
                    </>
                  )}
                </Button>
              )}
            </motion.div>
          </motion.div>
        </CardContent>
      </Card>

      {/* ── Release notes dialog ──────────────────────────────────────── */}
      <Dialog open={showChangelog} onOpenChange={setShowChangelog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              发布说明 — {updateAvailable ? updateInfo?.latest_version : updateInfo?.current_version}
            </DialogTitle>
          </DialogHeader>
          <div
            role="region"
            aria-label="Full release notes"
            tabIndex={0}
            className={`max-h-[60vh] overflow-y-auto overflow-x-hidden wrap-break-word rounded-lg border bg-muted/50 p-5 ${PROSE_CLASSES}`}
          >
            <Markdown>
              {(updateAvailable ? updateInfo?.changelog : updateInfo?.current_changelog) ?? ""}
            </Markdown>
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
            <AlertDialogTitle>安装更新</AlertDialogTitle>
            <AlertDialogDescription>
              这会将 QManager 从{" "}
              <strong>{updateInfo?.current_version}</strong> to{" "}
              <strong>{updateInfo?.latest_version}</strong>.
              {updateInfo?.download_size && (
                <>
                  下载大小：<strong>{updateInfo.download_size}</strong>。
                </>
              )} 安装完成后设备会自动重启。更新期间请勿断电。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleInstall}>
              <DownloadIcon className="size-4" />
              立即安装
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
