"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2Icon,
  CircleDotIcon,
  Loader2Icon,
  MapPinIcon,
  CompassIcon,
  RotateCcwIcon,
  TrophyIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  RSRP_THRESHOLDS,
  SINR_THRESHOLDS,
  getSignalQuality,
} from "@/types/modem-status";
import type { SignalPerAntenna } from "@/types/modem-status";
import {
  normalizeValue,
  getQualityColor,
  qualityToBarColor,
  rsrpToPercent,
  sinrToPercent,
  findBestSlot,
  SIGNAL_KEYS,
  SAMPLES_PER_RECORDING,
  SLOT_COUNT,
  RADIO_MODE_LABELS,
  DEFAULT_ANGLES,
  DEFAULT_POSITIONS,
  EMPTY_SNAPSHOT_ARRAYS,
  type RadioMode,
  type AntennaType,
  type RecordingSnapshot,
  type SignalKey,
} from "./utils";

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

    const averaged: Pick<RecordingSnapshot, SignalKey> = {
      ...EMPTY_SNAPSHOT_ARRAYS,
    };
    for (const key of SIGNAL_KEYS) {
      averaged[key] = [0, 1, 2, 3].map((ant) => {
        const vals = acc[key]
          .map((s) => s[ant])
          .filter((v): v is number => v !== null);
        return vals.length > 0
          ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
          : null;
      });
    }

    const snapshot: RecordingSnapshot = {
      label: labelRef.current,
      ts: Date.now(),
      ...averaged,
    };

    setState((s) => {
      if (s.activeSlot === null) return s;
      const slots = [...s.slots];
      slots[s.activeSlot] = snapshot;
      return { ...s, slots, activeSlot: null, samplesCollected: 0 };
    });

    for (const key of SIGNAL_KEYS) acc[key] = [];
  }, [spa, state.activeSlot]);

  const startRecording = useCallback(
    (slotIndex: number, label: string) => {
      for (const key of SIGNAL_KEYS) accRef.current[key] = [];
      labelRef.current = label;
      setState((s) => ({
        ...s,
        activeSlot: slotIndex,
        samplesCollected: 0,
      }));
    },
    []
  );

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
          value === null
            ? "text-muted-foreground/40"
            : getQualityColor(quality)
        )}
      >
        {value === null ? "—" : `${value} ${unit}`}
      </span>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className={cn("h-full rounded-full", qualityToBarColor(quality))}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: percent / 100 }}
          style={{ originX: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: 24 }}
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
          <span className="text-[10px] text-muted-foreground -mt-1">
            LTE RSRP
          </span>
          <span className="text-[10px] text-muted-foreground -mt-1">
            LTE SINR
          </span>
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
          <span className="text-[10px] text-muted-foreground -mt-1">
            NR RSRP
          </span>
          <span className="text-[10px] text-muted-foreground -mt-1">
            NR SINR
          </span>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recording slot card (one per position/angle)
// ---------------------------------------------------------------------------

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

  const slotStatus = isRecording
    ? "recording"
    : snapshot
      ? isBest
        ? "recorded, best result"
        : "recorded"
      : "empty";

  return (
    <div
      role="region"
      aria-label={`Slot ${slotIndex + 1}: ${label} — ${slotStatus}`}
      className={cn(
        "relative rounded-xl border p-4 space-y-3 transition-all",
        isRecording && "ring-2 ring-primary border-primary",
        isBest && snapshot && "ring-2 ring-primary border-primary"
      )}
    >
      {isBest && snapshot && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10">
          <Badge className="gap-1 text-[10px]">
            <TrophyIcon className="size-3" />
            最佳
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
            antennaType === "directional" ? "角度…" : "位置…"
          }
        />
      </div>

      {/* Recording in progress */}
      {isRecording && (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 py-1" aria-live="polite">
            <Loader2Icon className="size-4 text-info animate-spin" aria-hidden="true" />
            <span className="text-xs text-muted-foreground">
              正在采样：{samplesCollected} / {SAMPLES_PER_RECORDING}
            </span>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            {Array.from({ length: SAMPLES_PER_RECORDING }, (_, i) => (
              <div
                key={i}
                className={cn(
                  "size-2 rounded-full transition-colors",
                  i < samplesCollected
                    ? "bg-info"
                    : "bg-muted-foreground/20"
                )}
              />
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="w-full h-7 text-xs"
          >
            取消
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
                  <span className="text-[10px] text-muted-foreground">
                    RSRP
                  </span>
                </div>
                <div>
                  <MiniSignalBar
                    value={snapshot.lte_sinr[0]}
                    unit="dB"
                    percent={sinrToPercent(snapshot.lte_sinr[0])}
                    thresholds={SINR_THRESHOLDS}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    SINR
                  </span>
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
                  <span className="text-[10px] text-muted-foreground">
                    RSRP
                  </span>
                </div>
                <div>
                  <MiniSignalBar
                    value={snapshot.nr_sinr[0]}
                    unit="dB"
                    percent={sinrToPercent(snapshot.nr_sinr[0])}
                    thresholds={SINR_THRESHOLDS}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    SINR
                  </span>
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <CheckCircle2Icon className="h-3 w-3 text-success" />
            已记录于 {new Date(snapshot.ts).toLocaleTimeString("zh-CN")}
          </div>
        </div>
      )}

      {/* Empty — ready to record */}
      {!isRecording && !snapshot && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 py-3 justify-center">
            <CircleDotIcon className="h-4 w-4 text-muted-foreground/50" />
            <span className="text-xs text-muted-foreground">尚未记录</span>
          </div>
          <Button
            size="sm"
            onClick={() => onRecord(label)}
            className="w-full h-7 text-xs"
          >
            记录{antennaType === "directional" ? "角度" : "位置"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Full Alignment Meter card
// ---------------------------------------------------------------------------

export default function AlignmentMeterSection({
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
          <div>
            <CardTitle className="text-base">校准记录仪</CardTitle>
            <CardDescription className="text-xs">
              记录
              {antennaType === "directional" ? " 3 个角度" : " 3 个位置"}，
              找出最佳{antennaType === "directional" ? "朝向" : "摆放点"}。每次记录会对 {SAMPLES_PER_RECORDING} 次采样取平均值。
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={antennaType}
              onValueChange={(v) => {
                if (v) setAntennaType(v as AntennaType);
              }}
            >
              <ToggleGroupItem
                value="directional"
                className="gap-1 text-xs h-7 px-2"
              >
                <CompassIcon className="h-3 w-3" />
                定向
              </ToggleGroupItem>
              <ToggleGroupItem
                value="omni"
                className="gap-1 text-xs h-7 px-2"
              >
                <MapPinIcon className="h-3 w-3" />
                全向
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
              重置
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
                    <Badge>{RADIO_MODE_LABELS[mode]}</Badge>
        {/* Live signal preview */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            实时信号（主天线）
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
              className="rounded-lg border border-primary/30 bg-primary/5 p-4"
            >
              <div className="flex items-start gap-3">
                <TrophyIcon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold">
                    推荐：{" "}
                    <span className="text-primary">
                      {slots[bestSlot]!.label}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {antennaType === "directional"
                      ? "这个角度在你已记录的位置中得到的综合信号最强。"
                      : "这个位置在你已记录的位置中得到的综合信号最强。"}
                    {filledCount < SLOT_COUNT &&
                      ` 继续记录剩余 ${SLOT_COUNT - filledCount} 个位置，可获得更完整的对比结果。`}
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
