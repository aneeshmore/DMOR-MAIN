import React, { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/common';
import {
  Loader,
  Ban,
  Percent,
  AlertCircle,
  Download,
  Search,
  Filter as LucideFilter,
  ChevronLeft,
  ChevronRight,
  ArrowDown,
  ArrowUp,
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  Filler,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { reportsApi } from '@/features/reports/api/reportsApi';
import { useAuth } from '@/contexts/AuthContext';
import { addPdfFooter, addPdfHeader } from '@/utils/pdfUtils';
import { companyApi } from '@/features/company/api/companyApi';
import { CompanyInfo } from '@/features/company/types';
import { showToast } from '@/utils/toast';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface CancelledOrder {
  OrderID: number;
  CompanyName: string;
  SalesPerson: string;
  OrderCreatedDate: string;
  Location: string;
  Remark: string;
  Amount: string;
  Status: string;
  UpdatedAt?: string; // Added from backend update
}

interface OrderCount {
  year: number;
  month: number;
  count: number;
}

const CancelledOrdersReport: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<CancelledOrder[]>([]);
  const [orderCounts, setOrderCounts] = useState<OrderCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(''); // '' means all months
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{
    key: keyof CancelledOrder;
    direction: 'asc' | 'desc';
  }>({ key: 'OrderID', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [showExportOptions, setShowExportOptions] = useState(false);

  const [allOrders, setAllOrders] = useState<CancelledOrder[]>([]);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);

  useEffect(() => {
    companyApi
      .get()
      .then(res => setCompanyInfo(res.data.data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [cancelledData, allOrdersData, countsData] = await Promise.all([
          reportsApi.getCancelledOrders(selectedYear, selectedMonth),
          reportsApi.getAllOrders(),
          reportsApi.getOrderCountsByMonth(),
        ]);
        setData(cancelledData || []);
        setAllOrders(allOrdersData || []);
        setOrderCounts(countsData || []);
      } catch (error) {
        console.error('Failed to fetch data', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    const intervalId = setInterval(() => {
      fetchData();
    }, 10000); // 10 seconds for auto-refresh

    return () => clearInterval(intervalId);
  }, [selectedYear, selectedMonth]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

  const months = useMemo(
    () => [
      { value: '0', label: 'January' },
      { value: '1', label: 'February' },
      { value: '2', label: 'March' },
      { value: '3', label: 'April' },
      { value: '4', label: 'May' },
      { value: '5', label: 'June' },
      { value: '6', label: 'July' },
      { value: '7', label: 'August' },
      { value: '8', label: 'September' },
      { value: '9', label: 'October' },
      { value: '10', label: 'November' },
      { value: '11', label: 'December' },
    ],
    []
  );

  // Filter keys
  const filteredData = useMemo(() => {
    // data is already filtered by year/month on the server.
    // Client-side filtering here was causing orders to disappear if they were updated in a different month.
    return data;
  }, [data]);

  // Apply Search and Sort
  const processedData = useMemo(() => {
    let result = [...filteredData];

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        item =>
          item.OrderID.toString().includes(query) ||
          item.CompanyName?.toLowerCase().includes(query) ||
          item.SalesPerson?.toLowerCase().includes(query) ||
          item.Location?.toLowerCase().includes(query) ||
          item.Remark?.toLowerCase().includes(query)
      );
    }

    // Sort by selected column
    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;

        // Handle numeric sorting for OrderID
        if (sortConfig.key === 'OrderID') {
          return sortConfig.direction === 'asc'
            ? Number(aValue) - Number(bValue)
            : Number(bValue) - Number(aValue);
        }

        // Handle date sorting
        if (sortConfig.key === 'OrderCreatedDate') {
          const dateA = new Date(aValue as string).getTime();
          const dateB = new Date(bValue as string).getTime();
          return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
        }

        // String sorting for other columns
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }

        return 0;
      });
    }

    return result;
  }, [filteredData, searchQuery, sortConfig]);

  // Handle Sort Request
  const handleSort = (key: keyof CancelledOrder) => {
    setSortConfig(current => {
      if (current?.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  // Pagination
  const totalPages = Math.ceil(processedData.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedData = processedData.slice(startIndex, startIndex + rowsPerPage);

  // Stats
  const stats = useMemo(() => {
    const totalCancelledCount = filteredData.length;
    let totalOrders = 0;
    let totalAmount = 0;

    filteredData.forEach(order => {
      const amt = parseFloat(order.Amount || '0');
      if (!isNaN(amt)) totalAmount += amt;
    });

    // Use orderCounts from server if available for better accuracy
    if (orderCounts && orderCounts.length > 0) {
      if (selectedMonth !== '') {
        const matching = orderCounts.find(
          c =>
            c.year.toString() === selectedYear &&
            c.month.toString() === (parseInt(selectedMonth) + 1).toString()
        );
        totalOrders = matching ? matching.count : 0;
      } else {
        totalOrders = orderCounts
          .filter(c => c.year.toString() === selectedYear)
          .reduce((sum, c) => sum + c.count, 0);
      }
    }

    // Fallback to client-side filter of allOrders if server counts are missing
    if (totalOrders === 0 && allOrders && allOrders.length > 0) {
      totalOrders = allOrders.filter(order => {
        const date = new Date(
          order.OrderCreatedDate ||
            (order as any).orderDate ||
            (order as any).order_date ||
            (order as any).createdAt
        );
        if (date.getFullYear().toString() !== selectedYear) return false;
        if (selectedMonth !== '' && date.getMonth().toString() !== selectedMonth) return false;
        return true;
      }).length;
    }

    const cancellationRate =
      totalOrders > 0 ? ((totalCancelledCount / totalOrders) * 100).toFixed(1) : '0.0';

    // Reason Breakdown
    const reasonMap: Record<string, number> = {};
    filteredData.forEach(order => {
      const remark = order.Remark?.trim() || 'No Remark';
      const key = remark.length > 30 ? 'Other Reasons' : remark;
      reasonMap[key] = (reasonMap[key] || 0) + 1;
    });

    const topReasons = Object.entries(reasonMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      totalCancelledCount,
      totalAmount,
      cancellationRate,
      totalOrders,
      topReasons,
      label: selectedMonth !== '' ? '(Month)' : '(Year)',
    };
  }, [filteredData, allOrders, orderCounts, selectedYear, selectedMonth]);

  // Chart Data
  const chartData = useMemo(() => {
    let labels: string[] = [];
    let cancelledValues: number[] = [];
    let totalValues: number[] = [];
    let title = '';

    if (selectedMonth !== '') {
      const monthIndex = parseInt(selectedMonth);
      const daysInMonth = new Date(parseInt(selectedYear), monthIndex + 1, 0).getDate();

      labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
      const cCounts = new Array(daysInMonth).fill(0);
      const tCounts = new Array(daysInMonth).fill(0);

      // Cancelled Counts (using filteredData which is already filtered by UpdatedAt/OrderCreatedDate)
      filteredData.forEach(item => {
        const dateStr = item.UpdatedAt || item.OrderCreatedDate;
        const day = new Date(dateStr).getDate();
        if (day >= 1 && day <= daysInMonth) cCounts[day - 1] += 1;
      });

      // Total Counts (using allOrders, based on Creation Date)
      allOrders.forEach(order => {
        const date = new Date(
          order.OrderCreatedDate ||
            (order as any).orderDate ||
            (order as any).order_date ||
            (order as any).createdAt
        );
        if (
          date.getFullYear().toString() === selectedYear &&
          date.getMonth().toString() === selectedMonth
        ) {
          const day = date.getDate();
          if (day >= 1 && day <= daysInMonth) tCounts[day - 1] += 1;
        }
      });

      cancelledValues = cCounts;
      totalValues = tCounts;
      title = `Daily Cancelled Orders (${months[monthIndex].label} ${selectedYear})`;
    } else {
      const cCounts = new Array(12).fill(0);
      const tCounts = new Array(12).fill(0);

      filteredData.forEach(item => {
        const dateStr = item.UpdatedAt || item.OrderCreatedDate;
        const month = new Date(dateStr).getMonth();
        if (month >= 0 && month < 12) cCounts[month] += 1;
      });

      allOrders.forEach(order => {
        const date = new Date(
          order.OrderCreatedDate ||
            (order as any).orderDate ||
            (order as any).order_date ||
            (order as any).createdAt
        );
        if (date.getFullYear().toString() === selectedYear) {
          const month = date.getMonth();
          if (month >= 0 && month < 12) tCounts[month] += 1;
        }
      });

      labels = months.map(m => m.label);
      cancelledValues = cCounts;
      totalValues = tCounts;
      title = `Cancelled Orders by Month (${selectedYear})`;
    }

    return {
      labels,
      datasets: [
        {
          label: 'Cancelled Orders',
          data: cancelledValues,
          backgroundColor: 'rgba(239, 68, 68, 0.7)',
          hoverBackgroundColor: 'rgba(239, 68, 68, 0.9)',
          borderColor: 'rgb(239, 68, 68)',
          borderWidth: 1,
          borderRadius: 4,
          barThickness: selectedMonth !== '' ? 12 : 30,
        },
        {
          label: 'Total Orders',
          data: totalValues,
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderColor: 'rgba(59, 130, 246, 0.3)',
          borderWidth: 1,
          borderRadius: 4,
          barThickness: selectedMonth !== '' ? 18 : 40,
        },
      ],
      title,
    };
  }, [filteredData, allOrders, months, selectedYear, selectedMonth]);

  const hasDataForChart = useMemo(() => {
    return chartData.datasets.some(dataset => dataset.data.some(val => (val as number) > 0));
  }, [chartData]);

  // Export functions
  const exportToPDF = async () => {
    if (exportLoading) return;
    try {
      setExportLoading(true);
      if (setShowExportOptions) setShowExportOptions(false);

      const { default: jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // Add Header
      const startY = addPdfHeader(pdf, companyInfo, 'Cancelled Orders Report');

      // Add generation date
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(
        `Generated on: ${new Date().toLocaleDateString('en-IN')} | Total Records: ${filteredData.length}`,
        14,
        startY + 8
      );

      const columns = [
        { header: 'Order ID', width: 20 },
        { header: 'Company Name', width: 35 },
        { header: 'Order Date', width: 25 },
        { header: 'City', width: 25 },
        { header: 'Salesperson', width: 30 },
        { header: 'Remark', width: 40 },
        { header: 'Status', width: 25 },
      ];

      const tableData = filteredData.map(order => [
        `${order.OrderID}`,
        order.CompanyName || 'N/A',
        new Date(order.OrderCreatedDate).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        order.Location || 'N/A',
        order.SalesPerson || 'Unassigned',
        order.Remark || '-',
        order.Status || '-',
      ]);

      const pageHeight = pdf.internal.pageSize.getHeight();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 8;
      const contentWidth = pageWidth - 2 * margin;
      const headerHeight = 7;
      const rowHeight = 7;
      const startX = margin;
      const tableStartY = startY + 15;

      const totalColWidth = columns.reduce((sum, col) => sum + col.width, 0);
      const colWidths = columns.map(col => (col.width / totalColWidth) * contentWidth);

      // Draw header
      pdf.setFillColor(0, 102, 204);
      pdf.setDrawColor(0, 51, 153);
      let xPos = startX;
      columns.forEach((col, index) => {
        const colWidth = colWidths[index];
        pdf.rect(xPos, tableStartY, colWidth, headerHeight, 'FD');
        xPos += colWidth;
      });

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(255, 255, 255);
      xPos = startX;
      columns.forEach((col, index) => {
        const colWidth = colWidths[index];
        const cellCenterX = xPos + colWidth / 2;
        const cellCenterY = tableStartY + headerHeight / 2 + 1.5;
        pdf.text(col.header, cellCenterX, cellCenterY, { align: 'center', maxWidth: colWidth - 1 });
        xPos += colWidth;
      });

      let currentY = tableStartY + headerHeight;
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);

      tableData.forEach((row, rowIndex) => {
        if (currentY + rowHeight > pageHeight - 10) {
          pdf.addPage();
          currentY = 15;
          // Redraw header
          pdf.setFillColor(0, 102, 204);
          pdf.setDrawColor(0, 51, 153);
          xPos = startX;
          columns.forEach((col, index) => {
            const colWidth = colWidths[index];
            pdf.rect(xPos, currentY, colWidth, headerHeight, 'FD');
            xPos += colWidth;
          });
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(7.5);
          pdf.setTextColor(255, 255, 255);
          xPos = startX;
          columns.forEach((col, index) => {
            const colWidth = colWidths[index];
            const cellCenterX = xPos + colWidth / 2;
            const cellCenterY = currentY + headerHeight / 2 + 1.5;
            pdf.text(col.header, cellCenterX, cellCenterY, {
              align: 'center',
              maxWidth: colWidth - 1,
            });
            xPos += colWidth;
          });
          currentY += headerHeight;
          pdf.setTextColor(0, 0, 0);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(7);
        }

        xPos = startX;
        row.forEach((cellText, colIndex) => {
          const colWidth = colWidths[colIndex];
          if (rowIndex % 2 === 0) pdf.setFillColor(240, 245, 250);
          else pdf.setFillColor(255, 255, 255);

          pdf.rect(xPos, currentY, colWidth, rowHeight, 'F');
          pdf.setDrawColor(150, 150, 150);
          pdf.setLineWidth(0.2);
          pdf.rect(xPos, currentY, colWidth, rowHeight);
          xPos += colWidth;
        });

        xPos = startX;
        row.forEach((cellText, colIndex) => {
          const colWidth = colWidths[colIndex];
          const cellCenterX = xPos + colWidth / 2;
          const cellCenterY = currentY + rowHeight / 2 + 1.3;
          pdf.text(String(cellText), cellCenterX, cellCenterY, {
            align: 'center',
            maxWidth: colWidth - 1.5,
          });
          xPos += colWidth;
        });
        currentY += rowHeight;
      });

      // Add page numbers
      const pdfTotalPages = (pdf.internal as any).getNumberOfPages();
      const now = new Date();
      const downloadDate = now.toLocaleDateString('en-IN');
      const downloadTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      for (let i = 1; i <= pdfTotalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(9);
        pdf.setTextColor(100, 100, 100);
        pdf.text(`Page ${i} of ${pdfTotalPages}`, pageWidth / 2, pageHeight - 5, {
          align: 'center',
        });
        pdf.text(`Downloaded: ${downloadDate} | ${downloadTime}`, margin, pageHeight - 5);
      }

      addPdfFooter(pdf);

      const fileName = `Cancelled_Orders_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      showToast.success('PDF exported successfully!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      showToast.error('Failed to export PDF.');
    } finally {
      setExportLoading(false);
    }
  };

  const exportToExcel = () => {
    try {
      setShowExportOptions(false);
      setExportLoading(true);

      const headers = [
        'Order ID',
        'Company Name',
        'Order Date',
        'City',
        'Salesperson',
        'Remark',
        'Status',
      ];
      const csvContent = [
        headers.join(','),
        ...filteredData.map(order =>
          [
            order.OrderID,
            `"${(order.CompanyName || '').replace(/"/g, '""')}"`,
            `"${new Date(order.OrderCreatedDate).toLocaleDateString('en-IN')}"`,
            `"${(order.Location || '').replace(/"/g, '""')}"`,
            `"${(order.SalesPerson || '').replace(/"/g, '""')}"`,
            `"${(order.Remark || '').replace(/"/g, '""')}"`,
            `"${(order.Status || '').replace(/"/g, '""')}"`,
          ].join(',')
        ),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `Cancelled_Orders_Report_${new Date().toISOString().split('T')[0]}.csv`
      );
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      showToast.error('Failed to export Excel.');
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <PageHeader
          metadataPath="/reports/cancelled-orders"
          title="Cancellation Analytics"
          description="Detailed insights into order cancellations and revenue impact"
        />
      </div>

      {/* Modern Filter Bar */}
      <div className="bg-white p-4 border border-gray-200 rounded-2xl shadow-sm">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2 text-gray-500">
            <LucideFilter size={20} />
            <span className="font-semibold text-sm">Filters:</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative min-w-[160px]">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider absolute -top-2 left-3 bg-white px-1 z-10">
                Year
              </label>
              <select
                value={selectedYear}
                onChange={e => {
                  setSelectedYear(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-3 pr-10 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none appearance-none cursor-pointer transition-all font-medium text-slate-700"
              >
                {years.map(year => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <ArrowDown className="absolute right-3 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative min-w-[160px]">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider absolute -top-2 left-3 bg-white px-1 z-10">
                Month
              </label>
              <select
                value={selectedMonth}
                onChange={e => {
                  setSelectedMonth(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-3 pr-10 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none appearance-none cursor-pointer transition-all font-medium text-slate-700"
              >
                <option value="">Month</option>
                {months.map(month => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
              <ArrowDown className="absolute right-3 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-pulse">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-gray-100 rounded-2xl border border-gray-200"></div>
          ))}
          <div className="md:col-span-3 h-[400px] bg-gray-50 rounded-2xl border border-gray-200"></div>
          <div className="h-[400px] bg-gray-50 rounded-2xl border border-gray-200"></div>
        </div>
      ) : (
        <>
          {/* KPI Dashboard */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-red-100 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 bg-red-50 text-red-600 rounded-xl group-hover:bg-red-500 group-hover:text-white transition-colors shadow-sm">
                  <Ban className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Cancelled Orders
                  </p>
                  <p className="text-2xl font-black text-slate-800">{stats.totalCancelledCount}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-red-500 font-medium bg-red-50/50 w-fit px-2 py-1 rounded-lg">
                Current period
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-500 group-hover:text-white transition-colors shadow-sm">
                  <Percent className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Cancellation Rate
                  </p>
                  <p className="text-2xl font-black text-slate-800">{stats.cancellationRate}%</p>
                </div>
              </div>
              <p className="mt-4 text-[10px] text-gray-400 font-medium">
                Against {stats.totalOrders} total arrived orders
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-500 group-hover:text-white transition-colors shadow-sm">
                  <span className="font-bold text-lg">₹</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Revenue Impact
                  </p>
                  <p className="text-2xl font-black text-slate-800">
                    ₹{stats.totalAmount.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-emerald-600 font-medium bg-emerald-50/50 w-fit px-2 py-1 rounded-lg">
                Value loss
              </div>
            </div>
          </div>

          {/* Visualization Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">
                    Trend Analysis
                  </h3>
                  <p className="text-sm text-gray-400 font-medium">
                    Cancelled vs Total orders volume
                  </p>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-gray-400">
                    <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200"></div> Total
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-red-400">
                    <div className="w-3 h-3 rounded bg-red-400"></div> Cancelled
                  </div>
                </div>
              </div>
              <div className="h-[320px]">
                {hasDataForChart ? (
                  <Bar
                    data={chartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          backgroundColor: '#1e293b',
                          titleFont: { size: 13, weight: 'bold' },
                          padding: 12,
                          cornerRadius: 12,
                          callbacks: {
                            label: context => {
                              const idx = context.dataIndex;
                              const dataset = context.dataset;
                              const value = context.parsed.y;
                              if (dataset.label === 'Cancelled Orders') {
                                const total = chartData.datasets[1].data[idx] as number;
                                const rate =
                                  total > 0 && value != null
                                    ? ((value / total) * 100).toFixed(1)
                                    : 0;
                                return `🚫 ${dataset.label}: ${value} (${rate}%)`;
                              }
                              return `📊 ${dataset.label}: ${value}`;
                            },
                          },
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          grid: { display: true, color: '#f8fafc' },
                          ticks: { color: '#94a3b8', font: { size: 10 } },
                          border: { display: false },
                        },
                        x: {
                          grid: { display: false },
                          ticks: { color: '#64748b', font: { size: 10, weight: 600 } },
                          border: { display: false },
                        },
                      },
                    }}
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
                    <AlertCircle className="h-10 w-10 text-gray-200 mb-2" />
                    <p className="text-sm text-gray-400 font-medium">
                      Insufficient data for trend chart
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
              <h3 className="text-xl font-extrabold text-slate-800 tracking-tight mb-2">
                Reason Mix
              </h3>
              <p className="text-sm text-gray-400 font-medium mb-8">Top cancellation triggers</p>
              <div className="h-[250px] flex items-center justify-center">
                {stats.topReasons.length > 0 ? (
                  <Pie
                    data={{
                      labels: stats.topReasons.map(r => r[0]),
                      datasets: [
                        {
                          data: stats.topReasons.map(r => r[1]),
                          backgroundColor: ['#ef4444', '#f97316', '#3b82f6', '#6366f1', '#a855f7'],
                          borderWidth: 0,
                          hoverOffset: 15,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'bottom',
                          labels: {
                            boxWidth: 10,
                            padding: 20,
                            font: { size: 11, weight: 600 },
                            color: '#64748b',
                          },
                        },
                        tooltip: {
                          backgroundColor: '#1e293b',
                          padding: 12,
                          cornerRadius: 12,
                        },
                      },
                    }}
                  />
                ) : (
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Ban className="text-gray-200 h-8 w-8" />
                    </div>
                    <p className="text-xs text-gray-400 font-medium font-sans px-4">
                      No cancellation remarks recorded for this period
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Table Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div className="flex flex-1 gap-4">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search by ID, Company, Remark..."
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm shadow-sm transition-all"
                />
              </div>
            </div>

            {/* Export Button */}
            <div className="relative z-50">
              <div className="relative">
                <button
                  onClick={() => setShowExportOptions(!showExportOptions)}
                  disabled={exportLoading}
                  className={`flex items-center gap-2 px-6 py-2.5 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold text-sm shadow-md hover:shadow-lg`}
                  title="Export Report Data"
                >
                  {exportLoading ? (
                    <>
                      <Loader className="h-5 w-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="h-5 w-5" />
                      Export Report
                    </>
                  )}
                </button>

                {showExportOptions && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 border border-gray-200 z-50">
                    <button
                      onClick={exportToPDF}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      PDF
                    </button>
                    <button
                      onClick={exportToExcel}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Excel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--card-background)] shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--background)] border-b border-[var(--border-color)]">
                  <tr>
                    <th
                      className="px-6 py-3 text-left font-semibold text-[var(--foreground)] cursor-pointer hover:bg-[var(--background)]/80 transition-colors"
                      onClick={() => handleSort('OrderID')}
                    >
                      <span className="flex items-center gap-1">
                        Order ID
                        {sortConfig?.key === 'OrderID' &&
                          (sortConfig.direction === 'asc' ? (
                            <ArrowUp className="h-4 w-4" />
                          ) : (
                            <ArrowDown className="h-4 w-4" />
                          ))}
                      </span>
                    </th>
                    <th
                      className="px-6 py-3 text-left font-semibold text-[var(--foreground)] cursor-pointer hover:bg-[var(--background)]/80 transition-colors"
                      onClick={() => handleSort('CompanyName')}
                    >
                      <span className="flex items-center gap-1">
                        Company Name
                        {sortConfig?.key === 'CompanyName' &&
                          (sortConfig.direction === 'asc' ? (
                            <ArrowUp className="h-4 w-4" />
                          ) : (
                            <ArrowDown className="h-4 w-4" />
                          ))}
                      </span>
                    </th>
                    <th
                      className="px-6 py-3 text-left font-semibold text-[var(--foreground)] cursor-pointer hover:bg-[var(--background)]/80 transition-colors"
                      onClick={() => handleSort('OrderCreatedDate')}
                    >
                      <span className="flex items-center gap-1">
                        Order Date
                        {sortConfig?.key === 'OrderCreatedDate' &&
                          (sortConfig.direction === 'asc' ? (
                            <ArrowUp className="h-4 w-4" />
                          ) : (
                            <ArrowDown className="h-4 w-4" />
                          ))}
                      </span>
                    </th>
                    <th
                      className="px-6 py-3 text-left font-semibold text-[var(--foreground)] cursor-pointer hover:bg-[var(--background)]/80 transition-colors"
                      onClick={() => handleSort('Location')}
                    >
                      <span className="flex items-center gap-1">
                        City
                        {sortConfig?.key === 'Location' &&
                          (sortConfig.direction === 'asc' ? (
                            <ArrowUp className="h-4 w-4" />
                          ) : (
                            <ArrowDown className="h-4 w-4" />
                          ))}
                      </span>
                    </th>
                    <th
                      className="px-6 py-3 text-left font-semibold text-[var(--foreground)] cursor-pointer hover:bg-[var(--background)]/80 transition-colors"
                      onClick={() => handleSort('SalesPerson')}
                    >
                      <span className="flex items-center gap-1">
                        Sales Person
                        {sortConfig?.key === 'SalesPerson' &&
                          (sortConfig.direction === 'asc' ? (
                            <ArrowUp className="h-4 w-4" />
                          ) : (
                            <ArrowDown className="h-4 w-4" />
                          ))}
                      </span>
                    </th>
                    <th
                      className="px-6 py-3 text-left font-semibold text-[var(--foreground)] cursor-pointer hover:bg-[var(--background)]/80 transition-colors"
                      onClick={() => handleSort('Remark')}
                    >
                      <span className="flex items-center gap-1">
                        Order Remark
                        {sortConfig?.key === 'Remark' &&
                          (sortConfig.direction === 'asc' ? (
                            <ArrowUp className="h-4 w-4" />
                          ) : (
                            <ArrowDown className="h-4 w-4" />
                          ))}
                      </span>
                    </th>
                    <th
                      className="px-6 py-3 text-center font-semibold text-[var(--foreground)] cursor-pointer hover:bg-[var(--background)]/80 transition-colors"
                      onClick={() => handleSort('Status')}
                    >
                      <span className="flex items-center justify-center gap-1">
                        Status
                        {sortConfig?.key === 'Status' &&
                          (sortConfig.direction === 'asc' ? (
                            <ArrowUp className="h-4 w-4" />
                          ) : (
                            <ArrowDown className="h-4 w-4" />
                          ))}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {paginatedData.map(order => (
                    <tr
                      key={order.OrderID}
                      className="hover:bg-[var(--background)] transition-colors"
                    >
                      <td className="px-6 py-4 font-semibold text-[var(--primary)]">
                        {order.OrderID}
                      </td>
                      <td className="px-6 py-4 font-medium text-[var(--foreground)]">
                        {order.CompanyName}
                      </td>
                      <td className="px-6 py-4 text-[var(--text-secondary)]">
                        {new Date(order.OrderCreatedDate).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-full bg-[var(--primary)]/10 px-3 py-1 text-xs font-medium text-[var(--primary)]">
                          {order.Location || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[var(--foreground)]">
                        {order.SalesPerson || 'Unassigned'}
                      </td>
                      <td className="px-6 py-4 text-[var(--text-secondary)]">
                        {order.Remark || '-'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            order.Status?.toLowerCase().includes('reject')
                              ? 'bg-amber-100 text-amber-700'
                              : order.Status?.toLowerCase().includes('return')
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {order.Status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {paginatedData.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-8 text-center text-[var(--text-secondary)]"
                      >
                        No records found for the selected criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="border-t border-[var(--border-color)] bg-[var(--background)] px-6 py-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-[var(--text-secondary)]">Show rows:</label>
                  <select
                    value={rowsPerPage}
                    onChange={e => {
                      setRowsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="rounded-lg border border-[var(--border-color)] bg-[var(--input-background)] text-[var(--foreground)] px-3 py-1 text-sm focus:border-[var(--primary)] focus:outline-none"
                  >
                    {[10, 25, 50].map(option => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 rounded-lg border border-[var(--border-color)] px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--card-background)] transition-colors text-[var(--foreground)]"
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </button>
                  <div className="text-sm text-[var(--foreground)]">
                    Page {currentPage} of {totalPages || 1}
                  </div>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="flex items-center gap-1 rounded-lg border border-[var(--border-color)] px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--card-background)] transition-colors text-[var(--foreground)]"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CancelledOrdersReport;
