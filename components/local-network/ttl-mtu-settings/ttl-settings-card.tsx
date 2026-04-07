"use client";

import { useState, useEffect, useMemo, useCallback } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SaveButton, useSaveFlash } from "@/components/ui/save-button";
import { InfoIcon } from "lucide-react";
import { toast } from "sonner";
import { useTtlSettings } from "@/hooks/use-ttl-settings";
import { useSimProfiles } from "@/hooks/use-sim-profiles";

// =============================================================================
// TTLSettingsCard — TTL/HL Configuration with SIM Profile Override
// =============================================================================
// When a Custom SIM Profile is active and has TTL > 0 or HL > 0, the
// form is disabled and an Alert banner informs the user that TTL/HL is
// managed by the active profile.  Same pattern as BandLocking ↔ Scenarios.
// =============================================================================

const TTLSettingsCard = () => {
  const { data, isLoading, isSaving, error, saveTtlHl } = useTtlSettings();
  const {
    activeProfileId,
    getProfile,
    isLoading: profilesLoading,
  } = useSimProfiles();

  // --- SIM Profile override check (async) ------------------------------------
  const [profileOverride, setProfileOverride] = useState<{
    profileId: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    if (!activeProfileId) return;

    let cancelled = false;
    (async () => {
      const profile = await getProfile(activeProfileId);
      if (cancelled) return;

      if (profile && (profile.settings.ttl > 0 || profile.settings.hl > 0)) {
        setProfileOverride({ profileId: activeProfileId, name: profile.name });
      } else {
        setProfileOverride(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProfileId, getProfile]);

  // Derive — no sync setState needed
  const isProfileControlled =
    !!activeProfileId && profileOverride?.profileId === activeProfileId;
  const profileName = isProfileControlled ? profileOverride.name : null;

  // --- Render ----------------------------------------------------------------
  const pageLoading = isLoading || profilesLoading;

  if (pageLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>TTL 与 Hop Limit 配置</CardTitle>
          <CardDescription>
            Set custom TTL (IPv4) and Hop Limit (IPv6) values applied to
            outbound packets on the cellular interface.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Key-based remount — form reinitializes when data changes
  const formKey = data
    ? `${data.isEnabled}-${data.ttl}-${data.hl}`
    : "empty";

  return (
    <TTLForm
      key={formKey}
      data={data}
      isSaving={isSaving}
      error={error}
      saveTtlHl={saveTtlHl}
      isProfileControlled={isProfileControlled}
      profileName={profileName}
    />
  );
};

function TTLForm({
  data,
  isSaving,
  error,
  saveTtlHl,
  isProfileControlled,
  profileName,
}: {
  data: ReturnType<typeof useTtlSettings>["data"];
  isSaving: boolean;
  error: string | null;
  saveTtlHl: ReturnType<typeof useTtlSettings>["saveTtlHl"];
  isProfileControlled: boolean;
  profileName: string | null;
}) {
  const { saved, markSaved } = useSaveFlash();

  // Form state initialized from data — no sync effect needed
  const [isEnabled, setIsEnabled] = useState(data?.isEnabled ?? false);
  const [ttlValue, setTtlValue] = useState(
    data && data.ttl > 0 ? String(data.ttl) : "",
  );
  const [hlValue, setHlValue] = useState(
    data && data.hl > 0 ? String(data.hl) : "",
  );

  const isDirty = useMemo(() => {
    if (!data) return false;
    const currentTtl = data.ttl > 0 ? String(data.ttl) : "";
    const currentHl = data.hl > 0 ? String(data.hl) : "";
    return (
      ttlValue !== currentTtl ||
      hlValue !== currentHl ||
      isEnabled !== data.isEnabled
    );
  }, [data, ttlValue, hlValue, isEnabled]);

  const handleToggle = useCallback((checked: boolean) => {
    setIsEnabled(checked);
    if (!checked) {
      setTtlValue("");
      setHlValue("");
    }
  }, []);

  const handleSave = useCallback(async () => {
    const ttl = isEnabled ? parseInt(ttlValue || "0", 10) : 0;
    const hl = isEnabled ? parseInt(hlValue || "0", 10) : 0;

    if (isEnabled && ttl === 0 && hl === 0) return;

    const success = await saveTtlHl(ttl, hl);
    if (success) {
      markSaved();
      toast.success(
        ttl > 0 || hl > 0
          ? `已应用，TTL：${ttl}，Hop Limit：${hl}`
          : "已关闭自定义 TTL/Hop Limit",
      );
    } else {
      toast.error(error || "应用 TTL/Hop Limit 设置失败");
    }
  }, [isEnabled, ttlValue, hlValue, saveTtlHl, error, markSaved]);

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>TTL 与 Hop Limit 配置</CardTitle>
        <CardDescription>
          Set custom TTL (IPv4) and Hop Limit (IPv6) values applied to outbound
          packets on the cellular interface.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isProfileControlled && (
          <Alert className="mb-4">
            <InfoIcon className="size-4" />
            <AlertDescription>
              <p>
                TTL/HL 配置当前由{" "}
                <span className="font-semibold">{profileName}</span> Custom SIM
                Profile.
              </p>
            </AlertDescription>
          </Alert>
        )}

        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <FieldSet disabled={isProfileControlled}>
            <FieldGroup>
              <div className="grid gap-2">
                <Field orientation="horizontal" className="w-fit">
                  <FieldLabel htmlFor="ttl-setting">
                    启用自定义 TTL/HL
                  </FieldLabel>
                  <Switch
                    id="ttl-setting"
                    checked={isEnabled}
                    onCheckedChange={handleToggle}
                    disabled={isProfileControlled}
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="ttl-value">TTL 值</FieldLabel>
                <Input
                  id="ttl-value"
                  type="number"
                  min="1"
                  max="255"
                  placeholder="例如：64"
                  className="w-full"
                  value={ttlValue}
                  onChange={(e) => setTtlValue(e.target.value)}
                  disabled={!isEnabled || isProfileControlled}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="hl-value">
                  Hop Limit（HL）值
                </FieldLabel>
                <Input
                  id="hl-value"
                  type="number"
                  min="1"
                  max="255"
                  placeholder="例如：64"
                  className="w-full"
                  value={hlValue}
                  onChange={(e) => setHlValue(e.target.value)}
                  disabled={!isEnabled || isProfileControlled}
                />
              </Field>

              {isEnabled && !ttlValue && !hlValue && (
                <FieldError id="ttl-hl-error">
                  请至少输入一个 TTL 或 Hop Limit 值
                </FieldError>
              )}
            </FieldGroup>
          </FieldSet>
          <div>
            <SaveButton
              type="submit"
              isSaving={isSaving}
              saved={saved}
              label="应用"
              disabled={isProfileControlled || !isDirty}
            />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default TTLSettingsCard;
