import React, { useEffect, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TestCertificate } from '../types/testCertificate.types';
import { Download, Printer, RefreshCw, Loader2 } from 'lucide-react';

interface CertificatePdfViewerProps {
  certificate: Partial<TestCertificate>;
  companyInfo?: any;
}

export const CertificatePdfViewer: React.FC<CertificatePdfViewerProps> = ({
  certificate,
  companyInfo,
}) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const generatePdfBlobUrl = () => {
    try {
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
      const officeAddr =
        companyInfo?.address || '1/8, Shivajinagar, Pune - 411005, Maharashtra, India';
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
            {
              content: 'Colour / Shade',
              styles: { fillColor: [248, 250, 252], fontStyle: 'bold' },
            },
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
      // Get the end Y of the previous table
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

      // --- 5. REMARKS ---
      y = (doc as any).lastAutoTable.finalY + 8;
      const companyName = companyInfo?.companyName || 'DMOR POLYMERS PRIVATE LIMITED';

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184); // Slate-400
      doc.text('Remarks', margin, y);

      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85); // Slate-700

      const remarksP1 = `The above material has been tested in our in-house Quality Control Lab and found satisfactory as per ${companyName} internal quality standards.`;
      const remarksP2 = `The product is suitable for application on properly prepared surfaces as per recommended application guidelines.`;

      // Draw paragraph 1
      const linesP1 = doc.splitTextToSize(remarksP1, width - margin * 2);
      doc.text(linesP1, margin, y);
      y += linesP1.length * 4.5 + 3;

      // Draw paragraph 2
      const linesP2 = doc.splitTextToSize(remarksP2, width - margin * 2);
      doc.text(linesP2, margin, y);
      y += linesP2.length * 4.5 + 4;

      // Note (italic)
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139); // Slate-500
      const noteText =
        'Note: This is a computer-generated test certificate. Signature is not required.';
      doc.text(noteText, margin, y);
      y += 6;

      // Tested By & Quality Control Officer
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      doc.text('Tested By:', margin, y);
      y += 6;

      doc.setFont('helvetica', 'bold');
      doc.text('Quality Control Officer', margin, y);
      y += 5;
      doc.text(companyName, margin, y);

      // --- 6. FOOTER ---
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105); // Slate-600
      doc.text('Generated by Morex Technologies ERP', width / 2, height - 15, { align: 'center' });

      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (err) {
      console.error('Failed to generate PDF Blob URL', err);
    }
  };

  useEffect(() => {
    generatePdfBlobUrl();
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [certificate, companyInfo]);

  const handleDownload = () => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      // We regenerate standard jsPDF to save
      // Let's copy-paste same config (or we can just reuse blob save)
      // Standard way from Blob URL:
      if (pdfUrl) {
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = `Test_Certificate_${certificate.certificateNo || 'Draft'}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  const handlePrint = () => {
    if (pdfUrl) {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = pdfUrl;
      document.body.appendChild(iframe);
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border">
        <span className="text-sm font-semibold text-gray-700">Interactive PDF Controls:</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={generatePdfBlobUrl}
            className="btn border border-gray-300 text-gray-700 hover:bg-gray-100 px-3 py-1.5 text-xs flex items-center gap-1.5"
            title="Refresh PDF Preview"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Regenerate
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="btn border border-primary-500 text-primary-600 hover:bg-primary-50 px-3 py-1.5 text-xs flex items-center gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" /> Print Ready
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="btn bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-4 py-1.5 text-xs flex items-center gap-1.5 shadow-sm font-semibold"
          >
            <Download className="h-3.5 w-3.5" /> Download PDF
          </button>
        </div>
      </div>

      {pdfUrl ? (
        <div className="border border-gray-300 rounded-xl overflow-hidden shadow-sm h-[600px] w-full bg-slate-800">
          <iframe
            src={pdfUrl}
            title={`PDF Preview of ${certificate.certificateNo || 'Certificate'}`}
            className="w-full h-full border-none"
          />
        </div>
      ) : (
        <div className="card p-12 text-center text-gray-500 flex flex-col justify-center items-center h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
          <span>Generating A4 PDF Preview...</span>
        </div>
      )}
    </div>
  );
};
export default CertificatePdfViewer;
