"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "motion/react";
import { Gamepad2, Play, Zap, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AbstractPattern } from "./abstract-pattern";
import { AddScenarioItem } from "./add-scenario-item";
import { ActiveConfigCard } from "./active-config-card";
import { ScenarioItem, Scenario } from "./scenario-item";
import { useConnectionScenarios } from "@/hooks/use-connection-scenarios";
import { useSimProfiles } from "@/hooks/use-sim-profiles";
import { ProfileOverrideAlert } from "@/components/cellular/custom-profiles/profile-override-alert";
import {
  NETWORK_MODE_OPTIONS,
  modeValueToLabel,
  inputToBands,
  bandsToInput,
} from "@/types/connection-scenario";

// =============================================================================
// Constants
// =============================================================================

const gradientOptions = [
  { id: "purple", value: "from-violet-600 via-purple-600 to-indigo-700" },
  { id: "rose", value: "from-rose-500 via-pink-500 to-orange-400" },
  { id: "teal", value: "from-emerald-500 via-teal-500 to-cyan-500" },
  { id: "blue", value: "from-blue-500 via-indigo-500 to-purple-600" },
  { id: "amber", value: "from-amber-500 via-orange-500 to-red-500" },
  { id: "slate", value: "from-slate-600 via-gray-700 to-zinc-800" },
  { id: "sky", value: "from-sky-400 via-blue-500 to-indigo-500" },
  { id: "lime", value: "from-lime-400 via-green-500 to-emerald-600" },
  { id: "fuchsia", value: "from-fuchsia-500 via-pink-600 to-rose-600" },
  { id: "gold", value: "from-yellow-400 via-amber-500 to-orange-600" },
  { id: "ocean", value: "from-cyan-500 via-blue-600 to-indigo-800" },
  { id: "sunset", value: "from-orange-400 via-red-500 to-pink-600" },
];

// Default (built-in) scenarios — icons are UI-only, not stored in backend
const DEFAULT_SCENARIOS: Scenario[] = [
  {
    id: "balanced",
    name: "均衡",
    description: "自动选择频段",
    icon: Zap,
    gradient: "from-emerald-500 via-teal-500 to-cyan-500",
    pattern: "balanced",
    isDefault: true,
    config: {
      atModeValue: "AUTO",
      mode: "自动",
      optimization: "均衡",
      lte_bands: "",
      nsa_nr_bands: "",
      sa_nr_bands: "",
    },
  },
  {
    id: "gaming",
    name: "游戏",
    description: "低延迟，优先 5G SA",
    icon: Gamepad2,
    gradient: "from-violet-600 via-purple-600 to-indigo-700",
    pattern: "gaming",
    isDefault: true,
    config: {
      atModeValue: "NR5G",
      mode: "仅 5G SA",
      optimization: "低延迟",
      lte_bands: "",
      nsa_nr_bands: "",
      sa_nr_bands: "",
    },
  },
  {
    id: "streaming",
    name: "流媒体",
    description: "高带宽，稳定连接",
    icon: Play,
    gradient: "from-rose-500 via-pink-500 to-orange-400",
    pattern: "streaming",
    isDefault: true,
    config: {
      atModeValue: "LTE:NR5G",
      mode: "5G SA / NSA",
      optimization: "吞吐优先",
      lte_bands: "",
      nsa_nr_bands: "",
      sa_nr_bands: "",
    },
  },
];

// =============================================================================
// Main Component
// =============================================================================

interface ConnectionScenariosCardProps {
  /** If true on mount, open the "New Scenario" dialog automatically. Used by
   *  the deep-link from the SIM Profile form's "Create new custom scenario…"
   *  Select item. After successful create, a special toast prompts the user
   *  to return to their profile and select the new scenario. */
  autoOpenAddDialog?: boolean;
}

