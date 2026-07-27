import React, { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/common';
import {
  Loader,
  Download,
  DollarSign,
  TrendingUp,
  Search,
  ChevronRight,
  ChevronLeft,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Colors } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { reportsApi } from '@/features/reports/api/reportsApi';
import { companyApi } from '@/features/company/api/companyApi';
import { CompanyInfo } from '@/features/company/types';
import { useAuth } from '@/contexts/AuthContext';
import { addPdfFooter, addPdfHeader } from '@/utils/pdfUtils';
import { showToast } from '@/utils/toast';

ChartJS.register(ArcElement, Tooltip, Legend, Colors);

interface ProductPL {
  productId: number;
  productName: string;
  orderQty: number;
  unitProductionCost: number;
  totalProductionCost: number;
  totalSellingPrice: number;
  grossProfit: number;
}

interface MasterProductPL {
  masterProductId: number;
  masterProductName: string;
  products: ProductPL[];
  totalGrossProfit: number;
  totalSales: number;
}

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50];

const ProfitLossReport = () => {
  const { user } = useAuth();
  const [data, setData] = useState<MasterProductPL[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);

  useEffect(() => {
    companyApi.get().then(res => setCompanyInfo(res.data.data)).catch(console.error);
  }, []);

  // Filter states
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(''); // '' means all months

  // Search & Sort & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{
    key: 'masterProductName' | 'totalSales' | 'totalGrossProfit';
    direction: 'asc' | 'desc';
  }>({ key: 'masterProductName', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => (currentYear - 5 + i).toString());
  }, []);

  const months = [
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
  ];

  const fetchReportData = async () => {
    setLoading(true);
    try {
      let startDate = '';
      let endDate = '';

      if (selectedMonth !== '') {
        // Specific Month
        const year = parseInt(selectedYear);
        const month = parseInt(selectedMonth);
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        // Format YYYY-MM-DD
        startDate = firstDay.toLocaleDateString('en-CA');
        endDate = lastDay.toLocaleDateString('en-CA');
      } else {
        // Whole Year
        const year = parseInt(selectedYear);
        startDate = `${year}-01-01`;
        endDate = `${year}-12-31`;
      }

      const result = await reportsApi.getProfitLossData(startDate, endDate);
      setData(result || []);
    } catch (error) {
      console.error('Failed to fetch P/L report', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth]);

  // Calculations
  const totalGrossProfit = useMemo(() => {
    return data.reduce((sum, item) => sum + item.totalGrossProfit, 0);
  }, [data]);

  const totalSales = useMemo(() => {
    return data.reduce((sum, item) => sum + item.totalSales, 0);
  }, [data]);

  // Process Data (Search & Sort)
  const processedData = useMemo(() => {
    let result = [...data];

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(master => {
        // Check master name
        if (master.masterProductName.toLowerCase().includes(query)) return true;
        // Check sub products
        return master.products.some(p => p.productName.toLowerCase().includes(query));
      });
    }

    // Sort
    if (sortConfig) {
      result.sort((a, b) => {
        if (sortConfig.key === 'masterProductName') {
          const valA = a.masterProductName || '';
          const valB = b.masterProductName || '';
          return sortConfig.direction === 'asc'
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        } else if (sortConfig.key === 'totalSales') {
          return sortConfig.direction === 'asc'
            ? a.totalSales - b.totalSales
            : b.totalSales - a.totalSales;
        } else if (sortConfig.key === 'totalGrossProfit') {
          return sortConfig.direction === 'asc'
            ? a.totalGrossProfit - b.totalGrossProfit
            : b.totalGrossProfit - a.totalGrossProfit;
        }
        return 0;
      });
    }

    return result;
  }, [data, searchQuery, sortConfig]);

  // Handle Sort Request
  const handleSort = (key: 'masterProductName' | 'totalSales' | 'totalGrossProfit') => {
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

  // Chart Data
  const chartData = useMemo(() => {
    return {
      labels: data.map(item => item.masterProductName),
      datasets: [
        {
          label: 'Gross Profit',
          data: data.map(item => (item.totalGrossProfit < 0 ? 0 : item.totalGrossProfit)),
          backgroundColor: [
            '#3B82F6',
            '#EF4444',
            '#10B981',
            '#F59E0B',
            '#8B5CF6',
            '#EC4899',
            '#14B8A6',
            '#F97316',
            '#6366F1',
            '#06B6D4',
          ],
          borderWidth: 1,
        },
      ],
    };
  }, [data]);

  // Export to PDF
  const exportToPDF = async () => {
    if (exportLoading) return;

    try {
      setExportLoading(true);
      setShowExportOptions(false);
      const { default: jsPDF } = await import('jspdf');

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pageHeight = pdf.internal.pageSize.getHeight();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 10;

      const startY = addPdfHeader(pdf, companyInfo, 'Profit & Loss Report');

      // Meta info
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const periodText =
        selectedMonth !== ''
          ? `${months[parseInt(selectedMonth)].label} ${selectedYear}`
          : `Year ${selectedYear}`;

      pdf.text(
        `Period: ${periodText} | Generated: ${new Date().toLocaleDateString('en-IN')}`,
        margin,
        startY + 10
      );

      // Columns
      // ID | Product Name | Order Qty | Unit Prod Cost | Total Prod Cost | Selling Price | Gross Profit | Total
      const columns = [
        { header: 'ID', width: 10 },
        { header: 'Product Name', width: 25 },
        { header: 'Order Qty', width: 10 },
        { header: 'Unit Prod Cost', width: 15 },
        { header: 'Total Prod Cost', width: 15 },
        { header: 'Selling Price', width: 15 },
        { header: 'Gross Profit', width: 15 },
        { header: 'Profit %', width: 10 },
        { header: 'Total', width: 15 },
      ];

      const contentWidth = pageWidth - 2 * margin;
      const totalColWidth = columns.reduce((sum, col) => sum + col.width, 0);
      const colWidths = columns.map(col => (col.width / totalColWidth) * contentWidth);

      const headerHeight = 8;
      const rowHeight = 7;
      let currentY = startY + 20;

      // Helper to draw header
      const drawHeader = () => {
        let x = margin;

        columns.forEach((col, i) => {
          const w = colWidths[i];

          // Draw Background
          pdf.setFillColor(0, 102, 204); // Blue
          pdf.rect(x, currentY, w, headerHeight, 'F');

          // Draw Text
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(8);
          pdf.setTextColor(255, 255, 255); // White

          // Align right for numeric columns except ID and Product Name
          const textX = i === 0 || i === 1 ? x + 2 : x + w - 2;
          const align = i === 0 || i === 1 ? 'left' : 'right';

          pdf.text(col.header, textX, currentY + 5, { align, maxWidth: w - 4 });
          x += w;
        });
        currentY += headerHeight;
      };

      // Draw initial header
      drawHeader();

      // Draw Rows
      pdf.setFontSize(8);

      processedData.forEach(master => {
        // Check Page break
        if (currentY + rowHeight * (master.products.length + 1) > pageHeight - 15) {
          pdf.addPage();
          currentY = 15;
          drawHeader();
        }

        // Draw Master Row (as a header for the group)
        // Show master totals aligned with columns
        // Name (Col 0-1) | Qty (2) | UnitCost (3) | TotalProdCost (4) | SellingPrice (5) | GP (6) | Profit% (7)
        // We will span ID to TotalProdCost for the name (Cols 0-4)
        // Actually, let's keep it simple: Name spans ID to TotalProdCost (Cols 0-4 -> 5 cols)

        // Draw Master Name Background
        pdf.setFillColor(240, 248, 255);
        pdf.rect(margin, currentY, contentWidth, rowHeight, 'F');
        pdf.setDrawColor(200, 200, 200);
        pdf.line(margin, currentY, margin + contentWidth, currentY);
        pdf.line(margin, currentY + rowHeight, margin + contentWidth, currentY + rowHeight);

        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);

        // Name covering first 5 columns
        pdf.text(master.masterProductName, margin + 2, currentY + 5);

        // Calculate X positions for aggregated columns
        let currentX = margin;
        for (let k = 0; k < 5; k++) currentX += colWidths[k]; // Skip 5 columns

        // Selling Price Total
        pdf.text(master.totalSales.toFixed(2), currentX + colWidths[5] - 2, currentY + 5, {
          align: 'right',
        });
        currentX += colWidths[5];

        // Gross Profit Total
        pdf.text(master.totalGrossProfit.toFixed(2), currentX + colWidths[6] - 2, currentY + 5, {
          align: 'right',
        });
        currentX += colWidths[6];

        // Profit %
        const masterProfitPercent =
          master.totalSales > 0 ? (master.totalGrossProfit / master.totalSales) * 100 : 0;
        pdf.text(`${masterProfitPercent.toFixed(2)}%`, currentX + colWidths[7] - 2, currentY + 5, {
          align: 'right',
        });
        currentX += colWidths[7];

        // Total Column (GP + %)
        pdf.text(
          `${master.totalGrossProfit.toFixed(2)}`,
          currentX + colWidths[8] - 2,
          currentY + 3,
          { align: 'right' }
        );
        pdf.setFontSize(6);
        pdf.text(
          `(${masterProfitPercent.toFixed(2)}%)`,
          currentX + colWidths[8] - 2,
          currentY + 6.5,
          { align: 'right' }
        );
        pdf.setFontSize(8);

        currentY += rowHeight;

        // Draw Products
        pdf.setFont('helvetica', 'normal');
        master.products.forEach(prod => {
          let x = margin;

          // Columns: ID, Prod Name, Qty, UnitCost, TotalCost, SellPrice, GP, Profit%
          const profitPercent =
            prod.totalSellingPrice > 0 ? (prod.grossProfit / prod.totalSellingPrice) * 100 : 0;

          const rowValues = [
            prod.productId.toString(),
            prod.productName,
            prod.orderQty.toString(),
            prod.unitProductionCost.toFixed(2),
            prod.totalProductionCost.toFixed(2),
            prod.totalSellingPrice.toFixed(2),
            prod.grossProfit.toFixed(2),
            `${profitPercent.toFixed(1)}%`,
            `${prod.grossProfit.toFixed(2)}\n(${profitPercent.toFixed(1)}%)`,
          ];

          rowValues.forEach((val, i) => {
            const w = colWidths[i];
            const textX = i === 0 || i === 1 ? x + 2 : x + w - 2;
            const align = i === 0 || i === 1 ? 'left' : 'right';

            // Color logic for GP
            if (i === 6 && prod.grossProfit < 0) {
              pdf.setTextColor(220, 38, 38); // Red
            } else {
              pdf.setTextColor(60, 60, 60);
            }

            if (i === 0 || i === 1) pdf.setTextColor(0, 0, 0); // Reset for name/id

            pdf.text(val, textX, currentY + 5, { align, maxWidth: w - 4 });
            x += w;
          });

          // Light border bottom
          pdf.setDrawColor(240, 240, 240);
          pdf.line(margin, currentY + rowHeight, margin + contentWidth, currentY + rowHeight);

          currentY += rowHeight;
        });
      });

      // Add Footer (Page Numbers & Date/Time)
      const pdfTotalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= pdfTotalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-IN');
        const timeStr = now.toLocaleTimeString('en-IN', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        pdf.text(`Generated: ${dateStr} ${timeStr}`, margin, pageHeight - 10);
        pdf.text(`Page ${i} of ${pdfTotalPages}`, pageWidth - margin, pageHeight - 10, {
          align: 'right',
        });
      }

      addPdfFooter(pdf);

      const fileName = `Profit_Loss_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      showToast.success('PDF exported successfully!');
    } catch (error) {
      console.error('PDF Export Error:', error);
      showToast.error('Error exporting PDF');
    } finally {
      setExportLoading(false);
    }
  };

  const exportToExcel = () => {
    try {
      setExportLoading(true);
      setShowExportOptions(false);

      const headers = [
        'Type',
        'ID',
        'Product Name',
        'Order Qty',
        'Unit Prod Cost',
        'Total Prod Cost',
        'Selling Price',
        'Gross Profit',
        'Profit %',
        'Total',
      ];
      const rows: string[] = [headers.join(',')];

      processedData.forEach(master => {
        // Master Row
        rows.push(
          [
            'Master Product',
            master.masterProductId,
            `"${master.masterProductName.replace(/"/g, '""')}"`,
            '',
            '',
            '',
            master.totalSales.toFixed(2),
            master.totalGrossProfit.toFixed(2),
            master.totalSales > 0
              ? `${((master.totalGrossProfit / master.totalSales) * 100).toFixed(2)}%`
              : '0.00%',
            // Total Column
            `${master.totalGrossProfit.toFixed(2)} (${master.totalSales > 0 ? ((master.totalGrossProfit / master.totalSales) * 100).toFixed(2) : '0.00'}%)`,
          ].join(',')
        );

        // Child Rows
        master.products.forEach(prod => {
          const profitPercent =
            prod.totalSellingPrice > 0 ? (prod.grossProfit / prod.totalSellingPrice) * 100 : 0;
          rows.push(
            [
              'SKU',
              prod.productId,
              `"${prod.productName.replace(/"/g, '""')}"`,
              prod.orderQty,
              prod.unitProductionCost.toFixed(2),
              prod.totalProductionCost.toFixed(2),
              prod.totalSellingPrice.toFixed(2),
              prod.grossProfit.toFixed(2),
              `${profitPercent.toFixed(2)}%`,
              `${prod.grossProfit.toFixed(2)} (${profitPercent.toFixed(2)}%)`,
            ].join(',')
          );
        });
      });

      const csvContent = rows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `Profit_Loss_Report_${new Date().toISOString().split('T')[0]}.csv`
      );
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting Excel:', error);
      showToast.error('Failed to export Excel.');
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader metadataPath="/reports/profit-loss"
        title="Profit Loss Report"
        description="Detailed analysis of production costs vs sales revenue."
      />

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Filters</h3>
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all min-w-[120px]"
            >
              {years.map(y => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all min-w-[140px]"
            >
              <option value="">All Months</option>
              {months.map(m => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading & Empty States */}
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border bg-white">
          <Loader className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : data.length === 0 ? (
        <div className="flex bg-white p-10 justify-center items-center rounded-xl border border-[var(--border)]">
          <p className="text-gray-500">No data found for the selected period.</p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border border-[var(--border)] shadow-sm">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-green-50 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Sales Revenue</p>
                  <h3 className="text-2xl font-bold text-gray-900">
                    ₹ {totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </h3>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-[var(--border)] shadow-sm">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Gross Profit</p>
                  <h3 className="text-2xl font-bold text-green-600">
                    ₹ {totalGrossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </h3>
                </div>
              </div>
            </div>
          </div>

          {/* Visualization */}
          <div className="bg-white p-6 rounded-xl border border-[var(--border)] shadow-sm flex flex-col items-center justify-center">
            <h3 className="text-lg font-semibold mb-6">Gross Profit Distribution</h3>
            <div className="w-full max-w-lg h-[400px] flex justify-center">
              <Pie
                data={chartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: { padding: 20, usePointStyle: true },
                    },
                  },
                }}
              />
            </div>
          </div>

          {/* Actions Bar: Search, Sort, Export */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-1 gap-4">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search by Product Name..."
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm shadow-sm transition-all"
                />
              </div>
            </div>

            {/* Export Button - Dropdown */}
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

          {/* Custom Table with Matching Styling */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="h-12 px-6 text-left align-middle font-semibold text-gray-900 whitespace-nowrap w-24">
                      Product ID
                    </th>
                    <th
                      className="h-12 px-6 text-left align-middle font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap min-w-[200px]"
                      onClick={() => handleSort('masterProductName')}
                    >
                      <span className="flex items-center gap-1">
                        Product Name
                        {sortConfig?.key === 'masterProductName' &&
                          (sortConfig.direction === 'asc' ? (
                            <ArrowUp className="h-4 w-4" />
                          ) : (
                            <ArrowDown className="h-4 w-4" />
                          ))}
                      </span>
                    </th>
                    <th className="h-12 px-6 text-right align-middle font-semibold text-gray-900 whitespace-nowrap">
                      Order Qty
                    </th>
                    <th className="h-12 px-6 text-right align-middle font-semibold text-gray-900 whitespace-nowrap">
                      Unit Prod. Cost
                    </th>
                    <th className="h-12 px-6 text-right align-middle font-semibold text-gray-900 whitespace-nowrap">
                      Total Prod. Cost
                    </th>
                    <th
                      className="h-12 px-6 text-right align-middle font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap"
                      onClick={() => handleSort('totalSales')}
                    >
                      <span className="flex items-center justify-end gap-1">
                        Selling Price
                        {sortConfig?.key === 'totalSales' &&
                          (sortConfig.direction === 'asc' ? (
                            <ArrowUp className="h-4 w-4" />
                          ) : (
                            <ArrowDown className="h-4 w-4" />
                          ))}
                      </span>
                    </th>
                    <th
                      className="h-12 px-6 text-right align-middle font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap"
                      onClick={() => handleSort('totalGrossProfit')}
                    >
                      <span className="flex items-center justify-end gap-1">
                        Gross Profit
                        {sortConfig?.key === 'totalGrossProfit' &&
                          (sortConfig.direction === 'asc' ? (
                            <ArrowUp className="h-4 w-4" />
                          ) : (
                            <ArrowDown className="h-4 w-4" />
                          ))}
                      </span>
                    </th>
                    <th className="h-12 px-6 text-right align-middle font-semibold text-gray-900 whitespace-nowrap">
                      Profit %
                    </th>
                    <th className="h-12 px-6 text-right align-middle font-semibold text-gray-900 whitespace-nowrap">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedData.map(master => (
                    <React.Fragment key={master.masterProductId}>
                      {/* Master Row */}
                      <tr className="bg-gray-50/50 hover:bg-gray-50 transition-colors border-b border-gray-200">
                        <td
                          className="px-6 py-4 font-bold text-[var(--primary)] text-left"
                          colSpan={5}
                        >
                          {master.masterProductName}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-gray-900 border-l border-gray-200">
                          ₹ {master.totalSales.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-gray-900 border-l border-gray-200">
                          ₹ {master.totalGrossProfit.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-gray-900 border-l border-gray-200">
                          {master.totalSales > 0
                            ? `${((master.totalGrossProfit / master.totalSales) * 100).toFixed(2)}%`
                            : '0.00%'}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-gray-900 border-l border-gray-200">
                          <div>₹ {master.totalGrossProfit.toFixed(2)}</div>
                          <div className="text-xs text-gray-500 font-normal">
                            (
                            {master.totalSales > 0
                              ? ((master.totalGrossProfit / master.totalSales) * 100).toFixed(2)
                              : '0.00'}
                            %)
                          </div>
                        </td>
                      </tr>
                      {/* Product Rows */}
                      {master.products.map(prod => (
                        <tr
                          key={prod.productId}
                          className="hover:bg-gray-50 transition-colors border-b last:border-0 border-gray-200"
                        >
                          <td className="px-6 py-4 pl-10 text-gray-500">{prod.productId}</td>
                          <td className="px-6 py-4 text-gray-900">{prod.productName}</td>
                          <td className="px-6 py-4 text-right text-gray-900">{prod.orderQty}</td>
                          <td className="px-6 py-4 text-right text-gray-900">
                            ₹ {prod.unitProductionCost.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-right text-gray-900">
                            ₹ {prod.totalProductionCost.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-right text-gray-900">
                            ₹ {prod.totalSellingPrice.toFixed(2)}
                          </td>
                          <td
                            className={`px-6 py-4 text-right font-medium ${prod.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}
                          >
                            ₹ {prod.grossProfit.toFixed(2)}
                          </td>
                          <td
                            className={`px-6 py-4 text-right font-medium ${prod.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}
                          >
                            {prod.totalSellingPrice > 0
                              ? ((prod.grossProfit / prod.totalSellingPrice) * 100).toFixed(2)
                              : '0.00'}
                            %
                          </td>
                          <td className="px-6 py-4 text-right font-medium border-l border-gray-200">
                            <div
                              className={`${prod.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}
                            >
                              ₹ {prod.grossProfit.toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-500">
                              (
                              {prod.totalSellingPrice > 0
                                ? ((prod.grossProfit / prod.totalSellingPrice) * 100).toFixed(2)
                                : '0.00'}
                              %)
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="border-t border-gray-200 bg-white px-6 py-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-500">Show master products:</label>
                  <select
                    value={rowsPerPage}
                    onChange={e => {
                      setRowsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="rounded-lg border border-gray-300 bg-white text-gray-900 px-3 py-1 text-sm focus:border-[var(--primary)] focus:outline-none"
                  >
                    {ROWS_PER_PAGE_OPTIONS.map(option => (
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
                    className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors text-gray-900"
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </button>
                  <div className="text-sm text-gray-900">
                    Page {currentPage} of {totalPages || 1}
                  </div>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors text-gray-900"
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

export default ProfitLossReport;
