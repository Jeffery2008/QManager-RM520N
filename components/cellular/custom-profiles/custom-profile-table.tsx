"use client";

import * as React from "react";
import { motion } from "motion/react";
import { TriangleAlertIcon } from "lucide-react";
import {
  TbCircleCheckFilled,
  TbDotsVertical,
  TbEdit,
  TbPlayerPlay,
  TbPlayerStop,
  TbTrash,
} from "react-icons/tb";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const MotionTableRow = motion.create(TableRow);
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

import type { ProfileSummary } from "@/types/sim-profile";
import { formatProfileDate } from "@/types/sim-profile";

// =============================================================================
// ProfileTable — Displays saved SIM profiles with actions
// =============================================================================
// No drag-and-drop. Profiles have no inherent ordering.
// Actions: Edit, Activate (future), Delete.
// =============================================================================

interface ProfileTableProps {
  data: ProfileSummary[];
  activeProfileId: string | null;
  onEdit: (id: string) => void;
  onDelete: (id: string) => Promise<boolean>;
  onActivate?: (id: string) => void;
  onDeactivate?: () => void;
  currentIccid?: string | null;
}

export function ProfileTable({
  data,
  activeProfileId,
  onEdit,
  onDelete,
  onActivate,
  onDeactivate,
  currentIccid,
}: ProfileTableProps) {
  const [deleteTarget, setDeleteTarget] = React.useState<ProfileSummary | null>(
    null
  );
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    await onDelete(deleteTarget.id);
    setIsDeleting(false);
    setDeleteTarget(null);
  };

  const columns: ColumnDef<ProfileSummary>[] = React.useMemo(
    () => [
      {
        accessorKey: "name",
        header: "配置",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <div>
              <div className="font-medium">{row.original.name}</div>
              {row.original.mno && (
                <div className="text-muted-foreground text-xs">
                  {row.original.mno}
                </div>
              )}
            </div>
          </div>
        ),
        enableHiding: false,
      },
      {
        id: "status",
        header: "状态",
        cell: ({ row }) => {
          const isActive = row.original.id === activeProfileId;
          if (isActive) {
            const profileIccid = row.original.sim_iccid;
            const isMismatch =
              profileIccid && currentIccid && profileIccid !== currentIccid;

            if (isMismatch) {
              return (
                <Badge
                  variant="outline"
                  className="px-1.5 bg-warning/15 text-warning hover:bg-warning/20 border-warning/30"
                >
                  <TriangleAlertIcon className="size-3" />
                  SIM 不匹配
                </Badge>
              );
            }

            return (
              <Badge
                variant="outline"
                className="px-1.5 text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800"
              >
                <TbCircleCheckFilled className="fill-blue-500 dark:fill-blue-400" />
                已激活
              </Badge>
            );
          }
          return (
            <Badge
              variant="outline"
              className="px-1.5 text-muted-foreground"
            >
              未激活
            </Badge>
          );
        },
      },
      {
        id: "updated",
        header: "最后更新",
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {formatProfileDate(row.original.updated_at)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="data-[state=open]:bg-muted text-muted-foreground flex size-8"
                size="icon"
              >
                <TbDotsVertical />
                <span className="sr-only">打开菜单</span>
              </Button>
            </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => onEdit(row.original.id)}>
                  <TbEdit className="size-4" />
                  编辑
                </DropdownMenuItem>
              {onActivate && row.original.id !== activeProfileId && (
                <DropdownMenuItem
                  onClick={() => onActivate(row.original.id)}
                >
                  <TbPlayerPlay className="size-4" />
                  激活
                </DropdownMenuItem>
              )}
              {onDeactivate && row.original.id === activeProfileId && (
                <DropdownMenuItem onClick={onDeactivate}>
                  <TbPlayerStop className="size-4" />
                  停用
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteTarget(row.original)}
              >
                <TbTrash className="size-4" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [activeProfileId, onEdit, onActivate, onDeactivate, currentIccid]
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 10 },
    },
  });

  return (
    <>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row, index) => (
                <MotionTableRow
                  key={row.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(index * 0.05, 0.4), ease: "easeOut" }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </MotionTableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  还没有配置，请先创建一个。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {data.length > 0 && (
        <div className="flex items-center justify-between px-2 pt-2">
          <span className="text-muted-foreground text-sm">
            共 {data.length} 个配置
          </span>
          {table.getPageCount() > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                上一页
              </Button>
              <span className="text-sm">
                第 {table.getState().pagination.pageIndex + 1} / {table.getPageCount()} 页
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                下一页
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除配置</AlertDialogTitle>
            <AlertDialogDescription>
              确认删除 &ldquo;{deleteTarget?.name}&rdquo; 吗？
              此操作无法撤销。删除该配置不会改变当前调制解调器配置。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "删除中…" : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
