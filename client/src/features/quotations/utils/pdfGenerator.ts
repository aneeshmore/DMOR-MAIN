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

  // Store data in localStorage for the new window to access reliably
  const dataKey = `quotation_download_${Date.now()}_${Math.random()}`;
  localStorage.setItem(
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
export async function downloadInvoicePDF(
  quotationData: QuotationData,
  targetWindow?: Window | null
): Promise<void> {
  // Store data in sessionStorage for the new window to access
  const dataKey = `invoice_download_${Date.now()}`;
  const payload = JSON.stringify({
    importedData: quotationData,
    startInPreview: true,
    autoDownload: true,
    isInvoice: true, // Flag to trigger Invoice mode
  });

  // Try to use a caller-provided window (helps on mobile where popups require a user gesture)
  let storageTarget: Window | null | undefined = targetWindow;

  // Set in localStorage to ensure the new tab can access it regardless of popup blockers or link clicks
  localStorage.setItem(dataKey, payload);

  // If we have a pre-opened window, put data in its sessionStorage as well
  try {
    if (storageTarget) {
      storageTarget.sessionStorage.setItem(dataKey, payload);
    } else {
      sessionStorage.setItem(dataKey, payload);
    }
  } catch {
    // If writing to the pre-opened window fails (popup blocked), fall back to current window
    storageTarget = null;
    targetWindow?.close();
    sessionStorage.setItem(dataKey, payload);
  }

  // Build target URL
  const url = `/quotation-print?download=${dataKey}`;

  // If we have a usable pre-opened window, navigate it directly (avoids popup blockers on mobile)
  if (storageTarget && !storageTarget.closed) {
    storageTarget.location.href = url;
    if (typeof storageTarget.focus === 'function') {
      storageTarget.focus();
    }
    return;
  }

  // Fallback: create a temporary anchor to open in a new tab
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
