"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { motion } from "motion/react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangleIcon, RotateCcwIcon } from "lucide-react";
import { TbAlertTriangleFilled } from "react-icons/tb";
import { SaveButton, useSaveFlash } from "@/components/ui/save-button";
import { MetaPanel, MetaPair } from "@/components/ui/meta-panel";

import { usePingProfile } from "@/hooks/use-ping-profile";
import { useModemStatus } from "@/hooks/use-modem-status";
import { PING_PROFILES, type PingProfile } from "@/types/modem-status";
import { staggerContainer, staggerItem } from "@/lib/motion-presets";

// ─── Profile metadata (UI labels and per-preset blurbs) ────────────────────

// Mirrors ping-daemon/src/config.rs::ProfileConfig::for_profile.
// Keep these in sync — the daemon is the source of truth, this table is
// purely for previewing values in the UI before the user saves.
const PROFILE_META: Record<
  PingProfile,
  {
    label: string;
    blurb: string;
    intervalSec: number;
    failSecs: number;
    recoverSecs: number;
  }
> = {
  sensitive: {
    label: "灵敏",
    blurb:
      "界面反馈最快，适合有线连接或强信号场景。",
    intervalSec: 1,
    failSecs: 6,
    recoverSecs: 3,
  },
  regular: {
    label: "标准",
    blurb: "默认均衡配置，适合大多数用户。",
    intervalSec: 2,
    failSecs: 10,
    recoverSecs: 6,
  },
  relaxed: {
    label: "宽松",
    blurb: "更保守的配置，与之前的 QManager 默认值一致。",
    intervalSec: 5,
    failSecs: 15,
    recoverSecs: 10,
  },
  quiet: {
    label: "安静",
    blurb: "更省电、省流量，但响应最慢。",
    intervalSec: 10,
    failSecs: 30,
    recoverSecs: 20,
  },
};

// 30 seconds — how long after a save we wait before showing the
// "daemon hasn't picked up the change yet" footnote.
const STUCK_THRESHOLD_MS = 30_000;

const DEFAULT_TARGET_1 = "http://cp.cloudflare.com/";
const DEFAULT_TARGET_2 = "http://www.gstatic.com/generate_204";

