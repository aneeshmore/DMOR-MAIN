import ExcelJS from 'exceljs';
import { BatchProductionReportItem } from '../types';

export interface ExportExcelOptions {
  data: BatchProductionReportItem[];
  companyInfo?: {
    companyName?: string;
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
  } | null;
  statusFilter?: string;
  startDate?: string;
  endDate?: string;
}

export const getBatchReportFileName = (
  statusFilter: string = 'All',
  startDate?: string,
  endDate?: string,
  format: 'pdf' | 'xlsx' = 'xlsx'
): string => {
  let prefix = 'Production_Batch_Report';
  if (statusFilter === 'Completed') {
    prefix = 'Completed_Batches_Report';
  } else if (statusFilter === 'In Progress') {
    prefix = 'InProgress_Batches_Report';
  } else if (statusFilter === 'Cancelled') {
    prefix = 'Cancelled_Batches_Report';
  }

  if (startDate && endDate) {
    return `${prefix}_${startDate}_to_${endDate}.${format}`;
  }
  return `${prefix}.${format}`;
};

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toISOString().split('T')[0];
  } catch {
    return dateStr;
  }
};

const formatDateTime = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.toISOString().split('T')[0]} ${d.toTimeString().split(' ')[0]}`;
  } catch {
    return dateStr;
  }
};

const parseNumber = (val: any): number => {
  if (val === null || val === undefined || val === '' || val === '-') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val)
    .replace(/,/g, '')
    .replace(/[^\d.-]/g, '')
    .trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

const formatNumStr = (val: any): string => {
  if (val === null || val === undefined || val === '' || val === '-') return '-';
  const num = parseNumber(val);
  if (isNaN(num)) return String(val);
  return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
};

export const exportBatchReportToExcel = async ({
  data,
  companyInfo,
  statusFilter = 'All',
  startDate,
  endDate,
}: ExportExcelOptions): Promise<void> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DMOR OMS Software';
  workbook.created = new Date();

  const sheetName = 'Batch Production Report';
  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 6 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  const companyName = companyInfo?.companyName || companyInfo?.name || 'DMOR OMS SOFTWARE';

  let reportTitle = 'Production Batch Report';
  if (statusFilter === 'Completed') reportTitle = 'Completed Batches Report';
  else if (statusFilter === 'In Progress') reportTitle = 'In Progress Batches Report';
  else if (statusFilter === 'Cancelled') reportTitle = 'Cancelled Batches Report';

  let filterInfo = `Generated on: ${formatDateTime(new Date().toISOString())}`;
  if (statusFilter !== 'All') filterInfo += ` | Status: ${statusFilter}`;
  if (startDate) filterInfo += ` | From: ${startDate}`;
  if (endDate) filterInfo += ` | To: ${endDate}`;

  // Row 1: Company Header
  const titleRow = worksheet.addRow([companyName]);
  worksheet.mergeCells('A1:T1');
  titleRow.getCell(1).font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF1E293B' } };
  titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  titleRow.height = 28;

  // Row 2: Report Title
  const subtitleRow = worksheet.addRow([reportTitle]);
  worksheet.mergeCells('A2:T2');
  subtitleRow.getCell(1).font = {
    name: 'Calibri',
    size: 13,
    bold: true,
    color: { argb: 'FF16A34A' },
  };
  subtitleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  subtitleRow.height = 22;

  // Row 3: Filter Summary
  const filterRow = worksheet.addRow([filterInfo]);
  worksheet.mergeCells('A3:T3');
  filterRow.getCell(1).font = {
    name: 'Calibri',
    size: 10,
    italic: true,
    color: { argb: 'FF64748B' },
  };
  filterRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  filterRow.height = 18;

  // Row 4: Spacer
  worksheet.addRow([]);
  worksheet.getRow(4).height = 10;

  // Row 5: Spacer
  worksheet.addRow([]);
  worksheet.getRow(5).height = 10;

  // Headers (Row 6)
  const headers = [
    'Batch Number',
    'Batch Date',
    'Finished Product',
    'Product Type',
    'Batch Size',
    'Planned Quantity',
    'Produced Quantity',
    'Actual Weight (kg)',
    'Status',
    'Production Cost',
    'Operator / Labour',
    'Supervisor',
    'Start Time',
    'End Time',
    'Duration',
    'Standard Density',
    'Actual Density',
    'Density Diff',
    'Quality Status',
    'Remarks',
  ];

  const headerRow = worksheet.addRow(headers);
  headerRow.height = 26;

  headerRow.eachCell(cell => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF16A34A' },
    };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF15803D' } },
      left: { style: 'thin', color: { argb: 'FF15803D' } },
      bottom: { style: 'medium', color: { argb: 'FF15803D' } },
      right: { style: 'thin', color: { argb: 'FF15803D' } },
    };
  });

  // Rows Data
  data.forEach((item, index) => {
    const stdDensity = parseFloat(item.density || '0');
    const actDensity = parseFloat(item.actualDensity || '0');
    let densityDiffStr = '-';
    if (item.density && item.actualDensity) {
      const diff = actDensity - stdDensity;
      densityDiffStr = (diff > 0 ? '+' : '') + diff.toFixed(3);
    }

    const rowValues = [
      item.batchNo || '-',
      formatDate(item.startedAt || item.scheduledDate),
      item.productName || '-',
      item.productType || '-',
      formatNumStr(item.plannedQuantity),
      formatNumStr(item.plannedQuantity),
      formatNumStr(item.actualQuantity),
      formatNumStr(item.actualWeightKg),
      item.status || 'Scheduled',
      '-', // Production Cost
      item.labourNames || '-',
      item.supervisor || '-',
      formatDateTime(item.startedAt),
      formatDateTime(item.completedAt),
      item.timeRequired || item.actualTimeHours || '-',
      item.density || '-',
      item.actualDensity || '-',
      densityDiffStr,
      item.qualityStatus || 'Pending',
      item.productionRemarks || '-',
    ];

    const row = worksheet.addRow(rowValues);
    row.height = 20;

    const isEven = index % 2 === 0;
    const bgArgb = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

    row.eachCell((cell, colNumber) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgArgb },
      };
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      // Alignment rules
      if ([1, 2, 4, 9, 13, 14, 15, 18, 19].includes(colNumber)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if ([5, 6, 7, 8, 10, 16, 17].includes(colNumber)) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }

      // Status color highlight
      if (colNumber === 9) {
        if (cell.value === 'Completed') {
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF15803D' } };
        } else if (cell.value === 'In Progress') {
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1D4ED8' } };
        } else if (cell.value === 'Cancelled') {
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFB91C1C' } };
        }
      }
    });
  });

  // Auto-fit Column Widths
  worksheet.columns.forEach(column => {
    let maxLen = 12;
    column.eachCell?.({ includeEmpty: false }, cell => {
      const cellVal = cell.value ? cell.value.toString() : '';
      if (cellVal.length > maxLen) {
        maxLen = cellVal.length;
      }
    });
    column.width = Math.min(Math.max(maxLen + 4, 12), 45);
  });

  // Generate File & Trigger Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const fileName = getBatchReportFileName(statusFilter, startDate, endDate, 'xlsx');
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
};
