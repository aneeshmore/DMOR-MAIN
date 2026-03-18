import React, { useState, useMemo, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Loader,
  Users,
  DollarSign,
  AlertCircle,
  Download,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { PageHeader } from '@/components/common';
import { formatDate, formatDateTime } from '@/utils/dateUtils';
import { decodeHtml } from '@/utils/stringUtils';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  ChartOptions,
  TooltipItem,
  Filler,
} from 'chart.js';
import { Doughnut, Line, Bar } from 'react-chartjs-2';
import { reportsApi } from '@/features/reports/api/reportsApi';
import apiClient from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { addPdfFooter, addPdfHeader } from '@/utils/pdfUtils';
import { CompanyInfo } from '@/features/company/types';
import { companyApi } from '@/features/company/api/companyApi';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1/';

interface CustomerMonthlyData {
  customerId: number;
  companyName: string;
  contactPerson: string;
  location: string;
  district: string;
  pincode: string;
  contactNo: string;
  salesPersonId: number | null;
  monthlyAmounts: number[]; // 12 months
  totalAmount: number;
}

interface Employee {
  id: number;
  name: string;
  designation?: string;
}

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const CustomerReport: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.Role === 'Admin';
  const isSalesPerson = user?.Role === 'Sales Person';

  const [customerData, setCustomerData] = useState<CustomerMonthlyData[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedSalesperson, setSelectedSalesperson] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{
    key: keyof CustomerMonthlyData;
    direction: 'asc' | 'desc';
  } | null>({ key: 'companyName', direction: 'asc' });
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [districtByPincode, setDistrictByPincode] = useState<Record<string, string>>({});

  // Fetch Company Info
  useEffect(() => {
    const fetchCompanyInfo = async () => {
      try {
        const res = await companyApi.get();
        if (res.data) {
          setCompanyInfo((res.data as any).data || res.data);
        }
      } catch (err) {
        console.error("Failed to fetch company info", err);
      }
    };
    fetchCompanyInfo();
  }, []);

  // Set default salesperson for sales person role
  useEffect(() => {
    if (isSalesPerson && user?.EmployeeID && !selectedSalesperson) {
      setSelectedSalesperson(String(user.EmployeeID));
    }
  }, [isSalesPerson, user?.EmployeeID, selectedSalesperson]);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch employees, orders, and customers with higher limits and cache busting
        const [empsResponse, ordersResponse, customersResponse] = await Promise.all([
          apiClient.get('employees', { params: { limit: 1000, _t: Date.now() } }),
          apiClient.get('orders', { params: { limit: 10000, _t: Date.now() } }),
          apiClient.get('masters/customers', { params: { limit: 5000, _t: Date.now() } }),
        ]);

        const emps = empsResponse.data.data || [];
        const orders = ordersResponse.data.data || [];
        const customers = customersResponse.data.data || [];

        console.log('Fetched data:', {
          employees: emps.length,
          orders: orders.length,
          customers: customers.length,
        });

        // Map employees
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const employeeList = emps.map((emp: any) => ({
          id: emp.EmployeeID ?? emp.employeeId ?? emp.employee_id,
          name:
            emp.EmployeeName ??
            `${emp.FirstName ?? emp.firstName ?? ''} ${emp.LastName ?? emp.lastName ?? ''}`.trim(),
          designation: emp.Designation?.DesignationName ?? emp.designation ?? '',
        }));

        setEmployees(employeeList);

        // Create customer map with basic info
        const customerMap = new Map<number, CustomerMonthlyData>();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        customers.forEach((customer: any) => {
          const customerId = customer.CustomerID ?? customer.customerId ?? customer.customer_id;
          const mobileNo = customer.MobileNo ?? customer.mobileNo ?? customer.mobile_no;
          const contactNo = Array.isArray(mobileNo) ? mobileNo[0] : (mobileNo ?? 'N/A');

          customerMap.set(customerId, {
            customerId,
            companyName:
              customer.CompanyName ?? customer.companyName ?? customer.company_name ?? 'N/A',
            contactPerson:
              customer.ContactPerson ?? customer.contactPerson ?? customer.contact_person ?? 'N/A',
            location: customer.Location ?? customer.location ?? customer.city ?? '',
            district: customer.District ?? customer.district ?? '',
            pincode: customer.Pincode ?? customer.pincode ?? customer.pinCode ?? customer.pin_code ?? '',
            contactNo,
            salesPersonId:
              customer.SalesPersonId ?? customer.salesPersonId ?? customer.sales_person_id ?? null,
            monthlyAmounts: new Array(12).fill(0),
            totalAmount: 0,
          });
        });

        // Process orders and create customer-salesperson combinations
        const customerSalespersonOrders = new Map<
          string,
          {
            monthlyAmounts: number[];
            totalAmount: number;
            salespersonId: number;
          }
        >();

        let processedOrders = 0;
        let skippedOrders = 0;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        orders.forEach((order: any) => {
          const customerId = order.CustomerID ?? order.customerId ?? order.customer_id;
          const salespersonId = order.SalespersonId ?? order.salespersonId ?? order.salesperson_id;
          const status = order.Status ?? order.status ?? '';

          // Skip cancelled orders or orders without required data
          if (
            status === 'Cancelled' ||
            status === 'Rejected' ||
            status === 'Returned' ||
            !customerId ||
            !salespersonId ||
            !customerMap.has(customerId)
          ) {
            skippedOrders++;
            return;
          }

          const orderDate = new Date(
            order.OrderDate ?? order.orderDate ?? order.order_date ?? order.createdAt
          );
          const orderYear = orderDate.getFullYear();
          const orderMonth = orderDate.getMonth(); // 0-11
          const amount = parseFloat(
            order.TotalAmount ?? order.totalAmount ?? order.total_amount ?? 0
          );

          // Only process orders for the selected year
          if (orderYear.toString() !== selectedYear) {
            return;
          }

          const key = `${customerId}-${salespersonId}`;

          if (!customerSalespersonOrders.has(key)) {
            customerSalespersonOrders.set(key, {
              monthlyAmounts: new Array(12).fill(0),
              totalAmount: 0,
              salespersonId,
            });
          }

          const orderData = customerSalespersonOrders.get(key)!;

          // Add to monthly amount for the selected year
          orderData.monthlyAmounts[orderMonth] += amount;
          // Calculate total from monthly amounts
          orderData.totalAmount += amount;
          processedOrders++;
        });

        console.log('Order processing:', {
          processedOrders,
          skippedOrders,
          customerSalespersonCombinations: customerSalespersonOrders.size,
          sampleKeys: Array.from(customerSalespersonOrders.keys()).slice(0, 10),
        });

        // Store the order data for filtering
        (
          window as unknown as {
            __customerSalespersonOrders: Map<
              string,
              { monthlyAmounts: number[]; totalAmount: number; salespersonId: number }
            >;
          }
        ).__customerSalespersonOrders = customerSalespersonOrders;
        (window as unknown as { __customerMap: Map<number, CustomerMonthlyData> }).__customerMap =
          customerMap;

        setCustomerData(Array.from(customerMap.values()));
      } catch (err) {
        console.error('Error loading customer report data:', err);
        setError('Failed to load customer report data');
        setCustomerData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedYear]);

  useEffect(() => {
    const fetchDistricts = async () => {
      const uniquePincodes = Array.from(
        new Set(
          customerData
            .map(customer => customer.pincode?.trim())
            .filter((pincode): pincode is string => /^\d{6}$/.test(pincode || ''))
        )
      ).filter(pincode => !districtByPincode[pincode]);

      if (uniquePincodes.length === 0) {
        return;
      }

      try {
        const responses = await Promise.all(
          uniquePincodes.map(async pincode => {
            const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
            const data = await response.json();

            return {
              pincode,
              district:
                data?.[0]?.Status === 'Success' ? data?.[0]?.PostOffice?.[0]?.District || '' : '',
            };
          })
        );

        setDistrictByPincode(prev => {
          const next = { ...prev };
          responses.forEach(({ pincode, district }) => {
            if (district) {
              next[pincode] = district;
            }
          });
          return next;
        });
      } catch (err) {
        console.error('Failed to fetch district details for customer report', err);
      }
    };

    fetchDistricts();
  }, [customerData, districtByPincode]);

  // Get unique years from current year - 5 to current year
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => (currentYear - 5 + i).toString());
  }, []);

  // Filter employees based on user role
  const filteredEmployees = useMemo(() => {
    if (isSalesPerson && user?.EmployeeID) {
      // For salespeople, only show their own name
      return employees.filter(emp => emp.id === user.EmployeeID);
    }
    // For admins, show all employees
    return employees;
  }, [employees, isSalesPerson, user?.EmployeeID]);

  // Filter customers by salesperson and month
  const filteredCustomers = useMemo(() => {
    const customerSalespersonOrders = (
      window as unknown as {
        __customerSalespersonOrders: Map<
          string,
          { monthlyAmounts: number[]; totalAmount: number; salespersonId: number }
        >;
      }
    ).__customerSalespersonOrders;

    // If order data isn't loaded yet, return empty array
    if (!customerSalespersonOrders) {
      return [];
    }

    let customers: CustomerMonthlyData[] = [];

    if (!selectedSalesperson) {
      // Show all customers with their total data across all salespersons
      customers = customerData.map(customer => {
        const allOrdersForCustomer = Array.from(customerSalespersonOrders.entries()).filter(
          ([key]: [string, unknown]) => key.startsWith(`${customer.customerId}-`)
        );

        const monthlyAmounts = new Array(12).fill(0);
        let totalAmount = 0;

        allOrdersForCustomer.forEach(
          ([, orderData]: [string, { monthlyAmounts: number[]; totalAmount: number }]) => {
            orderData.monthlyAmounts.forEach((amount: number, idx: number) => {
              monthlyAmounts[idx] += amount;
            });
            totalAmount += orderData.totalAmount;
          }
        );

        return {
          ...customer,
          monthlyAmounts,
          totalAmount,
        };
      });
    } else {
      // Filter customers by selected salesperson
      customerData.forEach(customer => {
        const key = `${customer.customerId}-${selectedSalesperson}`;
        const orderData = customerSalespersonOrders.get(key);

        if (orderData) {
          customers.push({
            ...customer,
            monthlyAmounts: orderData.monthlyAmounts,
            totalAmount: orderData.totalAmount,
            salesPersonId: orderData.salespersonId,
          });
        }
      });
    }

    // Apply month filter if selected
    if (selectedMonth !== '') {
      const monthIndex = parseInt(selectedMonth);
      customers = customers.filter(customer => customer.monthlyAmounts[monthIndex] > 0);
    }

    return customers;
  }, [customerData, selectedSalesperson, selectedMonth]);

  // Apply Search and Sort
  const processedCustomers = useMemo(() => {
    let result = [...filteredCustomers];

    // 1. Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        customer =>
          (customer.companyName && decodeHtml(customer.companyName).toLowerCase().includes(query)) ||
          (customer.contactPerson && decodeHtml(customer.contactPerson).toLowerCase().includes(query)) ||
          (customer.location && decodeHtml(customer.location).toLowerCase().includes(query)) ||
          customer.customerId.toString().includes(query)
      );
    }

    // 2. Sort
    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    } else {
      // Fallback currently defaults to company name ascending via state initialization,
      // but just in case it becomes null:
      result.sort((a, b) => (a.companyName || '').localeCompare(b.companyName || ''));
    }

    return result;
  }, [filteredCustomers, searchQuery, sortConfig]);

  // Handle Sort Request
  const handleSort = (key: keyof CustomerMonthlyData) => {
    setSortConfig(current => {
      if (current?.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  // Pagination
  const totalPages = Math.ceil(processedCustomers.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedCustomers = processedCustomers.slice(startIndex, startIndex + rowsPerPage);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalCustomers = filteredCustomers.length;
    const totalRevenue = filteredCustomers.reduce((sum, c) => sum + c.totalAmount, 0);
    const avgRevenuePerCustomer = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

    // Top 5 customers by revenue
    const top5Customers = [...filteredCustomers]
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5);

    // Monthly revenue trend
    const monthlyRevenue = new Array(12).fill(0);
    filteredCustomers.forEach(customer => {
      customer.monthlyAmounts.forEach((amount, index) => {
        monthlyRevenue[index] += amount;
      });
    });

    // Revenue by District
    const revenueByDistrict = filteredCustomers.reduce(
      (acc, customer) => {
        const district = decodeHtml(districtByPincode[customer.pincode] || customer.district) || 'N/A';
        const existing = acc.find(item => item.name === district);
        if (existing) {
          existing.value += customer.totalAmount;
        } else {
          acc.push({ name: district, value: customer.totalAmount });
        }
        return acc;
      },
      [] as { name: string; value: number }[]
    );

    return {
      totalCustomers,
      totalRevenue,
      avgRevenuePerCustomer,
      top5Customers,
      monthlyRevenue,
      revenueByDistrict: revenueByDistrict.sort((a, b) => b.value - a.value).slice(0, 8),
    };
  }, [districtByPincode, filteredCustomers]);

  // Chart data for monthly revenue trend
  const monthlyRevenueChartData = {
    labels: MONTHS,
    datasets: [
      {
        label: `Revenue ${selectedYear}`,
        data: stats.monthlyRevenue,
        backgroundColor: 'rgba(59, 130, 246, 0.2)', // More transparent for area fill
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 2,
        fill: true,
        tension: 0.4, // Smooth curve
        pointBackgroundColor: '#fff',
        pointBorderColor: 'rgb(59, 130, 246)',
        pointHoverBackgroundColor: 'rgb(59, 130, 246)',
        pointHoverBorderColor: '#fff',
      },
    ],
  };

  const monthlyRevenueChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          font: {
            size: 12,
            weight: 'bold' as const,
          },
          color: '#374151',
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 14,
          weight: 'bold' as const,
        },
        bodyFont: {
          size: 13,
        },
        callbacks: {
          label: function (context: TooltipItem<'line'>) {
            return `Revenue: ₹${(context.parsed.y as number).toLocaleString('en-IN', {
              maximumFractionDigits: 0,
            })}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          callback: function (value: string | number) {
            return '₹' + (Number(value) / 1000).toFixed(0) + 'K';
          },
          font: {
            size: 11,
          },
          color: '#6B7280',
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 11,
            weight: 'bold' as const,
          },
          color: '#374151',
        },
      },
    },
  };

  // Chart data for top customers
  const topCustomersChartData = {
    labels: stats.top5Customers.map(c => {
      const name = decodeHtml(c.companyName);
      return name.length > 15 ? name.substring(0, 15) + '...' : name;
    }),
    datasets: [
      {
        data: stats.top5Customers.map(c => c.totalAmount),
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(168, 85, 247, 0.8)',
          'rgba(236, 72, 153, 0.8)',
          'rgba(249, 115, 22, 0.8)',
          'rgba(34, 197, 94, 0.8)',
        ],
        borderColor: '#fff',
        borderWidth: 2,
        hoverOffset: 15,
      },
    ],
  };

  // Chart data for revenue by district
  const revenueByDistrictChartData = {
    labels: stats.revenueByDistrict.map(item => item.name),
    datasets: [
      {
        label: 'Revenue',
        data: stats.revenueByDistrict.map(item => item.value),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        hoverBackgroundColor: 'rgba(37, 99, 235, 1)',
        borderRadius: 6,
        maxBarThickness: 40,
      },
    ],
  };

  // Export to PDF function with improved table structure
  const exportToPDF = async () => {
    if (exportLoading) return;

    try {
      setExportLoading(true);
      console.log('Starting PDF export...');

      const { default: jsPDF } = await import('jspdf');

      console.log('Creating PDF with table data...');

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      // Add Header
      const headerEndY = addPdfHeader(pdf, companyInfo, 'Customer Sales Report');

      // Add generation date
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(
        `Generated on: ${formatDateTime(new Date())} | Total Records: ${processedCustomers.length}`,
        14,
        headerEndY + 5
      );

      // Column definitions - optimized for better display
      const columns = [
        { header: 'Company Name', width: 30 },
        { header: 'Contact Person', width: 22 },
        { header: 'Contact No', width: 22 },
        { header: 'District', width: 20 },
        ...MONTHS.map(month => ({ header: month, width: 10 })),
        { header: 'Total', width: 18 },
      ];

      // Convert data
      const tableData = processedCustomers.map(customer => [
        decodeHtml(customer.companyName),
        decodeHtml(customer.contactPerson),
        customer.contactNo,
        decodeHtml(customer.location),
        ...customer.monthlyAmounts.map(amt => (amt > 0 ? `Rs. ${(amt / 1000).toFixed(1)}K` : '-')),
        `Rs. ${(customer.totalAmount / 1000).toFixed(1)}K`,
      ]);

      const pageHeight = pdf.internal.pageSize.getHeight();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 8;
      const contentWidth = pageWidth - 2 * margin;
      const headerHeight = 7;
      const rowHeight = 7;
      const startX = margin;
      const startY = 38;

      // Calculate column widths based on content width
      const totalColWidth = columns.reduce((sum, col) => sum + col.width, 0);
      const colWidths = columns.map(col => (col.width / totalColWidth) * contentWidth);

      // Draw header row - Blue background with white text
      // First pass: Draw all blue rectangles
      pdf.setFillColor(0, 102, 204); // Deep Blue background
      pdf.setDrawColor(0, 51, 153); // Dark Blue border

      let xPos = startX;
      columns.forEach((col, index) => {
        const colWidth = colWidths[index];
        pdf.rect(xPos, startY, colWidth, headerHeight, 'FD');
        xPos += colWidth;
      });

      // Second pass: Draw white text on top
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(255, 255, 255); // Pure white text

      xPos = startX;
      columns.forEach((col, index) => {
        const colWidth = colWidths[index];
        const cellCenterX = xPos + colWidth / 2;
        const cellCenterY = startY + headerHeight / 2 + 1.5;
        pdf.text(col.header, cellCenterX, cellCenterY, {
          align: 'center',
        });
        xPos += colWidth;
      });

      let currentY = startY + headerHeight;

      // Draw data rows with proper structure
      pdf.setTextColor(0, 0, 0); // Black
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);

      tableData.forEach((row, rowIndex) => {
        // Check if we need a new page
        if (currentY + rowHeight > pageHeight - 10) {
          pdf.addPage();
          currentY = 15;

          // Redraw header on new page - Blue background with white text
          // First pass: Draw all blue rectangles
          pdf.setFillColor(0, 102, 204);
          pdf.setDrawColor(0, 51, 153);

          xPos = startX;
          columns.forEach((col, index) => {
            const colWidth = colWidths[index];
            pdf.rect(xPos, currentY, colWidth, headerHeight, 'FD');
            xPos += colWidth;
          });

          // Second pass: Draw white text on top
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(7.5);
          pdf.setTextColor(255, 255, 255); // Pure white text

          xPos = startX;
          columns.forEach((col, index) => {
            const colWidth = colWidths[index];
            const cellCenterX = xPos + colWidth / 2;
            const cellCenterY = currentY + headerHeight / 2 + 1.5;
            pdf.text(col.header, cellCenterX, cellCenterY, {
              align: 'center',
            });
            xPos += colWidth;
          });

          currentY += headerHeight;
          pdf.setTextColor(0, 0, 0);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(7);
        }

        // Draw cells for this row - first draw all backgrounds and borders
        xPos = startX;
        row.forEach((cellText, colIndex) => {
          const colWidth = colWidths[colIndex];

          // Determine background color for alternating rows
          if (rowIndex % 2 === 0) {
            pdf.setFillColor(240, 245, 250); // Light blue background
          } else {
            pdf.setFillColor(255, 255, 255); // White background
          }

          // Draw cell background rectangle
          pdf.rect(xPos, currentY, colWidth, rowHeight, 'F');

          // Draw cell border
          pdf.setDrawColor(150, 150, 150);
          pdf.setLineWidth(0.2);
          pdf.rect(xPos, currentY, colWidth, rowHeight);

          xPos += colWidth;
        });

        // Draw text for this row - after all backgrounds are drawn
        pdf.setTextColor(0, 0, 0);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);

        xPos = startX;
        row.forEach((cellText, colIndex) => {
          const colWidth = colWidths[colIndex];
          const cellCenterX = xPos + colWidth / 2;
          const cellCenterY = currentY + rowHeight / 2 + 1.3;

          // Draw centered text in cell
          pdf.text(decodeHtml(String(cellText)), cellCenterX, cellCenterY, {
            align: 'center',
          });

          xPos += colWidth;
        });

        currentY += rowHeight;
      });

      // Add page numbers and download timestamp
      const totalPages = (pdf.internal as any).getNumberOfPages();
      const now = new Date();
      const downloadDate = formatDate(now)?.replace(/\//g, '-');
      const downloadTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);
        pdf.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
        // Add download date and time at bottom left
        pdf.text(`Downloaded: ${downloadDate} | ${downloadTime}`, margin, pageHeight - 5);
      }

      addPdfFooter(pdf);

      const fileName = `Customer_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      console.log('Saving PDF as:', fileName);
      pdf.save(fileName);

      alert('PDF exported successfully!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert(`Error exporting PDF: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setExportLoading(false);
    }
  };

  const exportToExcel = () => {
    try {
      setShowExportOptions(false);
      setExportLoading(true);

      const headers = [
        'Customer ID',
        'Company Name',
        'Contact Person',
        'Contact No',
        'District',
        ...MONTHS,
        'Total Amount',
      ];

      const csvContent = [
        headers.join(','),
        ...processedCustomers.map(customer =>
          [
            customer.customerId,
            `"${(customer.companyName || '').replace(/"/g, '""')}"`,
            `"${(customer.contactPerson || '').replace(/"/g, '""')}"`,
            `"${(customer.contactNo || '').replace(/"/g, '""')}"`,
            `"${(customer.location || '').replace(/"/g, '""')}"`,
            ...customer.monthlyAmounts.map(amt => amt.toFixed(2)),
            customer.totalAmount.toFixed(2),
          ].join(',')
        ),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `Customer_Report_${new Date().toISOString().split('T')[0]}.csv`
      );
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export Excel.');
    } finally {
      setExportLoading(false);
    }
  };

  const topCustomersChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'right' as const,
        labels: {
          font: { size: 11 },
          usePointStyle: true,
          padding: 15,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (context: any) => {
            const value = context.parsed;
            const total = stats.top5Customers.reduce((a, b) => a + b.totalAmount, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return ` ₹${value.toLocaleString('en-IN')} (${percentage}%)`;
          },
        },
      },
    },
    cutout: '65%',
  };

  const revenueByCityChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (context: any) => ` ₹${context.parsed.y.toLocaleString('en-IN')}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0, 0, 0, 0.04)' },
        ticks: {
          callback: (value: any) => '₹' + (value / 1000).toFixed(0) + 'K',
          color: '#6B7280',
        },
      },
      x: {
        grid: { display: false },
        ticks: { color: '#374151', font: { weight: '600' } },
      },
    },
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <PageHeader
        title="Customer Sales Report"
        description="Monthly sales analysis by customer and salesperson"
      />

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] p-12">
          <Loader className="h-6 w-6 animate-spin text-[var(--primary)]" />
          <span className="ml-3 text-[var(--text-secondary)]">Loading customer report data...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-xl border border-[var(--danger)]/20 bg-[var(--danger)]/10 p-4">
          <p className="text-sm text-[var(--danger)]">{error}</p>
        </div>
      )}

      {/* Filters moved to top */}
      {!loading && customerData.length > 0 && (
        <div className="space-y-4 card p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Filters</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 max-w-4xl">
            {/* Salesperson Filter */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]">
                Select Salesperson
              </label>
              <select
                value={selectedSalesperson}
                onChange={e => {
                  setSelectedSalesperson(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
              >
                {!isSalesPerson && <option value="">All Salespersons</option>}
                {filteredEmployees.map(emp => (
                  <option key={emp.id} value={String(emp.id)}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Year Filter */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]">
                Select Year
              </label>
              <select
                value={selectedYear}
                onChange={e => {
                  setSelectedYear(e.target.value);
                  setSelectedMonth(''); // Reset month when year changes
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
              >
                {years.map(year => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            {/* Month Filter */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]">
                Select Month
              </label>
              <select
                value={selectedMonth}
                onChange={e => {
                  setSelectedMonth(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
              >
                <option value="">All Months</option>
                {MONTHS.map((month, index) => (
                  <option key={month} value={String(index)}>
                    {month}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      {!loading && !error && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-[var(--text-secondary)]">
                  Total Customers
                </div>
                <div className="mt-2 text-3xl font-bold text-[var(--primary)]">
                  {stats.totalCustomers}
                </div>
              </div>
              <div className="rounded-full bg-[var(--primary)]/10 p-3">
                <Users className="h-8 w-8 text-[var(--primary)]" />
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-[var(--text-secondary)]">
                  Total Current Monthly Revenue
                </div>
                <div className="mt-2 text-3xl font-bold text-[var(--success)]">
                  ₹{(stats.totalRevenue / 1000).toFixed(0)}K
                </div>
              </div>
              <div className="rounded-full bg-[var(--success)]/10 p-3">
                <DollarSign className="h-8 w-8 text-[var(--success)]" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Results State (Filtered) */}
      {!loading && !error && customerData.length > 0 && filteredCustomers.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-12 text-center">
          <AlertCircle className="mb-3 h-10 w-10 text-[var(--text-secondary)]" />
          <p className="text-lg font-medium text-[var(--text-primary)]">
            No customer details found
          </p>
          <p className="text-sm text-[var(--text-secondary)]">
            {selectedSalesperson || selectedYear
              ? 'Try adjusting your filters to see more results'
              : 'No customers available for the matching criteria'}
          </p>
        </div>
      )}

      {/* Visualizations */}
      {!loading && !error && filteredCustomers.length > 0 && (
        <div className="space-y-6">
          {/* Top Charts Row - Pie Chart and Bar Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top 5 Customers */}
            <div className="card p-6 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="mb-6 text-lg font-semibold text-[var(--text-primary)]">
                Top 5 Customers by Revenue
              </h3>
              <div style={{ height: '300px' }}>
                <Doughnut
                  data={topCustomersChartData}
                  options={topCustomersChartOptions as ChartOptions<'doughnut'>}
                />
              </div>
            </div>

            {/* Revenue by District */}
            <div className="card p-6 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="mb-6 text-lg font-semibold text-[var(--text-primary)]">
                Revenue by District (Top 8)
              </h3>
              <div style={{ height: '300px' }}>
                <Bar
                  data={revenueByDistrictChartData}
                  options={revenueByCityChartOptions as ChartOptions<'bar'>}
                />
              </div>
            </div>
          </div>

          {/* Monthly Revenue Trend - Full Width */}
          <div className="card p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                Monthly Revenue Trend
              </h3>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                  <DollarSign className="h-3 w-3" />
                  Total: ₹{stats.totalRevenue.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
            <div style={{ height: '350px' }}>
              <Line
                data={monthlyRevenueChartData}
                options={monthlyRevenueChartOptions as ChartOptions<'line'>}
              />
            </div>
          </div>
        </div>
      )}

      {/* Actions Bar: Search and Sort and Export */}
      {!loading && !error && processedCustomers.length > 0 && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-1 gap-4">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search by ID, Company, Contact..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm shadow-sm transition-all"
              />
            </div>

            {/* Sort Dropdown */}
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
      )}

      {/* Results summary */}
      {!loading && customerData.length > 0 && (
        <div className="text-sm text-[var(--text-secondary)] px-1">
          Showing {startIndex + 1} to{' '}
          {Math.min(startIndex + rowsPerPage, processedCustomers.length)} of{' '}
          {processedCustomers.length} customers
        </div>
      )}

      {/* No Data State */}
      {!loading && !error && customerData.length === 0 && (
        <div className="card p-12 text-center">
          <Users className="mx-auto h-12 w-12 text-[var(--text-secondary)]" />
          <p className="mt-4 text-[var(--text-secondary)]">No customer data available</p>
        </div>
      )}

      {/* Table */}
      {!loading && processedCustomers.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--card-background)] shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--background)] border-b border-[var(--border-color)]">
                <tr>
                  <th
                    className="px-6 py-3 text-left font-semibold text-[var(--foreground)] cursor-pointer"
                    onClick={() => handleSort('companyName')}
                  >
                    Company Name
                    {sortConfig?.key === 'companyName' &&
                      (sortConfig.direction === 'asc' ? (
                        <ArrowUp className="inline h-4 w-4 ml-1" />
                      ) : (
                        <ArrowDown className="inline h-4 w-4 ml-1" />
                      ))}
                  </th>
                  <th
                    className="px-6 py-3 text-left font-semibold text-[var(--foreground)] cursor-pointer"
                    onClick={() => handleSort('contactPerson')}
                  >
                    Customer Details
                    {sortConfig?.key === 'contactPerson' &&
                      (sortConfig.direction === 'asc' ? (
                        <ArrowUp className="inline h-4 w-4 ml-1" />
                      ) : (
                        <ArrowDown className="inline h-4 w-4 ml-1" />
                      ))}
                  </th>
                  <th
                    className="px-6 py-3 text-left font-semibold text-[var(--foreground)] cursor-pointer"
                    onClick={() => handleSort('location')}
                  >
                    District
                    {sortConfig?.key === 'location' &&
                      (sortConfig.direction === 'asc' ? (
                        <ArrowUp className="inline h-4 w-4 ml-1" />
                      ) : (
                        <ArrowDown className="inline h-4 w-4 ml-1" />
                      ))}
                  </th>
                  {MONTHS.map(month => (
                    <th
                      key={month}
                      className="px-3 py-3 text-center font-semibold text-[var(--foreground)] min-w-[80px]"
                    >
                      {month}
                    </th>
                  ))}
                  <th
                    className="px-6 py-3 text-right font-semibold text-[var(--foreground)] cursor-pointer"
                    onClick={() => handleSort('totalAmount')}
                  >
                    Total
                    {sortConfig?.key === 'totalAmount' &&
                      (sortConfig.direction === 'asc' ? (
                        <ArrowUp className="inline h-4 w-4 ml-1" />
                      ) : (
                        <ArrowDown className="inline h-4 w-4 ml-1" />
                      ))}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {paginatedCustomers.map(customer => (
                  <tr
                    key={customer.customerId}
                    className="hover:bg-[var(--background)] transition-colors"
                  >
                    <td className="px-6 py-4 font-semibold text-[var(--primary)]">
                      {decodeHtml(customer.companyName)}
                    </td>
                    <td className="px-6 py-4 text-[var(--foreground)]">
                      <div className="space-y-1">
                        <div>
                          {customer.customerId} - {decodeHtml(customer.contactPerson)}
                        </div>
                        <div className="text-sm text-[var(--text-secondary)]">
                          {customer.contactNo}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex rounded-full bg-[var(--primary)]/10 px-3 py-1 text-xs font-medium text-[var(--primary)]">
                        {decodeHtml(customer.location)}
                      </span>
                    </td>
                    {customer.monthlyAmounts.map((amount, monthIdx) => (
                      <td
                        key={monthIdx}
                        className={`px-3 py-4 text-center font-medium ${amount > 0
                          ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20'
                          : 'text-[var(--text-secondary)]'
                          }`}
                      >
                        {amount > 0 ? `₹${(amount / 1000).toFixed(1)}K` : '0'}
                      </td>
                    ))}
                    <td className="px-6 py-4 text-right font-bold text-[var(--primary)]">
                      ₹{(customer.totalAmount / 1000).toFixed(1)}K
                    </td>
                  </tr>
                ))}
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

export default CustomerReport;
