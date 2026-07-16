import React, { useEffect, useState, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/common';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Button, Badge, SearchableSelect } from '@/components/ui';
import { reportsApi } from '../api/reportsApi';
import { StockReportItem } from '../types';
import { FileDown, AlertTriangle } from 'lucide-react';
import { showToast } from '@/utils/toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPdfFooter, addPdfHeader } from '@/utils/pdfUtils';
import { companyApi } from '@/features/company/api/companyApi';
import { CompanyInfo } from '@/features/company/types';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const LowStockReport = () => {
  const [data, setData] = useState<StockReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [productTypeFilter, setProductTypeFilter] = useState<string>('All');
  const [productFilter, setProductFilter] = useState<string>('');
  const [chartLimit, setChartLimit] = useState<number>(10);

  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);

  useEffect(() => {
    fetchData();
    companyApi.get().then(res => setCompanyInfo(res.data.data)).catch(console.error);
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      // No date filters required for low stock snapshot
      const result = await reportsApi.getStockReport();
      setData(result || []);
    } catch (error) {
      console.error('Failed to fetch stock report:', error);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Only consider LOW STOCK items for everything in this page
  const lowStockData = useMemo(() => {
    return data.filter(item => item.availableQuantity < item.minStockLevel);
  }, [data]);

  // Get unique products for filter, filtered by selected type, FROM LOW STOCKDATA
  const productOptions = useMemo(() => {
    let sourceData = lowStockData;
    if (productTypeFilter !== 'All') {
      sourceData = lowStockData.filter(item => item.productType === productTypeFilter);
    }

    const products = new Set<string>();
    sourceData.forEach(item => products.add(item.productName));
    const sortedProducts = Array.from(products).sort();

    return sortedProducts.map(p => ({ id: p, label: p, value: p }));
  }, [lowStockData, productTypeFilter]);

  useEffect(() => {
    // Reset product filter when type changes if current product isn't in new list
    if (productFilter && !productOptions.find(opt => opt.value === productFilter)) {
      setProductFilter('');
    }
  }, [productTypeFilter, productOptions, productFilter]);

  // Filter data based on product type and product name
  const filteredData = useMemo(() => {
    let result = lowStockData;

    if (productTypeFilter !== 'All') {
      result = result.filter(item => item.productType === productTypeFilter);
    }

    if (productFilter) {
      result = result.filter(item => item.productName === productFilter);
    }

    return result;
  }, [lowStockData, productTypeFilter, productFilter]);

  const handleExport = () => {
    if (filteredData.length === 0) {
      showToast.error('No data to export');
      return;
    }

    const doc = new jsPDF('landscape');

    const startY = addPdfHeader(doc, companyInfo, 'Low Stock Report');

    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, startY + 10);
    if (productTypeFilter !== 'All') {
      doc.text(`Product Type: ${productTypeFilter}`, 14, startY + 16);
    }

    const tableColumn = [
      'Product Name',
      'Type',
      'Available Qty',
      'Reserved Qty',
      'Min Stock Level',
      'Selling Price',
      'Status',
    ];

    const tableRows = filteredData.map(item => [
      item.productName,
      item.productType,
      item.availableQuantity.toString(),
      item.reservedQuantity.toString(),
      item.minStockLevel.toString(),
      `Rs. ${Number(item.sellingPrice).toFixed(2)}`,
      item.isActive ? 'Active' : 'Inactive',
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: productTypeFilter !== 'All' ? startY + 22 : startY + 16,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [239, 68, 68] }, // Red for low stock report
    });

    addPdfFooter(doc);

    doc.save(`low_stock_report_${new Date().toISOString().split('T')[0]}.pdf`);
    showToast.success('Report exported successfully');
  };

  const handleExportCsv = () => {
    if (filteredData.length === 0) {
      showToast.error('No data to export');
      return;
    }

    const csvHeaders = [
      'Product Name',
      'Type',
      'Available Qty',
      'Reserved Qty',
      'Min Stock Level',
      'Selling Price',
      'Status',
    ];

    const csvRows = filteredData.map(item => [
      item.productName,
      item.productType,
      item.availableQuantity,
      item.reservedQuantity,
      item.minStockLevel,
      Number(item.sellingPrice).toFixed(2),
      item.isActive ? 'Active' : 'Inactive',
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `low_stock_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast.success('CSV exported successfully');
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const totalLowStock = filteredData.length;
    const totalShortage = filteredData.reduce(
      (sum, item) => sum + (item.minStockLevel - item.availableQuantity),
      0
    );

    return { totalLowStock, totalShortage };
  }, [filteredData]);

  // Generate colors for charts
  const generateColors = (count: number) => {
    const colors = [
      { bg: 'rgba(248, 113, 113, 0.8)', border: 'rgb(239, 68, 68)' }, // Red
      { bg: 'rgba(251, 146, 60, 0.8)', border: 'rgb(249, 115, 22)' }, // Orange
      { bg: 'rgba(251, 191, 36, 0.8)', border: 'rgb(234, 179, 8)' }, // Yellow
      { bg: 'rgba(196, 181, 253, 0.8)', border: 'rgb(168, 85, 247)' }, // Purple
      { bg: 'rgba(96, 165, 250, 0.8)', border: 'rgb(59, 130, 246)' }, // Blue
    ];
    // Cycle through colors if needed
    return Array(count)
      .fill(null)
      .map((_, i) => colors[i % colors.length]);
  };

  // Process data for charts
  const chartData = useMemo(() => {
    if (filteredData.length === 0) return null;

    const limit = chartLimit > 100 ? filteredData.length : chartLimit;

    // Highest Shortage (Min Stock - Available)
    const sortedByShortage = [...filteredData]
      .sort(
        (a, b) => b.minStockLevel - b.availableQuantity - (a.minStockLevel - a.availableQuantity)
      )
      .slice(0, limit);

    const shortageColors = generateColors(sortedByShortage.length);

    // Filter type distribution
    const typeMap = new Map<string, number>();
    filteredData.forEach(item => {
      typeMap.set(item.productType, (typeMap.get(item.productType) || 0) + 1);
    });

    const typeLabels = Array.from(typeMap.keys());
    const typeData = Array.from(typeMap.values());

    return {
      typeDistribution: {
        labels: typeLabels,
        datasets: [
          {
            label: 'Low Stock Items by Type',
            data: typeData,
            backgroundColor: [
              'rgba(248, 113, 113, 0.8)', // Red
              'rgba(251, 146, 60, 0.8)', // Orange
              'rgba(251, 191, 36, 0.8)', // Yellow
            ],
            borderColor: ['rgb(239, 68, 68)', 'rgb(249, 115, 22)', 'rgb(234, 179, 8)'],
            borderWidth: 1,
          },
        ],
      },
      barChartData: {
        labels: sortedByShortage.map(p => p.productName),
        datasets: [
          {
            label: 'Available',
            data: sortedByShortage.map(p => p.availableQuantity),
            backgroundColor: 'rgba(59, 130, 246, 0.5)',
            borderColor: 'rgb(59, 130, 246)',
            borderWidth: 1,
            stack: 'Stack 0',
          },
          {
            label: 'Shortage',
            data: sortedByShortage.map(p => p.minStockLevel - p.availableQuantity),
            backgroundColor: 'rgba(248, 113, 113, 0.5)',
            borderColor: 'rgb(239, 68, 68)',
            borderWidth: 1,
            stack: 'Stack 0',
          }
        ]
      }
    };
  }, [filteredData, chartLimit]);

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          color: 'var(--text-secondary)',
        },
      },
    },
  };

  // Define columns for DataTable
  const columns = useMemo<ColumnDef<StockReportItem>[]>(
    () => [
      {
        accessorKey: 'productName',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Product Name" />,
        cell: ({ row }) => (
          <div className="font-medium text-[var(--text-primary)]">{row.original.productName}</div>
        ),
      },
      {
        accessorKey: 'productType',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
        cell: ({ row }) => (
          <Badge
            className={`${row.original.productType === 'FG'
              ? 'bg-green-100 text-green-700 border-green-200'
              : row.original.productType === 'RM'
                ? 'bg-blue-100 text-blue-700 border-blue-200'
                : 'bg-yellow-100 text-yellow-700 border-yellow-200'
              }`}
          >
            {row.original.productType}
          </Badge>
        ),
      },
      {
        accessorKey: 'availableQuantity',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Available Qty" />,
        cell: ({ row }) => (
          <div className="text-right text-[var(--color-error)] font-bold flex items-center justify-end gap-1">
            {parseFloat(Number(row.original.availableQuantity).toFixed(2))}
            <AlertTriangle className="h-4 w-4" />
          </div>
        ),
      },
      {
        accessorKey: 'minStockLevel',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Min Stock" />,
        cell: ({ row }) => (
          <div className="text-right text-[var(--text-secondary)] font-medium">
            {row.original.minStockLevel}
          </div>
        ),
      },
      {
        id: 'shortage',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Shortage" />,
        cell: ({ row }) => {
          const shortage = row.original.minStockLevel - row.original.availableQuantity;
          return (
            <div className="text-right text-[var(--color-error)] font-bold">
              -{parseFloat(shortage.toFixed(2))}
            </div>
          );
        },
      },


      {
        accessorKey: 'isActive',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => (
          <Badge
            variant={row.original.isActive ? 'default' : 'secondary'}
            className={row.original.isActive ? 'bg-green-100 text-green-700' : ''}
          >
            {row.original.isActive ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Low Stock Report"
        description="Monitoring critical inventory levels and shortages"
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
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleExport}
              leftIcon={<FileDown size={20} />}
            >
              Export PDF
            </Button>
          </div>
        }
      />

      {/* Filters Container */}
      <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100">
        <div className="flex items-end gap-4 flex-wrap">
          {/* Product Type Tabs */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500 ml-1">Type</label>
            <div className="flex items-center gap-2">
              {(['All', 'FG', 'RM', 'PM'] as const).map(type => (
                <Button
                  key={type}
                  size="sm"
                  variant={productTypeFilter === type ? 'primary' : 'secondary'}
                  onClick={() => setProductTypeFilter(type)}
                  className={`min-w-[4rem] px-4 transition-all duration-200 ${productTypeFilter === type
                    ? 'bg-blue-600 text-white hover:bg-blue-700 border-none shadow-md'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                    }`}
                >
                  {type}
                </Button>
              ))}
            </div>
          </div>

          <div className="h-10 w-px bg-gray-300 mx-1 hidden lg:block" />

          {/* Product Dropdown */}
          <div className="flex-grow min-w-[250px]">
            <SearchableSelect
              label="Product"
              value={productFilter}
              onChange={val => setProductFilter(val || '')}
              options={productOptions}
              placeholder="Search Low Stock Product..."
              className="w-[300px]"
            />
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-4 border-l-4 border-l-red-500 bg-white shadow-sm">
            <p className="text-sm text-[var(--text-secondary)] font-medium">
              Total Low Stock Items
            </p>
            <p className="text-3xl font-bold text-[var(--color-error)] mt-1">
              {stats.totalLowStock}
            </p>
          </div>
          <div className="card p-4 border-l-4 border-l-orange-500 bg-white shadow-sm">
            <p className="text-sm text-[var(--text-secondary)] font-medium">
              Total Quantity Shortage
            </p>
            <p className="text-3xl font-bold text-[var(--color-warning)] mt-1">
              {Number(stats.totalShortage).toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Data Visualization */}
      {!isLoading && chartData && filteredData.length > 0 && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Shortage Analysis</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--text-secondary)] font-medium">Show Top:</span>
              <div className="flex bg-[var(--surface)] rounded-lg border border-[var(--border)] p-1">
                {([5, 10, 20, 'All'] as const).map(option => {
                  const limit = option === 'All' ? 10000 : option;
                  const isSelected = chartLimit === limit;
                  return (
                    <button
                      key={option}
                      onClick={() => setChartLimit(limit)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${isSelected
                        ? 'bg-blue-600 text-white'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--color-neutral-100)]'
                        }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6 bg-white shadow-sm border border-slate-200">
              <h3 className="text-center font-bold text-[var(--text-primary)] mb-4">
                Top Shortages vs Availability
              </h3>
              <div className="h-[300px]">
                <Bar
                  data={chartData.barChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                      mode: 'index',
                      intersect: false,
                    },
                    scales: {
                      x: {
                        stacked: true,
                      },
                      y: {
                        stacked: true,
                      }
                    }
                  }}
                />
              </div>
            </div>

            <div className="card p-6 bg-white shadow-sm border border-slate-200">
              <h3 className="text-center font-bold text-[var(--text-primary)] mb-4">
                Low Stock Distribution by Type
              </h3>
              <div className="h-[300px]">
                <Pie data={chartData.typeDistribution} options={pieChartOptions} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DataTable */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-[var(--text-secondary)]">Loading low stock report...</div>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filteredData}
          searchPlaceholder="Search products..."
          defaultPageSize={10}
          showToolbar={true}
          showPagination={true}
        />
      )}
    </div>
  );
};

export default LowStockReport;
