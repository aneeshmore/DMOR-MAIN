import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { InwardEntry } from '../types';

interface InwardTableProps {
  data: InwardEntry[];
  onEdit: (entries: InwardEntry[]) => void;
  onDelete: (entries: InwardEntry[]) => void;
}

// Define the shape of grouped bill data
interface BillGroup {
  id: string;
  billNo: string;
  supplierName: string;
  inwardDate: string;
  productType: string;
  totalAmount: number;
  notes: string;
  updatedAt: string;
  createdAt: string;
  items: InwardEntry[];
}

export const InwardTable: React.FC<InwardTableProps> = ({ data, onEdit, onDelete }) => {
  // Group flat entries into bills
  const billGroups: BillGroup[] = React.useMemo(() => {
    const groups: { [key: string]: BillGroup } = {};

    data.forEach(entry => {
      const dateStr = new Date(entry.inwardDate).toISOString().split('T')[0];
      // For FG, use customerId; for RM/PM, use supplierId
      const entityId = entry.supplierId || 'NoSupplier';

      // If billNo is empty ('Unbilled'), we create a unique key using inwardId or timestamp to prevent grouping.
      // We still group actual bills (if present).
      const distinctKey = entry.billNo
        ? `${entry.billNo}_${entityId}_${entry.productType}`
        : `Unbilled_${entry.inwardId || Math.random()}`;

      const key = `${distinctKey}_${dateStr}`;

      if (!groups[key]) {
        groups[key] = {
          id: key,
          billNo: entry.billNo || 'Unbilled',
          supplierName: entry.supplierName || 'Unknown Supplier',
          inwardDate: entry.inwardDate,
          productType: entry.productType || '-',
          totalAmount: 0,
          notes: entry.notes || '',
          updatedAt: entry.updatedAt || entry.createdAt || entry.inwardDate,
          createdAt: entry.createdAt || entry.inwardDate,
          items: [],
        };
      }

      groups[key].items.push(entry);

      const itemTotal =
        entry.totalCost && Number(entry.totalCost) > 0
          ? Number(entry.totalCost)
          : Number(entry.quantity) * Number(entry.unitPrice || 0);

      groups[key].totalAmount += itemTotal;

      const itemTime = new Date(entry.updatedAt || entry.createdAt || entry.inwardDate).getTime();
      const groupTime = new Date(groups[key].updatedAt).getTime();
      if (itemTime > groupTime) {
        groups[key].updatedAt = entry.updatedAt || entry.createdAt || entry.inwardDate;
      }
    });

    return Object.values(groups).sort((a, b) => {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [data]);

  // Pagination State
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(10);

  // Reset page when data changes
  React.useEffect(() => {
    setPageIndex(0);
  }, [data.length]);

  const totalPages = Math.ceil(billGroups.length / pageSize);
  const paginatedGroups = billGroups.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

  // Helper to get material type label
  const getMaterialTypeLabel = (type: string) => {
    if (type === 'FG') return 'Finished Good';
    if (type === 'RM') return 'RAW MATERIAL';
    if (type === 'PM') return 'PACKAGING MATERIAL';
    return '-';
  };

  return (
    <div className="w-full">
      {/* Search Bar */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by bill number, supplier, or product..."
          className="w-full px-4 py-2 border border-[var(--border)] rounded focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none bg-[var(--surface)] text-[var(--text-primary)] placeholder-[var(--text-secondary)]"
          onChange={e => {
            const searchValue = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('[data-bill-group]');
            rows.forEach(row => {
              const text = row.textContent?.toLowerCase() || '';
              const billRow = row as HTMLElement;
              billRow.style.display = text.includes(searchValue) ? '' : 'none';
            });
          }}
        />
      </div>

      {/* Table with Horizontal Scroll */}
      <div className="border border-[var(--border)] rounded bg-[var(--surface)] overflow-x-auto">
        <table className="w-full min-w-max border-collapse">
          <thead>
            <tr className="bg-[var(--surface-secondary)] border-b-2 border-[var(--border)]">
              <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-primary)] uppercase border-r border-[var(--border)]">
                Bill No
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-primary)] uppercase border-r border-[var(--border)]">
                Supplier
              </th>

              <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-primary)] uppercase border-r border-[var(--border)]">
                Date
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-primary)] uppercase border-r border-[var(--border)]">
                Material Type
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-primary)] uppercase border-r border-[var(--border)]">
                Product Name
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-[var(--text-primary)] uppercase border-r border-[var(--border)]">
                Quantity
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-[var(--text-primary)] uppercase border-r border-[var(--border)]">
                Unit Price
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-[var(--text-primary)] uppercase border-r border-[var(--border)]">
                Total Unit Price
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-[var(--text-primary)] uppercase border-r border-[var(--border)]">
                Total Bill Amount
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-primary)] uppercase">
                Notes
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedGroups.map(bill => {
              const itemCount = bill.items.length;

              return (
                <React.Fragment key={bill.id}>
                  {bill.items.map((item, itemIndex) => {
                    const isFirstRow = itemIndex === 0;
                    const isLastRow = itemIndex === itemCount - 1;
                    const lineTotal =
                      item.totalCost && Number(item.totalCost) > 0
                        ? Number(item.totalCost)
                        : Number(item.quantity) * Number(item.unitPrice || 0);

                    return (
                      <tr
                        key={item.inwardId}
                        className={`hover:bg-[var(--surface-hover)] ${
                          isLastRow
                            ? 'border-b-2 border-[var(--border)]'
                            : 'border-b border-[var(--border-light)]'
                        }`}
                        data-bill-group={bill.id}
                      >
                        {/* Bill No */}
                        {isFirstRow && (
                          <td
                            rowSpan={itemCount}
                            className="px-3 py-2 align-top border-r border-[var(--border)] bg-[var(--surface-secondary)]"
                          >
                            <span
                              className={
                                bill.billNo === 'Unbilled'
                                  ? 'italic text-[var(--text-secondary)] text-sm'
                                  : 'font-medium text-[var(--text-primary)] text-sm'
                              }
                            >
                              {bill.billNo}
                            </span>
                          </td>
                        )}

                        {/* Supplier */}
                        {isFirstRow && (
                          <td
                            rowSpan={itemCount}
                            className="px-3 py-2 align-top border-r border-[var(--border)] bg-[var(--surface-secondary)]"
                          >
                            <span className="text-sm text-[var(--text-primary)]">
                              {bill.supplierName && bill.supplierName !== 'Unknown Supplier'
                                ? bill.supplierName
                                : '-'}
                            </span>
                          </td>
                        )}

                        {/* Date */}
                        {isFirstRow && (
                          <td
                            rowSpan={itemCount}
                            className="px-3 py-2 align-top border-r border-[var(--border)] bg-[var(--surface-secondary)]"
                          >
                            <span className="text-sm text-[var(--text-primary)]">
                              {new Date(bill.inwardDate).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                          </td>
                        )}

                        {/* Material Type */}
                        {isFirstRow && (
                          <td
                            rowSpan={itemCount}
                            className="px-3 py-2 align-top border-r border-[var(--border)] bg-[var(--surface-secondary)]"
                          >
                            <span className="text-sm text-[var(--text-primary)]">
                              {getMaterialTypeLabel(bill.productType)}
                            </span>
                          </td>
                        )}

                        {/* Product Name */}
                        <td className="px-3 py-2 border-r border-[var(--border)]">
                          <span className="text-sm text-[var(--text-primary)]">
                            {item.productType === 'FG'
                              ? item.skuProductName || item.productName || 'Unknown Product'
                              : item.productName || 'Unknown Product'}
                          </span>
                        </td>

                        {/* Quantity */}
                        <td className="px-3 py-2 text-right border-r border-[var(--border)]">
                          <span className="text-sm text-[var(--text-primary)]">
                            {Number(item.quantity).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{' '}
                            <span className="text-xs text-[var(--text-secondary)]">
                              {item.unitName}
                            </span>
                          </span>
                        </td>

                        {/* Unit Price */}
                        <td className="px-3 py-2 text-right border-r border-[var(--border)]">
                          <span className="text-sm text-[var(--text-primary)]">
                            ₹
                            {Number(item.unitPrice || 0).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </td>

                        {/* Line Total */}
                        <td className="px-3 py-2 text-right border-r border-[var(--border)]">
                          <span className="text-sm font-semibold text-[var(--text-primary)]">
                            ₹
                            {lineTotal.toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </td>

                        {/* Bill Amount */}
                        {isFirstRow && (
                          <td
                            rowSpan={itemCount}
                            className="px-3 py-2 align-top text-right border-r border-[var(--border)] bg-[var(--surface-secondary)]"
                          >
                            <span className="text-sm font-bold text-[var(--text-primary)]">
                              ₹
                              {bill.totalAmount.toLocaleString('en-IN', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </td>
                        )}

                        {/* Notes */}
                        {isFirstRow && (
                          <td rowSpan={itemCount} className="px-3 py-2 align-top">
                            {bill.notes ? (
                              <span className="text-xs text-[var(--text-secondary)]">
                                {bill.notes}
                              </span>
                            ) : (
                              <span className="text-xs text-[var(--text-secondary)]">-</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {/* Empty State */}
        {billGroups.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[var(--text-secondary)] text-sm">No inward entries found</p>
          </div>
        )}
      </div>

      {/* Pagination & Summary */}
      {billGroups.length > 0 && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex items-center justify-between text-sm text-[var(--text-secondary)] bg-[var(--surface-secondary)] px-4 py-2 rounded border border-[var(--border)]">
            <span>
              Showing <strong>{paginatedGroups.length}</strong> bill
              {paginatedGroups.length !== 1 ? 's' : ''} (Total bills: {billGroups.length})
            </span>
            <span className="font-semibold text-[var(--text-primary)]">
              Grand Total: ₹
              {billGroups
                .reduce((sum, bill) => sum + bill.totalAmount, 0)
                .toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between px-2">
            <div className="flex-1 text-sm text-[var(--text-secondary)]">
              Page {pageIndex + 1} of {totalPages}
            </div>
            <div className="flex items-center space-x-6 lg:space-x-8">
              <div className="flex items-center space-x-2">
                <p className="text-sm font-medium text-[var(--text-primary)]">Rows per page</p>
                <select
                  value={pageSize}
                  onChange={e => {
                    setPageSize(Number(e.target.value));
                    setPageIndex(0);
                  }}
                  className="h-8 w-[70px] rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] px-2 py-1 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 cursor-pointer"
                >
                  {[10, 20, 30, 40, 50, 100].map(size => (
                    <option
                      key={size}
                      value={size}
                      className="bg-[var(--surface)] text-[var(--text-primary)]"
                    >
                      {size}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  className="h-8 w-8 p-0 inline-flex items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-highlight)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  onClick={() => setPageIndex(0)}
                  disabled={pageIndex === 0}
                  title="Go to first page"
                >
                  <span className="sr-only">Go to first page</span>
                  <ChevronsLeft className="h-4 w-4" />
                </button>
                <button
                  className="h-8 w-8 p-0 inline-flex items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-highlight)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  onClick={() => setPageIndex(p => Math.max(0, p - 1))}
                  disabled={pageIndex === 0}
                  title="Go to previous page"
                >
                  <span className="sr-only">Go to previous page</span>
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  className="h-8 w-8 p-0 inline-flex items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-highlight)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  onClick={() => setPageIndex(p => Math.min(totalPages - 1, p + 1))}
                  disabled={pageIndex === totalPages - 1}
                  title="Go to next page"
                >
                  <span className="sr-only">Go to next page</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  className="h-8 w-8 p-0 inline-flex items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-highlight)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  onClick={() => setPageIndex(totalPages - 1)}
                  disabled={pageIndex === totalPages - 1}
                  title="Go to last page"
                >
                  <span className="sr-only">Go to last page</span>
                  <ChevronsRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
