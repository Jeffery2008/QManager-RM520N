"use client";

import React, { useState, useMemo } from "react";

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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { DownloadIcon } from "lucide-react";
import { toast } from "sonner";

import type { SimProfile, CurrentModemSettings } from "@/types/sim-profile";
import type { ProfileFormData } from "@/hooks/use-sim-profiles";
import {
  PDP_TYPE_LABELS,
  type PdpType,
} from "@/types/sim-profile";
import {
  MNO_PRESETS,
  MNO_CUSTOM_ID,
  getMnoPreset,
} from "@/constants/mno-presets";

// =============================================================================
// CustomProfileFormComponent — Create / Edit SIM Profile Form
// =============================================================================

interface CustomProfileFormProps {
  editingProfile?: SimProfile | null;
  onSave: (data: ProfileFormData) => Promise<string | null>;
  onCancel?: () => void;
  /** Current modem settings for pre-fill (from useCurrentSettings) */
  currentSettings?: CurrentModemSettings | null;
  /** Callback to trigger loading current modem settings */
  onLoadCurrentSettings?: () => void;
}

const DEFAULT_FORM_STATE: ProfileFormData = {
  name: "",
  mno: "Custom",
  sim_iccid: "",
  cid: 1,
  apn_name: "",
  pdp_type: "IPV4V6",
  imei: "",
  ttl: 64,
  hl: 64,
};

function profileToFormData(profile: SimProfile): ProfileFormData {
  const s = profile.settings;
  return {
    name: profile.name,
    mno: profile.mno,
    sim_iccid: profile.sim_iccid,
    cid: s.apn.cid,
    apn_name: s.apn.name,
    pdp_type: s.apn.pdp_type,
    imei: s.imei,
    ttl: s.ttl,
    hl: s.hl,
  };
}

