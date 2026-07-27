import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface QualityVarianceData {
  stdDensity: number;
  actDensity: number;
  densityVariance: number;
  stdViscosity: number;
  actViscosity: number;
  viscosityVariance: number;
  stdFillDensity: number;
  actFillDensity: number;
  fillDensityVariance: number;
  totalActualWeight: number;
  totalLtr: number;
  totalKg: number;
  stdWeight: number;
  actWeight: number;
  weightVariance: number;
}

export function parseNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
  return isNaN(num) ? 0 : num;
}

export function formatNumber3(val: any): string {
  if (val === null || val === undefined || val === '') return '-';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
  if (isNaN(num)) return '-';
  return num.toFixed(3);
}

export function calculateQualityAndVarianceData(
  batch: any,
  ingredients: any[],
  filteredSubProducts: any[]
): QualityVarianceData {
  // 1. Total Actual Weight from Raw Materials
  const totalActualWeight = ingredients.reduce((sum, rm) => {
    return sum + (rm.effectiveActual ?? parseNumber(rm.actualQty ?? rm.percentage ?? '0'));
  }, 0);

  // 2. Total Output Liters from Sub Products
  const totalLtr = filteredSubProducts.reduce((sum, sp) => {
    const actualQty = parseFloat(sp.actualQty || '0');
    const plannedQty = parseFloat(sp.batchQty || '0');
    const effQty = actualQty > 0 ? actualQty : plannedQty;
    const capacity = sp.capacity ? parseFloat(sp.capacity.toString()) : 0;
    return sum + effQty * capacity;
  }, 0);

  // 3. Density
  const stdDensity = batch.density ? parseFloat(batch.density) : 0;
  const actDensity = batch.actualDensity ? parseFloat(batch.actualDensity) : 0;
  const densityVariance = actDensity - stdDensity;

  // 4. Viscosity
  const stdViscosity = batch.viscosity ? parseFloat(batch.viscosity) : 0;
  const actViscosity = batch.actualViscosity ? parseFloat(batch.actualViscosity) : 0;
  const viscosityVariance = actViscosity - stdViscosity;

  // 5. Filling Density
  const firstSubProduct = (batch.subProducts || [])[0];
  const stdFillDensity =
    parseFloat(firstSubProduct?.fillingDensity?.toString() || '0') ||
    parseFloat(batch.packingDensity || batch.density || '0');
  const actFillDensity = totalLtr > 0 ? totalActualWeight / totalLtr : 0;
  const fillDensityVariance = actFillDensity - stdFillDensity;

  // 6. Packing Table Total KG (Option 1 - Actual Packed Mass)
  const totalKg = filteredSubProducts.reduce((sum, sp) => {
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
    return sum + ltr * density;
  }, 0);

  // 7. Weight (Kg) - Total LTR value from Packing Table * Actual Filling Density (displayed 3-decimal value)
  const roundedActFillDensity = parseFloat(actFillDensity.toFixed(3));
  const stdWeight = totalActualWeight;
  const actWeight = totalLtr * roundedActFillDensity;
  const weightVariance = actWeight - stdWeight;

  return {
    stdDensity,
    actDensity,
    densityVariance,
    stdViscosity,
    actViscosity,
    viscosityVariance,
    stdFillDensity,
    actFillDensity,
    fillDensityVariance,
    totalActualWeight,
    totalLtr,
    totalKg,
    stdWeight,
    actWeight,
    weightVariance,
  };
}

export function drawQualityVariancePDFTable(
  doc: jsPDF,
  startY: number,
  rightTableX: number,
  rightTableWidth: number,
  data: QualityVarianceData,
  colors: { colorGray100: [number, number, number]; colorGray700: [number, number, number] }
) {
  autoTable(doc, {
    startY,
    margin: { left: rightTableX, right: 10 },
    head: [['Description', 'Parameter', 'Theoretical', 'Actual', 'Difference']],
    body: [
      [
        'Quality',
        'Density',
        data.stdDensity > 0 ? data.stdDensity.toFixed(3) : '-',
        data.actDensity > 0 ? data.actDensity.toFixed(3) : '-',
        data.densityVariance.toFixed(3),
      ],
      [
        '',
        'Viscosity',
        data.stdViscosity > 0 ? data.stdViscosity.toString() : '-',
        data.actViscosity > 0 ? data.actViscosity.toString() : '-',
        data.viscosityVariance.toFixed(2),
      ],
      [
        'Quantity',
        'Filling Density',
        data.stdFillDensity > 0 ? data.stdFillDensity.toFixed(3) : '-',
        data.actFillDensity > 0 ? data.actFillDensity.toFixed(3) : '-',
        data.fillDensityVariance.toFixed(3),
      ],
      [
        '',
        'Weight (Kg)',
        data.stdWeight > 0 ? data.stdWeight.toFixed(3) : '-',
        data.actWeight > 0 ? data.actWeight.toFixed(3) : '-',
        data.weightVariance.toFixed(2),
      ],
    ],
    theme: 'grid',
    styles: {
      // Larger, more readable sizing (matches the optimized reference layout).
      fontSize: 10,
      cellPadding: 1.0,
      lineColor: [229, 231, 235],
      lineWidth: 0.1,
      textColor: colors.colorGray700,
      valign: 'middle',
    },
    headStyles: {
      fillColor: colors.colorGray100,
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      // Header font slightly smaller than the body (10) so long headings
      // ("Description", "Theoretical", "Difference") fit on a single row at
      // the 96mm table width without wrapping or overlapping.
      fontSize: 9,
      valign: 'middle',
      lineWidth: 0.1,
      lineColor: [229, 231, 235],
    },
    columnStyles: {
      0: { cellWidth: 20, halign: 'left', fontStyle: 'bold' },
      1: { cellWidth: 23, halign: 'left' },
      2: { cellWidth: 20, halign: 'right' },
      3: { cellWidth: 15, halign: 'right' },
      4: { cellWidth: 18, halign: 'right' },
    },
    tableWidth: rightTableWidth,
    didDrawCell: cellData => {
      if (cellData.section === 'body' && cellData.row.index === 1) {
        const cell = cellData.cell;
        doc.setLineWidth(0.5);
        doc.setDrawColor(55, 65, 81);
        doc.line(cell.x, cell.y + cell.height, cell.x + cell.width, cell.y + cell.height);
      }
    },
  });
}
