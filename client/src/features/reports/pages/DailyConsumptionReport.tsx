import React, { useState, useEffect, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/common';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Button, Input, Badge } from '@/components/ui';
import { reportsApi } from '../api/reportsApi';
import { DailyConsumptionReportItem } from '../types';
import { FileDown, PieChart as PieChartIcon, BarChart3, TrendingUp, Package } from 'lucide-react';
import { showToast } from '@/utils/toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPdfFooter, addPdfHeader } from '@/utils/pdfUtils';
import { companyApi } from '@/features/company/api/companyApi';
import { CompanyInfo } from '@/features/company/types';
import { formatDate, formatDateTime } from '@/utils/dateUtils';
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

// Generate colors for charts
const generateColors = (count: number) => {
  const colors = [
    { bg: 'rgba(74, 222, 128, 0.8)', border: 'rgb(34, 197, 94)' }, // Green
    { bg: 'rgba(96, 165, 250, 0.8)', border: 'rgb(59, 130, 246)' }, // Blue
    { bg: 'rgba(251, 146, 60, 0.8)', border: 'rgb(249, 115, 22)' }, // Orange
    { bg: 'rgba(196, 181, 253, 0.8)', border: 'rgb(168, 85, 247)' }, // Purple
    { bg: 'rgba(248, 113, 113, 0.8)', border: 'rgb(239, 68, 68)' }, // Red
    { bg: 'rgba(251, 191, 36, 0.8)', border: 'rgb(234, 179, 8)' }, // Yellow
  ];
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(colors[i % colors.length]);
  }
  return result;
};

