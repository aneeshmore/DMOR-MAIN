import React, { useEffect, useState, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/common';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Button, Badge, Input, SearchableSelect } from '@/components/ui';
import { reportsApi } from '../api/reportsApi';
import { StockReportItem } from '../types';
import { FileDown, AlertTriangle, Lock } from 'lucide-react';
import { showToast } from '@/utils/toast';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPdfFooter, addPdfHeader } from '@/utils/pdfUtils';
import { formatDate, formatDateTime } from '@/utils/dateUtils';
import { CompanyInfo } from '@/features/company/types';
import { companyApi } from '@/features/company/api/companyApi';
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
import { Pie, Line, Bar } from 'react-chartjs-2';

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

// Generate colors for charts
const generateColors = (count: number) => {
  const colors = [
    { bg: 'rgba(74, 222, 128, 0.8)', border: 'rgb(34, 197, 94)' }, // Green
    { bg: 'rgba(96, 165, 250, 0.8)', border: 'rgb(59, 130, 246)' }, // Blue
    { bg: 'rgba(251, 146, 60, 0.8)', border: 'rgb(249, 115, 22)' }, // Orange
    { bg: 'rgba(196, 181, 253, 0.8)', border: 'rgb(168, 85, 247)' }, // Purple
    { bg: 'rgba(248, 113, 113, 0.8)', border: 'rgb(239, 68, 68)' }, // Red
    { bg: 'rgba(251, 191, 36, 0.8)', border: 'rgb(234, 179, 8)' }, // Yellow
    { bg: 'rgba(103, 232, 249, 0.8)', border: 'rgb(6, 182, 212)' }, // Cyan
    { bg: 'rgba(251, 113, 133, 0.8)', border: 'rgb(236, 72, 153)' }, // Pink
  ];
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(colors[i % colors.length]);
  }
  return result;
};

