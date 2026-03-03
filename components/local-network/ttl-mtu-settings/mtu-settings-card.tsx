"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMtuSettings } from "@/hooks/use-mtu-settings";

// =============================================================================
// MTUSettingsCard — MTU Configuration
// =============================================================================
// Connected to the useMtuSettings hook for fetching and saving MTU.
// Toggle on/off enables or disables custom MTU across rmnet_data interfaces.
// =============================================================================

const MTUSettingsCard = () => {
  const { data, isLoading, isSaving, error, saveMtu, disableMtu } =
    useMtuSettings();

  // --- Local form state -------------------------------------------------------
  const [isEnabled, setIsEnabled] = useState(false);
  const [mtuValue, setMtuValue] = useState("");

  // When data arrives, sync local form state
  useEffect(() => {
    if (data) {
      setIsEnabled(data.isEnabled);
      setMtuValue(String(data.currentValue));
    }
  }, [data]);

  // --- Form is dirty check ---------------------------------------------------
  const isDirty = useMemo(() => {
    if (!data) return false;
    return (
      mtuValue !== String(data.currentValue) || isEnabled !== data.isEnabled
    );
  }, [data, mtuValue, isEnabled]);

  // --- Handle toggle ---------------------------------------------------------
  const handleToggle = useCallback(
    (checked: boolean) => {
      setIsEnabled(checked);
      if (!checked && data) {
        // When turning off, reset to current interface value
        setMtuValue(String(data.currentValue));
      }
    },
    [data],
  );

  // --- Handle save -----------------------------------------------------------
  const handleSave = useCallback(async () => {
    if (!isEnabled) {
      // Disable custom MTU
      const success = await disableMtu();
      if (success) {
        toast.success("Custom MTU disabled");
      } else {
        toast.error(error || "Failed to disable MTU");
      }
      return;
    }

    const mtu = parseInt(mtuValue, 10);
    if (isNaN(mtu) || mtu < 576 || mtu > 9000) {
      toast.error("MTU must be between 576 and 9000");
      return;
    }

    const success = await saveMtu(mtu);
    if (success) {
      toast.success(`MTU set to ${mtu}`);
    } else {
      toast.error(error || "Failed to apply MTU");
    }
  }, [isEnabled, mtuValue, saveMtu, disableMtu, error]);

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Maximum Transmission Unit (MTU) Configuration</CardTitle>
        <CardDescription>
          Manage Maximum Transmission Unit (MTU) settings for your network
          devices.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid gap-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-full max-w-sm" />
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
                <div className="grid gap-2">
                  <Field orientation="horizontal" className="w-fit">
                    <FieldLabel htmlFor="mtu-setting">
                      Enable Custom MTU
                    </FieldLabel>
                    <Switch
                      id="mtu-setting"
                      checked={isEnabled}
                      onCheckedChange={handleToggle}
                    />
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="mtu-value">MTU Value</FieldLabel>
                  <Input
                    id="mtu-value"
                    type="number"
                    min="576"
                    max="9000"
                    placeholder="e.g. 1500"
                    className="max-w-sm"
                    value={mtuValue}
                    onChange={(e) => setMtuValue(e.target.value)}
                    disabled={!isEnabled}
                  />
                </Field>

                <Button
                  type="submit"
                  className="w-fit"
                  disabled={isSaving || !isDirty}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Applying…
                    </>
                  ) : (
                    "Apply"
                  )}
                </Button>
              </FieldGroup>
            </FieldSet>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

export default MTUSettingsCard;
