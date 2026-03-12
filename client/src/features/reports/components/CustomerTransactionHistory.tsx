import React, { useEffect, useState, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Button, Input, Modal, Select } from '@/components/ui';
import { FileDown, Pencil } from 'lucide-react';
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
  referenceId: number; // Needed for update
  referenceNo?: string;
  paymentMode?: string;
}

const CustomerTransactionHistory: React.FC<CustomerTransactionHistoryProps> = ({
  customerId,
  customerName,
}) => {
  const [data, setData] = useState<LedgerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LedgerItem | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editPaymentMode, setEditPaymentMode] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

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

  const handleEditClick = (item: LedgerItem) => {
    setEditingItem(item);
    setEditAmount(item.credit || '');
    // Extract payment mode from description if possible, or assume 'CASH' if not found/available
    const modeMatch = item.description.match(/\((.*?)\)/);
    setEditPaymentMode(modeMatch ? modeMatch[1] : 'CASH');
    setIsEditModalOpen(true);
  };

  const handleUpdatePayment = async () => {
    if (!editingItem) return;

    try {
      setIsUpdating(true);
      // Construct payload - keeping date same for simplicity or add date picker if needed
      const payload = {
        customerId,
        amount: parseFloat(editAmount),
        paymentMode: editPaymentMode,
        // paymentDate: editingItem.transactionDate // Optional: Allow date edit? Plan said amount/mode.
      };

      const res = await paymentApi.update(editingItem.referenceId, payload);
      if (res.data && res.data.success) {
        showToast.success('Payment updated successfully');
        setIsEditModalOpen(false);
        fetchHistory(); // Refresh list
        window.location.reload(); // Hard reload to refresh parent balance - easier than lifting state up right now
      } else {
        showToast.error('Failed to update payment');
      }
    } catch (error) {
      console.error('Update failed', error);
      showToast.error('Failed to update payment');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleExportPdf = () => {
    if (data.length === 0) {
      showToast.error('No data to export');
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Transaction History: ${customerName}`, 14, 20);

    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
    if (fromDate) doc.text(`From: ${fromDate}`, 14, 36);
    if (toDate) doc.text(`To: ${toDate}`, 14, 42);

    const tableColumn = ['Date', 'Type', 'Description', 'Debit (Bill)', 'Credit (Pay)', 'Balance'];
    const tableRows = data.map(item => [
      format(new Date(item.transactionDate), 'dd/MM/yyyy'),
      item.type,
      item.description,
      item.debit ? Number(item.debit).toFixed(2) : '-',
      item.credit ? Number(item.credit).toFixed(2) : '-',
      Number(item.balance).toFixed(2),
    ]);

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

  const columns = useMemo<ColumnDef<LedgerItem>[]>(
    () => [
      {
        accessorKey: 'transactionDate',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
        cell: ({ row }) => format(new Date(row.original.transactionDate), 'dd/MM/yyyy'),
      },
      {
        accessorKey: 'type',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
        cell: ({ row }) => (
          <span
            className={`px-2 py-0.5 rounded text-xs font-semibold ${
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
          <div>
            <div className="text-sm text-[var(--text-primary)]">{row.original.description}</div>
            {row.original.referenceNo && (
              <div className="text-xs text-[var(--text-secondary)]">
                Ref: {row.original.referenceNo}
              </div>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'debit',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Debit" />,
        cell: ({ row }) => (
          <div className="font-medium text-orange-600">
            {Number(row.original.debit) > 0 ? Number(row.original.debit).toFixed(2) : '-'}
          </div>
        ),
      },
      {
        accessorKey: 'credit',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Credit" />,
        cell: ({ row }) => (
          <div className="font-medium text-green-600">
            {Number(row.original.credit) > 0 ? Number(row.original.credit).toFixed(2) : '-'}
          </div>
        ),
      },
      {
        accessorKey: 'balance',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Balance" />,
        cell: ({ row }) => (
          <div className="font-bold text-blue-700">{Number(row.original.balance).toFixed(2)}</div>
        ),
      },
      {
        id: 'actions',
        header: 'Action',
        cell: ({ row }) => {
          const item = row.original;
          // Only allow editing payments for now
          if (item.type?.toUpperCase() === 'PAYMENT' && item.referenceId) {
            return (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleEditClick(item)}
                title="Edit Payment"
              >
                <Pencil size={14} className="text-gray-500 hover:text-blue-600" />
              </Button>
            );
          }
          return null;
        },
      },
    ],
    [handleEditClick]
  );

  if (isLoading) {
    return <div className="p-4 text-center text-sm text-gray-500">Loading ledger...</div>;
  }

  if (data.length === 0) {
    return <div className="p-4 text-center text-sm text-gray-500">No transactions found.</div>;
  }

  return (
    <>
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
            data={data}
            showToolbar={true}
            showPagination={true}
            defaultPageSize={10}
            searchPlaceholder="Search ledger..."
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

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Payment"
      >
        <div className="space-y-4">
          <Input
            label="Amount"
            type="number"
            value={editAmount}
            onChange={e => setEditAmount(e.target.value)}
          />
          <Select
            label="Payment Mode"
            value={editPaymentMode}
            onChange={e => setEditPaymentMode(e.target.value)}
            options={[
              { label: 'Cash', value: 'CASH' },
              { label: 'UPI', value: 'UPI' },
              { label: 'Bank Transfer', value: 'BANK' },
              { label: 'Cheque', value: 'CHEQUE' },
            ]}
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleUpdatePayment} isLoading={isUpdating}>
              Update
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default CustomerTransactionHistory;
