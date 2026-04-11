"use client";

import { useCallback, useState } from "react";
import { authFetch } from "@/lib/auth-fetch";

import { Card, CardContent } from "@/components/ui/card";
import ScannerEmptyView from "./empty-view";
import ScanResultView from "./scan-result";
import type { CellScanResult } from "./scan-result";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  DownloadIcon,
  LoaderCircleIcon,
  RefreshCcwIcon,
} from "lucide-react";
import { useCellScanner } from "@/hooks/use-cell-scanner";
import { toast } from "sonner";
import { downloadCSV } from "@/lib/download-csv";
import { ScanningView } from "./scanning-view";
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

// --- CSV row builder for cell scan results -----------------------------------
function buildCsvRows(results: CellScanResult[]): string[] {
  return results.map((r) =>
    [
      r.networkType,
      `"${(r.provider || "").replace(/"/g, '""')}"`,
      r.mcc,
      r.mnc,
      r.band,
      r.earfcn,
      r.pci,
      r.cellID,
      r.tac,
      r.bandwidth,
      r.signalStrength,
    ].join(","),
  );
}

const CELL_SCAN_CSV_HEADER =
  "网络类型,运营商,MCC,MNC,频段,EARFCN,PCI,小区ID,TAC,带宽,信号强度(dBm)";

const FullScannerComponent = () => {
  const { status, results, error, elapsedSeconds, startScan } = useCellScanner();
  const [lockTarget, setLockTarget] = useState<CellScanResult | null>(null);
  const [isLocking, setIsLocking] = useState(false);

  const hasScanResults = status === "complete" && results.length > 0;
  const isScanning = status === "running";

  // --- 锁定小区 Handler ---------------------------------------------------
  // Routes through the existing tower/lock.sh for full UCI config + failover
  const handleLockCell = useCallback((cell: CellScanResult) => {
    setLockTarget(cell);
  }, []);

  const confirmLockCell = useCallback(async () => {
    if (!lockTarget) return;
    setIsLocking(true);

    try {
      // Build payload matching existing tower/lock.sh format
      let body: Record<string, unknown>;

      if (lockTarget.networkType === "NR5G") {
        body = {
          type: "nr_sa",
          action: "lock",
          pci: lockTarget.pci,
          arfcn: lockTarget.earfcn,
          scs: lockTarget.scs ?? 30, // Default SCS 30kHz if missing
          band: lockTarget.band,
        };
      } else {
        // LTE (default)
        body = {
          type: "lte",
          action: "lock",
          cells: [{ earfcn: lockTarget.earfcn, pci: lockTarget.pci }],
        };
      }

      const res = await authFetch("/cgi-bin/quecmanager/tower/lock.sh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.success) {
        toast.success("小区已锁定", {
          description: `已锁定到 ${lockTarget.networkType} 的 PCI ${lockTarget.pci}（EARFCN ${lockTarget.earfcn}）`,
        });
      } else {
        toast.error("锁定失败", {
          description: data.detail || data.error || "未知错误",
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
              <ScanResultView data={results} onLockCell={handleLockCell} />
            ) : isScanning ? (
              <ScanningView elapsedSeconds={elapsedSeconds} />
            ) : status === "error" ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="size-5 text-destructive" />
                </div>
                <div className="max-w-xs space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {error || "扫描失败"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    调制解调器可能正忙或暂时不可达。请检查连接后重试。
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
                {isScanning ? "扫描中..." : "开始新扫描"}
              </Button>
              {hasScanResults && (
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadCSV(
                      CELL_SCAN_CSV_HEADER,
                      buildCsvRows(results),
                      `cell_scan_${new Date().toISOString().slice(0, 10)}.csv`,
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
              这会将调制解调器锁定到以下小区。在解除锁定前，它只会连接这个指定小区。
            </AlertDialogDescription>
            {lockTarget && (
              <p className="font-mono text-xs text-muted-foreground">
                {lockTarget.networkType} — PCI {lockTarget.pci}, EARFCN{" "}
                {lockTarget.earfcn}, Band {lockTarget.band}
                {lockTarget.provider && ` (${lockTarget.provider})`}
              </p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLocking}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmLockCell(); }} disabled={isLocking}>
              {isLocking ? (
                <>
                  <LoaderCircleIcon className="size-4 animate-spin" />
                  锁定中...
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

export default FullScannerComponent;
