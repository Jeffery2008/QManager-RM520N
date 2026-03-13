"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  type Row,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ChevronDown,
  Info,
  LockIcon,
  MoreVertical,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";

export interface CellScanResult {
  id: string;
  networkType: string;
  earfcn: number;
  pci: number;
  band: number;
  bandwidth: number;
  cellID: number;
  tac: number;
  signalStrength: number;
  mcc: number;
  mnc: number;
  provider: string;
  scs?: number | null;
}

interface ScanResultViewProps {
  data: CellScanResult[];
  onLockCell?: (cell: CellScanResult) => void;
}

const getSignalBadge = (strength: number) => {
  if (strength >= -85)
    return (
      <Badge className="bg-success/15 text-success hover:bg-success/20 border-success/30">
        Good
      </Badge>
    );
  if (strength >= -100)
    return (
      <Badge className="bg-warning/15 text-warning hover:bg-warning/20 border-warning/30">
        Fair
      </Badge>
    );
  return (
    <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/20 border-destructive/30">
      Bad
    </Badge>
  );
};

const getNetworkTypeBadge = (type: string) => {
  return <Badge variant="default">{type}</Badge>;
};

const createColumns = (
  onLockCell?: (cell: CellScanResult) => void,
): ColumnDef<CellScanResult>[] => [
  {
    accessorKey: "networkType",
    header: () => <div>Network</div>,
    cell: ({ row }) => (
      <div>{getNetworkTypeBadge(row.getValue("networkType"))}</div>
    ),
  },
  {
    accessorKey: "provider",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Provider
        <ArrowUpDown className="h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const cell = row.original;
      return (
        <div className="flex items-center gap-1">
          <span className="font-semibold">{cell.provider}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 cursor-pointer" />
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {cell.mcc} {cell.mnc}
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
      );
    },
  },
  {
    accessorKey: "band",
    header: "Band",
    cell: ({ row }) => {
      const networkType = row.original.networkType;
      const band = row.getValue("band") as number;
      const prefix = networkType === "NR5G-SA" ? "N" : "B";
      return (
        <div className="font-semibold">
          {prefix}
          {band}
        </div>
      );
    },
  },
  {
    accessorKey: "earfcn",
    header: "EARFCN",
    cell: ({ row }) => (
      <div className="font-semibold">{row.getValue("earfcn")}</div>
    ),
  },
  {
    accessorKey: "pci",
    header: "PCI",
    cell: ({ row }) => (
      <div className="font-semibold">{row.getValue("pci")}</div>
    ),
  },
  {
    accessorKey: "cellID",
    header: "Cell ID",
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue("cellID")}</div>
    ),
  },
  {
    accessorKey: "tac",
    header: "TAC",
    cell: ({ row }) => <div className="font-medium">{row.getValue("tac")}</div>,
  },
  {
    accessorKey: "bandwidth",
    header: "BW",
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue("bandwidth")} MHz</div>
    ),
  },
  {
    accessorKey: "signalStrength",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Signal
        <ArrowUpDown className="h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const strength = row.getValue("signalStrength") as number;
      return (
        <div className="flex items-center gap-2">
          {getSignalBadge(strength)}
          <span className="font-semibold">{strength} dBm</span>
        </div>
      );
    },
  },
  {
    id: "actions",
    header: () => null,
    enableHiding: false,
    cell: ({ row }: { row: Row<CellScanResult> }) => {
      const cellData = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="data-[state=open]:bg-muted text-muted-foreground flex size-8"
              size="icon"
            >
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => onLockCell?.(cellData)}>
              <LockIcon className="h-4 w-4" />
              Lock Cell
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

const ScanResultView = ({ data, onLockCell }: ScanResultViewProps) => {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const isMobile = useIsMobile();

  const columns = React.useMemo(() => createColumns(onLockCell), [onLockCell]);

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
  });

  return (
    <div className="relative flex flex-col gap-4 overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        <Input
          placeholder="Filter by provider..."
          value={
            (table.getColumn("provider")?.getFilterValue() as string) ?? ""
          }
          onChange={(event) =>
            table.getColumn("provider")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="sm:ml-auto">
              Columns <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table className={isMobile ? "min-w-[800px]" : ""}>
          <TableHeader className="bg-muted sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="text-muted-foreground flex-1 text-sm">
          {table.getFilteredRowModel().rows.length} cell(s) found.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ScanResultView;
