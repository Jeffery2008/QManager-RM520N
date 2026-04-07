"use client";

import React, { useCallback, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DogIcon,
  InfoIcon,
  Loader2,
  CheckCircle2Icon,
  TriangleAlertIcon,
  AlertCircleIcon,
  ClockIcon,
  LockIcon,
  MinusCircleIcon,
} from "lucide-react";
import { useModemStatus } from "@/hooks/use-modem-status";
import { formatTimeAgo } from "@/types/modem-status";
import type { WatchcatState } from "@/types/modem-status";

interface WatchdogStatusCardProps {
  revertSim: () => Promise<boolean>;
  /** Whether the user has enabled watchdog in settings (from CGI, not daemon) */
  settingsEnabled?: boolean;
}

const STATE_BADGE_CONFIG: Record<
  WatchcatState,
  { label: string; variant: "outline"; className: string; icon: React.ReactNode }
> = {
  monitor: {
    label: "Monitoring",
    variant: "outline",
    className: "bg-success/15 text-success hover:bg-success/20 border-success/30",
    icon: <CheckCircle2Icon className="h-3 w-3" />,
  },
  suspect: {
    label: "Detecting Issue",
    variant: "outline",
    className: "bg-warning/15 text-warning hover:bg-warning/20 border-warning/30",
    icon: <TriangleAlertIcon className="h-3 w-3" />,
  },
  recovery: {
    label: "Recovering",
    variant: "outline",
    className: "bg-destructive/15 text-destructive hover:bg-destructive/20 border-destructive/30 animate-pulse motion-reduce:animate-none",
    icon: <AlertCircleIcon className="h-3 w-3" />,
  },
  cooldown: {
    label: "Cooldown",
    variant: "outline",
    className: "bg-info/15 text-info hover:bg-info/20 border-info/30",
    icon: <ClockIcon className="h-3 w-3" />,
  },
  locked: {
    label: "Locked",
    variant: "outline",
    className: "bg-muted/50 text-muted-foreground border-muted-foreground/30",
    icon: <LockIcon className="h-3 w-3" />,
  },
  disabled: {
    label: "Disabled",
    variant: "outline",
    className: "bg-muted/50 text-muted-foreground border-muted-foreground/30",
    icon: <MinusCircleIcon className="h-3 w-3" />,
  },
};

const TIER_LABELS: Record<number, string> = {
  0: "\u2014",
  1: "重启网络接口",
  2: "重启调制解调器无线",
  3: "切换到备用 SIM",
  4: "重启设备",
};

