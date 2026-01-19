import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChevronUp, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

export interface SortingState {
  id: string
  desc: boolean
}

export interface Column<T> {
  id: string
  header: string | React.ReactNode
  accessorKey?: keyof T
  cell?: (item: T) => React.ReactNode
  enableSorting?: boolean
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  isLoading?: boolean
  sorting?: SortingState | null
  onSortingChange?: (columnId: string) => void
  loadingRows?: number
  noResultsMessage?: string
  className?: string
  onRowClick?: (item: T) => void
  onRowHover?: (itemId: string | null) => void
  getItemId?: (item: T) => string
}

export function DataTable<T>({
  columns,
  data,
  isLoading = false,
  sorting = null,
  onSortingChange,
  loadingRows = 6,
  noResultsMessage = "No results found.",
  className,
  onRowClick,
  onRowHover,
  getItemId,
}: DataTableProps<T>) {
  return (
    <div className={cn("table-container", className)}>
      <Table className="table-base">
        <TableHeader className="table-header sticky top-0 z-10">
          <TableRow className="table-header-row">
            {columns.map((column) => (
              <TableHead
                key={column.id}
                className={cn(
                  "table-header-cell sm:py-4 py-2 sm:px-4 px-2",
                  column.enableSorting && "table-header-cell-sortable group",
                )}
                onClick={() => {
                  if (column.enableSorting && onSortingChange) {
                    onSortingChange(column.id)
                  }
                }}
              >
                {typeof column.header === "string" ? (
                  <div className="flex items-center justify-between">
                    {column.header}
                    {column.enableSorting && (
                      <div className="table-sort-icons">
                        <ChevronUp
                          className={cn(
                            "table-sort-icon table-sort-icon-up",
                            sorting?.id === column.id && !sorting.desc
                              ? "table-sort-icon-active"
                              : "table-sort-icon-inactive"
                          )}
                        />
                        <ChevronDown
                          className={cn(
                            "table-sort-icon table-sort-icon-down",
                            sorting?.id === column.id && sorting.desc
                              ? "table-sort-icon-active"
                              : "table-sort-icon-inactive"
                          )}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  column.header
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            // Skeleton loading rows
            Array(loadingRows)
              .fill(0)
              .map((_, index) => (
                <TableRow key={`skeleton-${index}`} className="table-row sm:h-auto h-12">
                  {columns.map((column, colIndex) => (
                    <TableCell key={`skeleton-cell-${colIndex}`} className="sm:py-4 py-2 sm:px-4 px-2">
                      {colIndex === 0 ? (
                        <div className="flex items-center gap-3">
                          <Skeleton className="size-8 rounded-lg" />
                          <Skeleton className="h-5 w-32" />
                        </div>
                      ) : (
                        <Skeleton className="h-5 w-24" />
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
          ) : data.length > 0 ? (
            data.map((item, itemIndex) => (
              <TableRow
                key={`row-${itemIndex}`}
                className={cn(
                  "table-row sm:h-auto h-12",
                  onRowClick && "cursor-pointer hover:bg-white/[0.05]"
                )}
                onClick={() => onRowClick && onRowClick(item)}
                onMouseEnter={() => onRowHover && getItemId && onRowHover(getItemId(item))}
                onMouseLeave={() => onRowHover && onRowHover(null)}
                style={{
                  ...(onRowClick ? { cursor: 'pointer' } : {}),
                  // content-visibility optimization for long lists (20+ items)
                  ...(data.length > 20 ? {
                    contentVisibility: 'auto',
                    containIntrinsicSize: '0 48px',
                  } : {}),
                }}
              >
                {columns.map((column) => (
                  <TableCell key={`cell-${column.id}-${itemIndex}`} className="sm:py-4 py-2 sm:px-4 px-2">
                    {column.cell
                      ? column.cell(item)
                      : column.accessorKey
                      ? String(item[column.accessorKey] || "")
                      : null}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-gray-400"
              >
                {noResultsMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
} 