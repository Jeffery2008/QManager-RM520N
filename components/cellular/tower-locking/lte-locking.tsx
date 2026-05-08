"use client";

import React, { useState, useMemo } from "react";
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
import { TbInfoCircleFilled } from "react-icons/tb";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";

import type {
  TowerLockConfig,
  TowerModemState,
  LteLockCell,
} from "@/types/tower-locking";
import type { ModemStatus } from "@/types/modem-status";
import {
  lteCarriersFromQcainfo,
  compositeValue,
  parseCompositeValue,
  type CarrierOption,
} from "./simple-mode-utils";
import { CarrierLabel } from "./carrier-label";

interface LTELockingProps {
  config: TowerLockConfig | null;
  modemState: TowerModemState | null;
  modemData: ModemStatus | null;
  isLoading: boolean;
  isLocking: boolean;
  isWatcherRunning: boolean;
  onLock: (cells: LteLockCell[]) => Promise<boolean>;
  onUnlock: () => Promise<boolean>;
}

const STORAGE_KEY_LTE_SIMPLE_MODE = "qmanager_tower_lte_simple_mode";

const LTELockingComponent = ({
  config,
  modemState,
  modemData,
  isLoading,
  isLocking,
  isWatcherRunning,
  onLock,
  onUnlock,
}: LTELockingProps) => {
  // Local form state for the 3 input pairs
  const [earfcn1, setEarfcn1] = useState("");
  const [pci1, setPci1] = useState("");
  const [earfcn2, setEarfcn2] = useState("");
  const [pci2, setPci2] = useState("");
  const [earfcn3, setEarfcn3] = useState("");
  const [pci3, setPci3] = useState("");
  const [prevCells, setPrevCells] = useState(config?.lte?.cells);

  // Simple Mode state + localStorage persistence (lazy init avoids SSR mismatch)
  const [simpleMode, setSimpleMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY_LTE_SIMPLE_MODE) === "true";
  });

  const handleSimpleModeToggle = (on: boolean) => {
    setSimpleMode(on);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY_LTE_SIMPLE_MODE, String(on));
    }
  };

  // Derive available carrier options from live modem data
  const carrierOptions = useMemo<CarrierOption[]>(
    () => (modemData ? lteCarriersFromQcainfo(modemData) : []),
    [modemData],
  );
  const hasOptions = carrierOptions.length > 0;

  const slotComposites = useMemo(
    () =>
      [
        [earfcn1, pci1],
        [earfcn2, pci2],
        [earfcn3, pci3],
      ].map(([e, p]) => {
        const eNum = parseInt(e!, 10);
        const pNum = parseInt(p!, 10);
        if (Number.isNaN(eNum) || Number.isNaN(pNum)) return "";
        return compositeValue(eNum, pNum);
      }),
    [earfcn1, pci1, earfcn2, pci2, earfcn3, pci3],
  );

  const handleSlotPick = (slotIndex: 0 | 1 | 2, value: string) => {
    const parsed = parseCompositeValue(value);
    if (!parsed) return;
    const setEarfcn = [setEarfcn1, setEarfcn2, setEarfcn3][slotIndex]!;
    const setPci = [setPci1, setPci2, setPci3][slotIndex]!;
    setEarfcn(String(parsed.earfcn));
    setPci(String(parsed.pci));
  };

  // Confirmation dialog state
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [pendingCells, setPendingCells] = useState<LteLockCell[]>([]);

  // Sync form from config when data loads (render-time update avoids effect cascade)
  if (config?.lte?.cells !== prevCells) {
    setPrevCells(config?.lte?.cells);
    const cells = config?.lte?.cells ?? [];
    setEarfcn1(cells[0] ? String(cells[0].earfcn) : "");
    setPci1(cells[0] ? String(cells[0].pci) : "");
    setEarfcn2(cells[1] ? String(cells[1].earfcn) : "");
    setPci2(cells[1] ? String(cells[1].pci) : "");
    setEarfcn3(cells[2] ? String(cells[2].earfcn) : "");
    setPci3(cells[2] ? String(cells[2].pci) : "");
  }

  // Derive enabled state from modem state (actual lock) or config
  const isEnabled = modemState?.lte_locked ?? config?.lte?.enabled ?? false;

  // Build cells array from form inputs
  const buildCells = (): LteLockCell[] => {
    const cells: LteLockCell[] = [];
    const e1 = parseInt(earfcn1, 10);
    const p1 = parseInt(pci1, 10);
    if (!Number.isNaN(e1) && !Number.isNaN(p1)) cells.push({ earfcn: e1, pci: p1 });

    const e2 = parseInt(earfcn2, 10);
    const p2 = parseInt(pci2, 10);
    if (!Number.isNaN(e2) && !Number.isNaN(p2)) cells.push({ earfcn: e2, pci: p2 });

    const e3 = parseInt(earfcn3, 10);
    const p3 = parseInt(pci3, 10);
    if (!Number.isNaN(e3) && !Number.isNaN(p3)) cells.push({ earfcn: e3, pci: p3 });

    return cells;
  };

  const handleToggle = (checked: boolean) => {
    if (checked && isWatcherRunning) {
      toast.warning("故障切换检查进行中", {
        description: "当前正在执行信号质量检查，请稍后再试。",
      });
      return;
    }
    if (checked) {
      const cells = buildCells();
      if (cells.length === 0) {
        toast.warning("未填写小区目标", {
          description: "请先输入信道和小区 ID。",
        });
        return;
      }
      // Show confirmation dialog
      setPendingCells(cells);
      setShowLockDialog(true);
    } else {
      setShowUnlockDialog(true);
    }
  };

  const confirmLock = async () => {
    setShowLockDialog(false);
    const success = await onLock(pendingCells);
    if (success) {
      toast.success("LTE 基站锁定已应用");
    } else {
      toast.error("基站锁定失败，请检查调制解调器连接");
    }
  };

  const confirmUnlock = async () => {
    setShowUnlockDialog(false);
    const success = await onUnlock();
    if (success) {
      toast.success("LTE 基站锁定已解除");
    } else {
      toast.error("移除基站锁定失败");
    }
  };

  const renderSlotSelect = (slotIndex: 0 | 1 | 2, idPrefix: string) => {
    const currentValue = slotComposites[slotIndex] ?? "";
    const currentEarfcn = [earfcn1, earfcn2, earfcn3][slotIndex] ?? "";
    const currentPci = [pci1, pci2, pci3][slotIndex] ?? "";
    const inListOption = carrierOptions.find(
      (o) => compositeValue(o.earfcn, o.pci) === currentValue,
    );

    return (
      <Select
        value={inListOption ? currentValue : ""}
        onValueChange={(v) => handleSlotPick(slotIndex, v)}
        disabled={isLocking}
      >
        <SelectTrigger id={idPrefix} className="w-full">
          {inListOption ? (
            <SelectValue />
          ) : currentEarfcn && currentPci ? (
            <span
              className="min-w-0 italic text-muted-foreground line-clamp-1"
              title={`自定义：EARFCN ${currentEarfcn}，PCI ${currentPci}`}
            >
              {`自定义：EARFCN ${currentEarfcn}，PCI ${currentPci}`}
            </span>
          ) : (
            <SelectValue placeholder="选择 LTE 载波" />
          )}
        </SelectTrigger>
        <SelectContent>
          {carrierOptions.map((opt) => {
            const value = compositeValue(opt.earfcn, opt.pci);
            const usedInIndex = slotComposites.findIndex(
              (sc, idx) => sc === value && idx !== slotIndex,
            );
            const disabled = usedInIndex !== -1;
            return (
              <SelectItem key={value} value={value} disabled={disabled}>
                <span className="flex items-center gap-2">
                  <CarrierLabel opt={opt} />
                  {disabled && (
                    <span className="text-xs text-muted-foreground">
                      （已用于槽位 {usedInIndex + 1}）
                    </span>
                  )}
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    );
  };

  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>LTE 基站锁定</CardTitle>
          <CardDescription>
            通过输入信道和小区 ID 锁定到指定的 LTE 小区基站。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Skeleton className="size-4 rounded-full" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-5 w-20" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Skeleton className="size-5 rounded-full" />
                <Skeleton className="h-4 w-44" />
              </div>
              <Skeleton className="h-5 w-20" />
            </div>
            <Separator />
            <div className="grid gap-4 mt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-10" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-10" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>LTE 基站锁定</CardTitle>
          <CardDescription>
            通过输入信道和小区 ID 锁定到指定的 LTE 小区基站。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            <Separator />
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <TbInfoCircleFilled className="size-4 text-muted-foreground" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {hasOptions
                        ? "从当前可见的 LTE 载波中选择（QCAINFO 中的 PCC + SCC）。"
                        : "当前 QCAINFO 中没有可见的 LTE 载波。关闭简单模式可手动输入。"}
                    </TooltipContent>
                  </Tooltip>
                  <p className="font-medium text-muted-foreground text-sm">
                    简单模式
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="lte-simple-mode"
                    aria-label="切换 LTE 简单模式"
                    checked={simpleMode && hasOptions}
                    onCheckedChange={handleSimpleModeToggle}
                    disabled={!hasOptions || isLocking}
                  />
                  <Label htmlFor="lte-simple-mode">
                    {simpleMode && hasOptions ? "开" : "关"}
                  </Label>
                </div>
              </div>
              {!hasOptions && (
                <p className="text-xs text-muted-foreground">
                  当前 QCAINFO 中没有可见的 LTE 载波。
                </p>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <TbInfoCircleFilled className="size-5 text-info" />
                <p className="font-semibold text-muted-foreground text-sm">
                  启用 LTE 基站锁定
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {isLocking ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : null}
                <Switch
                  id="lte-tower-locking"
                  checked={isEnabled}
                  onCheckedChange={handleToggle}
                  disabled={isLocking}
                />
                <Label htmlFor="lte-tower-locking">
                  {isEnabled ? "已启用" : "已禁用"}
                </Label>
              </div>
            </div>
            <Separator />
            <div className="grid gap-4 mt-6">
              <div className="w-full">
                <FieldSet>
                  <FieldGroup>
                    <div className="grid grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel htmlFor="earfcn1">信道（EARFCN）</FieldLabel>
                        {simpleMode && hasOptions ? (
                          renderSlotSelect(0, "earfcn1")
                        ) : (
                          <Input
                            id="earfcn1"
                            type="text"
                            placeholder="输入 EARFCN"
                            value={earfcn1}
                            onChange={(e) => setEarfcn1(e.target.value)}
                            disabled={isLocking}
                          />
                        )}
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="pci1">小区 ID（PCI）</FieldLabel>
                        <Input
                          id="pci1"
                          type="text"
                          placeholder="输入 PCI"
                          value={pci1}
                          onChange={(e) => setPci1(e.target.value)}
                          disabled={isLocking}
                        />
                      </Field>
                    </div>
                    {/* Optional locking entry 2 */}
                    <div className="grid grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel htmlFor="earfcn2">信道（EARFCN）2</FieldLabel>
                        {simpleMode && hasOptions ? (
                          renderSlotSelect(1, "earfcn2")
                        ) : (
                          <Input
                            id="earfcn2"
                            type="text"
                            placeholder="输入 EARFCN 2"
                            value={earfcn2}
                            onChange={(e) => setEarfcn2(e.target.value)}
                            disabled={isLocking}
                          />
                        )}
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="pci2">小区 ID（PCI）2</FieldLabel>
                        <Input
                          id="pci2"
                          type="text"
                          placeholder="输入 PCI 2"
                          value={pci2}
                          onChange={(e) => setPci2(e.target.value)}
                          disabled={isLocking}
                        />
                      </Field>
                    </div>
                    {/* Optional locking entry 3 */}
                    <div className="grid grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel htmlFor="earfcn3">信道（EARFCN）3</FieldLabel>
                        {simpleMode && hasOptions ? (
                          renderSlotSelect(2, "earfcn3")
                        ) : (
                          <Input
                            id="earfcn3"
                            type="text"
                            placeholder="输入 EARFCN 3"
                            value={earfcn3}
                            onChange={(e) => setEarfcn3(e.target.value)}
                            disabled={isLocking}
                          />
                        )}
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="pci3">小区 ID（PCI）3</FieldLabel>
                        <Input
                          id="pci3"
                          type="text"
                          placeholder="输入 PCI 3"
                          value={pci3}
                          onChange={(e) => setPci3(e.target.value)}
                          disabled={isLocking}
                        />
                      </Field>
                    </div>
                  </FieldGroup>
                </FieldSet>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lock confirmation dialog */}
      <AlertDialog open={showLockDialog} onOpenChange={setShowLockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>锁定到 LTE 基站？</AlertDialogTitle>
            <AlertDialogDescription>
              这会将调制解调器锁定到{" "}
              {pendingCells.length === 1
                ? `EARFCN ${pendingCells[0]?.earfcn}, PCI ${pendingCells[0]?.pci}`
                : `${pendingCells.length} 个小区目标`}
              。调制解调器只会连接到
              {pendingCells.length === 1 ? "这个基站" : "这些基站"}，切换过程中可能会短暂断线。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLock}>
              锁定基站
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unlock confirmation dialog */}
      <AlertDialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>解除 LTE 基站锁定？</AlertDialogTitle>
            <AlertDialogDescription>
              这会移除 LTE 基站锁定。调制解调器将可自由选择任何可用基站，切换过程中可能会短暂断线。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnlock}>
              移除锁定
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default LTELockingComponent;
