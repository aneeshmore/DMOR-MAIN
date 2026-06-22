import React from 'react';
import { UseFormRegister, FormState } from 'react-hook-form';
import { FieldIntelligenceReport } from '../types/fieldIntelligence.types';

interface SectionProps {
  register: UseFormRegister<FieldIntelligenceReport>;
  formState: FormState<FieldIntelligenceReport>;
}

export const ManagementIntelligenceSection: React.FC<SectionProps> = ({ register, formState }) => {
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
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </span>
        Executive Ratings & Management Intelligence
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Followup Urgency Score (1 - 10)
          </label>
          <select className="input" {...register('followupUrgencyScore', { valueAsNumber: true })}>
            {[...Array(10)].map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1} -{' '}
                {i + 1 === 10
                  ? 'Critical Next-Day Action'
                  : i + 1 === 1
                    ? 'Low / Routine'
                    : i + 1 >= 7
                      ? 'High Urgency'
                      : 'Medium'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Dealer Confidence (1 - 10)
          </label>
          <select className="input" {...register('dealerConfidence', { valueAsNumber: true })}>
            {[...Array(10)].map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Payment Reliability Score (1 - 10)
          </label>
          <select className="input" {...register('paymentReliability', { valueAsNumber: true })}>
            {[...Array(10)].map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1} -{' '}
                {i + 1 <= 4 ? 'Risky Outstandings' : i + 1 === 10 ? '100% Reliable' : 'Standard'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Relationship Strength (1 - 10)
          </label>
          <select className="input" {...register('relationshipStrength', { valueAsNumber: true })}>
            {[...Array(10)].map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Technical Capability Level (1 - 10)
          </label>
          <select className="input" {...register('technicalCapability', { valueAsNumber: true })}>
            {[...Array(10)].map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Long Term Potential Score (1 - 10)
          </label>
          <select className="input" {...register('longTermPotential', { valueAsNumber: true })}>
            {[...Array(10)].map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Executive Recommendation & Strategy
          </label>
          <textarea
            rows={2}
            className="input"
            placeholder="Provide specific notes on what steps management should take next..."
            {...register('executiveRecommendation')}
          />
        </div>
      </div>
    </div>
  );
};
export default ManagementIntelligenceSection;
