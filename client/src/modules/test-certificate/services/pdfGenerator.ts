import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TestCertificate } from '../types/testCertificate.types';

export const downloadCertificatePdf = (
  certificate: Partial<TestCertificate>,
  companyInfo?: any
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = 15;

  // --- 1. HEADER SECTION ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59); // Charcoal / Slate-800
  doc.text(
    (companyInfo?.companyName || 'DMOR POLYMERS PRIVATE LIMITED').toUpperCase(),
    width / 2,
    y,
    {
      align: 'center',
    }
  );

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(37, 99, 235); // Primary blue
  doc.text('MANUFACTURERS OF ARCHITECTURAL & INDUSTRIAL COATINGS', width / 2, y, {
    align: 'center',
  });

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // Slate-500
  const officeAddr = companyInfo?.address || '1/8, Shivajinagar, Pune - 411005, Maharashtra, India';
  doc.text(`Regd. Office: ${officeAddr}`, width / 2, y, { align: 'center' });

  y += 4;
  const factoryAddr =
    companyInfo?.factoryAddress || 'Gate No. 248, Alandi-Markal Road, Markal, Pune - 412105';
  doc.text(`Factory: ${factoryAddr}`, width / 2, y, { align: 'center' });

  y += 4.5;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'medium');
  doc.setTextColor(148, 163, 184); // Slate-400
  const contact = companyInfo?.contactNumber || '+91 20 2553 0000';
  const email = companyInfo?.email || 'sales@dmorpolymers.com';
  doc.text(`Ph: ${contact}  |  Email: ${email}  |  Web: www.dmorpolymers.com`, width / 2, y, {
    align: 'center',
  });

  y += 3;
  // Primary Colored Divider bar
  doc.setFillColor(37, 99, 235);
  doc.rect(margin, y, width - margin * 2, 0.8, 'F');

  // --- 2. TITLE & CERTIFICATE NO ---
  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text('TEST CERTIFICATE', width / 2, y, { align: 'center' });

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(37, 99, 235);
  const certNoStr = `Certificate No: ${certificate.certificateNo || 'TC/CODE/BATCH/YEAR'}`;
  doc.text(certNoStr, width / 2, y, { align: 'center' });

  // --- 3. BATCH DETAILS TABLE ---
  y += 6;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(148, 163, 184);
  doc.text('BATCH & MANUFACTURING DETAILS', margin, y);

  y += 2.5;
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB');
  };

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'plain',
    styles: {
      fontSize: 8.5,
      font: 'helvetica',
      cellPadding: 2,
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
    },
    bodyStyles: {
      textColor: [50, 50, 50],
    },
    body: [
      [
        { content: 'Product Name', styles: { fillColor: [248, 250, 252], fontStyle: 'bold' } },
        { content: certificate.productName || '-' },
        { content: 'Colour / Shade', styles: { fillColor: [248, 250, 252], fontStyle: 'bold' } },
        { content: certificate.colour || '-' },
      ],
      [
        { content: 'Batch Number', styles: { fillColor: [248, 250, 252], fontStyle: 'bold' } },
        { content: certificate.batchNumber || '-', styles: { fontStyle: 'bold' } },
        {
          content: 'Manufacturing Date',
          styles: { fillColor: [248, 250, 252], fontStyle: 'bold' },
        },
        { content: formatDate(certificate.manufacturingDate) },
      ],
      [
        { content: 'Testing Date', styles: { fillColor: [248, 250, 252], fontStyle: 'bold' } },
        { content: formatDate(certificate.testingDate) },
        { content: '', styles: { fillColor: [255, 255, 255] } },
        { content: '' },
      ],
      [
        { content: 'Tested By', styles: { fillColor: [248, 250, 252], fontStyle: 'bold' } },
        { content: 'In-house Quality Control Lab' },
        { content: '', styles: { fillColor: [255, 255, 255] } },
        { content: '' },
      ],
    ],
  });

  // --- 4. TEST RESULTS TABLE ---
  y = (doc as any).lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('TECHNICAL TESTING SPECIFICATIONS', margin, y);

  y += 2.5;
  const allResults = certificate.results || [];
  const checkedResults = allResults.filter(r => r.checked);
  const resultsToUse = checkedResults.length > 0 ? checkedResults : allResults;

  const resultRows = resultsToUse.map((r, idx) => [
    { content: String(idx + 1), styles: { halign: 'center' as const } },
    r.propertyName || '-',
    r.specification || '-',
    { content: r.resultValue || '-', styles: { fontStyle: 'bold' as const } },
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Sr No', 'Property / Parameter', 'Specification', 'Result / Observed Value']],
    body: resultRows.length > 0 ? resultRows : [['-', 'No parameters entered', '-', '-']],
    theme: 'striped',
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'left',
    },
    styles: {
      fontSize: 8.5,
      font: 'helvetica',
      cellPadding: 2.5,
      lineColor: [220, 220, 220],
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 'auto' },
    },
  });

  // --- 5. REMARKS (wrapped in a blue bordered box, matching master template) ---
  y = (doc as any).lastAutoTable.finalY + 8;
  const companyName = companyInfo?.companyName || 'DMOR POLYMERS PRIVATE LIMITED';

  // Box geometry: full content width, inner padding so text does not touch the border
  const rPad = 4; // mm inner padding (master: ~3.6mm)
  const rx = margin + rPad; // inset text x
  const rWrap = width - margin * 2 - rPad * 2; // inset wrap width
  const remarksTop = y - 4; // top padding above the heading

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184); // Slate-400
  doc.text('Remarks', rx, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85); // Slate-700

  const remarksP1 = `The above material has been tested in our in-house Quality Control Lab and found satisfactory as per ${companyName} internal quality standards.`;
  const remarksP2 = `The product is suitable for application on properly prepared surfaces as per recommended application guidelines.`;

  // Draw paragraph 1
  const linesP1 = doc.splitTextToSize(remarksP1, rWrap);
  doc.text(linesP1, rx, y);
  y += linesP1.length * 4.5 + 3;

  // Draw paragraph 2
  const linesP2 = doc.splitTextToSize(remarksP2, rWrap);
  doc.text(linesP2, rx, y);
  y += linesP2.length * 4.5 + 4;

  // Note (italic)
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // Slate-500
  const noteText =
    'Note: This is a computer-generated test certificate. Signature is not required.';
  doc.text(noteText, rx, y);
  y += 6;

  // Tested By & Quality Control Officer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('Tested By:', rx, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Quality Control Officer', rx, y);
  y += 5;
  doc.text(companyName, rx, y);

  // Blue bordered box around the entire Remarks section (master: #1E64C8, thin)
  const remarksBottom = y + rPad;
  doc.setDrawColor(30, 100, 200);
  doc.setLineWidth(0.2);
  doc.rect(margin, remarksTop, width - margin * 2, remarksBottom - remarksTop);

  // --- 6. FOOTER ---
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // Slate-600
  doc.text('Generated by Morex Technologies ERP', width / 2, height - 15, { align: 'center' });

  // --- 7. OUTER PAGE BORDER (matches master template: ~7mm margin, thin black frame) ---
  const borderMargin = 7;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(borderMargin, borderMargin, width - borderMargin * 2, height - borderMargin * 2);

  doc.save(`Test_Certificate_${certificate.certificateNo || 'Draft'}.pdf`);
};
