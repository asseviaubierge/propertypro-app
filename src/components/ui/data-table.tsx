"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Column definition type
export interface DataTableColumn<T> {
  id: string;
  header: React.ReactNode;
  cell: (row: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  /** Responsive visibility: 'always' | 'sm' | 'md' | 'lg' | 'xl' */
  visibility?: "always" | "sm" | "md" | "lg" | "xl";
  /** Width class e.g., 'w-12', 'w-[200px]', 'min-w-[120px]' */
  width?: string;
  /** Text alignment */
  align?: "left" | "center" | "right";
}

// Selection configuration
export interface DataTableSelection<T> {
  enabled: boolean;
  selectedIds: string[];
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
  getRowId: (row: T) => string;
  isRowDisabled?: (row: T) => boolean;
  selectAllLabel?: string;
  selectRowLabel?: (row: T) => string;
}

// Pagination configuration
export interface DataTablePagination {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  showingText?: string; // e.g., "Showing 1-10 of 100"
  previousLabel?: string;
  nextLabel?: string;
}

// Empty state configuration
export interface DataTableEmptyState {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

// Error state configuration
export interface DataTableErrorState {
  message: string;
  icon?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
}

// Loading skeleton configuration
export interface DataTableLoadingConfig {
  rows?: number;
  /** Custom skeleton for each column, or use default */
  columnSkeletons?: Record<string, React.ReactNode>;
}

// Main DataTable props
export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  loading?: boolean;
  error?: DataTableErrorState | null;
  emptyState?: DataTableEmptyState;
  selection?: DataTableSelection<T>;
  pagination?: DataTablePagination;
  loadingConfig?: DataTableLoadingConfig;
  /** Container class for the table wrapper */
  containerClassName?: string;
  /** Class for the table element */
  tableClassName?: string;
  /** Enable zebra striping */
  striped?: boolean;
  /** Row key extractor */
  getRowKey: (row: T, index: number) => string;
  /** Custom row class */
  getRowClassName?: (row: T, index: number) => string;
  /** On row click handler */
  onRowClick?: (row: T) => void;
}

function DataTable<T>({
  columns,
  data,
  loading = false,
  error = null,
  emptyState,
  selection,
  pagination,
  loadingConfig = { rows: 8 },
  containerClassName,
  tableClassName,
  striped = true,
  getRowKey,
  getRowClassName,
  onRowClick,
}: DataTableProps<T>) {
  // Helper to get visibility class
  const getVisibilityClass = (visibility?: string) => {
    switch (visibility) {
      case "sm":
        return "hidden sm:table-cell";
      case "md":
        return "hidden md:table-cell";
      case "lg":
        return "hidden lg:table-cell";
      case "xl":
        return "hidden xl:table-cell";
      default:
        return "";
    }
  };

  // Helper to get alignment class
  const getAlignClass = (align?: string) => {
    switch (align) {
      case "center":
        return "text-center";
      case "right":
        return "text-right";
      default:
        return "text-left";
    }
  };

  // Check if all visible rows are selected
  const isAllSelected = React.useMemo(() => {
    if (!selection) return false;
    const selectableRows = data.filter(
      (row) => !selection.isRowDisabled?.(row)
    );
    if (selectableRows.length === 0) return false;
    return selectableRows.every((row) =>
      selection.selectedIds.includes(selection.getRowId(row))
    );
  }, [data, selection]);

  // Render loading skeleton
  const renderLoadingSkeleton = () => (
    <>
      {Array.from({ length: loadingConfig.rows || 8 }).map((_, rowIndex) => (
        <TableRow key={`skeleton-${rowIndex}`}>
          {selection?.enabled && (
            <TableCell className="py-4 px-4 w-12">
              <Skeleton className="h-4 w-4" />
            </TableCell>
          )}
          {columns.map((column) => (
            <TableCell
              key={`skeleton-${rowIndex}-${column.id}`}
              className={cn(
                "py-4 px-4",
                getVisibilityClass(column.visibility),
                column.className
              )}
            >
              {loadingConfig.columnSkeletons?.[column.id] || (
                <Skeleton className="h-4 w-full max-w-[120px]" />
              )}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );

  // Render error state
  const renderError = () => (
    <TableRow>
      <TableCell
        colSpan={columns.length + (selection?.enabled ? 1 : 0)}
        className="py-16"
      >
        <div className="flex flex-col items-center justify-center text-center">
          {error?.icon}
          <span className="text-red-600 mt-2">{error?.message}</span>
          {error?.onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={error.onRetry}
              className="mt-4"
            >
              {error.retryLabel || "Try Again"}
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );

  // Render empty state
  const renderEmpty = () => (
    <TableRow>
      <TableCell
        colSpan={columns.length + (selection?.enabled ? 1 : 0)}
        className="py-16"
      >
        <div className="flex flex-col items-center justify-center text-center">
          {emptyState?.icon}
          <span className="text-gray-600 dark:text-gray-400 mt-2 font-medium">
            {emptyState?.title}
          </span>
          {emptyState?.description && (
            <span className="text-gray-500 dark:text-gray-500 text-sm mt-1">
              {emptyState.description}
            </span>
          )}
          {emptyState?.action && (
            <div className="mt-4">{emptyState.action}</div>
          )}
        </div>
      </TableCell>
    </TableRow>
  );

  // Render data rows
  const renderDataRows = () =>
    data.map((row, index) => {
      const rowKey = getRowKey(row, index);
      const isSelected = selection
        ? selection.selectedIds.includes(selection.getRowId(row))
        : false;
      const isDisabled = selection?.isRowDisabled?.(row) ?? false;

      return (
        <TableRow
          key={rowKey}
          className={cn(
            "border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors",
            striped &&
              (index % 2 === 0
                ? "bg-white dark:bg-gray-800"
                : "bg-gray-50/20 dark:bg-gray-800/50"),
            isSelected && "bg-blue-50/50 dark:bg-blue-900/20",
            onRowClick && "cursor-pointer",
            getRowClassName?.(row, index)
          )}
          onClick={() => onRowClick?.(row)}
          data-state={isSelected ? "selected" : undefined}
        >
          {selection?.enabled && (
            <TableCell className="py-4 px-4 w-12">
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) =>
                  selection.onSelectRow(
                    selection.getRowId(row),
                    checked as boolean
                  )
                }
                disabled={isDisabled}
                aria-label={selection.selectRowLabel?.(row) || "Select row"}
                onClick={(e) => e.stopPropagation()}
              />
            </TableCell>
          )}
          {columns.map((column) => (
            <TableCell
              key={`${rowKey}-${column.id}`}
              className={cn(
                "py-4 px-4",
                getVisibilityClass(column.visibility),
                getAlignClass(column.align),
                column.className
              )}
            >
              {column.cell(row, index)}
            </TableCell>
          ))}
        </TableRow>
      );
    });

  return (
    <div className={cn("space-y-4", containerClassName)}>
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <Table className={tableClassName}>
          <TableHeader className="bg-gray-50/50 dark:bg-gray-800/50">
            <TableRow className="border-b border-gray-200 dark:border-gray-700">
              {selection?.enabled && (
                <TableHead className="font-medium text-gray-700 dark:text-gray-300 py-3 px-4 w-12">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={selection.onSelectAll}
                    aria-label={selection.selectAllLabel || "Select all"}
                  />
                </TableHead>
              )}
              {columns.map((column) => (
                <TableHead
                  key={column.id}
                  className={cn(
                    "font-medium text-gray-700 dark:text-gray-300 py-3 px-4",
                    getVisibilityClass(column.visibility),
                    getAlignClass(column.align),
                    column.width,
                    column.headerClassName
                  )}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? renderLoadingSkeleton()
              : error
              ? renderError()
              : data.length === 0
              ? renderEmpty()
              : renderDataRows()}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && !loading && !error && data.length > 0 && (
        <div className="flex items-center justify-between px-2">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {pagination.showingText}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                pagination.onPageChange(pagination.currentPage - 1)
              }
              disabled={pagination.currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              {pagination.previousLabel || "Previous"}
            </Button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {pagination.currentPage} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                pagination.onPageChange(pagination.currentPage + 1)
              }
              disabled={pagination.currentPage >= pagination.totalPages}
            >
              {pagination.nextLabel || "Next"}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export { DataTable };
