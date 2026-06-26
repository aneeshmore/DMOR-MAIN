import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FieldIntelligenceForm } from './components/FieldIntelligenceForm';
import { fieldIntelligenceApi } from './services/fieldIntelligenceApi';
import { FieldIntelligenceReport } from './types/fieldIntelligence.types';
import { showToast } from '@/utils/toast';

export const FieldIntelligenceCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const handleSubmit = async (data: FieldIntelligenceReport) => {
    try {
      setSubmitting(true);

      const payload = { ...data, status: data.status || ('Submitted' as const) };

      if (data.id) {
        await fieldIntelligenceApi.update(data.id, payload);
      } else {
        await fieldIntelligenceApi.create(payload);
      }

      showToast.success('SMART CRM Visit Report submitted successfully.');

      // Increment formKey to reset the entire form UI & state
      setFormKey(prev => prev + 1);
    } catch (err: any) {
      console.error('Failed to submit report', err);
      if (err.status === 400 || err.message?.includes('Validation failed')) {
        throw err;
      }
      showToast.error(err.message || 'Failed to submit report. Please review the inputs.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraft = async (data: FieldIntelligenceReport) => {
    try {
      setSubmitting(true);

      const payload = { ...data, status: 'Draft' as const };

      if (data.id) {
        await fieldIntelligenceApi.update(data.id, payload);
      } else {
        await fieldIntelligenceApi.create(payload);
      }

      showToast.success('SMART CRM Visit Report draft saved successfully.');

      // Increment formKey to reset the entire form UI & state
      setFormKey(prev => prev + 1);
    } catch (err: any) {
      console.error('Failed to save draft', err);
      if (err.status === 400 || err.message?.includes('Validation failed')) {
        throw err;
      }
      showToast.error(err.message || 'Failed to save draft. Please verify the inputs.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="py-4">
      <FieldIntelligenceForm
        key={formKey}
        onSubmit={handleSubmit}
        onSaveDraft={handleSaveDraft}
        isSubmitting={submitting}
      />
    </div>
  );
};
export default FieldIntelligenceCreatePage;