const ConnectionScenariosCard = ({
  autoOpenAddDialog,
}: ConnectionScenariosCardProps = {}) => {
  const {
    activeScenarioId,
    customScenarios: storedScenarios,
    isLoading,
    isActivating,
    activateScenario,
    saveCustomScenario,
    deleteCustomScenario,
  } = useConnectionScenarios();

  // --- SIM Profile override check ------------------------------------------
  // When an active Custom SIM Profile binds a NON-Balanced scenario, that
  // profile owns scenario activation: the Activate button is disabled on
  // every card and a banner explains why. A Balanced binding is treated as
  // "no opinion" and doesn't gate anything (no profileGate populated).
  // Edit/Delete of *custom* scenarios is intentionally NOT gated.
  const { activeProfileId, getProfile } = useSimProfiles();
  const [profileGate, setProfileGate] = useState<{
    profileName: string;
  } | null>(null);

  useEffect(() => {
    if (!activeProfileId) return;
    let cancelled = false;
    (async () => {
      const profile = await getProfile(activeProfileId);
      if (cancelled) return;
      // null and "" both mean "no binding"; "balanced" is treated identically.
      const boundId = profile?.settings.scenario_id || "";
      if (profile && boundId && boundId !== "balanced") {
        setProfileGate({ profileName: profile.name });
      } else {
        setProfileGate(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProfileId, getProfile]);

  const isProfileControlled = profileGate !== null;

  // Convert backend StoredScenario[] → UI Scenario[] (add icon, pattern, isDefault)
  const customScenarios: Scenario[] = useMemo(
    () =>
      storedScenarios.map((s) => ({
        ...s,
        icon: Sparkles,
        pattern: "custom" as const,
        isDefault: false,
      })),
    [storedScenarios],
  );

  // --- Selection state (view config without activating) ----------------------
  const [selectedId, setSelectedId] = useState<string>(activeScenarioId);

  // Sync selection to active when active changes (e.g., on initial load)
  useEffect(() => {
    setSelectedId(activeScenarioId);
  }, [activeScenarioId]);

  // --- Dialog state ----------------------------------------------------------
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Deep-link flag — remembers if the user arrived via ?action=create so we
  // can show a tailored toast after the scenario is created. Latches once at
  // mount; we don't re-open the dialog if the user dismisses it.
  const [arrivedFromProfileForm, setArrivedFromProfileForm] = useState(
    !!autoOpenAddDialog,
  );

  useEffect(() => {
    if (autoOpenAddDialog) {
      setShowAddDialog(true);
    }
    // Only auto-open on mount; ignore subsequent prop changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add form state
  const [addName, setAddName] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [addGradient, setAddGradient] = useState(gradientOptions[3].value);
  const [addMode, setAddMode] = useState("AUTO");
  const [addLteBands, setAddLteBands] = useState("");
  const [addNsaNrBands, setAddNsaNrBands] = useState("");
  const [addSaNrBands, setAddSaNrBands] = useState("");

  // Edit form state
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editGradient, setEditGradient] = useState("");
  const [editMode, setEditMode] = useState("AUTO");
  const [editOptimization, setEditOptimization] = useState("");
  const [editLteBands, setEditLteBands] = useState("");
  const [editNsaNrBands, setEditNsaNrBands] = useState("");
  const [editSaNrBands, setEditSaNrBands] = useState("");

  // --- Derived ---------------------------------------------------------------
  const scenarios = useMemo(
    () => [...DEFAULT_SCENARIOS, ...customScenarios],
    [customScenarios],
  );
  const selectedScenario = scenarios.find((s) => s.id === selectedId);
  const isSelectedActive = selectedId === activeScenarioId;

  // Fall back to first default if selected scenario isn't found
  // (e.g., active custom scenario ID from backend doesn't match any local scenario)
  useEffect(() => {
    if (!isLoading && selectedId && !scenarios.find((s) => s.id === selectedId)) {
      setSelectedId(DEFAULT_SCENARIOS[0].id);
    }
  }, [isLoading, selectedId, scenarios]);

  // ---------------------------------------------------------------------------
  // Handle selection (click card = view config)
  // ---------------------------------------------------------------------------
  const handleSelect = (id: string) => {
    setSelectedId(id);
  };

  // ---------------------------------------------------------------------------
  // Handle activation (explicit button press)
  // ---------------------------------------------------------------------------
  const handleActivate = useCallback(async () => {
    if (!selectedScenario || isActivating) return;
    if (selectedId === activeScenarioId) return;
    // Belt-and-braces: even though the button is disabled, never let an
    // activation through while the profile owns radio config.
    if (isProfileControlled) return;

    const success = await activateScenario(selectedId, selectedScenario.config);

    if (success) {
      toast.success(`已切换到 ${selectedScenario.name} 场景。`);
    } else {
      toast.error(
        `激活 ${selectedScenario.name} 场景失败。`,
      );
    }
  }, [
    selectedScenario,
    selectedId,
    activeScenarioId,
    isActivating,
    activateScenario,
    isProfileControlled,
  ]);

  // ---------------------------------------------------------------------------
  // Add custom scenario
  // ---------------------------------------------------------------------------
  const [isSaving, setIsSaving] = useState(false);

  const handleAddScenario = async () => {
    if (!addName.trim() || isSaving) return;

    setIsSaving(true);
    const scenarioData = {
      name: addName,
      description: addDescription || "自定义配置",
      gradient: addGradient,
      config: {
        atModeValue: addMode,
        mode: modeValueToLabel(addMode),
        optimization: "自定义",
        lte_bands: inputToBands(addLteBands),
        nsa_nr_bands: inputToBands(addNsaNrBands),
        sa_nr_bands: inputToBands(addSaNrBands),
      },
    };

    const newId = await saveCustomScenario(scenarioData);
    setIsSaving(false);

    if (newId) {
      setSelectedId(newId);
      setShowAddDialog(false);
      resetAddForm();
      if (arrivedFromProfileForm) {
        toast.success(
          "场景已创建。请返回 SIM 配置并选择它。",
        );
        // One-shot — subsequent creates show the normal toast.
        setArrivedFromProfileForm(false);
      } else {
        toast.success("场景已创建。");
      }
    } else {
      toast.error("创建场景失败。");
    }
  };

  const resetAddForm = () => {
    setAddName("");
    setAddDescription("");
    setAddGradient(gradientOptions[3].value);
    setAddMode("AUTO");
    setAddLteBands("");
    setAddNsaNrBands("");
    setAddSaNrBands("");
  };

  // ---------------------------------------------------------------------------
  // Delete custom scenario
  // ---------------------------------------------------------------------------
  const handleDeleteScenario = async (id: string) => {
    const success = await deleteCustomScenario(id);
    if (success) {
      // If the deleted scenario was selected, fall back to active or default
      if (selectedId === id) {
        setSelectedId(activeScenarioId === id ? DEFAULT_SCENARIOS[0].id : activeScenarioId);
      }
      toast.success("场景已删除。");
    } else {
      toast.error("删除场景失败。");
    }
  };

  // ---------------------------------------------------------------------------
  // Edit custom scenario
  // ---------------------------------------------------------------------------
  const handleOpenEditDialog = () => {
    if (!selectedScenario || selectedScenario.isDefault) return;

    setEditId(selectedScenario.id);
    setEditName(selectedScenario.name);
    setEditDescription(selectedScenario.description);
    setEditGradient(selectedScenario.gradient);
    setEditMode(selectedScenario.config.atModeValue);
    setEditOptimization(selectedScenario.config.optimization);
    setEditLteBands(bandsToInput(selectedScenario.config.lte_bands));
    setEditNsaNrBands(bandsToInput(selectedScenario.config.nsa_nr_bands));
    setEditSaNrBands(bandsToInput(selectedScenario.config.sa_nr_bands));
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim() || isSaving) return;

    setIsSaving(true);
    const updatedId = await saveCustomScenario({
      id: editId,
      name: editName,
      description: editDescription,
      gradient: editGradient,
      config: {
        atModeValue: editMode,
        mode: modeValueToLabel(editMode),
        optimization: editOptimization,
        lte_bands: inputToBands(editLteBands),
        nsa_nr_bands: inputToBands(editNsaNrBands),
        sa_nr_bands: inputToBands(editSaNrBands),
      },
    });
    setIsSaving(false);

    if (updatedId) {
      setShowEditDialog(false);
      toast.success("场景已更新。");
    } else {
      toast.error("更新场景失败。");
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="grid gap-y-6">
      {/* Profile override banner — shown when a Custom SIM Profile owns
          scenario activation. Edit/Delete remain enabled; only Activate
          is restricted. */}
      {isProfileControlled && profileGate && !isLoading && (
        <ProfileOverrideAlert
          profileName={profileGate.profileName}
          controls="场景激活"
        />
      )}

      {/* Row 1: Scenario Profile Cards */}
      <div className="col-span-full grid grid-cols-2 @3xl/main:grid-cols-4 gap-4">
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="rounded-xl h-36" />
            ))}
            <Skeleton className="rounded-xl h-36 opacity-50" />
          </>
        ) : (
          <>
            <motion.div
              className="contents"
              initial="hidden"
              animate="visible"
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
            >
              {scenarios.map((scenario) => (
                <motion.div
                  key={scenario.id}
                  variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                >
                  <ScenarioItem
                    scenario={scenario}
                    isActive={activeScenarioId === scenario.id}
                    isSelected={selectedId === scenario.id}
                    onSelect={handleSelect}
                    onDelete={handleDeleteScenario}
                  />
                </motion.div>
              ))}
            </motion.div>
            <AddScenarioItem onClick={() => setShowAddDialog(true)} />
          </>
        )}
      </div>

      {/* Row 2: Selected Scenario Configuration */}
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row">
        {isLoading ? (
          <Card className="@container/card">
            <CardContent className="px-6">
              <div className="flex items-center gap-3 mb-5">
                <Skeleton className="h-11 w-11 rounded-xl" />
                <div className="grid gap-1.5">
                  <Skeleton className="h-5 w-44" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
              <div className="grid gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <React.Fragment key={i}>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </React.Fragment>
                ))}
                <Separator />
              </div>
            </CardContent>
          </Card>
        ) : (
          <ActiveConfigCard
            scenario={selectedScenario}
            isActive={isSelectedActive}
            isActivating={isActivating}
            onEdit={handleOpenEditDialog}
            onActivate={handleActivate}
            activateDisabled={isProfileControlled}
            activeProfileName={profileGate?.profileName}
          />
        )}
      </div>

      {/* ===== Add Scenario Dialog ===== */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新建连接场景</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="add-name">场景名称</Label>
              <Input
                id="add-name"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="例如：居家办公"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="add-description">说明</Label>
              <Input
                id="add-description"
                value={addDescription}
                onChange={(e) => setAddDescription(e.target.value)}
                placeholder="例如：为视频会议优化"
              />
            </div>

            {/* Network Mode */}
            <div className="space-y-2">
              <Label>网络模式</Label>
              <Select value={addMode} onValueChange={setAddMode}>
                <SelectTrigger aria-label="网络模式">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NETWORK_MODE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Band Locks */}
            <div className="space-y-2">
              <Label htmlFor="add-lte-bands">LTE 频段锁定</Label>
              <Input
                id="add-lte-bands"
                value={addLteBands}
                onChange={(e) => setAddLteBands(e.target.value)}
                placeholder="例如：1, 3, 7, 28（留空为自动）"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="add-sa-bands">NR5G-SA 频段锁定</Label>
                <Input
                  id="add-sa-bands"
                  value={addSaNrBands}
                  onChange={(e) => setAddSaNrBands(e.target.value)}
                  placeholder="例如：41, 78"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-nsa-bands">NR5G-NSA 频段锁定</Label>
                <Input
                  id="add-nsa-bands"
                  value={addNsaNrBands}
                  onChange={(e) => setAddNsaNrBands(e.target.value)}
                  placeholder="例如：41, 78"
                />
              </div>
            </div>

            {/* Card Theme */}
            <div className="space-y-2">
              <Label>卡片主题</Label>
              <div className="grid grid-cols-6 gap-2">
                {gradientOptions.map((grad) => (
                  <button
                    key={grad.id}
                    type="button"
                    onClick={() => setAddGradient(grad.value)}
                    className={cn(
                      "h-9 rounded-lg bg-linear-to-br transition-all",
                      grad.value,
                      addGradient === grad.value
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                        : "hover:scale-105",
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label>预览</Label>
              <div
                className={cn(
                  "relative overflow-hidden rounded-xl h-20 bg-linear-to-br",
                  addGradient,
                )}
              >
                <AbstractPattern
                  type="custom"
                  className="absolute inset-0 w-full h-full"
                />
                <div className="relative p-4 text-white">
                  <p className="font-medium">
                    {addName || "场景名称"}
                  </p>
                  <p className="text-sm text-white/70">
                    {addDescription || "自定义配置"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button
              onClick={handleAddScenario}
              disabled={!addName.trim() || isSaving}
            >
              {isSaving ? "创建中…" : "创建场景"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Edit Scenario Dialog ===== */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑配置</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="edit-name">场景名称</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="场景名称"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="edit-description">说明</Label>
              <Input
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="场景说明"
              />
            </div>

            {/* Network Mode */}
            <div className="space-y-2">
              <Label>网络模式</Label>
              <Select value={editMode} onValueChange={setEditMode}>
                <SelectTrigger aria-label="网络模式">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NETWORK_MODE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Optimization */}
            <div className="space-y-2">
              <Label htmlFor="edit-optimization">优化标签</Label>
              <Input
                id="edit-optimization"
                value={editOptimization}
                onChange={(e) => setEditOptimization(e.target.value)}
                placeholder="例如：低延迟、吞吐优先、自定义"
              />
            </div>

            {/* Band Locks */}
            <div className="space-y-2">
              <Label htmlFor="edit-lte-bands">LTE 频段锁定</Label>
              <Input
                id="edit-lte-bands"
                value={editLteBands}
                onChange={(e) => setEditLteBands(e.target.value)}
                placeholder="例如：1, 3, 7, 28（留空为自动）"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-sa-bands">NR5G-SA 频段锁定</Label>
                <Input
                  id="edit-sa-bands"
                  value={editSaNrBands}
                  onChange={(e) => setEditSaNrBands(e.target.value)}
                  placeholder="例如：41, 78"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-nsa-bands">NR5G-NSA 频段锁定</Label>
                <Input
                  id="edit-nsa-bands"
                  value={editNsaNrBands}
                  onChange={(e) => setEditNsaNrBands(e.target.value)}
                  placeholder="例如：41, 78"
                />
              </div>
            </div>

            {/* Card Theme */}
            <div className="space-y-2">
              <Label>卡片主题</Label>
              <div className="grid grid-cols-6 gap-2">
                {gradientOptions.map((grad) => (
                  <button
                    key={grad.id}
                    type="button"
                    onClick={() => setEditGradient(grad.value)}
                    className={cn(
                      "h-9 rounded-lg bg-linear-to-br transition-all",
                      grad.value,
                      editGradient === grad.value
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                        : "hover:scale-105",
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label>预览</Label>
              <div
                className={cn(
                  "relative overflow-hidden rounded-xl h-20 bg-linear-to-br",
                  editGradient,
                )}
              >
                <AbstractPattern
                  type="custom"
                  className="absolute inset-0 w-full h-full"
                />
                <div className="relative p-4 text-white">
                  <p className="font-medium">{editName || "场景名称"}</p>
                  <p className="text-sm text-white/70">
                    {editDescription || "自定义配置"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button onClick={handleSaveEdit} disabled={!editName.trim() || isSaving}>
              {isSaving ? "保存中…" : "保存更改"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConnectionScenariosCard;
