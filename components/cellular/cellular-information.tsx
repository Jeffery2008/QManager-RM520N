"use client";

import React from "react";
import { useModemStatus } from "@/hooks/use-modem-status";
import CellDataComponent from "@/components/cellular/cell-data";
import ActiveBandsComponent from "@/components/cellular/active-bands";

const CellularInformationComponent = () => {
  const { data, isLoading } = useModemStatus();

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          Cellular and Radio Information
        </h1>
        <p className="text-muted-foreground">
          View detailed information about your device&apos;s cellular radio
          status, including signal strength, network type, and connection
          status.
        </p>
      </div>
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <CellDataComponent
          network={data?.network ?? null}
          lte={data?.lte ?? null}
          nr={data?.nr ?? null}
          device={data?.device ?? null}
          isLoading={isLoading}
        />
        <ActiveBandsComponent
          carrierComponents={data?.network?.carrier_components ?? null}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};

export default CellularInformationComponent;
