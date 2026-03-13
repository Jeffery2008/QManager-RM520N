"use client";

import React, { useState, useEffect, useMemo } from "react";
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
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TbInfoCircleFilled, TbAlertTriangleFilled } from "react-icons/tb";

import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";

import type { FreqLockModemState } from "@/types/frequency-locking";
import type { ModemStatus } from "@/types/modem-status";
import { findAllMatchingLTEBands, type LTEBandEntry } from "@/lib/earfcn";

interface LteFreqLockingProps {
  modemState: FreqLockModemState | null;
  modemData: ModemStatus | null;
  isLoading: boolean;
  isLocking: boolean;
  towerLockActive: boolean;
  onLock: (earfcns: number[]) => Promise<boolean>;
  onUnlock: () => Promise<boolean>;
}

const LteFreqLockingComponent = ({
  modemState,
  modemData,
  isLoading,
  isLocking,
  towerLockActive,
  onLock,
  onUnlock,
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
          description: "Enter at least one EARFCN before enabling.",
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
      toast.error("Failed to apply LTE frequency lock");
    }
  };

  const confirmUnlock = async () => {
    setShowUnlockDialog(false);
    const success = await onUnlock();
    if (success) {
      toast.success("LTE frequency lock cleared");
    } else {
      toast.error("Failed to clear LTE frequency lock");
    }
  };

  // "Use Current" — copy active PCell EARFCN into slot 1
  const handleUseCurrent = () => {
    const earfcn = modemData?.lte?.earfcn;
    if (earfcn != null) {
      setEarfcn1(String(earfcn));
      toast.info("Populated from active LTE PCell");
    } else {
      toast.warning("No active LTE cell");
    }
  };

  const hasActiveLteCell = modemData?.lte?.earfcn != null;

  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>LTE Frequency Locking</CardTitle>
          <CardDescription>
            Lock to specific LTE frequencies (EARFCNs).
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

  return (
    <>
      <Card
        className={`@container/card ${towerLockActive ? "opacity-60" : ""}`}
      >
        <CardHeader>
          <CardTitle>LTE Frequency Locking</CardTitle>
          <CardDescription>
            Lock to specific LTE frequencies (EARFCNs). Maximum 2 frequencies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {/* Tower lock active warning */}
            {towerLockActive ? (
              <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                <TbAlertTriangleFilled className="w-5 h-5 mt-0.5 shrink-0" />
                <p className="font-semibold">
                  LTE Tower Lock is active. Disable it before using frequency
                  locking.
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-sm">
                <TbAlertTriangleFilled className="w-5 h-5 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Experimental Feature</p>
                </div>
              </div>
            )}

            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TbInfoCircleFilled className="w-5 h-5 text-blue-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Locking to an unsupported frequency may cause a modem
                      crash dump. <br />
                      Cannot be used while Tower Lock is active.
                    </p>
                  </TooltipContent>
                </Tooltip>
                <p className="font-semibold text-muted-foreground text-sm">
                  LTE Frequency Lock Enabled
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {isLocking ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : null}
                <Switch
                  id="lte-freq-locking"
                  checked={isEnabled}
                  onCheckedChange={handleToggle}
                  disabled={isDisabled}
                />
                <Label htmlFor="lte-freq-locking">
                  {isEnabled ? "Enabled" : "Disabled"}
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
                        <FieldLabel htmlFor="freq-earfcn1">EARFCN</FieldLabel>
                        <Button
                          type="button"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={handleUseCurrent}
                          disabled={isDisabled || !hasActiveLteCell}
                        >
                          Use Current
                        </Button>
                      </div>
                      <Input
                        id="freq-earfcn1"
                        type="text"
                        placeholder="Enter EARFCN"
                        className="max-w-sm"
                        value={earfcn1}
                        onChange={(e) => setEarfcn1(e.target.value)}
                        disabled={isDisabled}
                      />
                      <BandMatchDisplay
                        bands={matchedBands1}
                        hasInput={earfcn1.length > 0}
                        supportedBands={supportedBands}
                      />
                    </Field>

                    {/* EARFCN 2 */}
                    <Field>
                      <FieldLabel htmlFor="freq-earfcn2">
                        EARFCN 2 (Optional)
                      </FieldLabel>
                      <Input
                        id="freq-earfcn2"
                        type="text"
                        placeholder="Enter EARFCN 2"
                        className="max-w-sm"
                        value={earfcn2}
                        onChange={(e) => setEarfcn2(e.target.value)}
                        disabled={isDisabled}
                      />
                      <BandMatchDisplay
                        bands={matchedBands2}
                        hasInput={earfcn2.length > 0}
                        supportedBands={supportedBands}
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
            <AlertDialogTitle>Lock LTE Frequency?</AlertDialogTitle>
            <AlertDialogDescription>
              This will lock your modem to{" "}
              {pendingEarfcns.length === 1
                ? `EARFCN ${pendingEarfcns[0]}`
                : `EARFCNs ${pendingEarfcns.join(", ")}`}
              . The modem will only use{" "}
              {pendingEarfcns.length === 1
                ? "this frequency"
                : "these frequencies"}{" "}
              and may briefly disconnect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLock}>
              Lock Frequency
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
              Possible Crash Dump Risk
            </AlertDialogTitle>
            <AlertDialogDescription>
              The EARFCN(s) you entered map to bands not supported by your
              modem. Locking to an unsupported frequency may cause a modem crash
              dump according to Qualcomm documentation.
              <br />
              <br />
              <strong>Matched bands:</strong>{" "}
              {[...matchedBands1, ...matchedBands2]
                .map((b) => `B${b.band}`)
                .join(", ") || "Unknown"}
              <br />
              <strong>Supported bands:</strong>{" "}
              {supportedBands.map((b) => `B${b}`).join(", ")}
              <br />
              <br />
              Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmLock}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Lock Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unlock confirmation dialog */}
      <AlertDialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlock LTE Frequency?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the LTE frequency lock. The modem will be free to
              use any available frequency and may briefly disconnect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnlock}>
              Unlock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

/** Inline band match display below an EARFCN input */
function BandMatchDisplay({
  bands,
  hasInput,
  supportedBands,
}: {
  bands: LTEBandEntry[];
  hasInput: boolean;
  supportedBands: number[];
}) {
  if (!hasInput) return null;

  if (bands.length === 0) {
    return (
      <p className="text-xs text-destructive mt-1">
        No matching bands found for this EARFCN
      </p>
    );
  }

  return (
    <p className="text-xs text-muted-foreground mt-1">
      Possible bands:{" "}
      {bands.map((b, i) => {
        const isSupported =
          supportedBands.length === 0 || supportedBands.includes(b.band);
        return (
          <span key={b.band}>
            {i > 0 && ", "}
            <span className={isSupported ? "" : "text-destructive font-medium"}>
              B{b.band} ({b.name}){!isSupported && " — unsupported"}
            </span>
          </span>
        );
      })}
    </p>
  );
}

export default LteFreqLockingComponent;
