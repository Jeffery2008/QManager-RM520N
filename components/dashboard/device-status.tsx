"use client";

import React, { useState } from "react";
import { motion, type Variants } from "motion/react";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

import type { DeviceStatus } from "@/types/modem-status";
import packageJson from "@/package.json";

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: "easeOut" },
  },
};

interface DeviceStatusComponentProps {
  data: DeviceStatus | null;
  isLoading: boolean;
  lanGateway?: string;
}

const DeviceStatusComponent = ({
  data,
  isLoading,
  lanGateway,
}: DeviceStatusComponentProps) => {
  const [hidePrivate, setHidePrivate] = useState(false);

  const rows = [
    { label: "制造商", value: data?.manufacturer || "-" },
    { label: "固件版本", value: data?.firmware || "-" },
    { label: "构建日期", value: data?.build_date || "-" },
    {
      label: "电话号码",
      value: data?.phone_number || "-",
      mono: true,
      private: true,
    },
    { label: "IMSI", value: data?.imsi || "-", mono: true, private: true },
    { label: "ICCID", value: data?.iccid || "-", mono: true, private: true },
    {
      label: "设备 IMEI",
      value: data?.imei || "-",
      mono: true,
      private: true,
    },
    {
      label: "LTE 等级",
      value: data?.lte_category ? `Cat ${data.lte_category}` : "-",
      mono: true,
    },
    { label: "当前 MIMO", value: data?.mimo || "-", mono: true },
    { label: "LAN 网关", value: lanGateway || "-", mono: true },
    { label: "QManager 版本", value: packageJson.version, mono: true },
  ];

  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold @[250px]/card:text-3xl">
            设备信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="flex items-center justify-center mb-4">
              <Skeleton className="size-44 rounded-full" />
            </div>
            <div className="grid divide-y divide-border border-y border-border">
              {Array.from({ length: 11 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2"
                >
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-36" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold @[250px]/card:text-3xl">
            设备信息
        </CardTitle>
        <CardAction>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setHidePrivate((prev) => !prev)}
            aria-label={
              hidePrivate ? "显示隐私详情" : "隐藏隐私详情"
            }
          >
            {hidePrivate ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="flex items-center justify-center mb-4">
            <div className="size-44 bg-primary/15 rounded-full p-4 flex items-center justify-center">
              <img
                src="/device-icon.svg"
                alt="设备图标"
                className="size-full drop-shadow-md object-contain"
              />
            </div>
          </div>

          <motion.dl
            className="grid divide-y divide-border border-y border-border"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {rows.map((row) => (
              <motion.div key={row.label} variants={itemVariants} className="flex items-center justify-between py-2">
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
              </motion.div>
            ))}
          </motion.dl>
        </div>
      </CardContent>
    </Card>
  );
};

export default DeviceStatusComponent;
