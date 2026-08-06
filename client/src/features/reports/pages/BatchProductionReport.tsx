import React, { useEffect, useState, useMemo } from 'react';
import { PageHeader } from '@/components/common';
import { reportsApi } from '../api/reportsApi';
import { BatchProductionReportItem } from '../types';
import { formatDate, formatDateTime } from '@/utils/dateUtils';
import {
  Download,
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
import { toPng } from 'html-to-image';
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
import { ExportReportModal } from '../components/ExportReportModal';
import {
  exportBatchReportToExcel,
  getBatchReportFileName,
} from '../utils/exportBatchReportToExcel';
import { CompanyInfo } from '@/features/company/types';
import { companyApi } from '@/features/company/api/companyApi';
import {
  calculateQualityAndVarianceData,
  drawQualityVariancePDFTable,
  formatNumber3,
} from '../utils/qualityVarianceUtils';

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

// Helper to format numbers for preview UI - handles null/undefined
const formatNumberForPreview = (val: any): string => {
  if (val === null || val === undefined || val === '' || val === '-') return '-';
  const num = parseNumber(val);
  if (isNaN(num)) return '-';
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Helper to format numbers for PDF - max 3 decimals
const formatNumber = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined || val === '' || val === '-') return '-';
  const num = parseNumber(val);
  if (isNaN(num)) return String(val);
  return parseFloat(num.toFixed(3)).toString();
};

