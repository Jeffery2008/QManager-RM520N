"use client";

import * as React from "react";
import { Popover as PopoverPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";
import { MaterialSymbol } from "@/components/ui/material-symbol";
import type { MaterialSymbolName } from "@/components/ui/material-symbol";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type HintVariant = "info" | "muted" | "warning";
type HintSize = "sm" | "md";

interface VariantStyle {
  glyph: MaterialSymbolName;
  iconClass: string;
  cursor: string;
}

const VARIANT_STYLES: Record<HintVariant, VariantStyle> = {
  info: {
    glyph: "info",
    iconClass: "text-info",
    cursor: "",
  },
  muted: {
    glyph: "info",
    iconClass: "text-muted-foreground",
    cursor: "",
  },
  warning: {
    glyph: "warning",
    iconClass: "text-warning",
    cursor: "cursor-help",
  },
};

// MaterialSymbol sizes itself via inline `fontSize`, so these px values stand in for size-4 / size-5.
const SIZE_PX: Record<HintSize, number> = {
  sm: 16,
  md: 20,
};

export interface HintIconProps {
  /** Accessible label announced by screen readers — must disambiguate when multiple hints share a page. */
  label: string;
  /** Tip body. Plain string or rich nodes both fine. */
  children: React.ReactNode;
  /** `info` for system-state hints, `muted` for UI-preference hints, `warning` for passive caution markers. */
  variant?: HintVariant;
  /** `md` (20px, default) for primary hints; `sm` (16px) for secondary or inline-with-text hints. */
  size?: HintSize;
}

/**
 * An info toggletip on Popover, not Tooltip: a Radix Tooltip never opens on tap.
 * Tap/click/Enter toggles; outside tap or Esc closes; mouse hover still opens it.
 */
export function HintIcon({
  label,
  children,
  variant = "info",
  size = "md",
}: HintIconProps) {
  const { glyph, iconClass, cursor } = VARIANT_STYLES[variant];
  const [open, setOpen] = React.useState(false);
  // While a mouse rests on the trigger, a click must not toggle the hover-opened tip shut.
  const hoveringRef = React.useRef(false);

  const handleOpenChange = (next: boolean) => {
    if (!next && hoveringRef.current) return;
    setOpen(next);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onPointerEnter={(e) => {
            if (e.pointerType !== "mouse") return;
            hoveringRef.current = true;
            setOpen(true);
          }}
          onPointerLeave={(e) => {
            if (e.pointerType !== "mouse") return;
            hoveringRef.current = false;
            setOpen(false);
          }}
          className={cn(
            "inline-flex items-center rounded-full outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            cursor,
          )}
        >
          <MaterialSymbol
            name={glyph}
            filled
            size={SIZE_PX[size]}
            className={iconClass}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        sideOffset={0}
        // Keep focus on the trigger: the tip holds no controls to move focus into.
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-auto max-w-[min(18rem,var(--radix-popover-content-available-width))] rounded-md border-0 bg-foreground px-3 py-1.5 text-xs text-balance text-background shadow-none"
      >
        <p>{children}</p>
        <PopoverPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground" />
      </PopoverContent>
    </Popover>
  );
}