const DailyConsumptionReport: React.FC = () => {
  const [data, setData] = useState<DailyConsumptionReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [productTypeFilter, setProductTypeFilter] = useState<string>('All');
  const [date, setDate] = useState(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  });

  const fetchReport = async () => {
    if (!date) return;

    setIsLoading(true);
    try {
      const response = await reportsApi.getDailyConsumptionReport(date);
      setData(response || []);
    } catch (error) {
      console.error('Error fetching daily consumption report:', error);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);

  useEffect(() => {
    fetchReport();
    companyApi
      .get()
      .then(res => setCompanyInfo(res.data.data))
      .catch(console.error);
  }, [date]);

  // Filter data
  const filteredData = useMemo(() => {
    if (productTypeFilter === 'All') return data;
    return data.filter(item => item.productType === productTypeFilter);
  }, [data, productTypeFilter]);

  const handleExport = () => {
    if (filteredData.length === 0) {
      showToast.error('No data to export');
      return;
    }

    const doc = new jsPDF('portrait');

    const startY = addPdfHeader(doc, companyInfo, 'Daily Consumption Report');

    doc.setFontSize(10);
    doc.text(`Generated on: ${formatDateTime(new Date())}`, 14, startY + 10);
    doc.text(`Date: ${date}`, 14, startY + 16);
    if (productTypeFilter !== 'All') {
      doc.text(`Type: ${productTypeFilter}`, 14, startY + 22);
    }

    const tableColumn = [
      'Material Name',
      'Product Type',
      'Opening Qty',
      'Consumption',
      'Closing Qty',
    ];

    const tableRows = filteredData.map(item => [
      item.masterProductName,
      item.productType,
      item.openingQty.toFixed(2),
      item.consumption.toFixed(2),
      item.closingQty.toFixed(2),
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: productTypeFilter !== 'All' ? startY + 28 : startY + 22,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [34, 197, 94] },
    });
    addPdfFooter(doc);
    doc.save(`Daily_Consumption_Report_${date}.pdf`);
    showToast.success('PDF Downloaded!');
  };

  const handleExportCsv = () => {
    const csvHeaders = [
      'Material Name',
      'Product Type',
      'Opening Qty',
      'Consumption',
      'Closing Qty',
    ];

    const csvRows = filteredData.map(item => [
      item.masterProductName,
      item.productType,
      item.openingQty.toFixed(2),
      item.consumption.toFixed(2),
      item.closingQty.toFixed(2),
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `daily_consumption_report_${date}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast.success('CSV exported successfully');
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const totalMaterials = filteredData.length;
    const totalConsumption = filteredData.reduce((sum, item) => sum + item.consumption, 0);
    const totalOpening = filteredData.reduce((sum, item) => sum + item.openingQty, 0);
    const totalClosing = filteredData.reduce((sum, item) => sum + item.closingQty, 0);

    return { totalMaterials, totalConsumption, totalOpening, totalClosing };
  }, [filteredData]);

  // Chart Data
  const chartData = useMemo(() => {
    if (filteredData.length === 0) return null;

    // 1. Consumption by Type (Pie)
    const typeDistribution = filteredData.reduce(
      (acc, item) => {
        acc[item.productType] = (acc[item.productType] || 0) + item.consumption;
        return acc;
      },
      {} as Record<string, number>
    );

    const typeLabels = Object.keys(typeDistribution);
    const typeValues = Object.values(typeDistribution);
    const typeColors = generateColors(typeLabels.length);

    // 2. Top 10 Consumed Materials (Bar)
    const sortedByConsumption = [...filteredData]
      .sort((a, b) => b.consumption - a.consumption)
      .slice(0, 10);

    // Generate colors
    const topBarColors = generateColors(sortedByConsumption.length);

    return {
      typeDistribution: {
        labels: typeLabels,
        datasets: [
          {
            label: 'Consumption by Type',
            data: typeValues,
            backgroundColor: typeColors.map(c => c.bg),
            borderColor: typeColors.map(c => c.border),
            borderWidth: 1,
          },
        ],
      },
      topConsumed: {
        labels: sortedByConsumption.map(item => item.masterProductName),
        datasets: [
          {
            label: 'Consumption Qty',
            data: sortedByConsumption.map(item => item.consumption),
            backgroundColor: topBarColors.map(c => c.bg),
            borderColor: topBarColors.map(c => c.border),
            borderWidth: 1,
          },
        ],
      },
    };
  }, [filteredData]);

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
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
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Quantity',
        },
      },
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 45,
        },
      },
    },
  };

  const columns = useMemo<ColumnDef<DailyConsumptionReportItem>[]>(
    () => [
      {
        accessorKey: 'masterProductName',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Material Name" />,
        cell: ({ row }) => (
          <div className="font-medium text-[var(--text-primary)]">
            {row.original.masterProductName}
          </div>
        ),
      },
      {
        accessorKey: 'productType',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
        cell: ({ row }) => (
          <Badge
            className={`${
              row.original.productType === 'RM'
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : row.original.productType === 'PM'
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                  : 'bg-gray-500 text-white'
            }`}
          >
            {row.original.productType}
          </Badge>
        ),
      },
      {
        accessorKey: 'openingQty',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Opening Qty" />,
        cell: ({ getValue }) => (
          <div className="text-right text-[var(--text-primary)]">
            {(getValue() as number).toFixed(2)}
          </div>
        ),
      },
      {
        accessorKey: 'consumption',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Consumption" />,
        cell: ({ getValue }) => (
          <div className="text-right font-semibold text-[var(--color-primary-600)]">
            {(getValue() as number).toFixed(2)}
          </div>
        ),
      },
      {
        accessorKey: 'closingQty',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Closing Qty" />,
        cell: ({ getValue }) => (
          <div className="text-right font-medium text-[var(--color-info)]">
            {(getValue() as number).toFixed(2)}
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <PageHeader
        metadataPath="/reports/daily-consumption"
        title="Daily Consumption Report"
        description="Track daily material consumption and inventory levels"
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

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 rounded-lg border">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Date:</label>
          <Input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            fullWidth={false}
            className="w-auto shadow-sm border-gray-300"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Type:</label>
          <select
            value={productTypeFilter}
            onChange={e => setProductTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="All">All</option>
            <option value="RM">RM</option>
            <option value="PM">PM</option>
          </select>
        </div>
      </div>

      {/* Statistics Cards */}
      {!isLoading && filteredData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Package size={20} />
              </div>
              <p className="text-sm text-[var(--text-secondary)] font-medium">Total Materials</p>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)] pl-1">
              {stats.totalMaterials}
            </p>
          </div>
          <div className="card p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                <TrendingUp size={20} />
              </div>
              <p className="text-sm text-[var(--text-secondary)] font-medium">Total Consumption</p>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)] pl-1">
              {stats.totalConsumption.toFixed(2)}
            </p>
          </div>
          <div className="card p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                <BarChart3 size={20} />
              </div>
              <p className="text-sm text-[var(--text-secondary)] font-medium">Total Opening</p>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)] pl-1">
              {stats.totalOpening.toFixed(2)}
            </p>
          </div>
          <div className="card p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                <PieChartIcon size={20} />
              </div>
              <p className="text-sm text-[var(--text-secondary)] font-medium">Total Closing</p>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)] pl-1">
              {stats.totalClosing.toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Visualizations */}
      {!isLoading && chartData && filteredData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Consumed Bar Chart */}
          <div className="card p-6 border border-gray-100 shadow-sm">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-gray-400" />
              Top 10 Consumed Materials
            </h3>
            <div className="h-[300px]">
              <Bar data={chartData.topConsumed} options={barChartOptions} />
            </div>
          </div>

          {/* Consumption by Type Pie Chart */}
          <div className="card p-6 border border-gray-100 shadow-sm">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <PieChartIcon size={18} className="text-gray-400" />
              Consumption Share by Type
            </h3>
            <div className="h-[300px]">
              <Pie data={chartData.typeDistribution} options={pieChartOptions} />
            </div>
          </div>
        </div>
      )}

      {/* DataTable */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <div className="text-[var(--text-secondary)]">Loading daily consumption data...</div>
          </div>
        </div>
      ) : filteredData.length > 0 ? (
        <DataTable
          columns={columns}
          data={filteredData}
          searchPlaceholder="Search materials..."
          defaultPageSize={20}
          showToolbar={true}
          toolbarActions={
            <div className="flex items-center gap-2 ml-2">
              {/* Product Type Tabs */}
              <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-1 bg-white">
                {(['All', 'RM', 'PM'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setProductTypeFilter(type)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      productTypeFilter === type
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <div className="h-6 w-px bg-gray-200 mx-2" />

              {/* Date Filter */}
              <Input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                fullWidth={false}
                className="w-auto shadow-sm border-gray-200 h-8 text-xs"
              />
            </div>
          }
          showPagination={true}
          autoResetPageIndex={false}
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-64 text-[var(--text-secondary)] border bg-gray-50/30 rounded-lg">
          <PieChartIcon size={48} className="text-gray-300 mb-2" />
          <p>No data available for the selected date.</p>
        </div>
      )}
    </div>
  );
};

export default DailyConsumptionReport;
