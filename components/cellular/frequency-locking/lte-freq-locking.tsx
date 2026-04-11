"use client";

import { useState, useEffect, useMemo } from "react";
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
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircleIcon, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TbInfoCircleFilled, TbAlertTriangleFilled } from "react-icons/tb";

import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";

import type { FreqLockModemState } from "@/types/frequency-locking";
import type { ModemStatus } from "@/types/modem-status";
import { findAllMatchingLTEBands, type LTEBandEntry } from "@/lib/earfcn";
import { BandMatchDisplay } from "./band-match-display";

interface LteFreqLockingProps {
  modemState: FreqLockModemState | null;
  modemData: ModemStatus | null;
  isLoading: boolean;
  isLocking: boolean;
  error: string | null;
  towerLockActive: boolean;
  onLock: (earfcns: number[]) => Promise<boolean>;
  onUnlock: () => Promise<boolean>;
  onRefresh: () => void;
}

const LteFreqLockingComponent = ({
  modemState,
  modemData,
  isLoading,
  isLocking,
  error,
  towerLockActive,
  onLock,
  onUnlock,
  onRefresh,
}: LteFreqLockingProps) => {
  // Local form state for the 2 EARFCN inputs
  const [earfcn1, setEarfcn1] = useState("");
  const [earfcn2, setEarfcn2] = useState("");

  // Confirmation dialog state
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [showUnsupportedWarning, setShowUnsupportedWarning] = useState(false);
  const [pendingEarfcns, setPendingEarfcns] = useState<number[]>([]);

  // Sync form from modem state when data loads
  useEffect(() => {
    if (modemState?.lte_entries && modemState.lte_entries.length > 0) {
      setEarfcn1(String(modemState.lte_entries[0].earfcn));
      if (modemState.lte_entries[1]) {
        setEarfcn2(String(modemState.lte_entries[1].earfcn));
      }
    }
  }, [modemState?.lte_entries]);

  // Derive enabled state from modem state
  const isEnabled = modemState?.lte_locked ?? false;
  const isDisabled = towerLockActive || isLocking;

  // Band matching for display
  const matchedBands1 = useMemo((): LTEBandEntry[] => {
    const val = parseInt(earfcn1, 10);
    return isNaN(val) ? [] : findAllMatchingLTEBands(val);
  }, [earfcn1]);

  const matchedBands2 = useMemo((): LTEBandEntry[] => {
    const val = parseInt(earfcn2, 10);
    return isNaN(val) ? [] : findAllMatchingLTEBands(val);
  }, [earfcn2]);

  // Parse supported bands from modem data
  const supportedBands = useMemo((): number[] => {
    const raw = modemData?.device?.supported_lte_bands;
    if (!raw) return [];
    return raw
      .split(":")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
  }, [modemData?.device?.supported_lte_bands]);

  // Build earfcns array from form inputs
  const buildEarfcns = (): number[] => {
    const earfcns: number[] = [];
    const e1 = parseInt(earfcn1, 10);
    if (!isNaN(e1)) earfcns.push(e1);
    const e2 = parseInt(earfcn2, 10);
    if (!isNaN(e2)) earfcns.push(e2);
    return earfcns;
  };

  const handleToggle = (checked: boolean) => {
    if (checked) {
      const earfcns = buildEarfcns();
      if (earfcns.length === 0) {
        toast.warning("No frequencies entered", {
          description: "启用前请至少输入一个信道号。",
        });
        return;
      }

      // Check if any matched band is in supported bands
      const allMatched = [...matchedBands1, ...matchedBands2];
      const anySupported =
        allMatched.length === 0 ||
        allMatched.some((b) => supportedBands.includes(b.band));

      setPendingEarfcns(earfcns);

      if (!anySupported && supportedBands.length > 0) {
        // No matched band is supported — show stern warning
        setShowUnsupportedWarning(true);
      } else {
        // Normal confirmation
        setShowLockDialog(true);
      }
    } else {
      setShowUnlockDialog(true);
    }
  };

  const confirmLock = async () => {
    setShowLockDialog(false);
    setShowUnsupportedWarning(false);
    const success = await onLock(pendingEarfcns);
    if (success) {
      toast.success("LTE frequency lock applied");
    } else {
      toast.error("应用 LTE 频点锁定失败");
    }
  };

  const confirmUnlock = async () => {
    setShowUnlockDialog(false);
    const success = await onUnlock();
    if (success) {
      toast.success("LTE frequency lock cleared");
    } else {
      toast.error("清除 LTE 频点锁定失败");
    }
  };

  // "Use Current" — copy active PCell EARFCN into slot 1
  const handleUseCurrent = () => {
    const earfcn = modemData?.lte?.earfcn;
    if (earfcn != null) {
      setEarfcn1(String(earfcn));
      toast.info("已填入当前连接基站的参数");
    } else {
      toast.warning("当前没有活动的 LTE 连接");
    }
  };

  const hasActiveLteCell = modemData?.lte?.earfcn != null;

  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>LTE 频点锁定</CardTitle>
          <CardDescription>
            锁定到指定的 LTE 信道频点。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            <Separator />
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Separator />
            <div className="grid gap-4 mt-6">
              <Skeleton className="h-9 w-full rounded-md" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Error state (fetch failed, no data) ----------------------------------
  if (error && !modemState) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>LTE 频点锁定</CardTitle>
          <CardDescription>
            锁定到指定的 LTE 信道频点。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            role="alert"
            className="flex flex-col items-center gap-3 py-8 text-center"
          >
            <AlertCircleIcon className="size-8 text-destructive" />
            <div className="space-y-1">
              <p className="text-sm font-medium">加载频点锁定状态失败</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={onRefresh}>
              重试
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card
        className="@container/card"
        aria-disabled={towerLockActive || undefined}
      >
        <CardHeader>
          <CardTitle>LTE 频点锁定</CardTitle>
          <CardDescription>
            锁定到指定的 LTE 信道频点，最多可设置 2 个信道。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {/* Tower lock active warning */}
            {towerLockActive ? (
              <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                <TbAlertTriangleFilled className="size-5 mt-0.5 shrink-0" />
                <p className="font-semibold">
                  LTE 基站锁定当前已启用。请先关闭它，再使用频点锁定。
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2 p-2 rounded-md bg-warning/10 border border-warning/30 text-warning text-sm">
                <TbAlertTriangleFilled className="size-5 mt-0.5 shrink-0" />
                <p className="font-semibold">实验性功能</p>
              </div>
            )}

            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="inline-flex" aria-label="更多信息">
                      <TbInfoCircleFilled className="size-5 text-info" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      锁定到不受支持的频点可能导致调制解调器异常重启。<br />
                      启用基站锁定时无法使用此功能。
                    </p>
                  </TooltipContent>
                </Tooltip>
                <p className="font-semibold text-muted-foreground text-sm">
                  启用 LTE 频点锁定
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {isLocking ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : null}
                <Switch
                  id="lte-freq-locking"
                  checked={isEnabled}
                  onCheckedChange={handleToggle}
                  disabled={isDisabled}
                />
                <Label htmlFor="lte-freq-locking">
                  {isEnabled ? "已启用" : "已禁用"}
                </Label>
              </div>
            </div>
            <Separator />

            <form
              className="grid gap-4 mt-6"
              onSubmit={(e) => e.preventDefault()}
            >
              <div className="w-full">
                <FieldSet>
                  <FieldGroup>
                    {/* EARFCN 1 */}
                    <Field>
                      <div className="flex items-center justify-between">
                        <FieldLabel htmlFor="freq-earfcn1">信道（EARFCN）</FieldLabel>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleUseCurrent}
                          disabled={isDisabled || !hasActiveLteCell}
                        >
                          使用当前值
                        </Button>
                      </div>
                      <Input
                        id="freq-earfcn1"
                        type="text"
                        placeholder="输入 EARFCN"
                                                value={earfcn1}
                        onChange={(e) => setEarfcn1(e.target.value)}
                        disabled={isDisabled}
                      />
                      <BandMatchDisplay
                        bands={matchedBands1}
                        hasInput={earfcn1.length > 0}
                        supportedBands={supportedBands}
                        prefix="B"
                        noMatchLabel="该信道"
                      />
                    </Field>

                    {/* EARFCN 2 */}
                    <Field>
                      <FieldLabel htmlFor="freq-earfcn2">
                        信道 2（可选）
                      </FieldLabel>
                      <Input
                        id="freq-earfcn2"
                        type="text"
                        placeholder="输入 EARFCN 2"
                                                value={earfcn2}
                        onChange={(e) => setEarfcn2(e.target.value)}
                        disabled={isDisabled}
                      />
                      <BandMatchDisplay
                        bands={matchedBands2}
                        hasInput={earfcn2.length > 0}
                        supportedBands={supportedBands}
                        prefix="B"
                        noMatchLabel="该信道"
                      />
                    </Field>
                  </FieldGroup>
                </FieldSet>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Normal lock confirmation dialog */}
      <AlertDialog open={showLockDialog} onOpenChange={setShowLockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>锁定 LTE 频点？</AlertDialogTitle>
            <AlertDialogDescription>
              这会将调制解调器锁定到{" "}
              {pendingEarfcns.length === 1
                ? `EARFCN ${pendingEarfcns[0]}`
                : `EARFCNs ${pendingEarfcns.join(", ")}`}
              。之后调制解调器只会使用{" "}
              {pendingEarfcns.length === 1
                ? "该频点"
                : "这些频点"}，
              并可能短暂断线。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLock}>
              锁定频点
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsupported band warning dialog */}
      <AlertDialog
        open={showUnsupportedWarning}
        onOpenChange={setShowUnsupportedWarning}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              不受支持的频点警告
            </AlertDialogTitle>
            <AlertDialogDescription>
              你输入的频点对应到当前设备不支持的频段。锁定到不受支持的频点可能导致调制解调器异常重启。
              <br />
              <br />
              <strong>匹配到的频段：</strong>{" "}
              {[...matchedBands1, ...matchedBands2]
                .map((b) => `B${b.band}`)
                .join(", ") || "未知"}
              <br />
              <strong>设备支持的频段：</strong>{" "}
              {supportedBands.map((b) => `B${b}`).join(", ")}
              <br />
              <br />
              确定仍要继续吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmLock}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              仍然锁定
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unlock confirmation dialog */}
      <AlertDialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>解除 LTE 频点锁定？</AlertDialogTitle>
            <AlertDialogDescription>
              这将移除 LTE 频点锁定。之后调制解调器可以自由使用任意可用频点，并可能短暂断线。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnlock}>
              解除锁定
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default LteFreqLockingComponent;
