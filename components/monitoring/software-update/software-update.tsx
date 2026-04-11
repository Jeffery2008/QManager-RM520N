"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  TriangleAlertIcon,
  DownloadIcon,
  LoaderCircle,
  RefreshCwIcon,
  PackageIcon,
  RotateCwIcon,
} from "lucide-react";

import { useSoftwareUpdate } from "@/hooks/use-software-update";
import type { UpdateStatus } from "@/hooks/use-software-update";
import { UpdateStatusCard } from "./update-status-card";
import { UpdatePreferencesCard } from "./update-preferences-card";

// ─── Shared helpers ─────────────────────────────────────────────────────────

export function StatusBadge({
  updateAvailable,
  isUpdating,
  isDownloading,
  updateStatus,
}: {
  updateAvailable: boolean;
  isUpdating: boolean;
  isDownloading?: boolean;
  updateStatus: UpdateStatus;
}) {
  if (isUpdating && updateStatus.status !== "error") {
    return (
        <Badge variant="outline" className="bg-info/15 text-info hover:bg-info/20 border-info/30">
          <DownloadIcon className="h-3 w-3" />
        更新中
        </Badge>
    );
  }
  if (isDownloading) {
    return (
        <Badge variant="outline" className="bg-info/15 text-info hover:bg-info/20 border-info/30">
          <DownloadIcon className="h-3 w-3" />
        下载中
        </Badge>
    );
  }
  if (updateAvailable) {
    return (
        <Badge variant="outline" className="bg-warning/15 text-warning hover:bg-warning/20 border-warning/30">
        <TriangleAlertIcon className="h-3 w-3" />
        有可用更新
      </Badge>
    );
  }
  return (
      <Badge variant="outline" className="bg-success/15 text-success hover:bg-success/20 border-success/30">
      <CheckCircle2Icon className="h-3 w-3" />
      已是最新版本
    </Badge>
  );
}

// ─── Update progress stepper ────────────────────────────────────────────────

interface StepConfig {
  label: string;
  detail: Record<string, string>;
  icon: React.ReactNode;
}

const STEPS: StepConfig[] = [
  {
    label: "下载",
    detail: {
      active: "正在下载更新包...",
      done: "下载完成",
    },
    icon: <DownloadIcon className="size-4" />,
  },
  {
    label: "安装",
    detail: {
      active: "正在安装更新...",
      done: "安装完成",
    },
    icon: <PackageIcon className="size-4" />,
  },
  {
    label: "重启",
    detail: {
      active: "设备重启中...",
      done: "重启完成",
    },
    icon: <RotateCwIcon className="size-4" />,
  },
];

const STEP_MAP: Record<string, number> = {
  downloading: 0,
  installing: 1,
  rebooting: 2,
};

type StepState = "done" | "active" | "pending";

function getStepState(stepIndex: number, activeIndex: number): StepState {
  if (stepIndex < activeIndex) return "done";
  if (stepIndex === activeIndex) return "active";
  return "pending";
}

const stepIconMap: Record<StepState, (defaultIcon: React.ReactNode) => React.ReactNode> = {
  done: () => <CheckIcon className="size-4 text-success" />,
  active: () => <LoaderCircle className="size-4 animate-spin text-info" />,
  pending: (icon) => <span className="text-muted-foreground/50">{icon}</span>,
};

