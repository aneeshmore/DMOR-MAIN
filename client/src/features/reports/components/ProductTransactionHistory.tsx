import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Button, Input } from '@/components/ui';
import { FileDown, Search } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { reportsApi } from '../api/reportsApi';
import { ProductWiseReportItem } from '../types';
import { showToast } from '@/utils/toast';
import { addPdfFooter } from '@/utils/pdfUtils';
import { formatDate } from '@/utils/dateUtils';

// Single formatting source for this module: the table cells and the PDF export
// must always render the same value identically.
const formatTxnValue = (value: unknown) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return '-';
  return num.toFixed(2);
};

const formatBalanceValue = (value: unknown) => {
  const num = Number(value);
  return (Number.isFinite(num) ? num : 0).toFixed(2);
};

// Completed-batch report cache shared by all expanded rows. One request per
// date range (Expand All reuses the same in-flight promise) with a short TTL
// so re-expanding after new transactions shows fresh, consistent numbers.
const BATCH_CACHE_TTL_MS = 60_000;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const completedBatchesCache = new Map<string, { fetchedAt: number; promise: Promise<any[]> }>();
const getCompletedBatches = (start?: string, end?: string) => {
  const key = `${start || ''}|${end || ''}`;
  const hit = completedBatchesCache.get(key);
  if (hit && Date.now() - hit.fetchedAt < BATCH_CACHE_TTL_MS) return hit.promise;
  const promise = reportsApi
    .getBatchProductionReport('Completed', start || undefined, end || undefined)
    .catch(() => []);
  completedBatchesCache.set(key, { fetchedAt: Date.now(), promise });
  return promise;
};

const useDebouncedValue = <T,>(value: T, delay = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
};

interface ProductTransactionHistoryProps {
  productId: string;
  productType: string;
  endDate?: string;
  reportCache?: Map<
    string,
    {
      productId?: string | number;
      productType?: string;
      transactions?: ProductWiseReportItem[];
      product?: { productType?: string; productName?: string };
      cachedAt?: number;
    }
  >;
}

