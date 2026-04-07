"use client";

import { useState, useCallback } from "react";
import { authFetch } from "@/lib/auth-fetch";

import { Card, CardContent } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  DownloadIcon,
  LoaderCircleIcon,
  RefreshCcwIcon,
} from "lucide-react";
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
import { downloadCSV } from "@/lib/download-csv";
import { ScannerSkeleton } from "@/components/cellular/cell-scanner/scanner-skeleton";
import ScannerEmptyView from "@/components/cellular/cell-scanner/empty-view";
import NeighbourScanResultView, {
  type NeighbourCellResult,
} from "./neighbour-scan-result";
import { useNeighbourScanner } from "@/hooks/use-neighbour-scanner";

// --- CSV row builder for neighbour scan results ------------------------------
function buildCsvRows(results: NeighbourCellResult[]): string[] {
  return results.map((r) =>
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
}

const NEIGHBOUR_CSV_HEADER =
  "Network,Cell Type,Frequency,PCI,Signal (dBm),RSRQ,RSSI,SINR";

const NeighbourCellScanner = () => {
  const { status, results, error, startScan } = useNeighbourScanner();
  const [lockTarget, setLockTarget] = useState<NeighbourCellResult | null>(
    null,
  );
  const [isLocking, setIsLocking] = useState(false);

  const hasScanResults = status === "complete" && results.length > 0;
  const isScanning = status === "running";

  // --- 锁定小区 Handler -----------------------------------------------------
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

      const res = await authFetch("/cgi-bin/quecmanager/tower/lock.sh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.success) {
        toast.success("小区已锁定", {
          description: `Locked to LTE PCI ${lockTarget.pci} on EARFCN ${lockTarget.frequency}`,
        });
      } else {
        toast.error("锁定失败", {
          description: data.detail || data.error || "Unknown error",
        });
      }
    } catch {
      toast.error("锁定失败", {
        description: "连接调制解调器失败",
      });
    } finally {
      setIsLocking(false);
      setLockTarget(null);
    }
  }, [lockTarget]);

  return (
    <>
      <Card className="@container/card">
        <CardContent className="pt-6">
          <div className="grid gap-4">
            {hasScanResults ? (
              <NeighbourScanResultView
                data={results}
                onLockCell={handleLockCell}
              />
            ) : isScanning ? (
              <ScannerSkeleton headerCols={5} rowCols={4} />
            ) : status === "error" ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="size-5 text-destructive" />
                </div>
                <div className="max-w-xs space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {error || "Scan failed"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    The modem may be busy or unreachable. Check your connection
                    and try again.
                  </p>
                </div>
                <Button onClick={startScan} variant="outline" size="sm">
                  <RefreshCcwIcon className="size-4" />
                  重新扫描
                </Button>
              </div>
            ) : (
              <ScannerEmptyView onStartScan={startScan} />
            )}
          </div>
          {(hasScanResults || isScanning) && (
            <div className="mt-4 flex items-center gap-x-2">
              <Button onClick={startScan} disabled={isScanning}>
                {isScanning ? "Scanning..." : "Start New Scan"}
              </Button>
              {hasScanResults && (
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadCSV(
                      NEIGHBOUR_CSV_HEADER,
                      buildCsvRows(results),
                      `neighbour_scan_${new Date().toISOString().slice(0, 10)}.csv`,
                    )
                  }
                  aria-label="下载 CSV"
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
        onOpenChange={(open) => !open && !isLocking && setLockTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>锁定到该小区？</AlertDialogTitle>
            <AlertDialogDescription>
              This will lock the modem to the following cell. It will only
              connect to this specific cell until the lock is removed.
            </AlertDialogDescription>
            {lockTarget && (
              <p className="font-mono text-xs text-muted-foreground">
                {lockTarget.networkType} — PCI {lockTarget.pci}, EARFCN{" "}
                {lockTarget.frequency}
              </p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLocking}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmLockCell(); }} disabled={isLocking}>
              {isLocking ? (
                <>
                  <LoaderCircleIcon className="size-4 animate-spin" />
                  Locking...
                </>
              ) : (
                "锁定小区"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default NeighbourCellScanner;
