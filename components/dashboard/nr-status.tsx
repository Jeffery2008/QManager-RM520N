import { SignalStatusCard } from "./signal-status-card";
import type { NrStatus } from "@/types/modem-status";

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
    { label: "Band", value: data?.band || "-" },
    { label: "ARFCN", value: data?.arfcn?.toString() ?? "-" },
    { label: "PCI", value: data?.pci?.toString() ?? "-" },
    { label: "RSRP", value: fmt(data?.rsrp, "dBm") },
    { label: "RSRQ", value: fmt(data?.rsrq, "dB") },
    { label: "SINR", value: fmt(data?.sinr, "dB") },
    { label: "SCS", value: fmt(data?.scs, "kHz") },
  ];

  return (
    <SignalStatusCard
      title="5G Primary Status"
      state={data?.state ?? "unknown"}
      rsrp={data?.rsrp ?? null}
      rows={rows}
      isLoading={isLoading}
    />
  );
};

export default NrStatusComponent;
