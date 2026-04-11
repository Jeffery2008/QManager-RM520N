"use client";

import { useState, useMemo, useEffect, type ReactNode } from "react";
import { motion } from "motion/react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  Activity,
  Wifi,
  Radio,
  Signal,
  AlertCircle,
  BellOff,
  Clock,
  ArrowUpDown,
  ListFilter,
} from "lucide-react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { TbAlertTriangleFilled, TbCircleCheckFilled, TbCircleXFilled } from "react-icons/tb";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const MotionTableRow = motion.create(TableRow);

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";

import { useRecentActivities } from "@/hooks/use-recent-activities";
import {
  EVENT_LABELS,
  EVENT_TAB_CATEGORIES,
  translateEventMessage,
} from "@/constants/network-events";
import type { NetworkEvent, EventSeverity } from "@/types/modem-status";

// --- Constants ---------------------------------------------------------------

type SortOrder = "newest" | "oldest" | "type";

const LIMIT_OPTIONS = [
  { label: "全部事件", value: 50 },
  { label: "10 条事件", value: 10 },
  { label: "25 条事件", value: 25 },
] as const;

// --- Local helpers -----------------------------------------------------------

function SeverityIcon({ severity }: { severity: EventSeverity }) {
  if (severity === "error") {
    return <TbCircleXFilled className="size-6 text-destructive" />;
  }
  if (severity === "warning") {
    return <TbAlertTriangleFilled className="size-6 text-warning" />;
  }
  return <TbCircleCheckFilled className="size-6 text-success" />;
}

function formatEventDateTime(timestamp: number) {
  const dt = new Date(timestamp * 1000);
  return {
    date: dt.toLocaleDateString(),
    time: dt.toLocaleTimeString(),
  };
}

// --- Shared table sub-component ----------------------------------------------

interface EventsTableProps {
  events: NetworkEvent[];
  isLoading: boolean;
  emptyIcon: ReactNode;
  emptyMessage: string;
  totalCount: number;
  lastUpdate: Date | null;
}

