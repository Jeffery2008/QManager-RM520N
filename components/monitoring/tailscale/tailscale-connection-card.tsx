"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CopyableCommand } from "@/components/ui/copyable-command";
import {
  Loader2,
  PackageIcon,
  ExternalLinkIcon,
  AlertCircle,
  RefreshCcwIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  MinusCircleIcon,
  LogInIcon,
  Trash2Icon,
} from "lucide-react";
import type { UseTailscaleReturn } from "@/hooks/use-tailscale";

// =============================================================================
// TailscaleConnectionCard — Multi-state connection + settings card
// =============================================================================
// States: Loading → Error → Not Installed → Service Stopped →
//         NeedsLogin → Connected → Disconnected

type TailscaleConnectionCardProps = Omit<UseTailscaleReturn, "refresh"> & {
  refresh: () => void;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function trimDNS(dns: string): string {
  return dns?.replace(/\.$/, "") || "";
}

function getIPv4(ips: string[] | undefined): string {
  return ips?.find((ip) => /^\d+\.\d+\.\d+\.\d+$/.test(ip)) || "—";
}

function getIPv6(ips: string[] | undefined): string {
  return ips?.find((ip) => ip.includes(":")) || "—";
}

// ─── Component ──────────────────────────────────────────────────────────────

export function TailscaleConnectionCard({
  status,
  isLoading,
  isConnecting,
  isDisconnecting,
  isTogglingService,
  isUninstalling,
  installResult,
  error,
  connect,
  disconnect,
  logout,
  startService,
  stopService,
  setBootEnabled,
  uninstall,
  runInstall,
  refresh,
}: TailscaleConnectionCardProps) {
  const [showRebootDialog, setShowRebootDialog] = useState(false);
  const [isRebooting, setIsRebooting] = useState(false);

  const handleReboot = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsRebooting(true);
    fetch("/cgi-bin/quecmanager/system/reboot.sh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reboot" }),
      keepalive: true,
    }).catch(() => {});
    setTimeout(() => {
      sessionStorage.setItem("qm_rebooting", "1");
      document.cookie = "qm_logged_in=; Path=/; Max-Age=0";
      window.location.href = "/reboot/";
    }, 2000);
  };

  // Reboot confirmation dialog (shown after successful uninstall)
  // Defined before early returns so it renders in all states including "Not Installed"
  const rebootDialog = (
    <AlertDialog open={showRebootDialog} onOpenChange={(open) => {
      if (!isRebooting) setShowRebootDialog(open);
    }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>需要重启</AlertDialogTitle>
          <AlertDialogDescription>
            Tailscale 已被移除。建议重启设备以清理防火墙规则和其他残留项。是否现在重启？
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRebooting}>
            稍后重启
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isRebooting}
            onClick={handleReboot}
          >
            {isRebooting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                重启中…
              </>
            ) : (
              "立即重启"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  // --- Loading skeleton ------------------------------------------------------
  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Tailscale 连接</CardTitle>
          <CardDescription>
            管理你的 Tailscale VPN 连接。
          </CardDescription>
        </CardHeader>
        <CardContent aria-live="polite">
          <div className="grid gap-2">
            <Skeleton className="h-6 w-28" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
            <Skeleton className="h-9 w-32" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Error state (initial fetch failed) ------------------------------------
  if (!isLoading && error && !status) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Tailscale 连接</CardTitle>
          <CardDescription>
            管理你的 Tailscale VPN 连接。
          </CardDescription>
        </CardHeader>
        <CardContent aria-live="polite">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>加载 Tailscale 状态失败</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={() => refresh()}>
                <RefreshCcwIcon className="size-3.5" />
                重试
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // --- Not Installed ---------------------------------------------------------
  if (status && !status.installed) {
    const installCmd =
      status.install_hint || "sudo qmanager_tailscale_mgr install";

    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Tailscale 连接</CardTitle>
          <CardDescription>
            管理你的 Tailscale VPN 连接。
          </CardDescription>
        </CardHeader>
        <CardContent aria-live="polite">
          <div className="flex flex-col items-center justify-center py-6 gap-4">
            <PackageIcon className="size-10 text-muted-foreground" />
            <div className="text-center space-y-1.5">
              <p className="text-sm font-medium">
                此设备尚未安装 Tailscale。
              </p>
              <p className="text-xs text-muted-foreground">
                可自动安装，也可手动执行命令安装。
              </p>
            </div>

            {installResult.status === "complete" && (
              <Alert className="border-success/30 bg-success/5">
                <CheckCircle2Icon className="text-success" />
                <AlertDescription className="text-success">
                  <p>{installResult.message}</p>
                </AlertDescription>
              </Alert>
            )}

            {installResult.status === "error" && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p>
                    {installResult.message}
                    {installResult.detail && (
                      <span className="block text-xs mt-1 opacity-80">
                        {installResult.detail}
                      </span>
                    )}
                  </p>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex items-center gap-2">
              <Button
                onClick={runInstall}
                disabled={installResult.status === "running"}
              >
                {installResult.status === "running" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {installResult.message || "安装中..."}
                  </>
                ) : (
                  <>
                    <PackageIcon className="size-4" />
                    安装 Tailscale
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refresh()}
                disabled={installResult.status === "running"}
              >
                <RefreshCcwIcon className="size-3.5" />
                重新检查
              </Button>
            </div>

            <div className="w-full flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              <span>或手动安装</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="w-full grid gap-2">
              <p className="text-xs text-muted-foreground">
                可直接点击上方按钮安装，或通过 SSH 手动执行以下命令：
              </p>
              <CopyableCommand command={installCmd} />
            </div>
          </div>
          {rebootDialog}
        </CardContent>
      </Card>
    );
  }

  // --- Stale data warning (poll failed but we have previous data) ------------
  const staleWarning = error && status && (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertDescription className="flex items-center justify-between">
        <span className="text-xs">{error}</span>
        <Button variant="outline" size="sm" onClick={() => refresh()}>
          <RefreshCcwIcon className="size-3.5" />
          重试
        </Button>
      </AlertDescription>
    </Alert>
  );

  // --- From here, Tailscale IS installed -------------------------------------
  const version = status?.version;
  const backendState = status?.backend_state || "";
  const daemonRunning = status?.daemon_running;
  const bootEnabled = status?.enabled_on_boot ?? false;
  const self = status?.self;
  const tailnet = status?.tailnet;
  const health = (status?.health || []).filter(
    (msg) => !msg.includes("--accept-routes"),
  );
  const authUrl = status?.auth_url;

  // Boot toggle handler
  const handleBootToggle = async (checked: boolean) => {
    const success = await setBootEnabled(checked);
    if (success) {
      toast.success(
        checked
          ? "Tailscale 将在开机时自动启动"
          : "Tailscale 不会在开机时自动启动",
      );
    } else {
      toast.error("更新开机启动设置失败");
    }
  };

  // Boot toggle element (reused across states)
  const bootToggle = (
    <>
      <Separator />
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted-foreground">
          开机启动
        </p>
        <Switch
          checked={bootEnabled}
          onCheckedChange={handleBootToggle}
          aria-label="启用 Tailscale 开机启动"
        />
      </div>
    </>
  );

  // Uninstall section (follows Email Alerts / Video Optimizer pattern)
  const uninstallSection = (
    <>
      <Separator className="mt-4" />
      <div className="flex items-center justify-between pt-4">
        <div>
              <p className="text-sm font-medium">移除 Tailscale</p>
              <p className="text-xs text-muted-foreground">
            从此设备中卸载 Tailscale 软件包及其防火墙规则。
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              disabled={isUninstalling}
            >
              {isUninstalling ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  移除中…
                </>
              ) : (
                <>
                  <Trash2Icon className="size-4" />
                  卸载
                </>
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>卸载 Tailscale？</AlertDialogTitle>
              <AlertDialogDescription>
                这会从设备中移除 Tailscale 软件包、防火墙规则以及所有连接状态。设备随后会重启以清理残留项。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  const success = await uninstall();
                  if (success) {
                    toast.success("Tailscale 已卸载");
                    setShowRebootDialog(true);
                  } else {
                    toast.error("卸载 Tailscale 失败");
                  }
                }}
              >
                卸载
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );

  // --- Service Stopped -------------------------------------------------------
  if (!daemonRunning) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Tailscale 连接</CardTitle>
          <CardDescription>
            {version ? `Tailscale v${version} · ` : ""}管理你的 Tailscale VPN 连接。
          </CardDescription>
        </CardHeader>
        <CardContent aria-live="polite">
          <div className="grid gap-2">
            {staleWarning}
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-muted-foreground">
                服务
              </p>
              <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-muted-foreground/30">
                <MinusCircleIcon className="size-3" />
                已停止
              </Badge>
            </div>
            {bootToggle}
            <Separator />
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <Button
                onClick={async () => {
                  const success = await startService();
                  if (success) {
                    toast.success("Tailscale 服务已启动");
                  } else {
                    toast.error("启动 Tailscale 服务失败");
                  }
                }}
                disabled={isTogglingService}
              >
                {isTogglingService ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    启动中…
                  </>
                ) : (
                  "启动服务"
                )}
              </Button>
            </div>
            {uninstallSection}
            {rebootDialog}
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Needs Login -----------------------------------------------------------
  if (backendState === "NeedsLogin" || backendState === "NeedsMachineAuth") {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Tailscale 连接</CardTitle>
          <CardDescription>
            {version ? `Tailscale v${version} · ` : ""}管理你的 Tailscale VPN 连接。
          </CardDescription>
        </CardHeader>
        <CardContent aria-live="polite">
          <div className="grid gap-2">
            {staleWarning}
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-muted-foreground">
                状态
              </p>
              <Badge variant="outline" className="bg-warning/15 text-warning hover:bg-warning/20 border-warning/30">
                <LogInIcon className="size-3" />
                需要登录
              </Badge>
            </div>

            {authUrl ? (
              <>
                <Separator />
                <Alert>
                  <AlertCircle className="size-4" />
                  <AlertDescription className="space-y-3">
                    <p>
                      访问下方链接，使用你的 Tailscale 账号完成认证
                      （Google、Microsoft 等）。
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(authUrl, "_blank", "noopener,noreferrer")}
                    >
                      <ExternalLinkIcon className="size-3.5" />
                      打开登录页面
                    </Button>
                    <p className="text-xs text-muted-foreground animate-pulse motion-reduce:animate-none">
                      正在等待认证…
                    </p>
                  </AlertDescription>
                </Alert>
              </>
            ) : (
              <>
                <Separator />
                <div className="pt-1">
                  <Button
                    onClick={async () => {
                      const success = await connect();
                      if (!success) {
                        toast.error("发起连接失败");
                      }
                    }}
                    disabled={isConnecting}
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        连接中…
                      </>
                    ) : (
                      "连接"
                    )}
                  </Button>
                </div>
              </>
            )}

            {bootToggle}
            <Separator />
            <div className="pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const success = await stopService();
                  if (success) {
                    toast.success("Tailscale 服务已停止");
                  } else {
                    toast.error("停止 Tailscale 服务失败");
                  }
                }}
                disabled={isTogglingService}
              >
                {isTogglingService ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    停止中…
                  </>
                ) : (
                  "停止服务"
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Connected (Running) ---------------------------------------------------
  if (backendState === "Running") {
    const ipv4 = getIPv4(self?.tailscale_ips);
    const ipv6 = getIPv6(self?.tailscale_ips);
    const dnsName = trimDNS(self?.dns_name || "");
    const magicSuffix = tailnet?.magic_dns_enabled
      ? tailnet.magic_dns_suffix
      : "";

    const infoRows: { label: string; value: React.ReactNode }[] = [
      { label: "主机名", value: self?.hostname || "—" },
      {
        label: "IPv4",
        value: <span className="font-mono">{ipv4}</span>,
      },
      ...(ipv6 !== "—"
        ? [
            {
              label: "IPv6",
              value: (
                <span className="font-mono break-all">{ipv6}</span>
              ),
            },
          ]
        : []),
      ...(dnsName
        ? [
            {
              label: "DNS 名称",
              value: <span className="break-all">{dnsName}</span>,
            },
          ]
        : []),
      ...(tailnet?.name ? [{ label: "Tailnet", value: tailnet.name }] : []),
      ...(magicSuffix
        ? [
            {
              label: "MagicDNS",
              value: <span className="font-mono">{magicSuffix}</span>,
            },
          ]
        : []),
      ...(self?.relay
        ? [
            {
              label: "DERP 中继",
              value: self.relay.toUpperCase(),
            },
          ]
        : []),
    ];

    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Tailscale 连接</CardTitle>
          <CardDescription>
            {version ? `Tailscale v${version} · ` : ""}管理你的 Tailscale VPN 连接。
          </CardDescription>
        </CardHeader>
        <CardContent aria-live="polite">
          <div className="grid gap-2">
            {staleWarning}
            {/* Boot toggle */}
            {bootToggle}
            {/* Health warnings */}
            {health.length > 0 && (
              <>
                <Separator />
                <Alert variant="destructive">
                  <AlertTriangleIcon className="size-4" />
                  <AlertTitle>健康状态警告</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4 text-xs space-y-1">
                      {health.map((msg, i) => (
                        <li key={i}>{msg}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              </>
            )}

            <Separator />

            {/* Status badge */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-muted-foreground">
                状态
              </p>
              <Badge variant="outline" className="bg-success/15 text-success hover:bg-success/20 border-success/30">
                <CheckCircle2Icon className="size-3" />
                已连接
              </Badge>
            </div>

            {/* Info rows */}
            {infoRows.map((row, i) => (
              <React.Fragment key={row.label}>
                <Separator />
                <motion.div
                  className="flex items-center justify-between gap-2"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.05, 0.35), ease: "easeOut" }}
                >
                  <p className="text-sm font-semibold text-muted-foreground shrink-0">
                    {row.label}
                  </p>
                  <p className="text-sm font-semibold text-right min-w-0 break-all">
                    {row.value}
                  </p>
                </motion.div>
              </React.Fragment>
            ))}

            {/* Actions */}
            <Separator />
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const success = await disconnect();
                  if (success) {
                    toast.success("Tailscale 已断开连接");
                  } else {
                    toast.error("断开 Tailscale 失败");
                  }
                }}
                disabled={isDisconnecting}
              >
                {isDisconnecting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    断开中…
                  </>
                ) : (
                  "断开连接"
                )}
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={isDisconnecting}
                  >
                    登出
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>要从 Tailscale 登出吗？</AlertDialogTitle>
                    <AlertDialogDescription>
                      这会将当前设备从你的 Tailscale 网络中移除。
                      重新连接时需要再次认证。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        const success = await logout();
                        if (success) {
                          toast.success("已从 Tailscale 登出");
                        } else {
                          toast.error("从 Tailscale 登出失败");
                        }
                      }}
                    >
                      登出
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Disconnected (Stopped backend state) ----------------------------------
  return (
    <Card className="@container/card">
      <CardHeader>
          <CardTitle>Tailscale 连接</CardTitle>
        <CardDescription>
          {version ? `Tailscale v${version} · ` : ""}管理你的 Tailscale VPN 连接。
        </CardDescription>
      </CardHeader>
      <CardContent aria-live="polite">
        <div className="grid gap-2">
          {staleWarning}
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground">
              状态
            </p>
            <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-muted-foreground/30">
              <MinusCircleIcon className="size-3" />
              已断开
            </Badge>
          </div>

          {bootToggle}

          <Separator />
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <Button
              onClick={async () => {
                const success = await connect();
                if (!success) {
                  toast.error("连接 Tailscale 失败");
                }
              }}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  连接中…
                </>
              ) : (
                "连接"
              )}
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isDisconnecting}
                >
                  登出
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>要从 Tailscale 登出吗？</AlertDialogTitle>
                  <AlertDialogDescription>
                    这会将当前设备从你的 Tailscale 网络中移除。
                    重新连接时需要再次认证。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      const success = await logout();
                      if (success) {
                        toast.success("已从 Tailscale 登出");
                      } else {
                        toast.error("从 Tailscale 登出失败");
                      }
                    }}
                    >
                    登出
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          {uninstallSection}
          {rebootDialog}
        </div>
      </CardContent>
    </Card>
  );
}
