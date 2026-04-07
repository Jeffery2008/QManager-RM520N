"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { FolderOpenIcon, WrenchIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/auth-fetch";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MNO_PRESETS,
  MNO_CUSTOM_ID,
  getMnoPreset,
} from "@/constants/mno-presets";

// =============================================================================
// StepConnection — Onboarding step 4: APN or Custom SIM Profile (optional)
// =============================================================================

const APN_ENDPOINT = "/cgi-bin/quecmanager/cellular/apn.sh";
const PROFILES_ENDPOINT = "/cgi-bin/quecmanager/profiles/save.sh";

type ConnectionType = "profile" | "apn" | null;

interface StepConnectionProps {
  onSubmitRef: (fn: () => Promise<void>) => void;
  onLoadingChange: (loading: boolean) => void;
  onSuccess: () => void;
}

export function StepConnection({
  onSubmitRef,
  onLoadingChange,
  onSuccess,
}: StepConnectionProps) {
  const [selectedType, setSelectedType] = useState<ConnectionType>(null);

  // Shared form state
  const [mno, setMno] = useState("");
  const [apnName, setApnName] = useState("");
  const [pdpType, setPdpType] = useState("IPV4V6");
  const [profileName, setProfileName] = useState("");
  const [formError, setFormError] = useState("");

  const handleTypeSelect = (type: "profile" | "apn") => {
    setSelectedType(type);
    setFormError("");
  };

  // When a carrier preset is picked, auto-fill APN
  const handleMnoChange = (id: string) => {
    setMno(id);
    const preset = getMnoPreset(id);
    if (preset) {
      setApnName(preset.apn_name);
    } else if (id === MNO_CUSTOM_ID) {
      setApnName("");
    }
  };

  const submit = useCallback(async () => {
    setFormError("");

    // No selection = skip
    if (selectedType === null) {
      onSuccess();
      return;
    }

    if (!apnName.trim()) {
      setFormError("APN 名称不能为空。");
      return;
    }

    if (selectedType === "profile" && !profileName.trim()) {
      setFormError("配置名称不能为空。");
      return;
    }

    onLoadingChange(true);
    try {
      if (selectedType === "apn") {
        await authFetch(APN_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cid: 1, pdp_type: pdpType, apn: apnName }),
        });
      } else {
        // Profile creation
        const preset = getMnoPreset(mno);
        await authFetch(PROFILES_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: profileName,
            mno: mno || MNO_CUSTOM_ID,
            sim_iccid: "",
            cid: 1,
            apn_name: apnName,
            pdp_type: pdpType,
            imei: "",
            ttl: preset?.ttl ?? 0,
            hl: preset?.hl ?? 0,
          }),
        });
      }
    } catch {
      // Non-fatal: connection setup is optional
    } finally {
      onLoadingChange(false);
      onSuccess();
    }
  }, [selectedType, apnName, pdpType, profileName, mno, onLoadingChange, onSuccess]);

  useEffect(() => {
    onSubmitRef(submit);
  }, [submit, onSubmitRef]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-2xl font-semibold tracking-tight">
          配置连接
        </h2>
        <p className="text-sm text-muted-foreground">
          设置数据 APN，或创建一个自定义 SIM 配置。
        </p>
      </div>

      {/* Choice cards */}
      <div className="grid grid-cols-2 gap-3">
        <ChoiceCard
          selected={selectedType === "profile"}
          onClick={() => handleTypeSelect("profile")}
          icon={<FolderOpenIcon className="size-5" />}
          title="自定义配置"
          description="为每张 SIM 保存完整配置"
        />
        <ChoiceCard
          selected={selectedType === "apn"}
          onClick={() => handleTypeSelect("apn")}
          icon={<WrenchIcon className="size-5" />}
          title="仅 APN"
          description="快速适配你的运营商"
        />
      </div>

      {/* Inline form — animates in when a type is selected */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          selectedType !== null ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
        <div className="flex flex-col gap-4 border-t border-border pt-4">
          <FieldGroup>
            {selectedType === "profile" && (
              <Field>
                <FieldLabel htmlFor="conn-profile-name">配置名称</FieldLabel>
                <Input
                  id="conn-profile-name"
                  placeholder="例如：家庭卡、纯流量卡"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                />
              </Field>
            )}

            <Field>
              <FieldLabel htmlFor="conn-carrier">运营商预设</FieldLabel>
              <Select value={mno} onValueChange={handleMnoChange}>
                <SelectTrigger id="conn-carrier">
                  <SelectValue placeholder="选择运营商…" />
                </SelectTrigger>
                <SelectContent>
                  {MNO_PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                  <SelectItem value={MNO_CUSTOM_ID}>自定义</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="conn-apn">APN 名称</FieldLabel>
              <Input
                id="conn-apn"
                placeholder="例如：internet、SMARTLTE"
                value={apnName}
                onChange={(e) => setApnName(e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="conn-pdp">IP 协议</FieldLabel>
              <Select value={pdpType} onValueChange={setPdpType}>
                <SelectTrigger id="conn-pdp">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IPV4V6">IPv4 + IPv6（默认）</SelectItem>
                  <SelectItem value="IP">仅 IPv4</SelectItem>
                  <SelectItem value="IPV6">仅 IPv6</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            {formError && <FieldError>{formError}</FieldError>}
          </FieldGroup>
        </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChoiceCard — selectable card for profile vs APN choice
// ---------------------------------------------------------------------------

interface ChoiceCardProps {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}

function ChoiceCard({
  selected,
  onClick,
  icon,
  title,
  description,
}: ChoiceCardProps) {
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 600, damping: 30 }}
      className={cn(
        "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors duration-150",
        "hover:border-primary/50 hover:bg-primary/5",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border bg-card"
      )}
    >
      <span
        className={cn(
          "rounded-lg p-2 transition-colors duration-150",
          selected
            ? "bg-primary/15 text-primary"
            : "bg-muted text-muted-foreground"
        )}
      >
        {icon}
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium leading-snug">{title}</span>
        <span className="text-xs text-muted-foreground leading-snug">
          {description}
        </span>
      </div>
    </motion.button>
  );
}
