"use client";

import React, { useState, useEffect } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { TbInfoCircleFilled } from "react-icons/tb";
import { Input } from "@/components/ui/input";
import { Loader2, Crosshair } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";

import type {
  TowerLockConfig,
  TowerModemState,
  NrSaLockCell,
} from "@/types/tower-locking";
import type { ModemStatus, NetworkType } from "@/types/modem-status";
import { SCS_OPTIONS } from "@/types/tower-locking";

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

/**
 * Extract numeric band from 3GPP band string.
 * e.g., "N41" → 41, "N78" → 78
 */
function extractBandNumber(band: string | null | undefined): number | null {
  if (!band) return null;
  const match = band.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

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

  // Confirmation dialog state
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [pendingCell, setPendingCell] = useState<NrSaLockCell | null>(null);

  // Sync form from config when data loads
  useEffect(() => {
    if (config?.nr_sa) {
      if (config.nr_sa.arfcn !== null) setArfcn(String(config.nr_sa.arfcn));
      if (config.nr_sa.pci !== null) setPci(String(config.nr_sa.pci));
      if (config.nr_sa.band !== null) setBand(String(config.nr_sa.band));
      if (config.nr_sa.scs !== null) setScs(String(config.nr_sa.scs));
    }
  }, [config?.nr_sa]);

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
        isNaN(parsedArfcn) ||
        isNaN(parsedPci) ||
        isNaN(parsedBand) ||
        isNaN(parsedScs)
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

  // "Use Current" — copy active NR PCell into form fields
  const handleUseCurrent = () => {
    const nrArfcn = modemData?.nr?.arfcn;
    const nrPci = modemData?.nr?.pci;
    const nrBandNum = extractBandNumber(modemData?.nr?.band);
    const nrScs = modemData?.nr?.scs;

    if (nrArfcn != null && nrPci != null) {
      setArfcn(String(nrArfcn));
      setPci(String(nrPci));
      if (nrBandNum != null) setBand(String(nrBandNum));
      if (nrScs != null) setScs(String(nrScs));
      toast.info("已填入当前连接基站的参数");
    } else {
      toast.warning("当前没有活动的 5G SA 连接");
    }
  };

  const hasActiveNrCell =
    modemData?.nr?.arfcn != null && modemData?.nr?.pci != null;

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
              <Skeleton className="h-4 w-48" />
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
            <form
              className="grid gap-4 mt-6"
              onSubmit={(e) => e.preventDefault()}
            >
              <div className="w-full">
                <FieldSet>
                  <FieldGroup>
                    <div className="grid grid-cols-2 gap-4">
                      <Field>
                        <div className="flex items-center justify-between">
                          <FieldLabel htmlFor="nrarfcn1">信道（ARFCN）</FieldLabel>
                          <Button
                            type="button"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={handleUseCurrent}
                            disabled={isDisabled || !hasActiveNrCell}
                          >
                            使用当前值
                          </Button>
                        </div>
                        <Input
                          id="nrarfcn1"
                          type="text"
                          placeholder="输入 ARFCN"
                          value={arfcn}
                          onChange={(e) => setArfcn(e.target.value)}
                          disabled={isDisabled}
                        />
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
                        <FieldLabel htmlFor="scs">子载波间隔</FieldLabel>
                        <Select
                          value={scs}
                          onValueChange={setScs}
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
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Lock confirmation dialog */}
      <AlertDialog open={showLockDialog} onOpenChange={setShowLockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>锁定到 NR-SA 基站？</AlertDialogTitle>
            <AlertDialogDescription>
              这会将调制解调器锁定到 NR ARFCN {pendingCell?.arfcn}、PCI {pendingCell?.pci}（Band {pendingCell?.band}）。切换期间设备可能会短暂断线，之后只会连接此基站。
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
              这会移除 NR-SA 基站锁定。之后调制解调器可以自由选择任意可用基站，并可能在切换时短暂断线。
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

export default NRSALockingComponent;