function EventsTable({
  events,
  isLoading,
  emptyIcon,
  emptyMessage,
  totalCount,
  lastUpdate,
}: EventsTableProps) {
  return (
    <>
      <Table>
        <TableHeader>
            <TableRow>
            <TableHead className="hidden @md/card:table-cell">事件类型</TableHead>
            <TableHead>内容</TableHead>
            <TableHead>日期与时间</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && events.length === 0 ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell className="hidden @md/card:table-cell">
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
              </TableRow>
            ))
          ) : events.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center py-8">
                <div className="flex flex-col items-center gap-2">
                  {emptyIcon}
                  <p className="text-sm text-muted-foreground">
                    {emptyMessage}
                  </p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            events.map((event, index) => {
              const { date, time } = formatEventDateTime(event.timestamp);
              const label = EVENT_LABELS[event.type] ?? event.type;
              return (
                <MotionTableRow
                  key={`${event.timestamp}-${event.type}-${index}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(index * 0.04, 0.4), ease: "easeOut" }}
                >
                  <TableCell className="font-medium hidden @md/card:table-cell">
                    <div className="flex items-center gap-2">
                      <SeverityIcon severity={event.severity} />
                      <span className="text-xs text-muted-foreground">
                        {label}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-md">
                    {translateEventMessage(event.message)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-sm">{date}</span>
                      <span className="text-xs text-muted-foreground">
                        {time}
                      </span>
                    </div>
                  </TableCell>
                </MotionTableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      <div className="flex justify-between items-center pt-4">
        <div className="text-xs text-muted-foreground">
          显示 <strong>{events.length}</strong> /{" "}
          <strong>{totalCount}</strong> 条事件
        </div>
        {lastUpdate && (
          <div className="flex items-center text-xs text-muted-foreground">
            <Clock className="h-3 w-3 mr-1" />
            最后更新：{lastUpdate.toLocaleTimeString("zh-CN")}
          </div>
        )}
      </div>
    </>
  );
}

// --- Main component ----------------------------------------------------------

const NetworkEventsCard = () => {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [maxEvents, setMaxEvents] = useState<number>(50);
  const [monitoringEnabled, setMonitoringEnabled] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const { events, isLoading, isRefreshing, error, refresh } =
    useRecentActivities({
      maxEvents: 50,
      enabled: monitoringEnabled,
    });

  // Track last successful data update
  useEffect(() => {
    if (events.length > 0) {
      setLastUpdate(new Date());
    }
  }, [events]);

  // Filter by tab category
  const filteredEvents = useMemo(() => {
    if (activeTab === "all") return events;
    return events.filter((e) => EVENT_TAB_CATEGORIES[e.type] === activeTab);
  }, [events, activeTab]);

  // Sort
  const sortedEvents = useMemo(() => {
    const arr = [...filteredEvents];
    switch (sortOrder) {
      case "oldest":
        return arr.reverse();
      case "type":
        return arr.sort((a, b) => a.type.localeCompare(b.type));
      case "newest":
      default:
        return arr;
    }
  }, [filteredEvents, sortOrder]);

  // Apply display limit
  const displayedEvents = sortedEvents.slice(0, maxEvents);

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>网络事件</CardTitle>
        <CardDescription>
          最近的网络事件，包括频段变化、连接中断和信号变化。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <form className="grid gap-4">
            <FieldSet>
              <FieldGroup>
                <Field orientation="horizontal" className="w-fit">
                  <FieldLabel htmlFor="event-monitoring-setting">
                    自动刷新
                  </FieldLabel>
                  <Switch
                    id="event-monitoring-setting"
                    checked={monitoringEnabled}
                    onCheckedChange={setMonitoringEnabled}
                  />
                </Field>
              </FieldGroup>
            </FieldSet>
          </form>

          {!monitoringEnabled && (
            <Alert>
              <BellOff className="size-4" />
              <AlertTitle>
                Auto-refresh paused — displaying events as of{" "}
                {lastUpdate ? lastUpdate.toLocaleTimeString("zh-CN") : "上次获取"}。
              </AlertTitle>
            </Alert>
          )}

          <div className="flex flex-col sm:py-4">
            <div className="grid flex-1 items-start gap-4 sm:py-0 md:gap-8">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="flex items-center">
                  <TabsList>
                    <TabsTrigger value="all">全部</TabsTrigger>
                    <TabsTrigger value="bandChanges">
                      <span className="hidden @sm/card:inline">频段变化</span>
                      <Radio className="@sm/card:hidden" />
                    </TabsTrigger>
                    <TabsTrigger value="networkMode">
                      <span className="hidden @sm/card:inline">网络模式</span>
                      <Signal className="@sm/card:hidden" />
                    </TabsTrigger>
                    <TabsTrigger value="dataConnection">
                      <span className="hidden @sm/card:inline">数据连接</span>
                      <Wifi className="@sm/card:hidden" />
                    </TabsTrigger>
                  </TabsList>
                  <div className="ml-auto flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1"
                        >
                          <ArrowUpDown className="h-3.5 w-3.5" />
                          <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                            排序
                          </span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>排序方式</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuCheckboxItem
                          checked={sortOrder === "newest"}
                          onCheckedChange={() => setSortOrder("newest")}
                        >
                          最新优先
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                          checked={sortOrder === "oldest"}
                          onCheckedChange={() => setSortOrder("oldest")}
                        >
                          最早优先
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                          checked={sortOrder === "type"}
                          onCheckedChange={() => setSortOrder("type")}
                        >
                          按事件类型
                        </DropdownMenuCheckboxItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1"
                        >
                          <ListFilter className="h-3.5 w-3.5" />
                          <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                            数量
                          </span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>最大事件数</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {LIMIT_OPTIONS.map((opt) => (
                          <DropdownMenuCheckboxItem
                            key={opt.value}
                            checked={maxEvents === opt.value}
                            onCheckedChange={() => setMaxEvents(opt.value)}
                          >
                            {opt.label}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1"
                      onClick={refresh}
                      disabled={isRefreshing || !monitoringEnabled}
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
                      />
                      <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                        刷新
                      </span>
                    </Button>
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive" className="my-4">
                    <div className="flex items-center gap-x-2">
                      <AlertCircle className="size-5" />
                      <AlertTitle>
                        加载网络事件失败：{error}
                      </AlertTitle>
                    </div>
                  </Alert>
                )}

                <TabsContent value="all">
                  <EventsTable
                    events={displayedEvents}
                    isLoading={isLoading}
                    emptyIcon={
                      <Activity className="h-8 w-8 text-muted-foreground" />
                    }
                    emptyMessage="未找到网络事件"
                    totalCount={filteredEvents.length}
                    lastUpdate={lastUpdate}
                  />
                </TabsContent>

                <TabsContent value="bandChanges">
                  <div className="grid gap-1.5 mb-4">
                    <h3 className="text-sm font-medium">频段变化</h3>
                    <p className="text-sm text-muted-foreground">
                      频段变化、小区切换、5G 锚点切换和载波聚合事件。
                    </p>
                  </div>
                  <EventsTable
                    events={displayedEvents}
                    isLoading={isLoading}
                    emptyIcon={
                      <Radio className="h-8 w-8 text-muted-foreground" />
                    }
                    emptyMessage="未找到频段变化事件"
                    totalCount={filteredEvents.length}
                    lastUpdate={lastUpdate}
                  />
                </TabsContent>

                <TabsContent value="networkMode">
                  <div className="grid gap-1.5 mb-4">
                    <h3 className="text-sm font-medium">网络模式</h3>
                    <p className="text-sm text-muted-foreground">
                      信号质量变化和网络模式切换。
                    </p>
                  </div>
                  <EventsTable
                    events={displayedEvents}
                    isLoading={isLoading}
                    emptyIcon={
                      <Signal className="h-8 w-8 text-muted-foreground" />
                    }
                    emptyMessage="未找到网络模式事件"
                    totalCount={filteredEvents.length}
                    lastUpdate={lastUpdate}
                  />
                </TabsContent>

                <TabsContent value="dataConnection">
                  <div className="grid gap-1.5 mb-4">
                    <h3 className="text-sm font-medium">数据连接</h3>
                    <p className="text-sm text-muted-foreground">
                      互联网连接、延迟和丢包相关事件。
                    </p>
                  </div>
                  <EventsTable
                    events={displayedEvents}
                    isLoading={isLoading}
                    emptyIcon={
                      <Wifi className="h-8 w-8 text-muted-foreground" />
                    }
                    emptyMessage="未找到数据连接事件"
                    totalCount={filteredEvents.length}
                    lastUpdate={lastUpdate}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default NetworkEventsCard;
