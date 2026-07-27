import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import {
  Loader2,
  Calendar,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  ShoppingBag,
  Users,
  Award,
  ChevronDown,
  RefreshCw,
  DollarSign,
  Download,
} from 'lucide-react';
import { reportsApi } from '@/features/reports/api/reportsApi';
import { formatDate } from '@/utils/dateUtils';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';
import { formatCurrency } from '@/utils/formatters';
import {
  format,
  subMonths,
  startOfMonth,
  endOfMonth,
  subDays,
  startOfYear,
  subYears,
} from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPdfFooter, addPdfHeader } from '@/utils/pdfUtils';
import { CompanyInfo } from '@/features/company/types';
import { companyApi } from '@/features/company/api/companyApi';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

// --- Types ---

interface OrderItem {
  orderId: number;
  orderNumber: string;
  customerName: string;
  amount: number;
  date: string;
  status: string;
  billNo: string;
}

interface SalesmanRevenueItem {
  salespersonId: number;
  salespersonName: string;
  totalRevenue: number;
  orderCount: number;
  orders: OrderItem[];
}

type DateRangePreset =
  | 'this_month'
  | 'last_month'
  | 'last_3_months'
  | 'last_6_months'
  | 'this_year'
  | 'last_year'
  | 'custom';

const getDateRange = (preset: DateRangePreset): { start: Date; end: Date } => {
  const now = new Date();
  switch (preset) {
    case 'this_month':
      return { start: startOfMonth(now), end: now };
    case 'last_month':
      return { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) };
    case 'last_3_months':
      return { start: subMonths(now, 3), end: now };
    case 'last_6_months':
      return { start: subMonths(now, 6), end: now };
    case 'this_year':
      return { start: startOfYear(now), end: now };
    case 'last_year':
      return {
        start: startOfYear(subYears(now, 1)),
        end: endOfMonth(subMonths(startOfYear(now), 1)),
      };
    default:
      return { start: subMonths(now, 1), end: now };
  }
};