const ProductTransactionHistory: React.FC<ProductTransactionHistoryProps> = ({
  productId,
  productType,
  endDate,
  reportCache,
}) => {
  const [data, setData] = useState<ProductWiseReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedOnceRef = useRef(false);
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState(endDate || '');

  // Period selector: Till Date (full history, default) / Monthly / Yearly / Custom range
  type HistoryPeriod = 'TILL_DATE' | 'MONTHLY' | 'YEARLY' | 'CUSTOM';
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>('TILL_DATE');

  const debouncedHistoryStartDate = useDebouncedValue(historyStartDate, 300);
  const debouncedHistoryEndDate = useDebouncedValue(historyEndDate, 300);

  // Effective range derived from the selected period mode
  const { effectiveStartDate, effectiveEndDate } = useMemo(() => {
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const today = new Date();
    if (historyPeriod === 'MONTHLY') {
      return {
        effectiveStartDate: fmt(new Date(today.getFullYear(), today.getMonth(), 1)),
        effectiveEndDate: fmt(today),
      };
    }
    if (historyPeriod === 'YEARLY') {
      return {
        effectiveStartDate: fmt(new Date(today.getFullYear(), 0, 1)),
        effectiveEndDate: fmt(today),
      };
    }
    if (historyPeriod === 'CUSTOM') {
      return {
        effectiveStartDate: debouncedHistoryStartDate,
        effectiveEndDate: debouncedHistoryEndDate,
      };
    }
    // TILL_DATE: full history (no range - getProductWiseReport returns everything)
    return { effectiveStartDate: '', effectiveEndDate: '' };
  }, [historyPeriod, debouncedHistoryStartDate, debouncedHistoryEndDate]);

  const parseNumeric = (value: unknown) => {
    if (value === null || value === undefined || value === '') return 0;
    const num = Number(String(value).replace(/,/g, ''));
    return Number.isFinite(num) ? num : 0;
  };

  // 👇 FIX #2: Fetch guard - prevents duplicate concurrent calls
  const fetchInFlightRef = useRef(false);

  const fetchHistory = useCallback(async () => {
    if (!productId || fetchInFlightRef.current) return; // Skip if already fetching
    fetchInFlightRef.current = true;
    try {
      setIsLoading(true);
      const cacheKey = `${productId}|${effectiveStartDate || ''}|${effectiveEndDate || ''}|${productType}`;
      const cachedEntry = reportCache?.get(cacheKey) ?? null;
      // Stale cache entries caused the same transaction to show different
      // numbers between expansions after new activity - expire them.
      const cached =
        cachedEntry &&
        cachedEntry.cachedAt &&
        Date.now() - cachedEntry.cachedAt < BATCH_CACHE_TTL_MS
          ? cachedEntry
          : null;

      const result =
        cached ||
        (await reportsApi.getProductWiseReport(
          productId,
          effectiveStartDate || undefined,
          effectiveEndDate || undefined,
          productType
        ));

      if (!cached) {
        reportCache?.set(cacheKey, { ...result, cachedAt: Date.now() });
      }

      const normalized = (result.transactions || []).map(tx => {
        const outwardNum = parseNumeric(tx.outward);
        const inwardNum = parseNumeric(tx.inward);
        const balanceNum = parseNumeric(tx.balance);
        return {
          ...tx,
          outward: outwardNum,
          inward: inwardNum,
          balance: balanceNum,
        };
      });

      let adjusted = normalized;

      // For raw materials and packing materials, replace "Production Consumption"
      // entries with actual batch consumption. The completed-batch data is fetched
      // for THIS component's own selected window (previously it reused the parent
      // page's window, so the same entry could show different Outward/Balance
      // depending on which period the main table happened to be on).
      if (productType === 'RM' || productType === 'PM') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const batches: any[] =
          (await getCompletedBatches(effectiveStartDate, effectiveEndDate)) || [];

        const entries: { quantity: number; batchNo?: string; completedAt?: string | null }[] = [];
        batches.forEach(batch => {
          if (!batch || batch.status !== 'Completed') return;
          if (productType === 'RM') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (batch.rawMaterials || []).forEach((rm: any) => {
              if (String(rm.rawMaterialId ?? '') !== String(productId)) return;
              const qty = parseNumeric(rm.actualQty ?? 0);
              if (qty <= 0) return;
              entries.push({
                quantity: qty,
                batchNo: batch.batchNo,
                completedAt: batch.completedAt,
              });
            });
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (batch.packagingMaterials || []).forEach((pm: any) => {
              if (String(pm.packagingId ?? '') !== String(productId)) return;
              const qty = parseNumeric(pm.actualQty ?? 0);
              if (qty <= 0) return;
              entries.push({
                quantity: qty,
                batchNo: batch.batchNo,
                completedAt: batch.completedAt,
              });
            });
          }
        });

        if (entries.length > 0) {
          // Remove ledger entries that may contain planned/incorrect consumption
          adjusted = normalized.filter(tx => tx.transactionType !== 'Production Consumption');

          // Safety: keep only entries inside the active window (inclusive days)
          const rangeFrom = effectiveStartDate ? new Date(`${effectiveStartDate}T00:00:00`) : null;
          const rangeTo = effectiveEndDate ? new Date(`${effectiveEndDate}T23:59:59.999`) : null;
          const isWithinRange = (completedAt?: string | null) => {
            if (!rangeFrom && !rangeTo) return true;
            if (!completedAt) return false;
            const t = new Date(completedAt).getTime();
            if (!Number.isFinite(t)) return false;
            if (rangeFrom && t < rangeFrom.getTime()) return false;
            if (rangeTo && t > rangeTo.getTime()) return false;
            return true;
          };

          const syntheticTransactions: ProductWiseReportItem[] = entries
            .filter(entry => isWithinRange(entry.completedAt))
            .map((entry, idx) => ({
              transactionId: -(idx + 1), // ensure stable unique id
              productName: result.product?.productName || '',
              date: entry.completedAt || endDate || new Date().toISOString(),
              type: entry.batchNo
                ? `Batch ${entry.batchNo}`
                : productType === 'PM'
                  ? 'Packaging Consumption'
                  : 'Batch Consumption',
              inward: 0,
              outward: entry.quantity,
              balance: 0, // replaced below by the running balance calculation
              transactionType: 'Batch Consumption',
              productCategory: result.product?.productType || 'RM',
            }));

          adjusted = [...adjusted, ...syntheticTransactions];
        }
      }

      // 1️⃣ CHRONOLOGICAL SORT (oldest first) for balance calculation
      const safeTime = (value: string | number | Date | undefined) => {
        const time = new Date(value || '').getTime();
        return Number.isFinite(time) ? time : 0;
      };

      // Sort chronologically for balance calculation (oldest first)
      let chronologicalData = [...adjusted].sort((a, b) => safeTime(a.date) - safeTime(b.date));

      // 2️⃣ CLIENT-SIDE RUNNING BALANCE CALCULATION
      let runningBalance = 0;
      chronologicalData = chronologicalData.map(tx => {
        runningBalance += parseNumeric(tx.inward) - parseNumeric(tx.outward);
        return { ...tx, balance: runningBalance };
      });

      // 3️⃣ UI SORT - newest first for display
      const displayData = [...chronologicalData].sort(
        (a, b) => safeTime(b.date) - safeTime(a.date)
      );

      setData(displayData);
    } catch (error) {
      console.error('Error fetching product history:', error);
    } finally {
      hasLoadedOnceRef.current = true;
      setIsLoading(false);
      fetchInFlightRef.current = false; // Reset fetch flag
    }
  }, [productId, productType, effectiveStartDate, effectiveEndDate, endDate, reportCache]); // Stable deps only - refs don't trigger

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleExportPdf = () => {
    if (data.length === 0) {
      showToast.error('No data to export');
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Transaction History: ${productType}`, 14, 20);

    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
    const periodLabel =
      historyPeriod === 'MONTHLY'
        ? 'Monthly'
        : historyPeriod === 'YEARLY'
          ? 'Yearly'
          : historyPeriod === 'CUSTOM'
            ? 'Custom'
            : 'Till Date';
    doc.text(
      `Period (${periodLabel}): ${effectiveStartDate || 'Beginning'} to ${effectiveEndDate || 'Today'}`,
      14,
      36
    );

    const tableColumn = ['Date', 'Details', 'Type', 'Inward', 'Outward', 'Balance'];
    const tableRows = data.map(item => [
      formatDate(item.date),
      item.type || '-',
      item.transactionType || '-',
      formatTxnValue(item.inward),
      formatTxnValue(item.outward),
      formatBalanceValue(item.balance),
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 50,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [71, 85, 105] },
    });

    addPdfFooter(doc);
    doc.save(`history_${productId}_${new Date().toISOString().split('T')[0]}.pdf`);
    showToast.success('History exported successfully');
  };

  const columns = useMemo<ColumnDef<ProductWiseReportItem>[]>(() => {
    return [
      {
        accessorKey: 'date',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Date & Time" />,
        cell: ({ row }) => {
          const dateStr = row.original.date;
          if (!dateStr || dateStr === '-') return <span className="text-gray-400">-</span>;
          const dateObj = new Date(dateStr);
          if (isNaN(dateObj.getTime())) return <span className="text-gray-400">-</span>;
          // Format as dd-mm-yy with time
          const day = String(dateObj.getDate()).padStart(2, '0');
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          const year = String(dateObj.getFullYear()).slice(-2);
          const time = dateObj.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'Asia/Kolkata',
          });
          return (
            <div className="flex flex-col">
              <span className="font-medium text-gray-900">{`${day}-${month}-${year}`}</span>
              <span className="text-xs text-gray-500">{time}</span>
            </div>
          );
        },
      },
      {
        accessorKey: 'type',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Details" />,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium text-gray-700">{row.original.type || '-'}</span>
            <span className="text-[10px] text-gray-500 uppercase">
              {row.original.transactionType}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'inward',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Inward" />,
        cell: ({ row }) => (
          <div className="text-center font-bold text-green-600">
            {formatTxnValue(row.original.inward)}
          </div>
        ),
      },
      {
        accessorKey: 'outward',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Outward" />,
        cell: ({ row }) => (
          <div className="text-center font-bold text-red-600">
            {formatTxnValue(row.original.outward)}
          </div>
        ),
      },
      {
        accessorKey: 'balance',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Balance" />,
        cell: ({ row }) => {
          const balance = row.original.balance || 0;
          const isLowStock = balance <= 0; // Negative or zero is concerning for RM

          return (
            <div
              className={`text-center font-bold px-2 py-1 rounded ${
                isLowStock ? 'text-red-600 bg-red-50' : 'text-blue-600 bg-blue-50'
              }`}
            >
              {formatBalanceValue(balance)}
            </div>
          );
        },
      },
    ];
  }, []);

  // Only the very first load shows a placeholder. Afterwards the table (and its
  // toolbar with the date inputs) stays mounted through refetches and empty
  // results — unmounting it closed the native date picker after a single click
  // and made the filters disappear when a range had no transactions.
  if (isLoading && !hasLoadedOnceRef.current) {
    return <div className="p-4 text-center text-sm text-gray-500">Loading history...</div>;
  }

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-4 m-2 shadow-inner">
      <h4 className="mb-3 text-sm font-semibold text-gray-700">
        Transaction History (
        {historyPeriod === 'MONTHLY'
          ? 'This Month'
          : historyPeriod === 'YEARLY'
            ? 'This Year'
            : historyPeriod === 'CUSTOM'
              ? 'Custom Range'
              : 'Till Date'}
        ){isLoading && <span className="ml-2 text-xs font-normal text-gray-400">Updating…</span>}
      </h4>
      <div
        className={`rounded-md border border-gray-200 bg-white transition-opacity ${isLoading ? 'opacity-70' : ''}`}
      >
        <DataTable
          columns={columns}
          data={data}
          showToolbar={true}
          showPagination={true}
          defaultPageSize={10}
          searchPlaceholder="Search history..."
          sorting={[{ id: 'date', desc: true }]}
          toolbarActions={
            <div className="flex items-center gap-1.5 flex-nowrap whitespace-nowrap">
              <div className="flex rounded-md border border-gray-200 overflow-hidden bg-white shrink-0">
                {(['TILL_DATE', 'MONTHLY', 'YEARLY', 'CUSTOM'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setHistoryPeriod(p)}
                    className={`px-2 py-1 text-xs font-semibold transition-colors ${
                      historyPeriod === p
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {p === 'TILL_DATE'
                      ? 'Till Date'
                      : p === 'MONTHLY'
                        ? 'Monthly'
                        : p === 'YEARLY'
                          ? 'Yearly'
                          : 'Custom'}
                  </button>
                ))}
              </div>
              {historyPeriod === 'CUSTOM' && (
                <>
                  <Input
                    type="date"
                    value={historyStartDate}
                    onChange={e => setHistoryStartDate(e.target.value)}
                    inputSize="sm"
                    fullWidth={false}
                    className="w-[125px] shrink-0"
                    placeholder="From Date"
                  />
                  <Input
                    type="date"
                    value={historyEndDate}
                    onChange={e => setHistoryEndDate(e.target.value)}
                    inputSize="sm"
                    fullWidth={false}
                    className="w-[125px] shrink-0"
                    placeholder="To Date"
                  />
                </>
              )}
              <Button
                size="sm"
                variant="secondary"
                onClick={handleExportPdf}
                leftIcon={<FileDown size={16} />}
                title="Download History PDF"
              >
                Export
              </Button>
            </div>
          }
        />
      </div>
    </div>
  );
};

export default ProductTransactionHistory;
