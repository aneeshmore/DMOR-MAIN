import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FieldIntelligenceForm } from './components/FieldIntelligenceForm';
import { fieldIntelligenceApi } from './services/fieldIntelligenceApi';
import { FieldIntelligenceReport } from './types/fieldIntelligence.types';
import { showToast } from '@/utils/toast';
import { useAuth } from '@/contexts/AuthContext';

export const FieldIntelligenceEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [report, setReport] = useState<FieldIntelligenceReport | null>(null);

  useEffect(() => {
    const loadReport = async () => {
      try {
        if (!id) return;
        const data = await fieldIntelligenceApi.getById(id);

        const isAdmin = user?.Role === 'Admin' || user?.Role === 'SuperAdmin';
        const isOwner =
          Number(data.executiveId) === Number(user?.EmployeeID) ||
          Number(data.createdBy) === Number(user?.EmployeeID);

        // Only Draft reports are editable (by admin or the report owner).
        // Submitted / any non-draft report is locked — even via direct URL.
        if (!((isAdmin || isOwner) && data.status === 'Draft')) {
          const msg =
            data.status !== 'Draft'
              ? 'This report is submitted and can no longer be edited.'
              : 'Access denied. You do not have permission to edit this report.';
          showToast.error(msg);
          navigate('/operations/smart-crm');
          return;
        }

        // Form expects YYYY-MM-DD. Guard against 'N/A'/invalid values — drafts
        // usually have no expectedOrderDate (DTO returns 'N/A'), and
        // new Date('N/A').toISOString() throws RangeError, which would otherwise
        // abort loading and surface as "Could not retrieve report data".
        const toDateInput = (v: unknown): string | undefined => {
          if (v === null || v === undefined || String(v).trim().toUpperCase() === 'N/A') {
            return undefined;
          }
          const d = new Date(v as string | number | Date);
          return isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
        };
        const normalizedVisitDate = toDateInput(data.visitDate);
        if (normalizedVisitDate) data.visitDate = normalizedVisitDate;
        data.expectedOrderDate = toDateInput(data.expectedOrderDate);

        setReport(data);
      } catch (err) {
        console.error('Failed to retrieve report details', err);
        showToast.error('Could not retrieve report data.');
        navigate('/operations/smart-crm');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadReport();
    }
  }, [id, navigate, user]);

  const handleSubmit = async (data: FieldIntelligenceReport) => {
    try {
      if (!id) return;
      setSubmitting(true);

      const payload = { ...data };

      await fieldIntelligenceApi.update(id, payload);
      showToast.success('CRM Visit Report updated successfully.');
      navigate('/operations/smart-crm');
    } catch (err: any) {
      console.error('Failed to update report', err);
      if (err.status === 400 || err.message?.includes('Validation failed')) {
        throw err;
      }
      showToast.error(err.message || 'Failed to update report. Please verify inputs.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraft = async (data: FieldIntelligenceReport) => {
    try {
      if (!id) return;
      setSubmitting(true);

      const payload = { ...data, status: 'Draft' as const };

      await fieldIntelligenceApi.update(id, payload);
      showToast.success('CRM Visit Report draft saved successfully.');
      navigate('/operations/smart-crm');
    } catch (err: any) {
      console.error('Failed to update draft', err);
      if (err.status === 400 || err.message?.includes('Validation failed')) {
        throw err;
      }
      showToast.error(err.message || 'Failed to update draft. Please verify inputs.');
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
          onClick={() => navigate('/operations/smart-crm')}
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
        onSaveDraft={handleSaveDraft}
        isSubmitting={submitting}
      />
    </div>
  );
};
export default FieldIntelligenceEditPage;
