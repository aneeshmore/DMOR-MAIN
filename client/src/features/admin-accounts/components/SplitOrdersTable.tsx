import React, { useState, useEffect, useMemo } from 'react';
import { decodeHtml } from '@/utils/stringUtils';
import { AlertCircle, CheckSquare, PauseCircle, Check, Lock } from 'lucide-react';
import { AdminOrder, adminAccountsApi, AdminOrderDetails } from '../api/adminAccountsApi';
import { DataTable } from '@/components/ui/data-table/DataTable';
import { DataTableColumnHeader } from '@/components/ui/data-table/DataTableColumnHeader';
import { ColumnDef } from '@tanstack/react-table';

interface SplitOrdersTableProps {
  orders: AdminOrder[];
  editedData: Record<number, any>;
  handleInputChange: (id: number, field: string, val: any) => void;
  onAccept: (id: number) => void;
  handleHold: (id: number) => void;
  handleOpenDetails: (id: number) => void;
}

const formatTimeSpan = (dateString: string) => {
  const start = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - start.getTime();

  const isFuture = diff < 0;
  const absDiff = Math.abs(diff);

  const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((absDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));

  let result = '';
  if (days > 0) result += `${days} Days `;
  if (hours > 0) result += `${hours} Hours `;
  result += `${minutes} Minutes`;

  return isFuture ? `In ${result}` : `${result} ago`;
};

// The Dispatch child of a split ("Child A") inherits the parent order's Bill No and must show
// it read-only. The "Split from Order" / "(Balance)" markers already stored on the order's own
// remark identify which child this is — no extra field or column is needed.
const isDispatchChildOfSplit = (order: AdminOrder) =>
  !!order.salespersonRemark &&
  order.salespersonRemark.includes('Split from Order') &&
  !order.salespersonRemark.includes('(Balance)');

/** The parent order reference, derived by stripping the child's -A / -B suffix. Falls back to
 *  the "#<id>" recorded in the split remark for legacy children without an order number. */
