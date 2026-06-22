import React from 'react';
import { UseFormRegister, FormState } from 'react-hook-form';
import { FieldIntelligenceReport } from '../types/fieldIntelligence.types';

interface SectionProps {
  register: UseFormRegister<FieldIntelligenceReport>;
  formState: FormState<FieldIntelligenceReport>;
}

export const DiscussionSummarySection: React.FC<SectionProps> = ({ register, formState }) => {
  const { errors } = formState;

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Key Discussion Notes *
          </label>
          <textarea
            rows={3}
            className={`input ${errors.discussionNotes ? 'border-red-500 focus:border-red-500 focus:ring-red-500 bg-red-50/10' : ''}`}
            placeholder="Summarize the core conversation with the customer..."
            {...register('discussionNotes', { required: 'Discussion notes are required' })}
          />
          {errors.discussionNotes && (
            <p className="text-red-500 text-xs mt-1">{errors.discussionNotes.message}</p>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Important Observations
          </label>
          <textarea
            rows={2}
            className="input"
            placeholder="Substrate condition, painting line equipment quality, factory footprint, etc."
            {...register('importantObservations')}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Customer Mood / Attitude
          </label>
          <select className="input" {...register('customerMood')}>
            <option value="Highly Interested">Highly Interested / Welcoming</option>
            <option value="Neutral">Neutral / Satisfied with Current Supplier</option>
            <option value="Skeptical">Skeptical / Price-Sensitive</option>
            <option value="Dissatisfied">Dissatisfied with Competitor (Good Entry)</option>
          </select>
        </div>

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

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Risk Factors (e.g. Credit risk, competitor ties)
          </label>
          <input
            type="text"
            className="input"
            placeholder="e.g. Slow payments, owner's relative supplies Nerolac"
            {...register('riskFactors')}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Hidden Opportunity Detected
          </label>
          <input
            type="text"
            className="input"
            placeholder="e.g. Thinners are currently bought at higher price"
            {...register('hiddenOpportunity')}
          />
        </div>
      </div>
    </div>
  );
};
export default DiscussionSummarySection;
