import React from 'react';
import { UseFormRegister, FormState } from 'react-hook-form';
import { FieldIntelligenceReport } from '../types/fieldIntelligence.types';

interface SectionProps {
  register: UseFormRegister<FieldIntelligenceReport>;
  formState: FormState<FieldIntelligenceReport>;
}

export const CustomerDetailsSection: React.FC<SectionProps> = ({ register, formState }) => {
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
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
        </span>
        Customer Details
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Customer / Organization Name *
          </label>
          <input
            type="text"
            className={`input ${errors.customerName ? 'border-red-500 focus:border-red-500 focus:ring-red-500 bg-red-50/10' : ''}`}
            placeholder="Enter firm or company name"
            {...register('customerName', { required: 'Customer name is required' })}
          />
          {errors.customerName && (
            <p className="text-red-500 text-xs mt-1">{errors.customerName.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Business Category
          </label>
          <select className="input" {...register('businessCategory')}>
            <option value="OEM">OEM / Manufacturing</option>
            <option value="Dealer">Dealer / Retailer</option>
            <option value="Contractor">Project Contractor</option>
            <option value="Industrial Maintenance">Industrial Maintenance</option>
            <option value="Infrastructure">Infrastructure Project</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Contact Person</label>
          <input
            type="text"
            className="input"
            placeholder="Jane Doe"
            {...register('contactPerson')}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Designation</label>
          <input
            type="text"
            className="input"
            placeholder="Purchase Manager"
            {...register('designation')}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">GST Number</label>
          <input
            type="text"
            className="input"
            placeholder="27ABCDE1234F1Z5"
            {...register('gstNumber')}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Mobile Number</label>
          <input type="text" className="input" placeholder="9876543210" {...register('mobile')} />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">WhatsApp Number</label>
          <input type="text" className="input" placeholder="9876543210" {...register('whatsapp')} />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Email ID</label>
          <input
            type="email"
            className="input"
            placeholder="customer@domain.com"
            {...register('email')}
          />
        </div>

        <div className="md:col-span-3">
          <label className="block text-sm font-semibold text-gray-700 mb-1">Complete Address</label>
          <textarea
            rows={2}
            className="input"
            placeholder="Plot No, Industrial Area, Phase..."
            {...register('address')}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">City</label>
          <input type="text" className="input" placeholder="Pune" {...register('city')} />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">State</label>
          <input type="text" className="input" placeholder="Maharashtra" {...register('state')} />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Pin Code</label>
          <input type="text" className="input" placeholder="411001" {...register('pinCode')} />
        </div>
      </div>
    </div>
  );
};
export default CustomerDetailsSection;
