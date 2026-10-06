"use client";

import * as React from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CardFoot } from "@/components/ui/card-foot";
import { MaterialSymbol } from "@/components/ui/material-symbol";
import { SaveButton, useSaveFlash } from "@/components/ui/save-button";
import {
  SEGMENTED,
  SegmentedField,
  type SegmentedOption,
} from "@/components/ui/segmented-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type {
  ApnSaveOutcome,
  ApnSaveRequest,
  ApnSetting,
  CidContext,
} from "@/types/apn-settings";
import { PDP_TYPE_OPTIONS } from "@/types/apn-settings";

import { ApplyFootSkeleton } from "../apply-foot";
import SettingRow from "../setting-row";
import {
  BADGE_GLYPH_SIZE,
  CARD_NOTICE,
  CARD_PAD,
  CARD_SHELL,
  CARD_TITLE,
  FIELD_SHELL,
  ROW_GROUP,
  SELECT_TRIGGER,
  SETTING_ROW,
} from "../shapes";

// The check glyph this family reserves on every segment (Material Symbols
// route). The shared primitive stays free of any one icon set.
const renderCheckGlyph = (className: string) => (
  <MaterialSymbol
    name="check"
    filled
    size={SEGMENTED.GLYPH}
    aria-hidden="true"
    className={className}
  />
);

// =============================================================================
// APN Configuration — the write surface
// =============================================================================
// Three decisions as grouped rows rather than three labels over three fields.
// The geometry and the tone are the sibling settings surface's, imported from
// `../shapes` — this page used to hand-roll its own card, which is precisely
// how the family drifted apart in the first place.
//
// -----------------------------------------------------------------------------
// THE DATA CONTEXT ROW, AND THE HONESTY CONSTRAINT ON ITS CHIP
// -----------------------------------------------------------------------------
// The approved comp drew four CID chips (CID 1 Internet / CID 2 Internet /
// CID 3 IMS / CID 4 Emergency), which invites a reader to treat the whole set
// as verified truth. It is not: the backend's `detect_active_cid()` silently
// FALLS BACK TO "1" when both the QMAP read and the CGPADDR read fail, and it
// publishes no confidence signal alongside that guess. So exactly one chip is
// rendered, for the CID the modem reports as bearing the internet, and it is
// labelled for what is provable — "in use for Internet" — never "confirmed".
// When no active CID is reported at all the chip degrades to a muted "not
// reported" rather than defaulting to CID 1 in the UI as well.
//
// The picker itself stays a real control (the CID is a genuine setting), and
// the reserved-context confirmation dialog is preserved unchanged: writing a
// data APN onto the IMS or emergency context can break VoLTE or SOS calling,
// so that path must keep asking.
//
// -----------------------------------------------------------------------------
// WHY THE VALIDATION ERROR IS A FILLED CHIP
// -----------------------------------------------------------------------------
// This used to be justified by the row's promotion: a dirty row filled with
// `primary-container`, so a bare `text-destructive` line under the input would
// have been one role's ink on another role's container — the cross-pair this
// family names as its most common contrast failure.
//
// NO ROW PROMOTES ANY MORE (retired 2026-08-30, commit 24b5fc9; the
// `SETTING_ROW_DIRTY.DELTA_CHIP` is now the sole dirty indicator, because a
// `bg-primary` pill plus a `primary-container` row said "pending" twice on one
// row). The chip stays, and the reason is now the simpler one: this is the
// message a user must ACT ON to proceed, so it belongs inline where the field
// is rather than in a toast that is gone in four seconds — and a filled
// `destructive-container` chip declares its own ink pair, so it cannot be
// broken by whatever the row underneath it does next.
// =============================================================================

export interface ApnSettingsCardProps {
  apn: ApnSetting | null;
  cids: CidContext[] | null;
  /** 1 = custom APN live, 0 = carrier default, null before first fetch. */
  active: number | null;
  /** The live WAN-bearing CID, or null before first fetch. */
  activeCid: number | null;
  isLoading: boolean;
  isSaving: boolean;
  onSave: (request: ApnSaveRequest) => Promise<ApnSaveOutcome>;
  onDeactivate: () => Promise<ApnSaveOutcome>;
}

