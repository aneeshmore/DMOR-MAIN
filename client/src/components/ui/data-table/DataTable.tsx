import * as React from 'react';
import { createPortal } from 'react-dom';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  GroupingState,
  ExpandedState,
  ColumnPinningState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  useReactTable,
  Row,
  Column,
  OnChangeFn,
  RowSelectionState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Maximize2, Minimize2, ChevronRight, ChevronDown } from 'lucide-react';

import { DataTablePagination } from './DataTablePagination';
import { DataTableToolbar } from './DataTableToolbar';
import { cn } from '../../../utils/cn';

export interface DataTableTheme {
  container?: string;
  header?: string;
  row?: string;
  cell?: string;
  headerCell?: string;
  scrollContainer?: string;
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
  enableVirtualization?: boolean;
  theme?: DataTableTheme;
  defaultPageSize?: number;
  showToolbar?: boolean;
  showPagination?: boolean;
  renderSubComponent?: (props: { row: Row<TData> }) => React.ReactNode;
  getRowCanExpand?: (row: Row<TData>) => boolean;
  persistenceKey?: string;
  meta?: any;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  rowSelection?: RowSelectionState;
  getRowId?: (originalRow: TData, index: number, parent?: Row<TData>) => string;
  autoResetExpanded?: boolean;
  autoResetPageIndex?: boolean;
  onRowClick?: (row: Row<TData>) => void;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  toolbarActions?: React.ReactNode;
  enableColumnResizing?: boolean;
  getRowClassName?: (row: Row<TData>) => string;
  initialSorting?: SortingState;
}