const StockReport = () => {
  const [data, setData] = useState<StockReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [productTypeFilter, setProductTypeFilter] = useState<string>('All');
  const [productFilter, setProductFilter] = useState<string>('');
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);

  // Fetch Company Info
  useEffect(() => {
    const fetchCompanyInfo = async () => {
      try {
        const res = await companyApi.get();
        if (res.data) {
          setCompanyInfo((res.data as any).data || res.data);
        }
      } catch (err) {
        console.error('Failed to fetch company info', err);
      }
    };
    fetchCompanyInfo();
  }, []);
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  });
  const fetchData = React.useCallback(async (start?: string, end?: string) => {
    try {
      setIsLoading(true);
      // Pass null/undefined for type and productId initially as we filter client-side or separate request
      // But based on reportsApi, it takes type, productId, startDate, endDate
      // Here we only filter type client side? No, previously productTypeFilter is separate.
      // Let's defer filtering to the filteredData memo if we stick to fetching all,
      // OR we can pass params to API if we want server side filtering.
      // The user asked to "add date filter".
      // Let's pass the dates to the API.
      // Note: check getStockReport arguments: type?, productId?, startDate?, endDate?
      // Since productTypeFilter is client-side filtered in the 'filteredData' memo
      // (see lines 122-135 in previous context, wait, filteredData logic was:
      // const filteredData = useMemo(() => { let result = data; if (productTypeFilter !== 'All') ... })
      // So 'data' holds everything. We should keep 'data' as everything or filter on server?
      // Given the previous pattern, we fetched all and filtered locally.
      // BUT dates are usually server side filters to reduce payload.

      const result = await reportsApi.getStockReport(undefined, undefined, start, end);
      setData(result);
    } catch (error) {
      console.error('Failed to fetch stock report:', error);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(startDate, endDate);
  }, [startDate, endDate, fetchData]);

  const handleExport = () => {
    if (filteredData.length === 0) {
      showToast.error('No data to export');
      return;
    }

    const doc = new jsPDF('landscape');

    // Header
    const headerEndY = addPdfHeader(doc, companyInfo, 'Stock Report');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    doc.text(`Generated on: ${formatDateTime(new Date())}`, 14, headerEndY + 5);
    if (productTypeFilter !== 'All') {
      doc.text(`Product Type: ${productTypeFilter}`, 14, headerEndY + 10);
    }

    const tableColumn = [
      'Product Name',
      'Type',
      'Available Qty',
      'Available Weight (kg)',
      ...(productTypeFilter !== 'FG' ? ['Reserved Qty'] : []),
      'Min Stock Level',
      'Selling Price',
      'Status',
    ];

    const tableRows = filteredData.map(item => {
      const row = [
        item.productName,
        item.productType,
        item.availableQuantity,
        item.availableWeightKg,
      ];
      if (productTypeFilter !== 'FG') {
        row.push(item.reservedQuantity);
      }
      row.push(
        item.minStockLevel,
        `Rs. ${Number(item.sellingPrice).toFixed(2)}`,
        item.isActive ? 'Active' : 'Inactive'
      );
      return row;
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: productTypeFilter !== 'All' ? headerEndY + 15 : headerEndY + 10,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [34, 197, 94] },
    });

    addPdfFooter(doc);

    doc.save(`stock_report_${new Date().toISOString().split('T')[0]}.pdf`);
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
      'Available Weight (kg)',
      ...(productTypeFilter !== 'FG' ? ['Reserved Qty'] : []),
      'Min Stock Level',
      'Selling Price',
      'Status',
    ];

    const csvRows = filteredData.map(item => {
      const row = [
        item.productName,
        item.productType,
        item.availableQuantity,
        item.availableWeightKg,
      ];
      if (productTypeFilter !== 'FG') {
        row.push(item.reservedQuantity);
      }
      row.push(
        item.minStockLevel,
        Number(item.sellingPrice).toFixed(2),
        item.isActive ? 'Active' : 'Inactive'
      );
      return row;
    });

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `stock_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast.success('CSV exported successfully');
  };

  // Get unique products for filter, filtered by selected type
  const productOptions = useMemo(() => {
    let sourceData = data;
    if (productTypeFilter === 'All') {
      sourceData = data.filter(item => item.productType === 'RM' || item.productType === 'PM');
    } else {
      sourceData = data.filter(item => item.productType === productTypeFilter);
    }

    const products = new Set<string>();
    sourceData.forEach(item => products.add(item.productName));
    const sortedProducts = Array.from(products).sort();

    return sortedProducts.map(p => ({ id: p, label: p, value: p }));
  }, [data, productTypeFilter]);

  useEffect(() => {
    // Reset product filter when type changes if current product isn't in new list
    if (productFilter && !productOptions.find(opt => opt.value === productFilter)) {
      setProductFilter('');
    }
  }, [productTypeFilter, productOptions, productFilter]);

  /* Low Stock Filter State */
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  // Filter data based on product type and product name
  const filteredData = useMemo(() => {
    let result = data;

    if (productTypeFilter === 'All') {
      result = result.filter(item => item.productType === 'RM' || item.productType === 'PM');
    } else {
      result = result.filter(item => item.productType === productTypeFilter);
    }

    if (productFilter) {
      result = result.filter(item => item.productName === productFilter);
    }

    if (showLowStockOnly) {
      result = result.filter(item => item.availableQuantity < item.minStockLevel);
    }

    return result;
  }, [data, productTypeFilter, productFilter, showLowStockOnly]);

  // Calculate statistics
  const stats = useMemo(() => {
    // Stats should calculated from the BASE data (filtered by type/search but NOT by the low-stock-toggle itself to stay informative?)
    // Actually, usually stats cards summarize the current view or the whole dataset.
    // However, if we filter by "Low Stock", the "Total Products" count becomes "Low Stock Products".
    // AND "Low Stock Items" would be same as "Total Products".
    // Usually, top stats cards act as high level summaries.
    // If I click "Low Stock Items", I expect the TABLE to filter, but maybe the cards should remain static so I can toggle back?
    // OR the cards act as tabs.
    // Let's keep stats based on `data` (filtered by Type/Search only) so the counts on cards don't change when we toggle the card itself.
    // This makes the card act like a stable filter button.

    // We need a separate "baseFilteredData" for stats calculation if we want them stable against the low-stock toggle.
    let baseData = data;
    if (productTypeFilter === 'All') {
      baseData = baseData.filter(item => item.productType === 'RM' || item.productType === 'PM');
    } else {
      baseData = baseData.filter(item => item.productType === productTypeFilter);
    }
    if (productFilter) {
      baseData = baseData.filter(item => item.productName === productFilter);
    }

    const totalProducts = baseData.length;
    const lowStock = baseData.filter(item => item.availableQuantity < item.minStockLevel).length;
    const totalAvailable = baseData.reduce(
      (sum, item) => sum + parseFloat(item.availableQuantity?.toString() || '0'),
      0
    );
    return { totalProducts, lowStock, totalAvailable };
  }, [data, productTypeFilter, productFilter]);

  // ... (Chart Data logic should follow filteredData so charts reflect what looks like the table)

  // Process data for charts
  const chartData = useMemo(() => {
    if (filteredData.length === 0) return null;

    // Available Quantity Distribution (Pie)
    // Show all filtered products (sorted by available quantity desc)
    const sortedByAvailable = [...filteredData].sort(
      (a, b) => b.availableQuantity - a.availableQuantity
    );

    // Generate colors for all items
    const availableColors = generateColors(sortedByAvailable.length);

    // Price Distribution (Bar)
    const sortedByPrice = [...filteredData]
      .filter(item => Number(item.sellingPrice) > 0)
      .sort((a, b) => Number(b.sellingPrice) - Number(a.sellingPrice));

    const priceColors = generateColors(sortedByPrice.length);

    // Stock Trend (Line) - Inward vs Outward vs Available
    // Sort by name for line chart usually or just use same order
    const lineChartProducts = [...filteredData].sort((a, b) =>
      a.productName.localeCompare(b.productName)
    );

    return {
      stockDistribution: {
        labels: sortedByAvailable.map(p => p.productName),
        datasets: [
          {
            label: 'Available Quantity',
            data: sortedByAvailable.map(p => p.availableQuantity),
            backgroundColor: availableColors.map(c => c.bg),
            borderColor: availableColors.map(c => c.border),
            borderWidth: 1,
          },
        ],
      },
      priceDistribution: {
        labels: sortedByPrice.map(p => p.productName),
        datasets: [
          {
            label: 'Selling Price (₹)',
            data: sortedByPrice.map(p => Number(p.sellingPrice)),
            backgroundColor: priceColors.map(c => c.bg),
            borderColor: priceColors.map(c => c.border),
            borderWidth: 1,
          },
        ],
      },
      monthlyMovement: {
        labels: lineChartProducts.map(p => p.productName),
        datasets: [
          {
            label: 'Total Available',
            data: lineChartProducts.map(p => p.availableQuantity),
            borderColor: 'rgb(59, 130, 246)', // Blue
            backgroundColor: 'rgba(59, 130, 246, 0.5)',
            tension: 0.3,
            yAxisID: 'y',
          },
          {
            label: 'Inward',
            data: lineChartProducts.map(p => p.totalInward || 0),
            borderColor: 'rgb(34, 197, 94)', // Green
            backgroundColor: 'rgba(34, 197, 94, 0.5)',
            tension: 0.3,
            yAxisID: 'y',
          },
          {
            label: 'Outward',
            data: lineChartProducts.map(p => p.totalOutward || 0),
            borderColor: 'rgb(249, 115, 22)', // Orange
            backgroundColor: 'rgba(249, 115, 22, 0.5)',
            tension: 0.3,
            yAxisID: 'y',
          },
          {
            label: 'Min Stock Level',
            data: lineChartProducts.map(p => p.minStockLevel),
            borderColor: 'rgb(239, 68, 68)', // Red
            backgroundColor: 'rgba(239, 68, 68, 0.5)',
            tension: 0.3,
            borderDash: [5, 5],
            yAxisID: 'y',
          },
        ],
        rawItems: lineChartProducts,
      },
    };
  }, [filteredData]);

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // Hide legend if too many items
      },
      tooltip: {
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (context: any) => {
            const label = context.label || '';
            const value = context.raw || 0;
            return `${label}: ${value}`;
          },
        },
      },
    },
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (context: any) => `Price: ₹${context.raw}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Price (₹)',
        },
      },
      x: {
        ticks: {
          display: false,
          maxRotation: 45,
          minRotation: 45,
          autoSkip: true,
          maxTicksLimit: 20,
        },
      },
    },
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: 'var(--text-secondary)',
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        padding: 12,
        titleFont: {
          size: 14,
          weight: 'bold' as const,
        },
        bodyFont: {
          size: 12,
        },
        displayColors: true,
        boxWidth: 8,
        boxHeight: 8,
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          title: (context: any) => {
            return `Product: ${context[0].label}`;
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          afterBody: (_context: any) => {
            // Access raw data if available in chartData scope
            // We can find it via context.chart.data or closure if strictly coupled.
            // Here simpler to just show what's plotted.
            return [];
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          display: false,
          maxRotation: 45,
          minRotation: 45,
          autoSkip: true,
          maxTicksLimit: 20,
        },
        grid: {
          display: false,
        },
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Quantity',
          color: 'var(--text-secondary)',
        },
        ticks: {
          color: 'var(--text-secondary)',
        },
        beginAtZero: true,
        grid: {
          display: false,
        },
      },
    },
  };

  // Define columns for DataTable
  const columns = useMemo<ColumnDef<StockReportItem>[]>(() => {
    const baseColumns: ColumnDef<StockReportItem>[] = [
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
            className={`${
              row.original.productType === 'FG'
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : row.original.productType === 'RM'
                  ? 'bg-blue-500 hover:bg-blue-600 text-white'
                  : 'bg-yellow-500 hover:bg-yellow-600 text-white'
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
          <div
            className={`text-right ${
              row.original.availableQuantity < row.original.minStockLevel
                ? 'text-[var(--color-error)] font-semibold'
                : 'text-[var(--text-primary)]'
            }`}
          >
            {Number(row.original.availableQuantity).toFixed(2)}
            {row.original.availableQuantity < row.original.minStockLevel && (
              <AlertTriangle className="inline ml-1 h-4 w-4" />
            )}
          </div>
        ),
      },
      {
        accessorKey: 'availableWeightKg',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Available Weight (kg)" />
        ),
        cell: ({ row }) => (
          <div className="text-right text-[var(--text-secondary)]">
            {Number(row.original.availableWeightKg).toFixed(2)}
          </div>
        ),
      },
    ];

    if (productTypeFilter !== 'FG') {
      baseColumns.push({
        accessorKey: 'reservedQuantity',
        header: ({ column }) => <DataTableColumnHeader column={column} title="WIP" />,
        cell: ({ row }) => (
          <div className="text-right text-[var(--text-secondary)]">
            {Number(row.original.reservedQuantity).toFixed(2)}
          </div>
        ),
      });
    }

    baseColumns.push(
      {
        accessorKey: 'minStockLevel',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Min Stock" />,
        cell: ({ row }) => (
          <div className="text-right text-[var(--text-secondary)]">
            {Number(row.original.minStockLevel).toFixed(2)}
          </div>
        ),
      },
      {
        accessorKey: 'sellingPrice',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Price" />,
        cell: ({ row }) => (
          <div className="text-right font-medium text-[var(--text-primary)]">
            ₹{Number(row.original.sellingPrice).toFixed(2)}
          </div>
        ),
      }
    );

    return baseColumns;
  }, [productTypeFilter]);

  // Permissions
  const { user } = useAuth();
  const { hasPermission } = usePermission();
  const canExport = user?.Role === 'SuperAdmin' || hasPermission('report-stock', 'export');

  const handleExportClick = (type: 'csv' | 'pdf') => {
    if (!canExport) {
      showToast.error('You do not have permission to export reports.');
      return;
    }
    if (type === 'csv') handleExportCsv();
    else handleExport();
  };

  /* Render Return */
  /* Note: Update the Low Stock Card to be clickable */

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Report"
        description="Current inventory levels and stock status"
        actions={
          <div className="flex gap-2">
            <Button
              variant="primary"
              className={`text-white ${!canExport ? 'opacity-50 cursor-not-allowed bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
              onClick={() => handleExportClick('csv')}
              leftIcon={!canExport ? <Lock size={16} /> : <FileDown size={20} />}
              disabled={!canExport}
              title={!canExport ? 'Export permission required' : 'Export CSV'}
            >
              Export CSV
            </Button>
            <Button
              variant="primary"
              className={`text-white ${!canExport ? 'opacity-50 cursor-not-allowed bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}
              onClick={() => handleExportClick('pdf')}
              leftIcon={!canExport ? <Lock size={16} /> : <FileDown size={20} />}
              disabled={!canExport}
              title={!canExport ? 'Export permission required' : 'Export PDF'}
            >
              Export PDF
            </Button>
          </div>
        }
      />

      {/* Filters Container */}
      <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100">
        <div className="flex items-end gap-4 flex-wrap">
          {/* Product Type Filters */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500 ml-1">Type</label>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                {(['All', 'RM', 'PM'] as const).map(type => (
                  <Button
                    key={type}
                    size="sm"
                    variant={productTypeFilter === type ? 'primary' : 'secondary'}
                    onClick={() => setProductTypeFilter(type)}
                    className={`min-w-[4rem] px-4 transition-all duration-200 ${
                      productTypeFilter === type
                        ? 'bg-slate-800 text-white hover:bg-slate-900 border-none shadow-md'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {type}
                  </Button>
                ))}
              </div>
              <div className="h-6 w-px bg-gray-300 mx-1" />
              <Button
                key="FG"
                size="sm"
                variant={productTypeFilter === 'FG' ? 'primary' : 'secondary'}
                onClick={() => setProductTypeFilter('FG')}
                className={`min-w-[4rem] px-4 transition-all duration-200 ${
                  productTypeFilter === 'FG'
                    ? 'bg-slate-800 text-white hover:bg-slate-900 border-none shadow-md'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                FG
              </Button>
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
              placeholder="Search Product..."
              className="w-[300px]"
            />
          </div>

          <div className="h-10 w-px bg-gray-300 mx-1 hidden lg:block" />

          {/* Date Filters */}
          <Input
            type="date"
            label="From"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            fullWidth={false}
            className="w-[150px]"
          />

          <Input
            type="date"
            label="To"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            fullWidth={false}
            className="w-[150px]"
          />
        </div>
      </div>

      {/* Statistics Cards */}
      {!isLoading && data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-sm text-[var(--text-secondary)] font-medium">Total Products</p>
            <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">
              {stats.totalProducts}
            </p>
          </div>
          <div
            className={`card p-4 cursor-pointer transition-all border-l-4 ${
              showLowStockOnly
                ? 'bg-red-50 border-red-500 shadow-md ring-2 ring-red-200'
                : 'border-transparent hover:bg-gray-50'
            }`}
            onClick={() => setShowLowStockOnly(!showLowStockOnly)}
            title="Click to filter Low Stock items"
          >
            <p className="text-sm text-[var(--text-secondary)] font-medium flex items-center justify-between">
              Low Stock Items
              {showLowStockOnly && (
                <Badge className="bg-red-500 text-white text-xs h-5">Filtering</Badge>
              )}
            </p>
            <p className="text-2xl font-bold text-[var(--color-error)] mt-1">{stats.lowStock}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-[var(--text-secondary)] font-medium">Total Available</p>
            <p className="text-2xl font-bold text-[var(--color-success)] mt-1">
              {stats.totalAvailable}
            </p>
          </div>
        </div>
      )}

      {/* Data Visualization */}
      {!isLoading && chartData && filteredData.length > 0 && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {' '}
              Visualization of quantity and price
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Available Quantity Distribution Pie Chart */}
            <div className="card p-6">
              <h3 className="text-center font-semibold text-[var(--text-primary)] mb-4">
                Available Quantity Distribution
              </h3>
              <div className="h-[300px]">
                <Pie data={chartData.stockDistribution} options={pieChartOptions} />
              </div>
            </div>

            {/* Price Distribution Bar Chart */}
            <div className="card p-6">
              <h3 className="text-center font-semibold text-[var(--text-primary)] mb-4">
                Price Distribution
              </h3>
              <div className="h-[300px]">
                <Bar data={chartData.priceDistribution} options={barChartOptions} />
              </div>
            </div>
          </div>

          {/* Stock Trend Line Chart */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
              Stock Levels Trend
            </h3>
            <div className="h-[400px]">
              <Line data={chartData.monthlyMovement} options={lineChartOptions} />
            </div>
          </div>
        </div>
      )}

      {/* DataTable */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-[var(--text-secondary)]">Loading stock data...</div>
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

export default StockReport;
