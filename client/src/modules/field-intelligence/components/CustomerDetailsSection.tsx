import React, { useMemo, useState, useEffect } from 'react';
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
import { customerApi } from '@/features/masters/api/customerApi';
import { customerTypeApi } from '@/features/masters/api/customerTypeApi';
import { employeeApi } from '@/features/employees/api';
import { Customer } from '@/features/masters/types';
import SearchableSelectUI from '@/components/ui/SearchableSelect';
import VoiceInput from './shared/VoiceInput';

interface SectionProps {
  register: UseFormRegister<FieldIntelligenceReport>;
  formState: FormState<FieldIntelligenceReport>;
  setValue: UseFormSetValue<FieldIntelligenceReport>;
  watch: (name: keyof FieldIntelligenceReport) => any;
  onCustomerChange?: (customerName: string, customerData?: Customer) => void;
}

export const CustomerDetailsSection: React.FC<SectionProps> = ({
  register,
  formState,
  setValue,
  watch,
  onCustomerChange,
}) => {
  const { errors } = formState;
  const selectedState: string = watch('state') || '';
  const customerId = watch('customerId');
  const customerName = watch('customerName');
  const isNewCustomer = !customerId && !!customerName;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerTypes, setCustomerTypes] = useState<{ value: string; label: string }[]>([]);
  const [salespersons, setSalespersons] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    register('customerName', { required: 'Customer / Organization Name is required' });
    register('customerId', {
      validate: value => {
        const custName = watch('customerName');
        if (!value && custName) return true;
        return !!value || 'Customer / Organization Name is required';
      },
    });
    register('businessCategory', { required: 'Business Category is required' });
    register('designation', { required: 'Designation / Role is required' });
    register('purchaseDecisionBy', { required: 'Purchase Decision By is required' });
    register('state', { required: 'State is required' });
    register('city', { required: 'City is required' });

    const fetchDropdownData = async () => {
      try {
        const [custRes, typeRes, empRes] = await Promise.all([
          customerApi.getAll(),
          customerTypeApi.getAll(),
          employeeApi.getSalesPersons(),
        ]);

        if (custRes.success && custRes.data) {
          setCustomers(custRes.data);
        }

        if (typeRes.success && typeRes.data) {
          setCustomerTypes(
            typeRes.data.map(ct => ({
              value: ct.CustomerTypeID.toString(),
              label: ct.CustomerTypeName,
            }))
          );
        }

        if (empRes.success && empRes.data) {
          setSalespersons(
            empRes.data.map(emp => ({
              value: emp.EmployeeID.toString(),
              label:
                `${emp.FirstName} ${emp.LastName || ''}`.trim() +
                (emp.Role ? ` (${emp.Role})` : ''),
            }))
          );
        }
      } catch (err) {
        console.error('Failed to load dropdown data:', err);
      }
    };
    fetchDropdownData();
  }, [register, watch]);

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
        {' '}
        {/* Customer Name */}
        <div className="md:col-span-2">
          <label
            className={`block text-sm font-semibold mb-1 ${errors.customerId || errors.customerName ? 'text-red-500' : 'text-gray-700'}`}
          >
            Customer / Organization Name *
          </label>
          <SearchableSelectUI<number>
            name="customerId"
            creatable={true}
            onCreateNew={inputValue => {
              setValue('customerName', inputValue, { shouldValidate: true });
              setValue('customerId', undefined, { shouldValidate: true });
              setValue('contactPerson', '', { shouldValidate: true });
              setValue('mobile', '', { shouldValidate: true });
              setValue('email', '', { shouldValidate: true });
              setValue('address', '');
              setValue('state', '');
              setValue('city', '');
              setValue('pinCode', '');
              setValue('gstNumber', '');
              setValue('businessCategory', '', { shouldValidate: true });

              // Clear additional customer master fields
              setValue('mobile2', '');
              setValue('mobile3', '');
              setValue('area', '');
              setValue('customerTypeId', '');
              setValue('salesPersonId', '');

              if (onCustomerChange) {
                onCustomerChange(inputValue, undefined);
              }
            }}
            options={customers.map(c => ({
              id: c.CustomerID,
              label: c.CompanyName,
              subLabel: c.ContactPerson ? `Contact: ${c.ContactPerson}` : undefined,
              value: c.CustomerID,
            }))}
            value={watch('customerId') ? Number(watch('customerId')) : undefined}
            onChange={selectedId => {
              if (selectedId !== undefined && selectedId !== null) {
                const selectedCust = customers.find(c => c.CustomerID === Number(selectedId));
                if (selectedCust) {
                  setValue('customerName', selectedCust.CompanyName, { shouldValidate: true });
                  setValue('customerId', selectedCust.CustomerID, { shouldValidate: true });
                  if (selectedCust.ContactPerson !== undefined)
                    setValue('contactPerson', selectedCust.ContactPerson || '', {
                      shouldValidate: true,
                    });
                  if (selectedCust.MobileNo !== undefined)
                    setValue('mobile', selectedCust.MobileNo || '', { shouldValidate: true });
                  if (selectedCust.EmailID !== undefined)
                    setValue('email', selectedCust.EmailID || '', { shouldValidate: true });
                  if (selectedCust.Address !== undefined)
                    setValue('address', selectedCust.Address || '');
                  if (selectedCust.State !== undefined) setValue('state', selectedCust.State || '');
                  if (selectedCust.Location !== undefined)
                    setValue('city', selectedCust.Location || '');
                  if (selectedCust.Pincode !== undefined)
                    setValue('pinCode', selectedCust.Pincode || '');
                  if (selectedCust.GSTNumber !== undefined)
                    setValue('gstNumber', selectedCust.GSTNumber || '');

                  // Map business category from CustomerTypeName if available
                  if (selectedCust.CustomerTypeName) {
                    const typeName = selectedCust.CustomerTypeName.toUpperCase();
                    if (typeName === 'DEALER') {
                      setValue('businessCategory', 'Dealer / Retailer', { shouldValidate: true });
                    } else if (typeName === 'CONTRACTOR') {
                      setValue('businessCategory', 'Project Contractor', { shouldValidate: true });
                    } else if (typeName === 'INDUSTRIAL') {
                      setValue('businessCategory', 'OEM / Manufacturing', { shouldValidate: true });
                    } else if (typeName === 'BUILDER') {
                      setValue('businessCategory', 'Construction & Real Estate', {
                        shouldValidate: true,
                      });
                    }
                  }

                  if (onCustomerChange) {
                    onCustomerChange(selectedCust.CompanyName, selectedCust);
                  }
                }
              } else {
                setValue('customerName', '', { shouldValidate: true });
                setValue('customerId', undefined, { shouldValidate: true });
                setValue('contactPerson', '', { shouldValidate: true });
                setValue('mobile', '', { shouldValidate: true });
                setValue('email', '', { shouldValidate: true });
                setValue('address', '');
                setValue('state', '');
                setValue('city', '');
                setValue('pinCode', '');
                setValue('gstNumber', '');
                setValue('businessCategory', '', { shouldValidate: true });
                if (onCustomerChange) {
                  onCustomerChange('', undefined);
                }
              }
            }}
            placeholder="Select customer..."
            error={errors.customerId?.message || errors.customerName?.message}
          />
        </div>
        {/* Business Category */}
        <SearchableSelect
          label="Business Category"
          required
          name="businessCategory"
          options={BUSINESS_CATEGORIES}
          value={watch('businessCategory') || ''}
          onChange={v => setValue('businessCategory', v, { shouldValidate: true })}
          placeholder="Select category..."
          allowCustom
          error={errors.businessCategory?.message}
        />
        {/* Contact Person */}
        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.contactPerson ? 'text-red-500' : 'text-gray-700'}`}
          >
            Contact Person *
          </label>
          <input
            type="text"
            className={`input ${errors.contactPerson ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : ''}`}
            placeholder="Jane Doe"
            {...register('contactPerson', { required: 'Contact Person is required' })}
          />
          {errors.contactPerson && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.contactPerson.message}
            </p>
          )}
        </div>
        {/* Designation – searchable */}
        <SearchableSelect
          label="Designation / Role"
          name="designation"
          options={['N/A', ...DESIGNATION_OPTIONS]}
          value={watch('designation') || ''}
          onChange={v => setValue('designation', v, { shouldValidate: true })}
          placeholder="Purchase Manager"
          allowCustom
          required
          error={errors.designation?.message}
        />
        {/* Purchase Decision By */}
        <SearchableSelect
          label="Purchase Decision By"
          name="purchaseDecisionBy"
          options={['N/A', ...PURCHASE_DECISION_OPTIONS]}
          value={watch('purchaseDecisionBy') || ''}
          onChange={v => setValue('purchaseDecisionBy', v, { shouldValidate: true })}
          placeholder="Owner / MD / Purchase Head"
          allowCustom
          required
          error={errors.purchaseDecisionBy?.message}
        />
        {/* GST Number */}
        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.gstNumber ? 'text-red-500' : 'text-gray-700'}`}
          >
            GST Number *
          </label>
          <input
            type="text"
            className={`input ${errors.gstNumber ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            placeholder="27ABCDE1234F1Z5 or N/A"
            {...register('gstNumber', {
              required: 'GST Number is required',
              validate: value => {
                if (!value) return 'GST Number is required';
                if (value.toUpperCase() === 'N/A') return true;
                const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
                return gstinRegex.test(value.toUpperCase()) || 'Enter a valid GSTIN';
              },
            })}
          />
          {errors.gstNumber && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.gstNumber.message}
            </p>
          )}
        </div>
        {/* Mobile */}
        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.mobile ? 'text-red-500' : 'text-gray-700'}`}
          >
            Mobile Number *
          </label>
          <input
            type="text"
            className={`input ${errors.mobile ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            placeholder="9876543210"
            {...register('mobile', {
              required: 'Mobile Number is required',
              pattern: {
                value: /^\d{10}$/,
                message: 'Enter a valid 10-digit mobile number',
              },
            })}
          />
          {errors.mobile && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.mobile.message}
            </p>
          )}
        </div>
        {/* Email */}
        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.email ? 'text-red-500' : 'text-gray-700'}`}
          >
            Email ID *
          </label>
          <input
            type="email"
            className={`input ${errors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            placeholder="customer@domain.com"
            {...register('email', {
              required: 'Email ID is required',
              pattern: {
                value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                message: 'Enter valid email format',
              },
            })}
          />
          {errors.email && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.email.message}
            </p>
          )}
        </div>
        {/* State – searchable dropdown (drives city list) */}
        <SearchableSelect
          label="State"
          name="state"
          options={['N/A', ...(INDIAN_STATES as unknown as readonly string[])]}
          value={selectedState}
          onChange={v => {
            setValue('state', v, { shouldValidate: true });
            // Reset city when state changes so stale value is cleared
            setValue('city', '', { shouldValidate: true });
          }}
          placeholder="Select state..."
          required
          error={errors.state?.message}
        />
        {/* City – filtered by state selection */}
        <SearchableSelect
          label="City"
          name="city"
          options={['N/A', ...cityOptions]}
          value={watch('city') || ''}
          onChange={v => setValue('city', v, { shouldValidate: true })}
          placeholder={selectedState ? `Cities in ${selectedState}...` : 'Select city...'}
          allowCustom
          required
          error={errors.city?.message}
        />
        {/* Pin Code */}
        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.pinCode ? 'text-red-500' : 'text-gray-700'}`}
          >
            Pin Code *
          </label>
          <input
            type="text"
            className={`input ${errors.pinCode ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            placeholder="411001 or N/A"
            {...register('pinCode', {
              required: 'Pin Code is required',
              pattern: {
                value: /^\d{6}$/,
                message: 'Enter a valid 6-digit pin code',
              },
            })}
          />
          {errors.pinCode && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.pinCode.message}
            </p>
          )}
        </div>
        {isNewCustomer && (
          <>
            {/* Mobile 2 */}
            <div>
              <label
                className={`block text-sm font-semibold mb-1 ${errors.mobile2 ? 'text-red-500' : 'text-gray-700'}`}
              >
                Mobile Number 2 (Optional)
              </label>
              <input
                type="text"
                className={`input ${errors.mobile2 ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
                placeholder="9876543210"
                {...register('mobile2', {
                  pattern: {
                    value: /^\d{10}$/,
                    message: 'Enter a valid 10-digit mobile number',
                  },
                })}
              />
              {errors.mobile2 && (
                <p
                  className="text-red-500 text-xs mt-1"
                  style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
                >
                  {errors.mobile2.message}
                </p>
              )}
            </div>

            {/* Mobile 3 */}
            <div>
              <label
                className={`block text-sm font-semibold mb-1 ${errors.mobile3 ? 'text-red-500' : 'text-gray-700'}`}
              >
                Mobile Number 3 (Optional)
              </label>
              <input
                type="text"
                className={`input ${errors.mobile3 ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
                placeholder="9876543210"
                {...register('mobile3', {
                  pattern: {
                    value: /^\d{10}$/,
                    message: 'Enter a valid 10-digit mobile number',
                  },
                })}
              />
              {errors.mobile3 && (
                <p
                  className="text-red-500 text-xs mt-1"
                  style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
                >
                  {errors.mobile3.message}
                </p>
              )}
            </div>

            {/* Area */}
            <div>
              <label
                className={`block text-sm font-semibold mb-1 ${errors.area ? 'text-red-500' : 'text-gray-700'}`}
              >
                Area (Optional)
              </label>
              <input
                type="text"
                className={`input ${errors.area ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
                placeholder="Industrial Area"
                {...register('area')}
              />
              {errors.area && (
                <p
                  className="text-red-500 text-xs mt-1"
                  style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
                >
                  {errors.area.message}
                </p>
              )}
            </div>

            {/* Customer Type */}
            <div>
              <label
                className={`block text-sm font-semibold mb-1 ${errors.customerTypeId ? 'text-red-500' : 'text-gray-700'}`}
              >
                Customer Type (Optional)
              </label>
              <select
                className={`input ${errors.customerTypeId ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
                {...register('customerTypeId')}
              >
                <option value="">Select type...</option>
                {customerTypes.map(ct => (
                  <option key={ct.value} value={ct.value}>
                    {ct.label}
                  </option>
                ))}
              </select>
              {errors.customerTypeId && (
                <p
                  className="text-red-500 text-xs mt-1"
                  style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
                >
                  {errors.customerTypeId.message}
                </p>
              )}
            </div>

            {/* Salesperson */}
            <div>
              <label
                className={`block text-sm font-semibold mb-1 ${errors.salesPersonId ? 'text-red-500' : 'text-gray-700'}`}
              >
                Salesperson (Optional)
              </label>
              <select
                className={`input ${errors.salesPersonId ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
                {...register('salesPersonId')}
              >
                <option value="">Select salesperson...</option>
                {salespersons.map(sp => (
                  <option key={sp.value} value={sp.value}>
                    {sp.label}
                  </option>
                ))}
              </select>
              {errors.salesPersonId && (
                <p
                  className="text-red-500 text-xs mt-1"
                  style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
                >
                  {errors.salesPersonId.message}
                </p>
              )}
            </div>
          </>
        )}
        {/* Address */}
        <div className="md:col-span-3">
          <VoiceInput
            label="Complete Address *"
            value={watch('address') || ''}
            onChange={val => setValue('address', val, { shouldValidate: true })}
            placeholder="Plot No, Industrial Area, Phase... or N/A"
            rows={2}
            required
            error={errors.address?.message}
            name="address"
          />
          <input
            type="hidden"
            {...register('address', { required: 'Complete Address is required' })}
          />
        </div>
      </div>
    </div>
  );
};
export default CustomerDetailsSection;