const CustomProfileFormComponent = ({
  editingProfile,
  onSave,
  onCancel,
  currentSettings,
  onLoadCurrentSettings,
}: CustomProfileFormProps) => {
  const [form, setForm] = useState<ProfileFormData>(DEFAULT_FORM_STATE);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = !!editingProfile;

  // Derive MNO selection from form.mno — no separate state needed
  const selectedMno = useMemo(() => {
    const match = MNO_PRESETS.find((p) => p.label === form.mno);
    return match ? match.id : MNO_CUSTOM_ID;
  }, [form.mno]);

  // Reset form when the editing target changes (React-recommended pattern:
  // compare previous prop during render instead of syncing via useEffect)
  const [prevEditingId, setPrevEditingId] = useState<string | null>(null);
  const currentEditingId = editingProfile?.id ?? null;

  if (currentEditingId !== prevEditingId) {
    setPrevEditingId(currentEditingId);
    setForm(
      editingProfile ? profileToFormData(editingProfile) : DEFAULT_FORM_STATE,
    );
    setErrors({});
  }

  // Pre-fill from current modem settings when loaded (create mode only)
  // Compare during render instead of useEffect to avoid cascading setState.
  const [prevSettings, setPrevSettings] = useState<CurrentModemSettings | null>(
    null,
  );

  if (currentSettings && currentSettings !== prevSettings && !isEditing) {
    setPrevSettings(currentSettings);
    const apnPrefill =
      currentSettings.apn_profiles?.length > 0
        ? (() => {
            const activeCid = currentSettings.active_cid;
            const primary =
              currentSettings.apn_profiles.find((a) => a.cid === activeCid) ||
              currentSettings.apn_profiles[0];
            return {
              cid: primary.cid,
              apn_name: primary.apn || "",
              pdp_type: primary.pdp_type || "IPV4V6",
            };
          })()
        : {};

    setForm((prev) => ({
      ...prev,
      sim_iccid: currentSettings.iccid || prev.sim_iccid,
      imei: currentSettings.imei || prev.imei,
      ...apnPrefill,
    }));
  }

  const updateField = <K extends keyof ProfileFormData>(
    key: K,
    value: ProfileFormData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleMnoChange = (mnoId: string) => {
    const preset = getMnoPreset(mnoId);
    if (preset) {
      setForm((prev) => ({
        ...prev,
        mno: preset.label,
        apn_name: preset.apn_name,
        ttl: preset.ttl,
        hl: preset.hl,
      }));
    } else {
      setForm((prev) => ({ ...prev, mno: "Custom" }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.name.trim()) {
      newErrors.name = "Profile name is required.";
    }

    if (form.cid < 1 || form.cid > 15) {
      newErrors.cid = "CID must be 1–15.";
    }

    if (form.imei && !/^\d{15}$/.test(form.imei)) {
      newErrors.imei = "IMEI must be exactly 15 digits.";
    }

    if (form.ttl < 0 || form.ttl > 255) {
      newErrors.ttl = "TTL must be 0–255.";
    }

    if (form.hl < 0 || form.hl > 255) {
      newErrors.hl = "HL must be 0–255.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSaving(true);
    const result = await onSave(form);
    setIsSaving(false);

    if (result) {
      toast.success(
        isEditing
          ? "Profile updated successfully."
          : "Profile created successfully.",
      );
      if (!isEditing) {
        setForm(DEFAULT_FORM_STATE);
      }
    } else {
      toast.error(
        isEditing
          ? "Failed to update profile."
          : "Failed to create profile.",
      );
    }
  };

  const handleReset = () => {
    if (isEditing && onCancel) {
      onCancel();
    } else {
      setForm(DEFAULT_FORM_STATE);
      setErrors({});
    }
  };

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>
          {isEditing ? "Edit Profile" : "Create Custom SIM Profile"}
        </CardTitle>
        <CardDescription>
          {isEditing
            ? `Editing "${editingProfile?.name}". Update the fields below.`
            : "Create a custom SIM profile with specific APN, TTL, and IMEI settings."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex w-full justify-end">
          {!isEditing && onLoadCurrentSettings && (
            <Button type="button" size="sm" onClick={onLoadCurrentSettings}>
              <DownloadIcon className="size-4" />
              Load Current SIM
            </Button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <FieldSet>
            <FieldGroup>
              {/* --- Profile Identity --- */}
              <div className="grid grid-cols-1 @md/card:grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="profileName">Profile Name *</FieldLabel>
                  <Input
                    id="profileName"
                    type="text"
                    placeholder="My LTE Profile"
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    aria-describedby={errors.name ? "profileName-error" : undefined}
                  />
                  {errors.name && <FieldError id="profileName-error">{errors.name}</FieldError>}
                </Field>

                <Field>
                  <FieldLabel htmlFor="simIccid">SIM ICCID</FieldLabel>
                  <Input
                    id="simIccid"
                    type="text"
                    placeholder="Auto-filled from current SIM"
                    value={form.sim_iccid}
                    onChange={(e) => updateField("sim_iccid", e.target.value)}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 @md/card:grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>Mobile Network Operator</FieldLabel>
                  <Select value={selectedMno} onValueChange={handleMnoChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select carrier…" />
                    </SelectTrigger>
                    <SelectContent>
                      {MNO_PRESETS.map((preset) => (
                        <SelectItem key={preset.id} value={preset.id}>
                          {preset.label}
                        </SelectItem>
                      ))}
                      <SelectItem value={MNO_CUSTOM_ID}>Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="apnName">APN Name</FieldLabel>
                  <Input
                    id="apnName"
                    type="text"
                    placeholder="internet"
                    value={form.apn_name}
                    onChange={(e) => updateField("apn_name", e.target.value)}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 @md/card:grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>IP Protocol</FieldLabel>
                  <Select
                    value={form.pdp_type}
                    onValueChange={(v) => updateField("pdp_type", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.entries(PDP_TYPE_LABELS) as [PdpType, string][]
                      ).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="apnCid">Profile Slot (CID)</FieldLabel>
                  <Input
                    id="apnCid"
                    type="number"
                    min={1}
                    max={15}
                    value={form.cid}
                    onChange={(e) =>
                      updateField("cid", parseInt(e.target.value) || 1)
                    }
                    aria-describedby={errors.cid ? "apnCid-error" : undefined}
                  />
                  {errors.cid && <FieldError id="apnCid-error">{errors.cid}</FieldError>}
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="imei">Preferred IMEI</FieldLabel>
                <Input
                  id="imei"
                  type="text"
                  placeholder="Leave blank to keep current IMEI"
                  maxLength={15}
                  value={form.imei}
                  onChange={(e) => updateField("imei", e.target.value)}
                  aria-describedby={errors.imei ? "imei-error" : undefined}
                />
                {errors.imei && <FieldError id="imei-error">{errors.imei}</FieldError>}
              </Field>

              <div className="grid grid-cols-1 @md/card:grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="ttl">TTL Value</FieldLabel>
                  <Input
                    id="ttl"
                    type="number"
                    min={0}
                    max={255}
                    value={form.ttl}
                    onChange={(e) =>
                      updateField("ttl", parseInt(e.target.value) || 0)
                    }
                    aria-describedby={errors.ttl ? "ttl-error" : undefined}
                  />
                  {errors.ttl && <FieldError id="ttl-error">{errors.ttl}</FieldError>}
                </Field>
                <Field>
                  <FieldLabel htmlFor="hl">Hop Limit</FieldLabel>
                  <Input
                    id="hl"
                    type="number"
                    min={0}
                    max={255}
                    value={form.hl}
                    onChange={(e) =>
                      updateField("hl", parseInt(e.target.value) || 0)
                    }
                    aria-describedby={errors.hl ? "hl-error" : undefined}
                  />
                  {errors.hl && <FieldError id="hl-error">{errors.hl}</FieldError>}
                </Field>
              </div>

              {/* --- Actions --- */}
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Spinner className="size-4" />}
                  {isEditing ? "Update Profile" : "Create Profile"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  disabled={isSaving}
                >
                  {isEditing ? "Cancel" : "Reset"}
                </Button>
              </div>
            </FieldGroup>
          </FieldSet>
        </form>
      </CardContent>
    </Card>
  );
};

export default CustomProfileFormComponent;