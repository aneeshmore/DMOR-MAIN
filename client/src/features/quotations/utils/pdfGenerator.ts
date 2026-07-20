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

type PdfDownloadEvent = {
  data: QuotationData;
  isInvoice: boolean;
};

type PdfDownloadListener = (event: PdfDownloadEvent) => void;

let listeners: PdfDownloadListener[] = [];

export const subscribeToPdfDownload = (listener: PdfDownloadListener) => {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
};

const triggerDownloadEvent = (data: QuotationData, isInvoice: boolean) => {
  if (listeners.length > 0) {
    listeners.forEach(listener => listener({ data, isInvoice }));
    return true; // Event was handled
  }
  return false; // No listeners, fallback required
};

/**
 * For inline download without navigation
 * This approach triggers the GlobalPdfGenerator component to render it in the background
 */
export async function downloadQuotationPDF(quotationData: QuotationData): Promise<void> {
  const handled = triggerDownloadEvent(quotationData, false);
  
  if (!handled) {
    // Fallback if the global renderer isn't mounted for some reason
    const dataKey = `quotation_download_${Date.now()}_${Math.random()}`;
    localStorage.setItem(
      dataKey,
      JSON.stringify({
        importedData: quotationData,
        startInPreview: true,
        autoDownload: true,
      })
    );
    const url = `/quotation-print?download=${dataKey}`;
    window.open(url, '_blank');
  }
}

/**
 * For inline download of Invoice
 */
export async function downloadInvoicePDF(
  quotationData: QuotationData,
  targetWindow?: Window | null
): Promise<void> {
  const handled = triggerDownloadEvent(quotationData, true);
  
  if (!handled) {
    // Fallback if the global renderer isn't mounted
    const dataKey = `invoice_download_${Date.now()}`;
    const payload = JSON.stringify({
      importedData: quotationData,
      startInPreview: true,
      autoDownload: true,
      isInvoice: true,
    });

    let storageTarget: Window | null | undefined = targetWindow;
    localStorage.setItem(dataKey, payload);

    try {
      if (storageTarget) {
        storageTarget.sessionStorage.setItem(dataKey, payload);
      } else {
        sessionStorage.setItem(dataKey, payload);
      }
    } catch {
      storageTarget = null;
      targetWindow?.close();
      sessionStorage.setItem(dataKey, payload);
    }

    const url = `/quotation-print?download=${dataKey}`;
    if (storageTarget && !storageTarget.closed) {
      storageTarget.location.href = url;
      if (typeof storageTarget.focus === 'function') {
        storageTarget.focus();
      }
      return;
    }

    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else if (targetWindow && !targetWindow.closed) {
    // The event handled the generation inline, so close the blank popup that was optionally passed in
    targetWindow.close();
  }
}
