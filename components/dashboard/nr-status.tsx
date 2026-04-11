import { SignalStatusCard } from "./signal-status-card";
import type { NrStatus } from "@/types/modem-status";
import {
  RSRP_THRESHOLDS,
  RSRQ_THRESHOLDS,
  SINR_THRESHOLDS,
} from "@/types/modem-status";

interface NrStatusComponentProps {
  data: NrStatus | null;
  isLoading: boolean;
}

const NrStatusComponent = ({ data, isLoading }: NrStatusComponentProps) => {
  const fmt = (value: number | null | undefined, unit: string) => {
    if (value === null || value === undefined) return "-";
    return `${value} ${unit}`;
  };

  const rows = [
    { label: "频段", value: data?.band || "-" },
    { label: "ARFCN", value: data?.arfcn?.toString() ?? "-" },
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
    {
      label: "SINR",
      value: fmt(data?.sinr, "dB"),
      rawValue: data?.sinr,
      thresholds: SINR_THRESHOLDS,
    },
    { label: "SCS", value: fmt(data?.scs, "kHz") },
  ];

  return (
    <SignalStatusCard
      title="5G 主载波状态"
      state={data?.state ?? "unknown"}
      rsrp={data?.rsrp ?? null}
      rows={rows}
      isLoading={isLoading}
    />
  );
};

export default NrStatusComponent;