const getParentRef = (order: AdminOrder): string | null => {
  if (order.orderNumber && /-(A|B)$/.test(order.orderNumber)) {
    return order.orderNumber.replace(/-(A|B)$/, '');
  }
  const match = order.salespersonRemark?.match(/Split from Order #?(\S+?)(?:\s|$)/);
  return match ? `#${match[1]}` : null;
};

/** Only the remark the user typed on the split form, with the "Split from Order #X"
 *  bookkeeping text stripped off so the table shows intent rather than boilerplate. */
const getSplitRemark = (order: AdminOrder): string | null => {
  const remark = order.salespersonRemark;
  if (!remark) return null;
  if (remark.includes(' - Split from Order')) {
    return remark.split(' - Split from Order')[0].trim() || null;
  }
  return null;
};

const formatDisplayOrderId = (orderId: number, dateString: string) => {
  if (!dateString) return `ORD-${orderId}`;
  const date = new Date(dateString);
  const year = date.getFullYear();
  const idStr = orderId.toString();
  const shortId = idStr.length > 3 ? idStr.slice(-3) : idStr.padStart(3, '0');
  return `ORD-${year}-${shortId}`;
};

const ExpandedOrderDetails = ({ orderId }: { orderId: number }) => {
  const [details, setDetails] = useState<AdminOrderDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const data = await adminAccountsApi.getOrderDetails(orderId);
        setDetails(data);
      } catch (error) {
        console.error('Failed to fetch order details', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [orderId]);

  if (loading) {
    return (
      <div className="p-4 text-center text-sm text-[var(--text-secondary)]">Loading details...</div>
    );
  }

  if (!details) {
    return (
      <div className="p-4 text-center text-sm text-[var(--error)]">Failed to load details.</div>
    );
  }

  return (
    <div className="p-4 bg-[var(--background)] rounded-md border border-[var(--border)] m-2">
      <h4 className="font-semibold text-sm mb-2 text-[var(--text-primary)]">Order Items</h4>
      <div className="space-y-2">
        {details.items.map((item, idx) => (
          <div
            key={idx}
            className="flex justify-between items-center text-sm border-b border-[var(--border)] last:border-0 pb-1 last:pb-0"
          >
            <div>
              <span className="font-medium text-[var(--text-primary)]">
                {decodeHtml(item.productName)} ({item.size})
              </span>
              <span className="text-[var(--text-secondary)] text-xs ml-2">
                x {item.quantity} {item.unit}
              </span>
            </div>
            <div className="font-medium text-[var(--text-primary)]">
              ₹{item.totalPrice.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 text-right font-bold text-sm text-[var(--text-primary)]">
        Total:{' '}
        <span className="text-[var(--success)]">
          ₹{Number(details.totalAmount || 0).toFixed(2)}
        </span>
      </div>
    </div>
  );
};

export const SplitOrdersTable: React.FC<SplitOrdersTableProps> = ({
  orders,
  editedData,
  handleInputChange,
  onAccept,
  handleHold,
  handleOpenDetails,
}) => {
  const columns = useMemo<ColumnDef<AdminOrder>[]>(
    () => [
      {
        header: ({ column }) => <DataTableColumnHeader column={column} title="Split Order" />,
        accessorKey: 'orderId',
        size: 170,
        cell: info => {
          const order = info.row.original;
          const isBalance = !!order.salespersonRemark?.includes('(Balance)');
          const parentRef = getParentRef(order);
          return (
            <div className="flex flex-col gap-1 py-0.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-[var(--text-primary)] whitespace-nowrap">
                  {order.orderNumber ||
                    formatDisplayOrderId(order.orderId, order.orderCreatedDate)}
                </span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${isBalance
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700'
                    }`}
                >
                  {isBalance ? 'Balance' : 'Dispatch'}
                </span>
              </div>
              {parentRef && (
                <span className="text-[10px] text-[var(--text-secondary)] whitespace-nowrap">
                  Parent: <span className="font-medium">{parentRef}</span>
                </span>
              )}
            </div>
          );
        },
      },
      {
        header: ({ column }) => <DataTableColumnHeader column={column} title="Name Of Company" />,
        accessorKey: 'customerName',
        size: 160,
        cell: info => (
          <span
            className="text-[var(--primary)] font-medium truncate block max-w-[150px]"
            title={decodeHtml(info.getValue() as string)}
          >
            {decodeHtml(info.getValue() as string)}
          </span>
        ),
      },
      {
        header: ({ column }) => <DataTableColumnHeader column={column} title="Area" />,
        accessorKey: 'area',
        size: 90,
        cell: info => (
          <span className="text-[var(--text-primary)] truncate block max-w-[80px]">
            {decodeHtml(info.getValue() as string) || '-'}
          </span>
        ),
      },
      {
        header: ({ column }) => <DataTableColumnHeader column={column} title="Location" />,
        accessorKey: 'location',
        size: 100,
        cell: info => (
          <span className="text-[var(--text-primary)] truncate block max-w-[90px]">
            {decodeHtml(info.getValue() as string) || '-'}
          </span>
        ),
      },
      {
        header: ({ column }) => <DataTableColumnHeader column={column} title="Sales Person" />,
        accessorKey: 'salesPersonName',
        size: 120,
        cell: info => (
          <span className="text-[var(--text-primary)] truncate block max-w-[110px]">
            {decodeHtml(info.getValue() as string) || 'N/A'}
          </span>
        ),
      },
      {
        // Each child's own value, recalculated from its split quantities — Dispatch + Balance
        // always reconciles back to the parent order's amount.
        header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
        accessorKey: 'totalAmount',
        size: 100,
        cell: info => (
          <span className="font-medium text-[var(--text-primary)] whitespace-nowrap tabular-nums">
            ₹{(parseFloat(info.getValue() as any) || 0).toFixed(2)}
          </span>
        ),
      },
      {
        // The remark typed on the Split Order form, so Accounts can see why the order was
        // split without opening it. Boilerplate "Split from Order #X" text is stripped.
        header: ({ column }) => <DataTableColumnHeader column={column} title="Split Remark" />,
        id: 'splitRemark',
        size: 160,
        cell: info => {
          const splitRemark = getSplitRemark(info.row.original);
          return splitRemark ? (
            <span
              className="text-xs text-[var(--text-primary)] leading-snug block max-w-[200px] line-clamp-2"
              title={decodeHtml(splitRemark)}
            >
              {decodeHtml(splitRemark)}
            </span>
          ) : (
            <span className="text-xs text-[var(--text-secondary)]">—</span>
          );
        },
      },
      {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Order Created Date" />
        ),
        accessorKey: 'orderCreatedDate',
        size: 150,
        cell: info => (
          <span className="whitespace-nowrap text-xs text-[var(--text-primary)]">
            {new Date(info.getValue() as string).toLocaleString('en-GB', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })}
          </span>
        ),
      },
      {
        header: ({ column }) => <DataTableColumnHeader column={column} title="Time Span" />,
        accessorKey: 'orderCreatedDate_span', // Virtual column
        size: 110,
        cell: info => (
          <span className="text-xs text-[var(--text-secondary)]">
            {formatTimeSpan(info.row.original.orderCreatedDate)}
          </span>
        ),
      },
      {
        header: ({ column }) => <DataTableColumnHeader column={column} title="Bill No" />,
        id: 'billNo',
        size: 150,
        cell: info => {
          const meta = info.table.options.meta as any;
          const currentBillNo = meta.editedData[info.row.original.orderId]?.billNo || '';

          // Dispatch child of a split with a Bill No inherited from the parent order: always
          // locked. If the parent had no Bill No, fall through to normal manual entry below —
          // which is also always the case for the Balance child.
          if (isDispatchChildOfSplit(info.row.original) && currentBillNo) {
            return (
              <div
                className="flex flex-col gap-0.5"
                title="Inherited from parent order — cannot be edited"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface-secondary)]">
                  <Lock className="w-3 h-3 text-[var(--text-secondary)] shrink-0" />
                  <span className="font-medium text-[var(--text-primary)] truncate">
                    {currentBillNo}
                  </span>
                </div>
                <span className="text-[10px] text-[var(--text-secondary)] leading-none px-0.5">
                  from parent order
                </span>
              </div>
            );
          }

          return (
            <input
              type="text"
              value={currentBillNo}
              onChange={e =>
                meta.handleInputChange(info.row.original.orderId, 'billNo', e.target.value)
              }
              className="w-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] rounded px-2 py-1 focus:ring-2 focus:ring-[var(--primary-200)] focus:border-[var(--primary)] outline-none transition-all placeholder:text-[var(--text-secondary)]"
              placeholder="Enter Bill No"
              onClick={e => e.stopPropagation()}
            />
          );
        },
      },
      {
        header: ({ column }) => <DataTableColumnHeader column={column} title="Payment Cleared" />,
        id: 'paymentCleared',
        size: 90,
        cell: info => {
          const meta = info.table.options.meta as any;
          return (
            <div className="flex justify-center">
              <button
                onClick={e => {
                  e.stopPropagation();
                  meta.handleInputChange(
                    info.row.original.orderId,
                    'paymentCleared',
                    !meta.editedData[info.row.original.orderId]?.paymentCleared
                  );
                }}
                className="text-[var(--text-secondary)] hover:text-[var(--success)] transition-colors"
              >
                {meta.editedData[info.row.original.orderId]?.paymentCleared ? (
                  <CheckSquare className="w-5 h-5 text-[var(--success)]" />
                ) : (
                  <div className="w-5 h-5 border-2 border-[var(--text-secondary)] rounded" />
                )}
              </button>
            </div>
          );
        },
      },
      {
        header: ({ column }) => <DataTableColumnHeader column={column} title="Remark" />,
        id: 'remarks',
        size: 140,
        cell: info => {
          const meta = info.table.options.meta as any;
          return (
            <input
              type="text"
              value={meta.editedData[info.row.original.orderId]?.remarks || ''}
              onChange={e =>
                meta.handleInputChange(info.row.original.orderId, 'remarks', e.target.value)
              }
              className="w-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] rounded px-2 py-1 text-sm focus:ring-2 focus:ring-[var(--primary-200)] focus:border-[var(--primary)] outline-none transition-all placeholder:text-[var(--text-secondary)]"
              placeholder="Remark..."
              onClick={e => e.stopPropagation()}
            />
          );
        },
      },
      {
        header: 'Actions',
        id: 'actions',
        size: 130,
        cell: info => {
          const meta = info.table.options.meta as any;
          return (
            <div className="flex flex-col items-stretch justify-center gap-2 px-1 w-full max-w-[120px] mx-auto">
              <button
                onClick={e => {
                  e.stopPropagation();
                  meta.onAccept(info.row.original.orderId);
                }}
                disabled={
                  !meta.editedData[info.row.original.orderId]?.billNo ||
                  !meta.editedData[info.row.original.orderId]?.paymentCleared
                }
                className="inline-flex items-center gap-1 px-3 py-1.5 text-emerald-600 bg-white hover:bg-emerald-50 border border-emerald-200 rounded-md transition-colors font-medium text-xs shadow-sm disabled:opacity-50 disabled:bg-gray-50"
                title="Accept"
              >
                <Check className="w-3.5 h-3.5" />
                Accept
              </button>

              <button
                onClick={e => {
                  e.stopPropagation();
                  meta.handleHold(info.row.original.orderId);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-amber-600 bg-white hover:bg-amber-50 border border-amber-200 rounded-md transition-colors font-bold text-xs uppercase shadow-sm"
                title="Put On Hold"
              >
                <PauseCircle className="w-3.5 h-3.5" />
                Hold
              </button>
            </div>
          );
        },
      },
    ],
    []
  );

  // Keep the two children of the same parent next to each other (…-A immediately above …-B)
  // instead of scattered by creation time, so Accounts reviews a split as one unit. Newest
  // parents first; falls back to order id when a child has no parent reference.
  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const parentA = getParentRef(a) || '';
      const parentB = getParentRef(b) || '';
      if (parentA !== parentB) {
        // Group by parent, newest parent first.
        return parentA < parentB ? 1 : -1;
      }
      // Within the same parent: Dispatch (A) before Balance (B).
      const portionA = isDispatchChildOfSplit(a) ? 0 : 1;
      const portionB = isDispatchChildOfSplit(b) ? 0 : 1;
      if (portionA !== portionB) return portionA - portionB;
      return a.orderId - b.orderId;
    });
  }, [orders]);

  return (
    <div className="bg-[var(--surface)] rounded-lg border border-[var(--border)] shadow-sm mb-8 overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-500">
      <div className="p-4 border-b border-[var(--border)] flex items-center gap-2 bg-[var(--info)]/5">
        <AlertCircle className="w-5 h-5 text-[var(--info)]" />
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Split Orders - Waiting for Bill No
        </h2>
      </div>

      <DataTable
        data={sortedOrders}
        columns={columns}
        searchPlaceholder="Search split orders..."
        showToolbar={true}
        defaultPageSize={25}
        enableVirtualization={false}
        getRowCanExpand={() => true}
        renderSubComponent={({ row }) => <ExpandedOrderDetails orderId={row.original.orderId} />}
        theme={{
          container: 'border-none shadow-none rounded-t-none',
          // Uniform padding — the previous nth-child spacing hacks were pinned to the old
          // column positions and no longer lined up once Amount / Split Remark were added.
          headerCell: '!px-2 !py-2.5',
          cell: '!px-2 !py-3 align-middle',
        }}
        meta={{
          editedData,
          handleInputChange,
          onAccept,
          handleHold,
          handleOpenDetails,
        }}
      />
    </div>
  );
};
