"use client";

import { useState, useEffect, useMemo, useCallback } from "react";

import { SaveButton, useSaveFlash } from "@/components/ui/save-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Field, FieldError, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useDnsSettings } from "@/hooks/use-dns-settings";

// =============================================================================
// CustomDNSCard — Custom DNS Configuration
// =============================================================================
// Lets users replace carrier-assigned DNS with custom servers (e.g. Cloudflare,
// Google). The active NIC (lan vs lan_bind4) is determined by the backend based
// on IP passthrough state.
// =============================================================================

const CustomDNSCard = () => {
  const { data, isLoading, isSaving, error, saveDns, refresh } = useDnsSettings();
  const { saved, markSaved } = useSaveFlash();

  // --- Local form state -------------------------------------------------------
  const [isEnabled, setIsEnabled] = useState(false);
  const [dns1, setDns1] = useState("");
  const [dns2, setDns2] = useState("");
  const [dns3, setDns3] = useState("");

  // Sync local state when data arrives from the backend
  useEffect(() => {
    if (data) {
      setIsEnabled(data.mode === "enabled");
      setDns1(data.dns1);
      setDns2(data.dns2);
      setDns3(data.dns3);
    }
  }, [data]);

  // --- Dirty check: save button enabled only when something changed ----------
  const isDirty = useMemo(() => {
    if (!data) return false;
    return (
      isEnabled !== (data.mode === "enabled") ||
      dns1 !== data.dns1 ||
      dns2 !== data.dns2 ||
      dns3 !== data.dns3
    );
  }, [data, isEnabled, dns1, dns2, dns3]);

  // --- Handle toggle ---------------------------------------------------------
  const handleToggle = useCallback((checked: boolean) => {
    setIsEnabled(checked);
  }, []);

  // --- Handle save -----------------------------------------------------------
  const handleSave = useCallback(async () => {
    if (!data) return;

    // Guard: when enabling, require at least one DNS server
    if (isEnabled && !dns1 && !dns2 && !dns3) return;

    const success = await saveDns({
      mode: isEnabled ? "enabled" : "disabled",
      nic: data.nic,
      dns1,
      dns2,
      dns3,
    });

    if (success) {
      markSaved();
      toast.success(
        isEnabled
          ? "Custom DNS applied successfully"
          : "Reverted to carrier DNS",
      );
    } else {
      toast.error(error || "Failed to apply DNS settings — check connection");
    }
  }, [data, isEnabled, dns1, dns2, dns3, saveDns, error, markSaved]);

  // --- Render ----------------------------------------------------------------
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Custom DNS Configuration</CardTitle>
        <CardDescription>
          Override carrier DNS servers for all devices on your local network.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && !isLoading && (
          <div className="flex items-center justify-between gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 mb-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 text-destructive hover:text-destructive"
              onClick={refresh}
            >
              Retry
            </Button>
          </div>
        )}
        {isLoading ? (
          <div className="grid gap-4">
            <Skeleton className="h-8 w-48" />
            <div className="grid @md/card:grid-cols-2 grid-cols-1 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <FieldSet>
              <FieldGroup>
                <Field orientation="horizontal" className="w-fit">
                  <FieldLabel htmlFor="custom-dns">Enable Custom DNS</FieldLabel>
                  <Switch
                    id="custom-dns"
                    checked={isEnabled}
                    onCheckedChange={handleToggle}
                  />
                </Field>

                <div className="grid @md/card:grid-cols-2 grid-cols-1 grid-flow-row gap-4">
                  <Field>
                    <FieldLabel htmlFor="primary-dns">
                      Primary DNS Server
                    </FieldLabel>
                    <Input
                      id="primary-dns"
                      placeholder="e.g. 8.8.8.8"
                      value={dns1}
                      onChange={(e) => setDns1(e.target.value)}
                      disabled={!isEnabled}
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="secondary-dns">
                      Secondary DNS Server
                    </FieldLabel>
                    <Input
                      id="secondary-dns"
                      placeholder="e.g. 1.1.1.1"
                      value={dns2}
                      onChange={(e) => setDns2(e.target.value)}
                      disabled={!isEnabled}
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="tertiary-dns">
                      Tertiary DNS Server{" "}
                      <span className="text-muted-foreground font-normal">
                        (optional)
                      </span>
                    </FieldLabel>
                    <Input
                      id="tertiary-dns"
                      placeholder="e.g. 8.8.4.4"
                      value={dns3}
                      onChange={(e) => setDns3(e.target.value)}
                      disabled={!isEnabled}
                    />
                  </Field>
                </div>

                {isEnabled && !dns1 && !dns2 && !dns3 && (
                  <FieldError id="dns-error">
                    Enter at least one DNS server address
                  </FieldError>
                )}

                <SaveButton
                  type="submit"
                  isSaving={isSaving}
                  saved={saved}
                  label="Apply"
                  className="w-fit"
                  disabled={!isDirty || (isEnabled && !dns1 && !dns2 && !dns3)}
                />
              </FieldGroup>
            </FieldSet>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

export default CustomDNSCard;
