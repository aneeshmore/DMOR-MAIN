import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FieldIntelligenceForm } from './components/FieldIntelligenceForm';
import { fieldIntelligenceApi } from './services/fieldIntelligenceApi';
import { FieldIntelligenceReport } from './types/fieldIntelligence.types';

export const FieldIntelligenceCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (data: FieldIntelligenceReport) => {
    try {
      setSubmitting(true);

      // Sanitise values before submitting
      const payload = { ...data };

      // Call create API
      await fieldIntelligenceApi.create(payload);

      // Clear localStorage draft on successful submission
      localStorage.removeItem('fir_draft_report');

      alert('Field Intelligence Report submitted successfully.');
      navigate('/operations/field-intelligence');
    } catch (err: any) {
      console.error('Failed to create report', err);
      alert(err.message || 'Failed to submit report. Please review the inputs.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="py-4">
      <FieldIntelligenceForm onSubmit={handleSubmit} isSubmitting={submitting} />
    </div>
  );
};
export default FieldIntelligenceCreatePage;
