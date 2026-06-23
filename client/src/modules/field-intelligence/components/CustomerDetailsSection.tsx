import React, { useMemo } from 'react';
import { UseFormRegister, FormState, UseFormSetValue } from 'react-hook-form';
import { FieldIntelligenceReport } from '../types/fieldIntelligence.types';
import {
  DESIGNATION_OPTIONS,
  BUSINESS_CATEGORIES,
  PURCHASE_DECISION_OPTIONS,
  INDIAN_STATES,
  INDIAN_CITIES,
  MAJOR_CITIES,
} from '../constants/firConstants';
import SearchableSelect from './shared/SearchableSelect';

interface SectionProps {
  register: UseFormRegister<FieldIntelligenceReport>;
  formState: FormState<FieldIntelligenceReport>;
  setValue: UseFormSetValue<FieldIntelligenceReport>;
  watch: (name: keyof FieldIntelligenceReport) => any;
}

export const CustomerDetailsSection: React.FC<SectionProps> = ({
  register,
  formState,
  setValue,
  watch,
}) => {
  const { errors } = formState;
  const selectedState: string = watch('state') || '';

  // Filter cities based on selected state; fallback to full major cities list
  const cityOptions = useMemo<string[]>(() => {
    if (selectedState && INDIAN_CITIES[selectedState]) {
      return [...INDIAN_CITIES[selectedState]] as string[];
    }
    return MAJOR_CITIES;
  }, [selectedState]);

  return (
    <div className="card p-6 mb-6">
      <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2">
        <span className="bg-primary-100 text-primary-600 p-1.5 rounded-md">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
        </span>
        Customer Details
        <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
          Layer 1 – Required
        </span>
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Customer Name */}
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Customer / Organization Name *
          </label>
          <input
            type="text"
            className={`input ${errors.customerName ? 'border-red-500 focus:border-red-500 bg-red-50/10' : ''}`}
            placeholder="Enter firm or company name"
            {...register('customerName', { required: 'Customer name is required' })}
          />
          {errors.customerName && (
            <p className="text-red-500 text-xs mt-1">{errors.customerName.message}</p>
          )}
        </div>

        {/* Business Category */}
        <SearchableSelect
          label="Business Category"
          options={BUSINESS_CATEGORIES}
          value={watch('businessCategory') || ''}
          onChange={v => setValue('businessCategory', v)}
          placeholder="Select category..."
          allowCustom
        />

        {/* Contact Person */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Contact Person</label>
          <input
            type="text"
            className="input"
            placeholder="Jane Doe"
            {...register('contactPerson')}
          />
        </div>

        {/* Designation – searchable */}
        <SearchableSelect
          label="Designation / Role"
          options={DESIGNATION_OPTIONS}
          value={watch('designation') || ''}
          onChange={v => setValue('designation', v)}
          placeholder="Purchase Manager"
          allowCustom
        />

        {/* Purchase Decision By */}
        <SearchableSelect
          label="Purchase Decision By"
          options={PURCHASE_DECISION_OPTIONS}
          value={watch('purchaseDecisionBy') || ''}
          onChange={v => setValue('purchaseDecisionBy', v)}
          placeholder="Owner / MD / Purchase Head"
          allowCustom
        />

        {/* GST Number */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">GST Number</label>
          <input
            type="text"
            className="input"
            placeholder="27ABCDE1234F1Z5"
            {...register('gstNumber')}
          />
        </div>

        {/* Mobile */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Mobile Number</label>
          <input type="text" className="input" placeholder="9876543210" {...register('mobile')} />
        </div>

        {/* WhatsApp */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">WhatsApp Number</label>
          <input type="text" className="input" placeholder="9876543210" {...register('whatsapp')} />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Email ID</label>
          <input
            type="email"
            className="input"
            placeholder="customer@domain.com"
            {...register('email')}
          />
        </div>

        {/* Address */}
        <div className="md:col-span-3">
          <label className="block text-sm font-semibold text-gray-700 mb-1">Complete Address</label>
          <textarea
            rows={2}
            className="input"
            placeholder="Plot No, Industrial Area, Phase..."
            {...register('address')}
          />
        </div>

        {/* State – searchable dropdown (drives city list) */}
        <SearchableSelect
          label="State"
          options={INDIAN_STATES as unknown as readonly string[]}
          value={selectedState}
          onChange={v => {
            setValue('state', v);
            // Reset city when state changes so stale value is cleared
            setValue('city', '');
          }}
          placeholder="Select state..."
        />

        {/* City – filtered by state selection */}
        <SearchableSelect
          label="City"
          options={cityOptions}
          value={watch('city') || ''}
          onChange={v => setValue('city', v)}
          placeholder={selectedState ? `Cities in ${selectedState}...` : 'Select city...'}
          allowCustom
        />

        {/* Pin Code */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Pin Code</label>
          <input type="text" className="input" placeholder="411001" {...register('pinCode')} />
        </div>
      </div>
    </div>
  );
};
export default CustomerDetailsSection;
