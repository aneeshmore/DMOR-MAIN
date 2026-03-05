import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { decodeHtml } from '@/utils/stringUtils';
import { ColumnDef } from '@tanstack/react-table';
import { AdminOrder, adminAccountsApi, AdminOrderDetails } from '../api/adminAccountsApi';
import { DataTable } from '@/components/ui/data-table/DataTable';
import { DataTableColumnHeader } from '@/components/ui/data-table/DataTableColumnHeader';
import { Check, PauseCircle, CheckSquare, Square, RotateCcw, Ban } from 'lucide-react';

interface PendingOrdersDataTableProps {
  data: AdminOrder[];
  editedData: Record<number, any>;
  onInputChange: (id: number, field: string, value: any) => void;
  onAccept: (id: number) => void;
  onHold: (id: number) => void;
  onReject?: (id: number) => void;
  onResume?: (id: number) => void;
  isHoldTable?: boolean;
  title: string;
  icon?: React.ReactNode;
}

// Memoized editable input cell component
interface EditableCellProps {
  orderId: number;
  field: string;
  value: string;
  placeholder: string;
  onInputChange: (id: number, field: string, value: any) => void;
  inputClassName?: string;
}

const EditableCell = memo(function EditableCell({
  orderId,
  field,
  value,
  placeholder,
  onInputChange,
  inputClassName = '',
}: EditableCellProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const lastExternalValue = React.useRef(value);

  React.useEffect(() => {
    if (inputRef.current && value !== lastExternalValue.current) {
      if (document.activeElement !== inputRef.current) {
        inputRef.current.value = value;
      }
      lastExternalValue.current = value;
    }
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      lastExternalValue.current = newValue;
      onInputChange(orderId, field, newValue);
    },
    [orderId, field, onInputChange]
  );

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleFocus = useCallback((e: React.FocusEvent) => {
    e.stopPropagation();
  }, []);

  // Editable Input FIX (prevents column stretching)
  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={value}
      onChange={handleChange}
      className={`min-w-[12px] text-center border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] rounded px-2 py-1 text-sm focus:ring-2 focus:ring-[var(--primary-200)] focus:border-[var(--primary)] outline-none transition-all placeholder:text-[var(--text-secondary)] ${inputClassName}`}
      placeholder={placeholder}
      onClick={handleClick}
      onFocus={handleFocus}
    />
  );
});

