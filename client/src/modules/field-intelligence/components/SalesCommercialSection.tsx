import React from 'react';
import { UseFormRegister, FormState } from 'react-hook-form';
import { FieldIntelligenceReport } from '../types/fieldIntelligence.types';

interface SectionProps {
  register: UseFormRegister<FieldIntelligenceReport>;
  formState: FormState<FieldIntelligenceReport>;
}

export const SalesCommercialSection: React.FC<SectionProps> = ({ register, formState }) => {
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
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Current Paint Supplier
          </label>
          <input
            type="text"
            className="input"
            placeholder="Berger Paints, Shalimar, etc."
            {...register('currentSupplier')}
          />
        </div>

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

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Monthly Consumption Volume (e.g. Liters)
          </label>
          <input
            type="text"
            className="input"
            placeholder="e.g. 500 Liters"
            {...register('monthlyConsumptionText')}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Current Purchase Rate (₹ per Ltr)
          </label>
          <input
            type="number"
            step="0.01"
            className="input"
            placeholder="e.g. 350.00"
            {...register('currentPurchaseRate', { valueAsNumber: true })}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Expected Rate (₹ per Ltr)
          </label>
          <input
            type="number"
            step="0.01"
            className="input"
            placeholder="e.g. 320.00"
            {...register('expectedRate', { valueAsNumber: true })}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Credit Days Required
          </label>
          <input
            type="number"
            className="input"
            placeholder="e.g. 45"
            {...register('creditDays', { valueAsNumber: true })}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Current Subcontractor Outstanding (₹)
          </label>
          <input
            type="number"
            step="0.01"
            className="input"
            placeholder="e.g. 250000.00"
            {...register('outstandingAmount', { valueAsNumber: true })}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Purchase Decision Maker
          </label>
          <input
            type="text"
            className="input"
            placeholder="Proprietor / MD / Procurement Officer"
            {...register('purchaseDecisionBy')}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Purchase Cycle</label>
          <select className="input" {...register('purchaseCycle')}>
            <option value="Order-to-Order">Order-to-Order</option>
            <option value="Weekly">Weekly</option>
            <option value="Monthly">Monthly</option>
            <option value="Quarterly">Quarterly</option>
          </select>
        </div>
      </div>
    </div>
  );
};
export default SalesCommercialSection;
