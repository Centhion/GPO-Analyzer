import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  pageSize?: number;
  searchPlaceholder?: string;
  onRowClick?: (row: T) => void;
  getRowId?: (row: T) => string;
  selectedRowId?: string | null;
  // Server-side pagination props
  serverPagination?: {
    page: number;
    totalPages: number;
    total: number;
    onPageChange: (page: number) => void;
  };
}

export function DataTable<T>({
  data,
  columns,
  pageSize = 50,
  searchPlaceholder = 'Search...',
  onRowClick,
  getRowId,
  selectedRowId,
  serverPagination,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
      columnFilters,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: serverPagination ? undefined : getPaginationRowModel(),
    initialState: {
      pagination: { pageSize },
    },
  });

  const rows = serverPagination ? table.getRowModel().rows : table.getRowModel().rows;

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-warm-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div className="text-sm text-gray-600">
          {serverPagination 
            ? `${serverPagination.total.toLocaleString()} total rows`
            : `${table.getFilteredRowModel().rows.length.toLocaleString()} rows`
          }
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-warm-300 shadow-sm">
        <table className="data-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                    className={header.column.getCanSort() ? 'cursor-pointer select-none' : ''}
                  >
                    <div className="flex items-center gap-2">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <span className="text-gray-400">
                          {{
                            asc: <ChevronUp className="h-4 w-4" />,
                            desc: <ChevronDown className="h-4 w-4" />,
                          }[header.column.getIsSorted() as string] ?? (
                            <ChevronsUpDown className="h-4 w-4" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-8 text-gray-500">
                  No data available
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const rowId = getRowId ? getRowId(row.original) : row.id;
                const isSelected = selectedRowId && rowId === selectedRowId;
                return (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick?.(row.original)}
                    className={`
                      ${onRowClick ? 'cursor-pointer' : ''}
                      ${isSelected ? 'bg-primary-100 border-l-4 border-primary-500' : ''}
                      ${onRowClick && !isSelected ? 'hover:bg-primary-50' : ''}
                    `.trim()}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {serverPagination ? (
            <>Page {serverPagination.page} of {serverPagination.totalPages}</>
          ) : (
            <>
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => serverPagination 
              ? serverPagination.onPageChange(serverPagination.page - 1)
              : table.previousPage()
            }
            disabled={serverPagination 
              ? serverPagination.page <= 1
              : !table.getCanPreviousPage()
            }
            className="px-3 py-1 border border-warm-300 rounded hover:bg-warm-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </button>
          <button
            onClick={() => serverPagination
              ? serverPagination.onPageChange(serverPagination.page + 1)
              : table.nextPage()
            }
            disabled={serverPagination
              ? serverPagination.page >= serverPagination.totalPages
              : !table.getCanNextPage()
            }
            className="px-3 py-1 border border-warm-300 rounded hover:bg-warm-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper to create column definitions
export function createColumn<T>(
  accessor: keyof T | string,
  header: string,
  options?: {
    cell?: (value: unknown, row: T) => React.ReactNode;
    enableSorting?: boolean;
    size?: number;
  }
): ColumnDef<T, unknown> {
  return {
    accessorKey: accessor,
    header,
    cell: options?.cell 
      ? ({ getValue, row }) => options.cell!(getValue(), row.original)
      : ({ getValue }) => String(getValue() ?? ''),
    enableSorting: options?.enableSorting ?? true,
    size: options?.size,
  };
}
