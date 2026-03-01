"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CircleArrowDownIcon, CircleArrowUpIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { AmbrData } from "@/types/cellular-settings";
import { formatBitrate } from "@/types/cellular-settings";
import { TbInfoCircleFilled } from "react-icons/tb";

interface CellularAMBRCardProps {
  ambr: AmbrData | null;
  isLoading: boolean;
}

const CellularAMBRCard = ({ ambr, isLoading }: CellularAMBRCardProps) => {
  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Active AMBR View</CardTitle>
          <CardDescription>
            Aggregate Maximum Bit Rate (AMBR) is a parameter used in cellular
            networks to define the maximum data transfer rate that a user
            equipment (UE) can achieve.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-y-6">
            <div className="grid gap-2">
              <Skeleton className="h-4 w-20" />
              <Separator />
              <Skeleton className="h-6 w-full" />
              <Separator />
              <Skeleton className="h-6 w-full" />
              <Separator />
            </div>
            <div className="grid gap-2">
              <Skeleton className="h-4 w-24" />
              <Separator />
              <Skeleton className="h-6 w-full" />
              <Separator />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Active AMBR View</CardTitle>
        <CardDescription>
          Aggregate Maximum Bit Rate (AMBR) is a parameter used in cellular
          networks to define the maximum data transfer rate that a user
          equipment (UE) can achieve.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-y-6">
          {/* LTE AMBR Section */}
          <div className="grid gap-2">
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <TbInfoCircleFilled className="w-5 h-5 text-blue-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    While devices can request specific AMBR values, operators{" "}
                    <br />
                    may ignore these and enforce their own speed limits based on{" "}
                    <br />
                    subscription plans, network policies, or congestion
                    conditions.
                  </p>
                </TooltipContent>
              </Tooltip>
              <h2 className="font-semibold text-sm">LTE AMBR</h2>
            </div>

            <Separator />
            {ambr && ambr.lte.length > 0 ? (
              ambr.lte.map((entry, index) => (
                <React.Fragment key={`lte-${index}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-muted-foreground text-sm">
                      {entry.apn}
                    </p>
                    <div className="flex items-center gap-x-4">
                      <div className="flex items-center gap-x-1">
                        <CircleArrowDownIcon className="h-4 w-4 text-blue-500" />
                        <p className="font-semibold text-sm">
                          {formatBitrate(entry.dl_kbps)}
                        </p>
                      </div>
                      <div className="flex items-center gap-x-1">
                        <CircleArrowUpIcon className="h-4 w-4 text-blue-500" />
                        <p className="font-semibold text-sm">
                          {formatBitrate(entry.ul_kbps)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <Separator />
                </React.Fragment>
              ))
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  No LTE AMBR data available
                </p>
                <Separator />
              </>
            )}
          </div>

          {/* NR5G AMBR Section */}
          <div className="grid gap-2">
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <TbInfoCircleFilled className="w-5 h-5 text-blue-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    While devices can request specific AMBR values, operators{" "}
                    <br />
                    may ignore these and enforce their own speed limits based on{" "}
                    <br />
                    subscription plans, network policies, or congestion
                    conditions.
                  </p>
                </TooltipContent>
              </Tooltip>
              <h2 className="font-semibold text-sm">NR5G AMBR</h2>
            </div>
            <Separator />
            {ambr && ambr.nr5g.length > 0 ? (
              ambr.nr5g.map((entry, index) => (
                <React.Fragment key={`nr5g-${index}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-muted-foreground text-sm">
                      {entry.dnn}
                    </p>
                    <div className="flex items-center gap-x-4">
                      <div className="flex items-center gap-x-1">
                        <CircleArrowDownIcon className="h-4 w-4 text-blue-500" />
                        <p className="font-semibold text-sm">
                          {formatBitrate(entry.dl_kbps)}
                        </p>
                      </div>
                      <div className="flex items-center gap-x-1">
                        <CircleArrowUpIcon className="h-4 w-4 text-blue-500" />
                        <p className="font-semibold text-sm">
                          {formatBitrate(entry.ul_kbps)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <Separator />
                </React.Fragment>
              ))
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  No NR5G AMBR data available
                </p>
                <Separator />
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CellularAMBRCard;