export function WatchdogStatusCard({
  revertSim,
  settingsEnabled,
}: WatchdogStatusCardProps) {
  const { data: modemStatus, isLoading } = useModemStatus({
    pollInterval: 5000,
  });
  const [isReverting, setIsReverting] = useState(false);

  const handleRevertSim = useCallback(async () => {
    setIsReverting(true);
    try {
      const success = await revertSim();
      if (success) {
        toast.success(
          "已请求恢复原始 SIM，看门狗将很快处理。",
        );
      } else {
        toast.error("请求恢复原始 SIM 失败");
      }
    } finally {
      setIsReverting(false);
    }
  }, [revertSim]);

  const watchcat = modemStatus?.watchcat;
  const simFailover = modemStatus?.sim_failover;

  // Loading skeleton
  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>看门狗状态</CardTitle>
          <CardDescription>实时连接健康状态。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-6 w-28" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty/disabled state
  const daemonReporting = watchcat?.enabled;
  const enabledButNotReporting = settingsEnabled && !daemonReporting;

  if (!daemonReporting && !enabledButNotReporting) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>看门狗状态</CardTitle>
          <CardDescription>实时连接健康状态。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <DogIcon className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              看门狗当前未启用。请先在设置中启用后再开始监控连接健康。
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Enabled in settings but daemon hasn't reported yet (starting up / boot settle)
  if (enabledButNotReporting) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>看门狗状态</CardTitle>
          <CardDescription>实时连接健康状态。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="size-10 text-muted-foreground animate-spin" />
            <p className="text-sm text-muted-foreground text-center">
              看门狗正在启动，即将开始监控。
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // At this point watchcat is guaranteed to be defined and enabled
  // (both early returns above handle the undefined/disabled cases)
  if (!watchcat) return null;

  const stateKey = (watchcat.state as WatchcatState) || "disabled";
  const badge = STATE_BADGE_CONFIG[stateKey] || STATE_BADGE_CONFIG.disabled;
  const tierLabel = TIER_LABELS[watchcat.current_tier] || TIER_LABELS[0];

  const statusRows: { label: string; value: React.ReactNode }[] = [
    { label: "Current Step", value: tierLabel },
    {
      label: "Failed Checks",
      value: <span className="font-mono">{watchcat.failure_count}</span>,
    },
    ...(watchcat.cooldown_remaining > 0
      ? [
          {
            label: "Cooldown",
            value: (
              <span className="font-mono">
                {watchcat.cooldown_remaining}s remaining
              </span>
            ),
          },
        ]
      : []),
    {
      label: "Total Recoveries",
      value: <span className="font-mono">{watchcat.total_recoveries}</span>,
    },
    {
      label: "Reboots This Hour",
      value: <span className="font-mono">{watchcat.reboots_this_hour}</span>,
    },
    ...(watchcat.last_recovery_time != null
      ? [
          {
            label: "Last Recovery",
            value: (
              <span>
                {TIER_LABELS[watchcat.last_recovery_tier ?? 0]}{" "}
                <span className="text-muted-foreground">
                  ({formatTimeAgo(watchcat.last_recovery_time)})
                </span>
              </span>
            ),
          },
        ]
      : []),
  ];

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>看门狗状态</CardTitle>
        <CardDescription>实时连接健康状态。</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2">
          {/* State badge — animates when state changes */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground">状态</p>
            <AnimatePresence mode="wait">
              <motion.div
                key={stateKey}
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.88 }}
                transition={{ duration: 0.18, type: "spring", stiffness: 400, damping: 24 }}
              >
                <Badge variant={badge.variant} className={badge.className}>{badge.icon}{badge.label}</Badge>
              </motion.div>
            </AnimatePresence>
          </div>
          {/* Status rows — stagger in on mount */}
          <motion.div
            className="grid gap-2"
            initial="hidden"
            animate="visible"
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } } }}
          >
            {statusRows.map((row) => (
              <motion.div
                key={row.label}
                variants={{ hidden: { opacity: 0, x: -6 }, visible: { opacity: 1, x: 0 } }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <Separator />
                <div className="flex items-center justify-between pt-2">
                  <p className="text-sm font-semibold text-muted-foreground">
                    {row.label}
                  </p>
                  <p className="text-sm font-semibold">{row.value}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
          <Separator />

          {/* SIM Failover section */}
          {simFailover?.active && (
            <div className="pt-3 border-t">
              <Alert className="mb-3">
                <InfoIcon className="size-4" />
                <AlertDescription>
                  当前正在使用备用 SIM（卡槽 {simFailover.current_slot}），开始于{" "}
                  {simFailover.switched_at
                    ? formatTimeAgo(simFailover.switched_at)
                    : "刚刚"}
                  。原始 SIM 位于卡槽 {simFailover.original_slot}.
                </AlertDescription>
              </Alert>

              {/* H1: Confirmation dialog for destructive SIM revert */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={isReverting}
                  >
                      {isReverting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        恢复中…
                      </>
                    ) : (
                      "恢复到原始 SIM"
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>恢复到原始 SIM？</AlertDialogTitle>
                    <AlertDialogDescription>
                      这将切换回 SIM 卡槽{" "}
                      {simFailover.original_slot}. 调制解调器重新连接期间，网络会短暂中断。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRevertSim}>
                      恢复 SIM
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