const formatTimeSpan = (dateString: string) => {
  const start = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - start.getTime();

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  let result = '';
  if (days > 0) result += `${days} Days `;
  if (hours > 0) result += `${hours} Hours `;
  result += `${minutes} Minutes`;
  return result;
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
              {item.discount > 0 && (
                <span className="text-[var(--warning)] text-xs ml-2">
                  ({item.discount}% discount)
                </span>
              )}
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

export function PendingOrdersDataTable({
  data,
  editedData,
  onInputChange,
  onAccept,
  onHold,
  onReject,
  onResume,
  isHoldTable = false,
  title,
  icon,
}: PendingOrdersDataTableProps) {
  const stableOnInputChange = useCallback(onInputChange, [onInputChange]);

  const columns: ColumnDef<AdminOrder>[] = useMemo(
    () => [
      {
        accessorKey: 'orderId',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Order No" />,
        cell: ({ row }) => (
          <span className="font-medium text-xs text-[var(--text-primary)] whitespace-nowrap">
            {row.original.orderNumber ||
              formatDisplayOrderId(row.original.orderId, row.original.orderCreatedDate)}
          </span>
        ),
      },

      {
        accessorKey: 'customerName',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Company" />,
        cell: ({ row }) => (
          <span
            className="text-[var(--primary)] font-medium truncate block max-w-[140px] whitespace-nowrap"
            title={decodeHtml(row.original.customerName)}
          >
            {decodeHtml(row.original.customerName)}
          </span>
        ),
      },

      {
        accessorKey: 'area',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Area" />,
        size: 80,
        cell: ({ row }) => (
          <span className="text-[var(--text-secondary)] truncate block max-w-[80px] whitespace-nowrap">
            {decodeHtml(row.original.area) || '-'}
          </span>
        ),
      },

      {
        accessorKey: 'location',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Location" />,
        size: 30,
        cell: ({ row }) => (
          <span className="w-full text-center text-[var(--text-secondary)] truncate block max-w-[70px] whitespace-nowrap">
            {decodeHtml(row.original.location) || '-'}
          </span>
        ),
      },

      {
        accessorKey: 'salesPersonName',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Sales Person" />,
        size: 80,
        cell: ({ row }) => (
          <span className="text-[var(--text-secondary)] whitespace-nowrap">
            {decodeHtml(row.original.salesPersonName) || 'N/A'}
          </span>
        ),
      },

      {
        accessorKey: 'orderCreatedDate',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
        size: 20,
        cell: ({ row }) => (
          <span className="text-[var(--text-primary)]  whitespace-nowrap">
            {new Date(row.original.orderCreatedDate).toLocaleString('en-GB', {
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
        id: 'timeSpan',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Time Span" />,
        size: 50,
        minSize: 50,
        maxSize: 50,
        cell: ({ row }) => (
          <span className="text-xs text-[var(--text-secondary)] whitespace-nowrap">
            {formatTimeSpan(row.original.orderCreatedDate)}
          </span>
        ),
      },

      {
        id: 'billNo',
        header: 'Bill No',
        size: 60,
        cell: function BillNoCell({ row, table }) {
          const tableEditedData = (table.options.meta as any)?.editedData || {};
          const tableOnInputChange = (table.options.meta as any)?.onInputChange;

          return (
            <EditableCell
              orderId={row.original.orderId}
              field="billNo"
              value={tableEditedData[row.original.orderId]?.billNo || ''}
              placeholder="Bill No"
              onInputChange={tableOnInputChange}
              inputClassName="w-13"
            />
          );
        },
      },

      {
        id: 'paymentCleared',
        size: 30,
        maxSize: 50,
        header: 'Payment',
        cell: function PaymentCell({ row, table }) {
          const tableEditedData = (table.options.meta as any)?.editedData || {};
          const tableOnInputChange = (table.options.meta as any)?.onInputChange;

          return (
            <button
              onClick={e => {
                e.stopPropagation();
                tableOnInputChange(
                  row.original.orderId,
                  'paymentCleared',
                  !tableEditedData[row.original.orderId]?.paymentCleared
                );
              }}
              className="text-[var(--text-secondary)] hover:text-[var(--success)] transition-colors mx-auto block"
            >
              {tableEditedData[row.original.orderId]?.paymentCleared ? (
                <CheckSquare className="w-5 h-5 text-[var(--success)]" />
              ) : (
                <Square className="w-5 h-5 hover:text-[var(--text-primary)]" />
              )}
            </button>
          );
        },
      },

      {
        id: 'remarks',
        header: 'Remark',
        size: 80,
        maxSize: 100,
        cell: function RemarksCell({ row, table }) {
          const tableEditedData = (table.options.meta as any)?.editedData || {};
          const tableOnInputChange = (table.options.meta as any)?.onInputChange;

          return (
            <div className="w-[100px] mx-auto">
              <EditableCell
                orderId={row.original.orderId}
                field="remarks"
                value={tableEditedData[row.original.orderId]?.remarks || ''}
                placeholder="Remark..."
                onInputChange={tableOnInputChange}
                inputClassName="w-25"
              />
            </div>
          );
        },
      },

      {
        id: 'actions',
        header: 'Actions',
        cell: function ActionsCell({ row, table }) {
          const tableEditedData = (table.options.meta as any)?.editedData || {};
          const tableOnAccept = (table.options.meta as any)?.onAccept;
          const tableOnHold = (table.options.meta as any)?.onHold;
          const tableOnReject = (table.options.meta as any)?.onReject;
          const tableOnResume = (table.options.meta as any)?.onResume;
          const tableIsHoldTable = (table.options.meta as any)?.isHoldTable;

          return (
            <div className="flex flex-col gap-2 whitespace-nowrap">
              {!tableIsHoldTable ? (
                <>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      tableOnAccept(row.original.orderId);
                    }}
                    disabled={
                      !tableEditedData[row.original.orderId]?.billNo ||
                      !tableEditedData[row.original.orderId]?.paymentCleared
                    }
                    className="inline-flex items-center gap-1 px-3 py-1 text-[var(--success)] bg-[var(--background)] hover:bg-[#ecfdf5] border border-[var(--success)]/20 rounded-lg transition-colors font-medium text-xs disabled:opacity-50"
                  >
                    <Check className="w-3 h-3" />
                    {row.original.status === 'Verified' ? 'Send to Prod' : 'Accept'}
                  </button>

                  <button
                    onClick={e => {
                      e.stopPropagation();
                      tableOnHold(row.original.orderId);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1 text-[var(--warning)] bg-[var(--background)] hover:bg-[#fffbeb] border border-[var(--warning)]/20 rounded-lg transition-colors font-bold text-xs uppercase"
                  >
                    <PauseCircle className="w-3 h-3" />
                    Hold
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (tableOnResume) tableOnResume(row.original.orderId);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1 text-[var(--primary)] bg-[var(--background)] hover:bg-[var(--primary-50)] border border-[var(--primary)]/20 rounded-lg transition-colors font-medium text-xs"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Resume
                  </button>

                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (tableOnReject) tableOnReject(row.original.orderId);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1 text-[var(--error)] bg-[var(--background)] hover:bg-[#fef2f2] border border-[var(--error)]/20 rounded-lg transition-colors font-medium text-xs"
                  >
                    <Ban className="w-3 h-3" />
                    Reject
                  </button>
                </>
              )}
            </div>
          );
        },
      },
    ],
    []
  );

  return (
    <div className="bg-[var(--surface)] rounded-lg border border-[var(--border)] shadow-sm mb-8 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="p-4 border-b border-[var(--border)] flex items-center gap-2 bg-[var(--primary)]/5">
        {icon && <span className="text-[var(--primary)]">{icon}</span>}
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
      </div>

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Filter orders..."
        defaultPageSize={25}
        enableVirtualization={false}
        getRowCanExpand={() => true}
        renderSubComponent={({ row }) => <ExpandedOrderDetails orderId={row.original.orderId} />}
        persistenceKey="pending-orders-table"
        theme={{
          container: 'border-none shadow-none rounded-t-none',
          headerCell: 'text-center !px-1 [&:nth-child(4)]:!pr-0 [&:nth-child(9)]:!pr-0.5',
          cell: 'text-center !px-1 py-4 [&:nth-child(4)]:!pr-0 [&:nth-child(9)]:!pr-0.5',
        }}
        meta={{
          editedData,
          onInputChange: stableOnInputChange,
          onAccept,
          onHold,
          onReject,
          onResume,
          isHoldTable,
        }}
      />
    </div>
  );
}