// Currency to 2 decimals with Indian grouping (e.g. 12500 -> "12,500.00").
const formatCurrency2 = (val: number): string =>
  (Number.isFinite(val) ? val : 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * Raw Material Cost Per Unit (Accounts report only).
 *   costPerUnit = (Total Ingredients Amount ÷ Total Ingredients Actual) × Actual Filling Density
 * All inputs mirror the values shown in the Ingredients Formulation and
 * Quality & Variance Analysis tables, so this summary matches the report.
 */
const computeAccountsCostData = (batch: BatchProductionReportItem) => {
  const rms = (batch?.rawMaterials || []).filter((rm: any) => rm.productType !== 'PM');
  const plannedQtyTotal = parseNumber(batch?.plannedQuantity) || 1;

  // Ingredients Formulation grand totals (exactly as displayed).
  const totalActual = rms.reduce(
    (s: number, rm: any) => s + parseNumber(rm.actualQty || rm.percentage || '0'),
    0
  );
  const totalAmount = rms.reduce((s: number, rm: any) => {
    const actual = parseNumber(rm.actualQty ?? rm.percentage ?? '0');
    const rate =
      rm.unitPrice !== null && rm.unitPrice !== undefined ? parseNumber(rm.unitPrice) : 0;
    return s + actual * rate;
  }, 0);

  // Actual Filling Density = InputWeight ÷ OutputLiter (Quality & Variance Analysis).
  const inputWeight = rms.reduce((sum: number, rm: any) => {
    const storedActualQty = parseNumber(rm.actualQty);
    const effectiveActual =
      storedActualQty === 0 && parseNumber(rm.percentage) > 0
        ? (parseNumber(rm.percentage) / 100) * plannedQtyTotal
        : storedActualQty;
    return sum + (effectiveActual || parseNumber(rm.percentage || '0'));
  }, 0);
  const filteredSubProducts = (batch?.subProducts || []).filter((sp: any) => {
    const actQty = parseNumber(sp.actualQty || '0');
    const batchQty = parseNumber(sp.batchQty || '0');
    return actQty > 0 || batchQty > 0;
  });
  const outputLiter = filteredSubProducts.reduce((s: number, x: any) => {
    const actualQty = parseFloat(x.actualQty || '0');
    const plannedQty = parseFloat(x.batchQty || '0');
    const effQty = actualQty > 0 ? actualQty : plannedQty;
    const capacity = x.capacity ? parseFloat(x.capacity.toString()) : 0;
    return s + effQty * capacity;
  }, 0);
  const actFillDensity = outputLiter > 0 ? inputWeight / outputLiter : 0;

  const costPerUnit = totalActual > 0 ? (totalAmount / totalActual) * actFillDensity : 0;

  return { totalAmount, totalActual, actFillDensity, costPerUnit };
};

type BatchReportPreviewContentProps = {
  batch: BatchProductionReportItem;
  companyInfo: CompanyInfo | null;
  showDownload?: boolean;
  onDownload?: () => void;
};

const BatchReportPreviewContent = React.forwardRef<HTMLDivElement, BatchReportPreviewContentProps>(
  ({ batch, companyInfo, showDownload = false, onDownload }, ref) => (
    <div
      ref={ref}
      className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 max-w-4xl mx-auto printable-content"
    >
      {/* Header */}
      <div className="mb-4 border-b pb-4 flex items-center justify-center relative">
        {batch.machineNo && (
          <div className="absolute left-0 flex flex-col items-center">
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: '2px solid #1f2937',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#1f2937',
                  textAlign: 'center',
                  lineHeight: 1,
                  wordBreak: 'break-all',
                  maxWidth: 24,
                }}
              >
                {batch.machineNo}
              </span>
            </div>
          </div>
        )}
        <h1 className="text-2xl font-bold text-gray-900">
          {companyInfo?.companyName || 'MOREX TECHNOLOGIES'}
        </h1>
      </div>

      {/* Report Title Line */}
      <div className="flex justify-between items-center mb-6 gap-4">
        <h2 className="text-base font-bold text-gray-800">
          Batch Production Report No.: {batch.batchNo}
        </h2>
        <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
          Date: {formatDate(batch.completedAt || new Date().toISOString())}
        </span>
      </div>

      {/* Top Grid: Info Block (Left) + Quality & Variance Analysis Table (Right) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 text-sm items-start">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="font-semibold text-gray-600">Product Name:</span>
            <span className="font-medium text-gray-900">{batch.productName || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-gray-600">Planned Quantity (kg):</span>
            <span className="text-gray-900">
              {batch.plannedQuantity !== undefined &&
              batch.plannedQuantity !== null &&
              String(batch.plannedQuantity).trim() !== ''
                ? Number(batch.plannedQuantity).toFixed(3)
                : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-gray-600">Supervisor:</span>
            <span className="text-gray-900">{batch.supervisor || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-gray-600">Labours:</span>
            <span className="text-gray-900">{batch.labourNames || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-gray-600">End Date:</span>
            <span className="text-gray-900">
              {batch.completedAt ? formatDate(batch.completedAt) : '-'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-gray-600">Total Time:</span>
            <span className="text-gray-900">
              {(() => {
                if (!batch.actualTimeHours) return batch.timeRequired || '-';
                const hours = Math.floor(parseFloat(batch.actualTimeHours));
                const minutes = Math.round((parseFloat(batch.actualTimeHours) - hours) * 60);
                return `${hours} Hrs ${minutes} Min`;
              })()}
            </span>
          </div>
        </div>

        {/* Right Side: Redesigned 5-Column Quality & Variance Analysis Table */}
        <div className="space-y-2">
          <h4 className="font-bold text-sm text-gray-700 mb-2">Quality & Variance Analysis</h4>
          <table className="w-full text-xs border-collapse border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-300 px-3 py-2 text-left font-bold">
                  Description
                </th>
                <th className="border border-gray-300 px-3 py-2 text-left">Parameter</th>
                <th className="border border-gray-300 px-3 py-2 text-right">Theoretical</th>
                <th className="border border-gray-300 px-3 py-2 text-right">Actual</th>
                <th className="border border-gray-300 px-3 py-2 text-right">Difference</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const stdDensity = batch.density ? parseFloat(batch.density) : 0;
                const actDensity = batch.actualDensity ? parseFloat(batch.actualDensity) : 0;
                const densityVariance = actDensity - stdDensity;

                const stdViscosity = batch.viscosity ? parseFloat(batch.viscosity) : 0;
                const actViscosity = batch.actualViscosity ? parseFloat(batch.actualViscosity) : 0;
                const viscosityVariance = actViscosity - stdViscosity;

                // Ingredients (Input Weight)
                const rms = (batch.rawMaterials || []).filter(rm => rm.productType !== 'PM');
                const plannedQtyTotal = parseNumber(batch.plannedQuantity) || 1;
                const totalActualWeight = rms.reduce((sum, rm) => {
                  const storedActualQty = parseNumber(rm.actualQty);
                  const effectiveActual =
                    storedActualQty === 0 && parseNumber(rm.percentage) > 0
                      ? (parseNumber(rm.percentage) / 100) * plannedQtyTotal
                      : storedActualQty;
                  return sum + (effectiveActual || parseNumber(rm.percentage || '0'));
                }, 0);

                // Sub-products (Output Liter)
                const filteredSubProducts = (batch.subProducts || []).filter(sp => {
                  const actQty = parseNumber(sp.actualQty || '0');
                  const batchQty = parseNumber(sp.batchQty || '0');
                  return actQty > 0 || batchQty > 0;
                });
                const totalLtr = filteredSubProducts.reduce((s, x) => {
                  const actualQty = parseFloat(x.actualQty || '0');
                  const plannedQty = parseFloat(x.batchQty || '0');
                  const effQty = actualQty > 0 ? actualQty : plannedQty;
                  const capacity = x.capacity ? parseFloat(x.capacity.toString()) : 0;
                  return s + effQty * capacity;
                }, 0);

                const firstSubProduct = (batch.subProducts || [])[0];
                const stdFillDensity =
                  parseFloat(firstSubProduct?.fillingDensity?.toString() || '0') ||
                  parseFloat(batch.packingDensity || batch.density || '0');
                const actFillDensity = totalLtr > 0 ? totalActualWeight / totalLtr : 0;
                const fillDensityVariance = actFillDensity - stdFillDensity;

                const totalKg = filteredSubProducts.reduce((s, x) => {
                  const actualQty = parseFloat(x.actualQty || '0');
                  const plannedQty = parseFloat(x.batchQty || '0');
                  const effQty = actualQty > 0 ? actualQty : plannedQty;
                  const capacity = x.capacity ? parseFloat(x.capacity.toString()) : 0;
                  const ltr = effQty * capacity;
                  const productDensity = parseFloat(x.fillingDensity?.toString() || '0');
                  const density =
                    productDensity > 0
                      ? productDensity
                      : parseFloat(
                          batch.packingDensity || batch.actualDensity || batch.density || '0'
                        );
                  return s + ltr * density;
                }, 0);

                const roundedActFillDensity = parseFloat(actFillDensity.toFixed(3));
                const stdWeight = totalActualWeight;
                const actWeight = totalLtr * roundedActFillDensity;
                const weightVariance = actWeight - stdWeight;

                return (
                  <>
                    {/* Quality Section */}
                    <tr>
                      <td className="border border-gray-300 px-3 py-2 font-bold bg-gray-50">
                        Quality
                      </td>
                      <td className="border border-gray-300 px-3 py-2">Density</td>
                      <td className="border border-gray-300 px-3 py-2 text-right">
                        {stdDensity > 0 ? stdDensity.toFixed(3) : '-'}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-right">
                        {actDensity > 0 ? actDensity.toFixed(3) : '-'}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-right">
                        {densityVariance.toFixed(3)}
                      </td>
                    </tr>
                    <tr className="border-b-2 border-gray-600">
                      <td className="border border-gray-300 px-3 py-2"></td>
                      <td className="border border-gray-300 px-3 py-2">Viscosity</td>
                      <td className="border border-gray-300 px-3 py-2 text-right">
                        {stdViscosity > 0 ? stdViscosity : '-'}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-right">
                        {actViscosity > 0 ? actViscosity : '-'}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-right">
                        {viscosityVariance.toFixed(2)}
                      </td>
                    </tr>
                    {/* Quantity Section */}
                    <tr>
                      <td className="border border-gray-300 px-3 py-2 font-bold bg-gray-50">
                        Quantity
                      </td>
                      <td className="border border-gray-300 px-3 py-2">Filling Density</td>
                      <td className="border border-gray-300 px-3 py-2 text-right">
                        {stdFillDensity > 0 ? stdFillDensity.toFixed(3) : '-'}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-right">
                        {actFillDensity > 0 ? actFillDensity.toFixed(3) : '-'}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-right">
                        {fillDensityVariance.toFixed(3)}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-3 py-2"></td>
                      <td className="border border-gray-300 px-3 py-2">Weight (Kg)</td>
                      <td className="border border-gray-300 px-3 py-2 text-right">
                        {stdWeight > 0 ? stdWeight.toFixed(3) : '-'}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-right">
                        {actWeight > 0 ? actWeight.toFixed(3) : '-'}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-right">
                        {weightVariance.toFixed(2)}
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
          const rms = (batch.rawMaterials || []).filter(rm => rm.productType !== 'PM');
          const plannedQtyTotal = parseNumber(batch.plannedQuantity) || 1;

          const processedRegular = [];
          const processedAdditional = [];

          for (const rm of rms) {
            // Highlight ONLY manual Add/Reduce transactions — never a recipe-vs-actual
            // comparison. The Water % auto-adjustment proportionally reduces every
            // material, which would otherwise flag them all. Manual reductions are not
            // distinguishable from that adjustment in stored data, so regular rows are
            // never flagged; manual additions are highlighted via isAdditional.
            const isReduced = false;
            const computedPercentage = (parseNumber(rm.actualQty) / plannedQtyTotal) * 100;

            const processedObj = {
              ...rm,
              isReduced,
              computedPercentage,
            };

            if (rm.isAdditional) {
              processedAdditional.push(processedObj);
            } else {
              processedRegular.push(processedObj);
            }
          }

          const allMaterials = [...processedRegular, ...processedAdditional];
          const regular = allMaterials.filter(rm => !rm.isAdditional);
          const additional = allMaterials.filter(rm => rm.isAdditional);

          const totalPercentage = allMaterials.reduce((s, rm) => s + rm.computedPercentage, 0);
          const totalActual = allMaterials.reduce(
            (s, rm) => s + parseNumber(rm.actualQty || rm.percentage || '0'),
            0
          );
          const totalAmount = allMaterials.reduce((s, rm) => {
            const actual = parseNumber(rm.actualQty ?? rm.percentage ?? '0');
            const rate =
              rm.unitPrice !== null && rm.unitPrice !== undefined ? parseNumber(rm.unitPrice) : 0;
            return s + actual * rate;
          }, 0);

          const anyExceeds100 = allMaterials.some(rm => rm.isAdditional || rm.isReduced);

          return (
            <div>
              <table className="w-full text-xs border-collapse border border-gray-300">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 px-3 py-2 text-left whitespace-nowrap">
                      Seq
                    </th>
                    <th className="border border-gray-300 px-3 py-2 text-left whitespace-nowrap">
                      Product
                    </th>
                    <th className="border border-gray-300 px-3 py-2 text-right whitespace-nowrap">
                      Percentage (%)
                    </th>
                    <th className="border border-gray-300 px-3 py-2 text-right whitespace-nowrap">
                      Actual
                    </th>
                    <th className="border border-gray-300 px-3 py-2 text-right whitespace-nowrap">
                      Rate
                    </th>
                    <th className="border border-gray-300 px-3 py-2 text-right whitespace-nowrap">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Regular Materials */}
                  {regular.map((rm, idx) => {
                    const isUnderlinedOrBold = rm.isReduced;
                    return (
                      <tr key={`reg-${idx}`}>
                        <td
                          className={`border border-gray-300 px-3 py-2 text-center ${isUnderlinedOrBold ? 'font-bold' : ''}`}
                        >
                          {idx + 1}
                        </td>
                        <td
                          className={`border border-gray-300 px-3 py-2 ${isUnderlinedOrBold ? 'font-bold' : ''}`}
                        >
                          {isUnderlinedOrBold ? <u>{rm.rawMaterialName}</u> : rm.rawMaterialName}
                        </td>
                        <td
                          className={`border border-gray-300 px-3 py-2 text-right ${isUnderlinedOrBold ? 'font-bold' : ''}`}
                        >
                          {formatNumberForPreview(rm.computedPercentage)}
                        </td>
                        <td
                          className={`border border-gray-300 px-3 py-2 text-right ${isUnderlinedOrBold ? 'font-bold' : ''}`}
                        >
                          {parseNumber(rm.actualQty ?? rm.percentage ?? '0') === 0
                            ? '0.00*'
                            : formatNumberForPreview(rm.actualQty || rm.percentage)}
                        </td>
                        <td
                          className={`border border-gray-300 px-3 py-2 text-right ${isUnderlinedOrBold ? 'font-bold' : ''}`}
                        >
                          {formatNumberForPreview(rm.unitPrice)}
                        </td>
                        <td
                          className={`border border-gray-300 px-3 py-2 text-right ${isUnderlinedOrBold ? 'font-bold' : ''}`}
                        >
                          {formatNumberForPreview(
                            parseNumber(rm.actualQty ?? rm.percentage ?? '0') *
                              (rm.unitPrice !== null && rm.unitPrice !== undefined
                                ? parseNumber(rm.unitPrice)
                                : 0)
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Additional Materials */}
                  {additional.map((rm, idx) => {
                    const isUnderlinedOrBold = anyExceeds100;
                    const pctVal =
                      rm.computedPercentage <= 0.0001
                        ? '-'
                        : formatNumberForPreview(rm.computedPercentage);
                    return (
                      <tr key={`add-${idx}`}>
                        <td
                          className={`border border-gray-300 px-3 py-2 text-center ${isUnderlinedOrBold ? 'font-bold' : ''}`}
                        >
                          {regular.length + idx + 1}
                        </td>
                        <td
                          className={`border border-gray-300 px-3 py-2 ${isUnderlinedOrBold ? 'font-bold' : ''}`}
                        >
                          {isUnderlinedOrBold ? <u>{rm.rawMaterialName}</u> : rm.rawMaterialName}
                        </td>
                        <td
                          className={`border border-gray-300 px-3 py-2 text-right ${isUnderlinedOrBold ? 'font-bold' : ''}`}
                        >
                          {pctVal}
                        </td>
                        <td
                          className={`border border-gray-300 px-3 py-2 text-right ${isUnderlinedOrBold ? 'font-bold' : ''}`}
                        >
                          {parseNumber(rm.actualQty ?? rm.percentage ?? '0') === 0
                            ? '0.00*'
                            : formatNumberForPreview(rm.actualQty || rm.percentage)}
                        </td>
                        <td
                          className={`border border-gray-300 px-3 py-2 text-right ${isUnderlinedOrBold ? 'font-bold' : ''}`}
                        >
                          {formatNumberForPreview(rm.unitPrice)}
                        </td>
                        <td
                          className={`border border-gray-300 px-3 py-2 text-right ${isUnderlinedOrBold ? 'font-bold' : ''}`}
                        >
                          {formatNumberForPreview(
                            parseNumber(rm.actualQty ?? rm.percentage ?? '0') *
                              (rm.unitPrice !== null && rm.unitPrice !== undefined
                                ? parseNumber(rm.unitPrice)
                                : 0)
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-[var(--color-success)] text-white font-bold">
                  <tr>
                    <td className="border border-gray-300 px-3 py-2" colSpan={2}>
                      Total
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-right">
                      {formatNumberForPreview(totalPercentage)}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-right">
                      {formatNumberForPreview(totalActual)}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-right">&nbsp;</td>
                    <td className="border border-gray-300 px-3 py-2 text-right">
                      {formatNumberForPreview(totalAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
              {anyExceeds100 && (
                <div className="text-[10px] text-red-500 font-semibold mt-2">
                  * Underlined raw materials were added or reduced separately during batch
                  production.
                </div>
              )}
            </div>
          );
        })()}

        {/* Sub Products Table */}
        <div>
          <table className="w-full text-xs border-collapse border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-300 px-3 py-2 text-left">Packing</th>
                <th className="border border-gray-300 px-3 py-2 text-right">Filled</th>
                <th className="border border-gray-300 px-3 py-2 text-right">LTR</th>
                <th className="border border-gray-300 px-3 py-2 text-right">KG</th>
              </tr>
            </thead>
            <tbody>
              {batch.subProducts &&
              batch.subProducts.filter(sp => {
                // Only show SKUs with actualQty > 0 OR batchQty > 0
                const actQty =
                  typeof sp.actualQty === 'number' ? sp.actualQty : parseFloat(sp.actualQty || '0');
                const batchQty =
                  typeof sp.batchQty === 'number' ? sp.batchQty : parseFloat(sp.batchQty || '0');
                return actQty > 0 || batchQty > 0;
              }).length > 0 ? (
                batch.subProducts
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
                      <td className="border border-gray-300 px-3 py-2">{sp.productName}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right">
                        {formatNumberForPreview(sp.actualQty)}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-right">
                        {(() => {
                          const qty = parseFloat(String(sp.actualQty || '0'));
                          const capacity = sp.capacity ? parseFloat(sp.capacity.toString()) : 0;
                          return formatNumberForPreview(qty * capacity);
                        })()}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-right">
                        {(() => {
                          const qty = parseFloat(String(sp.actualQty || '0'));
                          const capacity = sp.capacity ? parseFloat(sp.capacity.toString()) : 0;
                          const ltr = qty * capacity;
                          const density = batch.actualDensity ? parseFloat(batch.actualDensity) : 0;
                          return formatNumberForPreview(ltr * density);
                        })()}
                      </td>
                    </tr>
                  ))
              ) : batch.productName ? (
                <tr>
                  <td className="border border-gray-300 px-3 py-2">{batch.productName}</td>
                  <td className="border border-gray-300 px-3 py-2 text-right">
                    {formatNumberForPreview(batch.actualQuantity)}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-right">
                    {(() => {
                      const qty = parseFloat(String(batch.actualQuantity || '0'));
                      const capacity = (batch as any).capacity
                        ? parseFloat((batch as any).capacity.toString())
                        : 0;
                      return formatNumberForPreview(qty * capacity);
                    })()}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-right">
                    {(() => {
                      const qty = parseFloat(String(batch.actualQuantity || '0'));
                      const capacity = (batch as any).capacity
                        ? parseFloat((batch as any).capacity.toString())
                        : 0;
                      const ltr = qty * capacity;
                      const density = batch.actualDensity ? parseFloat(batch.actualDensity) : 0;
                      return formatNumberForPreview(ltr * density);
                    })()}
                  </td>
                </tr>
              ) : null}
            </tbody>
            <tfoot className="bg-[var(--color-success)] text-white font-bold">
              <tr>
                <td className="border border-gray-300 px-3 py-2">Total</td>
                <td className="border border-gray-300 px-3 py-2 text-right">
                  {formatNumberForPreview(
                    (batch.subProducts || [])
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
                <td className="border border-gray-300 px-3 py-2 text-right">
                  {formatNumberForPreview(
                    (batch.subProducts || [])
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
                <td className="border border-gray-300 px-3 py-2 text-right">
                  {formatNumberForPreview(
                    (batch.subProducts || [])
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
                                batch.packingDensity || batch.actualDensity || batch.density || '0'
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
      {batch.packagingMaterials &&
        batch.packagingMaterials.filter(pm => {
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
                  <th className="border border-gray-300 px-3 py-2 text-left">Packaging Name</th>
                  <th className="border border-gray-300 px-3 py-2 text-right">Actual Qty</th>
                </tr>
              </thead>
              <tbody>
                {batch.packagingMaterials
                  .filter(pm => {
                    const qty =
                      typeof pm.actualQty === 'number'
                        ? pm.actualQty
                        : parseFloat(String(pm.actualQty || '0'));
                    return qty > 0;
                  })
                  .map((pm, idx) => (
                    <tr key={idx}>
                      <td className="border border-gray-300 px-3 py-2">{pm.packagingName}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right">
                        {formatNumberForPreview(pm.actualQty)}
                      </td>
                    </tr>
                  ))}
              </tbody>
              <tfoot className="bg-[var(--color-success)] text-white font-bold">
                <tr>
                  <td className="border border-gray-300 px-3 py-2">Total</td>
                  <td className="border border-gray-300 px-3 py-2 text-right">
                    {formatNumberForPreview(
                      batch.packagingMaterials
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

      {/* Raw Material Cost Per Ltr (Accounts) */}
      {(() => {
        const { totalAmount, totalActual, costPerUnit } = computeAccountsCostData(batch);
        const costPerKg = totalActual > 0 ? totalAmount / totalActual : 0;
        return (
          <div className="mb-8 max-w-md">
            <h3 className="font-bold text-sm mb-2">Raw Material Cost Per Unit</h3>
            <table className="w-full text-xs border-collapse border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-300 px-3 py-2 text-left">Description</th>
                  <th className="border border-gray-300 px-3 py-2 text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 px-3 py-2">Total Ingredients Amount</td>
                  <td className="border border-gray-300 px-3 py-2 text-right">
                    ₹{formatCurrency2(totalAmount)}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-3 py-2">Total Ingredients Actual</td>
                  <td className="border border-gray-300 px-3 py-2 text-right">
                    {totalActual.toFixed(3)} Kg
                  </td>
                </tr>
              </tbody>
              <tfoot className="bg-[var(--color-success)] text-white font-bold">
                <tr>
                  <td className="border border-gray-300 px-3 py-2">Raw Material Cost Per KG</td>
                  <td className="border border-gray-300 px-3 py-2 text-right">
                    ₹{formatCurrency2(costPerKg)} / Kg
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-3 py-2">Raw Material Cost Per Ltr</td>
                  <td className="border border-gray-300 px-3 py-2 text-right">
                    ₹{formatCurrency2(costPerUnit)} / Ltr
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })()}

      {/* Footer Signatures */}
      <div className="mt-8">
        <div className="mb-8">
          <span className="font-bold text-sm">Production Remark :</span>
          <div className="border-b border-gray-400 mt-2"></div>
        </div>

        <div className="flex justify-between mt-16 px-12">
          <div className="text-center">
            <p className="font-bold text-sm mb-8">Labours Sign :-</p>
            <p className="text-sm">{batch.labourNames ? batch.labourNames.split(',')[0] : ''}</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-sm mb-8">Superviser Sign :-</p>
            <p className="text-sm">{batch.supervisor}</p>
          </div>
        </div>
      </div>

      {showDownload && onDownload && (
        <div className="mt-8 flex justify-center no-print">
          <Button variant="primary" onClick={onDownload} leftIcon={<Download size={18} />}>
            Download PDF
          </Button>
        </div>
      )}
    </div>
  )
);

BatchReportPreviewContent.displayName = 'BatchReportPreviewContent';

const BatchProductionReport = () => {
  // ... (existing state) ...
  const [data, setData] = useState<BatchProductionReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // expandedBatchIds is handled by DataTable's state internally
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportTargetStatus, setExportTargetStatus] = useState<string>('All');
  const [previewBatch, setPreviewBatch] = useState<BatchProductionReportItem | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [downloadBatch, setDownloadBatch] = useState<BatchProductionReportItem | null>(null);
  const downloadRef = React.useRef<HTMLDivElement | null>(null);
  const downloadInProgressRef = React.useRef(false);

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

  type RGBColor = [number, number, number];

  const handleDownloadBatch = React.useCallback(
    (batch: BatchProductionReportItem) => {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 14;

      const colorSuccess: RGBColor = [16, 185, 129];
      const colorGray100: RGBColor = [243, 244, 246];
      const colorGray700: RGBColor = [55, 65, 81];

      // 1. Header: Company Info + Title
      const headerEndY = addPdfHeader(
        doc,
        companyInfo,
        `Batch Production Report No.: ${batch.batchNo}`
      );

      // Machine No. badge — left of company name (drawn at y=15, centred at x=25)
      if (batch.machineNo) {
        doc.setDrawColor(31, 41, 55);
        doc.setLineWidth(0.5);
        doc.circle(25, 13.5, 4.5);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(31, 41, 55);
        doc.text(String(batch.machineNo), 25, 14.6, { align: 'center' });
      }

      // Date right-aligned on title line
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(colorGray700[0], colorGray700[1], colorGray700[2]);
      doc.text(
        `Date: ${formatDate(batch.completedAt || new Date().toISOString())}`,
        pageWidth - margin,
        headerEndY - 5,
        { align: 'right' }
      );

      // 2. Left Info Block Table
      const plannedQtyDisplay =
        batch.plannedQuantity !== undefined &&
        batch.plannedQuantity !== null &&
        String(batch.plannedQuantity).trim() !== ''
          ? Number(batch.plannedQuantity).toFixed(3)
          : 'N/A';
      const leftInfoData = [
        [`Product Name:`, batch.productName || '-'],
        [`Planned Quantity (kg):`, plannedQtyDisplay],
        [`Supervisor:`, batch.supervisor || '-'],
        [`Labours:`, batch.labourNames || '-'],
        [`End Date:`, batch.completedAt ? formatDate(batch.completedAt) : '-'],
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

      const qualityTableX = 100;
      const qualityTableWidth = 96;
      const infoStartY = headerEndY + 9;

      // Table Titles for Top Section
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text('Batch Details', margin, infoStartY - 2);
      doc.text('Quality & Variance Analysis', qualityTableX, infoStartY - 2);

      autoTable(doc, {
        startY: infoStartY,
        margin: { left: margin },
        body: leftInfoData,
        theme: 'grid',
        styles: {
          fontSize: 9.5,
          cellPadding: 1.5,
          font: 'helvetica',
          textColor: colorGray700,
          lineColor: [209, 213, 219],
          lineWidth: 0.1,
        },
        columnStyles: {
          0: { cellWidth: 38, fontStyle: 'bold' },
          1: { cellWidth: 42 },
        },
        tableWidth: 80,
      });
      const leftInfoFinalY = (doc as any).lastAutoTable.finalY;

      // 3. CALCULATIONS FOR TABLES & QUALITY & VARIANCE ANALYSIS
      const allIngredients = (batch.rawMaterials || []).filter(rm => rm.productType !== 'PM');
      const plannedQtyTotal = parseNumber(batch.plannedQuantity) || 1;

      const processedRegular = [];
      const processedAdditional = [];

      for (const rm of allIngredients) {
        // Highlight only manual Add/Reduce; the Water % auto-adjustment must not flag
        // rows. Manual reductions aren't distinguishable from that adjustment in stored
        // data, so regular rows are never flagged; adds are flagged via isAdditional.
        const isReduced = false;
        const storedActualQty = parseNumber(rm.actualQty);
        const effectiveActual =
          storedActualQty === 0 && parseNumber(rm.percentage) > 0
            ? (parseNumber(rm.percentage) / 100) * plannedQtyTotal
            : storedActualQty;
        const computedPercentage = (effectiveActual / plannedQtyTotal) * 100;

        const processedObj = {
          ...rm,
          isReduced,
          computedPercentage,
          effectiveActual,
        };

        if (rm.isAdditional) {
          processedAdditional.push(processedObj);
        } else {
          processedRegular.push(processedObj);
        }
      }

      const ingredients = [...processedRegular, ...processedAdditional];

      const totalActualWeight = ingredients.reduce(
        (sum, rm) =>
          sum + (rm.effectiveActual ?? parseNumber(rm.actualQty || rm.percentage || '0')),
        0
      );
      const totalPercentage = ingredients.reduce((sum, rm) => sum + rm.computedPercentage, 0);
      const totalAmount = ingredients.reduce((s, rm) => {
        const actual = rm.effectiveActual ?? parseNumber(rm.actualQty ?? rm.percentage ?? '0');
        const rate =
          rm.unitPrice !== null && rm.unitPrice !== undefined ? parseNumber(rm.unitPrice) : 0;
        return s + actual * rate;
      }, 0);
      const anyExceeds100 = ingredients.some(rm => rm.isAdditional || rm.isReduced);

      const filteredSubProducts = (batch.subProducts || []).filter(sp => {
        const actQty = parseNumber(sp.actualQty || '0');
        const batchQty = parseNumber(sp.batchQty || '0');
        return actQty > 0 || batchQty > 0;
      });

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

      // Shared Quality & Variance Data Calculation
      const qualityData = calculateQualityAndVarianceData(batch, ingredients, filteredSubProducts);
      const totalKg = qualityData.totalKg;

      drawQualityVariancePDFTable(doc, infoStartY, qualityTableX, qualityTableWidth, qualityData, {
        colorGray100,
        colorGray700,
      });

      const qualityTableFinalY = (doc as any).lastAutoTable.finalY;
      const topSectionFinalY = Math.max(leftInfoFinalY, qualityTableFinalY);

      let currentY = topSectionFinalY + 11;

      // 4. Ingredients Body WITH Rate and Amount for Accounts
      const ingredientsBody = ingredients.map((rm, index) => {
        const actualVal = formatNumber3(rm.effectiveActual);
        const rateVal =
          rm.unitPrice !== null && rm.unitPrice !== undefined ? formatNumber(rm.unitPrice) : '-';
        const amountVal = formatNumber(
          (rm.effectiveActual ?? parseNumber(rm.actualQty ?? rm.percentage ?? '0')) *
            (rm.unitPrice !== null && rm.unitPrice !== undefined ? parseNumber(rm.unitPrice) : 0)
        );
        return [
          index + 1,
          rm.rawMaterialName,
          formatNumber(rm.computedPercentage),
          actualVal,
          rateVal,
          amountVal,
        ];
      });

      // Option 1: Packing Table - Actual Packed Mass
      const subProductsBody = filteredSubProducts.map(sp => {
        const actualQty = parseFloat(sp.actualQty || '0');
        const plannedQty = parseFloat(sp.batchQty || '0');
        const effQty = actualQty > 0 ? actualQty : plannedQty;
        const capacity = sp.capacity ? parseFloat(sp.capacity.toString()) : 0;
        const ltr = effQty * capacity;
        const productDensity = parseFloat(sp.fillingDensity?.toString() || '0');
        const density =
          productDensity > 0
            ? productDensity
            : parseFloat(batch.packingDensity || batch.actualDensity || batch.density || '0');
        const kg = ltr * density;

        return [
          sp.productName,
          formatNumber(sp.actualQty),
          capacity > 0 ? formatNumber(ltr) : '',
          capacity > 0 ? formatNumber(kg) : '',
        ];
      });

      const sideBySideStartPage = doc.getNumberOfPages();
      const tableY = currentY;

      // Table Title for Ingredients
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text('Ingredients Formulation', margin, tableY - 2);

      // Ingredients Table (Accounts: 5 columns)
      autoTable(doc, {
        startY: tableY,
        margin: { left: margin, right: 110 },
        head: [['Seq', 'Product', 'Percentage', 'Actual', 'Rate', 'Amount']],
        body: ingredientsBody,
        theme: 'grid',
        styles: {
          fontSize: 10,
          cellPadding: 0.8,
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
          fontSize: 9,
          valign: 'middle',
          lineWidth: 0.1,
          lineColor: [229, 231, 235],
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 25, halign: 'left' },
          2: { cellWidth: 20, halign: 'right' },
          3: { cellWidth: 12, halign: 'right' },
          4: { cellWidth: 11, halign: 'right' },
          5: { cellWidth: 15, halign: 'right' },
        },
        tableWidth: 91,
        foot: [
          [
            '',
            'Total',
            formatNumber(totalPercentage),
            formatNumber3(totalActualWeight),
            '',
            formatNumber(totalAmount),
          ],
        ],
        footStyles: {
          fillColor: colorSuccess,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 10,
          lineWidth: 0.1,
          lineColor: [229, 231, 235],
        },
        showFoot: 'lastPage',
        didParseCell: data => {
          if (data.section === 'body' && data.column.index === 1) {
            const rm = ingredients[data.row.index];
            const isHighlighted = rm && (rm.isAdditional ? anyExceeds100 : rm.isReduced);
            if (isHighlighted) {
              data.cell.styles.fontStyle = 'bold';
            }
          }
          if (data.section === 'foot') {
            if (data.column.index === 0 || data.column.index === 1) {
              data.cell.styles.halign = 'left';
            } else {
              data.cell.styles.halign = 'right';
            }
          }
        },
        didDrawCell: data => {
          if (data.section === 'body' && data.column.index === 1) {
            const rm = ingredients[data.row.index];
            const isHighlighted = rm && (rm.isAdditional ? anyExceeds100 : rm.isReduced);
            if (isHighlighted) {
              const cell = data.cell;
              const textWidth = doc.getTextWidth(cell.text[0] || '');
              const startX = cell.x + cell.padding('left');
              const startY = cell.y + cell.height - cell.padding('bottom') + 0.1;
              doc.setLineWidth(0.1);
              doc.setDrawColor(0, 0, 0);
              doc.line(startX, startY, startX + textWidth, startY);
            }
          }
        },
      });

      let leftTableFinalY = (doc as any).lastAutoTable.finalY;
      const leftTableFinalPage = doc.getNumberOfPages();

      if (anyExceeds100) {
        doc.setPage(leftTableFinalPage);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        doc.setTextColor(239, 68, 68);
        doc.text(
          '* Underlined raw materials were added or reduced separately during batch production.',
          margin,
          leftTableFinalY + 4
        );
        leftTableFinalY += 6;
      }

      doc.setPage(sideBySideStartPage);

      const rightTableX = 110;
      const rightTableWidth = 86;
      let rightStackY = tableY;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text('Packing Table', rightTableX, rightStackY - 2);

      autoTable(doc, {
        startY: rightStackY,
        margin: { left: rightTableX, right: margin },
        head: [['Packing', 'Filled', 'LTR', 'KG']],
        body: subProductsBody,
        theme: 'grid',
        styles: {
          fontSize: 10,
          cellPadding: 0.8,
          lineColor: [229, 231, 235],
          lineWidth: 0.1,
          textColor: colorGray700,
          overflow: 'linebreak',
        },
        headStyles: {
          fillColor: colorGray100,
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 10,
          lineWidth: 0.1,
          lineColor: [229, 231, 235],
        },
        columnStyles: {
          0: { cellWidth: 50, halign: 'left' },
          1: { cellWidth: 12, halign: 'right' },
          2: { cellWidth: 12, halign: 'right' },
          3: { cellWidth: 12, halign: 'right' },
        },
        tableWidth: rightTableWidth,
        foot: [
          ['Total', formatNumber(totalSubActualQty), formatNumber(totalLtr), formatNumber(totalKg)],
        ],
        footStyles: {
          fillColor: colorSuccess,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 10,
          lineWidth: 0.1,
          lineColor: [229, 231, 235],
        },
        showFoot: 'lastPage',
        didParseCell: data => {
          // Right-align all header cells except Packing (col 0)
          if (data.section === 'head' && data.column.index > 0) {
            data.cell.styles.halign = 'right';
          }
          if (data.section === 'foot') {
            if (data.column.index === 0) {
              data.cell.styles.halign = 'left';
            } else {
              data.cell.styles.halign = 'right';
            }
          }
        },
      });

      rightStackY = (doc as any).lastAutoTable.finalY + 8;

      const filteredPackagingMaterials = (batch.packagingMaterials || []).filter(pm => {
        const qty =
          typeof pm.actualQty === 'number' ? pm.actualQty : parseFloat(String(pm.actualQty || '0'));
        return qty > 0;
      });

      if (filteredPackagingMaterials.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
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
            fontSize: 10,
            cellPadding: 1.2,
            lineColor: [229, 231, 235],
            lineWidth: 0.1,
            textColor: colorGray700,
            overflow: 'linebreak',
          },
          headStyles: {
            fillColor: colorGray100,
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            fontSize: 10,
            lineWidth: 0.1,
            lineColor: [229, 231, 235],
          },
          columnStyles: {
            0: { cellWidth: 68, halign: 'left' },
            1: { cellWidth: 18, halign: 'right' },
          },
          tableWidth: rightTableWidth,
          foot: [['Total', formatNumber(totalActualPM)]],
          footStyles: {
            fillColor: colorSuccess,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 10,
            lineWidth: 0.1,
            lineColor: [229, 231, 235],
          },
          showFoot: 'lastPage',
          didParseCell: data => {
            if (data.section === 'foot') {
              if (data.column.index === 0) {
                data.cell.styles.halign = 'left';
              } else {
                data.cell.styles.halign = 'right';
              }
            }
          },
        });
        rightStackY = (doc as any).lastAutoTable.finalY;
      }

      // ── Raw Material Cost Per Ltr — stacked below Packaging Materials Used (right column) ──
      {
        const rmCost = computeAccountsCostData(batch);
        const costPerKg = rmCost.totalActual > 0 ? rmCost.totalAmount / rmCost.totalActual : 0;
        rightStackY += 8;
        doc.setPage(doc.getNumberOfPages());
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text('Raw Material Cost Per Unit', rightTableX, rightStackY - 2);
        autoTable(doc, {
          startY: rightStackY,
          margin: { left: rightTableX, right: margin },
          head: [['Description', 'Value']],
          body: [
            ['Total Ingredients Amount', `Rs. ${formatCurrency2(rmCost.totalAmount)}`],
            ['Total Ingredients Actual', `${rmCost.totalActual.toFixed(3)} Kg`],
          ],
          foot: [
            ['Raw Material Cost Per KG', `Rs. ${formatCurrency2(costPerKg)} / Kg`],
            ['Raw Material Cost Per Ltr', `Rs. ${formatCurrency2(rmCost.costPerUnit)} / Ltr`],
          ],
          theme: 'grid',
          styles: {
            fontSize: 10,
            cellPadding: 0.8,
            lineColor: [229, 231, 235],
            lineWidth: 0.1,
            textColor: colorGray700,
          },
          headStyles: {
            fillColor: colorGray100,
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            fontSize: 10,
            lineWidth: 0.1,
            lineColor: [229, 231, 235],
          },
          columnStyles: {
            0: { cellWidth: 54, halign: 'left', fontStyle: 'bold' },
            1: { cellWidth: 32, halign: 'right' },
          },
          tableWidth: rightTableWidth,
          footStyles: {
            fillColor: colorSuccess,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 10,
            lineWidth: 0.1,
            lineColor: [229, 231, 235],
          },
          showFoot: 'lastPage',
          didParseCell: data => {
            if (data.section === 'foot') {
              data.cell.styles.halign = data.column.index === 0 ? 'left' : 'right';
            }
          },
        });
        rightStackY = (doc as any).lastAutoTable.finalY;
      }

      const rightTableFinalPage = doc.getNumberOfPages();
      const maxPage = Math.max(leftTableFinalPage, rightTableFinalPage);
      doc.setPage(maxPage);

      let nextY;
      if (leftTableFinalPage > rightTableFinalPage) {
        nextY = leftTableFinalY + 10;
      } else if (rightTableFinalPage > leftTableFinalPage) {
        nextY = rightStackY + 10;
      } else {
        nextY = Math.max(leftTableFinalY, rightStackY) + 10;
      }

      if (nextY > 250) {
        doc.addPage();
        nextY = 20;
      }

      currentY = nextY;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text('Production Remark :', margin, currentY);

      doc.setLineWidth(0.5);
      doc.line(margin, currentY + 2, pageWidth - margin, currentY + 2);

      currentY += 8;
      doc.setFont('helvetica', 'normal');
      const remarks = doc.splitTextToSize(batch.productionRemarks || '-', pageWidth - margin * 2);
      doc.text(remarks, margin, currentY);

      const remarksHeight = remarks.length * 4.5;
      currentY += remarksHeight + 8;

      doc.setFont('helvetica', 'bold');
      doc.text('Labours Sign :-', 40, currentY);
      doc.text('Superviser Sign :-', 140, currentY);

      addPdfFooter(doc);
      doc.save(`Batch_Report_${batch.batchNo}.pdf`);
    },
    [companyInfo]
  );

  const handleConfirmExport = async (format: 'pdf' | 'xlsx') => {
    let targetData = data;
    if (exportTargetStatus !== 'All') {
      targetData = data.filter(item => item.status === exportTargetStatus);
    }

    if (targetData.length === 0) {
      showToast.error('No data to export');
      return;
    }

    if (format === 'xlsx') {
      await exportBatchReportToExcel({
        data: targetData,
        companyInfo,
        statusFilter: exportTargetStatus,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      showToast.success('Excel report exported successfully');
    } else {
      const doc = new jsPDF('landscape');

      // Add Header
      const headerEndY = addPdfHeader(doc, companyInfo, 'Batch Production Report');

      // Add Filters Info
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      let subtitle = `Generated on: ${formatDateTime(new Date())}`;
      if (exportTargetStatus !== 'All') subtitle += ` | Status: ${exportTargetStatus}`;
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
      const tableRows = targetData.map(item => [
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
      const pdfFileName = getBatchReportFileName(exportTargetStatus, startDate, endDate, 'pdf');
      doc.save(pdfFileName);
      showToast.success('Report exported successfully');
    }
  };

  const handleExportAll = () => {
    if (filteredTableData.length === 0) {
      showToast.error('No data to export');
      return;
    }
    setExportTargetStatus(statusFilter);
    setExportModalOpen(true);
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
              <Download size={20} />
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
        metadataPath="/reports/batch-production"
        title="Batch Report For Accounts"
        description="Comprehensive view of all production batches"
        actions={
          <Button
            variant="primary"
            className="bg-[var(--color-success)] hover:opacity-90 text-white"
            onClick={handleExportAll}
            leftIcon={<Download size={20} />}
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
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Total Batches
                  </p>
                  <button
                    type="button"
                    title="Export Total Batches Report"
                    onClick={e => {
                      e.stopPropagation();
                      if (stats.total === 0) {
                        showToast.error('No data to export');
                        return;
                      }
                      setExportTargetStatus('All');
                      setExportModalOpen(true);
                    }}
                    className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-full transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
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
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                    In Progress
                  </p>
                  <button
                    type="button"
                    title="Export In Progress Batches Report"
                    onClick={e => {
                      e.stopPropagation();
                      if (stats.inProgress === 0) {
                        showToast.error('No In Progress batches to export');
                        return;
                      }
                      setExportTargetStatus('In Progress');
                      setExportModalOpen(true);
                    }}
                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
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
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-green-600 uppercase tracking-wider">
                    Completed
                  </p>
                  <button
                    type="button"
                    title="Export Completed Batches Report"
                    onClick={e => {
                      e.stopPropagation();
                      if (stats.completed === 0) {
                        showToast.error('No Completed batches to export');
                        return;
                      }
                      setExportTargetStatus('Completed');
                      setExportModalOpen(true);
                    }}
                    className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-full transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
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
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">
                    Cancelled
                  </p>
                  <button
                    type="button"
                    title="Export Cancelled Batches Report"
                    onClick={e => {
                      e.stopPropagation();
                      if (stats.cancelled === 0) {
                        showToast.error('No Cancelled batches to export');
                        return;
                      }
                      setExportTargetStatus('Cancelled');
                      setExportModalOpen(true);
                    }}
                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
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
                </h4>{' '}
                {row.original.rawMaterials && row.original.rawMaterials.length > 0 ? (
                  (() => {
                    const rawMaterialsList = (row.original.rawMaterials || []).filter(
                      rm => rm.productType !== 'PM'
                    );
                    const plannedQtyTotal = parseNumber(row.original.plannedQuantity) || 1;

                    const processedRegular = [];
                    const processedAdditional = [];

                    for (const rm of rawMaterialsList) {
                      // Highlight only manual Add/Reduce; Water % auto-adjustment must
                      // not flag rows (manual reductions aren't distinguishable from it
                      // in stored data). Adds are flagged via isAdditional.
                      const isReduced = false;
                      const computedPercentage =
                        (parseNumber(rm.actualQty) / plannedQtyTotal) * 100;

                      const processedObj = {
                        ...rm,
                        isReduced,
                        computedPercentage,
                      };

                      if (rm.isAdditional) {
                        processedAdditional.push(processedObj);
                      } else {
                        processedRegular.push(processedObj);
                      }
                    }

                    const all = [...processedRegular, ...processedAdditional];
                    const regular = all.filter(rm => !rm.isAdditional);
                    const additional = all.filter(rm => rm.isAdditional);

                    const totalPercentage = all.reduce((sum, rm) => sum + rm.computedPercentage, 0);
                    const totalActual = all.reduce(
                      (sum, rm) => sum + parseNumber(rm.actualQty || rm.percentage || '0'),
                      0
                    );
                    const anyExceeds100 = all.some(rm => rm.isAdditional || rm.isReduced);

                    return (
                      <>
                        <table className="w-full text-sm text-left bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                          <thead className="bg-[var(--color-neutral-100)] text-[var(--text-secondary)]">
                            <tr>
                              <th className="px-4 py-2 whitespace-nowrap">Material Name</th>
                              <th className="px-4 py-2 text-right whitespace-nowrap">
                                Percentage (%)
                              </th>
                              <th className="px-4 py-2 text-right whitespace-nowrap">
                                Actual Weight
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border)]">
                            {/* Regular materials */}
                            {regular.map((rm, index) => {
                              const isUnderline = rm.isReduced;
                              return (
                                <tr key={`${rm.rawMaterialId}-${index}`}>
                                  <td
                                    className={`px-4 py-2 text-[var(--text-primary)] ${isUnderline ? 'font-bold' : 'font-normal'}`}
                                  >
                                    {isUnderline ? <u>{rm.rawMaterialName}</u> : rm.rawMaterialName}
                                  </td>
                                  <td
                                    className={`px-4 py-2 text-right text-[var(--text-secondary)] ${isUnderline ? 'font-bold' : ''}`}
                                  >
                                    {formatNumber(rm.computedPercentage)}
                                  </td>
                                  <td
                                    className={`px-4 py-2 text-right text-[var(--text-secondary)] ${isUnderline ? 'font-bold' : ''}`}
                                  >
                                    {formatNumber(rm.actualQty || rm.percentage)}
                                  </td>
                                </tr>
                              );
                            })}
                            {/* Additional materials */}
                            {additional.map((rm, index) => {
                              const isUnderline = anyExceeds100;
                              const pctVal =
                                rm.computedPercentage <= 0.0001
                                  ? '-'
                                  : formatNumber(rm.computedPercentage);
                              return (
                                <tr key={`extra-${rm.rawMaterialId}-${index}`}>
                                  <td
                                    className={`px-4 py-2 text-[var(--text-primary)] ${isUnderline ? 'font-bold' : 'font-normal'}`}
                                  >
                                    {isUnderline ? <u>{rm.rawMaterialName}</u> : rm.rawMaterialName}
                                  </td>
                                  <td
                                    className={`px-4 py-2 text-right text-[var(--text-secondary)] ${isUnderline ? 'font-bold' : ''}`}
                                  >
                                    {pctVal}
                                  </td>
                                  <td
                                    className={`px-4 py-2 text-right text-[var(--text-secondary)] ${isUnderline ? 'font-bold' : ''}`}
                                  >
                                    {formatNumber(rm.actualQty || rm.percentage)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot className="bg-[var(--color-neutral-100)] font-semibold">
                            <tr>
                              <td className="px-4 py-2 text-[var(--text-primary)]">Total</td>
                              <td className="px-4 py-2 text-right text-[var(--text-primary)]">
                                {formatNumber(totalPercentage)}
                              </td>
                              <td className="px-4 py-2 text-right text-[var(--text-primary)]">
                                {formatNumber(totalActual)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                        {anyExceeds100 && (
                          <div className="text-[10px] text-red-500 font-semibold mt-2 pl-2">
                            * Underlined raw materials were added or reduced separately during batch
                            production.
                          </div>
                        )}
                      </>
                    );
                  })()
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
          <BatchReportPreviewContent
            batch={previewBatch}
            companyInfo={companyInfo}
            showDownload
            onDownload={() => handleDownloadBatch(previewBatch)}
          />
        </Modal>
      )}

      {downloadBatch && (
        <div className="fixed left-[-10000px] top-0 pointer-events-none" aria-hidden="true">
          <div className="p-4 sm:p-6" style={{ width: 'min(896px, 100vw)' }}>
            <BatchReportPreviewContent
              ref={downloadRef}
              batch={downloadBatch}
              companyInfo={companyInfo}
            />
          </div>
        </div>
      )}
      {/* Export Format Modal */}
      <ExportReportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onConfirm={handleConfirmExport}
        title="Export Report"
        subtitle="Choose Format"
      />
    </div>
  );
};

export default BatchProductionReport;
