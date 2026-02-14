"use client";
import { useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  Activity,
  Zap,
  Radio,
  Signal,
  //   AlertCircle,
  Clock,
  ArrowUpDown,
  ListFilter,
} from "lucide-react";
// import { Alert, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { TbCircleCheckFilled, TbCircleXFilled } from "react-icons/tb";

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

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";

import { Switch } from "@/components/ui/switch";

const NetworkEventsCard = () => {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [loading] = useState(false);
  const [lastUpdate] = useState(new Date());
  const [maxEvents, setMaxEvents] = useState<number>(5);

  // Dummy data for network events
  const interpretations = [
    {
      interpretation:
        "LTE Band 66 detected with excellent signal strength (RSRP: -75 dBm)",
      datetime: "2026-02-14T10:30:00",
      category: "bandChanges",
      positive: true,
    },
    {
      interpretation: "Carrier Aggregation enabled: 2 carriers active (LTE-A)",
      datetime: "2026-02-14T10:28:15",
      category: "caEvents",
      positive: true,
    },
    {
      interpretation: "Signal quality improved: RSRQ changed from -12 to -8 dB",
      datetime: "2026-02-14T10:25:30",
      category: "networkEvents",
      positive: true,
    },
    {
      interpretation:
        "Switched from LTE Band 12 to Band 66 for better performance",
      datetime: "2026-02-14T10:20:45",
      category: "bandChanges",
      positive: true,
    },
    {
      interpretation: "5G NR connection established on n71 band",
      datetime: "2026-02-14T10:15:00",
      category: "networkEvents",
      positive: true,
    },
    {
      interpretation: "Carrier Aggregation disabled: Single carrier mode",
      datetime: "2026-02-14T10:10:20",
      category: "caEvents",
      positive: false,
    },
    {
      interpretation: "Network mode changed from 5G to LTE",
      datetime: "2026-02-14T10:05:10",
      category: "networkEvents",
      positive: false,
    },
    {
      interpretation: "LTE Band 4 frequency: 2155 MHz (EARFCN: 2300)",
      datetime: "2026-02-14T09:58:45",
      category: "bandChanges",
      positive: true,
    },
    {
      interpretation: "3-carrier aggregation detected: Bands 2+4+66",
      datetime: "2026-02-14T09:50:30",
      category: "caEvents",
      positive: true,
    },
    {
      interpretation: "Tower handoff completed: Cell ID changed",
      datetime: "2026-02-14T09:45:15",
      category: "networkEvents",
      positive: false,
    },
  ];

  // Helper function to format datetime
  const formatDateTime = (datetime: string) => {
    const dt = new Date(datetime);
    const date = dt.toLocaleDateString();
    const time = dt.toLocaleTimeString();
    return { date, time };
  };

  // Helper function to get event category
  const getEventCategory = (interpretation: string): string => {
    const lower = interpretation.toLowerCase();
    if (
      lower.includes("band") &&
      (lower.includes("switched") ||
        lower.includes("frequency") ||
        lower.includes("detected"))
    ) {
      return "bandChanges";
    }
    if (
      lower.includes("carrier aggregation") ||
      lower.includes("ca ") ||
      lower.includes("carriers")
    ) {
      return "caEvents";
    }
    return "networkEvents";
  };

  // Helper function to get event icon based on positive/negative
  const getEventIcon = (positive: boolean) => {
    return positive ? (
      <TbCircleCheckFilled className="w-6 h-6 text-green-500" />
    ) : (
      <TbCircleXFilled className="w-6 h-6 text-orange-500" />
    );
  };

  // Process interpretations based on active tab
  const filtered =
    activeTab === "all"
      ? interpretations
      : interpretations.filter(
          (i) => getEventCategory(i.interpretation) === activeTab,
        );
  const processedInterpretations = filtered.slice(0, maxEvents);

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Network Events</CardTitle>
        <CardDescription>
          Displays recent network events, such as connection changes, errors,
          and data usage.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <form className="grid gap-4">
            <FieldSet>
              <FieldGroup>
                <Field orientation="horizontal" className="w-fit">
                  <FieldLabel htmlFor="event-monitoring-setting">
                    Enable Event Monitoring
                  </FieldLabel>
                  <Switch id="event-monitoring-setting" />
                </Field>
              </FieldGroup>
            </FieldSet>
          </form>

          <div className="flex flex-col sm:py-4">
            <div className="grid flex-1 items-start gap-4 sm:py-0 md:gap-8">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="flex items-center">
                  <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="bandChanges">
                      {/* If screen size is md and up show this text, otherwise show icon */}
                      <span className="hidden md:inline">Band Changes</span>
                      <Radio className="md:hidden" />
                    </TabsTrigger>
                    <TabsTrigger value="caEvents">
                      <span className="hidden md:inline">CA Events</span>
                      <Zap className="md:hidden" />
                    </TabsTrigger>
                    <TabsTrigger value="networkEvents">
                      <span className="hidden md:inline">Network Events</span>
                      <Signal className="md:hidden" />
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
                            Sort
                          </span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuCheckboxItem
                        //   checked={sortOrder === "newest"}
                        //   onCheckedChange={() => setSortOrder("newest")}
                        >
                          Newest first
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                        //   checked={sortOrder === "oldest"}
                        //   onCheckedChange={() => setSortOrder("oldest")}
                        >
                          Oldest first
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                        //   checked={sortOrder === "type"}
                        //   onCheckedChange={() => setSortOrder("type")}
                        >
                          Event type
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
                            Limit
                          </span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Max Events</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuCheckboxItem
                          checked={maxEvents === 999}
                          onCheckedChange={() => setMaxEvents(999)}
                        >
                          All Events
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                          checked={maxEvents === 5}
                          onCheckedChange={() => setMaxEvents(5)}
                        >
                          5 Events
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                          checked={maxEvents === 25}
                          onCheckedChange={() => setMaxEvents(25)}
                        >
                          10 Events
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                          checked={maxEvents === 50}
                          onCheckedChange={() => setMaxEvents(50)}
                        >
                          15 Events
                        </DropdownMenuCheckboxItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button size="sm" variant="outline" className="h-7 gap-1">
                      <RefreshCw
                      // className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                      />
                      <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                        Refresh
                      </span>
                    </Button>
                  </div>
                </div>
                {/* {error && (
                  <Alert variant="destructive" className="my-4">
                    <div className="flex items-center gap-x-2">
                      <AlertCircle className="size-5" />
                      <AlertTitle>
                        Failed to load network insights: {error}
                      </AlertTitle>
                    </div>
                  </Alert>
                )} */}

                <TabsContent value="all">
                  <Card>
                    <CardHeader>
                      <CardTitle>Network Insights</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="hidden md:table-cell">
                              Event Type
                            </TableHead>
                            <TableHead>Interpretation</TableHead>
                            <TableHead>Date & Time</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loading && interpretations.length === 0 ? (
                            Array.from({ length: 5 }).map((_, i) => (
                              <TableRow key={i}>
                                <TableCell className="hidden md:table-cell">
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
                          ) : processedInterpretations.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={4}
                                className="text-center py-8"
                              >
                                <div className="flex flex-col items-center gap-2">
                                  <Activity className="h-8 w-8 text-muted-foreground" />
                                  <p className="text-sm text-muted-foreground">
                                    No network events found
                                  </p>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : (
                            processedInterpretations.map(
                              (interpretation, index) => {
                                const { date, time } = formatDateTime(
                                  interpretation.datetime,
                                );
                                return (
                                  <TableRow key={index}>
                                    <TableCell className="font-medium hidden md:table-cell">
                                      {getEventIcon(interpretation.positive)}
                                    </TableCell>
                                    <TableCell className="max-w-md">
                                      {interpretation.interpretation}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                      <div className="flex flex-col">
                                        <span className="text-sm">{date}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {time}
                                        </span>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              },
                            )
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                    <CardFooter className="flex justify-between items-center">
                      <div className="text-xs text-muted-foreground">
                        Showing{" "}
                        <strong>{processedInterpretations.length}</strong> of{" "}
                        <strong>{interpretations.length}</strong> event
                        {interpretations.length !== 1 ? "s" : ""}
                      </div>
                      {lastUpdate && (
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 mr-1" />
                          Last updated: {lastUpdate.toLocaleTimeString()}
                        </div>
                      )}
                    </CardFooter>
                  </Card>
                </TabsContent>
                <TabsContent value="bandChanges">
                  <Card>
                    <CardHeader>
                      <CardTitle>Band Changes</CardTitle>
                      <CardDescription>
                        Events related to cellular band changes and frequency
                        shifts.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="hidden md:table-cell">
                              Event Type
                            </TableHead>
                            <TableHead>Interpretation</TableHead>
                            <TableHead>Date & Time</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loading && interpretations.length === 0 ? (
                            Array.from({ length: 5 }).map((_, i) => (
                              <TableRow key={i}>
                                <TableCell className="hidden md:table-cell">
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
                          ) : processedInterpretations.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={4}
                                className="text-center py-8"
                              >
                                <div className="flex flex-col items-center gap-2">
                                  <Radio className="h-8 w-8 text-muted-foreground" />
                                  <p className="text-sm text-muted-foreground">
                                    No band change events found
                                  </p>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : (
                            processedInterpretations.map(
                              (interpretation, index) => {
                                const { date, time } = formatDateTime(
                                  interpretation.datetime,
                                );

                                return (
                                  <TableRow key={index}>
                                    <TableCell className="font-medium hidden md:table-cell">
                                      {getEventIcon(interpretation.positive)}
                                    </TableCell>
                                    <TableCell className="max-w-md">
                                      {interpretation.interpretation}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                      <div className="flex flex-col">
                                        <span className="text-sm">{date}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {time}
                                        </span>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              },
                            )
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                    <CardFooter className="flex justify-between items-center">
                      <div className="text-xs text-muted-foreground">
                        Showing{" "}
                        <strong>{processedInterpretations.length}</strong> of{" "}
                        <strong>
                          {
                            interpretations.filter(
                              (i) =>
                                getEventCategory(i.interpretation) ===
                                "bandChanges",
                            ).length
                          }
                        </strong>{" "}
                        event
                        {interpretations.filter(
                          (i) =>
                            getEventCategory(i.interpretation) ===
                            "bandChanges",
                        ).length !== 1
                          ? "s"
                          : ""}
                      </div>
                      {lastUpdate && (
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 mr-1" />
                          Last updated: {lastUpdate.toLocaleTimeString()}
                        </div>
                      )}
                    </CardFooter>
                  </Card>
                </TabsContent>
                <TabsContent value="caEvents">
                  <Card>
                    <CardHeader>
                      <CardTitle>Carrier Aggregation Events</CardTitle>
                      <CardDescription>
                        Events related to carrier aggregation changes and
                        multi-carrier operations.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="hidden md:table-cell">
                              Event Type
                            </TableHead>
                            <TableHead>Interpretation</TableHead>
                            <TableHead>Date & Time</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loading && interpretations.length === 0 ? (
                            Array.from({ length: 5 }).map((_, i) => (
                              <TableRow key={i}>
                                <TableCell className="hidden md:table-cell">
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
                          ) : processedInterpretations.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={4}
                                className="text-center py-8"
                              >
                                <div className="flex flex-col items-center gap-2">
                                  <Zap className="h-8 w-8 text-muted-foreground" />
                                  <p className="text-sm text-muted-foreground">
                                    No CA events found
                                  </p>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : (
                            processedInterpretations.map(
                              (interpretation, index) => {
                                const { date, time } = formatDateTime(
                                  interpretation.datetime,
                                );

                                return (
                                  <TableRow key={index}>
                                    <TableCell className="font-medium hidden md:table-cell">
                                      {getEventIcon(interpretation.positive)}
                                    </TableCell>
                                    <TableCell className="max-w-md">
                                      {interpretation.interpretation}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                      <div className="flex flex-col">
                                        <span className="text-sm">{date}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {time}
                                        </span>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              },
                            )
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                    <CardFooter className="flex justify-between items-center">
                      <div className="text-xs text-muted-foreground">
                        Showing{" "}
                        <strong>{processedInterpretations.length}</strong> of{" "}
                        <strong>
                          {
                            interpretations.filter(
                              (i) =>
                                getEventCategory(i.interpretation) ===
                                "caEvents",
                            ).length
                          }
                        </strong>{" "}
                        event
                        {interpretations.filter(
                          (i) =>
                            getEventCategory(i.interpretation) === "caEvents",
                        ).length !== 1
                          ? "s"
                          : ""}
                      </div>
                      {lastUpdate && (
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 mr-1" />
                          Last updated: {lastUpdate.toLocaleTimeString()}
                        </div>
                      )}
                    </CardFooter>
                  </Card>
                </TabsContent>
                <TabsContent value="networkEvents">
                  <Card>
                    <CardHeader>
                      <CardTitle>Network Events</CardTitle>
                      <CardDescription>
                        Signal quality changes and network mode transitions.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="hidden md:table-cell">
                              Event Type
                            </TableHead>
                            <TableHead>Interpretation</TableHead>
                            <TableHead>Date & Time</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loading && interpretations.length === 0 ? (
                            Array.from({ length: 5 }).map((_, i) => (
                              <TableRow key={i}>
                                <TableCell className="hidden md:table-cell">
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
                          ) : processedInterpretations.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={4}
                                className="text-center py-8"
                              >
                                <div className="flex flex-col items-center gap-2">
                                  <Signal className="h-8 w-8 text-muted-foreground" />
                                  <p className="text-sm text-muted-foreground">
                                    No network events found
                                  </p>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : (
                            processedInterpretations.map(
                              (interpretation, index) => {
                                const { date, time } = formatDateTime(
                                  interpretation.datetime,
                                );

                                return (
                                  <TableRow key={index}>
                                    <TableCell className="font-medium hidden md:table-cell">
                                      {getEventIcon(interpretation.positive)}
                                    </TableCell>
                                    <TableCell className="max-w-md">
                                      {interpretation.interpretation}
                                    </TableCell>
                                    <TableCell className=" whitespace-nowrap">
                                      <div className="flex flex-col">
                                        <span className="text-sm">{date}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {time}
                                        </span>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              },
                            )
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                    <CardFooter className="flex justify-between items-center">
                      <div className="text-xs text-muted-foreground">
                        Showing{" "}
                        <strong>{processedInterpretations.length}</strong> of{" "}
                        <strong>
                          {
                            interpretations.filter(
                              (i) =>
                                getEventCategory(i.interpretation) ===
                                "networkEvents",
                            ).length
                          }
                        </strong>{" "}
                        event
                        {interpretations.filter(
                          (i) =>
                            getEventCategory(i.interpretation) ===
                            "networkEvents",
                        ).length !== 1
                          ? "s"
                          : ""}
                      </div>
                      {lastUpdate && (
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 mr-1" />
                          Last updated: {lastUpdate.toLocaleTimeString()}
                        </div>
                      )}
                    </CardFooter>
                  </Card>
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
