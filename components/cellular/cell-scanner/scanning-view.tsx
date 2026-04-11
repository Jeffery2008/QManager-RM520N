import { ScanSearchIcon } from "lucide-react";

interface ScanningViewProps {
  elapsedSeconds: number;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ScanningView({ elapsedSeconds }: ScanningViewProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
      {/* Animated icon — pulse is opacity-only (GPU composited, low power) */}
      <div className="relative flex items-center justify-center">
        <div className="absolute size-16 motion-safe:animate-pulse rounded-full bg-primary/10" />
        <div className="relative flex size-12 items-center justify-center rounded-full bg-primary/15">
          <ScanSearchIcon className="size-5 text-primary" />
        </div>
      </div>

      {/* Elapsed time */}
      <p
        className="text-2xl font-semibold tabular-nums tracking-tight text-foreground"
        role="timer"
        aria-live="off"
        aria-label={`扫描已耗时：${formatElapsed(elapsedSeconds)}`}
      >
        {formatElapsed(elapsedSeconds)}
      </p>

      {/* Status copy */}
      <div className="max-w-xs space-y-1">
        <p className="text-sm font-medium text-foreground">
          正在扫描附近小区...
        </p>
        <p className="text-xs text-muted-foreground">
          通常需要 2 到 3 分钟。扫描期间，其他调制解调器操作会暂时暂停。
        </p>
      </div>

      {/* Navigation warning */}
      <p className="text-xs text-muted-foreground/60">
        请不要关闭标签页，也不要刷新页面。
      </p>
    </div>
  );
}
