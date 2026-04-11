"use client";

import { useMemo } from "react";
import BandCardsComponent from "./band-cards";
import BandSettingsComponent from "./band-settings";
import { useBandLocking } from "@/hooks/use-band-locking";
import { useModemStatus } from "@/hooks/use-modem-status";
import { useConnectionScenarios } from "@/hooks/use-connection-scenarios";
import {
  parseBandString,
  getBandsForCategory,
  type BandCategory,
} from "@/types/band-locking";
import { DEFAULT_SCENARIOS } from "@/types/connection-scenario";
import { InfoIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// =============================================================================
// BandLockingComponent — Page Coordinator
// =============================================================================
// Owns all hooks and distributes data to child components via props.
//
// Data sources:
//   useModemStatus()          → supported_*_bands, carrier_components
//   useBandLocking()          → currentBands, failover, lock/unlock actions
//   useConnectionScenarios()  → activeScenarioId (for scenario override check)
//
// Scenario override:
//   When a non-Balanced scenario is active, band cards are disabled and an
//   info banner is shown. This keeps the mental model clean: the scenario
//   "owns" RF configuration. Switch to Balanced for manual band control.
// =============================================================================

/** Band card configuration — static, one entry per card */
const BAND_CARDS: {
  category: BandCategory;
  title: string;
  description: string;
}[] = [
  {
    category: "lte",
    title: "LTE 频段锁定",
    description: "选择要为设备锁定的 LTE 频段。",
  },
  {
    category: "nsa_nr5g",
    title: "NSA 频段锁定",
    description: "选择要锁定的 5G NSA 频段（通过 LTE 锚点接入 5G）。",
  },
  {
    category: "sa_nr5g",
    title: "SA 频段锁定",
    description: "选择要锁定的 5G SA 频段（独立组网 5G）。",
  },
];

const BandLockingComponent = () => {
  const { data, isLoading: statusLoading } = useModemStatus();
  const {
    currentBands,
    failover,
    isLoading: bandsLoading,
    lockingCategory,
    error,
    lockBands,
    unlockAll,
    toggleFailover,
  } = useBandLocking();
  const {
    activeScenarioId,
    customScenarios,
    isLoading: scenariosLoading,
  } = useConnectionScenarios();

  // --- Scenario override check ----------------------------------------------
  const isScenarioControlled = activeScenarioId !== "balanced";

  const activeScenarioName = useMemo(() => {
    if (!isScenarioControlled) return "";
    // Check defaults first
    const defaultMatch = DEFAULT_SCENARIOS.find(
      (s) => s.id === activeScenarioId,
    );
    if (defaultMatch) return defaultMatch.name;
    // Check custom scenarios
    const customMatch = customScenarios.find((s) => s.id === activeScenarioId);
    if (customMatch) return customMatch.name;
    // Fallback — ID without prefix
    return activeScenarioId;
  }, [activeScenarioId, isScenarioControlled, customScenarios]);

  // --- Derive supported bands from poller boot data -------------------------
  const supportedBands = {
    lte: parseBandString(data?.device.supported_lte_bands),
    nsa_nr5g: parseBandString(data?.device.supported_nsa_nr5g_bands),
    sa_nr5g: parseBandString(data?.device.supported_sa_nr5g_bands),
  };

  // --- Derive active bands from carrier_components (QCAINFO) ----------------
  const carrierComponents = data?.network.carrier_components ?? [];

  // Overall loading: either poller hasn't loaded yet or bands haven't loaded
  const isPageLoading = statusLoading || bandsLoading || scenariosLoading;

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">频段锁定</h1>
        <p className="text-muted-foreground">
          限制调制解调器可用的 LTE 和 NR 频段。
        </p>
      </div>

      {/* Scenario override banner */}
      {isScenarioControlled && !isPageLoading && (
        <Alert className="mb-4">
          <InfoIcon className="size-4" />
          <AlertDescription>
            <p>
              频段配置当前由{" "}
              <span className="font-semibold">{activeScenarioName}</span>{" "}
              场景接管。
            </p>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <BandSettingsComponent
          failover={failover}
          carrierComponents={carrierComponents}
          onToggleFailover={toggleFailover}
          isLoading={isPageLoading}
          isScenarioControlled={isScenarioControlled}
        />
        {BAND_CARDS.map(({ category, title, description }) => (
          <BandCardsComponent
            key={category}
            title={title}
            description={description}
            bandCategory={category}
            supportedBands={supportedBands[category]}
            currentLockedBands={
              currentBands
                ? parseBandString(getBandsForCategory(currentBands, category))
                : []
            }
            onLock={(bands) => lockBands(category, bands)}
            onUnlockAll={() => unlockAll(category, supportedBands[category])}
            isLocking={lockingCategory === category}
            isLoading={isPageLoading}
            error={error}
            disabled={isScenarioControlled}
          />
        ))}
      </div>
    </div>
  );
};

export default BandLockingComponent;
