"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

import type { DeviceStatus } from "@/types/modem-status";

interface DeviceStatusComponentProps {
  data: DeviceStatus | null;
  isLoading: boolean;
}

const DeviceStatusComponent = ({
  data,
  isLoading,
}: DeviceStatusComponentProps) => {
  const [hidePrivate, setHidePrivate] = useState(false);

  const rows = [
    { label: "Manufacturer", value: data?.manufacturer || "-" },
    { label: "Firmware Version", value: data?.firmware || "-" },
    { label: "Build Date", value: data?.build_date || "-" },
    {
      label: "Phone Number",
      value: data?.phone_number || "-",
      mono: true,
      private: true,
    },
    { label: "IMSI", value: data?.imsi || "-", mono: true, private: true },
    { label: "ICCID", value: data?.iccid || "-", mono: true, private: true },
    {
      label: "Device IMEI",
      value: data?.imei || "-",
      mono: true,
      private: true,
    },
    {
      label: "LTE Category",
      value: data?.lte_category ? `Cat ${data.lte_category}` : "-",
      mono: true,
    },
    { label: "Active MIMO", value: data?.mimo || "-", mono: true },
  ];

  if (isLoading) {
    return (
      <Card className="@container/card col-span-2">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-center">
            Device Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="flex items-center justify-center mb-8">
              <Skeleton className="size-44 rounded-full" />
            </div>
            <div className="grid gap-2">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i}>
                  <Separator />
                  <div className="flex items-center justify-between py-1">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-36" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="@container/card col-span-2">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold @[250px]/card:text-3xl text-center flex-1">
          Device Information
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="flex items-center justify-center mb-8">
            <div className="size-44 bg-primary/15 rounded-full p-4 flex items-center justify-center">
              <img
                src="/device-icon.svg"
                alt="Device Icon"
                className="size-full drop-shadow-md object-contain"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setHidePrivate((prev) => !prev)}
                aria-label={
                  hidePrivate ? "Show private details" : "Hide private details"
                }
              >
                {hidePrivate ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </Button>
            </div>
            <dl className="grid divide-y divide-border border-y border-border">
              {rows.map((row) => (
                <div key={row.label} className="flex items-center justify-between py-2">
                  <dt className="font-semibold text-muted-foreground xl:text-base text-sm">
                    {row.label}
                  </dt>
                  <dd
                    className={`font-semibold xl:text-base text-sm ${
                      row.mono ? "tabular-nums" : ""
                    }`}
                  >
                    {hidePrivate && row.private ? "••••••••••••" : row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DeviceStatusComponent;
