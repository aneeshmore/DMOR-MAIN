import React, { useEffect, useState } from 'react';
import { subscribeToPdfDownload } from '@/features/quotations/utils/pdfGenerator';
import { QuotationData } from '@/features/quotations/types';
import QuotationMaker from '@/features/quotations/pages/QuotationMaker';

type DownloadJob = {
  data: QuotationData;
  isInvoice: boolean;
};

export const GlobalPdfGenerator: React.FC = () => {
  const [currentJob, setCurrentJob] = useState<DownloadJob | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToPdfDownload((event) => {
      // Allow it to process events
      setCurrentJob(event);
    });

    return unsubscribe;
  }, []);

  if (!currentJob) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: '-10000px',
        left: '-10000px',
        width: '1200px',
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    >
      <QuotationMaker
        initialData={currentJob.data}
        autoDownload={true}
        isInvoice={currentJob.isInvoice}
        hiddenRender={true}
        onClose={() => setCurrentJob(null)}
      />
    </div>
  );
};
