"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CircleCheckIcon,
  RefreshCcwIcon,
  AlertTriangleIcon,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const CGI_ENDPOINT = "/cgi-bin/quecmanager/cellular/fplmn.sh";

const FPLMNCard = () => {
  const [hasEntries, setHasEntries] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch FPLMN status
  // ---------------------------------------------------------------------------
  const fetchStatus = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);

    try {
      const resp = await fetch(CGI_ENDPOINT);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data = await resp.json();
      if (!mountedRef.current) return;

      if (data.success) {
        setHasEntries(data.has_entries);
      }
    } catch {
      // silently fail — keep current state
    } finally {
      if (mountedRef.current && !silent) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ---------------------------------------------------------------------------
  // Clear FPLMN list
  // ---------------------------------------------------------------------------
  const handleClear = async () => {
    setIsClearing(true);

    try {
      const resp = await fetch(CGI_ENDPOINT, { method: "POST" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data = await resp.json();
      if (!mountedRef.current) return;

      if (data.success) {
        toast.success("FPLMN list cleared");
        await fetchStatus(true);
      } else {
        toast.error(data.detail || "Failed to clear FPLMN list");
      }
    } catch {
      if (mountedRef.current) {
        toast.error("Failed to clear FPLMN list");
      }
    } finally {
      if (mountedRef.current) {
        setIsClearing(false);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>FPLMN Status</CardTitle>
          <CardDescription>
            The FPLMN list stores networks that your device has been unable to
            connect to. Clearing this list may improve network connectivity and
            roaming performance.
            <a
              href="https://onomondo.com/blog/how-to-clear-the-fplmn-list-on-a-sim/"
              target="_blank"
              rel="noreferrer"
              className="underline ml-1 text-primary hover:text-primary/80"
            >
              Learn more
            </a>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-9 w-36" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>FPLMN Status</CardTitle>
        <CardDescription>
          The FPLMN list stores networks that your device has been unable to
          connect to. Clearing this list may improve network connectivity and
          roaming performance.
          <a
            href="https://onomondo.com/blog/how-to-clear-the-fplmn-list-on-a-sim/"
            target="_blank"
            rel="noreferrer"
            className="underline ml-1 text-primary hover:text-primary/80"
          >
            Learn more
          </a>
          .
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasEntries ? (
          <Empty className="bg-destructive/5 h-full">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="bg-destructive rounded-xl">
                <AlertTriangleIcon className="text-destructive-foreground w-6 h-6" />
              </EmptyMedia>
              <EmptyTitle>FPLMN Entries Detected</EmptyTitle>
              <EmptyDescription className="max-w-xs text-pretty">
                The forbidden network list contains entries that may be blocking
                network connectivity. Clearing is recommended.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                variant="destructive"
                onClick={handleClear}
                disabled={isClearing}
              >
                {isClearing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  "Clear FPLMN List"
                )}
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <Empty className="bg-muted/30 h-full">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="bg-primary rounded-xl">
                <CircleCheckIcon className="text-primary-foreground w-6 h-6" />
              </EmptyMedia>
              <EmptyTitle>FPLMN List is Clean</EmptyTitle>
              <EmptyDescription className="max-w-xs text-pretty">
                The forbidden network list is empty and does not need clearing.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" onClick={() => fetchStatus()}>
                <RefreshCcwIcon />
                Refresh Status
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
};

export default FPLMNCard;
