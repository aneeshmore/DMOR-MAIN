import React, { useState, useEffect } from 'react';
import { UseFormRegister, FormState, UseFormSetValue } from 'react-hook-form';
import { FieldIntelligenceReport } from '../types/fieldIntelligence.types';
import { COMPETITOR_BRANDS, SHADE_OPTIONS, FINISH_TYPES } from '../constants/firConstants';
import SearchableSelectUI from '@/components/ui/SearchableSelect';
import { masterProductApi } from '@/features/master-products/api';
import { MasterProduct } from '@/features/master-products/types';
import MultiSearchableSelect from './shared/MultiSearchableSelect';

interface SectionProps {
  register: UseFormRegister<FieldIntelligenceReport>;
  formState: FormState<FieldIntelligenceReport>;
  setValue: UseFormSetValue<FieldIntelligenceReport>;
  watch: (name: keyof FieldIntelligenceReport) => any;
}

export const SalesCommercialSection: React.FC<SectionProps> = ({
  register,
  formState,
  setValue,
  watch,
}) => {
  const { errors } = formState;

  const [products, setProducts] = useState<MasterProduct[]>([]);

  useEffect(() => {
    register('requiredShade', { required: 'Required Product is required' });
    register('requiredFinish', { required: 'Required Finish is required' });
    register('currentSupplier', { required: 'Current Paint Supplier is required' });

    const loadProducts = async () => {
      try {
        const response = await masterProductApi.getAll();
        if (response.success && response.data) {
          // Include Finished Goods (FG) and Raw Materials (RM)
          const filtered = response.data.filter(
            p => p.productType === 'FG' || p.productType === 'RM'
          );
          setProducts(filtered);
        }
      } catch (err) {
        console.error('Failed to load master products:', err);
      }
    };
    loadProducts();
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
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </span>
        Sales & Commercial Details
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Required Product */}
        <MultiSearchableSelect
          label="Required Product"
          options={products.map(p => p.masterProductName)}
          value={
            watch('requiredShade')
              ? (watch('requiredShade') as string)
                  .split(',')
                  .map(s => s.trim())
                  .filter(Boolean)
              : []
          }
          onChange={arr => setValue('requiredShade', arr.join(', '), { shouldValidate: true })}
          placeholder="Select Required Products..."
          allowCustom
          required
          error={errors.requiredShade?.message}
        />

        {/* Required Finish */}
        <SearchableSelectUI<string>
          label="Required Finish"
          options={FINISH_TYPES.map(finish => ({
            id: finish,
            label: finish,
            value: finish,
          }))}
          value={watch('requiredFinish') || undefined}
          onChange={v => setValue('requiredFinish', v || '', { shouldValidate: true })}
          placeholder="Select Required Finish..."
          required
          error={errors.requiredFinish?.message}
        />

        {/* Monthly Consumption Value */}
        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.monthlyConsumption ? 'text-red-500' : 'text-gray-700'}`}
          >
            Monthly Consumption Value (₹) *
          </label>
          <input
            type="text"
            className={`input ${errors.monthlyConsumption ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            placeholder="e.g. 150000 or N/A"
            {...register('monthlyConsumption', {
              required: 'Monthly Consumption Value is required',
              validate: val => val === 'N/A' || !isNaN(Number(val)) || 'Must be a number or N/A',
            })}
          />
          {errors.monthlyConsumption && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.monthlyConsumption.message}
            </p>
          )}
        </div>

        {/* Monthly Volume */}
        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.monthlyConsumptionText ? 'text-red-500' : 'text-gray-700'}`}
          >
            Monthly Volume (e.g. Liters) *
          </label>
          <input
            type="text"
            className={`input ${errors.monthlyConsumptionText ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            placeholder="e.g. 500 Liters or N/A"
            {...register('monthlyConsumptionText', { required: 'Monthly Volume is required' })}
          />
          {errors.monthlyConsumptionText && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.monthlyConsumptionText.message}
            </p>
          )}
        </div>

        {/* Current Paint Supplier */}
        <SearchableSelectUI<string>
          label="Current Paint Supplier"
          options={['N/A', ...COMPETITOR_BRANDS].map(brand => ({
            id: brand,
            label: brand,
            value: brand,
          }))}
          value={watch('currentSupplier') || undefined}
          onChange={v => setValue('currentSupplier', v || '', { shouldValidate: true })}
          placeholder="Berger Paints, Shalimar, etc."
          creatable
          allowCustomValue
          allowCustom
          onCreateNew={customSupplier =>
            setValue('currentSupplier', customSupplier, { shouldValidate: true })
          }
          required
          error={errors.currentSupplier?.message}
        />

        {/* Expected Rate */}
        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.expectedRate ? 'text-red-500' : 'text-gray-700'}`}
          >
            Expected Rate (₹/Ltr) *
          </label>
          <input
            type="text"
            className={`input ${errors.expectedRate ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            placeholder="e.g. 320.00 or N/A"
            {...register('expectedRate', {
              required: 'Expected Rate is required',
              validate: val => val === 'N/A' || !isNaN(Number(val)) || 'Must be a number or N/A',
            })}
          />
          {errors.expectedRate && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.expectedRate.message}
            </p>
          )}
        </div>

        {/* Current Rate */}
        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.currentPurchaseRate ? 'text-red-500' : 'text-gray-700'}`}
          >
            Current Purchase Rate (₹/Ltr) *
          </label>
          <input
            type="text"
            className={`input ${errors.currentPurchaseRate ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            placeholder="e.g. 350.00 or N/A"
            {...register('currentPurchaseRate', {
              required: 'Current Purchase Rate is required',
              validate: val => val === 'N/A' || !isNaN(Number(val)) || 'Must be a number or N/A',
            })}
          />
          {errors.currentPurchaseRate && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.currentPurchaseRate.message}
            </p>
          )}
        </div>

        {/* Credit Days */}
        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.creditDays ? 'text-red-500' : 'text-gray-700'}`}
          >
            Credit Days Required *
          </label>
          <select
            className={`input ${errors.creditDays ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            {...register('creditDays', { required: 'Credit Days Required is required' })}
          >
            <option value="">Select Credit Days...</option>
            <option value="N/A">N/A</option>
            <option value="0">Cash / Immediate</option>
            <option value="7">7 Days</option>
            <option value="15">15 Days</option>
            <option value="30">30 Days</option>
            <option value="45">45 Days</option>
            <option value="60">60 Days</option>
            <option value="90">90 Days</option>
            <option value="120">120 Days</option>
          </select>
          {errors.creditDays && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.creditDays.message}
            </p>
          )}
        </div>

        {/* Outstanding Amount */}
        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.outstandingAmount ? 'text-red-500' : 'text-gray-700'}`}
          >
            Outstanding Amount (₹) *
          </label>
          <input
            type="text"
            className={`input ${errors.outstandingAmount ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            placeholder="e.g. 250000.00 or N/A"
            {...register('outstandingAmount', {
              required: 'Outstanding Amount is required',
              validate: val => val === 'N/A' || !isNaN(Number(val)) || 'Must be a number or N/A',
            })}
          />
          {errors.outstandingAmount && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.outstandingAmount.message}
            </p>
          )}
        </div>

        {/* Purchase Cycle */}
        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.purchaseCycle ? 'text-red-500' : 'text-gray-700'}`}
          >
            Purchase Cycle *
          </label>
          <select
            className={`input ${errors.purchaseCycle ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            {...register('purchaseCycle', { required: 'Purchase Cycle is required' })}
          >
            <option value="">Select Purchase Cycle...</option>
            <option value="N/A">N/A</option>
            <option value="Order-to-Order">Order-to-Order</option>
            <option value="Weekly">Weekly</option>
            <option value="Fortnightly">Fortnightly</option>
            <option value="Monthly">Monthly</option>
            <option value="Quarterly">Quarterly</option>
            <option value="Project-Based">Project-Based</option>
          </select>
          {errors.purchaseCycle && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.purchaseCycle.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
export default SalesCommercialSection;
