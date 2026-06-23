import React from 'react';
import { UseFormRegister, FormState } from 'react-hook-form';
import { FieldIntelligenceReport } from '../types/fieldIntelligence.types';

interface SectionProps {
  register: UseFormRegister<FieldIntelligenceReport>;
  formState: FormState<FieldIntelligenceReport>;
}

export const OrderPossibilitySection: React.FC<SectionProps> = ({ register, formState }) => {
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
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </span>
        Order & Business Possibility
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Potential Total Business Value (₹)
          </label>
          <input
            type="number"
            className="input"
            placeholder="e.g. 1000000"
            {...register('potentialBusinessValue', { valueAsNumber: true })}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Expected Monthly Sales Value (₹)
          </label>
          <input
            type="number"
            className="input"
            placeholder="e.g. 200000"
            {...register('expectedMonthlyBusiness', { valueAsNumber: true })}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Conversion Probability (%)
          </label>
          <input
            type="number"
            className="input"
            placeholder="e.g. 70"
            min={0}
            max={100}
            {...register('conversionProbability', { valueAsNumber: true })}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Expected Order Date
          </label>
          <input type="date" className="input" {...register('expectedOrderDate')} />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Expected Order Quantity (Ltrs)
          </label>
          <input
            type="number"
            className="input"
            placeholder="e.g. 1000"
            {...register('expectedOrderQuantity', { valueAsNumber: true })}
          />
        </div>

        <div className="flex flex-col justify-end gap-3 pb-2 pl-2">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4"
              {...register('trialApproved')}
            />
            Trial Approved at Site
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4"
              {...register('sampleGiven')}
            />
            Samples Supplied to Customer
          </label>
        </div>
      </div>
    </div>
  );
};
export default OrderPossibilitySection;
