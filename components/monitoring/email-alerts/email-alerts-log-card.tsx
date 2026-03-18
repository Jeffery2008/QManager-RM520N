"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth-fetch";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { motion } from "motion/react";

const MotionTableRow = motion.create(TableRow);

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCcwIcon, Clock, MailIcon, AlertCircle } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

// =============================================================================
// EmailAlertsLogCard — Self-contained log of sent/failed email alerts
// =============================================================================

const CGI_ENDPOINT = "/cgi-bin/quecmanager/monitoring/email_alert_log.sh";

interface EmailLogEntry {
  timestamp: string;
  trigger: string;
  status: "sent" | "failed";
  recipient: string;
}

interface EmailLogResponse {
  success: boolean;
  entries: EmailLogEntry[];
  total: number;
  error?: string;
}

interface EmailAlertsLogCardProps {
  refreshKey?: number;
}

const EmailAlertsLogCard = ({ refreshKey }: EmailAlertsLogCardProps) => {
  const [entries, setEntries] = useState<EmailLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch log entries
  // ---------------------------------------------------------------------------
  const fetchLog = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setFetchError(null);

    try {
      const resp = await authFetch(CGI_ENDPOINT);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data: EmailLogResponse = await resp.json();
      if (!mountedRef.current) return;

      if (data.success) {
        setEntries(data.entries);
        setTotal(data.total);
        setLastFetched(new Date());
      } else {
        const msg = data.error || "Failed to load email log";
        setFetchError(msg);
        if (!silent) toast.error(msg);
      }
    } catch (err) {
      if (mountedRef.current) {
        const msg = err instanceof Error ? err.message : "Failed to load email alert log";
        setFetchError(msg);
        if (!silent) toast.error(msg);
      }
    } finally {
      if (mountedRef.current && !silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  // Re-fetch when parent signals a refresh (e.g. after sending a test email)
  useEffect(() => {
    if (refreshKey) {
      fetchLog(true);
    }
  }, [refreshKey, fetchLog]);

  // --- Loading skeleton ------------------------------------------------------
  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Alert Log</CardTitle>
          <CardDescription>
            History of sent and failed email alerts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <div className="border-b px-4 py-3">
              <div className="flex gap-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-14" />
              </div>
            </div>
            <div className="divide-y">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-12 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Error state (initial fetch failed) ------------------------------------
  if (!isLoading && fetchError && entries.length === 0) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Alert Log</CardTitle>
          <CardDescription>
            History of sent and failed email alerts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Failed to load alert log</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>{fetchError}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchLog()}
              >
                <RefreshCcwIcon className="size-3.5" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // --- Render ----------------------------------------------------------------
  return (
    <Card className="@container/card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Alert Log</CardTitle>
            <CardDescription>
              History of sent and failed email alerts.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="icon"
            aria-label="Refresh alert log"
            onClick={() => fetchLog()}
          >
            <RefreshCcwIcon className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">Timestamp</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="hidden @md/card:table-cell">
                  Recipient
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody aria-live="polite" aria-relevant="additions">
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <MailIcon className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        No alerts sent yet
                      </p>
                      <p className="text-xs text-muted-foreground/70 max-w-xs text-center">
                        Alerts appear here when your connection drops past the
                        configured threshold. Use Send Test Email to verify your
                        setup.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry, index) => (
                  <MotionTableRow
                    key={`${entry.timestamp}-${index}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(index * 0.04, 0.4), ease: "easeOut" }}
                  >
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {entry.timestamp}
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.trigger}
                      <span className="block text-xs text-muted-foreground @md/card:hidden">
                        {entry.recipient}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          entry.status === "sent" ? "default" : "destructive"
                        }
                        className={
                          entry.status === "sent"
                            ? "bg-success text-success-foreground border-success"
                            : ""
                        }
                      >
                        {entry.status === "sent" ? "Sent" : "Failed"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden @md/card:table-cell text-sm text-muted-foreground">
                      {entry.recipient}
                    </TableCell>
                  </MotionTableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      {entries.length > 0 && (
        <CardFooter className="flex justify-between items-center">
          <div className="text-xs text-muted-foreground">
            Showing <strong>{entries.length}</strong> of{" "}
            <strong>{total}</strong> entries
          </div>
          {lastFetched && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="size-3" />
              Last updated: {lastFetched.toLocaleTimeString()}
            </div>
          )}
        </CardFooter>
      )}
    </Card>
  );
};

export default EmailAlertsLogCard;
