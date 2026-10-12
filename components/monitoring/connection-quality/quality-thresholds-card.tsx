"use client";

import * as React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  CircleAlertIcon,
  InfoIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { latencyTone, lossTone, type Tone } from "@/components/monitoring/latency-monitoring/derive";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CardFoot } from "@/components/ui/card-foot";
import { SaveButton, useSaveFlash } from "@/components/ui/save-button";
import { SegmentedField, type SegmentedOption } from "@/components/ui/segmented-field";
import { Skeleton } from "@/components/ui/skeleton";
import { useModemStatus } from "@/hooks/use-modem-status";
import type { UseQualityThresholdsReturn } from "@/hooks/use-quality-thresholds";
import { cn } from "@/lib/utils";
import {
  QUALITY_PRESETS,
  type QualityPreset,
  type QualityThresholdsSettings,
} from "@/types/modem-status";

import { ConditionBlock } from "./condition-block";
import {
  ALERT_INK,
  CARD_BODY,
  CARD_DESC,
  CARD_PAD,
  CARD_SHELL,
  CARD_TITLE,
  CONDITION,
  DELTA,
  EYEBROW,
  FAILED,
  GROUP,
  METRIC_HEAD,
  PRESET_LIMIT,
  ROW,
  ROW_STACK,
  SKELETON_LOCAL,
} from "./shapes";

// Quality Thresholds: the cuts that turn a slow or lossy link into an event.
// Neither restarts anything; recovery is the Watchdog's job.

const K = "connection_quality.thresholds";

type Metric = "latency" | "loss";

/** `very-tolerant` is a value, not a key: i18next leaves have no hyphens. */
const PRESET_KEY: Record<QualityPreset, string> = {
  standard: "standard",
  tolerant: "tolerant",
  "very-tolerant": "very_tolerant",
};

/** One decimal under a whole percent step, none on a whole one. */
function formatPct(pct: number): string {
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
}

// -----------------------------------------------------------------------------
// One metric: eyebrow + preset pill, then "Flags after" and "Right now"
// -----------------------------------------------------------------------------

interface MetricBlockProps {
  metric: Metric;
  draft: QualityPreset;
  onSelect: (preset: QualityPreset) => void;
  /** The poller's reading, or `null` for "not measured". Never a zero. */
  live: number | null;
}

function MetricBlock({ metric, draft, onSelect, live }: MetricBlockProps): React.JSX.Element {
  const { t } = useTranslation("system-settings");
  const { limit, debounce } = PRESET_LIMIT[metric][draft];
  const title = t(`${K}.${metric}.title`);

  const options: SegmentedOption<QualityPreset>[] = QUALITY_PRESETS.map((preset) => ({
    value: preset,
    label: t(`${K}.preset.${PRESET_KEY[preset]}`),
  }));

  const flags =
    metric === "latency"
      ? t(`${K}.flags.latency`, { count: debounce, ms: limit })
      : t(`${K}.flags.loss`, { count: debounce, pct: limit });

  // Latency Monitor's own rules: latency amber over the cut, red past twice it;
  // loss only marks at or over the cut, in red.
  let tone: Tone = "ok";
  if (live !== null) {
    const cuts = { latencyMs: limit, lossPct: limit };
    tone =
      metric === "latency"
        ? latencyTone(live, cuts)
        : lossTone(live, cuts) === "bad"
          ? "bad"
          : "ok";
  }

  let now: React.ReactNode;
  if (live === null) {
    now = (
      <span className={ROW.QUIET}>
        {t(metric === "latency" ? `${K}.now.no_reply` : `${K}.now.collecting`)}
      </span>
    );
  } else {
    now = (
      <>
        {metric === "latency"
          ? t(`${K}.now.latency`, { ms: Math.round(live) })
          : t(`${K}.now.loss`, { pct: formatPct(live) })}
        {tone === "ok" ? null : (
          <>
            <TriangleAlertIcon aria-hidden="true" className={cn(ROW.ALERT, ALERT_INK[tone])} />
            <span className="sr-only">
              {metric === "latency"
                ? t(`${K}.now.over_latency`, { ms: limit })
                : t(`${K}.now.over_loss`, { pct: limit })}
            </span>
          </>
        )}
      </>
    );
  }

  return (
    <div className={GROUP}>
      <div className={METRIC_HEAD}>
        <span className={cn(EYEBROW, "mr-auto")}>{title}</span>
        <SegmentedField
          value={draft}
          onValueChange={onSelect}
          options={options}
          ariaLabel={title}
          breakpoint="lg"
          glyph={() => null}
        />
      </div>
      <dl className={ROW_STACK}>
        <div className={ROW.ROOT}>
          <dt className={ROW.KEY}>{t(`${K}.row.flags`)}</dt>
          <dd className={ROW.VALUE}>{flags}</dd>
        </div>
        <div className={ROW.ROOT}>
          <dt className={ROW.KEY}>{t(`${K}.row.now`)}</dt>
          <dd className={ROW.VALUE}>{now}</dd>
        </div>
      </dl>
    </div>
  );
}

// -----------------------------------------------------------------------------
// The loaded form
// -----------------------------------------------------------------------------

interface ThresholdsFormProps {
  quality: UseQualityThresholdsReturn;
  thresholds: QualityThresholdsSettings;
}

