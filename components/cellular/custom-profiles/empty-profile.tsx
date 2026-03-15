import React from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { SmartphoneIcon, RefreshCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

interface EmptyProfileViewProps {
  onRefresh?: () => void;
}

const EmptyProfileViewComponent = ({ onRefresh }: EmptyProfileViewProps) => {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Saved Profiles</CardTitle>
        <CardDescription>
          Manage your custom SIM profiles here.
        </CardDescription>
      </CardHeader>
      <CardContent className="h-full flex items-center justify-center">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SmartphoneIcon />
            </EmptyMedia>
            <EmptyTitle>No Custom Profiles</EmptyTitle>
            <EmptyDescription>
              You have not created any custom SIM profiles yet. Use the form to
              create your first profile.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {onRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh}>
                <RefreshCcwIcon className="size-4" />
                Refresh
              </Button>
            )}
          </EmptyContent>
        </Empty>
      </CardContent>
    </Card>
  );
};

export default EmptyProfileViewComponent;
