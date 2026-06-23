import React from 'react';
import { UseFormRegister, FormState, UseFormSetValue, Control, useWatch } from 'react-hook-form';
import { FieldIntelligenceReport } from '../types/fieldIntelligence.types';
import { CUSTOMER_MOOD_OPTIONS, RISK_FACTOR_OPTIONS } from '../constants/firConstants';
import VoiceInput from './shared/VoiceInput';
import ChipSelector from './shared/ChipSelector';

interface SectionProps {
  register: UseFormRegister<FieldIntelligenceReport>;
  formState: FormState<FieldIntelligenceReport>;
  setValue: UseFormSetValue<FieldIntelligenceReport>;
  control: Control<FieldIntelligenceReport>;
  watch: (name: keyof FieldIntelligenceReport) => any;
}

export const DiscussionSummarySection: React.FC<SectionProps> = ({
  register,
  formState,
  setValue,
  control,
  watch,
}) => {
  const { errors } = formState;
  const discussionNotes = watch('discussionNotes') || '';
  const importantObservations = watch('importantObservations') || '';

  // Parse riskFactors from string (stored as comma-joined or JSON array) for chip display
  const rawRisk = watch('riskFactors') || '';
  const riskChips: string[] = (() => {
    try {
      const parsed = JSON.parse(rawRisk);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return rawRisk ? rawRisk.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
  })();

  const handleRiskChange = (chips: string[]) => {
    setValue('riskFactors', chips.join(', ') as any);
  };

  return (
    <div className="card p-6 mb-6">
      <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2">
        <span className="bg-primary-100 text-primary-600 p-1.5 rounded-md">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </span>
        Discussion Summary
      </h3>

      <div className="space-y-4">
        {/* Discussion Notes with Voice Input */}
        <VoiceInput
          label="Key Discussion Notes *"
          value={discussionNotes}
          onChange={val => setValue('discussionNotes', val)}
          placeholder="Summarize the core conversation with the customer... (or tap mic to dictate)"
          rows={3}
          required
          error={errors.discussionNotes?.message}
          name="discussionNotes"
        />
        {/* Hidden input for react-hook-form registration */}
        <input type="hidden" {...register('discussionNotes', { required: 'Discussion notes are required' })} />

        {/* Important Observations with Voice Input */}
        <VoiceInput
          label="Important Observations"
          value={importantObservations}
          onChange={val => setValue('importantObservations', val)}
          placeholder="Substrate condition, painting line quality, factory footprint... (or tap mic)"
          rows={2}
          name="importantObservations"
        />
        <input type="hidden" {...register('importantObservations')} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Customer Mood */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Customer Mood / Attitude
            </label>
            <select className="input" {...register('customerMood')}>
              {CUSTOMER_MOOD_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Immediate Requirement */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Immediate Painting Requirement
            </label>
            <input
              type="text"
              className="input"
              placeholder="e.g. 200L Red oxide primer needed next week"
              {...register('immediateRequirement')}
            />
          </div>

          {/* Hidden Opportunity */}
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Hidden Opportunity Detected
            </label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Thinners are currently purchased at higher rate from another source"
              {...register('hiddenOpportunity')}
            />
          </div>
        </div>

        {/* Risk Factors – chips */}
        <ChipSelector
          label="Risk Factors"
          options={RISK_FACTOR_OPTIONS}
          value={riskChips}
          onChange={handleRiskChange}
        />
      </div>
    </div>
  );
};
export default DiscussionSummarySection;
