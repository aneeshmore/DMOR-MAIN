import React, { useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { AdminOrder } from '../api/adminAccountsApi';
import { DataTable } from '@/components/ui/data-table/DataTable';
import { DataTableColumnHeader } from '@/components/ui/data-table/DataTableColumnHeader';
import { adminAccountsApi, AdminOrderDetails } from '../api/adminAccountsApi';
import { useState, useEffect } from 'react';

interface CancelledOrdersDataTableProps {
  data: AdminOrder[];
  title: string;
  icon?: React.ReactNode;
}

const formatDisplayOrderId = (orderId: number, dateString: string) => {
  if (!dateString) return `ORD-${orderId}`;
  const date = new Date(dateString);
  const year = date.getFullYear();
  const idStr = orderId.toString();
  const shortId = idStr.length > 3 ? idStr.slice(-3) : idStr.padStart(3, '0');
  return `ORD-${year}-${shortId}`;
};

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
                {item.productName} ({item.size})
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
      {/* Show cancellation remarks if available */}
      {details.adminRemarks && (
        <div className="mt-2 pt-2 border-t border-[var(--border)]">
          <span className="font-semibold text-sm text-[var(--error)]">Cancellation Reason: </span>
          <span className="text-sm text-[var(--text-primary)]">{details.adminRemarks}</span>
        </div>
      )}
    </div>
  );
};

export function CancelledOrdersDataTable({ data, title, icon }: CancelledOrdersDataTableProps) {
  const columns: ColumnDef<AdminOrder>[] = useMemo(
    () => [
      {
        accessorKey: 'orderId',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Order ID" />,
        cell: ({ row }) => (
          <span className="font-medium text-xs text-[var(--text-primary)]">
            {formatDisplayOrderId(row.original.orderId, row.original.orderCreatedDate)}
          </span>
        ),
        size: 100,
      },
      {
        accessorKey: 'customerName',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Company" />,
        cell: ({ row }) => (
          <span
            className="text-[var(--primary)] font-medium truncate block max-w-[150px]"
            title={row.original.customerName}
          >
            {row.original.customerName}
          </span>
        ),
      },
      {
        accessorKey: 'area',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Area" />,
        cell: ({ row }) => (
          <span className="text-[var(--text-secondary)]">{row.original.area || '-'}</span>
        ),
      },
      {
        accessorKey: 'location',
        meta: { fitContent: true },
        header: ({ column }) => <DataTableColumnHeader column={column} title="Location" />,
        cell: ({ row }) => (
          <span className="text-[var(--text-secondary)]">{row.original.location || '-'}</span>
        ),
      },
      {
        accessorKey: 'salesPersonName',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Sales Person" />,
        cell: ({ row }) => (
          <span className="text-[var(--text-secondary)]">
            {row.original.salesPersonName || 'N/A'}
          </span>
        ),
      },
      {
        accessorKey: 'orderCreatedDate',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
        cell: ({ row }) => (
          <span className="text-[var(--text-primary)]">
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
        id: 'billNo',
        header: 'Bill No',
        accessorKey: 'billNo',
        cell: ({ row }) => (
          <span className="text-[var(--text-secondary)]">{row.original.billNo || '-'}</span>
        ),
      },
      {
        id: 'remarks',
        header: 'Reason / Remarks',
        accessorKey: 'adminRemarks', // Using adminRemarks for reason
        size: 250,
        cell: ({ row }) => (
          <span className="text-[var(--error)] italic text-sm">
            {row.original.adminRemarks || 'No reason provided'}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <div className="bg-[var(--surface)] rounded-lg border border-[var(--border)] shadow-sm mb-8 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="p-4 border-b border-[var(--border)] flex items-center gap-2 bg-[var(--error)]/5">
        {icon && <span className="text-[var(--error)]">{icon}</span>}
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
      </div>

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search cancelled orders..."
        enableVirtualization={false}
        getRowCanExpand={() => true}
        renderSubComponent={({ row }) => <ExpandedOrderDetails orderId={row.original.orderId} />}
        persistenceKey="cancelled-orders-table"
        theme={{
          container: 'border-none shadow-none rounded-t-none',
          headerCell: '!px-1 [&:nth-child(4)]:!pr-0',
          cell: '!px-1 py-4 [&:nth-child(4)]:!pr-0',
        }}
      />
    </div>
  );
}
