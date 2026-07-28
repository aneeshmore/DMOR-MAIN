import { useState, useEffect, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { decodeHtml } from '@/utils/stringUtils';
import { DataTable } from '@/components/ui/data-table/DataTable';
import { DataTableColumnHeader } from '@/components/ui/data-table/DataTableColumnHeader';
import { PriorityBadge } from '@/components/common';
import { Search, Package, CheckCircle2, AlertCircle, Check, Scissors } from 'lucide-react';
import { productionManagerApi, InventoryCheckResult } from '../api/productionManagerApi';
import { showToast } from '@/utils/toast';

interface OrderWithDetails {
  order: any;
  customer: any;
  salesperson: any;
  details?: any[];
}

interface AcceptedOrdersDataTableProps {
  data: OrderWithDetails[];
  editedData: Record<number, { expectedDeliveryDate: string; remarks: string }>;
  handleInputChange: (orderId: number, field: string, value: any) => void;
  checkAvailability: (orderId: number) => Promise<void>;
  loadingInventory: Set<number>;
  inventoryResults: Map<number, InventoryCheckResult[]>;
  handleProcessOrder: (orderId: number, action: 'dispatch' | 'schedule' | 'split') => void;
}

const getSalespersonName = (sp: any) => {
  if (!sp) return 'N/A';
  if (sp.salesPersonName) return decodeHtml(sp.salesPersonName);
  if (sp.name) return decodeHtml(sp.name);
  if (sp.fullName) return decodeHtml(sp.fullName);
  if (sp.firstName)
    return decodeHtml(`${sp.firstName} ${sp.lastName || ''}`.trim());
  return decodeHtml(sp.username || 'N/A');
};

// Split children carry "Split from Order #X" (and, for the Balance child, "(Balance)") in the
// order's own notes — the same marker used by the Split Orders table on the Credit & Order
// Approval page. Factory only needs the portion badge here, not the full remark text.
const getSplitPortion = (notes: string): 'Dispatch' | 'Balance' | null => {
  if (!/Split from Order/i.test(notes)) return null;
  return /\(Balance\)/i.test(notes) ? 'Balance' : 'Dispatch';
};

const formatTimeSpan = (dateString: string) => {
  const start = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - start.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  let result = '';
  if (days > 0) result += `${days} Days `;
  if (hours > 0) result += `${hours} Hours`;
  if (!result) result = 'Just now';
  return result;
};

const ExpandedOrderContent = ({
  orderId,
  inventoryResults,
}: {
  orderId: number;
  inventoryResults?: InventoryCheckResult[];
}) => {
  const [details, setDetails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const response = await productionManagerApi.getOrderDetails(orderId);
        setDetails(response.details || []);
      } catch (error) {
        console.error('Failed to fetch order details', error);
        showToast.error('Failed to load details');
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [orderId]);

  const groupDetailsByMaster = (details: any[]) => {
    const grouped: Record<string, any[]> = {};
    details.forEach(d => {
      const masterName =
        d.masterProduct?.masterProductName || d.product?.masterProductName || 'Other';
      if (!grouped[masterName]) grouped[masterName] = [];
      grouped[masterName].push(d);
    });
    return grouped;
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-[var(--text-secondary)] bg-[var(--surface-secondary)]">
        <div className="animate-spin w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full mx-auto mb-2"></div>
        Loading order details...
      </div>
    );
  }

  if (details.length === 0) {
    return (
      <div className="p-8 text-center text-[var(--text-secondary)] bg-[var(--surface-secondary)]">
        No items found in this order.
      </div>
    );
  }

  return (
    <div className="p-4 bg-[var(--surface-secondary)] space-y-4">
      <h4 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
        <Package className="w-4 h-4 text-[var(--primary)]" />
        Order Items
      </h4>
      <div className="grid gap-4">
        {Object.entries(groupDetailsByMaster(details)).map(([masterName, items]) => (
          <div
            key={masterName}
            className="bg-[var(--surface)] rounded-lg border border-[var(--border)] overflow-hidden shadow-sm"
          >
            <div className="px-4 py-2 bg-[var(--primary)]/10 border-b border-[var(--border)] font-semibold text-[var(--primary)] text-xs uppercase tracking-wider">
              {masterName}
            </div>
            <div className="divide-y divide-[var(--border)]">
              {items.map((item: any, idx: number) => {
                const product = item.product || {};
                const orderDetail = item.orderDetail || {};
                const invResult = inventoryResults?.find(
                  r => r.productId === product.id || r.productId === Number(orderDetail.productId)
                );

                return (
                  <div
                    key={idx}
                    className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm"
                  >
                    <div>
                      <div className="font-medium text-[var(--text-primary)]">
                        {decodeHtml(product.productName || item.productName || 'Unknown Product')} -{' '}
                        {product.size}
                      </div>
                      <div className="text-[var(--text-secondary)] mt-0.5">
                        Qty:{' '}
                        <span className="font-medium text-[var(--text-primary)]">
                          {orderDetail.quantity} {product.unit || 'Units'}
                        </span>
                      </div>
                    </div>

                    {invResult && (
                      <div
                        className={`px-3 py-1.5 rounded border text-xs font-medium flex items-center gap-3 ${invResult.canFulfill
                          ? 'bg-[var(--success)]/10 border-[var(--success)] text-[var(--success)]'
                          : 'bg-[var(--danger)]/10 border-[var(--danger)] text-[var(--danger)]'
                          }`}
                      >
                        <span>Req: {invResult.orderedQuantity}</span>
                        <span>Free: {Number(invResult.availableQuantity).toFixed(2)}</span>
                        {invResult.canFulfill ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5" />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export function AcceptedOrdersDataTable({
  data,
  editedData,
  handleInputChange,
  checkAvailability,
  loadingInventory,
  inventoryResults,
  handleProcessOrder,
}: AcceptedOrdersDataTableProps) {
  const columns: ColumnDef<OrderWithDetails>[] = useMemo(
    () => [
      {
        accessorKey: 'order.orderId',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Order ID" />,
        cell: ({ row }) => {
          const portion = getSplitPortion(row.original.order?.notes || '');
          return (
            <div className="flex flex-col gap-1">
              <span className="font-medium text-xs whitespace-nowrap">
                {row.original.order.orderNumber || row.original.order.orderId}
              </span>
              {portion && (
                <span
                  className={`w-fit text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                    portion === 'Balance'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {portion}
                </span>
              )}
            </div>
          );
        },
        size: 110,
      },
      {
        accessorKey: 'customer.companyName',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Name Of Company" />,
        cell: ({ row }) => (
          <span className="text-[var(--primary)] font-medium truncate block max-w-[150px]">
            {decodeHtml(row.original.customer?.companyName || 'Unknown')}
          </span>
        ),
      },
      {
        accessorKey: 'customer.city',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Location" />,
        cell: ({ row }) => (
          <span className="text-xs text-[var(--text-secondary)] truncate block max-w-[120px]">
            {decodeHtml(row.original.customer?.location || row.original.customer?.address || '-')}
          </span>
        ),
      },
      {
        accessorFn: row => getSalespersonName(row.salesperson),
        id: 'salesPerson',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Sales Person" />,
        cell: ({ row }) => (
          <span className="text-xs">{getSalespersonName(row.original.salesperson)}</span>
        ),
      },
      {
        accessorKey: 'order.notes',
        id: 'salespersonRemark',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Salesperson Remark" />
        ),
        cell: ({ row }) => {
          const notes = row.original.order?.notes || '';
          // Split-order bookkeeping text ("Split from Order #X" / "(Balance)") is an
          // accounts-manager concern — it's already surfaced in the Split Orders table on the
          // Credit & Order Approval page. It isn't a salesperson remark, so it shouldn't show
          // here; the factory user just sees "-" for these orders, same as any order with no
          // remark.
          const isSplitOrder = /Split from Order/i.test(notes);
          const remarkText = isSplitOrder ? '-' : decodeHtml(notes) || '-';

          return (
            <div className="flex flex-col items-start gap-1.5">
              <span
                className="text-xs text-[var(--text-secondary)] truncate block max-w-[140px]"
                title={isSplitOrder ? '' : decodeHtml(notes)}
              >
                {remarkText}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
                Priority:
                <PriorityBadge priority={row.original.order?.priorityLevel} />
              </span>
            </div>
          );
        },
      },
      {
        id: 'expectedDeliveryDate',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Delivery Expected Date" />
        ),
        cell: ({ row, table }) => {
          const meta = table.options.meta as any;
          return (
            <input
              type="date"
              value={meta?.editedData[row.original.order.orderId]?.expectedDeliveryDate || ''}
              onChange={e =>
                meta?.handleInputChange(
                  row.original.order.orderId,
                  'expectedDeliveryDate',
                  e.target.value
                )
              }
              onClick={e => e.stopPropagation()}
              className="w-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] rounded px-2 py-1 text-xs focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] outline-none transition-all"
            />
          );
        },
        size: 140,
      },
      {
        id: 'timeSpan',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Time Span" />,
        cell: ({ row }) => (
          <span className="text-xs text-[var(--text-secondary)] whitespace-nowrap">
            {formatTimeSpan(row.original.order.orderDate)}
          </span>
        ),
        size: 100,
      },
      {
        accessorKey: 'order.adminRemarks',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Admin Remark" />,
        cell: ({ row }) => (
          <span
            className="text-xs text-[var(--text-secondary)] truncate block max-w-[100px]"
            title={decodeHtml(row.original.order.adminRemarks)}
          >
            {decodeHtml(row.original.order.adminRemarks || '-')}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Action',
        cell: ({ row }) => {
          const orderId = row.original.order.orderId;
          const inventoryChecked = inventoryResults.has(orderId);
          const canFulfill =
            inventoryChecked && inventoryResults.get(orderId)?.every(r => r.canFulfill);

          return (
            <div onClick={e => e.stopPropagation()} className="flex flex-col gap-1">
              {!inventoryChecked ? (
                <button
                  onClick={() => {
                    checkAvailability(orderId);
                    row.toggleExpanded(true);
                  }}
                  disabled={loadingInventory.has(orderId)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 rounded-md transition-colors shadow-sm w-full justify-center disabled:opacity-50 text-xs font-bold uppercase border border-[var(--primary)]/30"
                >
                  {loadingInventory.has(orderId) ? (
                    <span className="animate-pulse">Checking...</span>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" />
                      Check Avail
                    </>
                  )}
                </button>
              ) : canFulfill ? (
                // Inventory available: Show Dispatch button - order goes directly to dispatch planning
                <button
                  onClick={() => handleProcessOrder(orderId, 'dispatch')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-[var(--success)]/10 text-[var(--success)] hover:bg-[var(--success)]/20 rounded-md transition-colors shadow-sm w-full justify-center text-xs font-bold uppercase border border-[var(--success)]/30"
                  title="Send order directly to dispatch planning"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Accept
                </button>
              ) : (
                // Inventory shortage: Show Accept (to PM Dashboard) and Split Order buttons
                <>
                  <button
                    onClick={() => handleProcessOrder(orderId, 'dispatch')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-[var(--success)]/10 text-[var(--success)] hover:bg-[var(--success)]/20 rounded-md transition-colors shadow-sm w-full justify-center text-xs font-bold uppercase border border-[var(--success)]/30"
                    title="Force dispatch despite shortage"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Accept
                  </button>
                  <button
                    onClick={() => handleProcessOrder(orderId, 'split')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-[var(--info)]/10 text-[var(--info)] hover:bg-[var(--info)]/20 rounded-md transition-colors shadow-sm w-full justify-center text-xs font-bold uppercase border border-[var(--info)]/30"
                    title="Split this order into multiple parts"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    Split Order
                  </button>
                </>
              )}
            </div>
          );
        },
        size: 170,
      },
    ],
    [checkAvailability, loadingInventory, inventoryResults, handleProcessOrder]
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Filter orders..."
      defaultPageSize={25}
      enableVirtualization={false}
      getRowCanExpand={() => true}
      renderSubComponent={({ row }) => (
        <ExpandedOrderContent
          orderId={row.original.order.orderId}
          inventoryResults={inventoryResults.get(row.original.order.orderId)}
        />
      )}
      meta={{ editedData, handleInputChange }}
      autoResetPageIndex={false}
      autoResetExpanded={false}
    />
  );
}
