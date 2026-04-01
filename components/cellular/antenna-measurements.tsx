"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, type Variants } from "motion/react";
import {
  CheckCircle2Icon,
  CircleDotIcon,
  CrosshairIcon,
  MapPinIcon,
  CompassIcon,
  RotateCcwIcon,
  TrophyIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { useModemStatus } from "@/hooks/use-modem-status";
import { cn } from "@/lib/utils";
import {
  RSRP_THRESHOLDS,
  RSRQ_THRESHOLDS,
  SINR_THRESHOLDS,
  getSignalQuality,
  type SignalPerAntenna,
} from "@/types/modem-status";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getQualityColor(quality: string) {
  switch (quality) {
    case "Excellent":
    case "Good":
      return "text-success";
    case "Fair":
      return "text-warning";
    case "Poor":
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
}

function getQualityBadgeVariant(quality: string) {
  switch (quality) {
    case "Excellent":
    case "Good":
      return "success" as const;
    case "Fair":
      return "warning" as const;
    case "Poor":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

// -140 dBm is the 3GPP floor sentinel used by Quectel to mean "not measured".
// -32768 is the integer sentinel emitted when the modem returns no data.
const RSRP_INVALID_SENTINELS = new Set([-140, -32768]);

function normalizeValue(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (RSRP_INVALID_SENTINELS.has(value)) return null;
  return value;
}

function formatValue(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined) return "—";
  return `${value} ${unit}`;
}

// ---------------------------------------------------------------------------
// Metric row inside an antenna card section
// ---------------------------------------------------------------------------

function MetricRow({
  label,
  value,
  rawValue,
  unit,
  thresholds,
}: {
  label: string;
  value: number | null | undefined;
  rawValue?: number | null;
  unit: string;
  thresholds: (typeof RSRP_THRESHOLDS);
}) {
  const normalized = normalizeValue(rawValue ?? value ?? null);
  const quality = getSignalQuality(normalized, thresholds);
  const isNull = normalized === null;

  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "font-mono text-sm font-medium tabular-nums",
            isNull ? "text-muted-foreground/50" : getQualityColor(quality)
          )}
        >
          {formatValue(normalized, unit)}
        </span>
        {!isNull && (
          <Badge
            variant={getQualityBadgeVariant(quality)}
            className="text-[10px] px-1.5 py-0 h-4"
          >
            {quality}
          </Badge>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single antenna card
// ---------------------------------------------------------------------------

const ANTENNA_LABELS = [
  { name: "Primary", description: "Main transmit/receive antenna (ANT0)" },
  { name: "Diverse", description: "Diversity / receive antenna (ANT1)" },
  { name: "MIMO 1", description: "MIMO spatial stream 1 (ANT2)" },
  { name: "MIMO 2", description: "MIMO spatial stream 2 (ANT3)" },
];

type RadioMode = "lte" | "nr" | "endc";

/** Determine active RAT(s) across ALL antennas. */
function detectRadioMode(spa: SignalPerAntenna): RadioMode {
  let hasLte = false;
  let hasNr = false;
  for (let i = 0; i < 4; i++) {
    if (
      normalizeValue(spa.lte_rsrp[i]) !== null ||
      normalizeValue(spa.lte_rsrq[i]) !== null ||
      normalizeValue(spa.lte_sinr[i]) !== null
    )
      hasLte = true;
    if (
      normalizeValue(spa.nr_rsrp[i]) !== null ||
      normalizeValue(spa.nr_rsrq[i]) !== null ||
      normalizeValue(spa.nr_sinr[i]) !== null
    )
      hasNr = true;
  }
  if (hasLte && hasNr) return "endc";
  if (hasNr) return "nr";
  return "lte";
}

function isAntennaActive(
  spa: SignalPerAntenna,
  index: number
): boolean {
  return (
    normalizeValue(spa.lte_rsrp[index]) !== null ||
    normalizeValue(spa.lte_rsrq[index]) !== null ||
    normalizeValue(spa.lte_sinr[index]) !== null ||
    normalizeValue(spa.nr_rsrp[index]) !== null ||
    normalizeValue(spa.nr_rsrq[index]) !== null ||
    normalizeValue(spa.nr_sinr[index]) !== null
  );
}

const RADIO_MODE_LABELS: Record<RadioMode, string> = {
  lte: "4G LTE",
  nr: "5G SA",
  endc: "5G NSA (EN-DC)",
};

// ---------------------------------------------------------------------------
// Alignment Meter — 3-position recording for antenna placement / aiming
// ---------------------------------------------------------------------------

type AntennaType = "directional" | "omni";

const SLOT_COUNT = 3;

/** Per-slot averaged snapshot of per-antenna signal values. */
interface RecordingSnapshot {
  label: string;
  ts: number;
  lte_rsrp: (number | null)[];
  lte_sinr: (number | null)[];
  nr_rsrp: (number | null)[];
  nr_sinr: (number | null)[];
}

const EMPTY_SNAPSHOT_ARRAYS = {
  lte_rsrp: [null, null, null, null] as (number | null)[],
  lte_sinr: [null, null, null, null] as (number | null)[],
  nr_rsrp: [null, null, null, null] as (number | null)[],
  nr_sinr: [null, null, null, null] as (number | null)[],
};

const SIGNAL_KEYS = ["lte_rsrp", "lte_sinr", "nr_rsrp", "nr_sinr"] as const;
type SignalKey = (typeof SIGNAL_KEYS)[number];

function rsrpToPercent(value: number | null): number {
  if (value === null) return 0;
  const clamped = Math.max(-140, Math.min(-44, value));
  return Math.round(((clamped + 140) / 96) * 100);
}

function sinrToPercent(value: number | null): number {
  if (value === null) return 0;
  const clamped = Math.max(-23, Math.min(30, value));
  return Math.round(((clamped + 23) / 53) * 100);
}

function qualityToBarColor(quality: string) {
  switch (quality) {
    case "excellent":
    case "good":
      return "bg-success";
    case "fair":
      return "bg-warning";
    case "poor":
      return "bg-destructive";
    default:
      return "bg-muted";
  }
}

const SAMPLES_PER_RECORDING = 3;

// ---------------------------------------------------------------------------
// Recording hook — accumulates samples then averages
// ---------------------------------------------------------------------------

interface RecorderState {
  antennaType: AntennaType;
  slots: (RecordingSnapshot | null)[];
  activeSlot: number | null;
  samplesCollected: number;
}

function usePositionRecorder(spa: SignalPerAntenna | null) {
  const [state, setState] = useState<RecorderState>({
    antennaType: "directional",
    slots: [null, null, null],
    activeSlot: null,
    samplesCollected: 0,
  });

  const accRef = useRef<{ [K in SignalKey]: (number | null)[][] }>({
    lte_rsrp: [],
    lte_sinr: [],
    nr_rsrp: [],
    nr_sinr: [],
  });

  const labelRef = useRef("");

  useEffect(() => {
    if (state.activeSlot === null || !spa) return;

    const acc = accRef.current;
    for (const key of SIGNAL_KEYS) {
      acc[key].push(
        [0, 1, 2, 3].map((i) => normalizeValue(spa[key]?.[i]))
      );
    }

    const count = acc.lte_rsrp.length;

    if (count < SAMPLES_PER_RECORDING) {
      setState((s) => ({ ...s, samplesCollected: count }));
      return;
    }

    const averaged: Pick<RecordingSnapshot, SignalKey> = { ...EMPTY_SNAPSHOT_ARRAYS };
    for (const key of SIGNAL_KEYS) {
      averaged[key] = [0, 1, 2, 3].map((ant) => {
        const vals = acc[key].map((s) => s[ant]).filter((v): v is number => v !== null);
        return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
      });
    }

    const snapshot: RecordingSnapshot = {
      label: labelRef.current,
      ts: Date.now(),
      ...averaged,
    };

    const slotIdx = state.activeSlot;
    setState((s) => {
      const slots = [...s.slots];
      slots[slotIdx] = snapshot;
      return { ...s, slots, activeSlot: null, samplesCollected: 0 };
    });

    for (const key of SIGNAL_KEYS) acc[key] = [];
  }, [spa, state.activeSlot]);

  const startRecording = useCallback((slotIndex: number, label: string) => {
    for (const key of SIGNAL_KEYS) accRef.current[key] = [];
    labelRef.current = label;
    setState((s) => ({ ...s, activeSlot: slotIndex, samplesCollected: 0 }));
  }, []);

  const cancelRecording = useCallback(() => {
    for (const key of SIGNAL_KEYS) accRef.current[key] = [];
    setState((s) => ({ ...s, activeSlot: null, samplesCollected: 0 }));
  }, []);

  const setAntennaType = useCallback((type: AntennaType) => {
    setState((s) => ({ ...s, antennaType: type }));
  }, []);

  const resetAll = useCallback(() => {
    for (const key of SIGNAL_KEYS) accRef.current[key] = [];
    setState((s) => ({
      ...s,
      slots: [null, null, null],
      activeSlot: null,
      samplesCollected: 0,
    }));
  }, []);

  return { state, startRecording, cancelRecording, setAntennaType, resetAll };
}

// ---------------------------------------------------------------------------
// Determine best slot
// ---------------------------------------------------------------------------

function computeCompositeScore(snap: RecordingSnapshot, mode: RadioMode): number {
  let rsrpVal: number | null = null;
  let sinrVal: number | null = null;

  if (mode === "nr" || mode === "endc") {
    rsrpVal = snap.nr_rsrp[0];
    sinrVal = snap.nr_sinr[0];
  }
  if ((mode === "lte" || mode === "endc") && rsrpVal === null) {
    rsrpVal = snap.lte_rsrp[0];
    sinrVal = snap.lte_sinr[0];
  }

  const rsrpPct = rsrpToPercent(rsrpVal);
  const sinrPct = sinrToPercent(sinrVal);
  return rsrpPct * 0.6 + sinrPct * 0.4;
}

function findBestSlot(
  slots: (RecordingSnapshot | null)[],
  mode: RadioMode
): number | null {
  let bestIdx: number | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (!s) continue;
    const score = computeCompositeScore(s, mode);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

// ---------------------------------------------------------------------------
// Mini signal bar (compact, for comparison)
// ---------------------------------------------------------------------------

function MiniSignalBar({
  value,
  unit,
  percent,
  thresholds,
}: {
  value: number | null;
  unit: string;
  percent: number;
  thresholds: typeof RSRP_THRESHOLDS;
}) {
  const quality = getSignalQuality(value, thresholds);
  return (
    <div className="space-y-1">
      <span
        className={cn(
          "font-mono text-sm font-semibold tabular-nums",
          value === null ? "text-muted-foreground/40" : getQualityColor(quality)
        )}
      >
        {value === null ? "—" : `${value} ${unit}`}
      </span>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className={cn("h-full rounded-full", qualityToBarColor(quality))}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live signal overview (primary antenna, shown during idle/recording)
// ---------------------------------------------------------------------------

function LiveSignalOverview({
  spa,
  mode,
}: {
  spa: SignalPerAntenna;
  mode: RadioMode;
}) {
  const showLte = mode === "lte" || mode === "endc";
  const showNr = mode === "nr" || mode === "endc";

  const lteRsrp = normalizeValue(spa.lte_rsrp[0]);
  const lteSinr = normalizeValue(spa.lte_sinr[0]);
  const nrRsrp = normalizeValue(spa.nr_rsrp[0]);
  const nrSinr = normalizeValue(spa.nr_sinr[0]);

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
      {showLte && (
        <>
          <MiniSignalBar
            value={lteRsrp}
            unit="dBm"
            percent={rsrpToPercent(lteRsrp)}
            thresholds={RSRP_THRESHOLDS}
          />
          <MiniSignalBar
            value={lteSinr}
            unit="dB"
            percent={sinrToPercent(lteSinr)}
            thresholds={SINR_THRESHOLDS}
          />
          <span className="text-[10px] text-muted-foreground -mt-1">LTE RSRP</span>
          <span className="text-[10px] text-muted-foreground -mt-1">LTE SINR</span>
        </>
      )}
      {showNr && (
        <>
          <MiniSignalBar
            value={nrRsrp}
            unit="dBm"
            percent={rsrpToPercent(nrRsrp)}
            thresholds={RSRP_THRESHOLDS}
          />
          <MiniSignalBar
            value={nrSinr}
            unit="dB"
            percent={sinrToPercent(nrSinr)}
            thresholds={SINR_THRESHOLDS}
          />
          <span className="text-[10px] text-muted-foreground -mt-1">NR RSRP</span>
          <span className="text-[10px] text-muted-foreground -mt-1">NR SINR</span>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recording slot card (one per position/angle)
// ---------------------------------------------------------------------------

const DEFAULT_ANGLES = ["0°", "45°", "90°"];
const DEFAULT_POSITIONS = ["Position A", "Position B", "Position C"];

function RecordingSlotCard({
  slotIndex,
  snapshot,
  antennaType,
  mode,
  isRecording,
  samplesCollected,
  isBest,
  onRecord,
  onCancel,
}: {
  slotIndex: number;
  snapshot: RecordingSnapshot | null;
  antennaType: AntennaType;
  mode: RadioMode;
  isRecording: boolean;
  samplesCollected: number;
  isBest: boolean;
  onRecord: (label: string) => void;
  onCancel: () => void;
}) {
  const defaults =
    antennaType === "directional" ? DEFAULT_ANGLES : DEFAULT_POSITIONS;
  const defaultLabel = defaults[slotIndex];
  const [labelOverride, setLabelOverride] = useState<string | null>(null);
  const label = snapshot ? snapshot.label : (labelOverride ?? defaultLabel);
  const setLabel = (v: string) => setLabelOverride(v);

  const showLte = mode === "lte" || mode === "endc";
  const showNr = mode === "nr" || mode === "endc";

  return (
    <div
      className={cn(
        "relative rounded-xl border p-4 space-y-3 transition-all",
        isRecording && "ring-2 ring-primary border-primary",
        isBest && snapshot && "ring-2 ring-success border-success"
      )}
    >
      {isBest && snapshot && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
          <Badge variant="success" className="gap-1 text-[10px]">
            <TrophyIcon className="h-3 w-3" />
            Best
          </Badge>
        </div>
      )}

      <div className="flex items-center gap-2">
        {antennaType === "directional" ? (
          <CompassIcon className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <MapPinIcon className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          disabled={isRecording || !!snapshot}
          className="h-7 text-sm font-medium px-2"
          placeholder={
            antennaType === "directional" ? "Angle…" : "Location…"
          }
        />
      </div>

      {/* Recording in progress */}
      {isRecording && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <motion.div
              className="h-2 w-2 rounded-full bg-primary"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <span className="text-xs text-muted-foreground">
              Sampling… {samplesCollected}/{SAMPLES_PER_RECORDING}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{
                width: `${(samplesCollected / SAMPLES_PER_RECORDING) * 100}%`,
              }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="w-full h-7 text-xs"
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Recorded snapshot */}
      {!isRecording && snapshot && (
        <div className="space-y-2">
          {showLte && (
            <div className="space-y-1">
              {mode === "endc" && (
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  LTE
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <MiniSignalBar
                    value={snapshot.lte_rsrp[0]}
                    unit="dBm"
                    percent={rsrpToPercent(snapshot.lte_rsrp[0])}
                    thresholds={RSRP_THRESHOLDS}
                  />
                  <span className="text-[10px] text-muted-foreground">RSRP</span>
                </div>
                <div>
                  <MiniSignalBar
                    value={snapshot.lte_sinr[0]}
                    unit="dB"
                    percent={sinrToPercent(snapshot.lte_sinr[0])}
                    thresholds={SINR_THRESHOLDS}
                  />
                  <span className="text-[10px] text-muted-foreground">SINR</span>
                </div>
              </div>
            </div>
          )}
          {showNr && (
            <div className="space-y-1">
              {mode === "endc" && (
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  NR
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <MiniSignalBar
                    value={snapshot.nr_rsrp[0]}
                    unit="dBm"
                    percent={rsrpToPercent(snapshot.nr_rsrp[0])}
                    thresholds={RSRP_THRESHOLDS}
                  />
                  <span className="text-[10px] text-muted-foreground">RSRP</span>
                </div>
                <div>
                  <MiniSignalBar
                    value={snapshot.nr_sinr[0]}
                    unit="dB"
                    percent={sinrToPercent(snapshot.nr_sinr[0])}
                    thresholds={SINR_THRESHOLDS}
                  />
                  <span className="text-[10px] text-muted-foreground">SINR</span>
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <CheckCircle2Icon className="h-3 w-3 text-success" />
            Recorded {new Date(snapshot.ts).toLocaleTimeString()}
          </div>
        </div>
      )}

      {/* Empty — ready to record */}
      {!isRecording && !snapshot && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 py-3 justify-center">
            <CircleDotIcon className="h-4 w-4 text-muted-foreground/50" />
            <span className="text-xs text-muted-foreground">Not recorded</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRecord(label)}
            className="w-full h-7 text-xs gap-1"
          >
            <CrosshairIcon className="h-3 w-3" />
            Record {antennaType === "directional" ? "Angle" : "Position"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Full Alignment Meter card
// ---------------------------------------------------------------------------

function AlignmentMeterSection({
  spa,
  mode,
}: {
  spa: SignalPerAntenna;
  mode: RadioMode;
}) {
  const {
    state: recorderState,
    startRecording,
    cancelRecording,
    setAntennaType,
    resetAll,
  } = usePositionRecorder(spa);

  const { slots, activeSlot, antennaType, samplesCollected } = recorderState;
  const filledCount = slots.filter(Boolean).length;
  const bestSlot = filledCount >= 2 ? findBestSlot(slots, mode) : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 @lg/main:flex-row @lg/main:items-center @lg/main:justify-between">
          <div className="flex items-center gap-2">
            <CrosshairIcon className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Alignment Meter</CardTitle>
              <CardDescription className="text-xs">
                Record {antennaType === "directional" ? "3 angles" : "3 positions"}
                {" "}to find the best{" "}
                {antennaType === "directional" ? "aim" : "placement"}.
                Each recording averages {SAMPLES_PER_RECORDING} samples.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">{RADIO_MODE_LABELS[mode]}</Badge>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={antennaType}
              onValueChange={(v) => {
                if (v) setAntennaType(v as AntennaType);
              }}
            >
              <ToggleGroupItem value="directional" className="gap-1 text-xs h-7 px-2">
                <CompassIcon className="h-3 w-3" />
                Directional
              </ToggleGroupItem>
              <ToggleGroupItem value="omni" className="gap-1 text-xs h-7 px-2">
                <MapPinIcon className="h-3 w-3" />
                Omni
              </ToggleGroupItem>
            </ToggleGroup>
            <Button
              variant="outline"
              size="sm"
              onClick={resetAll}
              className="h-7 gap-1 text-xs"
              disabled={activeSlot !== null}
            >
              <RotateCcwIcon className="h-3 w-3" />
              Reset
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Live signal preview */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Live Signal (Primary Antenna)
          </p>
          <LiveSignalOverview spa={spa} mode={mode} />
        </div>

        {/* 3 recording slots */}
        <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <RecordingSlotCard
              key={`${antennaType}-${i}`}
              slotIndex={i}
              snapshot={slots[i]}
              antennaType={antennaType}
              mode={mode}
              isRecording={activeSlot === i}
              samplesCollected={activeSlot === i ? samplesCollected : 0}
              isBest={bestSlot === i}
              onRecord={(label) => startRecording(i, label)}
              onCancel={cancelRecording}
            />
          ))}
        </div>

        {/* Recommendation */}
        <AnimatePresence>
          {bestSlot !== null && slots[bestSlot] && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-lg border border-success/30 bg-success/5 p-4"
            >
              <div className="flex items-start gap-3">
                <TrophyIcon className="h-5 w-5 text-success shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold">
                    Recommended:{" "}
                    <span className="text-success">
                      {slots[bestSlot]!.label}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {antennaType === "directional"
                      ? "This angle produced the strongest composite signal across your recorded positions."
                      : "This location produced the strongest composite signal across your recorded positions."}
                    {filledCount < SLOT_COUNT &&
                      ` Record the remaining ${SLOT_COUNT - filledCount} slot${SLOT_COUNT - filledCount > 1 ? "s" : ""} for a more complete comparison.`}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

function AntennaCard({
  index,
  spa,
  mode,
}: {
  index: number;
  spa: SignalPerAntenna;
  mode: RadioMode;
}) {
  const { name, description } = ANTENNA_LABELS[index];
  const active = isAntennaActive(spa, index);

  const showLte = mode === "lte" || mode === "endc";
  const showNr = mode === "nr" || mode === "endc";

  const lteActive =
    normalizeValue(spa.lte_rsrp[index]) !== null ||
    normalizeValue(spa.lte_rsrq[index]) !== null ||
    normalizeValue(spa.lte_sinr[index]) !== null;
  const nrActive =
    normalizeValue(spa.nr_rsrp[index]) !== null ||
    normalizeValue(spa.nr_rsrq[index]) !== null ||
    normalizeValue(spa.nr_sinr[index]) !== null;

  return (
    <Card className={cn(!active && "opacity-60")}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{name}</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {description}
            </CardDescription>
          </div>
          <Badge variant={active ? "success" : "secondary"}>
            {active ? "Active" : "Inactive"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* LTE Section */}
        {showLte && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              4G / LTE{mode === "endc" && " (Anchor)"}
            </p>
            <div
              className={cn(
                "divide-y divide-border rounded-lg border px-3",
                !lteActive && "opacity-50"
              )}
            >
              <MetricRow
                label="RSRP"
                value={spa.lte_rsrp[index]}
                unit="dBm"
                thresholds={RSRP_THRESHOLDS}
              />
              <MetricRow
                label="RSRQ"
                value={spa.lte_rsrq[index]}
                unit="dB"
                thresholds={RSRQ_THRESHOLDS}
              />
              <MetricRow
                label="SINR"
                value={spa.lte_sinr[index]}
                unit="dB"
                thresholds={SINR_THRESHOLDS}
              />
            </div>
          </div>
        )}

        {/* NR Section */}
        {showNr && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              5G / NR{mode === "endc" && " (Secondary)"}
            </p>
            <div
              className={cn(
                "divide-y divide-border rounded-lg border px-3",
                !nrActive && "opacity-50"
              )}
            >
              <MetricRow
                label="RSRP"
                value={spa.nr_rsrp[index]}
                unit="dBm"
                thresholds={RSRP_THRESHOLDS}
              />
              <MetricRow
                label="RSRQ"
                value={spa.nr_rsrq[index]}
                unit="dB"
                thresholds={RSRQ_THRESHOLDS}
              />
              <MetricRow
                label="SINR"
                value={spa.nr_sinr[index]}
                unit="dB"
                thresholds={SINR_THRESHOLDS}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Skeleton card
// ---------------------------------------------------------------------------

function AntennaCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {[0, 1].map((i) => (
          <div key={i}>
            <Skeleton className="h-3 w-12 mb-2" />
            <div className="rounded-lg border px-3 divide-y divide-border">
              {[0, 1, 2].map((j) => (
                <div key={j} className="flex justify-between py-1.5">
                  <Skeleton className="h-3 w-10" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Container variants
// ---------------------------------------------------------------------------

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AntennaMeasurementsComponent() {
  const { data, isLoading, isStale, error } = useModemStatus();
  const spa = data?.signal_per_antenna ?? null;
  const mode = spa ? detectRadioMode(spa) : null;

  if (isLoading) {
    return (
      <div className="@container/main space-y-6 p-2">
        <div className="space-y-1">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 gap-4 @3xl/main:grid-cols-2 @5xl/main:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <AntennaCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="@container/main space-y-6 p-2">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Antenna Measurements
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Per-port signal metrics from AT+QRSRP, AT+QRSRQ, and AT+QSINR.
          Values update with each modem poll cycle.
        </p>
      </div>

      {(error || isStale) && (
        <div
          role="alert"
          className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error
            ? "Unable to reach the modem. Data shown may be outdated."
            : "Signal data is stale — modem may be unresponsive."}
        </div>
      )}

      {spa ? (
        <>
          {/* ── Alignment Meter — 3-position recording ── */}
          <AlignmentMeterSection spa={spa} mode={mode!} />

          {/* ── Detailed Per-Antenna Cards ── */}
          <motion.div
            className="grid grid-cols-1 gap-4 @3xl/main:grid-cols-2 @5xl/main:grid-cols-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {[0, 1, 2, 3].map((index) => (
              <motion.div key={index} variants={itemVariants}>
                <AntennaCard index={index} spa={spa} mode={mode!} />
              </motion.div>
            ))}
          </motion.div>
        </>
      ) : (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No antenna data available. Ensure the modem poller is running.
          </p>
        </div>
      )}

      <Separator />

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="font-medium">Signal quality:</span>
        {(
          [
            { label: "Excellent", variant: "success" },
            { label: "Good", variant: "success" },
            { label: "Fair", variant: "warning" },
            { label: "Poor", variant: "destructive" },
          ] as const
        ).map(({ label, variant }) => (
          <Badge key={label} variant={variant} className="text-[10px]">
            {label}
          </Badge>
        ))}
        <span>· Inactive ports show — and are dimmed.</span>
      </div>
    </div>
  );
}
