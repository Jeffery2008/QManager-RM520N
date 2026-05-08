"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

interface InstallLogViewerProps {
  log: string;
  isRunning: boolean;
}

export function InstallLogViewer({ log, isRunning }: InstallLogViewerProps) {
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const el = preRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [log]);

  const showPlaceholder = isRunning && log.trim().length === 0;

  return (
    <div className="w-full rounded-md border border-zinc-800 bg-zinc-950 text-zinc-200 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <span className="text-xs font-medium text-zinc-400">安装日志</span>
        {isRunning && (
          <Loader2 className="size-3.5 animate-spin text-zinc-400" />
        )}
      </div>
      <pre
        ref={preRef}
        className="h-56 overflow-y-auto px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre text-left"
      >
        {showPlaceholder ? (
          <span className="text-zinc-500">正在等待输出...</span>
        ) : (
          log
        )}
      </pre>
    </div>
  );
}
