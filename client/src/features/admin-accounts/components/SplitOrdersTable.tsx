import React, { useState, useEffect, useMemo } from 'react';
import { decodeHtml } from '@/utils/stringUtils';
import { AlertCircle, CheckSquare, PauseCircle, Check } from 'lucide-react';
import { AdminOrder, adminAccountsApi, AdminOrderDetails } from '../api/adminAccountsApi';
import { DataTable } from '@/components/ui/data-table/DataTable';
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
        header: 'Order id',
        accessorKey: 'orderId',
        cell: info => (
          <span className="font-medium text-xs text-[var(--text-primary)]">
            {formatDisplayOrderId(info.row.original.orderId, info.row.original.orderCreatedDate)}
          </span>
        ),
      },
      {
        header: 'Name Of Company',
        accessorKey: 'customerName',
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
        header: 'Area',
        accessorKey: 'area',
        cell: info => (
          <span className="text-[var(--text-primary)]">{decodeHtml(info.getValue() as string) || '-'}</span>
        ),
      },
      {
        header: 'Location',
        accessorKey: 'location',
        meta: { fitContent: true },
        cell: info => (
          <span className="text-[var(--text-primary)]">{decodeHtml(info.getValue() as string) || '-'}</span>
        ),
      },
      {
        header: 'Sales Person',
        accessorKey: 'salesPersonName',
        cell: info => (
          <span className="text-[var(--text-primary)]">{decodeHtml(info.getValue() as string) || 'N/A'}</span>
        ),
      },
      {
        header: 'Order Created Date',
        accessorKey: 'orderCreatedDate',
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
        header: 'Time Span',
        accessorKey: 'orderCreatedDate_span', // Virtual column
        cell: info => (
          <span className="text-xs text-[var(--text-secondary)]">
            {formatTimeSpan(info.row.original.orderCreatedDate)}
          </span>
        ),
      },
      {
        header: 'Bill NO',
        id: 'billNo',
        cell: info => {
          const meta = info.table.options.meta as any;
          return (
            <input
              type="text"
              value={meta.editedData[info.row.original.orderId]?.billNo || ''}
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
        header: 'Payment Cleared',
        id: 'paymentCleared',
        meta: { fitContent: true },
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
        header: 'Remark',
        id: 'remarks',
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
        header: 'Add Bill No',
        id: 'actions_save',
        cell: info => {
          const meta = info.table.options.meta as any;
          return (
            <div className="flex justify-center">
              <button
                onClick={e => {
                  e.stopPropagation();
                  meta.onAccept(info.row.original.orderId);
                }}
                disabled={
                  !meta.editedData[info.row.original.orderId]?.billNo ||
                  !meta.editedData[info.row.original.orderId]?.paymentCleared
                }
                className="inline-flex items-center gap-1 px-3 py-1 text-[var(--success)] bg-[var(--background)] hover:bg-[#ecfdf5] border border-[var(--success)]/20 rounded-lg transition-colors font-medium text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                title="Accept"
              >
                <Check className="w-3 h-3" />
                Accept
              </button>
            </div>
          );
        },
      },
      {
        header: 'On Hold',
        id: 'actions_hold',
        cell: info => {
          const meta = info.table.options.meta as any;
          return (
            <div className="flex justify-center">
              <button
                onClick={e => {
                  e.stopPropagation();
                  meta.handleHold(info.row.original.orderId);
                }}
                className="inline-flex items-center gap-1 px-3 py-1 text-[var(--warning)] bg-[var(--background)] hover:bg-[#fffbeb] border border-[var(--warning)]/20 rounded-lg transition-colors font-bold text-xs uppercase"
                title="Put On Hold"
              >
                <PauseCircle className="w-3 h-3" />
                Hold
              </button>
            </div>
          );
        },
      },
    ],
    []
  );

  return (
    <div className="bg-[var(--surface)] rounded-lg border border-[var(--border)] shadow-sm mb-8 overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-500">
      <div className="p-4 border-b border-[var(--border)] flex items-center gap-2 bg-[var(--info)]/5">
        <AlertCircle className="w-5 h-5 text-[var(--info)]" />
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Split Orders - Waiting for Bill No
        </h2>
      </div>

      <DataTable
        data={orders}
        columns={columns}
        searchPlaceholder="Search split orders..."
        showToolbar={true}
        defaultPageSize={25}
        enableVirtualization={false}
        getRowCanExpand={() => true}
        renderSubComponent={({ row }) => <ExpandedOrderDetails orderId={row.original.orderId} />}
        theme={{
          container: 'border-none shadow-none rounded-t-none',
          headerCell: '!px-1 [&:nth-child(4)]:!pr-0 [&:nth-child(9)]:!pr-0.5',
          cell: '!px-1 py-4 [&:nth-child(4)]:!pr-0 [&:nth-child(9)]:!pr-0.5',
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
