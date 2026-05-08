"use client";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2Icon,
  PlayIcon,
  DownloadIcon,
  Trash2Icon,
  CheckCircle2Icon,
  XCircleIcon,
  TriangleAlertIcon,
  MinusCircleIcon,
} from "lucide-react";
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
import type { HealthCheckJob } from "@/types/system-health-check";

interface SummaryCardProps {
  job: HealthCheckJob | null;
  isRunning: boolean;
  isStarting: boolean;
  isClearing: boolean;
  onRun: () => void;
  onClear: () => void;
  onDownload: () => void;
}

function formatRelative(epochSec: number): string {
  const diff = Math.floor(Date.now() / 1000) - epochSec;
  if (diff < 5) return "刚刚";
  if (diff < 60) return `${diff} 秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return `${Math.floor(diff / 86400)} 天前`;
}

export default function SummaryCard({
  job,
  isRunning,
  isStarting,
  isClearing,
  onRun,
  onClear,
  onDownload,
}: SummaryCardProps) {
  const hasRun = !!job;
  const summary = job?.summary;
  const canDownload = !!job && job.status === "complete" && !!job.tarball_path;
  const canClear = hasRun && !isRunning && !isStarting;

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">系统健康检查</CardTitle>
        <CardDescription>
          对二进制文件、权限、AT 通信、服务和配置执行完整诊断。可下载已脱敏的诊断包并分享给支持人员。
        </CardDescription>
        <CardAction>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button onClick={onRun} disabled={isRunning || isStarting}>
              {isRunning || isStarting ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  运行中...
                </>
              ) : (
                <>
                  <PlayIcon className="size-4" />
                  运行诊断
                </>
              )}
            </Button>
            {canDownload && (
              <Button onClick={onDownload} variant="outline">
                <DownloadIcon className="size-4" />
                下载诊断包
              </Button>
            )}
            {canClear && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={isClearing}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    {isClearing ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : (
                      <Trash2Icon className="size-4" />
                    )}
                    {isClearing ? "正在清除..." : "清除"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>清除诊断结果？</AlertDialogTitle>
                    <AlertDialogDescription>
                      这会从设备上删除上一次运行结果、所有单项测试输出文件和可下载诊断包。页面会恢复为空状态。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onClear}
                      className={buttonVariants({ variant: "destructive" })}
                    >
                      清除结果
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2">
          {hasRun && summary ? (
            <>
              <Badge variant="outline" className="bg-success/15 text-success hover:bg-success/20 border-success/30">
                <CheckCircle2Icon className="size-3" />
                {summary.pass} 通过
              </Badge>
              <Badge variant="outline" className="bg-destructive/15 text-destructive hover:bg-destructive/20 border-destructive/30">
                <XCircleIcon className="size-3" />
                {summary.fail} 失败
              </Badge>
              <Badge variant="outline" className="bg-warning/15 text-warning hover:bg-warning/20 border-warning/30">
                <TriangleAlertIcon className="size-3" />
                {summary.warn} 警告
              </Badge>
              <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-muted-foreground/30">
                <MinusCircleIcon className="size-3" />
                {summary.skip} 跳过
              </Badge>
              {job?.started_at && (
                <span className="text-xs text-muted-foreground ml-2">
                  {isRunning ? "开始于 " : "上次运行于 "} {formatRelative(job.started_at)}
                </span>
              )}
            </>
          ) : (
            <span className="text-sm text-muted-foreground">尚未运行诊断。</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
