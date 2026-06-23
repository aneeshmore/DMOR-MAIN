import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { testCertificateApi } from './services/testCertificateApi';
import { companyApi } from '@/features/company/api/companyApi';
import { TestCertificate } from './types/testCertificate.types';
import { CertificatePdfViewer } from './components/CertificatePdfViewer';
import { showToast } from '@/utils/toast';
import { ArrowLeft, Loader2, Edit, AlertCircle } from 'lucide-react';

export const TestCertificateViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [certificate, setCertificate] = useState<TestCertificate | null>(null);
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDetails = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const certData = await testCertificateApi.getById(Number(id));
        setCertificate(certData);

        try {
          const compResponse = await companyApi.get();
          if (compResponse?.data?.data) {
            setCompanyInfo(compResponse.data.data);
          }
        } catch (compErr) {
          console.warn('Failed to load company details, using fallbacks', compErr);
        }
      } catch (err) {
        console.error('Failed to load certificate details', err);
        showToast.error('Could not retrieve certificate details.');
        navigate('/operations/test-certificate');
      } finally {
        setLoading(false);
      }
    };
    loadDetails();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="p-12 text-center flex flex-col justify-center items-center h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
        <span className="text-gray-500 font-semibold">Loading certificate details...</span>
      </div>
    );
  }

  if (!certificate) {
    return (
      <div className="card p-8 border-red-200 bg-red-50 text-red-700 text-center flex flex-col items-center gap-2">
        <AlertCircle className="h-8 w-8" />
        <p>Certificate not found or access denied.</p>
      </div>
    );
  }

  const isDraft = certificate.status === 'Draft';

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 animate-fade-in">
      {/* Header Bar */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/operations/test-certificate')}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
            title="Go Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              Test Certificate Details
              <span
                className={`badge border text-xs px-2.5 py-0.5 rounded-full font-bold ${
                  isDraft
                    ? 'bg-yellow-50 text-yellow-700 border-yellow-100'
                    : 'bg-green-50 text-green-700 border-green-100'
                }`}
              >
                {certificate.status}
              </span>
            </h1>
            <p className="text-xs text-gray-500 font-medium font-mono mt-1">
              No: {certificate.certificateNo} · Batch: {certificate.batchNumber}
            </p>
          </div>
        </div>

        {isDraft && (
          <button
            onClick={() => navigate(`/operations/test-certificate/${certificate.id}/edit`)}
            className="btn border border-yellow-500 text-yellow-600 hover:bg-yellow-50 px-4 py-2 text-sm flex items-center gap-1.5 font-semibold"
          >
            <Edit className="h-4 w-4" /> Edit Draft
          </button>
        )}
      </div>

      {/* PDF View Container */}
      <div className="card bg-white p-6 border shadow-sm rounded-xl">
        <CertificatePdfViewer certificate={certificate} companyInfo={companyInfo} />
      </div>
    </div>
  );
};
export default TestCertificateViewPage;
