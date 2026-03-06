import { QuotationData } from '@/features/quotations/types';

/**
 * Downloads a quotation PDF by navigating to the QuotationMaker page
 * This uses the existing quotation format in QuotationMaker.tsx
 *
 * @param quotationData - The quotation data to render
 * @param navigate - React Router navigate function
 */
export function navigateToDownloadPDF(
  quotationData: QuotationData,
  navigate: (path: string, options?: any) => void
): void {
  navigate('/quotation-print', {
    state: {
      importedData: quotationData,
      startInPreview: true,
      autoDownload: true,
    },
  });
}

/**
 * For inline download without navigation - opens in new tab
 * This approach maintains the original quotation format
 */
export async function downloadQuotationPDF(quotationData: QuotationData): Promise<void> {
  // Since the QuotationMaker has a complex React-based template,
  // the best way is to open it in a new window with auto-download flag

  // Store data in sessionStorage for the new window to access
  const dataKey = `quotation_download_${Date.now()}_${Math.random()}`;
  sessionStorage.setItem(
    dataKey,
    JSON.stringify({
      importedData: quotationData,
      startInPreview: true,
      autoDownload: true,
    })
  );

  // Open QuotationMaker in new window - using correct route path
  const url = `/quotation-print?download=${dataKey}`;
  window.open(url, '_blank');
}

/**
 * For inline download of Invoice - opens in new tab with Invoice mode
 */
export async function downloadInvoicePDF(quotationData: QuotationData): Promise<void> {
  // Store data in sessionStorage for the new window to access
  const dataKey = `invoice_download_${Date.now()}`;
  sessionStorage.setItem(
    dataKey,
    JSON.stringify({
      importedData: quotationData,
      startInPreview: true,
      autoDownload: true,
      isInvoice: true, // Flag to trigger Invoice mode
    })
  );

  // Open QuotationMaker in new window
  const url = `/quotation-print?download=${dataKey}`;

  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
