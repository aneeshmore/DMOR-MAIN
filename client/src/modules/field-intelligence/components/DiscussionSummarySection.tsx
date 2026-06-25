import React, { useEffect } from 'react';
import { UseFormRegister, FormState, UseFormSetValue, Control, useWatch } from 'react-hook-form';
import { FieldIntelligenceReport } from '../types/fieldIntelligence.types';
import { CUSTOMER_MOOD_OPTIONS, RISK_FACTOR_OPTIONS } from '../constants/firConstants';
import VoiceInput from './shared/VoiceInput';
import SearchableSelectUI from '@/components/ui/SearchableSelect';

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

  useEffect(() => {
    register('riskFactors', { required: 'Risk Factors is required' });
  }, [register]);

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
          onChange={val => setValue('discussionNotes', val, { shouldValidate: true })}
          placeholder="Summarize the core conversation with the customer... (or tap mic to dictate)"
          rows={3}
          required
          error={errors.discussionNotes?.message}
          name="discussionNotes"
        />
        {/* Hidden input for react-hook-form registration */}
        <input
          type="hidden"
          {...register('discussionNotes', { required: 'Discussion notes are required' })}
        />

        {/* Important Observations with Voice Input */}
        <VoiceInput
          label="Important Observations *"
          value={importantObservations}
          onChange={val => setValue('importantObservations', val, { shouldValidate: true })}
          placeholder="Substrate condition, painting line quality, factory footprint... (or tap mic) or N/A"
          rows={2}
          required
          error={errors.importantObservations?.message}
          name="importantObservations"
        />
        <input
          type="hidden"
          {...register('importantObservations', {
            required: 'Important observations are required',
          })}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Customer Mood */}
          <div>
            <label
              className={`block text-sm font-semibold mb-1 ${errors.customerMood ? 'text-red-500' : 'text-gray-700'}`}
            >
              Customer Mood / Attitude *
            </label>
            <select
              className={`input ${errors.customerMood ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
              {...register('customerMood', { required: 'Customer Mood is required' })}
            >
              <option value="">Select Mood...</option>
              <option value="N/A">N/A</option>
              {CUSTOMER_MOOD_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.customerMood && (
              <p
                className="text-red-500 text-xs mt-1"
                style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
              >
                {errors.customerMood.message}
              </p>
            )}
          </div>

          {/* Immediate Requirement */}
          <div>
            <label
              className={`block text-sm font-semibold mb-1 ${errors.immediateRequirement ? 'text-red-500' : 'text-gray-700'}`}
            >
              Immediate Painting Requirement *
            </label>
            <input
              type="text"
              className={`input ${errors.immediateRequirement ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
              placeholder="e.g. 200L Red oxide primer needed next week or N/A"
              {...register('immediateRequirement', {
                required: 'Immediate requirement is required',
              })}
            />
            {errors.immediateRequirement && (
              <p
                className="text-red-500 text-xs mt-1"
                style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
              >
                {errors.immediateRequirement.message}
              </p>
            )}
          </div>

          {/* Hidden Opportunity */}
          <div className="md:col-span-2">
            <label
              className={`block text-sm font-semibold mb-1 ${errors.hiddenOpportunity ? 'text-red-500' : 'text-gray-700'}`}
            >
              Hidden Opportunity Detected *
            </label>
            <input
              type="text"
              className={`input ${errors.hiddenOpportunity ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
              placeholder="e.g. Thinners are currently purchased at higher rate from another source or N/A"
              {...register('hiddenOpportunity', { required: 'Hidden opportunity is required' })}
            />
            {errors.hiddenOpportunity && (
              <p
                className="text-red-500 text-xs mt-1"
                style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
              >
                {errors.hiddenOpportunity.message}
              </p>
            )}
          </div>
        </div>

        {/* Risk Factors */}
        <SearchableSelectUI<string>
          label="Risk Factors"
          options={['N/A', ...RISK_FACTOR_OPTIONS].map(opt => ({
            id: opt,
            label: opt,
            value: opt,
          }))}
          value={watch('riskFactors') || undefined}
          onChange={v => setValue('riskFactors', v || '', { shouldValidate: true })}
          placeholder="Select Risk Factor..."
          creatable
          allowCustomValue
          allowCustom
          onCreateNew={customRisk => setValue('riskFactors', customRisk, { shouldValidate: true })}
          required
          error={errors.riskFactors?.message}
        />
      </div>
    </div>
  );
};
export default DiscussionSummarySection;
