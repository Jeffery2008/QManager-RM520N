"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProfileTable } from "@/components/cellular/custom-profiles/custom-profile-table";
import EmptyProfileViewComponent from "@/components/cellular/custom-profiles/empty-profile";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProfileSummary } from "@/types/sim-profile";

// =============================================================================
// CustomProfileViewComponent — Profile List Card
// =============================================================================

interface CustomProfileViewProps {
  profiles: ProfileSummary[];
  activeProfileId: string | null;
  isLoading: boolean;
  error: string | null;
  onEdit: (id: string) => void;
  onDelete: (id: string) => Promise<boolean>;
  onActivate: (id: string) => void;
  onDeactivate: () => void;
  onRefresh: () => void;
  currentIccid?: string | null;
}

const CustomProfileViewComponent = ({
  profiles,
  activeProfileId,
  isLoading,
  error,
  onEdit,
  onDelete,
  onActivate,
  onDeactivate,
  onRefresh,
  currentIccid,
}: CustomProfileViewProps) => {
  if (isLoading) {
    return (
      <Card className="@container/card h-full">
        <CardHeader>
          <CardTitle>已保存配置</CardTitle>
          <CardDescription>管理你的自定义 SIM 配置。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (profiles.length === 0) {
    return <EmptyProfileViewComponent onRefresh={onRefresh} />;
  }

  return (
    <Card className="@container/card h-full">
      <CardHeader>
        <CardTitle>已保存配置</CardTitle>
        <CardDescription>
          已保存 {profiles.length} 个配置。
          {error && (
            <span className="text-destructive ml-2">{error}</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ProfileTable
          data={profiles}
          activeProfileId={activeProfileId}
          onEdit={onEdit}
          onDelete={onDelete}
          onActivate={onActivate}
          onDeactivate={onDeactivate}
          currentIccid={currentIccid}
        />
      </CardContent>
    </Card>
  );
};

export default CustomProfileViewComponent;
