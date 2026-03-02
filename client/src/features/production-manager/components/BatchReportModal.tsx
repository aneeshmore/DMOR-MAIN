import { useState, useEffect } from 'react';
import { X, FileDown, Printer } from 'lucide-react';
import { productionManagerApi } from '../api/productionManagerApi';
import { showToast } from '@/utils/toast';
import { Button, Modal } from '@/components/ui';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPdfFooter } from '@/utils/pdfUtils';
import { companyApi } from '@/features/company/api/companyApi';
import { CompanyInfo } from '@/features/company/types';

interface BatchReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  batchId: number;
  batchNo: string;
  reportType: 'batch-chart' | 'completion-chart';
}

export default function BatchReportModal({
  isOpen,
  onClose,
  batchId,
  batchNo,
  reportType,
}: BatchReportModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [batchData, setBatchData] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [relatedSkus, setRelatedSkus] = useState<any[]>([]); // All SKUs for this master product
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);

  useEffect(() => {
    if (!isOpen || !batchId) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const data = await productionManagerApi.getBatchDetails(batchId);
        setBatchData(data.batch);
        setMaterials(data.materials || []);
        setOrders(data.orders || []);
        setRelatedSkus(data.relatedSkus || []); // Get ALL SKUs for this master product
        console.log('BatchReportModal: relatedSkus fetched:', data.relatedSkus);
      } catch (error) {
        console.error('Failed to fetch batch data:', error);
        showToast.error('Failed to load batch details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    // Fetch Company Info
    const fetchCompanyInfo = async () => {
      try {
        const res = await companyApi.get();
        if (res.data) {
          setCompanyInfo((res.data as any).data || res.data);
        }
      } catch (err) {
        console.error('Failed to fetch company info', err);
      }
    };
    fetchCompanyInfo();
  }, [isOpen, batchId]);

  // Duration Calculation Helper
  const calculateDuration = (startStr: string, endStr: string) => {
    if (!startStr || !endStr) return '-';
    const start = new Date(startStr);
    const end = new Date(endStr);
    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return '-';

    const totalMinutes = Math.floor(diffMs / 60000);
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const mins = totalMinutes % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);

    return parts.join(' ');
  };

  // Sort materials by sequence first
  const sortedMaterials = [...materials].sort(
    (a: any, b: any) => (a.batchMaterial?.sequence || 0) - (b.batchMaterial?.sequence || 0)
  );

  // Get the highest sequence number from raw materials
  const maxRawMaterialSequence = sortedMaterials.reduce(
    (max: number, m: any) => Math.max(max, m.batchMaterial?.sequence || 0),
    0
  );

  // Extract packaging materials from orders
  const packagingMaterials = orders
    .filter((o: any) => o.packagingMasterProductName) // Only if packaging exists
    .map((o: any, idx: number) => {
      // Use the flattened fields from backend
      const unitPrice = parseFloat(o.packagingPurchaseCost || 0);
      const qty = Number(o.batchProduct?.plannedUnits) || 0;
      return {
        isPackaging: true,
        sequence: maxRawMaterialSequence + idx + 1,
        materialName: o.packagingMasterProductName,
        requiredQuantity: qty,
        unitPrice: unitPrice,
        total: unitPrice * qty,
        waitingTime: 0,
        isAdditional: false,
      };
    });

  // Keep raw materials separate from packaging
  const rawMaterialsOnly = sortedMaterials.map((m: any) => ({
    isPackaging: false,
    sequence: m.batchMaterial?.sequence || 0,
    materialName: m.masterProduct?.masterProductName || m.material?.productName || 'Unknown',
    requiredQuantity: parseFloat(m.batchMaterial?.requiredQuantity) || 0,
    waitingTime: parseInt(m.batchMaterial?.waitingTime) || 0,
    isAdditional: m.isAdditional === true || m.batchMaterial?.isAdditional === true,
    batchMaterial: m.batchMaterial,
    masterProduct: m.masterProduct,
    material: m.material,
  }));

  // For backward compatibility, keep allMaterials for totals
  const allMaterials = [...rawMaterialsOnly, ...packagingMaterials];

  const totalPackages = orders.reduce(
    (sum: number, o: any) => sum + (Number(o.batchProduct?.plannedUnits) || 0),
    0
  );

  const totalPlannedRawMaterials = rawMaterialsOnly.reduce(
    (sum: number, m: any) => sum + (m.requiredQuantity || 0),
    0
  );
  const totalWait = rawMaterialsOnly.reduce((sum: number, m: any) => sum + (m.waitingTime || 0), 0);
  const totalPackagingCost = packagingMaterials.reduce(
    (sum: number, m: any) => sum + (m.total || 0),
    0
  );

  const totalActualQty = orders.reduce(
    (sum: number, o: any) => sum + (Number(o.batchProduct?.producedUnits) || 0),
    0
  );

  // Calculate screen totals for product table
  let screenTotalLtr = 0;
  let screenTotalKg = 0;

  if (batchData?.status === 'Completed' && orders.length > 0) {
    orders.forEach((o: any) => {
      const capacityLtr = parseFloat(o.packagingCapacity || '0');
      const fillingDensity =
        parseFloat(o.product?.fillingDensity || '0') || parseFloat(batchData.fgDensity || '0');
      const actualQty = parseFloat(o.batchProduct?.producedUnits || '0');
      const plannedQty = parseFloat(o.batchProduct?.plannedUnits || '0');
      const effQty = actualQty > 0 ? actualQty : plannedQty;

      const ltr = effQty * capacityLtr;
      const kg = ltr * fillingDensity;
      screenTotalLtr += ltr;
      screenTotalKg += kg;
    });
  } else {
    // For scheduled/in-progress batches
    const ordersMapScreen = new Map<string, any>();
    orders.forEach((o: any) => {
      const productId = o.batchProduct?.productId || o.product?.productId;
      if (productId) ordersMapScreen.set(String(productId), o);
    });

    const skusToShow =
      relatedSkus.length > 0
        ? relatedSkus
        : orders.map((o: any) => ({
          productId: o.product?.productId,
          productName: o.product?.productName || 'Unknown',
        }));

    skusToShow.forEach((sku: any) => {
      const order = ordersMapScreen.get(String(sku.productId));
      const capacityLtr = parseFloat(order?.packagingCapacity || '0');
      const fillingDensity =
        parseFloat(order?.product?.fillingDensity || '0') || parseFloat(batchData?.fgDensity || '0');
      const plannedQty = parseFloat(order?.batchProduct?.plannedUnits || '0');
      const actualQty = parseFloat(order?.batchProduct?.producedUnits || '0');
      const effQty = actualQty > 0 ? actualQty : plannedQty;

      const ltr = effQty * capacityLtr;
      const kg = ltr * fillingDensity;
      screenTotalLtr += ltr;
      screenTotalKg += kg;
    });
  }

  // Export to PDF
  const handleExportPDF = () => {
    if (!batchData) return;

    const doc = new jsPDF();
    const batch = batchData;

    // Full Page Border
    doc.setLineWidth(0.5);
    doc.rect(5, 5, 200, 287);

    // Header
    doc.setFontSize(16);
    const companyHeaderName = companyInfo?.companyName || 'MOREX TECHNOLOGIES';
    doc.text(companyHeaderName.toUpperCase(), 105, 15, { align: 'center' });
    doc.line(14, 18, 196, 18);

    doc.setFontSize(10);

    let tablesStartY = 70; // Default start Y for main tables

    if (reportType === 'batch-chart') {
      // Batch Chart Report
      doc.text(`Batch No : ${batch.batchNo} / ${batch.masterProductName || ''}`, 14, 25);
      doc.text(
        `Date : ${new Date(batch.scheduledDate).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: '2-digit',
        })}`,
        115,
        25
      );
      doc.text(`Supervisor : Mr. ${batch.supervisorName || 'N/A'}`, 14, 32);
      doc.text(`Labours : ${batch.labourNames || 'N/A'}`, 14, 38);
      doc.text(`Actual Density : `, 115, 32);
      doc.text(`Product Viscosity : `, 115, 38);
      doc.text(`Mill Based Viscosity : `, 115, 44);

      // Hegman gauge: Numbers 1-8 in circles
      doc.text(`Hegman gauge :`, 115, 50);
      let circleX = 145;
      const hbY = 49.5;
      for (let i = 6; i <= 8; i++) {
        doc.setLineWidth(0.1);
        doc.circle(circleX, hbY, 2);
        doc.setFontSize(6);
        doc.text(i.toString(), circleX, hbY + 0.5, { align: 'center' });
        circleX += 6;
      }
      doc.setFontSize(10);

      doc.text(`Standard Density : ${batch.density ? Number(batch.density).toFixed(3) : '-'}`, 14, 44);
      doc.text(`Water % : ${batch.waterPercentage || '0.00'}`, 14, 50);
      doc.text(`Production Qty : ${batch.plannedQuantity}`, 14, 56);
      tablesStartY = 70;
    } else {
      // Completion Chart Report Header Info
      doc.text(`Batch No : ${batch.batchNo} / ${batch.masterProductName || ''}`, 14, 25, { maxWidth: 85 });
      doc.text(`Supervisor : Mr. ${batch.supervisorName || 'N/A'}`, 14, 32);
      doc.text(`Labours : ${batch.labourNames || 'N/A'}`, 14, 38);
      doc.text(
        `Date : ${new Date(batch.scheduledDate).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: '2-digit',
        })}`,
        14,
        44
      );

      const duration = calculateDuration(batch.startedAt, batch.completedAt);
      doc.text(`Total Time : ${duration}`, 14, 50);

      tablesStartY = 70;
    }

    // Calculate quality and variance values (Needed for both report types in the new layout)
    const stdDensity = batch.fgDensity
      ? parseFloat(batch.fgDensity)
      : batch.density
        ? parseFloat(batch.density)
        : 0;
    const actDensity = batch.actualDensity ? parseFloat(batch.actualDensity) : 0;
    const densityVariance = actDensity - stdDensity;

    const stdViscosity = batch.viscosity ? parseFloat(batch.viscosity) : 0;
    const actViscosity = batch.actualViscosity ? parseFloat(batch.actualViscosity) : 0;
    const viscosityVariance = actViscosity - stdViscosity;

    // Calculate total weight and variance
    // Standard = Sum of required quantities of raw materials
    const stdTotalWeight = rawMaterialsOnly.reduce(
      (sum: number, m: any) => sum + (m.requiredQuantity || 0),
      0
    );

    // Actual = Total LTR * Actual Density
    // Better way: use the orders array directly as it's available in scope
    const totalLtrForActWeight = orders.reduce((s: number, o: any) => {
      const actualQty = parseFloat(o.batchProduct?.producedUnits || '0');
      const capacityLtr = parseFloat(o.packagingCapacity || '0');
      return s + actualQty * capacityLtr;
    }, 0);

    const actTotalWeight = totalLtrForActWeight * actDensity;
    const totalWeightVariance = actTotalWeight - stdTotalWeight;

    // Raw Materials Table (Only raw materials, no packaging)
    // Separate regular materials from additional materials
    const regularMaterials = rawMaterialsOnly.filter(
      (m: any) => !m.isAdditional && !m.batchMaterial?.isAdditional
    );
    const additionalMaterials = rawMaterialsOnly.filter(
      (m: any) => m.isAdditional || m.batchMaterial?.isAdditional
    );

    // Regular materials data (with sequence)
    const regularBomData = regularMaterials.map((m: any, idx: number) => [
      m.sequence || idx + 1,
      m.materialName,
      m.waitingTime ? `${m.waitingTime}m` : '', // Blank instead of -
      m.requiredQuantity.toFixed(3),
      reportType === 'completion-chart'
        ? m.batchMaterial?.actualQuantity
          ? parseFloat(m.batchMaterial.actualQuantity).toFixed(3)
          : ''
        : '',
    ]);

    // Additional materials data (shown at bottom, sequence continues)
    const additionalBomData = additionalMaterials.map((m: any, idx: number) => [
      regularMaterials.length + idx + 1, // Continue sequence after regular materials
      m.materialName,
      '', // Blank - no wait time for additional
      m.requiredQuantity.toFixed(3),
      reportType === 'completion-chart'
        ? m.batchMaterial?.actualQuantity
          ? parseFloat(m.batchMaterial.actualQuantity).toFixed(3)
          : ''
        : '',
    ]);

    // Combined BOM data: regular materials first, then additional at bottom
    const bomData = [...regularBomData, ...additionalBomData];

    // Track which rows are additional for bold styling
    const additionalStartIndex = regularMaterials.length;

    // Packaging Materials Data
    const packagingData = packagingMaterials.map((p: any) => [
      p.materialName,
      p.requiredQuantity.toString(),
    ]);

    // Prepare Product Data (Right Side) - Show SKUs with production data
    // For completed batches, use orders directly (they have actual production data with product names)
    // For scheduled/in-progress batches, use relatedSkus to show all possible SKUs
    let productData: (string | number)[][] = [];

    if ((reportType === 'completion-chart' || batchData.status === 'Completed') && orders.length > 0) {
      // For completed batches, use orders directly - this has the actual SKU data
      productData = orders.map((o: any) => {
        const productName = o.product?.productName || 'Unknown';
        const capacityLtr = parseFloat(o.packagingCapacity || '0');
        const fillingDensity =
          parseFloat(o.product?.fillingDensity || '0') || parseFloat(batch.fgDensity || '0');
        const plannedQty = parseFloat(o.batchProduct?.plannedUnits || '0');
        const actualQty = parseFloat(o.batchProduct?.producedUnits || '0');

        const effQty = actualQty > 0 ? actualQty : plannedQty;
        const ltr = effQty * capacityLtr;
        const kg = ltr * fillingDensity;

        return [
          productName,
          plannedQty > 0 ? plannedQty.toString() : '0',
          actualQty > 0 ? actualQty.toString() : '',
          '',
          kg > 0 ? kg.toFixed(3) : '',
        ];
      });
    } else {
      // For non-completed batches, use relatedSkus with order lookup
      const ordersByProductId = new Map<string, any>();
      orders.forEach((o: any) => {
        const productId = o.batchProduct?.productId || o.product?.productId;
        if (productId) {
          ordersByProductId.set(String(productId), o);
        }
      });

      // Use ALL SKUs from relatedSkus, with qty = 0 if no order
      console.log('PDF: relatedSkus', relatedSkus);
      console.log('PDF: ordersByProductId', Array.from(ordersByProductId.entries()));

      productData = relatedSkus.map((sku: any) => {
        const order = ordersByProductId.get(String(sku.productId));
        const productName = sku.productName || 'Unknown';
        const plannedQty = parseFloat(order?.batchProduct?.plannedUnits || '0');
        const actualQty = parseFloat(order?.batchProduct?.producedUnits || '0');

        const capacityLtr = parseFloat(order?.packagingCapacity || '0');
        const fillingDensity =
          parseFloat(order?.product?.fillingDensity || '0') || parseFloat(batch.fgDensity || '0');

        const effQty = actualQty > 0 ? actualQty : plannedQty;
        const ltr = effQty * capacityLtr;
        const kg = ltr * fillingDensity;

        return [
          productName,
          plannedQty > 0 ? plannedQty.toString() : '0',
          actualQty > 0 ? actualQty.toString() : '',
          '',
          kg > 0 ? kg.toFixed(3) : '',
        ];
      });

      // Fallback: if no relatedSkus, use orders
      if (relatedSkus.length === 0 && orders.length > 0) {
        productData = orders.map((o: any) => {
          const capacityLtr = parseFloat(o.packagingCapacity || '0');
          const fillingDensity =
            parseFloat(o.product?.fillingDensity || '0') || parseFloat(batch.fgDensity || '0');
          const plannedQty = parseFloat(o.batchProduct?.plannedUnits || '0');
          const actualQty = parseFloat(o.batchProduct?.producedUnits || '0');

          const effQty = actualQty > 0 ? actualQty : plannedQty;
          const ltr = effQty * capacityLtr;
          const kg = ltr * fillingDensity;

          return [
            o.product?.productName || 'Unknown',
            plannedQty > 0 ? plannedQty.toString() : '0',
            actualQty > 0 ? actualQty.toString() : '',
            '',
            kg > 0 ? kg.toFixed(3) : '',
          ];
        });
      }
    }

    // No padding - show only actual SKUs
    // But keep BOM padding for empty check rows
    while (bomData.length < Math.max(bomData.length, 5)) {
      bomData.push(['', '', '', '', '']);
    }

    // Calculate totals for Product Table
    console.log('PDF: productData', productData);
    const totalLtr = productData.reduce((sum, row) => sum + (parseFloat(row[3] as string) || 0), 0);
    const totalKg = productData.reduce((sum, row) => sum + (parseFloat(row[4] as string) || 0), 0);
    console.log('PDF: calculated totalKg', totalKg);

    const sideBySideStartPage = doc.internal.pages.length;

    // Draw Material Table (Left Side)
    autoTable(doc, {
      startY: tablesStartY,
      head: [
        reportType === 'batch-chart'
          ? ['Seq', 'Product', 'Wait', 'UseQty', 'Check']
          : ['Seq', 'Product', 'Wait', 'Planned', 'Actual'],
      ],
      body: bomData,
      foot: [
        [
          { content: 'Total', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', textColor: 0 } },
          { content: totalPlannedRawMaterials.toFixed(3), styles: { fontStyle: 'bold', textColor: 0 } },
          '',
        ],
      ],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, minCellHeight: 6, lineColor: 0, lineWidth: 0.2, fillColor: [255, 255, 255] },
      headStyles: { textColor: 0, fontStyle: 'bold', fillColor: [255, 255, 255] },
      bodyStyles: { fillColor: [255, 255, 255] },
      margin: { left: 14, right: 108 }, // Increased right margin for wider gap
      tableWidth: 84, // Slightly narrower
      pageBreak: 'avoid',
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 39 },
        2: { cellWidth: 10, halign: 'center' },
        3: { cellWidth: 15, halign: 'right' },
        4: { cellWidth: 12, halign: 'right' },
      },
      didParseCell: data => {
        if (data.section === 'body') {
          const rowIndex = data.row.index;
          if (rowIndex >= additionalStartIndex && additionalStartIndex < bomData.length) {
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });

    const leftTableFinalY = (doc as any).lastAutoTable.finalY;
    const leftTableFinalPage = doc.internal.pages.length;

    // Reset to starting page for Right Column
    doc.setPage(sideBySideStartPage);

    // RIGHT Column: Table Stack (Parameters -> Shades -> Packaging)
    const rightMargin = 14;
    const rightTableX = 108; // Increased from 105 for wider gap
    const rightTableWidth = 88; // Slightly narrower

    // 1. Parameters Table
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Quality & Variance Analysis', rightTableX, tablesStartY - 2);

    autoTable(doc, {
      startY: tablesStartY,
      margin: { left: rightTableX, right: rightMargin },
      head: [['Parameter', 'Input', 'Output', 'Var']],
      body: [
        ['Density', stdDensity.toFixed(2), actDensity.toFixed(2), densityVariance.toFixed(2)],
        [
          'Viscosity',
          stdViscosity > 0 ? stdViscosity.toString() : '-',
          actViscosity > 0 ? actViscosity.toString() : '-',
          viscosityVariance !== 0 ? viscosityVariance.toFixed(2) : '-',
        ],
        [
          'Weight (Kg)',
          stdTotalWeight.toFixed(2),
          totalKg > 0 ? totalKg.toFixed(3) : '-', // Use totalKg from Shades table
          (totalKg - stdTotalWeight).toFixed(2), // Update variance based on new totalKg
        ],
      ],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, minCellHeight: 6, lineColor: 0, lineWidth: 0.2, fillColor: [255, 255, 255] },
      headStyles: { textColor: 0, fontStyle: 'bold', fontSize: 7, fillColor: [255, 255, 255] },
      bodyStyles: { fillColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 20, halign: 'right' },
        2: { cellWidth: 20, halign: 'right' },
        3: { cellWidth: 20, halign: 'right' },
      },
      tableWidth: rightTableWidth,
    });

    let rightStackY = (doc as any).lastAutoTable.finalY + 8;

    // 2. Shades Table
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Shades', rightTableX, rightStackY - 2);

    autoTable(doc, {
      startY: rightStackY,
      margin: { left: rightTableX, right: rightMargin },
      head: [['Shade', 'QTY', 'Filled', 'LTR', 'KG']],
      body: productData,
      foot: [
        [
          'Total',
          totalPackages.toString(),
          '',
          '',
          totalKg > 0 ? totalKg.toFixed(3) : '',
        ],
      ],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, minCellHeight: 6, lineColor: 0, lineWidth: 0.2, fillColor: [255, 255, 255] },
      headStyles: { textColor: 0, fontStyle: 'bold', fillColor: [255, 255, 255] },
      bodyStyles: { fillColor: [255, 255, 255] },
      footStyles: { textColor: 0, fontStyle: 'bold', fillColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 31 },
        1: { cellWidth: 15, halign: 'center' },
        2: { cellWidth: 12 },
        3: { cellWidth: 15 },
        4: { cellWidth: 15, halign: 'right' },
      },
      tableWidth: rightTableWidth,
      pageBreak: 'avoid',
    });

    rightStackY = (doc as any).lastAutoTable.finalY + 8;

    // 3. Packaging Table (Only if raw materials contains packaging)
    if (packagingData.length > 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Packaging Materials', rightTableX, rightStackY - 2);

      autoTable(doc, {
        startY: rightStackY,
        margin: { left: rightTableX, right: rightMargin },
        head: [['Material', 'QTY']],
        body: packagingData,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, minCellHeight: 6, lineColor: 0, lineWidth: 0.2, fillColor: [255, 255, 255] },
        headStyles: { textColor: 0, fontStyle: 'bold', fillColor: [255, 255, 255] },
        bodyStyles: { fillColor: [255, 255, 255] },
        columnStyles: {
          0: { cellWidth: 63 },
          1: { cellWidth: 25, halign: 'right' },
        },
        tableWidth: rightTableWidth,
        pageBreak: 'avoid',
      });
      rightStackY = (doc as any).lastAutoTable.finalY;
    }

    const rightTableFinalPage = doc.internal.pages.length;

    // Determine max page reached
    const maxPage = Math.max(leftTableFinalPage, rightTableFinalPage);
    doc.setPage(maxPage);

    // Calculate finalYTotal based on which column is longer on the MAX page
    let finalYTotal;
    if (leftTableFinalPage > rightTableFinalPage) {
      finalYTotal = leftTableFinalY + 10;
    } else if (rightTableFinalPage > leftTableFinalPage) {
      finalYTotal = rightStackY + 10;
    } else {
      finalYTotal = Math.max(leftTableFinalY, rightStackY) + 10;
    }

    // Additional Materials - Now Merged into main table logic with bolditalic
    // if (additionalMaterials.length > 0) { ... } -> Removed

    // Production Summary Table (SKU-level with APP QTY)
    if (relatedSkus.length > 0) {
      // Build orders map for quick lookup
      const ordersMapPdf = new Map<string, any>();
      orders.forEach((o: any) => {
        const productId = o.batchProduct?.productId || o.product?.productId;
        if (productId) ordersMapPdf.set(String(productId), o);
      });

      // Prepare production summary data
      const prodSummaryData = relatedSkus.map((sku: any) => {
        const order = ordersMapPdf.get(String(sku.productId));
        const productName = sku.productName || 'Unknown';
        const appQty = parseFloat(sku.availableQuantity || '0');
        const batchQty = parseFloat(order?.batchProduct?.plannedUnits || '0');

        return [
          productName,
          appQty > 0 ? appQty.toFixed(2) : '0.00',
          '',
          '', // DISPATCH QTY - empty
          '', // TOTAL - empty
          '', // ACTUAL QTY - empty
          '', // DIFFERENCE - empty
        ];
      });

      autoTable(doc, {
        startY: finalYTotal + 5,
        head: [
          ['Product', 'APP QTY', 'BATCH QTY', 'DISPATCH QTY', 'TOTAL', 'ACTUAL QTY', 'DIFFERENCE'],
        ],
        body: prodSummaryData,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1.5, minCellHeight: 6, lineColor: 0, lineWidth: 0.2, fillColor: [255, 255, 255] },
        headStyles: {
          textColor: 0,
          fontStyle: 'bold',
          halign: 'center',
          fillColor: [255, 255, 255]
        },
        bodyStyles: { fillColor: [255, 255, 255] },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 20, halign: 'center' },
          2: { cellWidth: 22, halign: 'center' },
          3: { cellWidth: 25, halign: 'center' },
          4: { cellWidth: 18, halign: 'center' },
          5: { cellWidth: 22, halign: 'center' },
          6: { cellWidth: 23, halign: 'center' },
        },
        margin: { left: 14, right: 14, top: 20, bottom: 30 },
        showHead: 'everyPage', // Repeat header on every page
        pageBreak: 'auto', // Automatic page breaks
        rowPageBreak: 'avoid', // Try to avoid breaking rows across pages
      });

      finalYTotal = (doc as any).lastAutoTable.finalY;
    }

    const finalYFooter = finalYTotal;

    // Separator line
    doc.setLineWidth(0.2);
    doc.line(14, finalYFooter + 10, 196, finalYFooter + 10);

    // Footer
    doc.text('Production Remark :', 14, finalYFooter + 15);
    if (reportType === 'completion-chart' && batch.productionRemarks) {
      doc.text(batch.productionRemarks, 14, finalYFooter + 22);
    }

    doc.text('Labours Sign :-', 40, finalYFooter + 40);
    doc.text(batch.labourNames || '', 40, finalYFooter + 46);

    doc.text('Superviser Sign :-', 150, finalYFooter + 40);
    doc.text(`Mr. ${batch.supervisorName || ''}`, 150, finalYFooter + 46);

    const fileName =
      reportType === 'batch-chart'
        ? `Batch_${batch.batchNo}.pdf`
        : `Completion_${batch.batchNo}.pdf`;

    addPdfFooter(doc);

    doc.save(fileName);
    showToast.success('PDF Downloaded!');
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${reportType === 'batch-chart' ? 'Batch Chart' : 'Completion Report'} - ${batchNo}`}
      size="lg"
    >
      <div className="bg-white p-4 md:p-8 rounded-lg shadow-sm border border-gray-200 w-full mx-auto printable-content text-black">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
          </div>
        ) : batchData ? (
          <div className="border-2 border-gray-800 p-6 min-h-[600px] bg-white text-black">
            {/* Header */}
            <div className="text-center mb-4">
              <h1 className="text-2xl font-bold">{companyInfo?.companyName || 'DMOR PAINTS'}</h1>
              <div className="border-b-2 border-gray-800 mt-2"></div>
            </div>

            {/* Batch Info */}
            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div>
                <p>
                  <span className="font-semibold">Batch No:</span> {batchData.batchNo}
                </p>
                <p>
                  <span className="font-semibold">Product Name:</span>{' '}
                  {batchData.masterProductName || 'N/A'}
                </p>
                <p>
                  <span className="font-semibold">Supervisor:</span> Mr.{' '}
                  {batchData.supervisorName || 'N/A'}
                </p>
                <p>
                  <span className="font-semibold">Labours:</span> {batchData.labourNames || 'N/A'}
                </p>
                <p>
                  <span className="font-semibold">Standard Density:</span>{' '}
                  {batchData.density ? Number(batchData.density).toFixed(3) : '-'}
                </p>
                <p>
                  <span className="font-semibold">Water %:</span>{' '}
                  {batchData.waterPercentage || '0.00'}
                </p>
                <p>
                  <span className="font-semibold">Production Qty:</span>{' '}
                  {batchData.plannedQuantity}
                </p>
              </div>
              <div>
                <p>
                  <span className="font-semibold">Date:</span>{' '}
                  {new Date(batchData.scheduledDate).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: '2-digit',
                  })}
                </p>
                {reportType === 'batch-chart' ? (
                  <>
                    <p>
                      <span className="font-semibold">Actual Density:</span>{' '}
                    </p>
                    <p>
                      <span className="font-semibold">Product Viscosity:</span>{' '}
                    </p>
                    <p>
                      <span className="font-semibold">Mill Based Viscosity:</span>{' '}
                    </p>
                    <div className="flex items-center gap-2 py-1 whitespace-nowrap">
                      <span className="font-semibold">Hegman gauge:</span>
                      <div className="flex gap-1.5">
                        {[6, 7, 8].map((num) => (
                          <div
                            key={num}
                            className="w-5 h-5 border border-black rounded-full flex items-center justify-center text-[10px] leading-none"
                          >
                            {num}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <p>
                      <span className="font-semibold">Total Time:</span>{' '}
                      {calculateDuration(batchData.startedAt, batchData.completedAt)}
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="text-right">
              {reportType === 'batch-chart' ? (
                <>
                </>
              ) : (
                /* Quality & Variance Analysis Table for Completion Chart */
                <div className="text-left">
                  <h4 className="font-bold text-xs mb-1 text-gray-700">
                    Quality & Variance Analysis
                  </h4>
                  <table className="w-full border-collapse border border-gray-600 text-xs">
                    <thead>
                      <tr>
                        <th className="border border-gray-600 px-1 py-0.5">Parameter</th>
                        <th className="border border-gray-600 px-1 py-0.5">Input</th>
                        <th className="border border-gray-600 px-1 py-0.5">Output</th>
                        <th className="border border-gray-600 px-1 py-0.5">Variance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const stdDensity = batchData.fgDensity
                          ? parseFloat(batchData.fgDensity)
                          : batchData.density
                            ? parseFloat(batchData.density)
                            : 0;
                        const actDensity = batchData.actualDensity
                          ? parseFloat(batchData.actualDensity)
                          : 0;
                        const densityVariance = actDensity - stdDensity;

                        const stdViscosity = batchData.viscosity
                          ? parseFloat(batchData.viscosity)
                          : 0;
                        const actViscosity = batchData.actualViscosity
                          ? parseFloat(batchData.actualViscosity)
                          : 0;
                        const viscosityVariance = actViscosity - stdViscosity;

                        const actualQty = batchData.actualQuantity
                          ? parseFloat(batchData.actualQuantity)
                          : 0;
                        const stdTotalWeight = rawMaterialsOnly.reduce(
                          (sum: number, m: any) => sum + (m.requiredQuantity || 0),
                          0
                        );

                        const totalLtrForActWeight = orders.reduce((s: number, o: any) => {
                          const actualQty = parseFloat(o.batchProduct?.producedUnits || '0');
                          const capacityLtr = parseFloat(o.packagingCapacity || '0');
                          return s + actualQty * capacityLtr;
                        }, 0);

                        const actTotalWeight = totalLtrForActWeight * actDensity;
                        const totalWeightVariance = actTotalWeight - stdTotalWeight;

                        return (
                          <>
                            <tr>
                              <td className="border border-gray-600 px-1 py-0.5">Standard Density</td>
                              <td className="border border-gray-600 px-1 py-0.5 text-right">
                                {stdDensity.toFixed(2)}
                              </td>
                              <td className="border border-gray-600 px-1 py-0.5 text-right">
                                {actDensity.toFixed(2)}
                              </td>
                              <td className="border border-gray-600 px-1 py-0.5 text-right">
                                {densityVariance.toFixed(2)}
                              </td>
                            </tr >
                            <tr>
                              <td className="border border-gray-600 px-1 py-0.5">Viscosity</td>
                              <td className="border border-gray-600 px-1 py-0.5 text-right">
                                {stdViscosity > 0 ? stdViscosity : '-'}
                              </td>
                              <td className="border border-gray-600 px-1 py-0.5 text-right">
                                {actViscosity > 0 ? actViscosity : '-'}
                              </td>
                              <td className="border border-gray-600 px-1 py-0.5 text-right">
                                {viscosityVariance.toFixed(2)}
                              </td>
                            </tr>
                            <tr>
                              <td className="border border-gray-600 px-1 py-0.5">
                                Total Weight (Kg)
                              </td>
                              <td className="border border-gray-600 px-1 py-0.5 text-right">
                                {stdTotalWeight.toFixed(2)}
                              </td>
                              <td className="border border-gray-600 px-1 py-0.5 text-right">
                                {screenTotalKg > 0 ? screenTotalKg.toFixed(3) : '-'}
                              </td>
                              <td className="border border-gray-600 px-1 py-0.5 text-right">
                                {(screenTotalKg - stdTotalWeight).toFixed(2)}
                              </td>
                            </tr>
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </div>


            {/* Main Content Areas: Side-by-Side Tables */}
            <div className="flex gap-4 items-start">
              {/* Left Side: Materials Table */}
              <div className="flex-1">
                <table className="w-full border-collapse border border-gray-800 text-sm mb-4">
                  <thead>
                    <tr>
                      <th className="border border-gray-800 px-2 py-1 w-8">Seq</th>
                      <th className="border border-gray-800 px-2 py-1">Product</th>
                      <th className="border border-gray-800 px-2 py-1 w-12">Wait</th>
                      <th className="border border-gray-800 px-2 py-1 w-16">
                        {reportType === 'batch-chart' ? 'UseQty' : 'Planned'}
                      </th>
                      <th className="border border-gray-800 px-2 py-1 w-16">
                        {reportType === 'batch-chart' ? 'Check' : 'Actual'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {/* Regular materials first */}
                    {rawMaterialsOnly
                      .filter(
                        (m: any) =>
                          !m.isAdditional &&
                          !m.batchMaterial?.isAdditional &&
                          parseFloat(m.requiredQuantity || '0') > 0
                      )
                      .map((m: any, idx: number) => (
                        <tr key={idx} className="hover:bg-[var(--surface-hover)]">
                          <td className="px-2 py-1 text-xs border border-gray-800 text-center">
                            {m.sequence || idx + 1}
                          </td>
                          <td className="px-2 py-1 text-xs border border-gray-800">
                            {m.materialName}
                          </td>
                          <td className="px-2 py-1 text-xs border border-gray-800 text-center">
                            {m.waitingTime ? `${m.waitingTime}m` : ''}
                          </td>
                          <td className="px-2 py-1 text-xs border border-gray-800 text-right">
                            {m.requiredQuantity.toFixed(3)}
                          </td>
                          <td className="px-2 py-1 text-xs border border-gray-800 text-right">
                          </td>
                        </tr>
                      ))}
                    {/* Additional materials at bottom in bold */}
                    {rawMaterialsOnly
                      .filter(
                        (m: any) =>
                          m.isAdditional ||
                          m.batchMaterial?.isAdditional ||
                          parseFloat(m.requiredQuantity || '0') <= 0
                      )
                      .map((m: any, idx: number) => {
                        const regularCount = rawMaterialsOnly.filter(
                          (rm: any) =>
                            !rm.isAdditional &&
                            !rm.batchMaterial?.isAdditional &&
                            parseFloat(rm.requiredQuantity || '0') > 0
                        ).length;
                        return (
                          <tr key={`extra-${idx}`} className="hover:bg-[var(--surface-hover)]">
                            <td className="px-2 py-1 text-xs border border-gray-800 text-center font-bold">
                              {regularCount + idx + 1}
                            </td>
                            <td className="px-2 py-1 text-xs border border-gray-800 font-bold">
                              {m.materialName}
                            </td>
                            <td className="px-2 py-1 text-xs border border-gray-800 text-center font-bold"></td>
                            <td className="px-2 py-1 text-xs border border-gray-800 text-right font-bold">
                              {m.requiredQuantity.toFixed(3)}
                            </td>
                            <td className="px-2 py-1 text-xs border border-gray-800 text-right font-bold">
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-white text-black font-bold">
                      <td colSpan={2} className="border border-gray-800 px-2 py-1 text-right">
                        Total
                      </td>
                      <td className="border border-gray-800 px-2 py-1 text-center">{totalWait}m</td>
                      <td className="border border-gray-800 px-2 py-1 text-right">
                        {totalPlannedRawMaterials.toFixed(3)}
                      </td>
                      <td className="border border-gray-800 px-2 py-1"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Right Side: Products (SKUs) Table */}
              <div className="flex-1">
                <table className="w-full border-collapse border border-gray-800 text-sm mb-4">
                  <thead>
                    <tr>
                      <th className="border border-gray-800 px-2 py-1">Shade</th>
                      <th className="border border-gray-800 px-2 py-1 w-12">QTY</th>
                      <th className="border border-gray-800 px-2 py-1 w-16">ACT QTY</th>
                      <th className="border border-gray-800 px-2 py-1 w-12">LTR</th>
                      <th className="border border-gray-800 px-2 py-1 w-16">KG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // For completed batches, use orders directly (they have actual production data with product names)
                      // For scheduled/in-progress batches, use relatedSkus to show all possible SKUs
                      if (batchData.status === 'Completed' && orders.length > 0) {
                        // Use orders directly for completed batches - this has the actual SKU data
                        return orders.map((o: any, idx: number) => {
                          const productName = o.product?.productName || 'Unknown';
                          const capacityLtr = parseFloat(o.packagingCapacity || '0');
                          const fillingDensity =
                            parseFloat(o.product?.fillingDensity || '0') ||
                            parseFloat(batchData.fgDensity || '0');

                          const plannedQty = parseFloat(o.batchProduct?.plannedUnits || '0');
                          const actualQty = parseFloat(o.batchProduct?.producedUnits || '0');
                          const effQty = actualQty > 0 ? actualQty : plannedQty;
                          const ltr = effQty * capacityLtr;
                          const kg = ltr * fillingDensity;

                          return (
                            <tr key={idx}>
                              <td className="border border-gray-800 px-2 py-1">{productName}</td>
                              <td className="border border-gray-800 px-2 py-1 text-center">
                                {plannedQty > 0 ? plannedQty : 0}
                              </td>
                              <td className="border border-gray-800 px-2 py-1 text-center">
                                {actualQty > 0 ? actualQty : ''}
                              </td>
                              <td className="border border-gray-800 px-2 py-1 text-right">
                                {ltr > 0 ? ltr.toFixed(3) : ''}
                              </td>
                              <td className="border border-gray-800 px-2 py-1 text-right">
                                {kg > 0 ? kg.toFixed(3) : ''}
                              </td>
                            </tr>
                          );
                        });
                      }

                      const ordersMapScreen = new Map<string, any>();
                      orders.forEach((o: any) => {
                        const productId = o.batchProduct?.productId || o.product?.productId;
                        if (productId) ordersMapScreen.set(String(productId), o);
                      });

                      const skusToShow =
                        relatedSkus.length > 0
                          ? relatedSkus
                          : orders.map((o: any) => ({
                            productId: o.product?.productId,
                            productName: o.product?.productName || 'Unknown',
                          }));

                      return skusToShow.map((sku: any, idx: number) => {
                        const order = ordersMapScreen.get(String(sku.productId));
                        const capacityLtr = parseFloat(order?.packagingCapacity || '0');
                        const fillingDensity =
                          parseFloat(order?.product?.fillingDensity || '0') ||
                          parseFloat(batchData.fgDensity || '0');

                        const plannedQty = parseFloat(order?.batchProduct?.plannedUnits || '0');
                        const actualQty = parseFloat(order?.batchProduct?.producedUnits || '0');

                        const effQty = actualQty > 0 ? actualQty : plannedQty;
                        const ltr = effQty * capacityLtr;
                        const kg = ltr * fillingDensity;

                        return (
                          <tr key={idx}>
                            <td className="border border-gray-800 px-2 py-1">
                              {sku.productName || 'Unknown'}
                            </td>
                            <td className="border border-gray-800 px-2 py-1 text-center">
                              {plannedQty > 0 ? plannedQty : 0}
                            </td>
                            <td className="border border-gray-800 px-2 py-1 text-center">
                              {actualQty > 0 ? actualQty : ''}
                            </td>
                            <td className="border border-gray-800 px-2 py-1 text-right">
                              {ltr > 0 ? ltr.toFixed(3) : ''}
                            </td>
                            <td className="border border-gray-800 px-2 py-1 text-right">
                              {kg > 0 ? kg.toFixed(3) : ''}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                  <tfoot>
                    <tr className="bg-white text-black font-bold">
                      <td className="border border-gray-800 px-2 py-1 text-right" colSpan={1}>
                        Total
                      </td>
                      <td className="border border-gray-800 px-2 py-1 text-center">
                        {totalPackages}
                      </td>
                      <td className="border border-gray-800 px-2 py-1 text-center">
                      </td>
                      <td className="border border-gray-800 px-2 py-1 text-right">
                        {(orders.reduce((s: number, o: any) => {
                          const actualQty = parseFloat(o.batchProduct?.producedUnits || '0');
                          const capacityLtr = parseFloat(o.packagingCapacity || '0');
                          return s + actualQty * capacityLtr;
                        }, 0) || 0).toFixed(3)}
                      </td>
                      <td className="border border-gray-800 px-2 py-1 text-right font-bold">
                        {screenTotalKg > 0 ? screenTotalKg.toFixed(3) : ''}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Additional Materials - Removed as separate table, now merged */}
            {/* {additionalMaterials.length > 0 && ( ... )} */}

            {/* Production Summary Table */}
            {relatedSkus.length > 0 && (
              <div className="mt-4">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-800 text-sm">
                    <thead>
                      <tr>
                        <th className="border border-gray-800 px-2 py-1 text-left">Product</th>
                        <th className="border border-gray-800 px-2 py-1 w-16 text-center">
                          APP QTY
                        </th>
                        <th className="border border-gray-800 px-2 py-1 w-20 text-center">
                          BATCH QTY
                        </th>
                        <th className="border border-gray-800 px-2 py-1 w-24 text-center">
                          DISPATCH QTY
                        </th>
                        <th className="border border-gray-800 px-2 py-1 w-16 text-center">TOTAL</th>
                        <th className="border border-gray-800 px-2 py-1 w-20 text-center">
                          ACTUAL QTY
                        </th>
                        <th className="border border-gray-800 px-2 py-1 w-20 text-center">
                          DIFFERENCE
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        // Build orders map for quick lookup
                        const ordersMapScreen = new Map<string, any>();
                        orders.forEach((o: any) => {
                          const productId = o.batchProduct?.productId || o.product?.productId;
                          if (productId) ordersMapScreen.set(String(productId), o);
                        });

                        return relatedSkus.map((sku: any, idx: number) => {
                          const order = ordersMapScreen.get(String(sku.productId));
                          const appQty = parseFloat(sku.availableQuantity || '0');
                          const batchQty = parseFloat(order?.batchProduct?.plannedUnits || '0');

                          return (
                            <tr key={idx} className="hover:bg-[var(--surface-hover)]">
                              <td className="border border-gray-800 px-2 py-1">
                                {sku.productName || 'Unknown'}
                              </td>
                              <td className="border border-gray-800 px-2 py-1 text-center">
                                {appQty > 0 ? appQty.toFixed(2) : '0.00'}
                              </td>
                              <td className="border border-gray-800 px-2 py-1 text-center">
                              </td>
                              <td className="border border-gray-800 px-2 py-1 text-center"></td>
                              <td className="border border-gray-800 px-2 py-1 text-center"></td>
                              <td className="border border-gray-800 px-2 py-1 text-center"></td>
                              <td className="border border-gray-800 px-2 py-1 text-center"></td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Production Remarks */}
            <div className="border-t-2 border-gray-800 pt-4 mt-4">
              <p className="font-semibold">Production Remark:</p>
              {reportType === 'completion-chart' && batchData.productionRemarks && (
                <p className="mt-1">{batchData.productionRemarks}</p>
              )}
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 mt-8">
              <div>
                <p className="font-semibold">Labours Sign:</p>
                <p className="mt-2">{batchData.labourNames || ''}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">Supervisor Sign:</p>
                <p className="mt-2">Mr. {batchData.supervisorName || ''}</p>
              </div>
            </div>

            {/* Download PDF Button */}
            <div className="mt-8 flex justify-center">
              <Button
                variant="primary"
                onClick={handleExportPDF}
                disabled={isLoading || !batchData}
                leftIcon={<FileDown size={18} />}
              >
                Download PDF
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-10">Failed to load batch data</div>
        )}
      </div>
    </Modal >
  );
}
