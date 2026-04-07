"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth-fetch";
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

import { RotateCcwIcon } from "lucide-react";
import { IconGripVertical } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AiFillSignal } from "react-icons/ai";
import { motion } from "motion/react";
import { SaveButton, useSaveFlash } from "@/components/ui/save-button";

// =============================================================================
// RAT name mapping: AT command value → display name
// =============================================================================
const RAT_DISPLAY: Record<string, string> = {
  NR5G: "NR5G",
  LTE: "LTE",
  WCDMA: "WCDMA",
};

const RAT_COLORS: Record<string, { bg: string; fg: string }> = {
  NR5G: { bg: "bg-info", fg: "text-info-foreground" },
  LTE: { bg: "bg-success", fg: "text-success-foreground" },
  WCDMA: { bg: "bg-destructive", fg: "text-destructive-foreground" },
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
    <motion.div
      ref={setNodeRef}
      className="flex items-center gap-3 px-4 py-2 border bg-background rounded-lg"
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
        boxShadow: isDragging ? "0 8px 24px -4px hsl(var(--foreground) / 0.12)" : undefined,
        opacity: isDragging ? 0.6 : 1,
        scale: isDragging ? 0.98 : 1,
        zIndex: isDragging ? 10 : undefined,
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
        <span className="sr-only">拖动以重新排序</span>
      </Button>
      <div className="flex items-center gap-x-3">
        <div
          className={`rounded-lg size-7 p-1 ${
            RAT_COLORS[network.id]?.bg ?? "bg-muted-foreground"
          } flex justify-center items-center`}
        >
          <AiFillSignal className={`size-4 ${RAT_COLORS[network.id]?.fg ?? "text-background"}`} />
        </div>
        <span className="font-medium text-sm">{network.name}</span>
      </div>
      <span className="text-xs text-muted-foreground ml-auto">
        Priority {index + 1}
      </span>
    </motion.div>
  );
}

// =============================================================================
// 网络优先级 Card
// =============================================================================
const NetworkPriorityCard = () => {
  const { saved, markSaved } = useSaveFlash();
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
      const resp = await authFetch(CGI_ENDPOINT);
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
      toast.info("没有需要保存的更改");
      return;
    }

    setIsSaving(true);

    try {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: newOrder }),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data = await resp.json();
      if (!mountedRef.current) return;

      if (!data.success) {
        toast.error(data.detail || "设置网络优先级失败");
        return;
      }

      markSaved();
      toast.success("网络优先级已更新");

      // Brief recovery delay for network re-registration
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Silent re-fetch
      await fetchOrder(true);
    } catch {
      if (mountedRef.current) {
        toast.error("设置网络优先级失败");
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
          <CardTitle>网络优先级</CardTitle>
          <CardDescription>
            设置网络连接的优先级顺序。
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
        <CardTitle>网络优先级</CardTitle>
        <CardDescription>
          设置网络连接的优先级顺序。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DndContext
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
          sensors={sensors}
        >
          <motion.div
            className="space-y-2"
            initial="hidden"
            animate="visible"
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }}
          >
            <SortableContext
              items={networkIds}
              strategy={verticalListSortingStrategy}
            >
              {networks.map((network, index) => (
                <motion.div
                  key={network.id}
                  variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                >
                  <DraggableNetworkItem
                    network={network}
                    index={index}
                    disabled={isSaving}
                  />
                </motion.div>
              ))}
            </SortableContext>
          </motion.div>
        </DndContext>
        <div className="mt-4 flex items-center gap-x-2">
          <SaveButton
            onClick={handleSave}
            isSaving={isSaving}
            saved={saved}
            disabled={networks.length === 0}
          />
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isSaving}
            aria-label="恢复为已保存的值"
          >
            <RotateCcwIcon />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default NetworkPriorityCard;
