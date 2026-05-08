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
import { Loader2, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";

import type {
  TowerLockConfig,
  TowerModemState,
  NrSaLockCell,
} from "@/types/tower-locking";
import type { ModemStatus, NetworkType } from "@/types/modem-status";
import { SCS_OPTIONS } from "@/types/tower-locking";
import {
  nrCarriersFromQcainfo,
  defaultScsForBand,
  compositeValue,
  parseCompositeValue,
  type CarrierOption,
} from "./simple-mode-utils";
import { CarrierLabel } from "./carrier-label";

interface NRSALockingProps {
  config: TowerLockConfig | null;
  modemState: TowerModemState | null;
  modemData: ModemStatus | null;
  networkType: NetworkType | string;
  isLoading: boolean;
  isLocking: boolean;
  isWatcherRunning: boolean;
  onLock: (cell: NrSaLockCell) => Promise<boolean>;
  onUnlock: () => Promise<boolean>;
}

const STORAGE_KEY_NR_SIMPLE_MODE = "qmanager_tower_nr_simple_mode";

type ScsSource = "manual" | "band_default" | "servingcell";

const NRSALockingComponent = ({
  config,
  modemState,
  modemData,
  networkType,
  isLoading,
  isLocking,
  isWatcherRunning,
  onLock,
  onUnlock,
}: NRSALockingProps) => {
  // Local form state
  const [arfcn, setArfcn] = useState("");
  const [pci, setPci] = useState("");
  const [band, setBand] = useState("");
  const [scs, setScs] = useState("");
  const [prevNrSa, setPrevNrSa] = useState(config?.nr_sa);

  // Simple Mode state (persisted to localStorage)
  const [simpleMode, setSimpleMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY_NR_SIMPLE_MODE) === "true";
  });

  const [scsSource, setScsSource] = useState<ScsSource>("manual");

  const handleSimpleModeToggle = (on: boolean) => {
    setSimpleMode(on);
    setScsSource("manual");
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY_NR_SIMPLE_MODE, String(on));
    }
  };

  // Confirmation dialog state
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [pendingCell, setPendingCell] = useState<NrSaLockCell | null>(null);

  // Sync form from config when data loads (render-time update avoids effect cascade)
  if (config?.nr_sa !== prevNrSa) {
    setPrevNrSa(config?.nr_sa);
    if (config?.nr_sa) {
      if (config.nr_sa.arfcn !== null) setArfcn(String(config.nr_sa.arfcn));
      if (config.nr_sa.pci !== null) setPci(String(config.nr_sa.pci));
      if (config.nr_sa.band !== null) setBand(String(config.nr_sa.band));
      if (config.nr_sa.scs !== null) setScs(String(config.nr_sa.scs));
    }
  }

  // Derive carrier options for Simple Mode
  const carrierOptions = useMemo<CarrierOption[]>(
    () => (modemData ? nrCarriersFromQcainfo(modemData) : []),
    [modemData],
  );
  const hasOptions = carrierOptions.length > 0;

  const handleCarrierPick = (value: string) => {
    const parsed = parseCompositeValue(value);
    if (!parsed) return;
    const opt = carrierOptions.find(
      (o) => o.earfcn === parsed.earfcn && o.pci === parsed.pci,
    );
    if (!opt) return;

    setArfcn(String(opt.earfcn));
    setPci(String(opt.pci));
    if (opt.bandNumber != null) setBand(String(opt.bandNumber));

    // SCS resolution: trust live serving cell when picking the PCC.
    const liveScs = modemData?.nr?.scs ?? null;
    const liveArfcn = modemData?.nr?.arfcn ?? null;
    const livePci = modemData?.nr?.pci ?? null;
    const isLiveServingCell =
      liveArfcn === opt.earfcn && livePci === opt.pci && liveScs !== null;

    if (isLiveServingCell) {
      setScs(String(liveScs));
      setScsSource("servingcell");
    } else {
      const fallback = defaultScsForBand(opt.bandNumber);
      setScs(fallback !== null ? String(fallback) : "");
      setScsSource("band_default");
    }
  };

  const currentArfcnComposite = useMemo(() => {
    const aNum = parseInt(arfcn, 10);
    const pNum = parseInt(pci, 10);
    if (Number.isNaN(aNum) || Number.isNaN(pNum)) return "";
    return compositeValue(aNum, pNum);
  }, [arfcn, pci]);

  const arfcnInList = useMemo(
    () =>
      carrierOptions.find(
        (o) => compositeValue(o.earfcn, o.pci) === currentArfcnComposite,
      ),
    [carrierOptions, currentArfcnComposite],
  );

  // Derive enabled state from modem state or config
  const isEnabled = modemState?.nr_locked ?? config?.nr_sa?.enabled ?? false;

  // NSA mode gating — NR-SA locking not available in NSA or LTE-only mode
  const isNsaMode = networkType === "5G-NSA";
  const isLteOnly = networkType === "LTE";
  const isCardDisabled = isNsaMode || isLteOnly;
  const isDisabled = isCardDisabled || isLocking;

  const handleToggle = (checked: boolean) => {
    if (checked && isWatcherRunning) {
      toast.warning("故障切换检查进行中", {
        description: "当前正在执行信号质量检查，请稍后再试。",
      });
      return;
    }
    if (checked) {
      const parsedArfcn = parseInt(arfcn, 10);
      const parsedPci = parseInt(pci, 10);
      const parsedBand = parseInt(band, 10);
      const parsedScs = parseInt(scs, 10);

      if (
        Number.isNaN(parsedArfcn) ||
        Number.isNaN(parsedPci) ||
        Number.isNaN(parsedBand) ||
        Number.isNaN(parsedScs)
      ) {
        toast.warning("字段未填写完整", {
          description: "锁定前请先填写所有必要的基站参数。",
        });
        return;
      }

      const cell: NrSaLockCell = {
        arfcn: parsedArfcn,
        pci: parsedPci,
        band: parsedBand,
        scs: parsedScs,
      };
      setPendingCell(cell);
      setShowLockDialog(true);
    } else {
      setShowUnlockDialog(true);
    }
  };

  const confirmLock = async () => {
    setShowLockDialog(false);
    if (pendingCell) {
      const success = await onLock(pendingCell);
      if (success) {
        toast.success("NR-SA 基站锁定已应用");
      } else {
        toast.error("基站锁定失败，请检查调制解调器连接");
      }
    }
  };

  const confirmUnlock = async () => {
    setShowUnlockDialog(false);
    const success = await onUnlock();
    if (success) {
      toast.success("NR-SA 基站锁定已解除");
    } else {
      toast.error("移除基站锁定失败");
    }
  };

  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>NR-SA 基站锁定</CardTitle>
          <CardDescription>
            通过输入信道、小区 ID、频段和子载波间隔，锁定到指定的 5G SA 小区基站。
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
                <Skeleton className="h-4 w-48" />
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
                  <Skeleton className="h-4 w-10" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
              </div>
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
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={`@container/card ${isCardDisabled ? "opacity-60" : ""}`}>
        <CardHeader>
          <CardTitle>NR-SA 基站锁定</CardTitle>
          <CardDescription>
            通过输入信道、小区 ID、频段和子载波间隔，锁定到指定的 5G SA 小区基站。
            {isNsaMode && " 当前与 NR5G-NSA 模式不兼容。"}
            {isLteOnly && " 当前没有可用的 NR 连接。"}
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
                        ? "从当前可见的 5G 载波中选择（QCAINFO 中的 PCC + SCC）。频段和 SCS 会自动填入。"
                        : "当前 QCAINFO 中没有可见的 5G 载波。关闭简单模式可手动输入。"}
                    </TooltipContent>
                  </Tooltip>
                  <p className="font-medium text-muted-foreground text-sm">
                    简单模式
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="nr-sa-simple-mode"
                    aria-label="切换 NR 简单模式"
                    checked={simpleMode && hasOptions}
                    onCheckedChange={handleSimpleModeToggle}
                    disabled={!hasOptions || isDisabled}
                  />
                  <Label htmlFor="nr-sa-simple-mode">
                    {simpleMode && hasOptions ? "开" : "关"}
                  </Label>
                </div>
              </div>
              {!hasOptions && (
                <p className="text-xs text-muted-foreground">
                  当前 QCAINFO 中没有可见的 5G 载波。
                </p>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <TbInfoCircleFilled className="size-5 text-info" />
                <p className="font-semibold text-muted-foreground text-sm">
                  启用 NR 基站锁定
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {isLocking ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : null}
                <Switch
                  id="nr-sa-tower-locking"
                  checked={isEnabled}
                  onCheckedChange={handleToggle}
                  disabled={isDisabled}
                />
                <Label htmlFor="nr-sa-tower-locking">
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
                        <FieldLabel htmlFor="nrarfcn1">信道（ARFCN）</FieldLabel>
                        {simpleMode && hasOptions ? (
                          <Select
                            value={arfcnInList ? currentArfcnComposite : ""}
                            onValueChange={handleCarrierPick}
                            disabled={isDisabled}
                          >
                            <SelectTrigger id="nrarfcn1" className="w-full">
                              {arfcnInList ? (
                                <SelectValue />
                              ) : arfcn && pci ? (
                                <span
                                  className="min-w-0 italic text-muted-foreground line-clamp-1"
                                  title={`自定义：ARFCN ${arfcn}，PCI ${pci}`}
                                >
                                  {`自定义：ARFCN ${arfcn}，PCI ${pci}`}
                                </span>
                              ) : (
                                <SelectValue placeholder="选择 5G 载波" />
                              )}
                            </SelectTrigger>
                            <SelectContent>
                              {carrierOptions.map((opt) => {
                                const value = compositeValue(opt.earfcn, opt.pci);
                                return (
                                  <SelectItem key={value} value={value}>
                                    <CarrierLabel opt={opt} />
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            id="nrarfcn1"
                            type="text"
                            placeholder="输入 ARFCN"
                            value={arfcn}
                            onChange={(e) => setArfcn(e.target.value)}
                            disabled={isDisabled}
                          />
                        )}
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="nrpci">小区 ID（PCI）</FieldLabel>
                        <Input
                          id="nrpci"
                          type="text"
                          placeholder="输入 PCI"
                          value={pci}
                          onChange={(e) => setPci(e.target.value)}
                          disabled={isDisabled}
                        />
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel htmlFor="nr-band">NR 频段</FieldLabel>
                        <Input
                          id="nr-band"
                          type="text"
                          placeholder="输入 NR 频段"
                          value={band}
                          onChange={(e) => setBand(e.target.value)}
                          disabled={isDisabled}
                        />
                      </Field>
                      <Field>
                        <div className="flex items-center justify-between gap-2">
                          <FieldLabel htmlFor="scs">子载波间隔</FieldLabel>
                          {simpleMode && scsSource === "band_default" && band && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">
                                  <AlertTriangle className="size-3.5 text-warning" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                {`SCS 已按 N${band} 的频段默认值自动填入。如锁定失败，请按实际基站参数核对。`}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <Select
                          value={scs}
                          onValueChange={(v) => {
                            setScs(v);
                            setScsSource("manual");
                          }}
                          disabled={isDisabled}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择 SCS" />
                          </SelectTrigger>
                          <SelectContent>
                            {SCS_OPTIONS.map((opt) => (
                              <SelectItem
                                key={opt.value}
                                value={String(opt.value)}
                              >
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
            <AlertDialogTitle>锁定到 NR-SA 基站？</AlertDialogTitle>
            <AlertDialogDescription>
              这会将调制解调器锁定到 NR ARFCN {pendingCell?.arfcn}、PCI{" "}
              {pendingCell?.pci}（频段 {pendingCell?.band}）。调制解调器只会连接到这个基站，切换过程中可能会短暂断线。
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
            <AlertDialogTitle>解除 NR-SA 基站锁定？</AlertDialogTitle>
            <AlertDialogDescription>
              这会移除 NR-SA 基站锁定。调制解调器将可自由选择任何可用基站，切换过程中可能会短暂断线。
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

export default NRSALockingComponent;
