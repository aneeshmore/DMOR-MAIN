import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { decodeHtml } from '@/utils/stringUtils';
import { ColumnDef } from '@tanstack/react-table';
import { AdminOrder, adminAccountsApi, AdminOrderDetails } from '../api/adminAccountsApi';
import { DataTable } from '@/components/ui/data-table/DataTable';
import { DataTableColumnHeader } from '@/components/ui/data-table/DataTableColumnHeader';
import { Check, PauseCircle, RotateCcw, Ban } from 'lucide-react';
import { AccountsApprovedDropdown } from '../components/AccountsApprovedDropdown';

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
  disabled?: boolean;
}

const EditableCell = memo(function EditableCell({
  orderId,
  field,
  value,
  placeholder,
  onInputChange,
  inputClassName = '',
  disabled = false,
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
      disabled={disabled}
      className={`min-w-[12px] text-center border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] rounded px-2 py-1 text-sm focus:ring-2 focus:ring-[var(--primary-200)] focus:border-[var(--primary)] outline-none transition-all placeholder:text-[var(--text-secondary)] ${
        disabled ? 'opacity-60 cursor-not-allowed' : ''
      } ${inputClassName}`}
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
        size: 140,
        cell: ({ row }) => (
          <span className="font-bold text-[13px] text-gray-900 whitespace-nowrap">
            {row.original.orderNumber ||
              formatDisplayOrderId(row.original.orderId, row.original.orderCreatedDate)}
          </span>
        ),
      },

      {
        accessorKey: 'customerName',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Company" />,
        size: 160,
        cell: ({ row }) => (
          <span
            className="text-blue-600 font-medium truncate block max-w-[150px] whitespace-nowrap text-[13px]"
            title={decodeHtml(row.original.customerName)}
          >
            {decodeHtml(row.original.customerName)}
          </span>
        ),
      },

      {
        accessorKey: 'area',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Area" />,
        size: 110,
        cell: ({ row }) => (
          <span className="text-gray-600 truncate block max-w-[100px] whitespace-normal text-[12px] leading-tight">
            {decodeHtml(row.original.area) || '-'}
          </span>
        ),
      },

      {
        accessorKey: 'location',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Location" />,
        size: 100,
        cell: ({ row }) => (
          <span className="text-gray-600 truncate block max-w-[90px] whitespace-nowrap text-[12px]">
            {decodeHtml(row.original.location) || '-'}
          </span>
        ),
      },

      {
        accessorKey: 'salesPersonName',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Sales Person" />,
        size: 120,
        cell: ({ row }) => (
          <span className="text-gray-600 whitespace-normal text-[12px] leading-tight block max-w-[110px]">
            {decodeHtml(row.original.salesPersonName) || 'N/A'}
          </span>
        ),
      },

      {
        accessorKey: 'orderCreatedDate',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
        size: 130,
        cell: ({ row }) => (
          <span className="text-gray-700 whitespace-nowrap text-[12px]">
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
        size: 90,
        cell: ({ row }) => (
          <span className="text-gray-500 whitespace-nowrap text-[12px]">
            {formatTimeSpan(row.original.orderCreatedDate)}
          </span>
        ),
      },

      {
        id: 'billNo',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Bill No" />,
        size: 130,
        cell: function BillNoCell({ row, table }) {
          const tableEditedData = (table.options.meta as any)?.editedData || {};
          const tableOnInputChange = (table.options.meta as any)?.onInputChange;
          const isOrderOnHold = row.original.status === 'On Hold' || row.original.onHold;
          const isApproved =
            tableEditedData[row.original.orderId]?.accountsApproved === 'Approved';

          return (
            <div className="flex justify-center px-1">
              <EditableCell
                orderId={row.original.orderId}
                field="billNo"
                value={tableEditedData[row.original.orderId]?.billNo || ''}
                placeholder="Bill No"
                onInputChange={tableOnInputChange}
                inputClassName="w-full min-w-[100px] !text-[12px] !py-1.5 shadow-sm rounded-md"
                disabled={isOrderOnHold || !isApproved}
              />
            </div>
          );
        },
      },

      {
        id: 'paymentCleared',
        size: 120,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Accounts Approved" />,
        cell: function PaymentCell({ row, table }) {
          const tableEditedData = (table.options.meta as any)?.editedData || {};
          const tableOnInputChange = (table.options.meta as any)?.onInputChange;
          const isOrderOnHold = row.original.status === 'On Hold' || row.original.onHold;

          if (isOrderOnHold) {
            return (
              <div className="flex justify-center items-center py-1">
                <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-bold bg-amber-50 text-amber-600 border border-amber-200 rounded uppercase tracking-wider shadow-sm">
                  ON HOLD
                </span>
              </div>
            );
          }

          const statusValue =
            tableEditedData[row.original.orderId]?.accountsApproved || 'No';

          return (
            <div className="flex justify-center items-center w-full">
              <AccountsApprovedDropdown
                value={statusValue}
                onChange={val =>
                  tableOnInputChange(row.original.orderId, 'accountsApproved', val)
                }
              />
            </div>
          );
        },
      },

      {
        id: 'remarks',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Remark" />,
        size: 140,
        cell: function RemarksCell({ row, table }) {
          const tableEditedData = (table.options.meta as any)?.editedData || {};
          const tableOnInputChange = (table.options.meta as any)?.onInputChange;

          return (
            <div className="flex justify-center px-1">
              <EditableCell
                orderId={row.original.orderId}
                field="remarks"
                value={tableEditedData[row.original.orderId]?.remarks || ''}
                placeholder=""
                onInputChange={tableOnInputChange}
                inputClassName="w-full min-w-[110px] !text-[12px] !py-1.5 shadow-sm rounded-md"
              />
            </div>
          );
        },
      },

      {
        id: 'actions',
        header: 'Actions',
        size: 180,
        cell: function ActionsCell({ row, table }) {
          const tableEditedData = (table.options.meta as any)?.editedData || {};
          const tableOnAccept = (table.options.meta as any)?.onAccept;
          const tableOnHold = (table.options.meta as any)?.onHold;
          const tableOnReject = (table.options.meta as any)?.onReject;
          const tableOnResume = (table.options.meta as any)?.onResume;
          const tableIsHoldTable = (table.options.meta as any)?.isHoldTable;

          return (
            <div className="flex flex-col items-stretch justify-center gap-2 px-1 w-full max-w-[120px] mx-auto">
              {!tableIsHoldTable ? (
                <>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      tableOnAccept(row.original.orderId);
                    }}
                    disabled={
                      tableEditedData[row.original.orderId]?.accountsApproved !== 'Approved' ||
                      !tableEditedData[row.original.orderId]?.billNo ||
                      !tableEditedData[row.original.orderId]?.paymentCleared
                    }
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-emerald-600 bg-white hover:bg-emerald-50 border border-emerald-200 rounded-md transition-colors font-medium text-xs shadow-sm disabled:opacity-50 disabled:bg-gray-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {row.original.status === 'Verified' ? 'Send to Prod' : 'Accept'}
                  </button>

                  <button
                    onClick={e => {
                      e.stopPropagation();
                      tableOnHold(row.original.orderId);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-amber-600 bg-white hover:bg-amber-50 border border-amber-200 rounded-md transition-colors font-bold text-xs uppercase shadow-sm"
                  >
                    <PauseCircle className="w-3.5 h-3.5" />
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
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-blue-600 bg-white hover:bg-blue-50 border border-blue-200 rounded-md transition-colors font-medium text-xs shadow-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Resume
                  </button>

                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (tableOnReject) tableOnReject(row.original.orderId);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-red-600 bg-white hover:bg-red-50 border border-red-200 rounded-md transition-colors font-medium text-xs shadow-sm"
                  >
                    <Ban className="w-3.5 h-3.5" />
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
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-8 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="p-4 border-b border-gray-200 flex items-center gap-2 bg-gray-50/50">
        {icon && <span className="text-gray-500">{icon}</span>}
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
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
          headerCell: 'text-center border-r border-gray-200 last:border-r-0 bg-white text-gray-600 font-semibold text-[12px] py-3 px-2',
          cell: 'text-left border-r border-gray-200 last:border-r-0 py-3 px-3 align-middle',
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
