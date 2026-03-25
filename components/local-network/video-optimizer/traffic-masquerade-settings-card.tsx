"use client";

import { useCallback, useState, useMemo } from "react";
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
  FieldDescription,
  FieldGroup,
  FieldSet,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SaveButton, useSaveFlash } from "@/components/ui/save-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Info, Loader2, Zap } from "lucide-react";
import { TbAlertTriangleFilled } from "react-icons/tb";
import { useTrafficMasquerade } from "@/hooks/use-traffic-masquerade";

function MasqueradeSkeleton() {
  return (
    <Card className="@container/card">
      <CardHeader>
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-4 w-72" />
      </CardHeader>
      <CardContent className="grid gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "running") {
    return (
      <Badge
        variant="outline"
        className="border-green-500/30 bg-green-500/10 text-green-500"
      >
        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-green-500" />
        Active
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-muted-foreground/30 bg-muted/50 text-muted-foreground"
    >
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground" />
      Inactive
    </Badge>
  );
}

interface TrafficMasqueradeSettingsCardProps {
  hook: ReturnType<typeof useTrafficMasquerade>;
  otherActive?: boolean;
  onSaved?: () => void;
}

export default function TrafficMasqueradeSettingsCard({
  hook,
  otherActive = false,
  onSaved,
}: TrafficMasqueradeSettingsCardProps) {
  const { settings, isLoading, isSaving, error, saveSettings, testResult, runTest } = hook;

  const [isEnabled, setIsEnabled] = useState(false);
  const [sniDomain, setSniDomain] = useState("speedtest.net");
  const { saved, markSaved } = useSaveFlash();

  // Sync settings to local form state
  const [formKey, setFormKey] = useState(0);
  if (settings && formKey === 0) {
    setIsEnabled(settings.enabled);
    setSniDomain(settings.sni_domain || "speedtest.net");
    setFormKey(1);
  }

  const isDirty = useMemo(() => {
    if (!settings) return false;
    return (
      isEnabled !== settings.enabled || sniDomain !== settings.sni_domain
    );
  }, [settings, isEnabled, sniDomain]);

  const sniError = useMemo(() => {
    if (!sniDomain.trim()) return "Domain is required";
    if (!/^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(sniDomain))
      return "Invalid domain format";
    if (!sniDomain.includes(".")) return "Must contain at least one dot";
    if (sniDomain.length > 253) return "Domain too long (max 253 chars)";
    return null;
  }, [sniDomain]);

  const handleSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (sniError) return;

      const success = await saveSettings(isEnabled, sniDomain);
      if (success) {
        markSaved();
        toast.success(
          isEnabled
            ? "Traffic Masquerade enabled"
            : "Traffic Masquerade disabled"
        );
        onSaved?.();
      } else {
        toast.error(error || "Failed to save settings");
      }
    },
    [isEnabled, sniDomain, sniError, saveSettings, markSaved, error, onSaved]
  );

  if (isLoading) return <MasqueradeSkeleton />;

  const canEnable =
    settings?.binary_installed && settings?.kernel_module_loaded && !otherActive;
  const canToggle = canEnable || settings?.enabled;
  const isRunning = settings?.status === "running";

  return (
    <Card className="@container/card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Traffic Masquerade</CardTitle>
            <CardDescription>
              Make HTTPS traffic appear as a whitelisted service to carrier DPI
              by injecting fake TLS handshakes with a spoofed domain.
            </CardDescription>
          </div>
          {settings && <StatusBadge status={settings.status} />}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-2 p-2 rounded-md bg-warning/10 border border-warning/30 text-warning text-sm mb-4">
          <TbAlertTriangleFilled className="size-5 mt-0.5 shrink-0" />
          <p className="font-semibold">Experimental Feature</p>
        </div>

        <div className="flex items-start gap-2 p-2 rounded-md bg-info/10 border border-info/30 text-info text-sm mb-4">
          <Info className="size-4 mt-0.5 shrink-0" />
          <p>
            This sends fake TLS handshakes with a spoofed domain name. Some
            carriers may detect this behavior and de-prioritize your connection.
            Use at your own risk.
          </p>
        </div>

        {!settings?.binary_installed && (
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Requires the <code>nfqws</code> binary. Install it from the Video
              Optimizer card.
            </AlertDescription>
          </Alert>
        )}

        {settings?.binary_installed && !settings?.kernel_module_loaded && (
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Required kernel module not found. Run{" "}
              <code className="text-xs">opkg install kmod-nft-queue</code> on
              the device.
            </AlertDescription>
          </Alert>
        )}

        {otherActive && (
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Video Optimizer is currently active. Disable it first before
              enabling Traffic Masquerade.
            </AlertDescription>
          </Alert>
        )}

        <form className="grid gap-4" onSubmit={handleSave}>
          <FieldSet>
            <FieldGroup>
              <Field orientation="horizontal" className="w-fit">
                <label
                  htmlFor="masq-enabled"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Enable Traffic Masquerade
                </label>
                <Switch
                  id="masq-enabled"
                  checked={isEnabled}
                  onCheckedChange={setIsEnabled}
                  disabled={!canToggle || isSaving}
                  aria-label="Enable Traffic Masquerade"
                />
              </Field>
              <p className="text-xs text-muted-foreground -mt-2">
                Inject fake TLS handshakes to masquerade traffic as a
                whitelisted service
              </p>

              <Field>
                <label
                  htmlFor="sni-domain"
                  className="text-sm font-medium leading-none"
                >
                  Masquerade Domain
                </label>
                <Input
                  id="sni-domain"
                  type="text"
                  value={sniDomain}
                  onChange={(e) => setSniDomain(e.target.value)}
                  disabled={!isEnabled || !canEnable || isSaving}
                  placeholder="speedtest.net"
                  className="max-w-sm"
                  aria-invalid={!!sniError && isEnabled}
                  aria-describedby="sni-desc"
                />
                {sniError && isEnabled ? (
                  <p className="text-xs text-destructive">{sniError}</p>
                ) : (
                  <FieldDescription id="sni-desc">
                    Carriers typically whitelist speedtest domains to ensure
                    accurate speed tests
                  </FieldDescription>
                )}
              </Field>

              {isRunning && settings && (
                <>
                  <div className="h-px bg-border" />
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Uptime", value: settings.uptime },
                      {
                        label: "Packets Processed",
                        value: settings.packets_processed.toLocaleString(),
                      },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-lg bg-muted/50 p-3"
                      >
                        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          {stat.label}
                        </div>
                        <div className="mt-1 text-base font-semibold">
                          {stat.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {isRunning && (
                <>
                  <div className="h-px bg-border" />
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-medium">Test Injection</h4>
                      <p className="text-xs text-muted-foreground">
                        Make an HTTPS request and verify packets are being
                        intercepted
                      </p>
                    </div>

                    {testResult.status === "complete" && (
                      <div
                        className={`flex items-center gap-2 p-2.5 rounded-lg text-sm ${
                          testResult.injected
                            ? "bg-green-500/10 border border-green-500/30 text-green-500"
                            : "bg-destructive/10 border border-destructive/30 text-destructive"
                        }`}
                      >
                        {testResult.injected ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                        )}
                        <p>{testResult.message}</p>
                      </div>
                    )}

                    {testResult.status === "error" && testResult.error && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{testResult.error}</AlertDescription>
                      </Alert>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={runTest}
                      disabled={testResult.status === "running"}
                    >
                      {testResult.status === "running" ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <Zap className="mr-2 h-4 w-4" />
                          Test Injection
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}

              <div className="h-px bg-border" />

              <SaveButton
                type="submit"
                isSaving={isSaving}
                saved={saved}
                disabled={!isDirty || !canToggle || (isEnabled && !!sniError)}
              />
            </FieldGroup>
          </FieldSet>
        </form>
      </CardContent>
    </Card>
  );
}
