"use client";

import React from "react";
import { motion } from "motion/react";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { TbInfoCircleFilled } from "react-icons/tb";
import { Button } from "@/components/ui/button";

import type {
  NetworkStatus,
  LteStatus,
  NrStatus,
  DeviceStatus,
} from "@/types/modem-status";
import { formatNumericField } from "@/types/modem-status";

// =============================================================================
// Props
// =============================================================================

interface CellDataComponentProps {
  network: NetworkStatus | null;
  lte: LteStatus | null;
  nr: NrStatus | null;
  device: DeviceStatus | null;
  isLoading: boolean;
}

// =============================================================================
// Helpers
// =============================================================================

/** Map network type enum to human-readable display */
function formatNetworkType(type: string): string {
  switch (type) {
    case "5G-NSA":
      return "5G NR + LTE";
    case "5G-SA":
      return "5G NR SA";
    case "LTE":
      return "LTE";
    default:
      return type || "-";
  }
}

/** Build CA summary string from network status */
function formatCarrierAggregation(network: NetworkStatus): string {
  const isNSA = network.type === "5G-NSA";
  const parts: string[] = [];

  if (network.ca_active && network.ca_count > 0) {
    parts.push(`LTE (${network.ca_count + 1} carriers)`);
  } else if (isNSA) {
    // NSA always has an LTE anchor — show "LTE" even without CA
    parts.push("LTE");
  }

  if (network.nr_ca_active && network.nr_ca_count > 0) {
    // Genuine NR CA — show carrier count (+1 for primary NR carrier)
    parts.push(`NR (${network.nr_ca_count + 1} carriers)`);
  } else if (isNSA) {
    // NSA dual connectivity: NR leg is active but not doing CA
    parts.push("NR");
  }

  if (parts.length === 0) return "Inactive";
  return parts.join(" + ");
}

/** Convert decimal to hex string for TAC tooltip, e.g. 49026 → "BF82" */
function decToHex(value: number | null): string {
  if (value === null || value === undefined) return "-";
  return value.toString(16).toUpperCase();
}

/**
 * Truncate an IPv6 address for display.
 * e.g. "2607:f8b0:4005:805::200e" → "2607:f8b0:4...::200e"
 */
function truncateIpv6(ip: string): string {
  if (!ip || ip.length <= 20) return ip || "-";
  // Find the :: separator if present
  const dcIdx = ip.indexOf("::");
  if (dcIdx !== -1) {
    const prefix = ip.substring(0, Math.min(dcIdx, 11));
    const suffix = ip.substring(dcIdx);
    return `${prefix}...${suffix}`;
  }
  // No :: — truncate middle
  return `${ip.substring(0, 11)}...${ip.substring(ip.length - 5)}`;
}

// =============================================================================
// Loading Skeleton
// =============================================================================

function CellDataSkeleton() {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Cellular Information</CardTitle>
        <CardDescription>
          Detailed information about the connected cellular network.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <React.Fragment key={i}>
              <Separator />
              <div className="flex items-center justify-between py-0.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-36" />
              </div>
            </React.Fragment>
          ))}
          <Separator />
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Component
// =============================================================================

