import React, { useEffect, useState, useMemo } from 'react';
import { PageHeader } from '@/components/common';
import { reportsApi } from '../api/reportsApi';
import { BatchProductionReportItem } from '../types';
import { formatDate, formatDateTime } from '@/utils/dateUtils';
import {
  FileDown,
  Warehouse,
  ShoppingCart,
  Layers,
  Calendar,
  Loader,
  CheckCircle,
  Eye,
  XCircle,
} from 'lucide-react';
import { showToast } from '@/utils/toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Button, Badge, Input, Modal } from '@/components/ui';
import { addPdfFooter, addPdfHeader } from '@/utils/pdfUtils';
import { CompanyInfo } from '@/features/company/types';
import { companyApi } from '@/features/company/api/companyApi';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const NewBatchProductionReport = () => {
  // ... (existing state) ...
  const [data, setData] = useState<BatchProductionReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // expandedBatchIds is handled by DataTable's state internally
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [previewBatch, setPreviewBatch] = useState<BatchProductionReportItem | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);

  // Fetch Company Info
  useEffect(() => {
    const fetchCompanyInfo = async () => {
      try {
        const res = await companyApi.get();
        if (res.data) {
          // Adjust based on actual API response structure (often res.data.data or res.data)
          setCompanyInfo((res.data as any).data || res.data);
        }
      } catch (err) {
        console.error('Failed to fetch company info', err);
      }
    };
    fetchCompanyInfo();
  }, []);

  // ... (existing helper function and useEffects) ...
  // Helper to get current month range
  const getDefaultDateRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1); // 1st of current month
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of current month

    // Use manual formatting to YYYY-MM-DD to use local time to avoid timezone issues with toISOString
    const formatLocal = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return {
      start: formatLocal(start),
      end: formatLocal(end),
    };
  };

  const [startDate, setStartDate] = useState(getDefaultDateRange().start);
  const [endDate, setEndDate] = useState(getDefaultDateRange().end);

  const fetchData = React.useCallback(async () => {
    try {
      setIsLoading(true);
      // Fetch ALL data for the period to populate charts fully
      const result = await reportsApi.getBatchProductionReport(
        undefined, // Pass undefined to fetch 'All' statuses
        startDate,
        endDate
      );
      // Sort by Batch Number (Natural Sort) - Latest First (Descending)
      if (Array.isArray(result)) {
        result.sort((a, b) => {
          const batchA = a.batchNo ? String(a.batchNo) : '';
          const batchB = b.batchNo ? String(b.batchNo) : '';
          // Descending order: compare B to A
          return batchB.localeCompare(batchA, undefined, { numeric: true, sensitivity: 'base' });
        });
        setData(result);
      } else {
        console.warn('BatchProductionReport: API returned non-array data', result);
        setData([]);
      }
    } catch (error) {
      console.error('Failed to fetch batch production report:', error);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]); // Removed statusFilter dependency

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter data for the TABLE only
  const filteredTableData = useMemo(() => {
    if (statusFilter === 'All') return data;
    return data.filter(item => item.status === statusFilter);
  }, [data, statusFilter]);

  // Robust numeric parser: accepts numbers or numeric strings (commas, spaces) and returns number
  const parseNumber = (val: any): number => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    // Remove commas and any non-numeric except dot and minus
    const cleaned = String(val)
      .replace(/,/g, '')
      .replace(/[^\d.-]/g, '')
      .trim();
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  };

  // Helper to format numbers to max 3 decimals
  const formatNumber = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined || val === '' || val === '-') return '-';
    const num = parseNumber(val);
    // If after parsing it's NaN or zero-length, return original fallback
    if (isNaN(num)) return String(val);
    return parseFloat(num.toFixed(3)).toString();
  };

  type RGBColor = [number, number, number];

  const handleDownloadBatch = React.useCallback(
    (batch: BatchProductionReportItem) => {
      // Use A4 portrait size explicitly
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 14;

      // colors from Preview (Tailwind classes approximation)
      const colorSuccess: RGBColor = [16, 185, 129]; // Emerald 500
      const colorGray100: RGBColor = [243, 244, 246]; // Gray 100
      const colorGray700: RGBColor = [55, 65, 81]; // Gray 700

      // 1. Header: Company Info + Title
      const headerEndY = addPdfHeader(
        doc,
        companyInfo,
        `Batch Production Report: ${batch.batchNo}`
      );

      // 2. Info Block - Reorganized Layout

      // Use autoTable for layout precision on the text block to match Preview's alignment
      // Left Info Block
      // Left Info Block
      const leftInfoData = [
        [`Batch No:`, `${batch.batchNo}${batch.productName ? ' / ' + batch.productName : ''}`],
        [`Supervisor:`, batch.supervisor || '-'],
        [`Labours:`, batch.labourNames || '-'],
        [
          `Total Time:`,
          (() => {
            if (!batch.actualTimeHours) return batch.timeRequired || '-';
            const hours = Math.floor(parseFloat(batch.actualTimeHours));
            const minutes = Math.round((parseFloat(batch.actualTimeHours) - hours) * 60);
            return `${hours} Hrs ${minutes} Min`;
          })(),
        ],
      ];

      // Right Info Block (Quality Fields)
      const rightInfoData = [
        [`Date:`, formatDate(new Date().toISOString())],
        [`Actual Density:`, batch.actualDensity || '-'],
        [`Product Viscosity:`, batch.actualViscosity || '-'],
      ];

      const infoStartY = headerEndY + 5;

      // Draw Left Table
      autoTable(doc, {
        startY: infoStartY,
        margin: { left: margin },
        body: leftInfoData,
        theme: 'plain',
        styles: {
          fontSize: 10,
          cellPadding: 1.5,
          font: 'helvetica',
          textColor: colorGray700,
        },
        columnStyles: {
          0: { cellWidth: 35, fontStyle: 'bold' },
          1: { cellWidth: 60 },
        },
        tableWidth: 95,
      });

      // Draw Right Table
      autoTable(doc, {
        startY: infoStartY,
        margin: { left: margin + 95 + 5 }, // Offset by left table width + gap
        body: rightInfoData,
        theme: 'plain',
        styles: {
          fontSize: 10,
          cellPadding: 1.5,
          font: 'helvetica',
          textColor: colorGray700,
        },
        columnStyles: {
          0: { cellWidth: 40, fontStyle: 'bold' },
          1: { cellWidth: 60 },
        },
        tableWidth: 100,
      });

      const infoBlockFinalY = (doc as any).lastAutoTable.finalY;

      // 3. Right Side: Quality & Variance Analysis Table
      // Calculate variance values
      const stdDensity = batch.density ? parseFloat(batch.density) : 0;
      const actDensity = batch.actualDensity ? parseFloat(batch.actualDensity) : 0;
      const densityVariance = actDensity - stdDensity;

      const stdViscosity = batch.viscosity ? parseFloat(batch.viscosity) : 0;
      const actViscosity = batch.actualViscosity ? parseFloat(batch.actualViscosity) : 0;
      const viscosityVariance = actViscosity - stdViscosity;

      // --- CALCULATIONS FOR TABLES (Moved up for use in Quality Table) ---

      // 1. Ingredients Calculation (Left Table)
      const allIngredients = (batch.rawMaterials || []).filter(rm => rm.productType !== 'PM');
      const regularIngredients = allIngredients.filter(rm => !rm.isAdditional);
      const additionalIngredients = allIngredients.filter(rm => rm.isAdditional);
      const ingredients = [...regularIngredients, ...additionalIngredients];

      // Total Actual Weight from Ingredients (Sum of Actual Qty)
      const totalActualWeight = ingredients.reduce(
        (sum, rm) => sum + parseNumber(rm.actualQty || rm.percentage || '0'),
        0
      );
      const totalPercentage = ingredients.reduce(
        (sum, rm) => sum + parseNumber(rm.percentage || '0'),
        0
      );

      // 2. Sub Products Calculation (Right Table / Shade Table)
      const filteredSubProducts = (batch.subProducts || []).filter(sp => {
        const actQty = parseNumber(sp.actualQty || '0');
        const batchQty = parseNumber(sp.batchQty || '0');
        return actQty > 0 || batchQty > 0;
      });

      // Total LTR from Sub Products - using filtered list and actualQty (matching preview)
      const totalLtr = filteredSubProducts.reduce((s, x) => {
        const actualQty = parseFloat(x.actualQty || '0');
        const capacity = x.capacity ? parseFloat(x.capacity.toString()) : 0;
        return s + actualQty * capacity;
      }, 0);

      const totalBatchQty = filteredSubProducts.reduce(
        (s, x) => s + (parseFloat(x.batchQty || '0') || 0),
        0
      );
      const totalSubActualQty = filteredSubProducts.reduce(
        (s, x) => s + (parseFloat(x.actualQty || '0') || 0),
        0
      );
      const totalKg = (batch.subProducts || []).reduce((s, x) => {
        const actualQty = parseFloat(x.actualQty || '0');
        const plannedQty = parseFloat(x.batchQty || '0');

        const effQty = actualQty > 0 ? actualQty : plannedQty;

        const capacity = x.capacity ? parseFloat(x.capacity.toString()) : 0;
        const ltr = effQty * capacity;
        // Use fillingDensity or fallback to batch density for weight calc
        const density =
          parseFloat(x.fillingDensity?.toString() || '0') ||
          parseFloat(batch.packingDensity || batch.actualDensity || batch.density || '0');

        return s + ltr * density;
      }, 0);

      // Calculate total weight for Quality Table
      // Standard = Total of Actual Column from Ingredients Table
      const stdTotalWeight = totalActualWeight;

      // Actual = Total KG from Shade Table
      const actTotalWeight = totalKg;
      const totalWeightVariance = actTotalWeight - stdTotalWeight;

      let currentY = infoBlockFinalY + 10;

      // 3. Tables Section - Side by Side
      // Separate regular and additional materials
      // Ingredients Body - Without Rate and Amount columns
      const ingredientsBody = ingredients.map((rm, index) => {
        return [
          index + 1,
          rm.rawMaterialName,
          formatNumber(rm.percentage),
          formatNumber(rm.actualQty || rm.percentage),
        ];
      });

      const totalAmount = 0;

      // Sub Products Body - Using calculated filtered list
      const subProductsBody = filteredSubProducts.map(sp => {
        const actualQty = parseFloat(sp.actualQty || '0');
        const plannedQty = parseFloat(sp.batchQty || '0');
        const effQty = actualQty > 0 ? actualQty : plannedQty;

        const capacity = sp.capacity ? parseFloat(sp.capacity.toString()) : 0;
        const ltr = effQty * capacity;
        // Use fillingDensity or fallback to batch density for weight calc
        const productDensity = parseFloat(sp.fillingDensity?.toString() || '0');
        const density =
          productDensity > 0
            ? productDensity
            : parseFloat(batch.packingDensity || batch.actualDensity || batch.density || '0');

        const kg = ltr * density;

        return [
          sp.productName,
          formatNumber(sp.batchQty), // Planned Qty
          formatNumber(sp.actualQty), // Actual Qty
          capacity > 0 ? formatNumber(ltr) : '', // Blank if 0 in preview image
          capacity > 0 ? formatNumber(kg) : '', // Blank if 0 in preview image
        ];
      });

      const sideBySideStartPage = doc.internal.pages.length;
      const tableY = currentY;

      // Left Table: Ingredients (Side by Side - Left)
      autoTable(doc, {
        startY: tableY,
        margin: { left: margin, right: 110 },
        head: [['Seq', 'Product', 'Percentage (%)', 'Actual']],
        body: ingredientsBody,
        theme: 'grid',
        styles: {
          fontSize: 7,
          cellPadding: 3,
          lineColor: [229, 231, 235],
          lineWidth: 0.1,
          textColor: colorGray700,
          overflow: 'linebreak',
          cellWidth: 'wrap',
        },
        headStyles: {
          fillColor: colorGray100,
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 7,
          lineWidth: 0.1,
          lineColor: [229, 231, 235],
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 45, halign: 'left' },
          2: { cellWidth: 18, halign: 'right' },
          3: { cellWidth: 18, halign: 'right' },
        },
        tableWidth: 91,
        foot: [['', 'Total', formatNumber(totalPercentage), formatNumber(totalActualWeight)]],
        footStyles: {
          fillColor: colorSuccess, // Green
          textColor: [255, 255, 255], // White
          fontStyle: 'bold',
          fontSize: 7,
          lineWidth: 0.1,
          lineColor: [229, 231, 235],
        },
        showFoot: 'lastPage',
        didParseCell: data => {
          if (data.section === 'body') {
            const rm = ingredients[data.row.index];
            // Bold styling for additional materials
            if (rm && rm.isAdditional) {
              data.cell.styles.fontStyle = 'bold';
            }
          }
          // Custom Footer Styling alignment
          if (data.section === 'foot') {
            if (data.column.index === 0 || data.column.index === 1) {
              data.cell.styles.halign = 'left';
            } else {
              data.cell.styles.halign = 'right';
            }
          }
        },
      });

      const leftTableFinalY = (doc as any).lastAutoTable.finalY;
      const leftTableFinalPage = doc.internal.pages.length;

      // Reset to starting page for Right Column
      doc.setPage(sideBySideStartPage);

      // RIGHT Column: Table Stack (Parameters -> Shade -> Packaging)
      const rightTableX = 110;
      const rightTableWidth = 86;

      // 1. Parameters Table
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Quality & Variance Analysis', rightTableX, tableY - 2);

      autoTable(doc, {
        startY: tableY,
        margin: { left: rightTableX, right: margin },
        head: [['Parameter', 'Input', 'Output', 'Var']],
        body: [
          [
            'Filling Density',
            stdDensity.toFixed(2),
            actDensity.toFixed(2),
            densityVariance.toFixed(2),
          ],
          [
            'Viscosity',
            stdViscosity > 0 ? stdViscosity.toString() : '-',
            actViscosity > 0 ? actViscosity.toString() : '-',
            viscosityVariance !== 0 ? viscosityVariance.toFixed(2) : '0.00',
          ],
          [
            'Weight (Kg)',
            stdTotalWeight.toFixed(2),
            actTotalWeight.toFixed(2),
            totalWeightVariance.toFixed(2),
          ],
        ],
        theme: 'grid',
        styles: {
          fontSize: 7,
          cellPadding: 2,
          lineColor: [229, 231, 235],
          lineWidth: 0.1,
          textColor: colorGray700,
        },
        headStyles: {
          fillColor: colorGray100,
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 7,
          lineWidth: 0.1,
          lineColor: [229, 231, 235],
        },
        columnStyles: {
          0: { cellWidth: 26 },
          1: { cellWidth: 20, halign: 'right' },
          2: { cellWidth: 20, halign: 'right' },
          3: { cellWidth: 20, halign: 'right' },
        },
        tableWidth: rightTableWidth,
      });

      let rightStackY = (doc as any).lastAutoTable.finalY + 8;

      // 2. Shade Table (Sub Products)
      autoTable(doc, {
        startY: rightStackY,
        margin: { left: rightTableX, right: margin },
        head: [['Packing', 'QTY', 'Filled', 'LTR', 'KG']],
        body: subProductsBody,
        theme: 'grid',
        styles: {
          fontSize: 7,
          cellPadding: 2,
          lineColor: [229, 231, 235],
          lineWidth: 0.1,
          textColor: colorGray700,
          overflow: 'linebreak',
        },
        headStyles: {
          fillColor: colorGray100,
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 7,
          lineWidth: 0.1,
          lineColor: [229, 231, 235],
        },
        columnStyles: {
          0: { cellWidth: 30, halign: 'left' },
          1: { cellWidth: 14, halign: 'right' },
          2: { cellWidth: 14, halign: 'right' },
          3: { cellWidth: 14, halign: 'right' },
          4: { cellWidth: 14, halign: 'right' },
        },
        tableWidth: rightTableWidth,
        foot: [
          [
            'Total',
            formatNumber(totalBatchQty),
            formatNumber(totalSubActualQty),
            formatNumber(totalLtr),
            formatNumber(totalKg),
          ],
        ],
        footStyles: {
          fillColor: colorSuccess,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7,
          lineWidth: 0.1,
          lineColor: [229, 231, 235],
        },
        showFoot: 'lastPage',
      });

      rightStackY = (doc as any).lastAutoTable.finalY + 8;

      // 3. Packaging Materials Table
      const filteredPackagingMaterials = (batch.packagingMaterials || []).filter(pm => {
        const qty =
          typeof pm.actualQty === 'number' ? pm.actualQty : parseFloat(String(pm.actualQty || '0'));
        return qty > 0;
      });

      if (filteredPackagingMaterials.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        doc.text('Packaging Materials Used', rightTableX, rightStackY - 2);

        const packagingBody = filteredPackagingMaterials.map(pm => [
          pm.packagingName,
          formatNumber(pm.actualQty),
        ]);

        const totalActualPM = filteredPackagingMaterials.reduce((sum, pm) => sum + pm.actualQty, 0);

        autoTable(doc, {
          startY: rightStackY,
          margin: { left: rightTableX, right: margin },
          head: [['Packaging Name', 'Qty']],
          body: packagingBody,
          theme: 'grid',
          styles: {
            fontSize: 7,
            cellPadding: 2,
            lineColor: [229, 231, 235],
            lineWidth: 0.1,
            textColor: colorGray700,
            overflow: 'linebreak',
          },
          headStyles: {
            fillColor: colorGray100,
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            fontSize: 7,
            lineWidth: 0.1,
            lineColor: [229, 231, 235],
          },
          columnStyles: {
            0: { cellWidth: 61, halign: 'left' },
            1: { cellWidth: 25, halign: 'right' },
          },
          tableWidth: rightTableWidth,
          foot: [['Total', formatNumber(totalActualPM)]],
          footStyles: {
            fillColor: colorSuccess,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 7,
            lineWidth: 0.1,
            lineColor: [229, 231, 235],
          },
          showFoot: 'lastPage',
        });
        rightStackY = (doc as any).lastAutoTable.finalY;
      }

      const rightTableFinalPage = doc.internal.pages.length;

      // Determine max page reached
      const maxPage = Math.max(leftTableFinalPage, rightTableFinalPage);
      doc.setPage(maxPage);

      // Calculate nextY based on which column is longer on the MAX page
      let nextY;
      if (leftTableFinalPage > rightTableFinalPage) {
        nextY = leftTableFinalY + 10;
      } else if (rightTableFinalPage > leftTableFinalPage) {
        nextY = rightStackY + 10;
      } else {
        nextY = Math.max(leftTableFinalY, rightStackY) + 10;
      }

      // 4. Footer: Remark & Signs
      // Check if we need a new page for footer
      if (nextY > 250) {
        doc.addPage();
        nextY = 20;
      }

      currentY = nextY;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10); // Reset font size
      doc.setTextColor(0, 0, 0);
      doc.text('Production Remark :', margin, currentY);

      doc.setLineWidth(0.5);
      doc.line(margin, currentY + 2, pageWidth - margin, currentY + 2); // Underline

      currentY += 8;
      doc.setFont('helvetica', 'normal');
      // Split text to fit width
      const remarks = doc.splitTextToSize(batch.productionRemarks || '-', pageWidth - margin * 2);
      doc.text(remarks, margin, currentY);

      currentY += 20; // Space for signatures

      // Signatures
      doc.setFont('helvetica', 'bold');
      doc.text('Labours Sign :-', 40, currentY);
      doc.text('Superviser Sign :-', 140, currentY);

      currentY += 6;
      doc.setFont('helvetica', 'normal');
      const labourName = batch.labourNames ? batch.labourNames.split(',')[0] : '';
      doc.text(labourName || '', 40, currentY);
      doc.text(batch.supervisor || '', 140, currentY);

      // Save PDF
      addPdfFooter(doc);
      doc.save(`Batch_Report_${batch.batchNo}.pdf`);
      showToast.success(`Downloaded report for batch ${batch.batchNo}`);
    },
    [companyInfo]
  );

  const handleExportAll = () => {
    if (data.length === 0) {
      showToast.error('No data to export');
      return;
    }

    const doc = new jsPDF('landscape');

    // Add Header
    const headerEndY = addPdfHeader(doc, companyInfo, 'Batch Production Report');

    // Add Filters Info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    let subtitle = `Generated on: ${formatDateTime(new Date())}`;
    if (statusFilter !== 'All') subtitle += ` | Status: ${statusFilter}`;
    if (startDate) subtitle += ` | From: ${startDate}`;
    if (endDate) subtitle += ` | To: ${endDate}`;
    doc.text(subtitle, 14, headerEndY + 5);

    // Define columns
    const tableColumn = [
      'Batch No',
      'Type',
      'Product',
      'Status',
      'Planned Qty',
      'Actual Qty',
      'Weight (kg)',
      'Started',
      'Completed',
      'Time',
      'Supervisor',
      'Quality',
    ];

    // Define rows
    const tableRows = data.map(item => [
      item.batchNo,
      item.productType || '',
      item.productName,
      item.status,
      formatNumber(item.plannedQuantity),
      formatNumber(item.actualQuantity),
      formatNumber(item.actualWeightKg),
      formatDateTime(item.startedAt),
      formatDateTime(item.completedAt),
      item.timeRequired,
      item.supervisor || '-',
      item.qualityStatus || 'Pending',
    ]);

    // Generate Table
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: headerEndY + 12,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [22, 163, 74] },
    });

    // Save PDF
    addPdfFooter(doc);
    doc.save(`batch_production_report_${new Date().toISOString().split('T')[0]}.pdf`);
    showToast.success('Report exported successfully');
  };

  // Calculate statistics

  const stats = useMemo(() => {
    const total = data.length;
    const completed = data.filter(b => b.status === 'Completed').length;
    const inProgress = data.filter(b => b.status === 'In Progress').length;
    const scheduled = data.filter(b => b.status === 'Scheduled').length;
    const cancelled = data.filter(b => b.status === 'Cancelled').length;

    return { total, completed, inProgress, scheduled, cancelled };
  }, [data]);

  const formatNumberForPreview = (val: any): string => {
    if (val === null || val === undefined || val === '' || val === '-') return '-';
    // Use formatNumber logic but with 2 decimals
    const num = parseNumber(val);
    if (isNaN(num)) return '-';
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Process data for Bar Chart (Weekly Batch Schedule & Production)
  // Bar Chart Data: Weekly Schedule (Grouped by Date)
  const chartData = useMemo(() => {
    // 1. Generate all dates in the range
    const start = new Date(startDate);
    const end = new Date(endDate);
    const allDates: string[] = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      allDates.push(d.toDateString());
    }

    // 2. Aggregate counts per date
    const dailyStats = allDates.map(dateStr => {
      // Normalize to day string comparisons
      return {
        date: dateStr,
        scheduledBatches: data.filter(
          b => b.scheduledDate && new Date(b.scheduledDate).toDateString() === dateStr
        ),
        inProgressBatches: data.filter(
          b => b.startedAt && new Date(b.startedAt).toDateString() === dateStr
        ),
        completedBatches: data.filter(
          b => b.completedAt && new Date(b.completedAt).toDateString() === dateStr
        ),
      };
    });

    return {
      labels: allDates.map(dateStr => {
        const date = new Date(dateStr);
        // Format: "DD/MM/YY"
        return formatDate(date);
      }),
      datasets: [
        {
          label: 'Scheduled',
          data: dailyStats.map(s => s.scheduledBatches.length),
          batches: dailyStats.map(s => s.scheduledBatches),
          backgroundColor: 'rgba(245, 158, 11, 0.8)', // Amber
          hoverBackgroundColor: 'rgba(245, 158, 11, 1)',
          barPercentage: 0.95,
          categoryPercentage: 0.7,
          maxBarThickness: 30,
        },
        {
          label: 'In Progress',
          data: dailyStats.map(s => s.inProgressBatches.length),
          batches: dailyStats.map(s => s.inProgressBatches),
          backgroundColor: 'rgba(59, 130, 246, 0.8)', // Blue
          hoverBackgroundColor: 'rgba(59, 130, 246, 1)',
          barPercentage: 0.95,
          categoryPercentage: 0.7,
          maxBarThickness: 30,
        },
        {
          label: 'Completed',
          data: dailyStats.map(s => s.completedBatches.length),
          batches: dailyStats.map(s => s.completedBatches),
          backgroundColor: 'rgba(16, 185, 129, 0.8)', // Green
          hoverBackgroundColor: 'rgba(16, 185, 129, 1)',
          barPercentage: 0.95,
          categoryPercentage: 0.7,
          maxBarThickness: 30,
        },
      ], // Show all datasets regardless of filter
    };
  }, [data, startDate, endDate]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          font: { size: 12 },
          color: 'var(--text-secondary)',
        },
      },
      title: {
        display: true,
        text: 'Production Schedule & Activity',
        font: { size: 16, weight: 'bold' as const },
        color: 'var(--text-primary)',
        padding: { bottom: 20 },
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1f2937',
        bodyColor: '#4b5563',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        padding: 12,
        boxPadding: 4,
        usePointStyle: true,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        title: {
          display: true,
          text: 'Number of Batches',
          color: 'var(--text-secondary)',
        },
        ticks: {
          stepSize: 1,
          precision: 0,
          callback: function (value: string | number) {
            if (Number.isInteger(Number(value))) {
              return value;
            }
          },
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  const lineChartData = useMemo(() => {
    // 1. Generate all dates in the range
    const start = new Date(startDate);
    const end = new Date(endDate);
    const allDates: string[] = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      allDates.push(d.toDateString());
    }

    // 2. Aggregate data per date
    const dailyStats = allDates.map(dateStr => {
      return {
        date: dateStr,
        scheduledBatches: data.filter(
          b => b.scheduledDate && new Date(b.scheduledDate).toDateString() === dateStr
        ),
        inProgressBatches: data.filter(
          b => b.startedAt && new Date(b.startedAt).toDateString() === dateStr
        ),
        completedBatches: data.filter(
          b => b.completedAt && new Date(b.completedAt).toDateString() === dateStr
        ),
      };
    });

    return {
      labels: allDates.map(dateStr => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        });
      }),
      datasets: [
        {
          label: 'Scheduled',
          data: dailyStats.map(s => s.scheduledBatches.length),
          batches: dailyStats.map(s => s.scheduledBatches),
          borderColor: 'rgba(245, 158, 11, 1)', // Amber
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          tension: 0.3,
          fill: false,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: 'In Progress',
          data: dailyStats.map(s => s.inProgressBatches.length),
          batches: dailyStats.map(s => s.inProgressBatches),
          borderColor: 'rgba(59, 130, 246, 1)', // Blue
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.3,
          fill: false,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: 'Completed',
          data: dailyStats.map(s => s.completedBatches.length),
          batches: dailyStats.map(s => s.completedBatches),
          borderColor: 'rgba(16, 185, 129, 1)', // Green
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.3,
          fill: false,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ], // Show all datasets
    };
  }, [data, startDate, endDate]);

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          color: 'var(--text-secondary)',
        },
      },
      title: {
        display: true,
        text: 'Daily Production Activity Trends',
        font: { size: 16, weight: 'bold' as const },
        color: 'var(--text-primary)',
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1f2937',
        bodyColor: '#4b5563',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        padding: 12,
        boxPadding: 4,
        usePointStyle: true,
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          afterBody: (context: any) => {
            const dataIndex = context[0].dataIndex;
            const datasetIndex = context[0].datasetIndex;
            const chart = context[0].chart;
            const dataset = chart.data.datasets[datasetIndex];

            const batches = dataset.batches ? dataset.batches[dataIndex] : [];

            if (!batches || batches.length === 0) return [];

            // List first 5 batches
            const batchLines = batches
              .slice(0, 5)
              .map((b: BatchProductionReportItem) => `• Batch #${b.batchNo}`);
            if (batches.length > 5) {
              batchLines.push(`...and ${batches.length - 5} more`);
            }
            return batchLines;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0, 0, 0, 0.05)' },
        title: {
          display: true,
          text: 'Number of Batches',
          color: 'var(--text-secondary)',
        },
        ticks: {
          stepSize: 1,
          precision: 0,
          callback: function (value: string | number) {
            if (Number.isInteger(Number(value))) {
              return value;
            }
          },
        },
      },
      x: {
        grid: { display: false },
        ticks: { color: 'var(--text-secondary)' },
      },
    },
  };

  // Define Columns for DataTable
  const columns = useMemo<ColumnDef<BatchProductionReportItem>[]>(
    () => [
      {
        accessorKey: 'batchNo',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Batch" />,
        cell: ({ row }) => {
          const status = row.original.status || 'Scheduled';

          let statusColor = 'text-[var(--primary)]';
          let BadgeComp = null;

          if (status === 'Completed') {
            statusColor = 'text-green-700 dark:text-green-400';
            BadgeComp = (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[9px] uppercase tracking-wide font-bold bg-green-600 text-white dark:bg-green-500 shadow-sm">
                <CheckCircle className="w-2.5 h-2.5" />
                Completed
              </span>
            );
          } else if (status === 'Cancelled') {
            statusColor = 'text-red-700 dark:text-red-400';
            BadgeComp = (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[9px] uppercase tracking-wide font-bold bg-red-600 text-white dark:bg-red-500 shadow-sm">
                <XCircle className="w-2.5 h-2.5" />
                Cancelled
              </span>
            );
          } else if (status === 'In Progress') {
            statusColor = 'text-blue-700 dark:text-blue-400';
            BadgeComp = (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[9px] uppercase tracking-wide font-bold bg-blue-600 text-white dark:bg-blue-500 shadow-sm">
                <Loader className="w-2.5 h-2.5 animate-spin" />
                In Progress
              </span>
            );
          } else {
            // Scheduled or Default
            statusColor = 'text-amber-700 dark:text-amber-400';
            BadgeComp = (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[9px] uppercase tracking-wide font-bold bg-amber-500 text-white dark:bg-amber-500 shadow-sm">
                <Calendar className="w-2.5 h-2.5" />
                Scheduled
              </span>
            );
          }

          return (
            <div className="flex items-center gap-2">
              <span className={`font-medium ${statusColor} hover:underline`}>
                {row.original.batchNo}
              </span>
              {BadgeComp}
            </div>
          );
        },
      },

      {
        accessorKey: 'startedAt',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Start Date" />,
        cell: ({ row }) => (
          <div className="text-[var(--text-secondary)] whitespace-nowrap">
            {formatDate(row.original.startedAt || row.original.scheduledDate)}
          </div>
        ),
      },
      {
        accessorKey: 'completedAt',
        header: ({ column }) => <DataTableColumnHeader column={column} title="End Date" />,
        cell: ({ row }) => (
          <div className="text-[var(--text-secondary)] whitespace-nowrap">
            {row.original.completedAt ? formatDate(row.original.completedAt) : '-'}
          </div>
        ),
      },
      {
        accessorKey: 'supervisor',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Superviser" />,
        cell: ({ row }) => (
          <div className="text-[var(--text-secondary)]">{row.original.supervisor || '-'}</div>
        ),
      },
      {
        accessorKey: 'productName',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Product" />,
        cell: ({ row }) => (
          <div className="font-medium text-[var(--text-primary)]">{row.original.productName}</div>
        ),
      },
      {
        accessorKey: 'labourNames',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Labour" />,
        cell: ({ row }) => (
          <div className="text-[var(--text-secondary)] uppercase text-xs">
            {row.original.labourNames || '-'}
          </div>
        ),
      },
      {
        accessorKey: 'timeRequired',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Time Required" />,
        cell: ({ row }) => (
          <div className="text-[var(--text-secondary)] text-center">
            {row.original.timeRequired || '0'}
          </div>
        ),
      },

      {
        accessorKey: 'plannedQuantity',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Production Qty" />,
        cell: ({ row }) => (
          <div className="text-center font-medium text-[var(--text-primary)]">
            {row.original.plannedQuantity}
          </div>
        ),
      },
      {
        id: 'standardDensity',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Standard Density" />,
        cell: ({ row }) => (
          <div className="text-center text-[var(--text-secondary)]">
            {row.original.density || '-'}
          </div>
        ),
      },
      {
        id: 'actualDensity',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Actual Density" />,
        cell: ({ row }) => (
          <div className="text-center text-[var(--text-secondary)]">
            {row.original.actualDensity || '-'}
          </div>
        ),
      },
      {
        id: 'diff',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Density Diff" />,
        cell: ({ row }) => {
          const standardDensity = parseFloat(row.original.density || '0');
          const actualDensity = parseFloat(row.original.actualDensity || '0');

          // If either density is missing, show "-"
          if (!row.original.density || !row.original.actualDensity) {
            return (
              <div className="flex justify-center">
                <span className="text-[var(--text-secondary)]">-</span>
              </div>
            );
          }

          const diff = actualDensity - standardDensity;
          const isPositive = diff > 0;
          const isNegative = diff < 0;

          return (
            <div className="flex justify-center">
              <Badge
                variant="outline"
                className={`${
                  isPositive
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : isNegative
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                } border-none rounded-sm px-1.5`}
              >
                {isPositive ? '+' : ''}
                {diff.toFixed(3)}
              </Badge>
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Download Report" />,
        cell: ({ row }) => (
          <div className="flex justify-center gap-2">
            <Button
              onClick={() => setPreviewBatch(row.original)}
              variant="ghost"
              size="sm"
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-2 h-auto rounded-full"
              title="Preview Report"
            >
              <Eye size={18} />
            </Button>
            <Button
              onClick={() => handleDownloadBatch(row.original)}
              variant="ghost"
              size="sm"
              className="text-[var(--primary)] hover:text-[var(--primary-dark)] p-0 h-auto"
              title="Download PDF"
            >
              <FileDown size={20} className="fill-[var(--primary)] text-[var(--primary)]" />
            </Button>
          </div>
        ),
      },
    ],
    [handleDownloadBatch]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Batch Production Reports"
        description="Comprehensive view of all production batches"
        actions={
          <Button
            variant="primary"
            className="bg-[var(--color-success)] hover:opacity-90 text-white"
            onClick={handleExportAll}
            leftIcon={<FileDown size={20} />}
          >
            Export All
          </Button>
        }
      />

      {/* Top Controls: Date Selection */}
      <div className="flex justify-end items-center gap-4 bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
        <span className="text-sm font-medium text-gray-500">Date Range:</span>
        <Input
          type="date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          inputSize="sm"
          fullWidth={false}
          className="w-auto"
        />
        <span className="text-gray-400">-</span>
        <Input
          type="date"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
          inputSize="sm"
          fullWidth={false}
          className="w-auto"
        />
      </div>

      {/* Statistics Cards */}
      {!isLoading && data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div
            onClick={() => setStatusFilter('All')}
            className={`card p-4 rounded-lg transition-all cursor-pointer ${
              statusFilter === 'All'
                ? 'border-2 border-[var(--primary)] bg-white shadow-md ring-1 ring-[var(--primary)]/30'
                : 'border border-gray-100 bg-white shadow-sm hover:shadow-md'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Total Batches
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</p>
              </div>
              <div
                className={`p-2 rounded-lg ${
                  statusFilter === 'All'
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-gray-50 text-gray-400'
                }`}
              >
                <Layers className="w-6 h-6" />
              </div>
            </div>
          </div>

          <div
            onClick={() => setStatusFilter('In Progress')}
            className={`card p-4 rounded-lg transition-all cursor-pointer ${
              statusFilter === 'In Progress'
                ? 'border-2 border-blue-500 bg-white shadow-md ring-1 ring-blue-500/30'
                : 'border border-gray-100 bg-white shadow-sm hover:shadow-md'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                  In Progress
                </p>
                <p className="text-3xl font-bold text-blue-700 mt-2">{stats.inProgress}</p>
              </div>
              <div
                className={`p-2 rounded-lg ${
                  statusFilter === 'In Progress'
                    ? 'bg-blue-500 text-white'
                    : 'bg-blue-100 text-blue-600'
                }`}
              >
                <Loader className="w-6 h-6 animate-spin-slow" />
              </div>
            </div>
          </div>
          <div
            onClick={() => setStatusFilter('Completed')}
            className={`card p-4 rounded-lg transition-all cursor-pointer ${
              statusFilter === 'Completed'
                ? 'border-2 border-green-500 bg-white shadow-md ring-1 ring-green-500/30'
                : 'border border-gray-100 bg-white shadow-sm hover:shadow-md'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold text-green-600 uppercase tracking-wider">
                  Completed
                </p>
                <p className="text-3xl font-bold text-green-700 mt-2">{stats.completed}</p>
              </div>
              <div
                className={`p-2 rounded-lg ${
                  statusFilter === 'Completed'
                    ? 'bg-green-500 text-white'
                    : 'bg-green-100 text-green-600'
                }`}
              >
                <CheckCircle className="w-6 h-6" />
              </div>
            </div>
          </div>
          <div
            onClick={() => setStatusFilter('Cancelled')}
            className={`card p-4 rounded-lg transition-all cursor-pointer ${
              statusFilter === 'Cancelled'
                ? 'border-2 border-red-500 bg-white shadow-md ring-1 ring-red-500/30'
                : 'border border-gray-100 bg-white shadow-sm hover:shadow-md'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">
                  Cancelled
                </p>
                <p className="text-3xl font-bold text-red-700 mt-2">{stats.cancelled}</p>
              </div>
              <div
                className={`p-2 rounded-lg ${
                  statusFilter === 'Cancelled' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-600'
                }`}
              >
                <XCircle className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytic Charts Section */}
      {!isLoading && chartData && data.length > 0 && (
        <div className="flex flex-col space-y-6">
          {/* Bar Chart */}
          <div className="card p-6 border border-gray-100 shadow-sm">
            <div className="h-[350px]">
              <Bar data={chartData} options={chartOptions} />
            </div>
          </div>

          {/* Line Chart */}
          <div className="card p-6 border border-gray-100 shadow-sm">
            <div className="h-[350px]">
              <Line data={lineChartData} options={lineChartOptions} />
            </div>
          </div>
        </div>
      )}

      {/* Status Filter Buttons (Table Controls) */}
      <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
        <span className="text-sm font-medium text-gray-500 mr-2">Filter Table:</span>
        {['All', 'In Progress', 'Completed', 'Cancelled'].map(status => (
          <Button
            key={status}
            size="sm"
            variant={statusFilter === status ? 'primary' : 'secondary'}
            onClick={() => setStatusFilter(status)}
            className={`min-w-[100px] transition-all duration-200 ${
              statusFilter === status
                ? 'bg-[var(--primary)] text-white shadow-md transform scale-105'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {status}
          </Button>
        ))}
      </div>

      {/* DataTable */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-[var(--text-secondary)]">Loading batch production data...</div>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filteredTableData}
          searchPlaceholder="Search batches..."
          defaultPageSize={10}
          showToolbar={true}
          showPagination={true}
          getRowCanExpand={() => true}
          renderSubComponent={({ row }) => (
            <div className="p-4 bg-[var(--color-neutral-50)] space-y-4">
              {/* Sub-Products */}
              <div className="ml-4 border-l-2 border-[var(--color-primary-200)] pl-4">
                <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
                  Sub-Products (Batch Variants)
                </h4>
                {row.original.subProducts &&
                row.original.subProducts.filter(sub => {
                  const actQty =
                    typeof sub.actualQty === 'number'
                      ? sub.actualQty
                      : parseFloat(sub.actualQty || '0');
                  const batchQty =
                    typeof sub.batchQty === 'number'
                      ? sub.batchQty
                      : parseFloat(sub.batchQty || '0');
                  return actQty > 0 || batchQty > 0;
                }).length > 0 ? (
                  <table className="w-full text-sm text-left bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                    <thead className="bg-[var(--color-neutral-100)] text-[var(--text-secondary)]">
                      <tr>
                        <th className="px-4 py-2">Sub Product</th>
                        <th className="px-4 py-2 text-right">Actual Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {row.original.subProducts
                        .filter(sub => {
                          const actQty =
                            typeof sub.actualQty === 'number'
                              ? sub.actualQty
                              : parseFloat(sub.actualQty || '0');
                          const batchQty =
                            typeof sub.batchQty === 'number'
                              ? sub.batchQty
                              : parseFloat(sub.batchQty || '0');
                          return actQty > 0 || batchQty > 0;
                        })
                        .map(sub => (
                          <tr key={sub.subProductId}>
                            <td className="px-4 py-2 text-[var(--text-primary)]">
                              {sub.productName}
                            </td>
                            <td className="px-4 py-2 text-right text-[var(--text-secondary)]">
                              {sub.actualQty}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-[var(--text-secondary)] italic">
                    No sub-products found for this batch.
                  </p>
                )}
              </div>

              {/* Raw Materials */}
              <div className="ml-4 border-l-2 border-[var(--color-warning)] pl-4">
                <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
                  Raw Materials (BOM)
                </h4>
                {row.original.rawMaterials && row.original.rawMaterials.length > 0 ? (
                  <table className="w-full text-sm text-left bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                    <thead className="bg-[var(--color-neutral-100)] text-[var(--text-secondary)]">
                      <tr>
                        <th className="px-4 py-2">Material Name</th>
                        <th className="px-4 py-2 text-right">Percentage (%)</th>
                        <th className="px-4 py-2 text-right">Actual Weight</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {/* Regular materials first - normal weight */}
                      {row.original.rawMaterials
                        .filter(
                          rm => !rm.isAdditional && parseFloat(rm.percentage?.toString() || '0') > 0
                        )
                        .map((rm, index) => (
                          <tr key={`${rm.rawMaterialId}-${index}`}>
                            <td className="px-4 py-2 text-[var(--text-primary)] font-normal">
                              {rm.rawMaterialName}
                            </td>
                            <td className="px-4 py-2 text-right text-[var(--text-secondary)]">
                              {formatNumber(rm.percentage)}
                            </td>
                            <td className="px-4 py-2 text-right text-[var(--text-secondary)]">
                              {formatNumber(rm.actualQty || rm.percentage)}
                            </td>
                          </tr>
                        ))}
                      {/* Additional materials in bold */}
                      {row.original.rawMaterials
                        .filter(
                          rm => rm.isAdditional || parseFloat(rm.percentage?.toString() || '0') <= 0
                        )
                        .map((rm, index) => (
                          <tr key={`extra-${rm.rawMaterialId}-${index}`}>
                            <td className="px-4 py-2 text-[var(--text-primary)] font-bold">
                              {rm.rawMaterialName}
                            </td>
                            <td className="px-4 py-2 text-right text-[var(--text-secondary)] font-bold">
                              {formatNumber(rm.percentage)}
                            </td>
                            <td className="px-4 py-2 text-right text-[var(--text-secondary)] font-bold">
                              {formatNumber(rm.actualQty || rm.percentage)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-[var(--color-neutral-100)] font-semibold">
                      <tr>
                        <td className="px-4 py-2 text-[var(--text-primary)]">Total</td>
                        <td className="px-4 py-2 text-right text-[var(--text-primary)]">
                          {formatNumber(
                            row.original.rawMaterials.reduce(
                              (sum, rm) => sum + parseNumber(rm.percentage || '0'),
                              0
                            )
                          )}
                        </td>
                        <td className="px-4 py-2 text-right text-[var(--text-primary)]">
                          {formatNumber(
                            row.original.rawMaterials.reduce(
                              (sum, rm) => sum + parseNumber(rm.actualQty || rm.percentage || '0'),
                              0
                            )
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                ) : (
                  <p className="text-sm text-[var(--text-secondary)] italic">
                    No raw materials found for this product.
                  </p>
                )}
              </div>
            </div>
          )}
        />
      )}

      {/* Preview Modal */}
      {previewBatch && (
        <Modal
          isOpen={true}
          onClose={() => setPreviewBatch(null)}
          title={`Batch Report Preview - ${previewBatch.batchNo}`}
          size="lg"
        >
          <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 max-w-4xl mx-auto printable-content">
            {/* Header */}
            <div className="text-center mb-6 border-b pb-4">
              <h1 className="text-2xl font-bold text-gray-900">
                {companyInfo?.companyName || 'MOREX TECHNOLOGIES'}
              </h1>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-x-12 gap-y-4 mb-8 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-600">Batch No:</span>
                  <span className="font-medium text-gray-900">
                    {previewBatch.batchNo}{' '}
                    {previewBatch.productName ? `/ ${previewBatch.productName}` : ''}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-600">Supervisor:</span>
                  <span className="text-gray-900">{previewBatch.supervisor || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-600">Labours:</span>
                  <span className="text-gray-900">{previewBatch.labourNames || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-600">Date:</span>
                  <span className="text-gray-900">{formatDate(new Date().toISOString())}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-600">Start Date-Time:</span>
                  <span className="text-gray-900">{formatDateTime(previewBatch.startedAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-600">End Date-Time:</span>
                  <span className="text-gray-900">{formatDateTime(previewBatch.completedAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-600">Total Time:</span>
                  <span className="text-gray-900">{previewBatch.timeRequired || '-'}</span>
                </div>
              </div>

              {/* Right Side: Quality & Variance Analysis Table */}
              <div className="space-y-2">
                <h4 className="font-bold text-sm text-gray-700 mb-2">
                  Quality & Variance Analysis
                </h4>
                <table className="w-full text-xs border-collapse border border-gray-300">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border border-gray-300 px-2 py-1 text-left">Parameter</th>
                      <th className="border border-gray-300 px-2 py-1 text-right">Input </th>
                      <th className="border border-gray-300 px-2 py-1 text-right">Output</th>
                      <th className="border border-gray-300 px-2 py-1 text-right">Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Align calculations with handleDownloadBatch
                      const stdDensity = previewBatch.density
                        ? parseFloat(previewBatch.density)
                        : 0;
                      const actDensity = previewBatch.actualDensity
                        ? parseFloat(previewBatch.actualDensity)
                        : 0;
                      const densityVariance = actDensity - stdDensity;

                      const stdViscosity = previewBatch.viscosity
                        ? parseFloat(previewBatch.viscosity)
                        : 0;
                      const actViscosity = previewBatch.actualViscosity
                        ? parseFloat(previewBatch.actualViscosity)
                        : 0;
                      const viscosityVariance = actViscosity - stdViscosity;

                      // 1. Ingredients Calculation (Standard Weight)
                      const rms = (previewBatch.rawMaterials || []).filter(
                        rm => rm.productType !== 'PM'
                      );
                      const totalActualWeightFromIngredients = rms.reduce(
                        (sum, rm) => sum + parseNumber(rm.actualQty || rm.percentage || '0'),
                        0
                      );

                      // 2. Sub Products Calculation (Output Weight)
                      const totalKg = (previewBatch.subProducts || []).reduce((s, x) => {
                        const actualQty = parseFloat(String(x.actualQty || '0'));
                        const plannedQty = parseFloat(String(x.batchQty || '0'));
                        const effQty = actualQty > 0 ? actualQty : plannedQty;
                        const capacity = x.capacity ? parseFloat(x.capacity.toString()) : 0;
                        const ltr = effQty * capacity;
                        const productDensity = parseFloat(String(x.fillingDensity || '0'));
                        const density =
                          productDensity > 0
                            ? productDensity
                            : parseFloat(
                                previewBatch.packingDensity ||
                                  previewBatch.actualDensity ||
                                  previewBatch.density ||
                                  '0'
                              );

                        return s + ltr * density;
                      }, 0);

                      const stdTotalWeight = totalActualWeightFromIngredients;
                      const actTotalWeight = totalKg;
                      const totalWeightVariance = actTotalWeight - stdTotalWeight;

                      return (
                        <>
                          <tr>
                            <td className="border border-gray-300 px-2 py-1">Filling Density</td>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                              {stdDensity.toFixed(2)}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                              {actDensity.toFixed(2)}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                              {densityVariance.toFixed(2)}
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-gray-300 px-2 py-1">Viscosity</td>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                              {stdViscosity > 0 ? stdViscosity : '-'}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                              {actViscosity > 0 ? actViscosity : '-'}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                              {viscosityVariance.toFixed(2)}
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-gray-300 px-2 py-1">Total Weight (Kg)</td>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                              {stdTotalWeight.toFixed(2)}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                              {actTotalWeight.toFixed(2)}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                              {totalWeightVariance.toFixed(2)}
                            </td>
                          </tr>
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tables Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {/* Ingredients Table */}
              {(() => {
                const rms = (previewBatch.rawMaterials || []).filter(rm => rm.productType !== 'PM');

                const regular = rms.filter(
                  rm => !rm.isAdditional && Number(rm.percentage ?? '0') > 0
                );

                const additional = rms.filter(
                  rm => rm.isAdditional || Number(rm.percentage ?? '0') <= 0
                );

                const allMaterials = [...regular, ...additional];
                const totalPercentage = allMaterials.reduce(
                  (s, rm) => s + parseNumber(rm.percentage ?? '0'),
                  0
                );
                const totalActual = allMaterials.reduce(
                  (s, rm) => s + parseNumber(rm.actualQty ?? rm.percentage ?? '0'),
                  0
                );
                const totalAmount = allMaterials.reduce((s, rm) => {
                  const actual = parseNumber(rm.actualQty ?? rm.percentage ?? '0');
                  const rate =
                    rm.unitPrice !== null && rm.unitPrice !== undefined
                      ? parseNumber(rm.unitPrice)
                      : 0;
                  return s + actual * rate;
                }, 0);

                return (
                  <div>
                    <table className="w-full text-xs border-collapse border border-gray-300">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="border border-gray-300 px-2 py-1 text-left">Seq</th>
                          <th className="border border-gray-300 px-2 py-1 text-left">Product</th>
                          <th className="border border-gray-300 px-2 py-1 text-right">
                            Percentage (%)
                          </th>
                          <th className="border border-gray-300 px-2 py-1 text-right">Actual</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Regular Materials */}
                        {regular.map((rm, idx) => (
                          <tr key={`reg-${idx}`}>
                            <td className="border border-gray-300 px-2 py-1 text-center">
                              {idx + 1}
                            </td>
                            <td className="border border-gray-300 px-2 py-1">
                              {rm.rawMaterialName}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                              {formatNumberForPreview(rm.percentage)}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                              {formatNumberForPreview(rm.actualQty || rm.percentage)}
                            </td>
                          </tr>
                        ))}
                        {/* Additional Materials - All Bold */}
                        {additional.map((rm, idx) => (
                          <tr key={`add-${idx}`}>
                            <td className="border border-gray-300 px-2 py-1 text-center font-bold">
                              {regular.length + idx + 1}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 font-bold">
                              {rm.rawMaterialName}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right font-bold">
                              {formatNumberForPreview(rm.percentage)}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right font-bold">
                              {formatNumberForPreview(rm.actualQty || rm.percentage)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-[var(--color-success)] text-white font-bold">
                        <tr>
                          <td className="border border-gray-300 px-2 py-1" colSpan={2}>
                            Total
                          </td>
                          <td className="border border-gray-300 px-2 py-1 text-right">
                            {formatNumberForPreview(totalPercentage)}
                          </td>
                          <td className="border border-gray-300 px-2 py-1 text-right">
                            {formatNumberForPreview(totalActual)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                );
              })()}

              {/* Sub Products Table */}
              <div>
                <table className="w-full text-xs border-collapse border border-gray-300">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border border-gray-300 px-2 py-1 text-left">Packing</th>
                      <th className="border border-gray-300 px-2 py-1 text-right">QTY</th>
                      <th className="border border-gray-300 px-2 py-1 text-right">ACT QTY</th>
                      <th className="border border-gray-300 px-2 py-1 text-center">LTR</th>
                      <th className="border border-gray-300 px-2 py-1 text-center">KG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewBatch.subProducts &&
                    previewBatch.subProducts.filter(sp => {
                      // Only show SKUs with actualQty > 0 OR batchQty > 0
                      const actQty =
                        typeof sp.actualQty === 'number'
                          ? sp.actualQty
                          : parseFloat(sp.actualQty || '0');
                      const batchQty =
                        typeof sp.batchQty === 'number'
                          ? sp.batchQty
                          : parseFloat(sp.batchQty || '0');
                      return actQty > 0 || batchQty > 0;
                    }).length > 0 ? (
                      previewBatch.subProducts
                        .filter(sp => {
                          const actQty =
                            typeof sp.actualQty === 'number'
                              ? sp.actualQty
                              : parseFloat(sp.actualQty || '0');
                          const batchQty =
                            typeof sp.batchQty === 'number'
                              ? sp.batchQty
                              : parseFloat(sp.batchQty || '0');
                          return actQty > 0 || batchQty > 0;
                        })
                        .map((sp, idx) => (
                          <tr key={idx}>
                            <td className="border border-gray-300 px-2 py-1">{sp.productName}</td>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                              {formatNumberForPreview(sp.batchQty)}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                              {formatNumberForPreview(sp.actualQty)}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                              {(() => {
                                const qty = parseFloat(String(sp.actualQty || '0'));
                                const capacity = sp.capacity
                                  ? parseFloat(sp.capacity.toString())
                                  : 0;
                                return formatNumberForPreview(qty * capacity);
                              })()}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                              {(() => {
                                const qty = parseFloat(String(sp.actualQty || '0'));
                                const capacity = sp.capacity
                                  ? parseFloat(sp.capacity.toString())
                                  : 0;
                                const ltr = qty * capacity;
                                const density = previewBatch.actualDensity
                                  ? parseFloat(previewBatch.actualDensity)
                                  : 0;
                                return formatNumberForPreview(ltr * density);
                              })()}
                            </td>
                          </tr>
                        ))
                    ) : previewBatch.productName ? (
                      <tr>
                        <td className="border border-gray-300 px-2 py-1">
                          {previewBatch.productName}
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-right">
                          {formatNumberForPreview(previewBatch.plannedQuantity)}
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-right">
                          {formatNumberForPreview(previewBatch.actualQuantity)}
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-right">
                          {(() => {
                            const qty = parseFloat(String(previewBatch.actualQuantity || '0'));
                            const capacity = (previewBatch as any).capacity
                              ? parseFloat((previewBatch as any).capacity.toString())
                              : 0;
                            return formatNumberForPreview(qty * capacity);
                          })()}
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-right">
                          {(() => {
                            const qty = parseFloat(String(previewBatch.actualQuantity || '0'));
                            const capacity = (previewBatch as any).capacity
                              ? parseFloat((previewBatch as any).capacity.toString())
                              : 0;
                            const ltr = qty * capacity;
                            const density = previewBatch.actualDensity
                              ? parseFloat(previewBatch.actualDensity)
                              : 0;
                            return formatNumberForPreview(ltr * density);
                          })()}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                  <tfoot className="bg-[var(--color-success)] text-white font-bold">
                    <tr>
                      <td className="border border-gray-300 px-2 py-1">Total</td>
                      <td className="border border-gray-300 px-2 py-1 text-right">
                        {formatNumberForPreview(
                          (previewBatch.subProducts || [])
                            .filter(sp => {
                              const actQty =
                                typeof sp.actualQty === 'number'
                                  ? sp.actualQty
                                  : parseFloat(sp.actualQty || '0');
                              const batchQty =
                                typeof sp.batchQty === 'number'
                                  ? sp.batchQty
                                  : parseFloat(sp.batchQty || '0');
                              return actQty > 0 || batchQty > 0;
                            })
                            .reduce((sum, sp) => sum + parseFloat(sp.batchQty || '0'), 0)
                        )}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-right">
                        {formatNumberForPreview(
                          (previewBatch.subProducts || [])
                            .filter(sp => {
                              const actQty =
                                typeof sp.actualQty === 'number'
                                  ? sp.actualQty
                                  : parseFloat(sp.actualQty || '0');
                              const batchQty =
                                typeof sp.batchQty === 'number'
                                  ? sp.batchQty
                                  : parseFloat(sp.batchQty || '0');
                              return actQty > 0 || batchQty > 0;
                            })
                            .reduce((sum, sp) => sum + parseFloat(String(sp.actualQty) || '0'), 0)
                        )}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-right">
                        {formatNumberForPreview(
                          (previewBatch.subProducts || [])
                            .filter(sp => {
                              const actQty =
                                typeof sp.actualQty === 'number'
                                  ? sp.actualQty
                                  : parseFloat(sp.actualQty || '0');
                              const batchQty =
                                typeof sp.batchQty === 'number'
                                  ? sp.batchQty
                                  : parseFloat(sp.batchQty || '0');
                              return actQty > 0 || batchQty > 0;
                            })
                            .reduce((sum, sp) => {
                              const qty = parseFloat(String(sp.actualQty || '0'));
                              const capacity = sp.capacity ? parseFloat(sp.capacity.toString()) : 0;
                              return sum + qty * capacity;
                            }, 0)
                        )}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-right">
                        {formatNumberForPreview(
                          (previewBatch.subProducts || [])
                            .filter(sp => {
                              const actQty =
                                typeof sp.actualQty === 'number'
                                  ? sp.actualQty
                                  : parseFloat(sp.actualQty || '0');
                              const batchQty =
                                typeof sp.batchQty === 'number'
                                  ? sp.batchQty
                                  : parseFloat(sp.batchQty || '0');
                              return actQty > 0 || batchQty > 0;
                            })
                            .reduce((sum, sp) => {
                              const qty = parseFloat(String(sp.actualQty || '0'));
                              const capacity = sp.capacity ? parseFloat(sp.capacity.toString()) : 0;
                              const ltr = qty * capacity;
                              const productDensity = parseFloat(String(sp.fillingDensity || '0'));
                              const density =
                                productDensity > 0
                                  ? productDensity
                                  : parseFloat(
                                      previewBatch.packingDensity ||
                                        previewBatch.actualDensity ||
                                        previewBatch.density ||
                                        '0'
                                    );
                              return sum + ltr * density;
                            }, 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Packaging Materials Table */}
            {previewBatch.packagingMaterials &&
              previewBatch.packagingMaterials.filter(pm => {
                const qty =
                  typeof pm.actualQty === 'number'
                    ? pm.actualQty
                    : parseFloat(String(pm.actualQty || '0'));
                return qty > 0;
              }).length > 0 && (
                <div className="mb-8">
                  <h3 className="font-bold text-sm mb-2">
                    Packaging Materials Used (Based on Actual Output)
                  </h3>
                  <table className="w-full text-xs border-collapse border border-gray-300">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border border-gray-300 px-2 py-1 text-left">
                          Packaging Name
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-right">Actual Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewBatch.packagingMaterials
                        .filter(pm => {
                          const qty =
                            typeof pm.actualQty === 'number'
                              ? pm.actualQty
                              : parseFloat(String(pm.actualQty || '0'));
                          return qty > 0;
                        })
                        .map((pm, idx) => (
                          <tr key={idx}>
                            <td className="border border-gray-300 px-2 py-1">{pm.packagingName}</td>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                              {formatNumberForPreview(pm.actualQty)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-[var(--color-success)] text-white font-bold">
                      <tr>
                        <td className="border border-gray-300 px-2 py-1">Total</td>
                        <td className="border border-gray-300 px-2 py-1 text-right">
                          {formatNumberForPreview(
                            previewBatch.packagingMaterials
                              .filter(pm => {
                                const qty =
                                  typeof pm.actualQty === 'number'
                                    ? pm.actualQty
                                    : parseFloat(String(pm.actualQty || '0'));
                                return qty > 0;
                              })
                              .reduce((sum, pm) => sum + pm.actualQty, 0)
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

            {/* Footer Signatures */}
            <div className="mt-8">
              <div className="mb-8">
                <span className="font-bold text-sm">Production Remark :</span>
                <div className="border-b border-gray-400 mt-2"></div>
              </div>

              <div className="flex justify-between mt-16 px-12">
                <div className="text-center">
                  <p className="font-bold text-sm mb-8">Labours Sign :-</p>
                  <p className="text-sm">
                    {previewBatch.labourNames ? previewBatch.labourNames.split(',')[0] : ''}
                  </p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-sm mb-8">Superviser Sign :-</p>
                  <p className="text-sm">{previewBatch.supervisor}</p>
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-center no-print">
              <Button
                variant="primary"
                onClick={() => handleDownloadBatch(previewBatch)}
                leftIcon={<FileDown size={18} />}
              >
                Download PDF
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default NewBatchProductionReport;
