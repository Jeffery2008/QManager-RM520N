"use client";

import * as React from "react";
import { motion } from "motion/react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table";
import {
  TbDotsVertical,
  TbEye,
  TbTrash,
  TbRefresh,
  TbPlus,
} from "react-icons/tb";
import { AlertCircleIcon, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";

import type { SmsData } from "@/hooks/use-sms";
import type { SmsMessage } from "@/types/sms";
import SmsComposeDialog from "./sms-compose-dialog";

// =============================================================================
// SmsInboxCard — Displays SMS messages in a table with view/delete actions
// =============================================================================

interface SmsInboxCardProps {
  data: SmsData | null;
  isLoading: boolean;
  isSaving: boolean;
  /** Error from the hook (fetch or mutation failure) */
  error: string | null;
  onSend: (phone: string, message: string) => Promise<boolean>;
  onDelete: (indexes: number[]) => Promise<boolean>;
  onDeleteAll: () => Promise<boolean>;
  onRefresh: () => void;
}

export default function SmsInboxCard({
  data,
  isLoading,
  isSaving,
  error,
  onSend,
  onDelete,
  onDeleteAll,
  onRefresh,
}: SmsInboxCardProps) {
  const [viewMessage, setViewMessage] = React.useState<SmsMessage | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<SmsMessage | null>(
    null,
  );
  const [showDeleteAll, setShowDeleteAll] = React.useState(false);
  const [showDeleteSelected, setShowDeleteSelected] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [showCompose, setShowCompose] = React.useState(false);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const success = await onDelete(deleteTarget.indexes);
    setIsDeleting(false);
    setDeleteTarget(null);
    if (success) {
      toast.success("短信已删除");
    } else {
      toast.error("删除短信失败");
    }
  };

  const handleDeleteAll = async () => {
    setIsDeleting(true);
    const success = await onDeleteAll();
    setIsDeleting(false);
    setShowDeleteAll(false);
    setRowSelection({});
    if (success) {
      toast.success("已删除全部短信");
    } else {
      toast.error("删除短信失败");
    }
  };

  const handleDeleteSelected = async () => {
    const selectedRows = table.getSelectedRowModel().rows;
    if (selectedRows.length === 0) return;

    setIsDeleting(true);
    // Collect all indexes from all selected messages
    const allIndexes = selectedRows.flatMap((row) => row.original.indexes);
    const success = await onDelete(allIndexes);
    setIsDeleting(false);
    setShowDeleteSelected(false);
    setRowSelection({});
    if (success) {
      toast.success(
        `已删除 ${selectedRows.length} 条短信`,
      );
    } else {
      toast.error("删除所选短信失败");
    }
  };

  const selectedCount = Object.keys(rowSelection).length;

  const columns: ColumnDef<SmsMessage>[] = React.useMemo(
    () => [
      {
        id: "select",
        header: ({ table: t }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={
                t.getIsAllPageRowsSelected() ||
                (t.getIsSomePageRowsSelected() && "indeterminate")
              }
              onCheckedChange={(value) =>
                t.toggleAllPageRowsSelected(!!value)
              }
              aria-label="全选"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="选择行"
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "sender",
        header: "发件人",
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="font-medium truncate">{row.original.sender}</div>
            <span className="block text-xs text-muted-foreground @sm/card:hidden">
              {row.original.timestamp}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "content",
        header: () => (
          <span className="hidden @md/card:inline">短信内容</span>
        ),
        cell: ({ row }) => (
          <div className="hidden @md/card:block max-w-xs truncate text-muted-foreground">
            {row.original.content}
          </div>
        ),
      },
      {
        id: "date",
        header: () => (
          <span className="hidden @sm/card:inline">日期</span>
        ),
        cell: ({ row }) => (
          <span className="hidden @sm/card:inline text-muted-foreground text-sm whitespace-nowrap">
            {row.original.timestamp}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
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
                <DropdownMenuItem onClick={() => setViewMessage(row.original)}>
                  <TbEye className="size-4" />
                  查看
                </DropdownMenuItem>
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
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: data?.messages ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
    },
    initialState: {
      pagination: { pageSize: 10 },
    },
  });

  // --- Loading state ---------------------------------------------------------
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-5 w-20" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-48" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Error state (fetch failed, no data) ----------------------------------
  if (error && !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>收件箱</CardTitle>
          <CardDescription>
            查看和管理你的短信。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            role="alert"
            className="flex flex-col items-center gap-3 py-8 text-center"
          >
            <AlertCircleIcon className="size-8 text-destructive" />
            <div className="space-y-1">
              <p className="text-sm font-medium">加载短信失败</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <TbRefresh className="size-4" />
              重试
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const messages = data?.messages ?? [];
  const storage = data?.storage;

  return (
    <>
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>收件箱</CardTitle>
          <CardDescription>
            查看和管理你的短信。
            {storage
              ? `，当前已存储 ${storage.used}/${storage.total} 条短信`
              : ""}
          </CardDescription>
          <CardAction>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isSaving}
                aria-label="刷新收件箱"
              >
                <TbRefresh className="size-4" />
              </Button>
              {selectedCount > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteSelected(true)}
                  disabled={isSaving}
                  aria-label={`删除已选中的 ${selectedCount} 条短信`}
                >
                  <Trash2 className="size-4" />
                  <span className="hidden @sm/card:inline">
                    删除（{selectedCount}）
                  </span>
                </Button>
              )}
              {messages.length > 0 && selectedCount === 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteAll(true)}
                  disabled={isSaving}
                  aria-label="删除全部短信"
                >
                  <Trash2 className="size-4" />
                  <span className="hidden @sm/card:inline">删除全部</span>
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => setShowCompose(true)}
                disabled={isSaving}
              >
                <TbPlus className="size-4" />
                <span className="hidden @xs/card:inline">新短信</span>
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
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
                              header.getContext(),
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
                      className="cursor-pointer"
                      tabIndex={0}
                      aria-label={`Message from ${row.original.sender}`}
                      onClick={() => setViewMessage(row.original)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setViewMessage(row.original);
                        }
                      }}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(index * 0.04, 0.4), ease: "easeOut" }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
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
                      未找到短信。
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {messages.length > 0 && (
            <div className="flex items-center justify-between px-2 pt-2">
              <span className="text-muted-foreground text-sm">
                共 {messages.length} 条短信
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
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
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
        </CardContent>
      </Card>

      {/* View Message Dialog */}
      <Dialog
        open={!!viewMessage}
        onOpenChange={(open) => !open && setViewMessage(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>来自 {viewMessage?.sender} 的短信</DialogTitle>
            <DialogDescription>{viewMessage?.timestamp}</DialogDescription>
          </DialogHeader>
          <div className="whitespace-pre-wrap wrap-break-word text-sm">
            {viewMessage?.content}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Single Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除短信</AlertDialogTitle>
            <AlertDialogDescription>
              确认删除来自 {deleteTarget?.sender} 的这条短信吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  删除中…
                </>
              ) : (
                "删除"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Confirmation */}
      <AlertDialog
        open={showDeleteAll}
        onOpenChange={(open) => !open && setShowDeleteAll(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除全部短信</AlertDialogTitle>
            <AlertDialogDescription>
              确认删除全部 {messages.length} 条短信吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAll}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  删除中…
                </>
              ) : (
                "删除全部"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Selected Confirmation */}
      <AlertDialog
        open={showDeleteSelected}
        onOpenChange={(open) => !open && setShowDeleteSelected(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除所选短信</AlertDialogTitle>
            <AlertDialogDescription>
              确认删除所选的 {selectedCount} 条短信吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  删除中…
                </>
              ) : (
                `删除（${selectedCount}）`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Compose Dialog */}
      <SmsComposeDialog
        open={showCompose}
        onOpenChange={setShowCompose}
        onSend={onSend}
        isSaving={isSaving}
      />
    </>
  );
}
