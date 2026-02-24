"use client";

import React from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import ScannerEmptyView from "./empty-view";
import ScanResultView from "./scan-result";
import { Button } from "@/components/ui/button";
import { DownloadIcon, LoaderCircleIcon, RefreshCcwIcon } from "lucide-react";
import { useCellScanner } from "@/hooks/use-cell-scanner";
import { Badge } from "@/components/ui/badge";

const FullScannerComponent = () => {
  const { status, results, error, startScan } = useCellScanner();

  const hasScanResults = status === "complete" && results.length > 0;
  const isScanning = status === "running";

  return (
    <Card className="@container/card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Cell Scanner</CardTitle>
            <CardDescription>
              Scan and display available cellular networks and towers.
            </CardDescription>
          </div>
          {isScanning && (
            <Badge
              variant="outline"
              className="animate-pulse text-yellow-500 border-yellow-500/50"
            >
              <LoaderCircleIcon className="h-3 w-3 mr-1 animate-spin" />
              Scanning...
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {hasScanResults ? (
            <ScanResultView data={results} />
          ) : isScanning ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <LoaderCircleIcon className="h-10 w-10 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground text-sm max-w-xs">
                Scanning nearby cells... This may take up to 3 minutes depending
                on network conditions.
              </p>
            </div>
          ) : status === "error" ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <p className="text-destructive text-sm">
                {error || "Scan failed"}
              </p>
              <Button onClick={startScan} variant="outline" size="sm">
                <RefreshCcwIcon className="mr-1 h-4 w-4" />
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
                  <LoaderCircleIcon className="mr-1 h-4 w-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                "Start New Scan"
              )}
            </Button>
            {hasScanResults && (
              <Button variant="outline">
                <DownloadIcon />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FullScannerComponent;
