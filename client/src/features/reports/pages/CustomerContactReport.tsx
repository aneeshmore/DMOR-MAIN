import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  ChevronLeft,
  ChevronRight,
  Loader,
  AlertCircle,
  Download,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { PageHeader } from '@/components/common';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  TooltipItem,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { reportsApi } from '@/features/reports/api/reportsApi';
import { addPdfFooter, addPdfHeader } from '@/utils/pdfUtils';
import { companyApi } from '@/features/company/api/companyApi';
import { decodeHtml } from '@/utils/stringUtils';
import { CompanyInfo } from '@/features/company/types';
import { showToast } from '@/utils/toast';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

interface Customer {
  customerId: number;
  companyName: string;
  location: string;
  customerName: string;
  mobile1: string;
  mobile2?: string;
  dateOfBirth?: string;
  gstNo: string;
  salesPerson: string;
  salesPersonId?: number | null;
  isActive?: boolean;
  totalOrders?: number;
  totalRevenue?: number;
}

interface Employee {
  id: number;
  name: string;
  designation?: string;
}

const ROWS_PER_PAGE_OPTIONS = [25, 50, 100];

const CustomerContactReport: React.FC = () => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedSalesperson, setSelectedSalesperson] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);

  // Fetch company info
  useEffect(() => {
    companyApi.get().then(res => setCompanyInfo(res.data.data)).catch(console.error);
  }, []);

  // Fetch customers and orders on component mount or year change
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [custs, emps, ordersData] = await Promise.all([
          reportsApi.getCustomersForContactReport(10000),
          reportsApi.getSalespersons(),
          reportsApi.getAllOrders(),
        ]);
        const finalCusts: Customer[] = (custs as any) || [];
        let finalEmps: Employee[] = (emps as any) || [];

        // Explicitly filter frontend-side to ensure UI is correct immediately
        if (user?.Role === 'Sales Person' && user?.EmployeeID) {
          finalEmps = finalEmps.filter(e => String(e.id) === String(user.EmployeeID));
        }

        setCustomers(finalCusts);
        setEmployees(finalEmps);

        // Auto-select logged-in salesperson if found in the list
        if (user?.Role === 'Sales Person' && user?.EmployeeID) {
          const myEntry = finalEmps.find(e => String(e.id) === String(user.EmployeeID));
          if (myEntry) {
            setSelectedSalesperson(String(myEntry.id));
          }
        }
        setOrders(ordersData || []);
      } catch (err) {
        console.error('Error loading customers:', err);
        setError('Failed to load customer data');
        setCustomers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]); // Re-run if user matches (though user should be stable)

  // Get unique salespersons from loaded customers
  const salespersons = useMemo(
    () => employees.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [employees]
  );

  // Get unique cities
  const uniqueCities = useMemo(() => {
    const cities = new Set<string>();
    customers.forEach(c => {
      if (c.location) cities.add(c.location.trim());
    });
    return Array.from(cities).sort();
  }, [customers]);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Customer;
    direction: 'asc' | 'desc';
  } | null>(null);

  // Filter customers based on salesperson and city
  const filteredCustomers = useMemo(() => {
    // Filter customers based on salesperson assignment and city
    return customers.filter(customer => {
      // Check Salesperson Assignment
      if (selectedSalesperson) {
        if (selectedSalesperson === 'unassigned') {
          if (customer.salesPersonId != null) return false;
        } else {
          const selectedId = parseInt(selectedSalesperson, 10);
          if (customer.salesPersonId !== selectedId) return false;
        }
      }

      // Check City
      if (selectedCity) {
        if ((customer.location || '').trim() !== selectedCity) return false;
      }

      return true;
    });
  }, [customers, selectedSalesperson, selectedCity]);

  // Order stats per customer for the selected year
  const customerStatsMap = useMemo(() => {
    const stats: Record<number, { count: number; revenue: number }> = {};

    orders.forEach(order => {
      const cid = order.customerId || order.CustomerID || order.customer_id;
      if (cid) {
        if (!stats[cid]) {
          stats[cid] = { count: 0, revenue: 0 };
        }
        stats[cid].count += 1;
        stats[cid].revenue += parseFloat(order.totalAmount || 0);
      }
    });
    return stats;
  }, [orders]);

  // Apply Search and Sort
  const processedCustomers = useMemo(() => {
    let result = filteredCustomers.map(customer => ({
      ...customer,
      totalOrders: customerStatsMap[customer.customerId]?.count || 0,
      totalRevenue: customerStatsMap[customer.customerId]?.revenue || 0,
    }));

    // 1. Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(customer => {
        // Resolve salesperson name for search
        let salespersonName = customer.salesPerson || '';
        if ((!salespersonName || !isNaN(Number(salespersonName))) && customer.salesPersonId) {
          const emp = employees.find(e => e.id === customer.salesPersonId);
          if (emp) salespersonName = emp.name;
        }

        return (
          (customer.customerName && decodeHtml(customer.customerName).toLowerCase().includes(query)) ||
          (customer.companyName && decodeHtml(customer.companyName).toLowerCase().includes(query)) ||
          customer.customerId.toString().includes(query) ||
          (customer.location && decodeHtml(customer.location).toLowerCase().includes(query)) ||
          customer.mobile1?.includes(query) ||
          salespersonName.toLowerCase().includes(query)
        );
      });
    }

    // 2. Sort
    if (sortConfig) {
      result.sort((a, b) => {
        let aValue: any = a[sortConfig.key];
        let bValue: any = b[sortConfig.key];

        // Specific handling for Salesperson column sorting to sort by Name not ID string
        if (sortConfig.key === 'salesPerson') {
          let spNameA = a.salesPerson || '';
          if ((!spNameA || !isNaN(Number(spNameA))) && a.salesPersonId) {
            const emp = employees.find(e => e.id === a.salesPersonId);
            if (emp) spNameA = emp.name;
          }
          aValue = spNameA;

          let spNameB = b.salesPerson || '';
          if ((!spNameB || !isNaN(Number(spNameB))) && b.salesPersonId) {
            const emp = employees.find(e => e.id === b.salesPersonId);
            if (emp) spNameB = emp.name;
          }
          bValue = spNameB;
        }

        // Handle null/undefined
        if (aValue === undefined || aValue === null) aValue = '';
        if (bValue === undefined || bValue === null) bValue = '';

        // Case-insensitive string comparison
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }

        // Numeric comparison
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
        }

        // Fallback for other types or mixed types
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return result;
  }, [filteredCustomers, searchQuery, sortConfig, employees, customerStatsMap]);

  // Handle Sort Request
  const handleSort = (key: keyof Customer) => {
    setSortConfig(current => {
      if (current?.key === key) {
        if (current.direction === 'asc') return { key, direction: 'desc' };
        return null; // Reset if clicked again
      }
      return { key, direction: 'asc' };
    });
  };

  // Pagination
  const totalPages = Math.ceil(processedCustomers.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedCustomers = processedCustomers.slice(startIndex, startIndex + rowsPerPage);

  // Chart data
  const locationData = useMemo(() => {
    // We stick to filteredCustomers for chart as discussed
    const locationCounts = filteredCustomers.reduce(
      (acc, customer) => {
        const locationName = decodeHtml(customer.location)?.trim();
        if (!locationName) return acc;

        const existing = acc.find(item => item.name === locationName);
        if (existing) {
          existing.total += 1;
          if (customer.isActive) {
            existing.active += 1;
          } else {
            existing.inactive += 1;
          }
        } else {
          acc.push({
            name: locationName,
            total: 1,
            active: customer.isActive ? 1 : 0,
            inactive: customer.isActive ? 0 : 1,
          });
        }
        return acc;
      },
      [] as { name: string; total: number; active: number; inactive: number }[]
    );
    return locationCounts.sort((a, b) => b.total - a.total);
  }, [filteredCustomers]);

  // Export to PDF function - Simple approach without jspdf-autotable
  const exportToPDF = async () => {
    if (exportLoading) return;

    try {
      setExportLoading(true);
      if (setShowExportOptions) setShowExportOptions(false); // Close dropdown if it exists
      console.log('Starting PDF export...');

      const { default: jsPDF } = await import('jspdf');

      console.log('Creating PDF with table data...');

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      // Add centralized header
      const startY = addPdfHeader(pdf, companyInfo, 'Customer Contact Report');

      // Add generation date
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(
        `Generated on: ${new Date().toLocaleDateString('en-IN')} | Total Records: ${processedCustomers.length}`,
        14,
        startY + 8
      );

      // Column definitions
      const columns = [
        { header: 'Sr. No.', width: 14 },
        { header: 'Company Name', width: 32 },
        { header: 'Customer Name', width: 32 },
        { header: 'City', width: 22 },
        { header: 'Mobile Number', width: 30 },
        { header: 'GST No', width: 22 },
        { header: 'Orders', width: 12 },
        { header: 'Revenue', width: 22 },
        { header: 'Status', width: 14 },
      ];

      // Convert data
      const tableData = processedCustomers.map((customer, index) => {
        let mobile = customer.mobile1 || 'N/A';
        if (customer.mobile2) {
          mobile += `\n${customer.mobile2}`;
        }
        return [
          `${index + 1}`,
          decodeHtml(customer.companyName) || 'N/A',
          decodeHtml(customer.customerName) || 'N/A',
          decodeHtml(customer.location) || 'N/A',
          mobile,
          customer.gstNo || 'N/A',
          `${customer.totalOrders || 0}`,
          `Rs. ${(customer.totalRevenue || 0).toLocaleString('en-IN')}`,
          customer.isActive ? 'Active' : 'Inactive',
        ];
      });

      const pageHeight = pdf.internal.pageSize.getHeight();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 10;
      const contentWidth = pageWidth - 2 * margin;
      const headerHeight = 9;
      const rowHeight = 7;
      const startX = margin;
      const tableStartY = startY + 15;

      // Calculate column widths based on content width
      const totalColWidth = columns.reduce((sum, col) => sum + col.width, 0);
      const colWidths = columns.map(col => (col.width / totalColWidth) * contentWidth);

      // Draw header row - Blue background with white text
      // First pass: Draw all filled blue rectangles
      pdf.setFillColor(0, 102, 204); // Deep Blue background
      pdf.setDrawColor(0, 51, 153); // Dark Blue border

      let xPos = startX;
      columns.forEach((col, index) => {
        const colWidth = colWidths[index];
        pdf.rect(xPos, tableStartY, colWidth, headerHeight, 'FD');
        xPos += colWidth;
      });

      // Second pass: Draw white text on top of blue background
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(255, 255, 255); // Pure White text

      xPos = startX;
      columns.forEach((col, index) => {
        const colWidth = colWidths[index];
        const cellCenterX = xPos + colWidth / 2;
        const cellCenterY = tableStartY + headerHeight / 2 + 1.5;
        pdf.text(col.header, cellCenterX, cellCenterY, {
          maxWidth: colWidth - 2,
          align: 'center',
        });
        xPos += colWidth;
      });

      let currentY = tableStartY + headerHeight;

      // Draw data rows
      pdf.setTextColor(0, 0, 0); // Black
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);

      tableData.forEach((row, rowIndex) => {
        // Check if we need a new page
        if (currentY + rowHeight > pageHeight - 10) {
          pdf.addPage();
          currentY = 15;

          // Redraw header on new page - First pass: blue rectangles
          pdf.setFillColor(0, 102, 204); // Deep Blue background
          pdf.setDrawColor(0, 51, 153); // Dark Blue border

          xPos = startX;
          columns.forEach((col, index) => {
            const colWidth = colWidths[index];
            pdf.rect(xPos, currentY, colWidth, headerHeight, 'FD');
            xPos += colWidth;
          });

          // Second pass: white text on blue
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(9);
          pdf.setTextColor(255, 255, 255); // Pure White text

          xPos = startX;
          columns.forEach((col, index) => {
            const colWidth = colWidths[index];
            const cellCenterX = xPos + colWidth / 2;
            const cellCenterY = currentY + headerHeight / 2 + 1.5;
            pdf.text(col.header, cellCenterX, cellCenterY, {
              maxWidth: colWidth - 2,
              align: 'center',
            });
            xPos += colWidth;
          });

          pdf.setTextColor(0, 0, 0);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(7);
          currentY += headerHeight;
        }

        // Draw cells - first pass: backgrounds and borders
        xPos = startX;
        row.forEach((cellText, colIndex) => {
          const colWidth = colWidths[colIndex];

          // Alternate row colors
          if (rowIndex % 2 === 0) {
            pdf.setFillColor(240, 245, 250); // Light blue
          } else {
            pdf.setFillColor(255, 255, 255); // White
          }

          // Draw background
          pdf.rect(xPos, currentY, colWidth, rowHeight, 'F');

          // Draw cell border
          pdf.setDrawColor(180, 180, 180);
          pdf.setLineWidth(0.2);
          pdf.rect(xPos, currentY, colWidth, rowHeight);

          xPos += colWidth;
        });

        // Draw text - second pass: after all backgrounds
        pdf.setTextColor(0, 0, 0);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);

        xPos = startX;
        row.forEach((cellText, colIndex) => {
          const colWidth = colWidths[colIndex];
          const cellCenterX = xPos + colWidth / 2;
          const cellCenterY = currentY + rowHeight / 2 + 1.3;

          // Draw centered text
          pdf.text(decodeHtml(String(cellText)), cellCenterX, cellCenterY, {
            maxWidth: colWidth - 2,
            align: 'center',
          });
          xPos += colWidth;
        });

        currentY += rowHeight;
      });

      // Add page numbers and download timestamp
      const pdfTotalPages = (pdf.internal as any).getNumberOfPages();
      const now = new Date();
      const downloadDate = now.toLocaleDateString('en-IN');
      const downloadTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      for (let i = 1; i <= pdfTotalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);
        pdf.text(`Page ${i} of ${pdfTotalPages}`, pageWidth / 2, pageHeight - 5, {
          align: 'center',
        });
        // Add download date and time at bottom left
        pdf.text(`Downloaded: ${downloadDate} | ${downloadTime}`, margin, pageHeight - 5);
      }

      addPdfFooter(pdf);

      const fileName = `Customer_Contact_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      console.log('Saving PDF as:', fileName);
      pdf.save(fileName);

      showToast.success('PDF exported successfully!');
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      showToast.error(
        'Failed to export PDF. Error: ' + (error instanceof Error ? error.message : 'Unknown error')
      );
    } finally {
      setExportLoading(false);
    }
  };

  const exportToExcel = () => {
    try {
      setShowExportOptions(false);
      setExportLoading(true);

      const headers = [
        'Sr. No.',
        'Company Name',
        'Customer Name',
        'City',
        'Mobile Number',
        'GST No',
        'Total Orders',
        'Total Revenue',
        'Status',
      ];

      const csvContent = [
        headers.join(','),
        ...processedCustomers.map((customer, index) => {
          const mobile =
            `${customer.mobile1 || ''} ${customer.mobile2 ? '/ ' + customer.mobile2 : ''}`.trim();
          return [
            index + 1,
            `"${(decodeHtml(customer.companyName) || '').replace(/"/g, '""')}"`,
            `"${(decodeHtml(customer.customerName) || '').replace(/"/g, '""')}"`,
            `"${(decodeHtml(customer.location) || '').replace(/"/g, '""')}"`,
            `"${mobile.replace(/"/g, '""')}"`,
            `"${(customer.gstNo || '').replace(/"/g, '""')}"`,
            customer.totalOrders || 0,
            customer.totalRevenue || 0,
            customer.isActive ? 'Active' : 'Inactive',
          ].join(',');
        }),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `Customer_Contact_Report_${new Date().toISOString().split('T')[0]}.csv`
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
    <div className="space-y-8">
      {/* Page Header */}
      <PageHeader
        title="Customer Contact Report"
        description="View and manage all customer information and contact details"
      />
      {/* Filters moved to top */}
      {!loading && !error && (
        <div className="card p-6">
          <h3 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 max-w-2xl gap-4">
            {/* Salesperson Filter */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
                Select Salesperson
              </label>
              <select
                value={selectedSalesperson}
                disabled={user?.Role === 'Sales Person'}
                onChange={e => {
                  setSelectedSalesperson(e.target.value);
                  setCurrentPage(1);
                }}
                className={`input ${user?.Role === 'Sales Person' ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
              >
                {user?.Role !== 'Sales Person' && <option value="">All Salespersons</option>}
                {salespersons.map(sp => (
                  <option key={sp.id} value={String(sp.id)}>
                    {sp.name}
                  </option>
                ))}
              </select>
            </div>

            {/* City Filter */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
                Select City
              </label>
              <select
                value={selectedCity}
                onChange={e => {
                  setSelectedCity(e.target.value);
                  setCurrentPage(1);
                }}
                className="input"
              >
                <option value="">All Cities</option>
                {uniqueCities.map(city => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Total Customers Card */}
      {!loading && !error && customers.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          <div className="card p-4">
            <div className="text-sm text-[var(--text-secondary)]">Total Customers</div>
            <div className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">
              {filteredCustomers.length}
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center card p-12">
          <Loader className="h-6 w-6 animate-spin text-[var(--primary)]" />
          <span className="ml-3 text-[var(--text-secondary)]">Loading customer data...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* No Data State */}
      {!loading && !error && customers.length === 0 && (
        <div className="card p-12 text-center">
          <p className="text-[var(--text-secondary)]">No customer data available</p>
        </div>
      )}

      {/* No Results State (Filtered) */}
      {!loading && !error && customers.length > 0 && processedCustomers.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--background)] p-12 text-center">
          <AlertCircle className="mb-3 h-10 w-10 text-[var(--text-secondary)]" />
          <p className="text-lg font-medium text-[var(--text-primary)]">
            No customer details found
          </p>
          <p className="text-sm text-[var(--text-secondary)]">
            {searchQuery
              ? `No matches found for "${searchQuery}"`
              : selectedSalesperson || selectedCity
                ? 'Try adjusting your filters to see more results'
                : 'No customers available'}
          </p>
        </div>
      )}

      {/* Visualizations - Only show when data is loaded */}
      {!loading && filteredCustomers.length > 0 && (
        <div className="grid grid-cols-1 gap-6">
          {/* Location Distribution */}
          <div className="card p-6">
            <h3 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
              Customers by City
            </h3>
            <div style={{ height: '450px', position: 'relative', paddingBottom: '20px' }}>
              <Bar
                data={{
                  labels: locationData.map(item => item.name),
                  datasets: [
                    {
                      label: 'Active Customers',
                      data: locationData.map(item => item.active),
                      backgroundColor: 'rgba(34, 197, 94, 0.85)', // Green
                      borderColor: 'rgb(34, 197, 94)',
                      borderWidth: 1,
                      borderRadius: 4,
                      barThickness: 40,
                    },
                    {
                      label: 'Inactive Customers',
                      data: locationData.map(item => item.inactive),
                      backgroundColor: 'rgba(239, 68, 68, 0.85)', // Red
                      borderColor: 'rgb(239, 68, 68)',
                      borderWidth: 1,
                      borderRadius: 4,
                      barThickness: 40,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  layout: {
                    padding: {
                      top: 20,
                      bottom: 20,
                      left: 10,
                      right: 10,
                    },
                  },
                  plugins: {
                    legend: {
                      display: true,
                      position: 'top',
                      labels: {
                        usePointStyle: true,
                        boxWidth: 8,
                      },
                    },
                    tooltip: {
                      enabled: true,
                      backgroundColor: 'rgba(0, 0, 0, 0.9)',
                      padding: 12,
                      titleFont: {
                        size: 14,
                        weight: 'bold' as const,
                      },
                      bodyFont: {
                        size: 13,
                      },
                      callbacks: {
                        label: function (context: TooltipItem<'bar'>) {
                          const value = context.parsed.y ?? 0;
                          const datasetLabel = context.dataset.label;
                          const dataIndex = context.dataIndex;
                          const locationItem = locationData[dataIndex];
                          const total = locationItem.total;
                          const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                          return `${datasetLabel}: ${value} (${percentage}%)`;
                        },
                        footer: function (tooltipItems) {
                          const dataIndex = tooltipItems[0].dataIndex;
                          const total = locationData[dataIndex].total;
                          return `Total: ${total}`;
                        },
                      },
                    },
                  },
                  scales: {
                    y: {
                      stacked: true,
                      beginAtZero: true,
                      ticks: {
                        stepSize: 1,
                        precision: 0,
                        font: {
                          size: 12,
                        },
                        color: '#6B7280',
                      },
                      grid: {
                        color: 'rgba(0, 0, 0, 0.06)',
                      },
                      border: {
                        display: false,
                      },
                    },
                    x: {
                      stacked: true,
                      ticks: {
                        display: true,
                        font: {
                          size: 12,
                          weight: 'bold' as const,
                        },
                        color: '#1F2937',
                        autoSkip: false,
                        maxRotation: 45,
                        minRotation: 0,
                      },
                      grid: {
                        display: false,
                      },
                      border: {
                        display: false,
                      },
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Actions Bar: Search and Sort and Export */}
      {!loading && !error && processedCustomers.length > 0 && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex flex-1 gap-4">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search by ID, Name, Salesperson..."
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
                className="flex items-center gap-2 px-6 py-2.5 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 disabled:bg-[var(--primary)]/50 disabled:cursor-not-allowed transition-colors font-semibold text-sm shadow-md hover:shadow-lg"
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
      )}

      {/* Table */}
      {!loading && processedCustomers.length > 0 && (
        <div
          id="customer-table"
          className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--card-background)] shadow-sm"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--background)] border-b border-[var(--border-color)]">
                <tr>
                  {[
                    { key: 'srNo', label: 'Sr. No.' },
                    { key: 'companyName', label: 'Company Name' },
                    { key: 'customerName', label: 'Customer Name' },
                    { key: 'location', label: 'City' },
                    { key: 'mobile1', label: 'Mobile Number' },
                    { key: 'gstNo', label: 'GST No' },
                    { key: 'totalOrders', label: 'Orders' },
                    { key: 'totalRevenue', label: 'Revenue' },
                    { key: 'isActive', label: 'Status' },
                  ].map(column => (
                    <th
                      key={column.key}
                      onClick={() =>
                        column.key !== 'srNo' && handleSort(column.key as keyof Customer)
                      }
                      className={`px-6 py-3 text-left text-sm font-semibold text-[var(--foreground)] ${column.key !== 'srNo' ? 'cursor-pointer hover:bg-gray-50' : ''} transition-colors group select-none`}
                    >
                      <div className="flex items-center gap-1">
                        {column.label}
                        {column.key !== 'srNo' ? (
                          sortConfig?.key === column.key ? (
                            sortConfig.direction === 'asc' ? (
                              <ArrowUp className="h-4 w-4 text-blue-600" />
                            ) : (
                              <ArrowDown className="h-4 w-4 text-blue-600" />
                            )
                          ) : (
                            <ArrowUpDown className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )
                        ) : null}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {paginatedCustomers.length > 0 ? (
                  paginatedCustomers.map((customer, index) => {
                    return (
                      <tr
                        key={customer.customerId}
                        className="hover:bg-[var(--background)] transition-colors"
                      >
                        <td className="px-6 py-4 text-sm font-medium text-[var(--primary)]">
                          {startIndex + index + 1}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-[var(--foreground)]">
                          {decodeHtml(customer.companyName)}
                        </td>
                        <td className="px-6 py-4 text-sm text-[var(--foreground)]">
                          {decodeHtml(customer.customerName)}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className="inline-flex rounded-full bg-[var(--primary)]/10 px-3 py-1 text-xs font-medium text-[var(--primary)]">
                            {decodeHtml(customer.location) || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-[var(--foreground)]">
                          {customer.mobile1 ? <div>{customer.mobile1}</div> : null}
                          {customer.mobile2 ? (
                            <div className="text-[var(--text-secondary)] mt-1">
                              {customer.mobile2}
                            </div>
                          ) : null}
                          {!customer.mobile1 && !customer.mobile2 && 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm text-[var(--foreground)]">
                          {customer.gstNo || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm text-[var(--foreground)]">
                          {customer.totalOrders || 0}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-green-600">
                          ₹{(customer.totalRevenue || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${customer.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                              }`}
                          >
                            {customer.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-[var(--text-secondary)]">
                      No customers found matching your criteria
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="border-t border-[var(--border-color)] bg-[var(--background)] px-6 py-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              {/* Rows per page */}
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
                  {ROWS_PER_PAGE_OPTIONS.map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pagination controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 rounded-lg border border-[var(--border-color)] px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--card-background)] transition-colors text-[var(--foreground)]"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>

                <div className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                  <span>
                    Page {currentPage} of {totalPages || 1}
                  </span>
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="flex items-center gap-1 rounded-lg border border-[var(--border-color)] px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--card-background)] transition-colors text-[var(--foreground)]"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerContactReport;
