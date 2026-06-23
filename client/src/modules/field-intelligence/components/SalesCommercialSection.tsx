import React from 'react';
import { UseFormRegister, FormState, UseFormSetValue } from 'react-hook-form';
import { FieldIntelligenceReport } from '../types/fieldIntelligence.types';
import { COMPETITOR_BRANDS } from '../constants/firConstants';
import SearchableSelect from './shared/SearchableSelect';

interface SectionProps {
  register: UseFormRegister<FieldIntelligenceReport>;
  formState: FormState<FieldIntelligenceReport>;
  setValue: UseFormSetValue<FieldIntelligenceReport>;
  watch: (name: keyof FieldIntelligenceReport) => any;
}

export const SalesCommercialSection: React.FC<SectionProps> = ({ register, formState, setValue, watch }) => {
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
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </span>
        Sales & Commercial Details
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Current Supplier – searchable */}
        <SearchableSelect
          label="Current Paint Supplier"
          options={COMPETITOR_BRANDS as unknown as readonly string[]}
          value={watch('currentSupplier') || ''}
          onChange={v => setValue('currentSupplier', v)}
          placeholder="Berger Paints, Shalimar, etc."
          allowCustom
        />

        {/* Monthly Consumption Value */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Monthly Consumption Value (₹)
          </label>
          <input
            type="number"
            className="input"
            placeholder="e.g. 150000"
            {...register('monthlyConsumption', { valueAsNumber: true })}
          />
        </div>

        {/* Monthly Volume */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Monthly Volume (e.g. Liters)
          </label>
          <input
            type="text"
            className="input"
            placeholder="e.g. 500 Liters"
            {...register('monthlyConsumptionText')}
          />
        </div>

        {/* Current Rate */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Current Purchase Rate (₹/Ltr)
          </label>
          <input
            type="number"
            step="0.01"
            className="input"
            placeholder="e.g. 350.00"
            {...register('currentPurchaseRate', { valueAsNumber: true })}
          />
        </div>

        {/* Expected Rate */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Expected Rate (₹/Ltr)
          </label>
          <input
            type="number"
            step="0.01"
            className="input"
            placeholder="e.g. 320.00"
            {...register('expectedRate', { valueAsNumber: true })}
          />
        </div>

        {/* Credit Days */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Credit Days Required
          </label>
          <select className="input" {...register('creditDays', { valueAsNumber: true })}>
            <option value={0}>Cash / Immediate</option>
            <option value={7}>7 Days</option>
            <option value={15}>15 Days</option>
            <option value={30}>30 Days</option>
            <option value={45}>45 Days</option>
            <option value={60}>60 Days</option>
            <option value={90}>90 Days</option>
            <option value={120}>120 Days</option>
          </select>
        </div>

        {/* Outstanding Amount */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Outstanding Amount (₹)
          </label>
          <input
            type="number"
            step="0.01"
            className="input"
            placeholder="e.g. 250000.00"
            {...register('outstandingAmount', { valueAsNumber: true })}
          />
        </div>

        {/* Purchase Cycle */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Purchase Cycle</label>
          <select className="input" {...register('purchaseCycle')}>
            <option value="Order-to-Order">Order-to-Order</option>
            <option value="Weekly">Weekly</option>
            <option value="Fortnightly">Fortnightly</option>
            <option value="Monthly">Monthly</option>
            <option value="Quarterly">Quarterly</option>
            <option value="Project-Based">Project-Based</option>
          </select>
        </div>
      </div>
    </div>
  );
};
export default SalesCommercialSection;
