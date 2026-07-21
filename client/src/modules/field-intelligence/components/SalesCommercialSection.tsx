import React, { useState, useEffect } from 'react';
import {
  UseFormRegister,
  FormState,
  UseFormSetValue,
  useFieldArray,
  Control,
} from 'react-hook-form';
import { FieldIntelligenceReport } from '../types/fieldIntelligence.types';
import { COMPETITOR_BRANDS, SHADE_OPTIONS, FINISH_TYPES } from '../constants/firConstants';
import SearchableSelectUI from '@/components/ui/SearchableSelect';
import { productApi } from '@/features/master-products/api';
import { Product } from '@/features/master-products/types';
import SearchableSelect from './shared/SearchableSelect';
import { Trash2 } from 'lucide-react';

interface SectionProps {
  register: UseFormRegister<FieldIntelligenceReport>;
  formState: FormState<FieldIntelligenceReport>;
  setValue: UseFormSetValue<FieldIntelligenceReport>;
  watch: (name: any) => any;
  control: Control<FieldIntelligenceReport>;
  /** When true (Save Draft mode), all required rules in this section are disabled */
  isDraftMode?: boolean;
}

export const SalesCommercialSection: React.FC<SectionProps> = ({
  register,
  formState,
  setValue,
  watch,
  control,
  isDraftMode = false,
}) => {
  // req() returns the required rule only when NOT in draft mode.
  // This is the key mechanism that separates Draft and Submit validation.
  const req = (msg: string) => (isDraftMode ? false : msg) as string | false;
  const { errors } = formState;
  const [products, setProducts] = useState<Product[]>([]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'dynamicFields.productRequirements' as any,
  });

  useEffect(() => {
    // When isDraftMode, register without required so draft save is never blocked
    register('requiredShade', { required: req('Required Product is required') });
    register('requiredFinish', { required: req('Required Finish is required') });
    register('currentSupplier', { required: req('Current Paint Supplier is required') });

    const loadProducts = async () => {
      try {
        const response = await productApi.getAll();
        if (response.success && response.data) {
          const filtered = response.data.filter(
            p => p.ProductType === 'FG' || p.ProductType === 'RM'
          );
          setProducts(filtered);
        }
      } catch (err) {
        console.error('Failed to load products:', err);
      }
    };
    loadProducts();
  }, [register, isDraftMode]);

  const productOptions = products.map(p => p.ProductName);

  return (
    <div className="space-y-6">
      {/* ── CARD 1: Flat/Primary Product Requirement ── */}
      <div className="card p-6 mb-0">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
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
          <button
            type="button"
            onClick={() =>
              append({
                requiredShade: '',
                requiredFinish: '',
                monthlyConsumption: '',
                monthlyConsumptionText: '',
                currentSupplier: '',
                expectedRate: '',
                currentPurchaseRate: '',
                creditDays: '',
                outstandingAmount: '',
                purchaseCycle: '',
              })
            }
            className="btn bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border border-indigo-200 cursor-pointer"
          >
            + Add Product Requirement
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Required Product — one product per requirement (use "+ Add" for more) */}
          <SearchableSelect
            label="Required Product"
            name="requiredShade"
            persistKey="requiredProduct"
            options={productOptions}
            value={(watch('requiredShade') as string) || ''}
            onChange={v => setValue('requiredShade', v, { shouldValidate: true })}
            onCreateOption={v => setValue('requiredShade', v, { shouldValidate: true })}
            placeholder="Select or create a product..."
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
              Monthly Consumption Value (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={`input ${errors.monthlyConsumption ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
              placeholder="e.g. 150000 or N/A"
              {...register('monthlyConsumption', {
                required: req('Monthly Consumption Value is required'),
                validate: val => {
                  if (!val || val.toString().trim() === '') return true;
                  return val === 'N/A' || !isNaN(Number(val)) || 'Must be a number or N/A';
                },
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
              Monthly Volume (e.g. Liters) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={`input ${errors.monthlyConsumptionText ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
              placeholder="e.g. 500 Liters or N/A"
              {...register('monthlyConsumptionText', {
                required: req('Monthly Volume is required'),
              })}
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
              Expected Rate (₹/Ltr) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={`input ${errors.expectedRate ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
              placeholder="e.g. 320.00 or N/A"
              {...register('expectedRate', {
                required: req('Expected Rate is required'),
                validate: val => {
                  if (!val || val.toString().trim() === '') return true;
                  return val === 'N/A' || !isNaN(Number(val)) || 'Must be a number or N/A';
                },
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

          {/* Current Purchase Rate */}
          <div>
            <label
              className={`block text-sm font-semibold mb-1 ${errors.currentPurchaseRate ? 'text-red-500' : 'text-gray-700'}`}
            >
              Current Purchase Rate (₹/Ltr) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={`input ${errors.currentPurchaseRate ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
              placeholder="e.g. 350.00 or N/A"
              {...register('currentPurchaseRate', {
                required: req('Current Purchase Rate is required'),
                validate: val => {
                  if (!val || val.toString().trim() === '') return true;
                  return val === 'N/A' || !isNaN(Number(val)) || 'Must be a number or N/A';
                },
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
              Credit Days Required <span className="text-red-500">*</span>
            </label>
            <select
              className={`input ${errors.creditDays ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
              {...register('creditDays', { required: req('Credit Days Required is required') })}
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
              Outstanding Amount (₹)
            </label>
            <input
              type="text"
              className={`input ${errors.outstandingAmount ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
              placeholder="e.g. 250000.00 or N/A"
              {...register('outstandingAmount', {
                required: false,
                validate: val => {
                  if (!val || val.toString().trim() === '') return true;
                  return val === 'N/A' || !isNaN(Number(val)) || 'Must be a number or N/A';
                },
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
              Purchase Cycle <span className="text-red-500">*</span>
            </label>
            <select
              className={`input ${errors.purchaseCycle ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
              {...register('purchaseCycle', { required: req('Purchase Cycle is required') })}
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

      {/* ── ADDITIONAL PRODUCT REQUIREMENT CARDS ── */}
      {fields.map((field, idx) => {
        const itemError = (errors as any).dynamicFields?.productRequirements?.[idx];
        const requiredShadeValue = watch(
          `dynamicFields.productRequirements.${idx}.requiredShade` as any
        );

        return (
          <div key={field.id} className="card p-6 border border-indigo-100 bg-gray-50/40 relative">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h4 className="text-sm font-bold text-indigo-700">
                Product Requirement Card #{idx + 2}
              </h4>
              <button
                type="button"
                onClick={() => remove(idx)}
                className="text-red-500 hover:text-red-700 p-1 flex items-center gap-1 text-xs font-semibold cursor-pointer"
                title="Remove Product Requirement"
              >
                <Trash2 className="h-4 w-4" /> Remove
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Required Product — one product per requirement */}
              <SearchableSelect
                label="Required Product"
                persistKey="requiredProduct"
                options={productOptions}
                value={(requiredShadeValue as string) || ''}
                onChange={v =>
                  setValue(`dynamicFields.productRequirements.${idx}.requiredShade` as any, v, {
                    shouldValidate: true,
                  })
                }
                onCreateOption={v =>
                  setValue(`dynamicFields.productRequirements.${idx}.requiredShade` as any, v, {
                    shouldValidate: true,
                  })
                }
                placeholder="Select or create a product..."
                allowCustom
                required
                error={itemError?.requiredShade?.message}
              />

              {/* Required Finish */}
              <SearchableSelectUI<string>
                label="Required Finish"
                options={FINISH_TYPES.map(finish => ({
                  id: finish,
                  label: finish,
                  value: finish,
                }))}
                value={
                  watch(`dynamicFields.productRequirements.${idx}.requiredFinish` as any) ||
                  undefined
                }
                onChange={v =>
                  setValue(
                    `dynamicFields.productRequirements.${idx}.requiredFinish` as any,
                    v || '',
                    {
                      shouldValidate: true,
                    }
                  )
                }
                placeholder="Select Required Finish..."
                required
                error={itemError?.requiredFinish?.message}
              />

              {/* Monthly Consumption Value */}
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700">
                  Monthly Consumption Value (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 150000 or N/A"
                  {...register(
                    `dynamicFields.productRequirements.${idx}.monthlyConsumption` as any,
                    {
                      required: req('Monthly Consumption Value is required'),
                      validate: val =>
                        val === 'N/A' || !isNaN(Number(val)) || 'Must be a number or N/A',
                    }
                  )}
                />
                {itemError?.monthlyConsumption && (
                  <p className="text-red-500 text-xs mt-1">
                    {itemError.monthlyConsumption.message}
                  </p>
                )}
              </div>

              {/* Monthly Volume */}
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700">
                  Monthly Volume (e.g. Liters) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 500 Liters or N/A"
                  {...register(
                    `dynamicFields.productRequirements.${idx}.monthlyConsumptionText` as any,
                    {
                      required: req('Monthly Volume is required'),
                    }
                  )}
                />
                {itemError?.monthlyConsumptionText && (
                  <p className="text-red-500 text-xs mt-1">
                    {itemError.monthlyConsumptionText.message}
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
                value={
                  watch(`dynamicFields.productRequirements.${idx}.currentSupplier` as any) ||
                  undefined
                }
                onChange={v =>
                  setValue(
                    `dynamicFields.productRequirements.${idx}.currentSupplier` as any,
                    v || '',
                    {
                      shouldValidate: true,
                    }
                  )
                }
                placeholder="Berger Paints, etc."
                creatable
                allowCustomValue
                allowCustom
                onCreateNew={customSupplier =>
                  setValue(
                    `dynamicFields.productRequirements.${idx}.currentSupplier` as any,
                    customSupplier,
                    {
                      shouldValidate: true,
                    }
                  )
                }
                required
                error={itemError?.currentSupplier?.message}
              />

              {/* Expected Rate */}
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700">
                  Expected Rate (₹/Ltr) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 320.00 or N/A"
                  {...register(`dynamicFields.productRequirements.${idx}.expectedRate` as any, {
                    required: req('Expected Rate is required'),
                    validate: val =>
                      val === 'N/A' || !isNaN(Number(val)) || 'Must be a number or N/A',
                  })}
                />
                {itemError?.expectedRate && (
                  <p className="text-red-500 text-xs mt-1">{itemError.expectedRate.message}</p>
                )}
              </div>

              {/* Current Purchase Rate */}
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700">
                  Current Purchase Rate (₹/Ltr) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 350.00 or N/A"
                  {...register(
                    `dynamicFields.productRequirements.${idx}.currentPurchaseRate` as any,
                    {
                      required: req('Current Purchase Rate is required'),
                      validate: val =>
                        val === 'N/A' || !isNaN(Number(val)) || 'Must be a number or N/A',
                    }
                  )}
                />
                {itemError?.currentPurchaseRate && (
                  <p className="text-red-500 text-xs mt-1">
                    {itemError.currentPurchaseRate.message}
                  </p>
                )}
              </div>

              {/* Credit Days */}
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700">
                  Credit Days Required <span className="text-red-500">*</span>
                </label>
                <select
                  className="input"
                  {...register(`dynamicFields.productRequirements.${idx}.creditDays` as any, {
                    required: req('Credit Days Required is required'),
                  })}
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
                {itemError?.creditDays && (
                  <p className="text-red-500 text-xs mt-1">{itemError.creditDays.message}</p>
                )}
              </div>

              {/* Outstanding Amount */}
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700">
                  Outstanding Amount (₹)
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 250000.00 or N/A"
                  {...register(
                    `dynamicFields.productRequirements.${idx}.outstandingAmount` as any,
                    {
                      required: false,
                      validate: val => {
                        if (!val || val.toString().trim() === '') return true;
                        return val === 'N/A' || !isNaN(Number(val)) || 'Must be a number or N/A';
                      },
                    }
                  )}
                />
                {itemError?.outstandingAmount && (
                  <p className="text-red-500 text-xs mt-1">{itemError.outstandingAmount.message}</p>
                )}
              </div>

              {/* Purchase Cycle */}
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700">
                  Purchase Cycle <span className="text-red-500">*</span>
                </label>
                <select
                  className="input"
                  {...register(`dynamicFields.productRequirements.${idx}.purchaseCycle` as any, {
                    required: req('Purchase Cycle is required'),
                  })}
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
                {itemError?.purchaseCycle && (
                  <p className="text-red-500 text-xs mt-1">{itemError.purchaseCycle.message}</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
export default SalesCommercialSection;
