import React, { useEffect, useState, useMemo } from 'react';
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

interface ProductTransactionHistoryProps {
  productId: string;
  productType: string;
  endDate?: string;
}

const ProductTransactionHistory: React.FC<ProductTransactionHistoryProps> = ({
  productId,
  productType,
  endDate,
}) => {
  const [data, setData] = useState<ProductWiseReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState(endDate || '');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setIsLoading(true);
        const result = await reportsApi.getProductWiseReport(
          productId,
          historyStartDate || undefined,
          historyEndDate || undefined,
          productType
        );
        setData(result.transactions || []);
      } catch (error) {
        console.error('Error fetching product history:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (productId) {
      fetchHistory();
    }
  }, [productId, productType, historyStartDate, historyEndDate]);

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
    if (historyStartDate) doc.text(`From: ${historyStartDate}`, 14, 36);
    if (historyEndDate) doc.text(`To: ${historyEndDate}`, 14, 42);

    const tableColumn = ['Date', 'Details', 'Type', 'Inward', 'Outward', 'Balance'];
    const tableRows = data.map(item => [
      formatDate(item.date),
      item.type || '-',
      item.transactionType || '-',
      item.inward || '0',
      item.outward || '0',
      item.balance || '0',
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

  const columns = useMemo<ColumnDef<ProductWiseReportItem>[]>(
    () => [
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
            {row.original.inward ? row.original.inward.toFixed(2) : '-'}
          </div>
        ),
      },
      {
        accessorKey: 'outward',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Outward" />,
        cell: ({ row }) => (
          <div className="text-center font-bold text-red-600">
            {row.original.outward ? row.original.outward.toFixed(2) : '-'}
          </div>
        ),
      },
      {
        accessorKey: 'balance',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Balance" />,
        cell: ({ row }) => (
          <div className="text-center font-bold text-blue-700">
            {row.original.balance ? row.original.balance.toFixed(2) : '0'}
          </div>
        ),
      },
    ],
    []
  );

  if (isLoading) {
    return <div className="p-4 text-center text-sm text-gray-500">Loading history...</div>;
  }

  if (data.length === 0) {
    return <div className="p-4 text-center text-sm text-gray-500">No transactions found.</div>;
  }

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-4 m-2 shadow-inner">
      <h4 className="mb-3 text-sm font-semibold text-gray-700">Transaction History (Till Date)</h4>
      <div className="rounded-md border border-gray-200 bg-white">
        <DataTable
          columns={columns}
          data={data}
          showToolbar={true}
          showPagination={true}
          defaultPageSize={10}
          searchPlaceholder="Search history..."
          sorting={[{ id: 'date', desc: true }]}
          toolbarActions={
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={historyStartDate}
                onChange={e => setHistoryStartDate(e.target.value)}
                inputSize="sm"
                className="w-[130px]"
                placeholder="From Date"
              />
              <Input
                type="date"
                value={historyEndDate}
                onChange={e => setHistoryEndDate(e.target.value)}
                inputSize="sm"
                className="w-[130px]"
                placeholder="To Date"
              />
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