function ThresholdsForm({ quality, thresholds }: ThresholdsFormProps): React.JSX.Element {
  const { t } = useTranslation("system-settings");
  const { saved: flashed, markSaved } = useSaveFlash();
  const { data: status } = useModemStatus();

  // The draft holds only what the user CHANGED; the saved value shows through.
  const [draft, setDraft] = useState<Partial<QualityThresholdsSettings>>({});
  const [failed, setFailed] = useState(false);

  const latency = draft.latency?.preset ?? thresholds.latency.preset;
  const loss = draft.loss?.preset ?? thresholds.loss.preset;

  const dirty =
    latency !== thresholds.latency.preset || loss !== thresholds.loss.preset;
  // Built-in defaults are not on the device yet, so saving them is a real write.
  const canSave = (dirty || quality.isDefault) && !quality.isSaving;

  // NEVER `??` a 0 in: a null loss is under the poller's sample floor.
  const liveLatency = status?.connectivity?.latency_ms ?? null;
  const liveLoss = status?.connectivity?.packet_loss_pct ?? null;

  const select = (metric: Metric) => (preset: QualityPreset) => {
    setDraft((prev) => ({ ...prev, [metric]: { preset } }));
    setFailed(false);
  };

  const handleSave = async () => {
    if (!canSave) return;
    try {
      await quality.save({ latency: { preset: latency }, loss: { preset: loss } });
      setFailed(false);
      markSaved();
      toast.success(t(`${K}.toast.saved`));
    } catch {
      setFailed(true);
      toast.error(t(`${K}.save_failed`));
    }
  };

  return (
    <>
      <MetricBlock metric="latency" draft={latency} onSelect={select("latency")} live={liveLatency} />
      <MetricBlock metric="loss" draft={loss} onSelect={select("loss")} live={liveLoss} />

      <CardFoot
        status={
          failed ? (
            <span className={FAILED.ROOT}>
              <TriangleAlertIcon className={FAILED.GLYPH} aria-hidden="true" />
              {t(`${K}.failed`)}
            </span>
          ) : dirty ? (
            <span className={DELTA}>{t(`${K}.unsaved`)}</span>
          ) : quality.isDefault ? (
            <Badge variant="info">
              <InfoIcon className="size-3" aria-hidden="true" />
              {t(`${K}.default_chip`)}
            </Badge>
          ) : null
        }
        actions={
          <SaveButton
            onClick={handleSave}
            isSaving={quality.isSaving}
            saved={flashed}
            label={t(`${K}.save`)}
            disabled={!canSave}
            size="action"
          />
        }
      />
    </>
  );
}

// -----------------------------------------------------------------------------
// Loading
// -----------------------------------------------------------------------------

function ThresholdsSkeleton(): React.JSX.Element {
  return (
    <>
      {[0, 1].map((block) => (
        <div key={block} className={GROUP}>
          <div className={METRIC_HEAD}>
            {/* Inside the eyebrow's own line box, so the head keeps its loaded height. */}
            <span className={cn(EYEBROW, "mr-auto")}>
              <Skeleton className={cn(SKELETON_LOCAL.EYEBROW, "inline-block w-16 align-middle")} />
            </span>
            <Skeleton className={SKELETON_LOCAL.SEGMENT} />
          </div>
          <div className={ROW_STACK}>
            {[0, 1].map((row) => (
              <div key={row} className={ROW.ROOT} aria-hidden="true">
                <Skeleton className={cn(SKELETON_LOCAL.ROW_TEXT, "w-20")} />
                <Skeleton className={cn(SKELETON_LOCAL.ROW_TEXT, "w-28")} />
              </div>
            ))}
          </div>
        </div>
      ))}
      <CardFoot
        liveStatus={false}
        actions={<Skeleton className={SKELETON_LOCAL.ACTION} />}
      />
    </>
  );
}

// -----------------------------------------------------------------------------
// Card
// -----------------------------------------------------------------------------

export interface QualityThresholdsCardProps {
  quality: UseQualityThresholdsReturn;
}

export default function QualityThresholdsCard({
  quality,
}: QualityThresholdsCardProps): React.JSX.Element {
  const { t } = useTranslation("system-settings");

  return (
    <Card className={CARD_SHELL}>
      <CardHeader className={CARD_PAD}>
        <CardTitle as="h2" className={CARD_TITLE}>{t(`${K}.title`)}</CardTitle>
        <CardDescription className={CARD_DESC}>
          {t(`${K}.description`)}
        </CardDescription>
      </CardHeader>

      <CardContent className={cn(CARD_PAD, CARD_BODY)}>
        {quality.isLoading ? (
          <ThresholdsSkeleton />
        ) : !quality.thresholds ? (
          <ConditionBlock
            tone="destructive"
            glyph={CircleAlertIcon}
            ariaRole="alert"
            title={t(`${K}.error.title`)}
            description={t(`${K}.error.body`)}
            onAction={() => void quality.refresh()}
            actionLabel={t(`${K}.error.retry`)}
            actionGlyph={RefreshCwIcon}
            className={CONDITION.SCREEN}
          />
        ) : (
          <ThresholdsForm quality={quality} thresholds={quality.thresholds} />
        )}
      </CardContent>
    </Card>
  );
}
