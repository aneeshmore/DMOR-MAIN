import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FieldIntelligenceForm } from './components/FieldIntelligenceForm';
import { fieldIntelligenceApi } from './services/fieldIntelligenceApi';
import { FieldIntelligenceReport } from './types/fieldIntelligence.types';

export const FieldIntelligenceEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [report, setReport] = useState<FieldIntelligenceReport | null>(null);

  useEffect(() => {
    const loadReport = async () => {
      try {
        if (!id) return;
        const data = await fieldIntelligenceApi.getById(id);

        // Form expects date string format YYYY-MM-DD
        if (data.visitDate) {
          data.visitDate = new Date(data.visitDate).toISOString().slice(0, 10);
        }
        if (data.expectedOrderDate) {
          data.expectedOrderDate = new Date(data.expectedOrderDate).toISOString().slice(0, 10);
        }

        setReport(data);
      } catch (err) {
        console.error('Failed to retrieve report details', err);
        alert('Could not retrieve report data.');
        navigate('/operations/field-intelligence');
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, [id, navigate]);

  const handleSubmit = async (data: FieldIntelligenceReport) => {
    try {
      if (!id) return;
      setSubmitting(true);

      const payload = { ...data };

      await fieldIntelligenceApi.update(id, payload);
      alert('Field Intelligence Report updated successfully.');
      navigate('/operations/field-intelligence');
    } catch (err: any) {
      console.error('Failed to update report', err);
      alert(err.message || 'Failed to update report. Please verify inputs.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        <span className="ml-3 text-gray-500 font-semibold">Loading report details...</span>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="card p-8 text-center border-red-200 bg-red-50 text-red-700 max-w-md mx-auto mt-12">
        <h3 className="font-bold text-lg mb-1">Report Not Found</h3>
        <p className="text-sm mb-4">The report you are trying to edit could not be resolved.</p>
        <button
          onClick={() => navigate('/operations/field-intelligence')}
          className="btn bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] px-4 py-2"
        >
          Back to List
        </button>
      </div>
    );
  }

  return (
    <div className="py-4">
      <FieldIntelligenceForm
        initialData={report}
        onSubmit={handleSubmit}
        isSubmitting={submitting}
      />
    </div>
  );
};
export default FieldIntelligenceEditPage;
