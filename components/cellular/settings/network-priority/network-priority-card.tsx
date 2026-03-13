"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Loader2, RotateCcwIcon } from "lucide-react";
import { IconGripVertical } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AiFillSignal } from "react-icons/ai";

// =============================================================================
// RAT name mapping: AT command value → display name
// =============================================================================
const RAT_DISPLAY: Record<string, string> = {
  NR5G: "NR5G",
  LTE: "LTE",
  WCDMA: "WCDMA",
};

const RAT_COLORS: Record<string, string> = {
  NR5G: "bg-info",
  LTE: "bg-success",
  WCDMA: "bg-destructive",
};

interface NetworkItem {
  id: string;
  name: string;
}

const CGI_ENDPOINT = "/cgi-bin/quecmanager/cellular/network_priority.sh";

// =============================================================================
// Draggable item
// =============================================================================
function DraggableNetworkItem({
  network,
  index,
  disabled,
}: {
  network: NetworkItem;
  index: number;
  disabled: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: network.id,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-3 px-4 py-2 border bg-background rounded-lg transition-all duration-200 ${
        isDragging ? "opacity-50 scale-95 z-10" : ""
      }`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
      }}
    >
      <Button
        {...attributes}
        {...listeners}
        variant="ghost"
        size="icon"
        className="text-muted-foreground size-7 hover:bg-accent cursor-grab active:cursor-grabbing"
        disabled={disabled}
      >
        <IconGripVertical className="text-muted-foreground size-4" />
        <span className="sr-only">Drag to reorder</span>
      </Button>
      <div className="flex items-center gap-x-3">
        <div
          className={`rounded-lg size-7 p-1 ${
            RAT_COLORS[network.id] || "bg-gray-600"
          } flex justify-center items-center`}
        >
          <AiFillSignal className="h-4 w-4 text-white" />
        </div>
        <span className="font-medium text-sm">{network.name}</span>
      </div>
      <span className="text-xs text-muted-foreground ml-auto">
        Priority {index + 1}
      </span>
    </div>
  );
}

// =============================================================================
// Network Priority Card
// =============================================================================
const NetworkPriorityCard = () => {
  const [networks, setNetworks] = useState<NetworkItem[]>([]);
  const [fetchedOrder, setFetchedOrder] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Parse order string into NetworkItem array
  // ---------------------------------------------------------------------------
  const orderToNetworks = (order: string): NetworkItem[] =>
    order
      .split(":")
      .filter((r) => r.length > 0)
      .map((rat) => ({
        id: rat,
        name: RAT_DISPLAY[rat] || rat,
      }));

  // ---------------------------------------------------------------------------
  // Fetch current order
  // ---------------------------------------------------------------------------
  const fetchOrder = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);

    try {
      const resp = await fetch(CGI_ENDPOINT);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data = await resp.json();
      if (!mountedRef.current) return;

      if (!data.success) return;

      setFetchedOrder(data.order);
      setNetworks(orderToNetworks(data.order));
    } catch {
      // silently fail — keep current state
    } finally {
      if (mountedRef.current && !silent) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // ---------------------------------------------------------------------------
  // Drag handler
  // ---------------------------------------------------------------------------
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  );

  const networkIds = useMemo<UniqueIdentifier[]>(
    () => networks.map(({ id }) => id),
    [networks]
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setNetworks((prev) => {
        const oldIndex = prev.findIndex((n) => n.id === active.id);
        const newIndex = prev.findIndex((n) => n.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------
  const handleSave = async () => {
    const newOrder = networks.map((n) => n.id).join(":");

    if (newOrder === fetchedOrder) {
      toast.info("No changes to save");
      return;
    }

    setIsSaving(true);

    try {
      const resp = await fetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: newOrder }),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data = await resp.json();
      if (!mountedRef.current) return;

      if (!data.success) {
        toast.error(data.detail || "Failed to set network priority");
        return;
      }

      toast.success("Network priority updated");

      // Brief recovery delay for network re-registration
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Silent re-fetch
      await fetchOrder(true);
    } catch {
      if (mountedRef.current) {
        toast.error("Failed to set network priority");
      }
    } finally {
      if (mountedRef.current) {
        setIsSaving(false);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------
  const handleReset = () => {
    if (fetchedOrder) {
      setNetworks(orderToNetworks(fetchedOrder));
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Network Priority</CardTitle>
          <CardDescription>
            Set the priority order of your network connections.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid space-y-2 w-full">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Network Priority</CardTitle>
        <CardDescription>
          Set the priority order of your network connections.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DndContext
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
          sensors={sensors}
        >
          <div className="space-y-2">
            <SortableContext
              items={networkIds}
              strategy={verticalListSortingStrategy}
            >
              {networks.map((network, index) => (
                <DraggableNetworkItem
                  key={network.id}
                  network={network}
                  index={index}
                  disabled={isSaving}
                />
              ))}
            </SortableContext>
          </div>
        </DndContext>
        <div className="mt-4 flex items-center gap-x-2">
          <Button
            onClick={handleSave}
            disabled={isSaving || networks.length === 0}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Settings"
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isSaving}
          >
            <RotateCcwIcon />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default NetworkPriorityCard;