const getCommonPinningStyles = (column: Column<any>): React.CSSProperties => {
  const isPinned = column.getIsPinned();
  const isLastLeft = isPinned === 'left' && column.getIsLastColumn('left');
  const isFirstRight = isPinned === 'right' && column.getIsFirstColumn('right');
  const fitContent = Boolean((column.columnDef as any)?.meta?.fitContent);

  return {
    boxShadow: isLastLeft
      ? '-4px 0 4px -4px var(--border) inset'
      : isFirstRight
        ? '4px 0 4px -4px var(--border) inset'
        : undefined,
    left: isPinned === 'left' ? `${column.getStart('left')}px` : undefined,
    right: isPinned === 'right' ? `${column.getAfter('right')}px` : undefined,
    opacity: isPinned ? 0.95 : 1, // Slight transparency for glass effect or 1 for solid
    position: isPinned ? 'sticky' : 'relative',
    width: fitContent ? undefined : column.getSize(),
    zIndex: isPinned ? 1 : 0,
    backgroundColor: isPinned ? 'var(--surface)' : undefined,
  };
};

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder,
  enableVirtualization = false,
  theme,
  defaultPageSize = 10,
  showToolbar = true,
  showPagination = true,
  renderSubComponent,
  getRowCanExpand,
  persistenceKey,
  meta,
  onRowSelectionChange: onRowSelectionChangeProp,
  rowSelection: rowSelectionProp,
  getRowId,
  autoResetExpanded = true,
  autoResetPageIndex = true,
  onRowClick: onRowClickProp,
  sorting: sortingProp,
  onSortingChange: onSortingChangeProp,
  toolbarActions,
  enableColumnResizing = true,
  getRowClassName,
  initialSorting,
}: DataTableProps<TData, TValue>) {
  const [internalRowSelection, setInternalRowSelection] = React.useState({});

  const rowSelection = rowSelectionProp ?? internalRowSelection;
  const setRowSelection = onRowSelectionChangeProp ?? setInternalRowSelection;

  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [internalSorting, setInternalSorting] = React.useState<SortingState>(initialSorting || []);
  const [globalFilter, setGlobalFilter] = React.useState<string>('');
  const [grouping, setGrouping] = React.useState<GroupingState>([]);

  const sorting = sortingProp ?? internalSorting;
  const setSorting = onSortingChangeProp ?? setInternalSorting;

  const [expanded, setExpanded] = React.useState<ExpandedState>(() => {
    if (persistenceKey) {
      try {
        const saved = localStorage.getItem(`datatable-expanded-${persistenceKey}`);
        return saved ? JSON.parse(saved) : {};
      } catch (e) {
        return {};
      }
    }
    return {};
  });

  const [columnPinning, setColumnPinning] = React.useState<ColumnPinningState>({});

  const [isFullScreen, setIsFullScreen] = React.useState(false);

  React.useEffect(() => {
    if (persistenceKey) {
      localStorage.setItem(`datatable-expanded-${persistenceKey}`, JSON.stringify(expanded));
    }
  }, [expanded, persistenceKey]);

  const table = useReactTable({
    data,
    columns,
    getRowId,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      globalFilter,
      grouping,
      expanded,
      columnPinning,
    },
    enableColumnResizing,
    columnResizeMode: 'onChange',
    autoResetPageIndex,
    autoResetExpanded,
    meta,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    onColumnPinningChange: setColumnPinning,

    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand,

    initialState: {
      pagination: {
        pageSize: defaultPageSize,
      },
    },
  });

  const tableContainerRef = React.useRef<HTMLDivElement>(null);

  const { rows } = table.getRowModel();

  // Virtualizer
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 45, // Estimate row height
    overscan: 5,
  });

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  const containerClass = cn(
    'rounded-md border border-[var(--border)] bg-[var(--surface)] shadow-sm transition-all duration-300',
    isFullScreen ? 'fixed inset-0 m-0 h-screen w-screen rounded-none' : 'relative',
    theme?.container
  );

  // Use inline style for z-index to ensure maximum specificity in fullscreen mode
  const containerStyle: React.CSSProperties = isFullScreen
    ? {
      zIndex: 999999,
      isolation: 'isolate',
      backgroundColor: 'var(--surface)',
    }
    : { zIndex: 10 };

  const tableContent = (
    <div className={containerClass} style={containerStyle}>
      {showToolbar && (
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--background)]/50 px-4">
          <DataTableToolbar
            table={table}
            globalFilter={globalFilter}
            setGlobalFilter={setGlobalFilter}
            searchPlaceholder={searchPlaceholder}
            toolbarActions={toolbarActions}
          />
          <button
            onClick={toggleFullScreen}
            className="btn btn-ghost btn-sm ml-2"
            title={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
          >
            {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      )}

      <div
        ref={tableContainerRef}
        className={cn(
          'overflow-auto',
          isFullScreen ? 'h-[calc(100vh-130px)]' : enableVirtualization ? 'h-[600px]' : '',
          theme?.scrollContainer
        )}
        style={{ position: 'relative', zIndex: 1 }}
      >
        <table className="w-full caption-bottom text-sm text-left text-[var(--text-primary)] border-collapse border border-[var(--border-dark)]">
          <thead
            className={cn('[&_tr]:border-b sticky top-0 bg-[var(--surface)]', theme?.header)}
            style={{ zIndex: 2 }}
          >
            {table.getHeaderGroups().map(headerGroup => (
              <tr
                key={headerGroup.id}
                className="border-b border-[var(--border)] transition-colors hover:bg-[var(--background)]/50 data-[state=selected]:bg-[var(--background)]"
              >
                {headerGroup.headers.map(header => {
                  return (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      className={cn(
                        'h-12 px-4 text-left align-middle font-medium text-[var(--text-secondary)] [&:has([role=checkbox])]:pr-0 border-r border-[var(--border)] last:border-0',
                        'h-12 px-4 text-left align-middle font-medium text-[var(--text-secondary)] [&:has([role=checkbox])]:pr-0 border-r border-[var(--border)] last:border-0',
                        theme?.headerCell
                      )}
                      style={{
                        ...getCommonPinningStyles(header.column),
                        position: 'sticky',
                        top: 0,
                        zIndex: header.column.getIsPinned() ? 3 : 2,
                        backgroundColor: 'var(--surface)',
                      }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {enableColumnResizing && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={`absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none hover:bg-[var(--primary)] ${header.column.getIsResizing() ? 'bg-[var(--primary)]' : 'bg-transparent'
                            }`}
                          style={{
                            transform: header.column.getIsResizing()
                              ? `translateX(${table.getState().columnSizingInfo.deltaOffset}px)`
                              : '',
                          }}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className={cn('[&_tr:last-child]:border-0', theme?.row)}>
            {enableVirtualization ? (
              <>
                {rowVirtualizer.getVirtualItems().length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="h-24 text-center">
                      No results.
                    </td>
                  </tr>
                )}
                {rowVirtualizer.getVirtualItems().length > 0 && (
                  <tr>
                    <td
                      style={{ height: `${rowVirtualizer.getVirtualItems()[0].start}px` }}
                      colSpan={columns.length}
                    />
                  </tr>
                )}
                {rowVirtualizer.getVirtualItems().map(virtualRow => {
                  const row = rows[virtualRow.index] as Row<TData>;
                  return (
                    <React.Fragment key={row.id}>
                      <tr
                        data-state={row.getIsSelected() && 'selected'}
                        onClick={e => {
                          if (onRowClickProp) {
                            onRowClickProp(row);
                          }
                          if (row.getCanExpand()) {
                            row.getToggleExpandedHandler()();
                          }
                        }}
                        className={cn(
                          'border-b border-[var(--border)] transition-colors hover:bg-[var(--background)]/50 data-[state=selected]:bg-[var(--background)]',
                          (onRowClickProp || row.getCanExpand()) && 'cursor-pointer',
                          theme?.row,
                          getRowClassName?.(row)
                        )}
                        style={{
                          height: `${virtualRow.size}px`,
                        }}
                      >
                        {row.getVisibleCells().map(cell => {
                          const style = getCommonPinningStyles(cell.column);
                          return (
                            <td
                              key={cell.id}
                              className={cn(
                                'p-4 align-middle [&:has([role=checkbox])]:pr-0 border-r border-[var(--border)] last:border-0',
                                theme?.cell
                              )}
                              style={{
                                ...style,
                                background: row.getIsSelected()
                                  ? 'var(--primary-light)'
                                  : style.backgroundColor,
                              }}
                            >
                              {cell.getIsGrouped() ? (
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    row.getToggleExpandedHandler()();
                                  }}
                                  style={{
                                    cursor: row.getCanExpand() ? 'pointer' : 'normal',
                                  }}
                                  className="flex items-center gap-2 font-semibold"
                                >
                                  {row.getIsExpanded() ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())} (
                                  {row.subRows.length})
                                </button>
                              ) : cell.getIsAggregated() ? (
                                flexRender(
                                  cell.column.columnDef.aggregatedCell ??
                                  cell.column.columnDef.cell,
                                  cell.getContext()
                                )
                              ) : cell.getIsPlaceholder() ? null : (
                                <div className="flex items-center">
                                  {cell.column.id === row.getVisibleCells()[0].column.id && (
                                    <span style={{ paddingLeft: `${row.depth * 2}rem` }} />
                                  )}
                                  {cell.column.id === row.getVisibleCells()[0].column.id &&
                                    row.getCanExpand() &&
                                    !row.getIsGrouped() ? (
                                    <div className="mr-2 inline-flex">
                                      {row.getIsExpanded() ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                    </div>
                                  ) : null}
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                      {row.getIsExpanded() && renderSubComponent && !row.getIsGrouped() && (
                        <tr>
                          <td
                            colSpan={columns.length}
                            className="p-0 border-b border-[var(--border)]"
                          >
                            {renderSubComponent({ row })}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {rowVirtualizer.getVirtualItems().length > 0 && (
                  <tr>
                    <td
                      style={{
                        height: `${rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end}px`,
                      }}
                      colSpan={columns.length}
                    />
                  </tr>
                )}
              </>
            ) : (
              <>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map(row => (
                    <React.Fragment key={row.id}>
                      <tr
                        data-state={row.getIsSelected() && 'selected'}
                        onClick={e => {
                          if (onRowClickProp) {
                            onRowClickProp(row);
                          }
                          if (row.getCanExpand()) {
                            row.getToggleExpandedHandler()();
                          }
                        }}
                        className={cn(
                          'border-b border-[var(--border)] transition-colors hover:bg-[var(--background)]/50 data-[state=selected]:bg-[var(--background)]',
                          (onRowClickProp || row.getCanExpand()) && 'cursor-pointer',
                          theme?.row,
                          getRowClassName?.(row)
                        )}
                      >
                        {row.getVisibleCells().map(cell => {
                          const style = getCommonPinningStyles(cell.column);
                          return (
                            <td
                              key={cell.id}
                              className={cn(
                                'p-4 align-middle [&:has([role=checkbox])]:pr-0 border-r border-[var(--border)] last:border-0',
                                theme?.cell
                              )}
                              style={{
                                ...style,
                                backgroundColor:
                                  style.position === 'sticky' ? 'var(--surface)' : 'inherit',
                              }}
                            >
                              {cell.getIsGrouped() ? (
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    row.getToggleExpandedHandler()();
                                  }}
                                  style={{
                                    cursor: row.getCanExpand() ? 'pointer' : 'normal',
                                  }}
                                  className="flex items-center gap-2 font-semibold"
                                >
                                  {row.getIsExpanded() ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())} (
                                  {row.subRows.length})
                                </button>
                              ) : cell.getIsAggregated() ? (
                                flexRender(
                                  cell.column.columnDef.aggregatedCell ??
                                  cell.column.columnDef.cell,
                                  cell.getContext()
                                )
                              ) : cell.getIsPlaceholder() ? null : (
                                <div className="flex items-center">
                                  {cell.column.id === row.getVisibleCells()[0].column.id && (
                                    <span style={{ paddingLeft: `${row.depth * 2}rem` }} />
                                  )}
                                  {cell.column.id === row.getVisibleCells()[0].column.id &&
                                    row.getCanExpand() &&
                                    !row.getIsGrouped() ? (
                                    <div className="mr-2 inline-flex">
                                      {row.getIsExpanded() ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                    </div>
                                  ) : null}
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                      {row.getIsExpanded() && renderSubComponent && !row.getIsGrouped() && (
                        <tr>
                          <td
                            colSpan={columns.length}
                            className="p-0 border-b border-[var(--border)]"
                          >
                            {renderSubComponent({ row })}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                ) : (
                  <tr>
                    <td colSpan={columns.length} className="h-24 text-center">
                      No results.
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
      {showPagination && <DataTablePagination table={table} />}
    </div>
  );

  // Use Portal when in fullscreen mode to render at document.body level
  // This bypasses all parent stacking contexts
  if (isFullScreen) {
    return createPortal(tableContent, document.body);
  }

  return tableContent;
}
