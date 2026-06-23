import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CertificateForm } from './components/CertificateForm';
import { testCertificateApi } from './services/testCertificateApi';
import { TestCertificate } from './types/testCertificate.types';
import { showToast } from '@/utils/toast';
import { Loader2 } from 'lucide-react';

export const TestCertificateEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [certificate, setCertificate] = useState<TestCertificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchCertificate = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const data = await testCertificateApi.getById(Number(id));
        if (data.status === 'Approved') {
          showToast.error('Approved certificates cannot be edited.');
          navigate('/operations/test-certificate');
          return;
        }
        // Format dates for HTML date inputs
        if (data.testingDate) data.testingDate = data.testingDate.split('T')[0];
        if (data.manufacturingDate) data.manufacturingDate = data.manufacturingDate.split('T')[0];

        setCertificate(data);
      } catch (err) {
        console.error('Failed to load certificate for editing', err);
        showToast.error('Could not retrieve certificate details.');
        navigate('/operations/test-certificate');
      } finally {
        setLoading(false);
      }
    };
    fetchCertificate();
  }, [id, navigate]);

  const handleSubmit = async (data: TestCertificate) => {
    if (!id) return;
    try {
      setSubmitting(true);

      const payload = {
        colour: data.colour,
        testingDate: data.testingDate,
        remarks: data.remarks || '',
        status: data.status || 'Draft',
        results: data.results.map((r, idx) => ({
          propertyName: r.propertyName,
          resultValue: r.resultValue,
          specification: r.specification || '',
          sortOrder: idx,
        })),
      };

      await testCertificateApi.update(Number(id), payload);
      showToast.success('Test certificate updated successfully.');
      navigate('/operations/test-certificate');
    } catch (err: any) {
      console.error('Failed to update test certificate', err);
      showToast.error(
        err.response?.data?.message ||
          'Failed to update test certificate. Please check input values.'
      );
    } finally {
      setSubmitting(false);
    }
  };

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
      <div className="card p-8 border-red-200 bg-red-50 text-red-700 text-center">
        <p>Certificate not found or access denied.</p>
      </div>
    );
  }

  return (
    <div className="py-4">
      <CertificateForm
        initialData={certificate}
        onSubmit={handleSubmit}
        isSubmitting={submitting}
      />
    </div>
  );
};
export default TestCertificateEditPage;