const CellDataComponent = ({
  network,
  lte,
  nr,
  device,
  isLoading,
}: CellDataComponentProps) => {
  if (isLoading) return <CellDataSkeleton />;

  // Determine which RAT provides Cell ID and TAC
  // SA mode: use NR values. NSA/LTE: use LTE values.
  const isSA = network?.type === "5G-SA";
  const cellId = isSA ? nr?.cell_id : lte?.cell_id;
  const tac = isSA ? nr?.tac : lte?.tac;
  const enodebId = isSA ? nr?.enodeb_id : lte?.enodeb_id;
  const sectorId = isSA ? nr?.sector_id : lte?.sector_id;
  const cellIdLabel = isSA ? "gNodeB" : "eNodeB";

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Cellular Information</CardTitle>
        <CardDescription>
          Detailed information about the connected cellular network.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <motion.div
          className="grid gap-2"
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.04 } } }}
        >
          {/* ISP */}
          <Separator />
          <motion.div
            className="flex items-center justify-between"
            variants={{ hidden: { opacity: 0, x: -8 }, visible: { opacity: 1, x: 0 } }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <p className="text-sm font-semibold text-muted-foreground">ISP</p>
            <p className="text-sm font-semibold">{network?.carrier || "-"}</p>
          </motion.div>

          {/* APN */}
          <Separator />
          <motion.div
            className="flex items-center justify-between"
            variants={{ hidden: { opacity: 0, x: -8 }, visible: { opacity: 1, x: 0 } }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <p className="text-sm font-semibold text-muted-foreground">
              Access Point Name (APN)
            </p>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold">{network?.apn || "-"}</p>
              <Button
                variant="link"
                size="sm"
                className="p-0.5 cursor-pointer"
                asChild
              >
                <Link href="/cellular/settings/apn-management">Edit</Link>
              </Button>
            </div>
          </motion.div>

          {/* Network Type */}
          <Separator />
          <motion.div
            className="flex items-center justify-between"
            variants={{ hidden: { opacity: 0, x: -8 }, visible: { opacity: 1, x: 0 } }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <p className="text-sm font-semibold text-muted-foreground">
              Network Type
            </p>
            <p className="text-sm font-semibold">
              {network ? formatNetworkType(network.type) : "-"}
            </p>
          </motion.div>

          {/* Cell ID */}
          <Separator />
          <motion.div
            className="flex items-center justify-between"
            variants={{ hidden: { opacity: 0, x: -8 }, visible: { opacity: 1, x: 0 } }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <p className="text-sm font-semibold text-muted-foreground">
              Cell ID
            </p>
            <div className="flex items-center gap-1.5">
              {cellId != null && enodebId != null ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="inline-flex" aria-label="More info">
                      <TbInfoCircleFilled className="size-5 text-info" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="grid">
                      <p>
                        {cellIdLabel} ID:{" "}
                        <span className="font-semibold">
                          {formatNumericField(enodebId)}
                        </span>
                      </p>

                      <p>
                        Sector:{" "}
                        <span className="font-semibold">
                          {formatNumericField(sectorId)}
                        </span>
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ) : null}
              <p className="text-sm font-semibold">
                {formatNumericField(cellId)}
              </p>
            </div>
          </motion.div>

          {/* TAC */}
          <Separator />
          <motion.div
            className="flex items-center justify-between"
            variants={{ hidden: { opacity: 0, x: -8 }, visible: { opacity: 1, x: 0 } }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <p className="text-sm font-semibold text-muted-foreground">
              Tracking Area Code
            </p>
            <div className="flex items-center gap-1.5">
              {tac != null ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="inline-flex" aria-label="More info">
                      <TbInfoCircleFilled className="size-5 text-info" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Hex:{" "}
                      <span className="font-semibold">0x{decToHex(tac)}</span>
                    </p>
                  </TooltipContent>
                </Tooltip>
              ) : null}
              <p className="text-sm font-semibold">{formatNumericField(tac)}</p>
            </div>
          </motion.div>

          {/* Total Bandwidth */}
          <Separator />
          <motion.div
            className="flex items-center justify-between"
            variants={{ hidden: { opacity: 0, x: -8 }, visible: { opacity: 1, x: 0 } }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <p className="text-sm font-semibold text-muted-foreground">
              Total Bandwidth in Use
            </p>
            <div className="flex items-center gap-1.5">
              {network?.bandwidth_details ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="inline-flex" aria-label="More info">
                      <TbInfoCircleFilled className="size-5 text-info" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{network.bandwidth_details}</p>
                  </TooltipContent>
                </Tooltip>
              ) : null}
              <p className="text-sm font-semibold">
                {network?.total_bandwidth_mhz
                  ? `${network.total_bandwidth_mhz} MHz`
                  : "-"}
              </p>
            </div>
          </motion.div>

          {/* Carrier Aggregation */}
          <Separator />
          <motion.div
            className="flex items-center justify-between"
            variants={{ hidden: { opacity: 0, x: -8 }, visible: { opacity: 1, x: 0 } }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <p className="text-sm font-semibold text-muted-foreground">
              Carrier Aggregation
            </p>
            <p className="text-sm font-semibold">
              {network ? formatCarrierAggregation(network) : "-"}
            </p>
          </motion.div>

          {/* Active MIMO */}
          <Separator />
          <motion.div
            className="flex items-center justify-between"
            variants={{ hidden: { opacity: 0, x: -8 }, visible: { opacity: 1, x: 0 } }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <p className="text-sm font-semibold text-muted-foreground">
              Active MIMO
            </p>
            <p className="text-sm font-semibold">{device?.mimo || "-"}</p>
          </motion.div>

          {/* WAN IPv4 */}
          <Separator />
          <motion.div
            className="flex items-center justify-between"
            variants={{ hidden: { opacity: 0, x: -8 }, visible: { opacity: 1, x: 0 } }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <p className="text-sm font-semibold text-muted-foreground">
              WAN IPv4
            </p>
            <p className="text-sm font-semibold font-mono">
              {network?.wan_ipv4 || "-"}
            </p>
          </motion.div>

          {/* WAN IPv6 */}
          <Separator />
          <motion.div
            className="flex items-center justify-between"
            variants={{ hidden: { opacity: 0, x: -8 }, visible: { opacity: 1, x: 0 } }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <p className="text-sm font-semibold text-muted-foreground">
              WAN IPv6
            </p>
            <div className="flex items-center gap-1.5">
              {network?.wan_ipv6 && network.wan_ipv6.length > 20 ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="inline-flex" aria-label="More info">
                      <TbInfoCircleFilled className="size-5 text-info" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{network.wan_ipv6}</p>
                  </TooltipContent>
                </Tooltip>
              ) : null}
              <p className="text-sm font-semibold font-mono">
                {network?.wan_ipv6 ? truncateIpv6(network.wan_ipv6) : "-"}
              </p>
            </div>
          </motion.div>

          {/* Primary DNS */}
          <Separator />
          <motion.div
            className="flex items-center justify-between"
            variants={{ hidden: { opacity: 0, x: -8 }, visible: { opacity: 1, x: 0 } }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <p className="text-sm font-semibold text-muted-foreground">
              Primary DNS
            </p>
            <p className="text-sm font-semibold font-mono">
              {network?.primary_dns || "-"}
            </p>
          </motion.div>

          {/* Secondary DNS */}
          <Separator />
          <motion.div
            className="flex items-center justify-between"
            variants={{ hidden: { opacity: 0, x: -8 }, visible: { opacity: 1, x: 0 } }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <p className="text-sm font-semibold text-muted-foreground">
              Secondary DNS
            </p>
            <p className="text-sm font-semibold font-mono">
              {network?.secondary_dns || "-"}
            </p>
          </motion.div>
          <Separator />
        </motion.div>
      </CardContent>
    </Card>
  );
};

export default CellDataComponent;
