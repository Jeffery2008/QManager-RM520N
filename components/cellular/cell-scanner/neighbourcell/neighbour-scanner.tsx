"use client";

import { useState, useCallback } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DownloadIcon, LoaderCircleIcon, RefreshCcwIcon } from "lucide-react";
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
import { toast } from "sonner";
import ScannerEmptyView from "@/components/cellular/cell-scanner/empty-view";
import NeighbourScanResultView, {
  type NeighbourCellResult,
} from "./neighbour-scan-result";
import { useNeighbourScanner } from "@/hooks/use-neighbour-scanner";

// --- CSV Export Utility ------------------------------------------------------
function downloadCSV(results: NeighbourCellResult[]) {
  const header = "Network,Cell Type,Frequency,PCI,Signal (dBm),RSRQ,RSSI,SINR";
  const rows = results.map((r) =>
    [
      r.networkType,
      r.cellType,
      r.frequency,
      r.pci,
      r.signalStrength,
      r.rsrq ?? "",
      r.rssi ?? "",
      r.sinr ?? "",
    ].join(","),
  );
  const csvContent = [header, ...rows].join("\r\n");
  const filename = `neighbour_scan_${new Date().toISOString().slice(0, 10)}.csv`;

  const encodedUri =
    "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// --- Skeleton Loading State --------------------------------------------------
function ScannerSkeleton() {
  return (
    <div className="space-y-3">
      {/* Filter bar skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-64 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      {/* Table skeleton */}
      <div className="rounded-lg border overflow-hidden">
        {/* Header */}
        <div className="bg-muted px-4 py-3 flex gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1 rounded" />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: 5 }).map((_, rowIdx) => (
          <div key={rowIdx} className="px-4 py-3 flex gap-4 border-t">
            <Skeleton className="h-5 w-12 rounded-full" />
            {Array.from({ length: 4 }).map((_, colIdx) => (
              <Skeleton key={colIdx} className="h-4 flex-1 rounded" />
            ))}
          </div>
        ))}
      </div>
      {/* Footer skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
      </div>
    </div>
  );
}

const NeighbourCellScanner = () => {
  const { status, results, error, startScan } = useNeighbourScanner();
  const [lockTarget, setLockTarget] = useState<NeighbourCellResult | null>(
    null,
  );
  const [isLocking, setIsLocking] = useState(false);

  const hasScanResults = status === "complete" && results.length > 0;
  const isScanning = status === "running";

  // --- Lock Cell Handler -----------------------------------------------------
  const handleLockCell = useCallback((cell: NeighbourCellResult) => {
    setLockTarget(cell);
  }, []);

  const confirmLockCell = useCallback(async () => {
    if (!lockTarget) return;
    setIsLocking(true);

    try {
      const body = {
        type: "lte",
        action: "lock",
        cells: [{ earfcn: lockTarget.frequency, pci: lockTarget.pci }],
      };

      const res = await fetch("/cgi-bin/quecmanager/tower/lock.sh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.success) {
        toast.success("Cell Locked", {
          description: `Locked to LTE PCI ${lockTarget.pci} on EARFCN ${lockTarget.frequency}`,
        });
      } else {
        toast.error("Lock Failed", {
          description: data.detail || data.error || "Unknown error",
        });
      }
    } catch {
      toast.error("Lock Failed", {
        description: "Failed to connect to modem",
      });
    } finally {
      setIsLocking(false);
      setLockTarget(null);
    }
  }, [lockTarget]);

  return (
    <>
      <Card className="@container/card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Neighbor Cell Scanner</CardTitle>
              <CardDescription>
                Scan and display neighboring cellular towers and networks.
              </CardDescription>
            </div>
            {isScanning && (
              <Badge
                variant="outline"
                className="animate-pulse text-primary border-primary/50"
              >
                <LoaderCircleIcon className="h-3 w-3 animate-spin" />
                Scanning...
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {hasScanResults ? (
              <NeighbourScanResultView
                data={results}
                onLockCell={handleLockCell}
              />
            ) : isScanning ? (
              <ScannerSkeleton />
            ) : status === "error" ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <p className="text-destructive text-sm">
                  {error || "Scan failed"}
                </p>
                <Button onClick={startScan} variant="outline" size="sm">
                  <RefreshCcwIcon className="mr-1 size-4" />
                  Retry
                </Button>
              </div>
            ) : (
              <ScannerEmptyView onStartScan={startScan} />
            )}
          </div>
          {(hasScanResults || isScanning) && (
            <div className="mt-4 flex items-center gap-x-2">
              <Button onClick={startScan} disabled={isScanning}>
                {isScanning ? (
                  <>
                    <LoaderCircleIcon className="size-4 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  "Start New Scan"
                )}
              </Button>
              {hasScanResults && (
                <Button
                  variant="outline"
                  onClick={() => downloadCSV(results)}
                  title="Download CSV"
                >
                  <DownloadIcon />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lock confirmation dialog */}
      <AlertDialog
        open={!!lockTarget}
        onOpenChange={(open) => !open && setLockTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lock to Cell?</AlertDialogTitle>
            <AlertDialogDescription>
              This will lock the modem to the following cell. The modem will
              only connect to this specific cell until the lock is removed.
              {lockTarget && (
                <span className="mt-2 block font-mono text-xs">
                  {lockTarget.networkType} — PCI {lockTarget.pci}, EARFCN{" "}
                  {lockTarget.frequency}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLocking}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLockCell} disabled={isLocking}>
              {isLocking ? (
                <>
                  <LoaderCircleIcon className="size-4 animate-spin" />
                  Locking...
                </>
              ) : (
                "Lock Cell"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default NeighbourCellScanner;
