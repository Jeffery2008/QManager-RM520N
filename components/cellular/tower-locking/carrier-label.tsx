"use client";

import React from "react";
import type { CarrierOption } from "./simple-mode-utils";

interface CarrierLabelProps {
  opt: CarrierOption;
}

/**
 * Compact dropdown row for a Simple Mode carrier option.
 * Shows: (PCC/SCC tag) Band (Channel) · RSRP if present.
 */
export const CarrierLabel: React.FC<CarrierLabelProps> = ({ opt }) => {
  return (
    <span className="flex items-center gap-2 min-w-0">
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded border ${
          opt.type === "PCC"
            ? "border-info/40 text-info bg-info/10"
            : "border-muted-foreground/30 text-muted-foreground bg-muted/40"
        }`}
      >
        {opt.type}
      </span>
      <span className="font-medium">{opt.band || "—"}</span>
      <span className="tabular-nums text-muted-foreground">({opt.earfcn})</span>
      {opt.rsrp != null && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {opt.rsrp} dBm
        </span>
      )}
    </span>
  );
};
