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
import { Loader2 } from "lucide-react";
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

interface NrFreqLockingProps {
  modemState: FreqLockModemState | null;
  modemData: ModemStatus | null;
  isLoading: boolean;
  isLocking: boolean;
  towerLockActive: boolean;
  onLock: (entries: NrFreqLockEntry[]) => Promise<boolean>;
  onUnlock: () => Promise<boolean>;
}

const NrFreqLockingComponent = ({
  modemState,
  modemData,
  isLoading,
  isLocking,
  towerLockActive,
  onLock,
  onUnlock,
}: NrFreqLockingProps) => {
  // Local form state for 4 ARFCN+SCS slots
  const [arfcn1, setArfcn1] = useState("");
  const [scs1, setScs1] = useState("");
  const [scsManual1, setScsManual1] = useState(false);
  const [arfcn2, setArfcn2] = useState("");
  const [scs2, setScs2] = useState("");
  const [scsManual2, setScsManual2] = useState(false);
  const [arfcn3, setArfcn3] = useState("");
  const [scs3, setScs3] = useState("");
  const [scsManual3, setScsManual3] = useState(false);
  const [arfcn4, setArfcn4] = useState("");
  const [scs4, setScs4] = useState("");
  const [scsManual4, setScsManual4] = useState(false);

  // Confirmation dialog state
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [showUnsupportedWarning, setShowUnsupportedWarning] = useState(false);
  const [pendingEntries, setPendingEntries] = useState<NrFreqLockEntry[]>([]);

  // Sync form from modem state when data loads
  useEffect(() => {
    if (modemState?.nr_entries && modemState.nr_entries.length > 0) {
      const entries = modemState.nr_entries;
      if (entries[0]) {
        setArfcn1(String(entries[0].arfcn));
        setScs1(String(entries[0].scs));
      }
      if (entries[1]) {
        setArfcn2(String(entries[1].arfcn));
        setScs2(String(entries[1].scs));
      }
      if (entries[2]) {
        setArfcn3(String(entries[2].arfcn));
        setScs3(String(entries[2].scs));
      }
      if (entries[3]) {
        setArfcn4(String(entries[3].arfcn));
        setScs4(String(entries[3].scs));
      }
    }
  }, [modemState?.nr_entries]);

  // Band matching per slot
  const matchedBands1 = useMemo((): NRBandEntry[] => {
    const val = parseInt(arfcn1, 10);
    return isNaN(val) ? [] : findAllMatchingNRBands(val);
  }, [arfcn1]);

  const matchedBands2 = useMemo((): NRBandEntry[] => {
    const val = parseInt(arfcn2, 10);
    return isNaN(val) ? [] : findAllMatchingNRBands(val);
  }, [arfcn2]);

  const matchedBands3 = useMemo((): NRBandEntry[] => {
    const val = parseInt(arfcn3, 10);
    return isNaN(val) ? [] : findAllMatchingNRBands(val);
  }, [arfcn3]);

  const matchedBands4 = useMemo((): NRBandEntry[] => {
    const val = parseInt(arfcn4, 10);
    return isNaN(val) ? [] : findAllMatchingNRBands(val);
  }, [arfcn4]);

  // SCS auto-detection — update SCS when ARFCN changes (unless manually set)
  useEffect(() => {
    if (!scsManual1 && matchedBands1.length > 0) {
      setScs1(String(suggestNRSCS(matchedBands1[0])));
    }
  }, [matchedBands1, scsManual1]);

  useEffect(() => {
    if (!scsManual2 && matchedBands2.length > 0) {
      setScs2(String(suggestNRSCS(matchedBands2[0])));
    }
  }, [matchedBands2, scsManual2]);

  useEffect(() => {
    if (!scsManual3 && matchedBands3.length > 0) {
      setScs3(String(suggestNRSCS(matchedBands3[0])));
    }
  }, [matchedBands3, scsManual3]);

  useEffect(() => {
    if (!scsManual4 && matchedBands4.length > 0) {
      setScs4(String(suggestNRSCS(matchedBands4[0])));
    }
  }, [matchedBands4, scsManual4]);

  // Derive enabled state from modem state
  const isEnabled = modemState?.nr_locked ?? false;
  const isDisabled = towerLockActive || isLocking;

  // Parse supported NR bands from modem data (combine SA + NSA)
  const supportedBands = useMemo((): number[] => {
    const sa = modemData?.device?.supported_sa_nr5g_bands ?? "";
    const nsa = modemData?.device?.supported_nsa_nr5g_bands ?? "";
    const combined = `${sa}:${nsa}`;
    const bands = combined
      .split(":")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
    // Deduplicate
    return [...new Set(bands)];
  }, [
    modemData?.device?.supported_sa_nr5g_bands,
    modemData?.device?.supported_nsa_nr5g_bands,
  ]);

  // Build entries array from form inputs
  const buildEntries = (): NrFreqLockEntry[] => {
    const entries: NrFreqLockEntry[] = [];
    const slots = [
      { arfcn: arfcn1, scs: scs1 },
      { arfcn: arfcn2, scs: scs2 },
      { arfcn: arfcn3, scs: scs3 },
      { arfcn: arfcn4, scs: scs4 },
    ];
    for (const slot of slots) {
      const a = parseInt(slot.arfcn, 10);
      const s = parseInt(slot.scs, 10);
      if (!isNaN(a) && !isNaN(s)) {
        entries.push({ arfcn: a, scs: s });
      }
    }
    return entries;
  };

  const handleToggle = (checked: boolean) => {
    if (checked) {
      const entries = buildEntries();
      if (entries.length === 0) {
        toast.warning("No frequencies entered", {
          description: "Enter at least one NR-ARFCN and SCS before enabling.",
        });
        return;
      }

      // Validate SCS is set for all entries with ARFCN
      const slots = [
        { arfcn: arfcn1, scs: scs1 },
        { arfcn: arfcn2, scs: scs2 },
        { arfcn: arfcn3, scs: scs3 },
        { arfcn: arfcn4, scs: scs4 },
      ];
      for (const slot of slots) {
        const a = parseInt(slot.arfcn, 10);
        if (!isNaN(a) && (slot.scs === "" || isNaN(parseInt(slot.scs, 10)))) {
          toast.warning("Missing SCS", {
            description:
              "Each NR-ARFCN requires an SCS value. Please select the sub-carrier spacing.",
          });
          return;
        }
      }

      // Check band support
      const allMatched = [
        ...matchedBands1,
        ...matchedBands2,
        ...matchedBands3,
        ...matchedBands4,
      ];
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
      toast.error("Failed to apply NR5G frequency lock");
    }
  };

  const confirmUnlock = async () => {
    setShowUnlockDialog(false);
    const success = await onUnlock();
    if (success) {
      toast.success("NR5G frequency lock cleared");
    } else {
      toast.error("Failed to clear NR5G frequency lock");
    }
  };

  // "Use Current" — copy active NR PCell into slot 1
  const handleUseCurrent = () => {
    const nrArfcn = modemData?.nr?.arfcn;
    const nrScs = modemData?.nr?.scs;
    if (nrArfcn != null) {
      setArfcn1(String(nrArfcn));
      setScsManual1(false); // Allow auto-detection to work
      if (nrScs != null) {
        setScs1(String(nrScs));
        setScsManual1(true); // Use modem's actual SCS
      }
      toast.info("Populated from active NR PCell");
    } else {
      toast.warning("No active NR cell");
    }
  };

  const hasActiveNrCell = modemData?.nr?.arfcn != null;

  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>NR5G Frequency Locking</CardTitle>
          <CardDescription>
            Lock to specific NR frequencies (NR-ARFCNs).
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
                <Skeleton className="h-9 w-full rounded-md" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-9 w-full rounded-md" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
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
          <CardTitle>NR5G Frequency Locking</CardTitle>
          <CardDescription>
            Lock to specific NR frequencies. Supports up to 32 entries (4
            shown).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {/* Tower lock active warning */}
            {towerLockActive ? (
              <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                <TbAlertTriangleFilled className="w-5 h-5 mt-0.5 shrink-0" />
                <p className="font-semibold">
                  NR Tower Lock is active. Disable it before using frequency
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
                    <TbInfoCircleFilled className="w-5 h-5 text-info" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Cannot be used together with NR Tower Lock (AT+QNWLOCK).
                      <br />
                      SCS is auto-detected from band type but can be overridden.
                    </p>
                  </TooltipContent>
                </Tooltip>

                <p className="font-semibold text-muted-foreground text-sm">
                  NR5G Frequency Lock Enabled
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {isLocking ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : null}
                <Switch
                  id="nr-freq-locking"
                  checked={isEnabled}
                  onCheckedChange={handleToggle}
                  disabled={isDisabled}
                />
                <Label htmlFor="nr-freq-locking">
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
                    {/* Slot 1 */}
                    <div className="grid grid-cols-2 gap-4">
                      <Field>
                        <div className="flex items-center justify-between">
                          <FieldLabel htmlFor="nr-freq-arfcn1">
                            NR-ARFCN
                          </FieldLabel>
                          <Button
                            type="button"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={handleUseCurrent}
                            disabled={isDisabled || !hasActiveNrCell}
                          >
                            Use Current
                          </Button>
                        </div>
                        <Input
                          id="nr-freq-arfcn1"
                          type="text"
                          placeholder="Enter NR-ARFCN"
                          value={arfcn1}
                          onChange={(e) => {
                            setArfcn1(e.target.value);
                            setScsManual1(false);
                          }}
                          disabled={isDisabled}
                        />
                        <NrBandMatchDisplay
                          bands={matchedBands1}
                          hasInput={arfcn1.length > 0}
                          supportedBands={supportedBands}
                        />
                      </Field>
                      <Field>
                        <FieldLabel>SCS</FieldLabel>
                        <Select
                          value={scs1}
                          onValueChange={(v) => {
                            setScs1(v);
                            setScsManual1(true);
                          }}
                          disabled={isDisabled}
                        >
                          <SelectTrigger aria-label="SCS slot 1">
                            <SelectValue placeholder="SCS" />
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

                    {/* Slot 2 */}
                    <div className="grid grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel htmlFor="nr-freq-arfcn2">
                          NR-ARFCN 2
                        </FieldLabel>
                        <Input
                          id="nr-freq-arfcn2"
                          type="text"
                          placeholder="Enter NR-ARFCN 2"
                          value={arfcn2}
                          onChange={(e) => {
                            setArfcn2(e.target.value);
                            setScsManual2(false);
                          }}
                          disabled={isDisabled}
                        />
                        <NrBandMatchDisplay
                          bands={matchedBands2}
                          hasInput={arfcn2.length > 0}
                          supportedBands={supportedBands}
                        />
                      </Field>
                      <Field>
                        <FieldLabel>SCS 2</FieldLabel>
                        <Select
                          value={scs2}
                          onValueChange={(v) => {
                            setScs2(v);
                            setScsManual2(true);
                          }}
                          disabled={isDisabled}
                        >
                          <SelectTrigger aria-label="SCS slot 2">
                            <SelectValue placeholder="SCS" />
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

                    {/* Slot 3 */}
                    <div className="grid grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel htmlFor="nr-freq-arfcn3">
                          NR-ARFCN 3
                        </FieldLabel>
                        <Input
                          id="nr-freq-arfcn3"
                          type="text"
                          placeholder="Enter NR-ARFCN 3"
                          value={arfcn3}
                          onChange={(e) => {
                            setArfcn3(e.target.value);
                            setScsManual3(false);
                          }}
                          disabled={isDisabled}
                        />
                        <NrBandMatchDisplay
                          bands={matchedBands3}
                          hasInput={arfcn3.length > 0}
                          supportedBands={supportedBands}
                        />
                      </Field>
                      <Field>
                        <FieldLabel>SCS 3</FieldLabel>
                        <Select
                          value={scs3}
                          onValueChange={(v) => {
                            setScs3(v);
                            setScsManual3(true);
                          }}
                          disabled={isDisabled}
                        >
                          <SelectTrigger aria-label="SCS slot 3">
                            <SelectValue placeholder="SCS" />
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

                    {/* Slot 4 */}
                    <div className="grid grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel htmlFor="nr-freq-arfcn4">
                          NR-ARFCN 4
                        </FieldLabel>
                        <Input
                          id="nr-freq-arfcn4"
                          type="text"
                          placeholder="Enter NR-ARFCN 4"
                          value={arfcn4}
                          onChange={(e) => {
                            setArfcn4(e.target.value);
                            setScsManual4(false);
                          }}
                          disabled={isDisabled}
                        />
                        <NrBandMatchDisplay
                          bands={matchedBands4}
                          hasInput={arfcn4.length > 0}
                          supportedBands={supportedBands}
                        />
                      </Field>
                      <Field>
                        <FieldLabel>SCS 4</FieldLabel>
                        <Select
                          value={scs4}
                          onValueChange={(v) => {
                            setScs4(v);
                            setScsManual4(true);
                          }}
                          disabled={isDisabled}
                        >
                          <SelectTrigger aria-label="SCS slot 4">
                            <SelectValue placeholder="SCS" />
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

      {/* Normal lock confirmation dialog */}
      <AlertDialog open={showLockDialog} onOpenChange={setShowLockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lock NR5G Frequency?</AlertDialogTitle>
            <AlertDialogDescription>
              This will lock your modem to{" "}
              {pendingEntries.length === 1
                ? `NR-ARFCN ${pendingEntries[0].arfcn} (SCS ${pendingEntries[0].scs} kHz)`
                : `${pendingEntries.length} NR frequencies`}
              . The modem will only use{" "}
              {pendingEntries.length === 1
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
              Unsupported Band Warning
            </AlertDialogTitle>
            <AlertDialogDescription>
              The NR-ARFCN(s) you entered map to bands not supported by your
              modem. Locking to an unsupported frequency may cause unexpected
              behavior.
              <br />
              <br />
              <strong>Matched bands:</strong>{" "}
              {[
                ...matchedBands1,
                ...matchedBands2,
                ...matchedBands3,
                ...matchedBands4,
              ]
                .map((b) => `n${b.band}`)
                .join(", ") || "Unknown"}
              <br />
              <strong>Supported bands:</strong>{" "}
              {supportedBands.map((b) => `n${b}`).join(", ")}
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
            <AlertDialogTitle>Unlock NR5G Frequency?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the NR5G frequency lock. The modem will be free
              to use any available NR frequency and may briefly disconnect.
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

/** Inline NR band match display below an NR-ARFCN input */
function NrBandMatchDisplay({
  bands,
  hasInput,
  supportedBands,
}: {
  bands: NRBandEntry[];
  hasInput: boolean;
  supportedBands: number[];
}) {
  if (!hasInput) return null;

  if (bands.length === 0) {
    return (
      <p className="text-xs text-destructive mt-1">
        No matching bands found for this NR-ARFCN
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
              n{b.band} ({b.name}){!isSupported && " — unsupported"}
            </span>
          </span>
        );
      })}
    </p>
  );
}

export default NrFreqLockingComponent;
