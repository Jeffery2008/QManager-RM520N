import { SignalStatusCard } from "./signal-status-card";
import type { LteStatus } from "@/types/modem-status";
import {
  RSRP_THRESHOLDS,
  RSRQ_THRESHOLDS,
  SINR_THRESHOLDS,
} from "@/types/modem-status";

interface LTEStatusComponentProps {
  data: LteStatus | null;
  isLoading: boolean;
}

const LTEStatusComponent = ({ data, isLoading }: LTEStatusComponentProps) => {
  const fmt = (value: number | null | undefined, unit: string) => {
    if (value === null || value === undefined) return "-";
    return `${value} ${unit}`;
  };

  const rows = [
    { label: "Band", value: data?.band || "-" },
    { label: "EARFCN", value: data?.earfcn?.toString() ?? "-" },
    { label: "PCI", value: data?.pci?.toString() ?? "-" },
    {
      label: "RSRP",
      value: fmt(data?.rsrp, "dBm"),
      rawValue: data?.rsrp,
      thresholds: RSRP_THRESHOLDS,
    },
    {
      label: "RSRQ",
      value: fmt(data?.rsrq, "dB"),
      rawValue: data?.rsrq,
      thresholds: RSRQ_THRESHOLDS,
    },
    { label: "RSSI", value: fmt(data?.rssi, "dBm") },
    {
      label: "SINR",
      value: fmt(data?.sinr, "dB"),
      rawValue: data?.sinr,
      thresholds: SINR_THRESHOLDS,
    },
  ];

  return (
    <SignalStatusCard
      title="4G Primary Status"
      state={data?.state ?? "unknown"}
      rsrp={data?.rsrp ?? null}
      rows={rows}
      isLoading={isLoading}
    />
  );
};

export default LTEStatusComponent;