/** CIDs offered when the modem's context list has not arrived. */
const FALLBACK_CIDS = [1, 2, 3, 4, 5, 6] as const;

/**
 * The two contexts to treat as possibly-reserved when the modem has told us
 * nothing about any of them.
 *
 * CID 2 and CID 3 are the conventional IMS and emergency contexts on this
 * hardware. The page does not KNOW that on a device whose `cids[]` came back
 * empty — it knows it is usually true, which is why the dialog these route to
 * says so in those words rather than borrowing the IMS/SOS copy, which asserts
 * a type nothing reported.
 */
const FALLBACK_RESERVED_CIDS: readonly number[] = [2, 3];

/**
 * Which reserved-context dialog is open, and why.
 *
 * "ims" / "emergency" are the modem's own classification of a context it
 * reported. "unverified" is the empty-list case: same guard, weaker claim.
 */
type PendingReserved = { cid: number; kind: "ims" | "emergency" | "unverified" };

/** The APN input: the family field plus the comp's 260px minimum, so a long APN does not truncate. */
const APN_INPUT = cn(FIELD_SHELL, "@2xl/card:w-[16.25rem]");

export function ApnSettingsCard({
  apn,
  cids,
  active,
  activeCid,
  isLoading,
  isSaving,
  onSave,
  onDeactivate,
}: ApnSettingsCardProps) {
  const { t } = useTranslation("cellular");
  const { saved, markSaved } = useSaveFlash();
  const formId = React.useId();
  const K = "core_settings.apn";

  // --- Draft state -----------------------------------------------------------
  // Seeded from the stored setting, and RE-seeded whenever that baseline
  // genuinely changes (a save's reconcile, a retry after an error). Keying the
  // sync on the baseline's own value rather than on a one-shot `seeded` flag is
  // what makes the second case work: the old flag latched on the first fetch,
  // so a reconcile that came back with a carrier-overridden APN left the form
  // showing the value the user asked for rather than the one that took.
  const baselineKey = apn ? JSON.stringify([apn.apn, apn.pdp_type, apn.cid]) : null;

  const [syncedKey, setSyncedKey] = React.useState<string | null>(null);
  const [apnValue, setApnValue] = React.useState("");
  const [pdpType, setPdpType] = React.useState("ipv4v6");
  const [cid, setCid] = React.useState("1");

  // Render-phase sync, not an effect: this reads PROPS, never state derived in
  // the same render, which is the case the React Compiler allows.
  if (apn && baselineKey !== syncedKey) {
    setSyncedKey(baselineKey);
    setApnValue(apn.apn);
    setPdpType(apn.pdp_type || "ipv4v6");
    setCid(String(apn.cid));
  }

  const [apnError, setApnError] = React.useState("");
  const [pendingCid, setPendingCid] = React.useState<PendingReserved | null>(
    null,
  );
  const [confirmDeactivate, setConfirmDeactivate] = React.useState(false);

  const pdpOptions: SegmentedOption<string>[] = PDP_TYPE_OPTIONS.map(
    (option) => ({
      value: option.value,
      label: t(`${K}.edit.fields.pdp_type.options.${option.value}`),
    }),
  );

  // --- Never read ------------------------------------------------------------
  // A failed FIRST read is a third state, not a longer loading state. The hook
  // clears `isLoading` and leaves `apn` at `null`, and the component used to
  // fall straight past its loading branch into the form body — where the APN
  // field honestly showed a placeholder but the IP-protocol control rendered
  // IPv4v6 SELECTED and the CID Select rendered CID 1, as confirmed-looking
  // choices on a card that had read nothing. Those are the `useState` seeds
  // ("ipv4v6" / "1"), never a value from the modem.
  //
  // `overrideUndetermined` did not guard this: it only holds the card in
  // loading while the PROFILE verdict resolves, and is false once settled
  // regardless of whether the APN fetch succeeded.
  //
  // The card states why it has nothing to show, quietly — the route shell's
  // banner already carries the alarm and the retry action, and repeating it
  // here would say it twice. Rendering no control at all also closes the last
  // route into the reserved-context fallback on a page that knows nothing.
  //
  // Only the NEVER-READ case lands here: a failed re-read leaves the previous
  // snapshot in place, so the card keeps rendering real values.

  if (!isLoading && !apn) {
    return (
      <Card className={cn(CARD_SHELL)}>
        <CardHeader className={CARD_PAD}>
          <CardTitle className={CARD_TITLE}>{t(`${K}.card.title`)}</CardTitle>
          <CardDescription>{t(`${K}.card.description`)}</CardDescription>
        </CardHeader>
        <CardContent className={cn(CARD_PAD, "flex flex-col gap-4")}>
          <div className={ROW_GROUP.ROOT}>
            <p className={CARD_NOTICE}>{t(`${K}.cards.unread`)}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Loading ---------------------------------------------------------------
  // Geometry is MIRRORED from the shape constants. The header text is real in
  // ALL THREE states, so the card never swaps its own title on load — the
  // family records a skeleton titled differently from its loaded card as a
  // visible title swap on every load.

  if (isLoading) {
    return (
      <Card className={cn(CARD_SHELL)}>
        <CardHeader className={CARD_PAD}>
          <CardTitle className={CARD_TITLE}>{t(`${K}.card.title`)}</CardTitle>
          <CardDescription>{t(`${K}.card.description`)}</CardDescription>
        </CardHeader>
        <CardContent className={cn(CARD_PAD, "flex flex-col gap-4")}>
          <div className={ROW_GROUP.ROOT}>
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton
                key={index}
                className={cn(SETTING_ROW.HEIGHT, "rounded-field")}
              />
            ))}
          </div>
        </CardContent>
        <ApplyFootSkeleton />
      </Card>
    );
  }

  const contexts = cids ?? [];

  // --- Dirty tracking --------------------------------------------------------

  const apnDirty = apn !== null && apnValue !== apn.apn;
  const pdpDirty = apn !== null && pdpType !== (apn.pdp_type || "ipv4v6");
  const cidDirty = apn !== null && cid !== String(apn.cid);
  const changeCount =
    (apnDirty ? 1 : 0) + (pdpDirty ? 1 : 0) + (cidDirty ? 1 : 0);

  const pdpLabelOf = (value: string) =>
    pdpOptions.find((option) => option.value === value)?.label ?? value;

  const apnDelta = apnDirty
    ? `${apn?.apn || "—"} → ${apnValue.trim() || "—"}`
    : null;
  const pdpDelta = pdpDirty
    ? `${pdpLabelOf(apn?.pdp_type ?? "")} → ${pdpLabelOf(pdpType)}`
    : null;
  const cidDelta = cidDirty ? `${apn?.cid} → ${cid}` : null;

  // --- CID selection — intercept reserved contexts for confirmation ----------
  //
  // THE GUARD USED TO SWITCH ITSELF OFF EXACTLY WHEN IT MATTERED MOST. It was
  // `contexts.find(...)` and nothing else, but the Select still offers
  // `FALLBACK_CIDS` (1-6) when the modem has reported no contexts at all — so
  // on an empty `cids[]` the lookup missed on every single option, `pendingCid`
  // was never set, and a data APN could land on the IMS or emergency context
  // with no confirmation. The one moment the page knows least about which CIDs
  // are reserved was the one moment it stopped asking.
  //
  // Two gates now. The modem's own classification when it reported one, and a
  // conventional fallback when it reported nothing — worded as the guess it is.

  const handleCidChange = (value: string) => {
    const ctx = contexts.find((context) => String(context.cid) === value);
    if (ctx) {
      if (ctx.apn_type === "ims" || ctx.apn_type === "emergency") {
        setPendingCid({ cid: ctx.cid, kind: ctx.apn_type });
        return;
      }
      setCid(value);
      return;
    }
    if (contexts.length === 0 && FALLBACK_RESERVED_CIDS.includes(Number(value))) {
      setPendingCid({ cid: Number(value), kind: "unverified" });
      return;
    }
    setCid(value);
  };

  const confirmCidChange = () => {
    if (pendingCid) setCid(String(pendingCid.cid));
    setPendingCid(null);
  };

  // --- Submit ----------------------------------------------------------------

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!apnValue.trim()) {
      setApnError(t(`${K}.edit.fields.apn.error_required`));
      return;
    }
    setApnError("");

    const outcome = await onSave({
      apn: apnValue.trim(),
      pdp_type: pdpType,
      cid: parseInt(cid, 10),
    });

    // THREE OUTCOMES, NOT TWO. "reconciling" means the attach cycle killed the
    // link before the response could return — the write almost certainly
    // landed, so announcing a failure would be a lie, and announcing success
    // would be a different one. The toast says what is actually happening, and
    // the page-header chip carries the verdict once the re-read lands.
    if (outcome === "failed") {
      toast.error(t(`${K}.toast.save_error`));
      return;
    }
    markSaved();
    toast.success(
      t(outcome === "reconciling" ? `${K}.toast.reconciling` : `${K}.toast.saved`),
    );
  };

  const handleDeactivate = async () => {
    setConfirmDeactivate(false);
    const outcome = await onDeactivate();
    if (outcome === "failed") {
      toast.error(t(`${K}.toast.deactivate_error`));
      return;
    }
    toast.success(
      t(
        outcome === "reconciling"
          ? `${K}.toast.reconciling`
          : `${K}.toast.deactivated`,
      ),
    );
  };

  return (
    <Card className={cn(CARD_SHELL)}>
      <CardHeader className={CARD_PAD}>
        <CardTitle className={CARD_TITLE}>{t(`${K}.card.title`)}</CardTitle>
        <CardDescription>{t(`${K}.card.description`)}</CardDescription>
      </CardHeader>

      <CardContent className={cn(CARD_PAD, "flex flex-col gap-4")}>
        <form id={formId} className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className={ROW_GROUP.ROOT}>
            <SettingRow
              labelId="apn-name-label"
              label={t(`${K}.rows.apn.label`)}
              consequence={t(`${K}.rows.apn.consequence`)}
              dirty={apnDirty}
              delta={apnDelta}
              control={
                <div className="flex w-full flex-col gap-1.5 @2xl/card:w-auto">
                  <Input
                    host="container"
                    id="apn-input"
                    type="text"
                    aria-labelledby="apn-name-label"
                    aria-invalid={!!apnError}
                    aria-describedby={apnError ? "apn-input-error" : undefined}
                    aria-required="true"
                    required
                    spellCheck={false}
                    autoComplete="off"
                    placeholder={t(`${K}.edit.fields.apn.placeholder`)}
                    value={apnValue}
                    onChange={(event) => {
                      setApnValue(event.target.value);
                      if (apnError) setApnError("");
                    }}
                    disabled={isSaving}
                    className={APN_INPUT}
                  />
                  {apnError ? (
                    <span
                      id="apn-input-error"
                      role="alert"
                      className="bg-destructive-container text-on-destructive-container inline-flex w-fit items-center gap-1.5 rounded-pill px-2.5 py-1 text-[0.71875rem] font-medium"
                    >
                      <MaterialSymbol name="error" filled size={12} />
                      {apnError}
                    </span>
                  ) : null}
                </div>
              }
            />

            {apnDirty || pdpDirty ? null : (
              <div className={ROW_GROUP.DIVIDER} />
            )}

            <SettingRow
              label={t(`${K}.rows.pdp_type.label`)}
              consequence={t(`${K}.rows.pdp_type.consequence`)}
              dirty={pdpDirty}
              delta={pdpDelta}
              control={
                <SegmentedField
                  value={pdpType}
                  onValueChange={setPdpType}
                  options={pdpOptions}
                  ariaLabel={t(`${K}.rows.pdp_type.label`)}
                  disabled={isSaving}
                  glyph={renderCheckGlyph}
                />
              }
            />

            {pdpDirty || cidDirty ? null : <div className={ROW_GROUP.DIVIDER} />}

            <SettingRow
              labelId="apn-cid-label"
              label={t(`${K}.rows.cid.label`)}
              consequence={t(`${K}.rows.cid.consequence`)}
              dirty={cidDirty}
              delta={cidDelta}
              control={
                <div className="flex w-full flex-wrap items-center gap-2 @2xl/card:w-auto @2xl/card:justify-end">
                  <Select
                    value={cid}
                    onValueChange={handleCidChange}
                    disabled={isSaving}
                  >
                    <SelectTrigger
                      host="container"
                      id="apn-cid"
                      aria-labelledby="apn-cid-label"
                      className={SELECT_TRIGGER}
                    >
                      <SelectValue
                        placeholder={t(
                          `${K}.edit.fields.modem_profile.placeholder`,
                        )}
                      >
                        {t(`${K}.edit.fields.modem_profile.option_template`, {
                          cid,
                        })}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="rounded-tile">
                      {(contexts.length > 0
                        ? contexts.map((context) => context.cid)
                        : [...FALLBACK_CIDS]
                      ).map((value) => (
                        <SelectItem key={value} value={String(value)}>
                          {t(
                            `${K}.edit.fields.modem_profile.option_template`,
                            { cid: value },
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* ONE chip, for the context the modem reports as bearing the
                      internet — not a chip per CID. See the header note on
                      `detect_active_cid()`'s silent fallback to "1". */}
                  {activeCid !== null ? (
                    <Badge variant="success">
                      <MaterialSymbol
                        name="check_circle"
                        filled
                        size={BADGE_GLYPH_SIZE}
                      />
                      {t(`${K}.cid_in_use`, { cid: activeCid })}
                    </Badge>
                  ) : (
                    <Badge variant="muted">
                      <MaterialSymbol name="help" size={BADGE_GLYPH_SIZE} />
                      {t(`${K}.cid_unknown`)}
                    </Badge>
                  )}
                </div>
              }
            />
          </div>

          {/* Operational, not a draft commit, so it stays in the body (Card-Foot exemption). */}
          {active === 1 ? (
            <div className="flex flex-wrap items-center gap-2">
              {/* GATED ON A POSITIVE STATE, not on "not zero". `active` is
                  `null` before the first read resolves and stays `null` when
                  that read fails, and `null !== 0` is true — so this button
                  rendered, enabled, on a card that had read nothing, and one
                  press POSTed a real COPS=2 / COPS=0 attach cycle with a blank
                  APN. Meanwhile `changeCount === 0` correctly disabled Save:
                  the card was disabling the reversible action and arming the
                  irreversible one. "We do not know" is not permission to
                  detach the bearer. */}
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirmDeactivate(true)}
                disabled={isSaving}
                size="action"
              >
                {t(`${K}.carrier_default.button`)}
              </Button>
            </div>
          ) : null}
        </form>
      </CardContent>

      {/* Outside the form so `mt-auto` reaches the card edge; `form=` keeps Enter-to-submit. */}
      <CardFoot
        className={CARD_PAD}
        status={<span className="text-pretty">{t(`${K}.save_connection_notice`)}</span>}
        actions={
          <SaveButton
            type="submit"
            form={formId}
            isSaving={isSaving}
            saved={saved}
            label={t(`${K}.save_apn`)}
            disabled={changeCount === 0}
            size="action"
          />
        }
      />

      {/* Reserved-context confirmation. Preserved verbatim in behaviour: a data
          APN written onto the IMS or emergency context can break VoLTE or SOS
          calling, so this path keeps asking. */}
      <AlertDialog
        open={pendingCid !== null}
        onOpenChange={(open) => !open && setPendingCid(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(`${K}.edit.cid_confirm.title`)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {/* The unverified branch does NOT reuse the IMS or SOS copy.
                  Those name a context type the modem reported; here nothing
                  was reported, and stating a type we guessed at would be the
                  page inventing a fact to justify its own dialog. */}
              {pendingCid?.kind === "unverified"
                ? t(`${K}.edit.reserved_dialog.unverified_body`)
                : pendingCid?.kind === "ims"
                  ? t(`${K}.edit.cid_confirm.description_ims`, {
                      cid: pendingCid?.cid,
                    })
                  : t(`${K}.edit.cid_confirm.description_sos`, {
                      cid: pendingCid?.cid,
                    })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t(`${K}.edit.cid_confirm.cancel`)}
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmCidChange}>
              {t(`${K}.edit.cid_confirm.confirm`)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Use carrier default confirmation */}
      <AlertDialog open={confirmDeactivate} onOpenChange={setConfirmDeactivate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(`${K}.carrier_default.dialog.title`)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(`${K}.carrier_default.dialog.description`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t(`${K}.carrier_default.dialog.cancel`)}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate}>
              {t(`${K}.carrier_default.dialog.confirm`)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default ApnSettingsCard;
