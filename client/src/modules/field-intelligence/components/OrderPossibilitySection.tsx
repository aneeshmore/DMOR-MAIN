import React from 'react';
import { UseFormRegister, FormState, UseFormSetValue } from 'react-hook-form';
import { FieldIntelligenceReport } from '../types/fieldIntelligence.types';

interface SectionProps {
  register: UseFormRegister<FieldIntelligenceReport>;
  formState: FormState<FieldIntelligenceReport>;
  setValue: UseFormSetValue<FieldIntelligenceReport>;
  watch: (name: keyof FieldIntelligenceReport) => any;
}

export const OrderPossibilitySection: React.FC<SectionProps> = ({
  register,
  formState,
  setValue,
  watch,
}) => {
  const { errors } = formState;
  const isExpectedOrderDateNA = watch('expectedOrderDate') === 'N/A';

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
        {/* Hidden inputs to keep form state intact */}
        <input type="hidden" {...register('potentialBusinessValue')} />
        <input type="hidden" {...register('expectedMonthlyBusiness')} />

        {/* Conversion Probability */}
        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.conversionProbability ? 'text-red-500' : 'text-gray-700'}`}
          >
            Conversion Probability (%) *
          </label>
          <input
            type="text"
            className={`input ${errors.conversionProbability ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            placeholder="e.g. 70 or N/A"
            {...register('conversionProbability', {
              required: 'Conversion Probability is required',
              validate: val =>
                (val as any) === 'N/A' ||
                (!isNaN(Number(val)) && Number(val) >= 0 && Number(val) <= 100) ||
                'Must be a percentage between 0 and 100 or N/A',
            })}
          />
          {errors.conversionProbability && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.conversionProbability.message}
            </p>
          )}
        </div>

        {/* Expected Order Date */}
        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.expectedOrderDate ? 'text-red-500' : 'text-gray-700'}`}
          >
            Expected Order Date *
          </label>
          <div className="flex flex-col">
            <input
              type={isExpectedOrderDateNA ? 'text' : 'date'}
              readOnly={isExpectedOrderDateNA}
              className={`input ${errors.expectedOrderDate ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''} ${isExpectedOrderDateNA ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed' : ''}`}
              {...register('expectedOrderDate', {
                required: 'Expected Order Date is required',
                validate: val => {
                  const s = val ? String(val) : '';
                  return (
                    s === 'N/A' || /^\d{4}-\d{2}-\d{2}$/.test(s) || 'Date must be selected or N/A'
                  );
                },
              })}
            />
            <label className="inline-flex items-center mt-2 gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4"
                checked={isExpectedOrderDateNA}
                onChange={e => {
                  if (e.target.checked) {
                    setValue('expectedOrderDate', 'N/A', { shouldValidate: true });
                  } else {
                    setValue('expectedOrderDate', '', { shouldValidate: true });
                  }
                }}
              />
              Not Applicable (N/A)
            </label>
          </div>
          {errors.expectedOrderDate && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.expectedOrderDate.message}
            </p>
          )}
        </div>

        {/* Expected Order Quantity */}
        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.expectedOrderQuantity ? 'text-red-500' : 'text-gray-700'}`}
          >
            Expected Order Quantity (Ltrs) *
          </label>
          <input
            type="text"
            className={`input ${errors.expectedOrderQuantity ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            placeholder="e.g. 1000 or N/A"
            {...register('expectedOrderQuantity', {
              required: 'Expected Order Quantity is required',
              validate: val =>
                (val as any) === 'N/A' || !isNaN(Number(val)) || 'Must be a number or N/A',
            })}
          />
          {errors.expectedOrderQuantity && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.expectedOrderQuantity.message}
            </p>
          )}
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
