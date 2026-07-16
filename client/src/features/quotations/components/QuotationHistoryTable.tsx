import React, { useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Eye } from 'lucide-react';
import { DataTable } from '@/components/ui/data-table/DataTable';
import { Button } from '@/components/ui/Button';
import { format } from 'date-fns';

type QuotationRecord = {
  quotationId: number;
  quotationNo: string;
  quotationDate: string;
  companyName: string;
  buyerName: string;
  content: any;
  status: string;
  createdAt: string;
  updatedAt?: string;
};

interface QuotationHistoryTableProps {
  data: QuotationRecord[];
  onView: (record: QuotationRecord) => void;
}

export const QuotationHistoryTable = ({ data, onView }: QuotationHistoryTableProps) => {
  const columns = useMemo<ColumnDef<QuotationRecord>[]>(
    () => [
      {
        accessorKey: 'quotationNo',
        header: 'Quotation No',
        enableColumnFilter: true,
      },
      {
        accessorKey: 'quotationDate',
        header: 'Date',
        enableColumnFilter: true,
        cell: ({ row }) => {
          try {
            const createdDate = new Date(row.original.createdAt);
            const updatedAtStr = row.original.updatedAt;
            const updatedDate = updatedAtStr ? new Date(updatedAtStr) : null;
            const isEdited = updatedDate && (updatedDate.getTime() - createdDate.getTime() > 1000);

            return (
              <div className="flex flex-col text-sm space-y-1">
                <div>
                  <div className="text-gray-500 font-medium text-[10px] uppercase tracking-wider">Created:</div>
                  <div className="font-semibold text-gray-800">{format(createdDate, 'dd MMM yyyy')}</div>
                  <div className="text-xs text-gray-500">{format(createdDate, 'hh:mm a')}</div>
                </div>
                {isEdited && (
                  <div>
                    <div className="text-amber-500 font-medium text-[10px] uppercase tracking-wider">Edited:</div>
                    <div className="font-semibold text-amber-700">{format(updatedDate, 'dd MMM yyyy')}</div>
                    <div className="text-xs text-amber-600">{format(updatedDate, 'hh:mm a')}</div>
                  </div>
                )}
              </div>
            );
          } catch {
            return row.original.quotationDate || '-';
          }
        },
      },
      {
        accessorKey: 'buyerName',
        header: 'Buyer',
        enableColumnFilter: true,
      },
      {
        header: 'Products',
        cell: ({ row }) => {
          const items = row.original.content?.items || [];
          return (
            <div
              className="max-w-[300px] truncate"
              title={items.map((i: any) => i.description).join(', ')}
            >
              {items.map((i: any) => i.description).join(', ')}
            </div>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        enableColumnFilter: true,
        cell: ({ row }) => {
          const status = row.original.status;
          let color = 'bg-gray-100 text-gray-800';
          if (status === 'Pending') color = 'bg-orange-100 text-orange-800';
          if (status === 'Approved') color = 'bg-blue-100 text-blue-800';
          if (status === 'Received') color = 'bg-green-100 text-green-800';
          if (status === 'Converted') color = 'bg-purple-100 text-purple-800';

          return (
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${color}`}>
              {status}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const record = row.original;
          return (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onView(record)}
                title="View Quotation"
              >
                <Eye size={16} />
              </Button>
            </div>
          );
        },
      },
    ],
    [onView]
  );

  return (
    <div className="border rounded-md mt-6">
      <div className="p-4 border-b bg-gray-50 font-semibold">Quotation History</div>
      <DataTable columns={columns} data={data} searchPlaceholder="Search buyers..." />
    </div>
  );
};