function UpdateProgressStepper({
  status,
  message,
}: {
  status: string;
  message?: string;
}) {
  const activeIndex = STEP_MAP[status] ?? 0;

  return (
    <div className="space-y-1" role="list" aria-label="更新进度">
      {STEPS.map((step, i) => {
        const state = getStepState(i, activeIndex);
        const detailText =
          state === "active"
            ? message || step.detail.active
            : state === "done"
              ? step.detail.done
              : "等待中...";

        return (
          <motion.div
            key={step.label}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, delay: i * 0.06, ease: "easeOut" }}
            role="listitem"
            aria-current={state === "active" ? "step" : undefined}
            className={cn(
              "flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-300",
              state === "active" && "bg-info/5",
            )}
          >
            <div className="mt-0.5 shrink-0">
              {stepIconMap[state](step.icon)}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  "font-medium",
                  state === "done" && "text-success",
                  state === "active" && "text-foreground",
                  state === "pending" && "text-muted-foreground",
                )}
              >
                {step.label}
              </p>
              <p
                className={cn(
                  "text-xs mt-0.5",
                  state === "active"
                    ? "text-muted-foreground"
                    : "text-muted-foreground/60",
                )}
              >
                {detailText}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Segmented progress bar ─────────────────────────────────────────────────

function SegmentedProgress({ activeIndex }: { activeIndex: number }) {
  return (
    <div
      className="flex w-full gap-1.5"
      role="progressbar"
      aria-valuenow={activeIndex + 1}
      aria-valuemax={STEPS.length}
      aria-label="更新进度"
    >
      {STEPS.map((step, i) => (
        <div
          key={step.label}
          className={cn(
            "h-0.75 flex-1 rounded-full transition-colors duration-500",
            i < activeIndex
              ? "bg-success"
              : i === activeIndex
                ? "bg-primary/60"
                : "bg-muted/30",
          )}
        />
      ))}
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

const SoftwareUpdateComponent = () => {
  const hookData = useSoftwareUpdate();
  const {
    updateInfo,
    updateStatus,
    downloadState,
    isLoading,
    isChecking,
    isUpdating,
    isDownloading,
    error,
  } = hookData;

  // ── Fatal error (no data at all) ──────────────────────────────────────
  if (error && !updateInfo && !isLoading) {
    return (
      <PageWrapper>
        <Card className="@container/card">
          <CardHeader>
            <CardTitle>更新状态</CardTitle>
            <CardDescription>
              无法检查更新。
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
                onClick={hookData.checkForUpdates}
                disabled={isChecking}
              >
                {isChecking ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    检查中...
                  </>
                ) : (
                  <>
                    <RefreshCwIcon className="size-4" />
                    重试
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageWrapper>
    );
  }

  // ── Updating state (replaces entire card grid) ────────────────────────
  if (isUpdating && updateStatus.status !== "error") {
    const activeIndex = STEP_MAP[updateStatus.status] ?? 0;

    return (
      <PageWrapper>
        <Card className="@container/card">
          <CardHeader>
            <CardTitle>更新进行中</CardTitle>
            <CardDescription>
              {updateStatus.version
                ? `正在更新到 ${updateStatus.version}`
                : "正在更新 QManager"}
              {updateStatus.size && ` (${updateStatus.size})`}
            </CardDescription>
            <CardAction>
              <StatusBadge
                updateAvailable={false}
                isUpdating={true}
                isDownloading={isDownloading}
                updateStatus={updateStatus}
              />
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-5" aria-live="polite">
              {/* Step list */}
              <UpdateProgressStepper
                status={updateStatus.status}
                message={updateStatus.message}
              />

              {/* Segmented progress bar */}
              <SegmentedProgress activeIndex={activeIndex} />

              {/* Warning footer */}
              <div role="alert" className="flex items-center justify-center gap-2 rounded-lg bg-warning/10 px-4 py-2.5">
                <AlertTriangleIcon className="size-4 shrink-0 text-warning" />
                <p className="text-xs font-medium text-warning">
                  更新期间请勿关闭设备电源
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </PageWrapper>
    );
  }

  // ── Normal state: 2-card grid ─────────────────────────────────────────
  return (
    <PageWrapper>
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <UpdateStatusCard
          updateInfo={updateInfo}
          updateStatus={updateStatus}
          downloadState={downloadState}
          isLoading={isLoading}
          isChecking={isChecking}
          isUpdating={isUpdating}
          isDownloading={isDownloading}
          error={error}
          lastChecked={hookData.lastChecked}
          checkForUpdates={hookData.checkForUpdates}
          downloadUpdate={hookData.downloadUpdate}
          installStaged={hookData.installStaged}
        />
        <UpdatePreferencesCard
          updateInfo={updateInfo}
          isLoading={isLoading}
          isUpdating={isUpdating}
          isDownloading={isDownloading}
          downloadUpdate={hookData.downloadUpdate}
          togglePrerelease={hookData.togglePrerelease}
          saveAutoUpdate={hookData.saveAutoUpdate}
        />
      </div>
    </PageWrapper>
  );
};

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">QManager 更新</h1>
        <p className="text-muted-foreground">
          检查更新、查看发行说明并管理 QManager 版本。
        </p>
      </div>
      {children}
    </div>
  );
}

export default SoftwareUpdateComponent;
