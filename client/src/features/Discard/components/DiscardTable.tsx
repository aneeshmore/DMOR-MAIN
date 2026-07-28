import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { DiscardEntry } from '../types';

interface DiscardTableProps {
  data: DiscardEntry[];
}

// Helper to get type label and color
const getTypeInfo = (type: string | undefined) => {
  switch (type) {
    case 'RM':
      return { label: 'Raw Material', bgColor: 'bg-amber-100', textColor: 'text-amber-700' };
    case 'PM':
      return {
        label: 'Packaging Material',
        bgColor: 'bg-purple-100',
        textColor: 'text-purple-700',
      };
    case 'FG':
      return { label: 'Finished Good', bgColor: 'bg-green-100', textColor: 'text-green-700' };
    default:
      return { label: 'Unknown', bgColor: 'bg-gray-100', textColor: 'text-gray-700' };
  }
};

/** Date AND time — a material can be discarded more than once in a day, so the date alone
 *  is not enough to tell two events apart in the history. */
const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

interface ProductGroup {
  productId: number;
  productName: string;
  productType: string | undefined;
  currentStock: number | undefined;
  totalDiscarded: number;
  eventCount: number;
  lastDiscardedDate: string;
  events: DiscardEntry[];
}

export const DiscardTable: React.FC<DiscardTableProps> = ({ data }) => {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // Group events by product for display only. Every event is retained in `events` and
  // rendered individually when expanded — the summary figures are derived on top of them,
  // never in place of them, so no discard record is ever hidden or overwritten.
  const groups = useMemo<ProductGroup[]>(() => {
    const map = new Map<number, ProductGroup>();

    // data arrives ordered by discardDate desc from the API
    for (const entry of data) {
      const existing = map.get(entry.productId);
      if (existing) {
        existing.totalDiscarded += Number(entry.quantity) || 0;
        existing.eventCount += 1;
        existing.events.push(entry);
        // events[0] is already the most recent since input is desc-ordered
      } else {
        map.set(entry.productId, {
          productId: entry.productId,
          productName: entry.productName || `Product #${entry.productId}`,
          productType: entry.productType,
          currentStock: entry.currentStock,
          totalDiscarded: Number(entry.quantity) || 0,
          eventCount: 1,
          lastDiscardedDate: entry.discardDate,
          events: [entry],
        });
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.lastDiscardedDate).getTime() - new Date(a.lastDiscardedDate).getTime()
    );
  }, [data]);

  const toggleExpand = (productId: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  if (!data || data.length === 0) {
    return (
      <div className="bg-[var(--surface)] rounded-lg shadow-sm p-8 text-center text-[var(--text-secondary)] border border-[var(--border)]">
        No discard records found.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {groups.map(group => {
        const typeInfo = getTypeInfo(group.productType);
        const isExpanded = expandedIds.has(group.productId);

        return (
          <div
            key={group.productId}
            className="bg-[var(--surface)] rounded-lg border border-[var(--border)] overflow-hidden"
          >
            {/* Product summary row — click anywhere to expand */}
            <div
              className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 p-4 cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
              onClick={() => toggleExpand(group.productId)}
              role="button"
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleExpand(group.productId);
                }
              }}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="p-1 rounded flex-shrink-0">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
                  )}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-[var(--text-primary)] truncate">
                      {group.productName}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${typeInfo.bgColor} ${typeInfo.textColor}`}
                    >
                      {typeInfo.label}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 sm:gap-8 text-xs sm:text-sm flex-shrink-0 pl-7 sm:pl-0">
                <div>
                  <p className="text-[10px] text-[var(--text-tertiary)] uppercase">Current Stock</p>
                  <p className="font-semibold text-blue-600">
                    {group.currentStock !== undefined && group.currentStock !== null
                      ? Number(group.currentStock).toFixed(2)
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-[var(--text-tertiary)] uppercase">
                    Total Discarded
                  </p>
                  <p className="font-semibold text-red-600">{group.totalDiscarded.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[var(--text-tertiary)] uppercase">
                    Discard Events
                  </p>
                  <p className="font-semibold text-[var(--text-primary)]">{group.eventCount}</p>
                </div>
                <div className="hidden sm:block">
                  <p className="text-[10px] text-[var(--text-tertiary)] uppercase">
                    Last Discarded
                  </p>
                  <p className="font-semibold text-[var(--text-primary)]">
                    {new Date(group.lastDiscardedDate).toLocaleDateString('en-GB')}
                  </p>
                </div>
              </div>
            </div>

            {/* Expanded event history — every discard for this product */}
            {isExpanded && (
              <div className="border-t border-[var(--border)] bg-[var(--surface-secondary)]/50 overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-[var(--text-secondary)] uppercase">
                    <tr>
                      <th className="px-4 sm:pl-12 py-2 whitespace-nowrap">Date &amp; Time</th>
                      <th className="px-4 py-2 whitespace-nowrap">Discarded Qty</th>
                      <th className="px-4 py-2 whitespace-nowrap">Remaining After Discard</th>
                      <th className="px-4 py-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.events.map(event => (
                      <tr key={event.discardId} className="border-t border-[var(--border)]/60">
                        <td className="px-4 sm:pl-12 py-2 text-[var(--text-primary)] whitespace-nowrap">
                          {formatDateTime(event.discardDate)}
                        </td>
                        <td className="px-4 py-2 text-red-600 font-medium whitespace-nowrap">
                          -{Number(event.quantity).toFixed(2)}
                        </td>
                        {/* Point-in-time stock for THIS event, deliberately not currentStock —
                            the live figure would repeat the same number down every row of the
                            group and misrepresent the older events. '-' where the event has no
                            inventory-transaction row to read the balance from. */}
                        <td className="px-4 py-2 text-blue-600 font-medium whitespace-nowrap">
                          {event.stockAfterDiscard !== undefined && event.stockAfterDiscard !== null
                            ? Number(event.stockAfterDiscard).toFixed(2)
                            : '-'}
                        </td>
                        <td className="px-4 py-2 text-[var(--text-secondary)]">
                          {event.reason || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