const SalespersonRevenueReport: React.FC = () => {
  // --- State for Date Filter ---
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('this_month');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);

  // Fetch Company Info
  useEffect(() => {
    companyApi
      .get()
      .then(res => {
        const info = (res.data as any).data || res.data;
        setCompanyInfo(info);
      })
      .catch(console.error);
  }, []);

  // Calculate actual start/end dates based on preset
  const dateRange = useMemo(() => {
    if (dateRangePreset === 'custom') {
      return {
        start: customStart ? new Date(customStart) : undefined,
        end: customEnd ? new Date(customEnd) : undefined,
      };
    }
    return getDateRange(dateRangePreset);
  }, [dateRangePreset, customStart, customEnd]);

  // Format for API (YYYY-MM-DD)
  const apiStartDate = dateRange.start ? format(dateRange.start, 'yyyy-MM-dd') : '';
  const apiEndDate = dateRange.end ? format(dateRange.end, 'yyyy-MM-dd') : '';

  // Last Month Data Calculation
  const lastMonthRange = useMemo(() => {
    const now = new Date();
    return {
      start: startOfMonth(subMonths(now, 1)),
      end: endOfMonth(subMonths(now, 1)),
    };
  }, []);

  const { data: lastMonthData } = useQuery({
    queryKey: [
      'salesmanRevenueReport',
      format(lastMonthRange.start, 'yyyy-MM-dd'),
      format(lastMonthRange.end, 'yyyy-MM-dd'),
    ],
    queryFn: () =>
      reportsApi.getSalesmanRevenueReport(
        format(lastMonthRange.start, 'yyyy-MM-dd'),
        format(lastMonthRange.end, 'yyyy-MM-dd')
      ),
  });

  // Helper calculate daily average
  const getDailyAverage = (revenue: number, rangeStart: Date, rangeEnd: Date) => {
    const start = rangeStart.getTime();
    const end = Math.min(new Date().getTime(), rangeEnd.getTime()); // Cap at today for partial months
    if (end <= start) return 0;
    const days = Math.max(1, (end - start) / (1000 * 60 * 60 * 24));
    return revenue / days;
  };

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['salesmanRevenueReport', apiStartDate, apiEndDate],
    queryFn: () => reportsApi.getSalesmanRevenueReport(apiStartDate, apiEndDate),
    enabled: !!apiStartDate && !!apiEndDate,
  });

  // Preset label helper
  const getPresetLabel = (preset: DateRangePreset): string => {
    const labels: Record<DateRangePreset, string> = {
      this_month: 'This Month',
      last_month: 'Last Month',
      last_3_months: 'Last 3 Months',
      last_6_months: 'Last 6 Months',
      this_year: 'This Year',
      last_year: 'Last Year',
      custom: 'Custom Range',
    };
    return labels[preset];
  };

  // --- Statistics ---
  const stats = useMemo(() => {
    if (!data) return { totalRevenue: 0, totalOrders: 0, avgRevenue: 0, topPerformer: '-' };
    const totalRevenue = data.reduce(
      (sum: number, item: SalesmanRevenueItem) => sum + Number(item.totalRevenue),
      0
    );
    const totalOrders = data.reduce(
      (sum: number, item: SalesmanRevenueItem) => sum + Number(item.orderCount),
      0
    );
    const avgRevenue = data.length > 0 ? totalRevenue / data.length : 0;
    const topPerformer = data.length > 0 ? data[0].salespersonName : '-'; // Already sorted by revenue
    return { totalRevenue, totalOrders, avgRevenue, topPerformer };
  }, [data]);

  // --- Chart Data ---
  const barChartData = useMemo(() => {
    if (!data) return null;
    return {
      labels: data.map((item: SalesmanRevenueItem) => item.salespersonName),
      datasets: [
        {
          label: 'Revenue',
          data: data.map((item: SalesmanRevenueItem) => item.totalRevenue),
          backgroundColor: 'rgba(34, 197, 94, 0.6)', // Green-500
          borderColor: 'rgb(34, 197, 94)',
          borderWidth: 1,
        },
      ],
    };
  }, [data]);

  const pieChartData = useMemo(() => {
    if (!data) return null;
    return {
      labels: data.map((item: SalesmanRevenueItem) => item.salespersonName),
      datasets: [
        {
          label: 'Orders',
          data: data.map((item: SalesmanRevenueItem) => item.orderCount),
          backgroundColor: [
            'rgba(255, 99, 132, 0.6)',
            'rgba(54, 162, 235, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(75, 192, 192, 0.6)',
            'rgba(153, 102, 255, 0.6)',
            'rgba(255, 159, 64, 0.6)',
          ],
          borderWidth: 1,
        },
      ],
    };
  }, [data]);

  const lineChartData = useMemo(() => {
    if (!data) return null;

    // Flatten all orders
    const allOrders: OrderItem[] = data.flatMap((item: SalesmanRevenueItem) => item.orders);

    // Group by date
    const ordersByDate: Record<string, number> = {};
    allOrders.forEach(order => {
      const dateKey = new Date(order.date).toLocaleDateString('en-CA'); // YYYY-MM-DD
      ordersByDate[dateKey] = (ordersByDate[dateKey] || 0) + Number(order.amount);
    });

    // Sort dates
    const sortedDates = Object.keys(ordersByDate).sort();

    return {
      labels: sortedDates.map(date => formatDate(date)),
      datasets: [
        {
          label: 'Daily Revenue',
          data: sortedDates.map(date => ordersByDate[date]),
          borderColor: 'rgb(59, 130, 246)', // Blue-500
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
          tension: 0.3, // Smooth curve
          fill: true,
        },
      ],
    };
  }, [data]);

  const downloadSalespersonPDF = async (salespersonName: string, orders: OrderItem[]) => {
    let currentCompanyInfo = companyInfo;

    // If not in state, try fetching fresh
    if (!currentCompanyInfo) {
      try {
        const res = await companyApi.get();
        currentCompanyInfo = res.data.data || (res.data as any);
      } catch (error) {
        console.error('Failed to fetch company info for PDF', error);
      }
    }

    const doc = new jsPDF();

    // Header
    const headerEndY = addPdfHeader(doc, currentCompanyInfo, 'Salesperson Revenue Report');

    // Metadata
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(`Salesperson: ${salespersonName}`, 14, headerEndY + 5);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, headerEndY + 10);

    const periodText =
      dateRange.start && dateRange.end
        ? `Period: ${format(dateRange.start, 'dd MMM yyyy')} - ${format(dateRange.end, 'dd MMM yyyy')}`
        : 'Period: All Time';
    doc.text(periodText, 14, headerEndY + 15);

    // Table
    const tableColumn = ['Order No', 'Bill No', 'Date', 'Customer', 'Status', 'Amount'];
    const tableRows = orders.map(order => [
      order.orderNumber,
      order.billNo || '-',
      formatDate(order.date),
      order.customerName,
      order.status,
      `Rs. ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(order.amount)}`,
    ]);

    // Grand total = sum of the same raw amount field used for each PDF row,
    // over exactly the orders included in this PDF. Formatted with the same
    // "Rs." + en-IN convention as the row amounts above.
    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.amount || 0), 0);
    const formattedTotal = `Rs. ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(totalRevenue)}`;

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      // One grand-total row: label spans the first five columns (right-aligned,
      // bold) so the amount sits directly under the Amount column. showFoot
      // 'lastPage' renders it once, after the last transaction, never per page.
      foot: [
        [
          { content: 'Total', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: formattedTotal, styles: { fontStyle: 'bold' } },
        ],
      ],
      showFoot: 'lastPage',
      startY: headerEndY + 20,
      theme: 'grid',
      headStyles: { fillColor: [66, 66, 66] },
    });

    addPdfFooter(doc);
    doc.save(`${salespersonName}_Report.pdf`);
  };

  // --- Table Columns ---
  const columns = useMemo<ColumnDef<SalesmanRevenueItem>[]>(
    () => [
      {
        accessorKey: 'salespersonName',
        header: 'Salesperson Name',
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs">
              {row.original.salespersonName.charAt(0).toUpperCase()}
            </div>
            <div className="font-medium text-[var(--text-primary)]">
              {row.getValue('salespersonName')}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'orderCount',
        header: ({ column }) => <div className="text-right">Total Orders</div>,
        cell: ({ row }) => (
          <div className="text-right text-[var(--text-secondary)]">
            {row.getValue('orderCount')} orders
          </div>
        ),
      },
      {
        accessorKey: 'totalRevenue',
        header: ({ column }) => <div className="text-right">Total Revenue</div>,
        cell: ({ row }) => (
          <div className="text-right font-bold text-green-600">
            {formatCurrency(Number(row.getValue('totalRevenue')))}
          </div>
        ),
      },
      {
        id: 'trend',
        header: 'Trend (vs Last Month)',
        cell: ({ row }) => {
          // Logic: Compare Daily Average of Current Period vs Daily Average of Last Month
          const currentRevenue = Number(row.original.totalRevenue);
          const currentDailyAvg =
            dateRange.start && dateRange.end
              ? getDailyAverage(currentRevenue, dateRange.start, dateRange.end)
              : 0;

          const lastMonthItem = lastMonthData?.find(
            (item: SalesmanRevenueItem) => item.salespersonName === row.original.salespersonName
          );
          const lastMonthRevenue = lastMonthItem ? Number(lastMonthItem.totalRevenue) : 0;
          const lastMonthDailyAvg = getDailyAverage(
            lastMonthRevenue,
            lastMonthRange.start,
            lastMonthRange.end
          );

          let direction: 'up' | 'down' | 'stable' = 'stable';
          if (currentDailyAvg > lastMonthDailyAvg * 1.05)
            direction = 'up'; // 5% buffer
          else if (currentDailyAvg < lastMonthDailyAvg * 0.95) direction = 'down';

          return (
            <div
              className="flex items-center gap-2"
              title={`Avg: ${formatCurrency(currentDailyAvg)}/day vs ${formatCurrency(lastMonthDailyAvg)}/day (Last Month)`}
            >
              {direction === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
              {direction === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
              {direction === 'stable' && <Minus className="h-4 w-4 text-gray-500" />}
              <span
                className={`text-xs font-medium ${
                  direction === 'up'
                    ? 'text-green-600'
                    : direction === 'down'
                      ? 'text-red-600'
                      : 'text-gray-500'
                }`}
              >
                {direction === 'up' ? 'Increasing' : direction === 'down' ? 'Decreasing' : 'Stable'}
              </span>
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: 'Download',
        cell: ({ row }) => {
          return (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={e => {
                  e.stopPropagation();
                  downloadSalespersonPDF(row.original.salespersonName, row.original.orders);
                }}
                title="Download PDF"
              >
                <Download className="h-4 w-4 text-gray-500 hover:text-primary" />
              </Button>
            </div>
          );
        },
      },
    ],
    []
  );

  // --- Sub Component (Orders List) ---
  const renderOrdersSubComponent = ({ row }: { row: any }) => {
    const orders = row.original.orders as OrderItem[];
    if (!orders || orders.length === 0)
      return <div className="p-4 text-center text-muted-foreground">No orders found.</div>;

    return (
      <div className="p-4 bg-[var(--background)]/50">
        <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-secondary)]">
              <tr className="border-b border-[var(--border)]">
                <th className="h-10 px-4 text-left font-medium text-[var(--text-secondary)]">
                  Order No
                </th>
                <th className="h-10 px-4 text-left font-medium text-[var(--text-secondary)]">
                  Bill No
                </th>
                <th className="h-10 px-4 text-left font-medium text-[var(--text-secondary)]">
                  Date
                </th>
                <th className="h-10 px-4 text-left font-medium text-[var(--text-primary)]">
                  Customer
                </th>
                <th className="h-10 px-4 text-left font-medium text-[var(--text-secondary)]">
                  Status
                </th>
                <th className="h-10 px-4 text-right font-medium text-[var(--text-secondary)]">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr
                  key={order.orderId}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-highlight)]"
                >
                  <td className="p-3 px-4 font-medium text-[var(--text-primary)]">
                    {order.orderNumber}
                  </td>
                  <td className="p-3 px-4 text-[var(--text-secondary)]">{order.billNo || '-'}</td>
                  <td className="p-3 px-4 text-[var(--text-secondary)]">
                    {formatDate(order.date)}
                  </td>
                  <td className="p-3 px-4 text-[var(--text-primary)]">{order.customerName}</td>
                  <td className="p-3 px-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap ${
                        order.status === 'Completed' || order.status === 'Delivered'
                          ? 'bg-green-50 text-green-700 ring-green-600/20'
                          : 'bg-yellow-50 text-yellow-800 ring-yellow-600/20'
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="p-3 px-4 text-right font-medium text-[var(--text-primary)]">
                    {formatCurrency(Number(order.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 container mx-auto pb-10">
      <PageHeader
        metadataPath="/reports/salesperson-revenue"
        title="Salesperson Revenue Report"
        description="Comprehensive view of revenue generation by sales team."
      />

      {/* Filter Section - Matches AdminSalesDashboard */}
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <Calendar size={18} />
            <span className="font-medium">Date Range:</span>
          </div>

          {/* Preset Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowPresetDropdown(!showPresetDropdown)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-highlight)] transition-colors"
            >
              <span className="font-medium text-[var(--text-primary)]">
                {getPresetLabel(dateRangePreset)}
              </span>
              <ChevronDown
                size={16}
                className={`transition-transform ${showPresetDropdown ? 'rotate-180' : ''}`}
              />
            </button>

            {showPresetDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg z-50 min-w-[180px] overflow-hidden">
                {(
                  [
                    'this_month',
                    'last_month',
                    'last_3_months',
                    'last_6_months',
                    'this_year',
                    'last_year',
                    'custom',
                  ] as DateRangePreset[]
                ).map(preset => (
                  <button
                    key={preset}
                    onClick={() => {
                      setDateRangePreset(preset);
                      setShowPresetDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2 hover:bg-[var(--surface-highlight)] transition-colors ${
                      dateRangePreset === preset
                        ? 'bg-blue-50 text-blue-600 font-medium'
                        : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {getPresetLabel(preset)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Custom Date Inputs */}
          {dateRangePreset === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-[var(--text-secondary)]">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Date Range Display */}
          <div className="flex-1 text-right text-sm text-[var(--text-secondary)]">
            {dateRange.start && dateRange.end
              ? `${format(dateRange.start, 'dd MMM yyyy')} - ${format(dateRange.end, 'dd MMM yyyy')}`
              : 'Select a Date Range'}
          </div>

          {/* Refresh Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            leftIcon={<RefreshCw size={16} className={isRefetching ? 'animate-spin' : ''} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Statistics Cards - Matches AdminSalesDashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <TrendingUp size={24} />
            </div>
            <DollarSign size={32} className="opacity-20" />
          </div>
          <div className="text-3xl font-bold mb-1">{formatCurrency(stats.totalRevenue)}</div>
          <div className="text-sm text-white/80">Total Revenue</div>
        </div>

        {/* Total Orders */}
        <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <ShoppingBag size={24} />
            </div>
            <ShoppingBag size={32} className="opacity-20" />
          </div>
          <div className="text-3xl font-bold mb-1">{stats.totalOrders}</div>
          <div className="text-sm text-white/80">Total Orders</div>
        </div>

        {/* Avg Revenue */}
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <Users size={24} />
            </div>
            <Users size={32} className="opacity-20" />
          </div>
          <div className="text-3xl font-bold mb-1">{formatCurrency(stats.avgRevenue)}</div>
          <div className="text-sm text-white/80">Avg. Revenue / Salesman</div>
        </div>

        {/* Top Performer */}
        <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <Award size={24} />
            </div>
            <Award size={32} className="opacity-20" />
          </div>
          <div className="text-xl font-bold mb-1 truncate" title={stats.topPerformer}>
            {stats.topPerformer}
          </div>
          <div className="text-sm text-white/80">Top Performer</div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : isError ? (
        <div className="flex flex-col justify-center items-center h-64 text-red-500 gap-2">
          <AlertCircle className="h-8 w-8" />
          <p>Failed to load report data</p>
        </div>
      ) : (
        <>
          {/* Charts & Table Section */}
          {data && data.length > 0 ? (
            <div className="space-y-6">
              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-[var(--border)] bg-[var(--surface)] shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-[var(--text-primary)]">
                      Sales Trend (Revenue over Time)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      {lineChartData && (
                        <Line
                          data={lineChartData}
                          options={{ maintainAspectRatio: false, responsive: true }}
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-[var(--border)] bg-[var(--surface)] shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-[var(--text-primary)]">
                      Orders Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px] flex justify-center">
                      {pieChartData && (
                        <Pie
                          data={pieChartData}
                          options={{ maintainAspectRatio: false, responsive: true }}
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Bar Chart Full Width */}
              <Card className="border-[var(--border)] bg-[var(--surface)] shadow-sm">
                <CardHeader>
                  <CardTitle className="text-[var(--text-primary)]">Revenue by Salesman</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    {barChartData && (
                      <Bar
                        data={barChartData}
                        options={{ maintainAspectRatio: false, responsive: true }}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Data Table */}
              <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
                <div className="p-4 border-b border-[var(--border)] bg-gradient-to-r from-blue-50 to-indigo-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                        Detailed Breakdown
                      </h2>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {data.length} sales persons • {getPresetLabel(dateRangePreset)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <DataTable
                    columns={columns}
                    data={data}
                    searchPlaceholder="Search salesman..."
                    getRowCanExpand={() => true}
                    renderSubComponent={renderOrdersSubComponent}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <Users size={48} className="text-[var(--text-secondary)] mb-4 opacity-50" />
              <p className="text-[var(--text-secondary)] text-lg">No sales data found</p>
              <p className="text-sm text-[var(--text-secondary)]">Try adjusting the date range</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SalespersonRevenueReport;
