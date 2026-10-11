"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useChartSeriesMotion } from "@/hooks/use-chart-motion";
import { cn } from "@/lib/utils";
import type { NetworkEvent } from "@/types/modem-status";

import { useEventsCopy, useEventsPlural, useSpanText } from "./copy";
import { bucketEvents, describeWindow } from "./derive";
import {
  ACTIVITY,
  ACTIVITY_SERIES_COLOR,
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
  const seriesMotion = useChartSeriesMotion();

  const buckets = React.useMemo(
    () => bucketEvents(events, nowSec),
    [events, nowSec],
  );

  const chartConfig = React.useMemo(
    () =>
      ({
        problems: {
          label: c("networkEvents.activity.problems"),
          color: ACTIVITY_SERIES_COLOR.problems,
        },
        recoveries: {
          label: c("networkEvents.activity.recoveries"),
          color: ACTIVITY_SERIES_COLOR.recoveries,
        },
        routine: {
          label: c("networkEvents.activity.routine"),
          color: ACTIVITY_SERIES_COLOR.routine,
        },
      }) satisfies ChartConfig,
    [c],
  );

  const chartData = React.useMemo(
    () =>
      buckets.columns.map((column) => ({
        endSec: column.endSec,
        startSec: column.startSec,
        total: column.total,
        problems: column.counts.error + column.counts.warning,
        recoveries: column.counts.success,
        routine: column.counts.routine,
      })),
    [buckets],
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
            <Skeleton className={cn(ACTIVITY.LEGEND_LINE, "mx-auto w-64")} />
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

  return (
    <Card className={CARD_SHELL}>
      <CardHeader className={CARD_PAD}>
        {title}
        <CardDescription className={CARD_DESC}>{description}</CardDescription>
      </CardHeader>
      <CardContent className={cn(CARD_PAD, CARD_FILL)}>
        <div className={ACTIVITY.BODY}>
          <div className={ACTIVITY.CHART}>
            <ChartContainer
              config={chartConfig}
              aria-label={c("networkEvents.activity.chart_aria")}
              className={cn(ACTIVITY.PLOT, ACTIVITY.TICK_INK)}
            >
              <BarChart
                accessibilityLayer
                data={chartData}
                margin={{ top: 4 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="endSec"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={28}
                  interval="preserveStartEnd"
                  tickFormatter={(value: number) =>
                    value === nowSec
                      ? c("networkEvents.activity.now")
                      : clockTime(value)
                  }
                />
                <YAxis
                  width={ACTIVITY.AXIS_W}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={4}
                  allowDecimals={false}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_label, items) => {
                        const row = items?.[0]?.payload as
                          | (typeof chartData)[number]
                          | undefined;
                        return row
                          ? p("networkEvents.activity.column", row.total, {
                              from: clockTime(row.startSec),
                              to: clockTime(row.endSec),
                            })
                          : null;
                      }}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar
                  dataKey="problems"
                  stackId="events"
                  fill="var(--color-problems)"
                  radius={[0, 0, 4, 4]}
                  {...seriesMotion}
                />
                <Bar
                  dataKey="recoveries"
                  stackId="events"
                  fill="var(--color-recoveries)"
                  {...seriesMotion}
                />
                <Bar
                  dataKey="routine"
                  stackId="events"
                  fill="var(--color-routine)"
                  radius={[4, 4, 0, 0]}
                  {...seriesMotion}
                />
              </BarChart>
            </ChartContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
