"use client";

import { motion } from "motion/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const MotionTableRow = motion.create(TableRow);

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UsersIcon, ShieldIcon, AlertCircle, CheckCircle2Icon, MinusCircleIcon } from "lucide-react";
import type { TailscaleStatus, TailscalePeer } from "@/hooks/use-tailscale";

// =============================================================================
// TailscalePeersCard — Peer list table for Tailscale network
// =============================================================================

interface TailscalePeersCardProps {
  status: TailscaleStatus | null;
  isLoading: boolean;
  error?: string | null;
}

function formatLastSeen(lastSeen: string, online: boolean): string {
  if (online) return "现在";
  if (!lastSeen) return "未知";

  const date = new Date(lastSeen);
  const now = Date.now();
  const diffMs = now - date.getTime();

  if (diffMs < 0 || isNaN(diffMs)) return lastSeen;

  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} 小时前`;

  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} 天前`;
}

function capitalizeOS(os: string): string {
  if (!os) return "—";
  // Common OS name formatting
  const map: Record<string, string> = {
    linux: "Linux",
    windows: "Windows",
    macos: "macOS",
    darwin: "macOS",
    ios: "iOS",
    android: "Android",
    freebsd: "FreeBSD",
  };
  return map[os.toLowerCase()] || os.charAt(0).toUpperCase() + os.slice(1);
}

export function TailscalePeersCard({
  status,
  isLoading,
  error,
}: TailscalePeersCardProps) {
  const isConnected = status?.backend_state === "Running";
  const peers: TailscalePeer[] = (isConnected && status?.peers) || [];
  const hasExitNode = peers.some((p) => p.exit_node);

  // --- Loading skeleton ------------------------------------------------------
  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>网络节点</CardTitle>
          <CardDescription>
            你的 Tailscale 网络中的设备。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <div className="border-b px-4 py-3">
              <div className="flex gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
            <div className="divide-y">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Error state (fetch failed, no data) ------------------------------------
  if (!isLoading && error && !status) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>网络节点</CardTitle>
          <CardDescription>
            你的 Tailscale 网络中的设备。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <AlertCircle className="size-10 text-destructive" />
            <p className="text-sm text-muted-foreground text-center">
              加载节点数据失败。
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Empty / not connected state -------------------------------------------
  if (!isConnected || peers.length === 0) {
    const message = !isConnected
      ? "连接到 Tailscale 后即可查看网络节点。"
      : "你的 Tailscale 网络中未发现节点。";

    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>网络节点</CardTitle>
          <CardDescription>
            你的 Tailscale 网络中的设备。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <UsersIcon className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              {message}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Peer table ------------------------------------------------------------
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>网络节点</CardTitle>
        <CardDescription>
          你的 Tailscale 网络中的设备。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>设备</TableHead>
                <TableHead>IP 地址</TableHead>
                <TableHead className="hidden @sm/card:table-cell">系统</TableHead>
                <TableHead className="w-20">状态</TableHead>
                <TableHead className="hidden @md/card:table-cell w-24">
                  最近在线
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody aria-live="polite">
              {peers.map((peer, i) => (
                <MotionTableRow
                  key={`${peer.hostname}-${peer.tailscale_ips?.[0] ?? i}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.05, 0.4), ease: "easeOut" }}
                >
                  <TableCell className="max-w-48">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-sm truncate">
                          {peer.hostname || "未知"}
                        </span>
                        {peer.exit_node && (
                          <Badge
                            variant="outline"
                            className="text-xs shrink-0"
                          >
                            <ShieldIcon className="size-3 mr-1" />
                            Exit Node
                          </Badge>
                        )}
                      </div>
                      {peer.dns_name && (
                        <span className="block text-xs text-muted-foreground truncate">
                          {peer.dns_name.replace(/\.$/, "")}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {peer.tailscale_ips?.[0] || "—"}
                  </TableCell>
                  <TableCell className="hidden @sm/card:table-cell text-sm">
                    {capitalizeOS(peer.os)}
                  </TableCell>
                  <TableCell>
                    {peer.online ? (
                      <Badge variant="outline" className="bg-success/15 text-success hover:bg-success/20 border-success/30">
                        <CheckCircle2Icon className="h-3 w-3" />
                        Online
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-muted-foreground/30">
                        <MinusCircleIcon className="h-3 w-3" />
                        Offline
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden @md/card:table-cell text-xs text-muted-foreground">
                    {formatLastSeen(peer.last_seen, peer.online)}
                  </TableCell>
                </MotionTableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        <div className="text-xs text-muted-foreground">
          Showing <strong>{peers.length}</strong>{" "}
          {peers.length === 1 ? "peer" : "peers"}
        </div>
        {hasExitNode && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <ShieldIcon className="size-3" />
            出口节点已启用
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