function validateTargetClient(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "URL 不能为空";
  if (trimmed.length > 256) return "URL 过长（最多 256 个字符）";
  if (/\s/.test(trimmed)) return "URL 不能包含空格";
  if (/[`$();|<>"\\]/.test(trimmed)) return "URL 包含不允许的字符";
  return null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatSecs(value: number | null | undefined): string {
  if (value === undefined || value === null || value === 0) return "—";
  return `${value}s`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ConnectivitySensitivityCard() {
  const {
    profile,
    target1,
    target2,
    isLoading,
    error,
    isSaving,
    saveError,
    save,
  } = usePingProfile();
  const { data: modemStatus } = useModemStatus();
  const { saved, markSaved } = useSaveFlash();

  const [selected, setSelected] = useState<PingProfile | undefined>(profile);
  const [target1Input, setTarget1Input] = useState<string>("");
  const [target2Input, setTarget2Input] = useState<string>("");
  const [target1Err, setTarget1Err] = useState<string | null>(null);
  const [target2Err, setTarget2Err] = useState<string | null>(null);
  const initializedRef = useRef(false);

  // When the saved settings arrive, sync local state once.
  useEffect(() => {
    if (
      profile !== undefined &&
      target1 !== undefined &&
      target2 !== undefined &&
      !initializedRef.current
    ) {
      setSelected(profile);
      setTarget1Input(target1);
      setTarget2Input(target2);
      initializedRef.current = true;
    }
  }, [profile, target1, target2]);

  // After a successful save, sync local selection to whatever was just saved
  // (prevents stale dirty state if user clicks a profile twice)
  const lastSavedAtRef = useRef<number | null>(null);
  const lastSavedProfileRef = useRef<PingProfile | null>(null);

  // Dirty detection
  const isDirty = useMemo(() => {
    if (!profile || selected === undefined) return false;
    if (selected !== profile) return true;
    if (target1 !== undefined && target1Input !== target1) return true;
    if (target2 !== undefined && target2Input !== target2) return true;
    return false;
  }, [profile, selected, target1, target1Input, target2, target2Input]);

  const hasValidationErrors = target1Err !== null || target2Err !== null;
  const canSave = isDirty && !isSaving && !hasValidationErrors;

  // Daemon-stuck detection: after a save, if the daemon's runtime profile
  // doesn't match within STUCK_THRESHOLD_MS, surface a footnote.
  const [stuckHint, setStuckHint] = useState(false);
  const [saveCount, setSaveCount] = useState(0);
  useEffect(() => {
    if (lastSavedAtRef.current === null) return;
    const interval = setInterval(() => {
      if (lastSavedAtRef.current === null) return;
      const elapsed = Date.now() - lastSavedAtRef.current;
      if (elapsed < STUCK_THRESHOLD_MS) return;
      const runtime = modemStatus?.connectivity?.profile;
      const target = lastSavedProfileRef.current;
      if (runtime && target && runtime !== target) {
        setStuckHint(true);
      } else {
        setStuckHint(false);
        lastSavedAtRef.current = null;
        lastSavedProfileRef.current = null;
      }
    }, 2_000);
    return () => clearInterval(interval);
  }, [saveCount, modemStatus?.connectivity?.profile]);

  // Save handler
  const handleSave = async () => {
    if (!canSave || !selected) return;
    // Re-validate at submit time
    const e1 = validateTargetClient(target1Input);
    const e2 = validateTargetClient(target2Input);
    setTarget1Err(e1);
    setTarget2Err(e2);
    if (e1 || e2) return;

    try {
      await save({
        profile: selected,
        target_1: target1Input.trim(),
        target_2: target2Input.trim(),
      });
      markSaved();
      lastSavedAtRef.current = Date.now();
      lastSavedProfileRef.current = selected;
      setStuckHint(false);
      setSaveCount((c) => c + 1);
      toast.success("连接探测设置已更新");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存失败";
      toast.error(msg);
    }
  };

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>连接探测敏感度</CardTitle>
          <CardDescription>
            调制解调器检测互联网可用性的积极程度。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {/* Profile tabs */}
            <Skeleton className="h-10 w-full rounded-md" />
            {/* Active-profile meta panel */}
            <Skeleton className="h-20 w-full rounded-md" />
            {/* Separator */}
            <Separator className="my-2" />
            {/* Probe targets header + reset icon */}
            <div className="flex items-start justify-between gap-3">
              <div className="grid gap-1.5 flex-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-full max-w-md" />
              </div>
              <Skeleton className="h-9 w-9 rounded-md shrink-0" />
            </div>
            {/* Primary URL */}
            <div className="grid gap-1.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
            {/* Secondary URL */}
            <div className="grid gap-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
            {/* Save button */}
            <div className="flex justify-end">
              <Skeleton className="h-9 w-32" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Error variant ──────────────────────────────────────────────────────
  if (error && !profile) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>连接探测敏感度</CardTitle>
          <CardDescription>
            调制解调器检测互联网可用性的积极程度。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangleIcon className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const activeMeta = selected ? PROFILE_META[selected] : null;

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>连接探测敏感度</CardTitle>
        <CardDescription>
          调制解调器检测互联网可用性的积极程度。
        </CardDescription>
      </CardHeader>
      <CardContent>
        {saveError && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangleIcon className="size-4" />
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        )}

        <motion.div
          className="grid gap-3"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {/* ── Segmented control ────────────────────────────────────── */}
          <motion.div variants={staggerItem}>
            <Tabs
              value={selected ?? ""}
              onValueChange={(v) => {
                if (v && (PING_PROFILES as readonly string[]).includes(v)) {
                  setSelected(v as PingProfile);
                }
              }}
            >
              <TabsList
                className="grid w-full grid-cols-4"
                aria-label="连接探测敏感度预设"
              >
                {PING_PROFILES.map((p) => (
                  <TabsTrigger
                    key={p}
                    value={p}
                    aria-label={`${PROFILE_META[p].label} (${PROFILE_META[p].intervalSec}s probe)`}
                  >
                    {PROFILE_META[p].label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </motion.div>

          {/* ── Active-profile meta panel ────────────────────────────── */}
          {activeMeta && (
            <motion.div variants={staggerItem}>
              <MetaPanel title={activeMeta.label} blurb={activeMeta.blurb}>
                <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1">
                  <MetaPair label="探测间隔" value={formatSecs(activeMeta.intervalSec)} />
                  <MetaPair label="失败阈值" value={formatSecs(activeMeta.failSecs)} />
                  <MetaPair label="恢复阈值" value={formatSecs(activeMeta.recoverSecs)} />
                </div>
              </MetaPanel>
            </motion.div>
          )}

          {/* ── Probe target inputs ──────────────────────────────────── */}
          <Separator className="my-2" />
          <motion.div variants={staggerItem} className="grid gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-medium">探测目标</h4>
                <p id="probe-targets-help" className="text-xs text-muted-foreground mt-0.5">
                  优先检测主目标；主目标失败时才检测备用目标。未带协议的 URL 默认按 https 处理。
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => {
                  setTarget1Input(DEFAULT_TARGET_1);
                  setTarget2Input(DEFAULT_TARGET_2);
                  setTarget1Err(null);
                  setTarget2Err(null);
                }}
                aria-label="恢复默认探测目标"
                title="恢复默认值"
              >
                <RotateCcwIcon />
              </Button>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="target-primary">主目标 URL</Label>
              <Input
                id="target-primary"
                value={target1Input}
                onChange={(e) => {
                  setTarget1Input(e.target.value);
                  setTarget1Err(validateTargetClient(e.target.value));
                }}
                placeholder="youtube.com or https://example.com/"
                aria-invalid={target1Err !== null}
                aria-describedby={
                  target1Err
                    ? "probe-targets-help target-primary-err"
                    : "probe-targets-help"
                }
              />
              {target1Err && (
                <p
                  id="target-primary-err"
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {target1Err}
                </p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="target-secondary">备用 URL（兜底）</Label>
              <Input
                id="target-secondary"
                value={target2Input}
                onChange={(e) => {
                  setTarget2Input(e.target.value);
                  setTarget2Err(validateTargetClient(e.target.value));
                }}
                placeholder="cloudflare.com or http://example.com/generate_204"
                aria-invalid={target2Err !== null}
                aria-describedby={
                  target2Err
                    ? "probe-targets-help target-secondary-err"
                    : "probe-targets-help"
                }
              />
              {target2Err && (
                <p
                  id="target-secondary-err"
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {target2Err}
                </p>
              )}
            </div>
          </motion.div>

          {/* ── Daemon-stuck warning banner ──────────────────────────── */}
          {stuckHint && (
            <motion.div variants={staggerItem}>
              <div className="flex items-start gap-2 p-2 rounded-md bg-warning/10 border border-warning/30 text-warning text-sm">
                <TbAlertTriangleFilled className="size-5 mt-0.5 shrink-0" />
                <p className="font-semibold">
                  设置已保存，但探测进程仍在使用旧预设。稍后刷新；如持续存在，请重启 qmanager-ping 服务。
                </p>
              </div>
            </motion.div>
          )}

          {/* ── Save button ──────────────────────────────────────────── */}
          <motion.div variants={staggerItem} className="flex justify-end">
            <SaveButton
              onClick={handleSave}
              isSaving={isSaving}
              saved={saved}
              disabled={!canSave}
            />
          </motion.div>
        </motion.div>
      </CardContent>
    </Card>
  );
}
