"use client";

import { useState, useEffect, type FormEvent, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SaveButton, useSaveFlash } from "@/components/ui/save-button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RotateCcwIcon } from "lucide-react";

import { useIpPassthrough } from "@/hooks/use-ip-passthrough";
import type {
  PassthroughMode,
  DnsProxy,
  IpptNat,
  UsbMode,
} from "@/types/ip-passthrough";

// MAC source: "automatic" = FF:FF:FF:FF:FF:FF (first connected device), "manual" = text input
type MacSource = "automatic" | "manual";

// Local-only types — descriptive strings avoid Radix Select "0"-as-falsy bug
type NatMode = "nat-on" | "nat-off";
type UsbModeLocal = "rmnet" | "ecm" | "mbim" | "rndis";

const USB_MODE_TO_API: Record<UsbModeLocal, string> = {
  rmnet: "0",
  ecm: "1",
  mbim: "2",
  rndis: "3",
};
const USB_MODE_FROM_API: Record<string, UsbModeLocal> = {
  "0": "rmnet",
  "1": "ecm",
  "2": "mbim",
  "3": "rndis",
};

const IPPassthroughCard = () => {
  const {
    passthroughMode,
    targetMac,
    ipptNat,
    usbMode,
    dnsProxy,
    isLoading,
    isSaving,
    error,
    saveSettings,
    refresh,
  } = useIpPassthrough();
  const { saved, markSaved } = useSaveFlash();

  // Local form state — NatMode and UsbModeLocal use descriptive strings to
  // avoid Radix Select treating "0" as falsy and showing the placeholder
  const [localMode, setLocalMode] = useState<PassthroughMode>("disabled");
  const [localMacSource, setLocalMacSource] = useState<MacSource>("automatic");
  const [localMacInput, setLocalMacInput] = useState<string>("");
  const [localIpptNat, setLocalIpptNat] = useState<NatMode | "">("");
  const [localUsbMode, setLocalUsbMode] = useState<UsbModeLocal>("ecm");
  const [localDnsProxy, setLocalDnsProxy] = useState<DnsProxy>("disabled");

  // Pre-save confirmation dialog
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Sync form state when server data arrives
  useEffect(() => {
    if (passthroughMode !== null) setLocalMode(passthroughMode);
    if (ipptNat !== null) setLocalIpptNat(ipptNat === "1" ? "nat-on" : "nat-off");
    if (usbMode !== null) setLocalUsbMode(USB_MODE_FROM_API[usbMode] ?? "ecm");
    if (dnsProxy !== null) setLocalDnsProxy(dnsProxy);

    // Initialise MAC source only when mode is active
    if (
      passthroughMode !== null &&
      passthroughMode !== "disabled" &&
      targetMac !== null
    ) {
      if (targetMac === "" || targetMac === "FF:FF:FF:FF:FF:FF") {
        setLocalMacSource("automatic");
        setLocalMacInput("");
      } else {
        setLocalMacSource("manual");
        setLocalMacInput(targetMac);
      }
    }
  }, [passthroughMode, targetMac, ipptNat, usbMode, dnsProxy]);

  // Resolved MAC to send to backend
  const resolvedMac =
    localMacSource === "automatic" ? "FF:FF:FF:FF:FF:FF" : localMacInput;

  const macRequired = localMode !== "disabled";
  const macValid =
    !macRequired ||
    localMacSource === "automatic" ||
    /^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$/.test(localMacInput);

  const resetToServer = () => {
    if (passthroughMode !== null) setLocalMode(passthroughMode);
    if (ipptNat !== null) setLocalIpptNat(ipptNat === "1" ? "nat-on" : "nat-off");
    if (usbMode !== null) setLocalUsbMode(USB_MODE_FROM_API[usbMode] ?? "ecm");
    if (dnsProxy !== null) setLocalDnsProxy(dnsProxy);

    if (passthroughMode !== "disabled" && targetMac) {
      if (targetMac === "" || targetMac === "FF:FF:FF:FF:FF:FF") {
        setLocalMacSource("automatic");
        setLocalMacInput("");
      } else {
        setLocalMacSource("manual");
        setLocalMacInput(targetMac);
      }
    } else {
      setLocalMacSource("automatic");
      setLocalMacInput("");
    }
  };

  // Step 1: validate → open confirm dialog
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!macValid) {
      toast.error("请输入有效的 MAC 地址（XX:XX:XX:XX:XX:XX）");
      return;
    }

    setShowConfirmDialog(true);
  };

  // Step 2: user confirmed → apply + reboot
  const handleConfirmedApply = async () => {
    setShowConfirmDialog(false);

    const success = await saveSettings({
      passthrough_mode: localMode,
      target_mac: macRequired ? resolvedMac : "",
      ippt_nat: (localIpptNat === "nat-on" ? "1" : "0") as IpptNat,
      usb_mode: USB_MODE_TO_API[localUsbMode] as UsbMode,
      dns_proxy: localDnsProxy,
    });

    if (success) {
      markSaved();
      toast.success("设置已应用，设备正在重启…");
    } else {
      toast.error("保存 IP 透传设置失败");
    }
  };

  // Format MAC input: strip non-hex, uppercase, insert colons every 2 chars
  const handleMacInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
    const formatted = raw.match(/.{1,2}/g)?.join(":") ?? raw;
    setLocalMacInput(formatted.slice(0, 17));
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>IP 透传配置</CardTitle>
          <CardDescription>
            将调制解调器的公网 IP 直接分配给下游设备，绕过路由器 NAT。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid @md/card:grid-cols-2 grid-cols-1 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-9 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-9 w-full" />
              </div>
            </div>
            <div className="grid @md/card:grid-cols-2 grid-cols-1 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-9 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-9 w-full" />
              </div>
            </div>
            <div className="grid @md/card:grid-cols-2 grid-cols-1 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-9 w-full" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-9" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>IP 透传配置</CardTitle>
        <CardDescription>
          将调制解调器的公网 IP 直接分配给下游设备，绕过路由器 NAT。
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="flex items-center justify-between gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 mb-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 text-destructive hover:text-destructive"
              onClick={refresh}
            >
              重试
            </Button>
          </div>
        )}
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="w-full">
            <FieldSet>
              <FieldGroup>
                <div className="grid @md/card:grid-cols-2 grid-cols-1 gap-4">
                  {/* Field 1: Passthrough Mode */}
                  <Field>
                    <FieldLabel>IP 透传模式</FieldLabel>
                    <Select
                      name="ippt_mode"
                      value={localMode}
                      onValueChange={(v) => setLocalMode(v as PassthroughMode)}
                      disabled={isSaving}
                    >
                      <SelectTrigger aria-label="IP 透传模式">
                        <SelectValue placeholder="选择模式" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="disabled">
                          已禁用（路由模式）
                        </SelectItem>
                        <SelectItem value="eth">以太网（ETH）</SelectItem>
                        <SelectItem value="usb">USB 共享网络</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  {/* Field 2: Target Device MAC (hidden when disabled) */}
                  <Field>
                    <FieldLabel>目标设备（MAC）</FieldLabel>
                    <AnimatePresence mode="wait">
                      {localMode === "disabled" ? (
                        <motion.div
                          key="mac-disabled"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Select disabled>
                            <SelectTrigger aria-label="Target Device MAC">
                              <SelectValue placeholder="不适用：当前为路由模式" />
                            </SelectTrigger>
                            <SelectContent />
                          </Select>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="mac-active"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="flex flex-col gap-2"
                        >
                          <Select
                            name="mac_source"
                            value={localMacSource}
                            onValueChange={(v) =>
                              setLocalMacSource(v as MacSource)
                            }
                            disabled={isSaving}
                          >
                            <SelectTrigger aria-label="MAC 来源" className="w-full">
                              <SelectValue placeholder="选择目标设备" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="automatic">
                                自动：第一个已连接设备
                              </SelectItem>
                              <SelectItem value="manual">
                                手动输入…
                              </SelectItem>
                            </SelectContent>
                          </Select>

                          {/* Manual MAC text input */}
                          <AnimatePresence mode="wait">
                            {localMacSource === "manual" && (
                              <motion.div
                                key="manual-mac-input"
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{
                                  duration: 0.3,
                                  ease: [0.16, 1, 0.3, 1],
                                }}
                              >
                                <Input
                                  aria-label="MAC 地址"
                                  placeholder="XX:XX:XX:XX:XX:XX"
                                  className="font-mono uppercase placeholder:normal-case"
                                  value={localMacInput}
                                  onChange={handleMacInputChange}
                                  maxLength={17}
                                  disabled={isSaving}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                  输入将接收 WAN IP 的设备 MAC 地址。
                                </p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Field>
                </div>

                <div className="grid @md/card:grid-cols-2 grid-cols-1 grid-flow-row gap-4">
                  {/* Field 3: IPPT NAT Mode */}
                  <Field>
                    <FieldLabel>NAT 模式（网络地址转换）</FieldLabel>
                    <Select
                      value={
                        localIpptNat ||
                        (ipptNat !== null
                          ? ipptNat === "1"
                            ? "nat-on"
                            : "nat-off"
                          : "")
                      }
                      onValueChange={(v) => setLocalIpptNat(v as NatMode)}
                      disabled={isSaving}
                    >
                      <SelectTrigger aria-label="NAT mode">
                        <SelectValue placeholder="选择 NAT 模式" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nat-on">
                          启用 NAT（推荐）
                        </SelectItem>
                        <SelectItem value="nat-off">不启用 NAT</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  {/* Field 4: USB Modem Protocol */}
                  <Field>
                    <FieldLabel>USB 连接模式</FieldLabel>
                    <Select
                      value={localUsbMode}
                      onValueChange={(v) => setLocalUsbMode(v as UsbModeLocal)}
                      disabled={isSaving}
                    >
                      <SelectTrigger aria-label="USB 连接模式">
                        <SelectValue placeholder="选择 USB 调制解调器协议" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rmnet">RMNET (QMI)</SelectItem>
                        <SelectItem value="ecm">ECM (Universal)</SelectItem>
                        <SelectItem value="mbim">MBIM (Windows)</SelectItem>
                        <SelectItem value="rndis">RNDIS (Legacy)</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <div className="grid @md/card:grid-cols-2 grid-cols-1 grid-flow-row gap-4">
                  {/* Field 5: DNS Offloading */}
                  <Field>
                    <FieldLabel>DNS 代理</FieldLabel>
                    <Select
                      name="dns_mode"
                      value={localDnsProxy}
                      onValueChange={(v) => setLocalDnsProxy(v as DnsProxy)}
                      disabled={isSaving}
                    >
                      <SelectTrigger aria-label="DNS 代理">
                        <SelectValue placeholder="选择 DNS 模式" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="disabled">
                          已禁用（推荐）
                        </SelectItem>
                        <SelectItem value="enabled">
                          已启用（使用调制解调器 DNS）
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </FieldGroup>
            </FieldSet>
          </div>

          <div className="flex items-center gap-x-2">
            <SaveButton
              type="submit"
              isSaving={isSaving}
              saved={saved}
              disabled={!macValid}
            />
            <Button
              type="button"
              variant="outline"
              onClick={resetToServer}
              disabled={isSaving}
              aria-label="重置为已保存的值"
            >
              <RotateCcwIcon />
            </Button>
          </div>
        </form>

        {/* Pre-save confirmation dialog */}
        <AlertDialog
          open={showConfirmDialog}
          onOpenChange={setShowConfirmDialog}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                设备将立即重启
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    应用这些更改会保存配置，并立即重启设备。
                  </p>
                  {localMode !== "disabled" && (
                    <p className="font-medium text-foreground">
                      启用 IP 透传后，设备本地网关将无法再直接访问。请确保你有可用的 Tailscale 连接，或其他可在重启后访问设备的带外方式。
                    </p>
                  )}
                  <p>该设置会在重启后持续生效。</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmedApply}>
                应用并重启
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

export default IPPassthroughCard;
