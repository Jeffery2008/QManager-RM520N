"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

import type {
  FreqLockModemState,
  NrFreqLockEntry,
} from "@/types/frequency-locking";
import type { ModemStatus } from "@/types/modem-status";
import {
  findAllMatchingNRBands,
  suggestNRSCS,
  type NRBandEntry,
} from "@/lib/earfcn";
import { SCS_OPTIONS } from "@/types/tower-locking";
import { BandMatchDisplay } from "./band-match-display";

// =============================================================================
// Slot state — one entry per NR-ARFCN + SCS pair
// =============================================================================

interface SlotState {
  arfcn: string;
  scs: string;
  scsManual: boolean;
}

const EMPTY_SLOT: SlotState = { arfcn: "", scs: "", scsManual: false };
const NUM_SLOTS = 4;
const INITIAL_SLOTS: SlotState[] = Array.from({ length: NUM_SLOTS }, () => ({
  ...EMPTY_SLOT,
}));

// =============================================================================
// NrFreqLockingComponent
// =============================================================================

interface NrFreqLockingProps {
  modemState: FreqLockModemState | null;
  modemData: ModemStatus | null;
  isLoading: boolean;
  isLocking: boolean;
  error: string | null;
  towerLockActive: boolean;
  onLock: (entries: NrFreqLockEntry[]) => Promise<boolean>;
  onUnlock: () => Promise<boolean>;
  onRefresh: () => void;
}

