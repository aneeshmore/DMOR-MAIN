import React, { useEffect, useState, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/common';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Button, Input } from '@/components/ui';
import { reportsApi } from '../api/reportsApi';
import { DispatchReportItem, DispatchManifestItem } from '../types';
import { FileDown, Truck, Package, Weight, ShieldCheck, Users } from 'lucide-react';
import { showToast } from '@/utils/toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPdfFooter, addPdfHeader } from '@/utils/pdfUtils';
import { companyApi } from '@/features/company/api/companyApi';
import { CompanyInfo } from '@/features/company/types';

// ---------------------------------------------------------------------------
// Available Capacity
//
// Available Capacity = vehicle capacity (Tons) − loaded weight (Kg), computed
// in kilograms. Vehicle capacity is stored in Tons and loaded weight in Kg
// (see DispatchReportItem), so capacity is normalised to Kg before subtracting.
//
// One helper backs the on-screen detail, the PDF export and the CSV export, so
// all three can never diverge. It is a pure, dynamic calculation over values
// the report already has — nothing is stored, and no API field is added.
// ---------------------------------------------------------------------------

// Returns the available capacity in Kg, or null when it cannot be computed
// (capacity missing/invalid). Loaded weight of 0 is valid and yields the full
// vehicle capacity.
const computeAvailableKg = (capacityTons: number | null, loadedWeightKg: number): number | null => {
  if (
    capacityTons == null ||
    Number.isNaN(capacityTons) ||
    loadedWeightKg == null ||
    Number.isNaN(loadedWeightKg)
  ) {
    return null;
  }
  return capacityTons * 1000 - loadedWeightKg;
};

// Text form for PDF/CSV. Screen rendering uses computeAvailableKg directly so
// it can apply DMOR's warning style to the overloaded case.
const formatAvailableCapacity = (availableKg: number | null): string => {
  if (availableKg == null) return '—';
  if (availableKg < 0) return `Overloaded by ${Math.abs(availableKg).toFixed(2)} Kg`;
  // Both units derive from the same availableKg; Tons primary, Kg in parentheses.
  return `${(availableKg / 1000).toFixed(2)} Tons (${availableKg.toFixed(2)} Kg)`;
};

const DispatchReport = () => {
  const [data, setData] = useState<DispatchReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);

  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  });

  useEffect(() => {
    companyApi
      .get()
      .then(res => setCompanyInfo(res.data.data))
      .catch(() => setCompanyInfo(null));
  }, []);

  useEffect(() => {
    fetchData(startDate, endDate);
  }, [startDate, endDate]);

  const fetchData = async (start?: string, end?: string) => {
    try {
      setIsLoading(true);
      const result = await reportsApi.getDispatchReport(start, end);
      setData(result || []);
    } catch {
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const handleExport = () => {
    if (data.length === 0) {
      showToast.error('No data to export');
      return;
    }

    const doc = new jsPDF('landscape');
    const startY = addPdfHeader(doc, companyInfo, 'Dispatch Report');

    doc.setFontSize(10);
    let subtitle = `Generated on: ${new Date().toLocaleString()}`;
    if (startDate) subtitle += ` | From: ${startDate}`;
    if (endDate) subtitle += ` | To: ${endDate}`;
    doc.text(subtitle, 14, startY + 2);

    const tableColumn = [
      'Date',
      'Dispatch No',
      'Vehicle',
      'Driver',
      'Manifest Details (Customer | Order | Product | Qty)',
      'Total Qty',
      'Loaded Weight',
      'Capacity',
      'Available Capacity',
      'Remarks',
    ];

    const tableRows = data.map(item => {
      const manifestStr = (item.dispatchManifest || [])
        .map(
          (m: DispatchManifestItem) =>
            `• ${m.customerName?.substring(0, 15) || 'Unknown'} | ${m.orderNumber || '-'} | ${
              m.productName || '-'
            } (${m.quantity || 0})`
        )
        .join('\n');

      return [
        formatDate(item.dispatchDate),
        item.dispatchNo,
        item.vehicleNumber,
        item.driverName,
        manifestStr || 'No manifest details',
        item.totalQuantity,
        `${item.loadedWeight.toFixed(2)} Kg`,
        item.vehicleCapacity != null
          ? `${parseFloat(item.vehicleCapacity.toFixed(2))} Tons`
          : 'N/A',
        formatAvailableCapacity(computeAvailableKg(item.vehicleCapacity, item.loadedWeight)),
        item.remarks || '-',
      ];
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: startY + 7,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
      columnStyles: {
        4: { cellWidth: 100 },
        // Remarks moved from index 8 to 9 after the Available Capacity column
        // was inserted; keeps its original fixed width.
        9: { cellWidth: 35 },
      },
    });

    addPdfFooter(doc);
    doc.save(`dispatch_report_${new Date().toISOString().split('T')[0]}.pdf`);
    showToast.success('Report exported successfully');
  };

  const handleExportCsv = () => {
    if (data.length === 0) {
      showToast.error('No data to export');
      return;
    }

    const csvHeaders = [
      'Date',
      'Dispatch No',
      'Vehicle Number',
      'Driver Name',
      'Order Numbers',
      'Customers',
      'Products',
      'Total Qty',
      'Loaded Weight',
      'Vehicle Capacity',
      'Available Capacity',
      'Remarks',
    ];

    const csvRows = data.map(item => [
      formatDate(item.dispatchDate),
      item.dispatchNo,
      item.vehicleNumber,
      item.driverName,
      item.orderNumbers.join('\n'),
      item.customers.join('\n'),
      item.products.join('\n'),
      item.totalQuantity.toString(),
      `${item.loadedWeight.toFixed(2)} Kg`,
      item.vehicleCapacity != null ? `${parseFloat(item.vehicleCapacity.toFixed(2))} Tons` : 'N/A',
      formatAvailableCapacity(computeAvailableKg(item.vehicleCapacity, item.loadedWeight)),
      item.remarks,
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell || ''}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `dispatch_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast.success('CSV exported successfully');
  };

  const stats = useMemo(() => {
    const totalDispatches = data.length;
    const totalOrders = data.reduce((sum, item) => sum + (item.orderNumbers?.length || 0), 0);
    const totalCustomers = new Set(data.flatMap(d => d.customers)).size;
    const totalLoadedWeight = data.reduce((sum, item) => sum + item.loadedWeight, 0);
    const activeVehicles = new Set(
      data.filter(d => d.vehicleNumber && d.vehicleNumber !== '-').map(d => d.vehicleNumber)
    ).size;

    return { totalDispatches, totalOrders, totalCustomers, totalLoadedWeight, activeVehicles };
  }, [data]);

  const columns = useMemo<ColumnDef<DispatchReportItem>[]>(
    () => [
      {
        accessorKey: 'dispatchDate',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
        cell: ({ row }) => (
          <div className="whitespace-nowrap">{formatDate(row.original.dispatchDate)}</div>
        ),
      },
      {
        accessorKey: 'dispatchNo',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Dispatch No" />,
        cell: ({ row }) => <div className="font-medium">{row.original.dispatchNo}</div>,
      },
      {
        accessorKey: 'vehicleNumber',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Vehicle" />,
        cell: ({ row }) => <div>{row.original.vehicleNumber}</div>,
      },
      {
        accessorKey: 'driverName',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Driver" />,
        cell: ({ row }) => <div>{row.original.driverName}</div>,
      },
      {
        accessorKey: 'orderNumbers',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Orders" />,
        cell: ({ row }) => (
          <div className="font-medium text-center whitespace-nowrap">
            {row.original.orderNumbers?.length || 0} Orders
          </div>
        ),
      },
      {
        accessorKey: 'customers',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Customers" />,
        cell: ({ row }) => (
          <div className="font-medium text-center whitespace-nowrap">
            {row.original.customers?.length || 0} Customers
          </div>
        ),
      },
      {
        accessorKey: 'products',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Products" />,
        cell: ({ row }) => (
          <div className="font-medium text-center whitespace-nowrap">
            {row.original.products?.length || 0} Products
          </div>
        ),
      },
      {
        accessorKey: 'totalQuantity',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Total Qty" />,
        cell: ({ row }) => (
          <div className="text-right font-semibold">{row.original.totalQuantity}</div>
        ),
      },
      {
        accessorKey: 'loadedWeight',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Loaded Weight" />,
        cell: ({ row }) => {
          const loadedWeight = row.original.loadedWeight;
          const capacityTons = row.original.vehicleCapacity;

          let badgeStatus = 'Capacity Unknown';
          let badgeColor = 'bg-gray-100 text-gray-700';

          if (capacityTons != null && capacityTons > 0) {
            const capacityKg = capacityTons * 1000;
            if (loadedWeight <= capacityKg) {
              badgeStatus = 'Under Load';
              badgeColor = 'bg-green-100 text-green-700';
            } else {
              badgeStatus = 'Over Load';
              badgeColor = 'bg-red-100 text-red-700';
            }
          }

          return (
            <div className="flex flex-col items-end whitespace-nowrap gap-1.5 pt-1">
              <span className="font-medium text-sm">{parseFloat(loadedWeight.toFixed(2))} Kg</span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${badgeColor}`}
              >
                <Truck size={12} strokeWidth={2.5} />
                {badgeStatus}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'vehicleCapacity',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Vehicle Capacity" className="-mx-2" />
        ),
        cell: ({ row }) => (
          <div className="text-right text-gray-500 -mx-2 whitespace-nowrap">
            {row.original.vehicleCapacity != null
              ? `${parseFloat(row.original.vehicleCapacity.toFixed(2))} Tons`
              : 'N/A'}
          </div>
        ),
      },
      {
        accessorKey: 'remarks',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Remarks" />,
        cell: ({ row }) => (
          <div className="max-w-[150px] truncate" title={row.original.remarks}>
            {row.original.remarks}
          </div>
        ),
      },
    ],
    []
  );

  const renderExpandedDetails = React.useMemo(() => {
    const ExpandedDetails = ({
      row,
    }: {
      row: import('@tanstack/react-table').Row<DispatchReportItem>;
    }) => {
      const item = row.original;
      const manifest = item.dispatchManifest || [];

      // Group by Customer -> Order -> Product lines (name + quantity)
      const groupedData: Record<
        string,
        Record<string, { name: string; quantity: number | null }[]>
      > = {};
      manifest.forEach((m: DispatchManifestItem) => {
        const customer = m.customerName || 'Unknown Customer';
        const order = m.orderNumber || 'Unknown Order';
        const product = m.productName || 'Unknown Product';
        const quantity =
          m.quantity != null && !Number.isNaN(Number(m.quantity)) ? Number(m.quantity) : null;

        if (!groupedData[customer]) groupedData[customer] = {};
        if (!groupedData[customer][order]) groupedData[customer][order] = [];
        if (
          !groupedData[customer][order].some(p => p.name === product && p.quantity === quantity)
        ) {
          groupedData[customer][order].push({ name: product, quantity });
        }
      });

      return (
        <div className="bg-[var(--surface-alt)] border-t border-[var(--border)] p-6 shadow-inner w-full">
          {/* Section A — Dispatch Summary */}
          <div className="mb-6">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 bg-[var(--surface)] px-5 py-3 rounded-md border border-[var(--border)] shadow-sm">
              <div className="flex flex-col">
                <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold">
                  Vehicle
                </span>
                <span className="font-semibold text-[var(--text-primary)] text-sm">
                  {item.vehicleNumber}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold">
                  Driver
                </span>
                <span className="font-medium text-[var(--text-primary)] text-sm">
                  {item.driverName}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold">
                  Dispatch No
                </span>
                <span className="font-medium text-[var(--text-primary)] text-sm">
                  {item.dispatchNo}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold">
                  Capacity
                </span>
                <span className="font-medium text-[var(--text-primary)] text-sm">
                  {item.vehicleCapacity != null
                    ? `${parseFloat(item.vehicleCapacity.toFixed(2))} Tons`
                    : 'N/A'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold">
                  Loaded Weight
                </span>
                <span className="font-medium text-[var(--text-primary)] text-sm">
                  {parseFloat(item.loadedWeight.toFixed(2))} Kg
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold">
                  Available Capacity
                </span>
                {(() => {
                  const availableKg = computeAvailableKg(item.vehicleCapacity, item.loadedWeight);
                  if (availableKg == null) {
                    return (
                      <span className="font-medium text-[var(--text-primary)] text-sm">—</span>
                    );
                  }
                  if (availableKg < 0) {
                    return (
                      <span className="font-semibold text-red-700 text-sm">
                        Overloaded by {Math.abs(availableKg).toFixed(2)} Kg
                      </span>
                    );
                  }
                  return (
                    <span className="font-medium text-[var(--text-primary)] text-sm">
                      {(availableKg / 1000).toFixed(2)} Tons ({availableKg.toFixed(2)} Kg)
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Section B — Customer Manifest */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface-alt)]">
              <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Customer Manifest
              </h4>
            </div>
            <table className="w-auto text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-alt)]/30 text-[var(--text-secondary)] text-xs font-medium">
                  <th className="px-4 py-2 whitespace-nowrap border-r border-[var(--border)]/50">
                    Customer
                  </th>
                  <th className="px-4 py-2 whitespace-nowrap border-r border-[var(--border)]/50">
                    Order Number
                  </th>
                  <th className="px-4 py-2 whitespace-nowrap border-r border-[var(--border)]/50">
                    Products
                  </th>
                  <th className="px-4 py-2 whitespace-nowrap">Product Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {Object.entries(groupedData).map(([customerName, orderGroups]) => {
                  const orderEntries = Object.entries(orderGroups);
                  // One <tr> per product line; Customer/Order cells span their lines
                  const customerRowCount = orderEntries.reduce(
                    (sum, [, productLines]) => sum + Math.max(productLines.length, 1),
                    0
                  );
                  let isFirstRowOfCustomer = true;
                  return orderEntries.flatMap(([orderNumber, productLines]) => {
                    const lines =
                      productLines.length > 0 ? productLines : [{ name: '-', quantity: null }];
                    return lines.map((product, pIdx) => {
                      const showCustomer = isFirstRowOfCustomer && pIdx === 0;
                      if (showCustomer) isFirstRowOfCustomer = false;
                      return (
                        <tr
                          key={`${customerName}-${orderNumber}-${pIdx}`}
                          className="hover:bg-[var(--surface-alt)]/40 transition-colors"
                        >
                          {showCustomer && (
                            <td
                              className="px-4 py-1.5 align-top font-semibold text-[var(--text-primary)] border-r border-[var(--border)]/50"
                              rowSpan={customerRowCount}
                            >
                              {customerName}
                            </td>
                          )}
                          {pIdx === 0 && (
                            <td
                              className="px-4 py-1.5 align-top font-medium text-blue-600 border-r border-[var(--border)]/50"
                              rowSpan={lines.length}
                            >
                              {orderNumber}
                            </td>
                          )}
                          <td className="px-4 py-1.5 border-r border-[var(--border)]/50">
                            <span className="text-[13px] text-[var(--text-primary)] flex items-start gap-2 max-w-[420px]">
                              <span className="text-gray-400 mt-[5px] font-bold text-[7px]">●</span>
                              <span>{product.name}</span>
                            </span>
                          </td>
                          <td className="px-4 py-1.5 text-[13px] text-[var(--text-primary)]">
                            {product.quantity != null ? product.quantity : '-'}
                          </td>
                        </tr>
                      );
                    });
                  });
                })}
                {Object.keys(groupedData).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-center text-[var(--text-secondary)]">
                      No dispatch manifest items found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    };
    ExpandedDetails.displayName = 'ExpandedDetails';
    return ExpandedDetails;
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader metadataPath="/reports/dispatch"
        title="Dispatch Report"
        description="Track vehicle dispatches and loaded weights."
        actions={
          <div className="flex gap-2">
            <Button
              variant="primary"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleExportCsv}
              leftIcon={<FileDown size={20} />}
            >
              Export CSV
            </Button>
            <Button
              variant="primary"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleExport}
              leftIcon={<FileDown size={20} />}
            >
              Export PDF
            </Button>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row sm:justify-end items-stretch sm:items-center gap-4 bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
        <span className="text-sm font-medium text-gray-500">Date Range:</span>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            inputSize="sm"
            fullWidth={true}
            className="flex-1 sm:w-auto min-w-[150px]"
          />
          <span className="text-gray-400">-</span>
          <Input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            inputSize="sm"
            fullWidth={true}
            className="flex-1 sm:w-auto min-w-[150px]"
          />
        </div>
      </div>

      {!isLoading && data.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          <div className="card p-4">
            <p className="text-sm text-[var(--text-secondary)] font-medium flex items-center gap-2">
              <Truck size={16} /> Total Dispatches
            </p>
            <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">
              {stats.totalDispatches}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-[var(--text-secondary)] font-medium flex items-center gap-2">
              <ShieldCheck size={16} /> Active Vehicles
            </p>
            <p className="text-2xl font-bold text-[var(--color-info)] mt-1">
              {stats.activeVehicles}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-[var(--text-secondary)] font-medium flex items-center gap-2">
              <Package size={16} /> Total Orders
            </p>
            <p className="text-2xl font-bold text-[var(--color-primary-600)] mt-1">
              {stats.totalOrders}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-[var(--text-secondary)] font-medium flex items-center gap-2">
              <Users size={16} /> Total Customers
            </p>
            <p className="text-2xl font-bold text-[var(--color-warning)] mt-1">
              {stats.totalCustomers}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-[var(--text-secondary)] font-medium flex items-center gap-2">
              <Weight size={16} /> Total Loaded Weight
            </p>
            <p className="text-2xl font-bold text-[var(--color-success)] mt-1">
              {parseFloat(stats.totalLoadedWeight.toFixed(2))} Kg
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-[var(--text-secondary)]">Loading dispatch report...</div>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data}
          searchPlaceholder="Search vehicles, customers, orders..."
          defaultPageSize={10}
          showToolbar={true}
          showPagination={true}
          getRowCanExpand={() => true}
          renderSubComponent={renderExpandedDetails}
        />
      )}
    </div>
  );
};

export default DispatchReport;
