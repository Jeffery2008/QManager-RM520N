"use client";

import * as React from "react";
import {
  ArrowRightLeftIcon,
  CheckCircle2Icon,
  TriangleAlertIcon,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { NetworkEvent } from "@/types/modem-status";

import { useEventsCopy, useEventsPlural, useSpanText } from "./copy";
import { bucketEvents, describeWindow } from "./derive";
import {
  ACTIVITY,
  ACTIVITY_SEGMENT_TONE,
  ACTIVITY_STACK_ORDER,
  CARD_DESC,
  CARD_DESC_LINE,
  CARD_FILL,
  CARD_PAD,
  CARD_SHELL,
  CARD_TITLE,
} from "./shapes";

export interface ActivityCardProps {
  events: NetworkEvent[];
  nowSec: number;
  isLoading: boolean;
  clockTime: (timestamp: number) => string;
}

/** When things happened, across the served window only. */
export function ActivityCard({
  events,
  nowSec,
  isLoading,
  clockTime,
}: ActivityCardProps) {
  const c = useEventsCopy();
  const p = useEventsPlural();
  const spanText = useSpanText();

  const buckets = React.useMemo(
    () => bucketEvents(events, nowSec),
    [events, nowSec],
  );

  const title = (
    <CardTitle className={CARD_TITLE}>{c("networkEvents.activity.title")}</CardTitle>
  );

  if (isLoading) {
    return (
      <Card className={CARD_SHELL}>
        <CardHeader className={CARD_PAD}>
          {title}
          <Skeleton className={cn(CARD_DESC_LINE, "w-56")} />
        </CardHeader>
        <CardContent className={cn(CARD_PAD, CARD_FILL)}>
          <div className={ACTIVITY.BODY} aria-hidden>
            <Skeleton className={cn(ACTIVITY.CHART, "rounded-inline")} />
            <Skeleton className={cn(ACTIVITY.AXIS_LINE, "w-full")} />
            <Skeleton className={cn(ACTIVITY.LEGEND_LINE, "w-64")} />
          </div>
        </CardContent>
      </Card>
    );
  }

  const served = describeWindow(events, nowSec);
  const description =
    served.kind === "empty"
      ? c("networkEvents.activity.window_empty")
      : served.kind === "all"
        ? p("networkEvents.activity.window_all", served.count)
        : p("networkEvents.activity.window_last", served.count, {
            span: spanText(served.spanSec),
          });
  const empty = events.length === 0;

  return (
    <Card className={CARD_SHELL}>
      <CardHeader className={CARD_PAD}>
        {title}
        <CardDescription className={CARD_DESC}>{description}</CardDescription>
      </CardHeader>
      <CardContent className={cn(CARD_PAD, CARD_FILL)}>
        <div className={ACTIVITY.BODY}>
          <div
            className={ACTIVITY.CHART}
            role="group"
            aria-label={c("networkEvents.activity.chart_aria")}
          >
            {buckets.columns.map((column) => {
              const tip = p("networkEvents.activity.column", column.total, {
                from: clockTime(column.startSec),
                to: clockTime(column.endSec),
              });
              return (
                <span
                  key={column.endSec}
                  role="img"
                  aria-label={tip}
                  title={tip}
                  className={ACTIVITY.COLUMN}
                >
                  {column.total === 0 ? (
                    <i className={ACTIVITY.BASELINE} />
                  ) : (
                    ACTIVITY_STACK_ORDER.map((tone) =>
                      column.counts[tone] > 0 ? (
                        <i
                          key={tone}
                          className={cn(
                            ACTIVITY.SEGMENT,
                            ACTIVITY_SEGMENT_TONE[tone],
                          )}
                          style={{
                            height: `${(column.counts[tone] / buckets.max) * 100}%`,
                          }}
                        />
                      ) : null,
                    )
                  )}
                </span>
              );
            })}
          </div>

          <div className={ACTIVITY.AXIS}>
            <span>{empty ? "" : clockTime(buckets.startSec)}</span>
            <span>{c("networkEvents.activity.now")}</span>
          </div>

          {empty ? null : (
            <div className={ACTIVITY.LEGEND}>
              <span className={ACTIVITY.LEGEND_ITEM}>
                <TriangleAlertIcon
                  aria-hidden
                  className={cn(ACTIVITY.LEGEND_GLYPH, ACTIVITY.LEGEND_PROBLEM)}
                />
                {c("networkEvents.activity.problems")}
                <span className={ACTIVITY.LEGEND_VALUE}>{buckets.problems}</span>
              </span>
              <span className={ACTIVITY.LEGEND_ITEM}>
                <CheckCircle2Icon
                  aria-hidden
                  className={cn(ACTIVITY.LEGEND_GLYPH, ACTIVITY.LEGEND_RECOVERY)}
                />
                {c("networkEvents.activity.recoveries")}
                <span className={ACTIVITY.LEGEND_VALUE}>
                  {buckets.recoveries}
                </span>
              </span>
              <span className={ACTIVITY.LEGEND_ITEM}>
                <ArrowRightLeftIcon aria-hidden className={ACTIVITY.LEGEND_GLYPH} />
                {c("networkEvents.activity.routine")}
                <span className={ACTIVITY.LEGEND_VALUE}>{buckets.routine}</span>
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
