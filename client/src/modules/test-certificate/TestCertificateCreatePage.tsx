import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CertificateForm } from './components/CertificateForm';
import { testCertificateApi } from './services/testCertificateApi';
import { TestCertificate } from './types/testCertificate.types';
import { showToast } from '@/utils/toast';

export const TestCertificateCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (data: TestCertificate) => {
    try {
      setSubmitting(true);

      // Clean and sanitize the payload
      const payload = {
        batchId: Number(data.batchId),
        batchNumber: data.batchNumber,
        productName: data.productName,
        colour: data.colour,
        manufacturingDate: data.manufacturingDate,
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

      await testCertificateApi.create(payload);
      showToast.success('Test certificate generated successfully.');
      navigate('/operations/test-certificate');
    } catch (err: any) {
      console.error('Failed to create test certificate', err);
      showToast.error(
        err.response?.data?.message ||
          'Failed to submit test certificate. Please check input values.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="py-4">
      <CertificateForm onSubmit={handleSubmit} isSubmitting={submitting} />
    </div>
  );
};
export default TestCertificateCreatePage;
