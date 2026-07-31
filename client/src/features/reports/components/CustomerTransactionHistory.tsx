import React, { useEffect, useState, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Button, Input } from '@/components/ui';
import { FileDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { paymentApi } from '@/features/operations/api/paymentApi';
import { showToast } from '@/utils/toast';
import { addPdfFooter } from '@/utils/pdfUtils';
import { format } from 'date-fns';

interface CustomerTransactionHistoryProps {
  customerId: number;
  customerName: string;
}

interface LedgerItem {
  transactionId: number;
  transactionDate: string;
  type: string;
  description: string;
  debit: string;
  credit: string;
  balance: string;
  referenceId: number;
  referenceNo?: string;
  paymentMode?: string;
}

// A cancelled/split order's INVOICE row is zeroed in place rather than replaced with a
// new row (see PaymentRepository.reverseOrderInvoiceIfExists) - the original amount is
// preserved as a "(was 1234.56)" marker appended to the description so it can still be
// shown (struck through) next to the new 0.00, instead of silently vanishing.
const VOIDED_AMOUNT_PATTERN = /\s*\(was ([\d.]+)\)\s*$/;
const parseVoidedAmount = (description: string | undefined) => {
  const match = VOIDED_AMOUNT_PATTERN.exec(description || '');
  return match ? Number(match[1]) || 0 : null;
};
const stripVoidedAmountMarker = (description: string | undefined) =>
  (description || '').replace(VOIDED_AMOUNT_PATTERN, '');

type InvoiceStatus = 'Paid' | 'Part Payment' | 'Pending' | '-';

interface EnrichedLedgerItem extends LedgerItem {
  status: InvoiceStatus;
  days: number | null; // null renders as "-"
  pendingAmount: number | null; // null renders as "-"
}

/**
 * FIFO Settlement Engine (computed dynamically - nothing is stored).
 *
 * - Sort all transactions oldest first.
 * - Every Debit (Invoice) enters a queue with its full amount remaining.
 * - Every Credit (Payment) is applied to the OLDEST unpaid invoice first.
 *   A payment never skips an older invoice. Leftover credit (advance)
 *   is applied to future invoices as they arrive.
 * - Status / Days / Pending Amount are derived per Debit row:
 *     Paid          -> remaining = 0            (Days = "-")
 *     Part Payment  -> 0 < remaining < debit    (Days counted from invoice date)
 *     Pending       -> remaining = debit        (Days counted from invoice date)
 * - Credit rows always show "-" for Status, Days and Pending Amount.
 *
 * The Balance column and all accounting entries are untouched.
 */
const computeFifoSettlement = (
  data: LedgerItem[]
): Map<number, { status: InvoiceStatus; days: number | null; pendingAmount: number | null }> => {
  const result = new Map<
    number,
    { status: InvoiceStatus; days: number | null; pendingAmount: number | null }
  >();

  // Oldest first; tie-break with transactionId to keep a stable order
  const sorted = [...data].sort((a, b) => {
    const diff = new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime();
    return diff !== 0 ? diff : (a.transactionId || 0) - (b.transactionId || 0);
  });

  // FIFO queue of unpaid/partially paid invoices
  const invoiceQueue: { transactionId: number; remaining: number }[] = [];
  const invoiceTotals = new Map<number, number>(); // transactionId -> original debit
  let creditPool = 0; // unapplied credit (advance payments)

  const settle = () => {
    while (creditPool > 0 && invoiceQueue.length > 0) {
      const oldest = invoiceQueue[0];
      const applied = Math.min(oldest.remaining, creditPool);
      oldest.remaining -= applied;
      creditPool -= applied;
      if (oldest.remaining <= 0) {
        invoiceQueue.shift(); // fully settled, move to next oldest
      }
    }
  };

  const remainingById = new Map<number, { remaining: number }>();

  sorted.forEach(item => {
    const debit = Number(item.debit) || 0;
    const credit = Number(item.credit) || 0;

    if (debit > 0) {
      const entry = { transactionId: item.transactionId, remaining: debit };
      invoiceQueue.push(entry);
      invoiceTotals.set(item.transactionId, debit);
      remainingById.set(item.transactionId, entry);
      settle(); // an advance credit may settle this invoice immediately
    } else if (credit > 0) {
      creditPool += credit;
      settle();
    }
  });

  const now = new Date();
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  sorted.forEach(item => {
    const debit = Number(item.debit) || 0;

    if (debit > 0) {
      const total = invoiceTotals.get(item.transactionId) ?? debit;
      const remaining = remainingById.get(item.transactionId)?.remaining ?? 0;

      let status: InvoiceStatus;
      if (remaining <= 0) status = 'Paid';
      else if (remaining < total) status = 'Part Payment';
      else status = 'Pending';

      const days =
        status === 'Paid'
          ? null // fully settled - no day count
          : Math.max(
              0,
              Math.floor((now.getTime() - new Date(item.transactionDate).getTime()) / MS_PER_DAY)
            );

      result.set(item.transactionId, {
        status,
        days,
        pendingAmount: Math.max(0, remaining),
      });
    } else {
      // Credit / Payment rows (and zero rows): no status of their own
      result.set(item.transactionId, { status: '-', days: null, pendingAmount: null });
    }
  });

  return result;
};

const CustomerTransactionHistory: React.FC<CustomerTransactionHistoryProps> = ({
  customerId,
  customerName,
}) => {
  const [data, setData] = useState<LedgerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      const res = await paymentApi.getLedger(customerId);
      let ledgerData: LedgerItem[] = Array.isArray(res.data) ? res.data : res.data?.data || [];

      if (fromDate) {
        ledgerData = ledgerData.filter(
          item => new Date(item.transactionDate) >= new Date(fromDate)
        );
      }
      if (toDate) {
        ledgerData = ledgerData.filter(item => new Date(item.transactionDate) <= new Date(toDate));
      }

      setData(ledgerData);
    } catch (error) {
      console.error('Error fetching customer ledger:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (customerId) {
      fetchHistory();
    }
  }, [customerId, fromDate, toDate]);

  // Enrich ledger rows with FIFO-derived Status / Days / Pending Amount
  const enrichedData = useMemo<EnrichedLedgerItem[]>(() => {
    const fifo = computeFifoSettlement(data);
    return data.map(item => {
      const derived = fifo.get(item.transactionId) ?? {
        status: '-' as InvoiceStatus,
        days: null,
        pendingAmount: null,
      };
      return { ...item, ...derived };
    });
  }, [data]);

  const handleExportPdf = () => {
    if (enrichedData.length === 0) {
      showToast.error('No data to export');
      return;
    }

    const doc = new jsPDF('landscape');
    doc.setFontSize(16);
    doc.text(`Transaction History: ${customerName}`, 14, 20);

    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
    if (fromDate) doc.text(`From: ${fromDate}`, 14, 36);
    if (toDate) doc.text(`To: ${toDate}`, 14, 42);

    const tableColumn = [
      'Date',
      'Type',
      'Description',
      'Reference No.',
      'Debit (Bill)',
      'Pending Amount',
      'Credit (Pay)',
      'Balance',
      'Status',
      'Days',
    ];
    const tableRows = enrichedData.map(item => {
      const voidedAmount = parseVoidedAmount(item.description);
      const debitCell =
        voidedAmount !== null
          ? `${voidedAmount.toFixed(2)} -> ${Number(item.debit).toFixed(2)}`
          : item.type === 'INVOICE' || Number(item.debit) > 0
            ? Number(item.debit).toFixed(2)
            : '-';
      return [
        format(new Date(item.transactionDate), 'dd/MM/yyyy'),
        item.type,
        stripVoidedAmountMarker(item.description),
        item.referenceNo || '-',
        debitCell,
        item.pendingAmount !== null ? item.pendingAmount.toFixed(2) : '-',
        Number(item.credit) > 0 ? Number(item.credit).toFixed(2) : '-',
        Number(item.balance).toFixed(2),
        item.status,
        item.days !== null ? `${item.days} ${item.days === 1 ? 'day' : 'days'}` : '-',
      ];
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 50,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [71, 85, 105] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    addPdfFooter(doc);
    doc.save(
      `ledger_${customerName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
    );
    showToast.success('Ledger exported successfully');
  };

  const columns = useMemo<ColumnDef<EnrichedLedgerItem>[]>(
    () => [
      {
        accessorKey: 'transactionDate',
        meta: { fitContent: true },
        header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
        cell: ({ row }) => (
          <div className="whitespace-nowrap">
            {format(new Date(row.original.transactionDate), 'dd/MM/yyyy')}
          </div>
        ),
      },
      {
        accessorKey: 'type',
        meta: { fitContent: true },
        header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
        cell: ({ row }) => (
          <span
            className={`px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${
              row.original.type === 'INVOICE' || row.original.type === 'OPENING'
                ? 'bg-orange-100 text-orange-700'
                : 'bg-green-100 text-green-700'
            }`}
          >
            {row.original.type}
          </span>
        ),
      },
      {
        accessorKey: 'description',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Description" />,
        cell: ({ row }) => (
          <div className="text-sm text-[var(--text-primary)]">
            {stripVoidedAmountMarker(row.original.description)}
          </div>
        ),
      },
      {
        accessorKey: 'referenceNo',
        meta: { fitContent: true },
        header: ({ column }) => <DataTableColumnHeader column={column} title="Reference No." />,
        cell: ({ row }) => (
          <div className="text-sm text-[var(--text-secondary)] whitespace-nowrap">
            {row.original.referenceNo ? row.original.referenceNo : '-'}
          </div>
        ),
      },
      {
        accessorKey: 'debit',
        meta: { fitContent: true },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Debit" className="justify-center" />
        ),
        cell: ({ row }) => {
          const debit = Number(row.original.debit) || 0;
          const voidedAmount = parseVoidedAmount(row.original.description);
          // A cancelled/split order's row is zeroed in place (see
          // reverseOrderInvoiceIfExists) - show the original amount struck through next
          // to the new 0.00, instead of the amount simply disappearing.
          if (voidedAmount !== null) {
            return (
              <div className="font-medium text-center whitespace-nowrap">
                <span className="line-through text-gray-400 mr-1.5">
                  {voidedAmount.toFixed(2)}
                </span>
                <span className="text-orange-600">{debit.toFixed(2)}</span>
              </div>
            );
          }
          // INVOICE rows always carry a meaningful debit, including an explicit 0 when
          // the order's obligation has been voided (cancelled/split) - show "0.00" there
          // rather than "-", so a voided order reads as "zeroed" not "no debit ever
          // existed". Other row types (PAYMENT, etc.) keep the original "-" for no debit.
          const show = row.original.type === 'INVOICE' || debit > 0;
          return (
            <div className="font-medium text-orange-600 text-center whitespace-nowrap">
              {show ? debit.toFixed(2) : '-'}
            </div>
          );
        },
      },
      {
        accessorKey: 'pendingAmount',
        meta: { fitContent: true },
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Pending Amount"
            className="justify-center"
          />
        ),
        cell: ({ row }) => {
          const pending = row.original.pendingAmount;
          if (pending === null) {
            return <div className="text-[var(--text-secondary)] text-center">-</div>;
          }
          return (
            <div
              className={`font-medium text-center whitespace-nowrap ${pending > 0 ? 'text-red-600' : 'text-green-600'}`}
            >
              {pending.toFixed(2)}
            </div>
          );
        },
      },
      {
        accessorKey: 'credit',
        meta: { fitContent: true },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Credit" className="justify-center" />
        ),
        cell: ({ row }) => (
          <div className="font-medium text-green-600 text-center whitespace-nowrap">
            {Number(row.original.credit) > 0 ? Number(row.original.credit).toFixed(2) : '-'}
          </div>
        ),
      },
      {
        accessorKey: 'balance',
        meta: { fitContent: true },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Balance" className="justify-center" />
        ),
        cell: ({ row }) => (
          <div className="font-bold text-blue-700 text-center whitespace-nowrap">
            {Number(row.original.balance).toFixed(2)}
          </div>
        ),
      },
      {
        accessorKey: 'status',
        meta: { fitContent: true },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" className="justify-center" />
        ),
        cell: ({ row }) => {
          const status = row.original.status;
          if (status === '-') {
            return <div className="text-[var(--text-secondary)] text-center">-</div>;
          }
          const styles =
            status === 'Paid'
              ? 'bg-green-100 text-green-700'
              : status === 'Part Payment'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-red-100 text-red-700';
          return (
            <div className="text-center">
              <span
                className={`inline-block px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${styles}`}
              >
                {status}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'days',
        meta: { fitContent: true },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Days" className="justify-center" />
        ),
        cell: ({ row }) => (
          <div className="text-sm text-[var(--text-primary)] text-center whitespace-nowrap">
            {row.original.days !== null
              ? `${row.original.days} ${row.original.days === 1 ? 'day' : 'days'}`
              : '-'}
          </div>
        ),
      },
    ],
    []
  );

  if (isLoading) {
    return <div className="p-4 text-center text-sm text-gray-500">Loading ledger...</div>;
  }

  if (data.length === 0) {
    return <div className="p-4 text-center text-sm text-gray-500">No transactions found.</div>;
  }

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-4 m-2 shadow-inner animate-in fade-in zoom-in-95 duration-200">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
          Transaction History - {customerName}
        </h4>
      </div>

      <div className="rounded-md border border-gray-200 bg-white">
        <DataTable
          columns={columns}
          data={enrichedData}
          showToolbar={true}
          showPagination={true}
          defaultPageSize={10}
          searchPlaceholder="Search ledger..."
          theme={{ cell: 'px-3! py-2!', headerCell: 'px-3!' }}
          initialSorting={[{ id: 'transactionDate', desc: true }]}
          toolbarActions={
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                inputSize="sm"
                className="w-[130px]"
                placeholder="From Date"
              />
              <Input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                inputSize="sm"
                className="w-[130px]"
                placeholder="To Date"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={handleExportPdf}
                leftIcon={<FileDown size={14} />}
                title="Download Ledger PDF"
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

export default CustomerTransactionHistory;