const NrFreqLockingComponent = ({
  modemState,
  modemData,
  isLoading,
  isLocking,
  error,
  towerLockActive,
  onLock,
  onUnlock,
  onRefresh,
}: NrFreqLockingProps) => {
  // --- Array-based slot state ------------------------------------------------
  const [slots, setSlots] = useState<SlotState[]>(INITIAL_SLOTS);

  // Confirmation dialog state
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [showUnsupportedWarning, setShowUnsupportedWarning] = useState(false);
  const [pendingEntries, setPendingEntries] = useState<NrFreqLockEntry[]>([]);

  // Sync form from modem state when data loads
  useEffect(() => {
    if (modemState?.nr_entries && modemState.nr_entries.length > 0) {
      setSlots((prev) =>
        prev.map((s, i) => {
          const entry = modemState.nr_entries[i];
          if (!entry) return s;
          return {
            arfcn: String(entry.arfcn),
            scs: String(entry.scs),
            scsManual: true,
          };
        }),
      );
    }
  }, [modemState?.nr_entries]);

  // --- Slot update helpers ---------------------------------------------------
  const updateSlotArfcn = useCallback((index: number, arfcn: string) => {
    setSlots((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        const updated: SlotState = { ...s, arfcn, scsManual: false };
        // Auto-detect SCS from band match
        const val = parseInt(arfcn, 10);
        if (!isNaN(val)) {
          const bands = findAllMatchingNRBands(val);
          if (bands.length > 0) {
            updated.scs = String(suggestNRSCS(bands[0]));
          }
        }
        return updated;
      }),
    );
  }, []);

  const updateSlotScs = useCallback((index: number, scs: string) => {
    setSlots((prev) =>
      prev.map((s, i) =>
        i === index ? { ...s, scs, scsManual: true } : s,
      ),
    );
  }, []);

  // --- Derived state ---------------------------------------------------------
  const isEnabled = modemState?.nr_locked ?? false;
  const isDisabled = towerLockActive || isLocking;

  // Band matching per slot (recomputes when any arfcn changes)
  const matchedBandsPerSlot = useMemo(
    (): NRBandEntry[][] =>
      slots.map((s) => {
        const val = parseInt(s.arfcn, 10);
        return isNaN(val) ? [] : findAllMatchingNRBands(val);
      }),
    [slots],
  );

  // Parse supported NR bands from modem data (combine SA + NSA)
  const supportedBands = useMemo((): number[] => {
    const sa = modemData?.device?.supported_sa_nr5g_bands ?? "";
    const nsa = modemData?.device?.supported_nsa_nr5g_bands ?? "";
    const combined = `${sa}:${nsa}`;
    const bands = combined
      .split(":")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
    return [...new Set(bands)];
  }, [
    modemData?.device?.supported_sa_nr5g_bands,
    modemData?.device?.supported_nsa_nr5g_bands,
  ]);

  // Build entries array from slot state
  const buildEntries = (): NrFreqLockEntry[] => {
    const entries: NrFreqLockEntry[] = [];
    for (const slot of slots) {
      const a = parseInt(slot.arfcn, 10);
      const s = parseInt(slot.scs, 10);
      if (!isNaN(a) && !isNaN(s)) {
        entries.push({ arfcn: a, scs: s });
      }
    }
    return entries;
  };

  // --- Handlers --------------------------------------------------------------
  const handleToggle = (checked: boolean) => {
    if (checked) {
      const entries = buildEntries();
      if (entries.length === 0) {
        toast.warning("No frequencies entered", {
          description: "启用前请至少输入一个 NR-ARFCN 和对应的 SCS。",
        });
        return;
      }

      // Validate SCS is set for all slots with an ARFCN
      for (const slot of slots) {
        const a = parseInt(slot.arfcn, 10);
        if (!isNaN(a) && (slot.scs === "" || isNaN(parseInt(slot.scs, 10)))) {
          toast.warning("Missing SCS", {
            description: "每个 NR-ARFCN 都必须设置一个 SCS 值，请先选择子载波间隔。",
          });
          return;
        }
      }

      // Check band support
      const allMatched = matchedBandsPerSlot.flat();
      const anySupported =
        allMatched.length === 0 ||
        allMatched.some((b) => supportedBands.includes(b.band));

      setPendingEntries(entries);

      if (!anySupported && supportedBands.length > 0) {
        setShowUnsupportedWarning(true);
      } else {
        setShowLockDialog(true);
      }
    } else {
      setShowUnlockDialog(true);
    }
  };

  const confirmLock = async () => {
    setShowLockDialog(false);
    setShowUnsupportedWarning(false);
    const success = await onLock(pendingEntries);
    if (success) {
      toast.success("NR5G frequency lock applied");
    } else {
      toast.error("应用 NR5G 频点锁定失败");
    }
  };

  const confirmUnlock = async () => {
    setShowUnlockDialog(false);
    const success = await onUnlock();
    if (success) {
      toast.success("NR5G frequency lock cleared");
    } else {
      toast.error("清除 NR5G 频点锁定失败");
    }
  };

  // "Use Current" — copy active NR PCell into slot 1
  const handleUseCurrent = () => {
    const nrArfcn = modemData?.nr?.arfcn;
    const nrScs = modemData?.nr?.scs;
    if (nrArfcn != null) {
      if (nrScs != null) {
        // Use modem's actual SCS — bypass auto-detection
        setSlots((prev) =>
          prev.map((s, i) =>
            i === 0
              ? { arfcn: String(nrArfcn), scs: String(nrScs), scsManual: true }
              : s,
          ),
        );
      } else {
        updateSlotArfcn(0, String(nrArfcn));
      }
      toast.info("已填入当前活动的 NR 主小区参数");
    } else {
      toast.warning("当前没有活动的 NR 小区");
    }
  };

  const hasActiveNrCell = modemData?.nr?.arfcn != null;

  // --- Loading state ---------------------------------------------------------
  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>NR5G 频点锁定</CardTitle>
          <CardDescription>
            锁定到指定的 NR 频点（NR-ARFCN）。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            <Separator />
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Separator />
            <div className="grid gap-4 mt-6">
              {Array.from({ length: NUM_SLOTS }).map((_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 @sm/card:grid-cols-2 gap-4"
                >
                  <Skeleton className="h-9 w-full rounded-md" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
              ))}
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
          <CardTitle>NR5G 频点锁定</CardTitle>
          <CardDescription>
            锁定到指定的 NR 频点（NR-ARFCN）。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            role="alert"
            className="flex flex-col items-center gap-3 py-8 text-center"
          >
            <AlertCircleIcon className="size-8 text-destructive" />
            <div className="space-y-1">
              <p className="text-sm font-medium">
                加载频点锁定状态失败
              </p>
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
          <CardTitle>NR5G 频点锁定</CardTitle>
          <CardDescription>
            锁定到指定的 NR 频点，最多支持 32 条条目（当前展示 4 条）。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {/* Tower lock active warning */}
            {towerLockActive ? (
              <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                <TbAlertTriangleFilled className="size-5 mt-0.5 shrink-0" />
                <p className="font-semibold">
                  NR 基站锁定当前已启用。请先关闭它，再使用频点锁定。
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
                    <button
                      type="button"
                      className="inline-flex"
                      aria-label="更多信息"
                    >
                      <TbInfoCircleFilled className="size-5 text-info" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      不能与 NR 基站锁定（AT+QNWLOCK）同时使用。
                      <br />
                      SCS 会根据频段类型自动推断，但你也可以手动覆盖。
                    </p>
                  </TooltipContent>
                </Tooltip>

                <p className="font-semibold text-muted-foreground text-sm">
                  启用 NR5G 频点锁定
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {isLocking ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : null}
                <Switch
                  id="nr-freq-locking"
                  checked={isEnabled}
                  onCheckedChange={handleToggle}
                  disabled={isDisabled}
                />
                <Label htmlFor="nr-freq-locking">
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
                    {slots.map((slot, i) => (
                      <NrFreqSlot
                        key={i}
                        index={i}
                        slot={slot}
                        matchedBands={matchedBandsPerSlot[i]}
                        supportedBands={supportedBands}
                        disabled={isDisabled}
                        onArfcnChange={updateSlotArfcn}
                        onScsChange={updateSlotScs}
                        onUseCurrent={
                          i === 0 ? handleUseCurrent : undefined
                        }
                        hasActiveCell={i === 0 ? hasActiveNrCell : false}
                      />
                    ))}
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
            <AlertDialogTitle>锁定 NR5G 频点？</AlertDialogTitle>
            <AlertDialogDescription>
              这会将调制解调器锁定到{" "}
              {pendingEntries.length === 1
                ? `NR-ARFCN ${pendingEntries[0].arfcn} (SCS ${pendingEntries[0].scs} kHz)`
                : `${pendingEntries.length} NR frequencies`}
              。之后调制解调器只会使用{" "}
              {pendingEntries.length === 1
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
              不受支持的频段警告
            </AlertDialogTitle>
            <AlertDialogDescription>
              你输入的 NR-ARFCN 对应到了当前设备不支持的频段。锁定到不受支持的频点可能导致异常行为。
              <br />
              <br />
              <strong>匹配到的频段：</strong>{" "}
              {matchedBandsPerSlot
                .flat()
                .map((b) => `n${b.band}`)
                .join(", ") || "未知"}
              <br />
              <strong>设备支持的频段：</strong>{" "}
              {supportedBands.map((b) => `n${b}`).join(", ")}
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
            <AlertDialogTitle>解除 NR5G 频点锁定？</AlertDialogTitle>
            <AlertDialogDescription>
              这将移除 NR5G 频点锁定。之后调制解调器可以自由使用任意可用的 NR 频点，并可能短暂断线。
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

// =============================================================================
// NrFreqSlot — Single NR-ARFCN + SCS form row
// =============================================================================

interface NrFreqSlotProps {
  index: number;
  slot: SlotState;
  matchedBands: NRBandEntry[];
  supportedBands: number[];
  disabled: boolean;
  onArfcnChange: (index: number, arfcn: string) => void;
  onScsChange: (index: number, scs: string) => void;
  onUseCurrent?: () => void;
  hasActiveCell: boolean;
}

function NrFreqSlot({
  index,
  slot,
  matchedBands,
  supportedBands,
  disabled,
  onArfcnChange,
  onScsChange,
  onUseCurrent,
  hasActiveCell,
}: NrFreqSlotProps) {
  const slotNum = index + 1;
  const arfcnId = `nr-freq-arfcn${slotNum}`;
  const scsId = `nr-freq-scs${slotNum}`;
  const arfcnLabel = index === 0 ? "NR-ARFCN" : `NR-ARFCN ${slotNum}`;
  const scsLabel = index === 0 ? "SCS" : `SCS ${slotNum}`;

  return (
    <div className="grid grid-cols-1 @sm/card:grid-cols-2 gap-4">
      <Field>
        <div className="flex items-center justify-between">
          <FieldLabel htmlFor={arfcnId}>{arfcnLabel}</FieldLabel>
          {onUseCurrent && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onUseCurrent}
              disabled={disabled || !hasActiveCell}
            >
                            使用当前值
            </Button>
          )}
        </div>
        <Input
          id={arfcnId}
          type="text"
          placeholder={`Enter ${arfcnLabel}`}
          value={slot.arfcn}
          onChange={(e) => onArfcnChange(index, e.target.value)}
          disabled={disabled}
        />
        <BandMatchDisplay
          bands={matchedBands}
          hasInput={slot.arfcn.length > 0}
          supportedBands={supportedBands}
          prefix="n"
          noMatchLabel="this NR-ARFCN"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={scsId}>{scsLabel}</FieldLabel>
        <Select
          value={slot.scs}
          onValueChange={(v) => onScsChange(index, v)}
          disabled={disabled}
        >
          <SelectTrigger id={scsId} aria-label={`${scsLabel} slot ${slotNum}`}>
            <SelectValue placeholder="SCS" />
          </SelectTrigger>
          <SelectContent>
            {SCS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

export default NrFreqLockingComponent;
