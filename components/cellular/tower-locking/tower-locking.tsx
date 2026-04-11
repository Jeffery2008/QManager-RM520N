"use client";

import React from "react";
import { toast } from "sonner";
import TowerLockingSettingsComponent from "@/components/cellular/tower-locking/tower-settings";
import ScheduleTowerLockingComponent from "./schedule-locking";
import LTELockingComponent from "./lte-locking";
import NRSALockingComponent from "./nr-sa-locking";
import { useTowerLocking } from "@/hooks/use-tower-locking";
import { useModemStatus } from "@/hooks/use-modem-status";

const TowerLockingComponent = () => {
  const tower = useTowerLocking();
  const { data: modemData } = useModemStatus();

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">基站锁定</h1>
        <p className="text-muted-foreground">
          通过 PCI 和 EARFCN 锁定到指定的小区基站。
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
          <TowerLockingSettingsComponent
            config={tower.config}
            failoverState={tower.failoverState}
            modemData={modemData}
            isLoading={tower.isLoading}
            onPersistChange={(persist) => {
              if (!tower.config) {
                toast.error("Settings unavailable — try refreshing the page");
                return;
              }
              tower.updateSettings(persist, tower.config.failover);
            }}
            onFailoverChange={(enabled) => {
              if (!tower.config) {
                toast.error("Settings unavailable — try refreshing the page");
                return;
              }
              tower.updateSettings(tower.config.persist, {
                ...tower.config.failover,
                enabled,
              });
            }}
            onThresholdChange={async (threshold) => {
              if (!tower.config) {
                toast.error("Settings unavailable — try refreshing the page");
                return false;
              }
              return tower.updateSettings(tower.config.persist, {
                ...tower.config.failover,
                threshold,
              });
            }}
          />
          <LTELockingComponent
            config={tower.config}
            modemState={tower.modemState}
            modemData={modemData}
            isLoading={tower.isLoading}
            isLocking={tower.isLteLocking}
            isWatcherRunning={tower.isWatcherRunning}
            onLock={(cells) => tower.lockLte(cells)}
            onUnlock={() => tower.unlockLte()}
          />
        </div>

        <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
          <ScheduleTowerLockingComponent
            config={tower.config}
            onScheduleChange={(schedule) => tower.updateSchedule(schedule)}
          />
          <NRSALockingComponent
            config={tower.config}
            modemState={tower.modemState}
            modemData={modemData}
            networkType={modemData?.network?.type ?? ""}
            isLoading={tower.isLoading}
            isLocking={tower.isNrLocking}
            isWatcherRunning={tower.isWatcherRunning}
            onLock={(cell) => tower.lockNrSa(cell)}
            onUnlock={() => tower.unlockNrSa()}
          />
        </div>
      </div>
    </div>
  );
};

export default TowerLockingComponent;
