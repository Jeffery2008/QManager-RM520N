"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";
import { AlertCircleIcon } from "lucide-react";

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
import { Button } from "@/components/ui/button";
import { CardFoot } from "@/components/ui/card-foot";
import { SaveButton } from "@/components/ui/save-button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { FOOT, HERO_PAD, SKELETON } from "./shapes";
import { FIELD_LABEL_KEY, type WatchdogForm } from "./use-watchdog-form";

/** A real list for the active locale: separator and conjunction are language facts. */
function formatList(items: string[], language: string): string {
  if (items.length === 0) return "";
  try {
    return new Intl.ListFormat(language, {
      style: "long",
      type: "conjunction",
    }).format(items);
  } catch {
    return items.join(", ");
  }
}

/**
 * The one commit for the whole surface, on the Ladder card's bottom edge. It
 * covers Detection's fields too, so its status names the card that holds them.
 */
export function WatchdogFoot({ form }: { form: WatchdogForm }) {
  const { t, i18n } = useTranslation("common");
  const blocked = form.blockedFields.length > 0;

  const nameList = formatList(
    form.blockedFields.map((key) => t(FIELD_LABEL_KEY[key])),
    i18n.language,
  );
  const ladderDirty =
    form.masterDirty || Object.values(form.tierDirty).some(Boolean);
  const cardList = formatList(
    [
      ...(ladderDirty ? [t("watchdog.ladder.title")] : []),
      ...(form.detectionDirty ? [t("watchdog.detection.title")] : []),
    ],
    i18n.language,
  );

  const [confirmReboot, setConfirmReboot] = React.useState(false);
  const saveWrapRef = React.useRef<HTMLSpanElement | null>(null);

  // The gate is here, not on the tier-4 switch: a stock device seeds tier 4
  // armed under a master that is off, so a switch-level intercept never fires.
  const handleSave = () => {
    if (form.grantsRebootAuthority) {
      setConfirmReboot(true);
      return;
    }
    void form.submit();
  };

  // `SaveButton` stops the event while `blockedReason` is set, so the jump to
  // the offending field runs in the capture phase, Enter on the button included.
  const jumpToBlocked = () => {
    if (blocked) form.focusFirstBlocked();
  };

  return (
    <>
      <CardFoot
        className={HERO_PAD}
        status={
          form.isDirty && blocked ? (
            <span className={cn(FOOT.LINE, "text-destructive-on-surface")}>
              <AlertCircleIcon className="size-3.5 flex-none" aria-hidden />
              <span className="font-medium text-pretty">
                {t("watchdog.save.blockedIn", { fields: nameList })}
              </span>
            </span>
          ) : form.isDirty ? (
            <span className={FOOT.LINE}>
              <span className={FOOT.DOT} aria-hidden />
              <span className="text-on-surface font-medium text-pretty">
                {t("watchdog.save.dirty", { cards: cardList })}
              </span>
            </span>
          ) : (
            <span className="text-pretty">{t("watchdog.save.clean")}</span>
          )
        }
        actions={
          <>
            <Button
              type="button"
              variant="ghost"
              size="action"
              className="text-on-surface-variant"
              onClick={form.discard}
              disabled={!form.isDirty || form.isSaving}
            >
              {t("watchdog.save.discard")}
            </Button>
            <span ref={saveWrapRef} className="contents" onClickCapture={jumpToBlocked}>
              <SaveButton
                type="button"
                size="action"
                label={t("watchdog.save.action")}
                isSaving={form.isSaving}
                saved={form.saved}
                blockedReason={
                  form.isDirty && blocked
                    ? t("watchdog.save.blockedIn", { fields: nameList })
                    : null
                }
                disabled={!form.isDirty || form.isSaving}
                onClick={handleSave}
              />
            </span>
          </>
        }
      />

      {/* Nothing renders an AlertDialogTrigger, so Radix has no element to
          restore focus to and would drop it on <body>. Hand it the Save pill. */}
      <AlertDialog open={confirmReboot} onOpenChange={setConfirmReboot}>
        <AlertDialogContent
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            saveWrapRef.current?.querySelector("button")?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("watchdog.save.confirmReboot.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {/* The cost sentence is the rung's own key, not a second copy. */}
              {t("watchdog.save.confirmReboot.body")}{" "}
              {t("watchdog.ladder.tier4.consequence")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p className="text-on-surface-variant text-sm leading-relaxed text-pretty">
            {/* Interpolated, never pluralised: a `_one`/`_other` split would
                need matching key sets in five packs the parity gate compares. */}
            {t("watchdog.save.confirmReboot.cap", {
              cap: Number(form.maxRebootsPerHour) || 3,
            })}
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("watchdog.save.confirmReboot.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void form.submit();
              }}
            >
              {t("watchdog.save.confirmReboot.action")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Mirrors the loaded foot: a status line, then Discard and Save pills. */
export function WatchdogFootSkeleton() {
  return (
    <CardFoot
      className={HERO_PAD}
      liveStatus={false}
      aria-hidden="true"
      status={<Skeleton className={cn(SKELETON.LINE, "h-3.5 w-32")} />}
      actions={
        <>
          <Skeleton className={cn(SKELETON.PILL, "w-20")} />
          <Skeleton className={cn(SKELETON.PILL, "w-24")} />
        </>
      }
    />
  );
}
