"use client";

import { useState, useEffect, type FormEvent } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldError,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SaveButton, useSaveFlash } from "@/components/ui/save-button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  EyeIcon,
  EyeOffIcon,
  InfoIcon,
} from "lucide-react";
import { TbInfoCircleFilled } from "react-icons/tb";

import type { WanProfile, WanProfileSaveRequest } from "@/types/wan-profiles";
import {
  PDP_TYPE_OPTIONS,
  AUTH_TYPE_OPTIONS,
  VLAN_OPTIONS,
  isCarrierProfile,
} from "@/types/wan-profiles";

// =============================================================================
// Props
// =============================================================================

interface WanProfileEditCardProps {
  profile: WanProfile;
  isSaving: boolean;
  /** Backend data source. On "at" (AT-only modems), the wmmd-only controls
   *  — default route, IP passthrough, VLAN mapping — have no equivalent and
   *  are hidden, since saving them would be a silent no-op. */
  dataSource: "rdb" | "at";
  onSave: (index: number, request: WanProfileSaveRequest) => Promise<boolean>;
  onCancel: () => void;
}

// =============================================================================
// Loading Skeleton
// =============================================================================

function WanProfileEditSkeleton() {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>编辑配置</CardTitle>
        <CardDescription>正在加载配置...</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="grid @md/card:grid-cols-2 grid-cols-1 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
          <div className="grid @md/card:grid-cols-2 grid-cols-1 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
          <Skeleton className="h-px w-full" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Component
// =============================================================================

export default function WanProfileEditCard({
  profile,
  isSaving,
  dataSource,
  onSave,
  onCancel,
}: WanProfileEditCardProps) {
  const carrier = isCarrierProfile(profile);
  // wmmd-only controls have no AT equivalent — hide them on AT-only modems.
  const showWmmdControls = dataSource === "rdb";
  const { saved, markSaved } = useSaveFlash();

  // --- Form state ---
  const [name, setName] = useState(profile.name);
  const [apn, setApn] = useState(profile.apn);
  const [pdpType, setPdpType] = useState(profile.pdp_type);
  const [authType, setAuthType] = useState(profile.auth_type);
  const [username, setUsername] = useState(profile.username);
  const [password, setPassword] = useState("");
  const [mtu, setMtu] = useState(profile.mtu !== null ? String(profile.mtu) : "");
  const [modemProfile, setModemProfile] = useState(String(profile.modem_profile));
  const [ipPassthrough, setIpPassthrough] = useState(profile.ip_passthrough);
  const [defaultRoute, setDefaultRoute] = useState(profile.default_route);
  const [vlanIndex, setVlanIndex] = useState(profile.vlan_index ?? "");

  // --- UI state ---
  const [showPassword, setShowPassword] = useState(false);
  const [apnError, setApnError] = useState("");
  const [mtuError, setMtuError] = useState("");

  // Sync form when profile changes (e.g. after toggle or external refresh)
  useEffect(() => {
    setName(profile.name);
    setApn(profile.apn);
    setPdpType(profile.pdp_type);
    setAuthType(profile.auth_type);
    setUsername(profile.username);
    setPassword("");
    setMtu(profile.mtu !== null ? String(profile.mtu) : "");
    setModemProfile(String(profile.modem_profile));
    setIpPassthrough(profile.ip_passthrough);
    setDefaultRoute(profile.default_route);
    setVlanIndex(profile.vlan_index ?? "");
    setShowPassword(false);
    setApnError("");
    setMtuError("");
  }, [profile]);

  // --- Validation ---
  const validateForm = (): boolean => {
    let valid = true;

    if (!apn.trim()) {
      setApnError("APN 为必填项");
      valid = false;
    } else {
      setApnError("");
    }

    const mtuNum = mtu.trim() ? parseInt(mtu, 10) : null;
    if (mtu.trim() && (isNaN(mtuNum!) || mtuNum! < 1 || mtuNum! > 1500)) {
      setMtuError("MTU 必须在 1 到 1500 之间");
      valid = false;
    } else {
      setMtuError("");
    }

    return valid;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const request: WanProfileSaveRequest = {
      name: name.trim(),
      apn: apn.trim(),
      pdp_type: pdpType,
      auth_type: authType,
      username: authType !== "none" ? username.trim() : "",
      password: authType !== "none" ? password : "",
      mtu: mtu.trim() ? parseInt(mtu, 10) : null,
      ip_passthrough: ipPassthrough,
      modem_profile: parseInt(modemProfile, 10),
      default_route: defaultRoute,
      vlan_index: vlanIndex,
    };

    const success = await onSave(profile.index, request);
    if (success) {
      markSaved();
      toast.success(`配置 ${profile.index} 已保存`);
    } else {
      toast.error(`保存配置 ${profile.index} 失败`);
    }
  };

  if (!profile) return <WanProfileEditSkeleton />;

  const carrierTypeLabel =
    profile.apn_type === "ims"
      ? "IMS (VoLTE)"
      : profile.apn_type === "emergency"
        ? "紧急服务 (SOS)"
        : null;

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>编辑配置 {profile.index}</CardTitle>
        <CardDescription>
          {carrier && carrierTypeLabel
            ? `运营商预配置档：${carrierTypeLabel}`
            : `配置 ${profile.index} 的 APN、认证和连接设置。`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {carrier && (
          <Alert className="mb-4">
            <InfoIcon />
            <AlertTitle>运营商预配置档</AlertTitle>
            <AlertDescription>
              此配置由运营商管理，不能编辑。修改 IMS 和紧急服务配置可能影响语音与紧急呼叫。
            </AlertDescription>
          </Alert>
        )}

        <fieldset disabled={carrier || undefined}>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <FieldSet>
              <FieldGroup>
                {/* Row 1: Name + APN */}
                <div className="grid @md/card:grid-cols-2 grid-cols-1 grid-flow-row gap-4">
                  <Field>
                    <FieldLabel htmlFor={`wp-name-${profile.index}`}>
                      名称
                    </FieldLabel>
                    <Input
                      id={`wp-name-${profile.index}`}
                      placeholder="我的数据配置"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={isSaving}
                    />
                  </Field>

                  <Field data-invalid={apnError ? true : undefined}>
                    <FieldLabel htmlFor={`wp-apn-${profile.index}`}>
                      APN *
                    </FieldLabel>
                    <Input
                      id={`wp-apn-${profile.index}`}
                      placeholder="fast.t-mobile.com"
                      value={apn}
                      onChange={(e) => {
                        setApn(e.target.value);
                        if (apnError) setApnError("");
                      }}
                      disabled={isSaving}
                      required
                      aria-required="true"
                      aria-invalid={!!apnError}
                    />
                    {apnError && <FieldError>{apnError}</FieldError>}
                  </Field>
                </div>

                {/* Row 2: PDP Type + Auth Type */}
                <div className="grid @md/card:grid-cols-2 grid-cols-1 grid-flow-row gap-4">
                  <Field>
                    <FieldLabel htmlFor={`wp-pdp-${profile.index}`}>
                      PDP 类型
                    </FieldLabel>
                    <Select
                      value={pdpType}
                      onValueChange={setPdpType}
                      disabled={isSaving}
                    >
                      <SelectTrigger
                        id={`wp-pdp-${profile.index}`}
                        aria-label="PDP 类型"
                      >
                        <SelectValue placeholder="选择 PDP 类型" />
                      </SelectTrigger>
                      <SelectContent>
                        {PDP_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor={`wp-auth-${profile.index}`}>
                      认证类型
                    </FieldLabel>
                    <Select
                      value={authType}
                      onValueChange={(v) => {
                        setAuthType(v);
                        if (v === "none") {
                          setUsername("");
                          setPassword("");
                        }
                      }}
                      disabled={isSaving}
                    >
                      <SelectTrigger
                        id={`wp-auth-${profile.index}`}
                        aria-label="认证类型"
                      >
                        <SelectValue placeholder="选择认证类型" />
                      </SelectTrigger>
                      <SelectContent>
                        {AUTH_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                {/* Row 3: Username + Password (conditional on auth type) */}
                {authType !== "none" && (
                  <div className="grid @md/card:grid-cols-2 grid-cols-1 grid-flow-row gap-4">
                    <Field>
                      <FieldLabel htmlFor={`wp-user-${profile.index}`}>
                        用户名
                      </FieldLabel>
                      <Input
                        id={`wp-user-${profile.index}`}
                        placeholder="用户名"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={isSaving}
                        autoComplete="username"
                      />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor={`wp-pass-${profile.index}`}>
                        密码
                      </FieldLabel>
                      <div className="relative">
                        <Input
                          id={`wp-pass-${profile.index}`}
                          type={showPassword ? "text" : "password"}
                          placeholder="密码"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          disabled={isSaving}
                          autoComplete="new-password"
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowPassword((v) => !v)}
                          tabIndex={-1}
                          aria-label={
                            showPassword ? "隐藏密码" : "显示密码"
                          }
                        >
                          {showPassword ? (
                            <EyeOffIcon className="size-4" />
                          ) : (
                            <EyeIcon className="size-4" />
                          )}
                        </Button>
                      </div>
                    </Field>
                  </div>
                )}

                {/* Row 4: MTU + Modem Profile */}
                <div className="grid @md/card:grid-cols-2 grid-cols-1 grid-flow-row gap-4">
                  <Field data-invalid={mtuError ? true : undefined}>
                    <FieldLabel htmlFor={`wp-mtu-${profile.index}`}>
                      MTU
                    </FieldLabel>
                    <Input
                      id={`wp-mtu-${profile.index}`}
                      type="number"
                      placeholder="1500 (default)"
                      min={1}
                      max={1500}
                      value={mtu}
                      onChange={(e) => {
                        setMtu(e.target.value);
                        if (mtuError) setMtuError("");
                      }}
                      disabled={isSaving}
                      aria-invalid={!!mtuError}
                    />
                    {mtuError && <FieldError>{mtuError}</FieldError>}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor={`wp-cid-${profile.index}`}>
                      调制解调器配置
                    </FieldLabel>
                    <Select
                      value={modemProfile}
                      onValueChange={setModemProfile}
                      disabled={isSaving}
                    >
                      <SelectTrigger
                        id={`wp-cid-${profile.index}`}
                        aria-label="调制解调器配置 (CID)"
                      >
                        <SelectValue placeholder="选择 CID" />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6].map((cid) => (
                          <SelectItem key={cid} value={String(cid)}>
                            CID {cid}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                {/* Rows 5-6 — wmmd-only controls; hidden on AT-only modems */}
                {showWmmdControls && (
                  <>
                {/* Row 5: VLAN Mapping (full width) */}
                <Field>
                  <FieldLabel htmlFor={`wp-vlan-${profile.index}`}>
                    映射到 LAN / VLAN
                  </FieldLabel>
                  <Select
                    value={vlanIndex || "_default"}
                    onValueChange={(v) => setVlanIndex(v === "_default" ? "" : v)}
                    disabled={isSaving}
                  >
                    <SelectTrigger
                      id={`wp-vlan-${profile.index}`}
                      aria-label="VLAN 映射"
                    >
                      <SelectValue placeholder="默认 (bridge0)" />
                    </SelectTrigger>
                    <SelectContent>
                      {VLAN_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value || "_default"}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {/* Row 6: Default Route + IP Passthrough toggles */}
                <div className="grid @md/card:grid-cols-2 grid-cols-1 gap-4">
                  <Field orientation="horizontal">
                    <div className="flex flex-auto items-center gap-1.5">
                      <FieldLabel htmlFor={`wp-default-route-${profile.index}`}>
                        默认路由
                      </FieldLabel>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex"
                            aria-label="什么是默认路由？"
                          >
                            <TbInfoCircleFilled className="size-4 text-info" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-56">
                            让本设备的互联网流量通过此配置连接。任意时刻只能有一个配置作为默认路由。
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Switch
                      id={`wp-default-route-${profile.index}`}
                      checked={defaultRoute}
                      onCheckedChange={setDefaultRoute}
                      disabled={isSaving}
                      aria-label="设为默认路由"
                    />
                  </Field>

                  <Field orientation="horizontal">
                    <div className="flex flex-auto items-center gap-1.5">
                      <FieldLabel htmlFor={`wp-passthrough-${profile.index}`}>
                        IP 透传
                      </FieldLabel>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex"
                            aria-label="什么是 IP 透传？"
                          >
                            <TbInfoCircleFilled className="size-4 text-info" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-56">
                            将调制解调器的公网 WAN IP 直接交给一个已连接设备并绕过 NAT，适合下游路由器、主机或服务器。
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Switch
                      id={`wp-passthrough-${profile.index}`}
                      checked={ipPassthrough}
                      onCheckedChange={setIpPassthrough}
                      disabled={isSaving}
                      aria-label="启用 IP 透传"
                    />
                  </Field>
                </div>
                  </>
                )}
              </FieldGroup>
            </FieldSet>

            {/* --- Actions --- */}
            <div className="flex items-center gap-2">
              {!carrier && (
                <SaveButton
                  type="submit"
                  isSaving={isSaving}
                  saved={saved}
                  label="保存配置"
                />
              )}
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSaving}
              >
                {carrier ? "返回" : "取消"}
              </Button>
            </div>
          </form>
        </fieldset>
      </CardContent>
    </Card>
  );
}
