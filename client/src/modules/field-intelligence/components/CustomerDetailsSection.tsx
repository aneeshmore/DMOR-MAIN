import React, { useMemo, useState, useEffect, useRef } from 'react';
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
import { showToast } from '@/utils/toast';

// ── State / Pincode derivation helpers ─────────────────────────────────
// The Customer Master stores no `state` column and some records have no
// structured pincode (it lives inside the free-text address, e.g. "... - 400093").
// These helpers recover State/Pincode from signals we already fetch — the GST
// number prefix (GSTIN state code), the pincode prefix, and the city — so the
// FI form auto-fills them without any schema or backend change.

const GST_STATE_CODE_MAP: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

const CITY_STATE_MAP: Record<string, string> = {
  mumbai: 'Maharashtra',
  pune: 'Maharashtra',
  nagpur: 'Maharashtra',
  nashik: 'Maharashtra',
  thane: 'Maharashtra',
  delhi: 'Delhi',
  'new delhi': 'Delhi',
  gurgaon: 'Haryana',
  gurugram: 'Haryana',
  faridabad: 'Haryana',
  noida: 'Uttar Pradesh',
  lucknow: 'Uttar Pradesh',
  kanpur: 'Uttar Pradesh',
  chennai: 'Tamil Nadu',
  coimbatore: 'Tamil Nadu',
  madurai: 'Tamil Nadu',
  bangalore: 'Karnataka',
  bengaluru: 'Karnataka',
  mysore: 'Karnataka',
  hyderabad: 'Telangana',
  kolkata: 'West Bengal',
  howrah: 'West Bengal',
  ahmedabad: 'Gujarat',
  surat: 'Gujarat',
  vadodara: 'Gujarat',
  rajkot: 'Gujarat',
  jaipur: 'Rajasthan',
  jodhpur: 'Rajasthan',
  kochi: 'Kerala',
  ernakulam: 'Kerala',
  thiruvananthapuram: 'Kerala',
  indore: 'Madhya Pradesh',
  bhopal: 'Madhya Pradesh',
  patna: 'Bihar',
  chandigarh: 'Chandigarh',
  bhubaneswar: 'Odisha',
  raipur: 'Chhattisgarh',
  guwahati: 'Assam',
  ranchi: 'Jharkhand',
  dehradun: 'Uttarakhand',
  goa: 'Goa',
  panaji: 'Goa',
  vishakhapatnam: 'Andhra Pradesh',
  visakhapatnam: 'Andhra Pradesh',
  vijayawada: 'Andhra Pradesh',
};

/** Map an Indian pincode prefix (first two digits) to a state. Mirrors the
 *  backend offline fallback in masters/service.js. */
const stateFromPincode = (pin: string): string => {
  const p = parseInt(String(pin).substring(0, 2), 10);
  if (Number.isNaN(p)) return '';
  if (p === 11) return 'Delhi';
  if (p >= 12 && p <= 13) return 'Haryana';
  if (p >= 14 && p <= 16) return 'Punjab';
  if (p === 17) return 'Himachal Pradesh';
  if (p >= 18 && p <= 19) return 'Jammu & Kashmir';
  if (p >= 20 && p <= 28) return 'Uttar Pradesh';
  if (p >= 30 && p <= 34) return 'Rajasthan';
  if (p >= 36 && p <= 39) return 'Gujarat';
  if (p >= 40 && p <= 44) return 'Maharashtra';
  if (p >= 45 && p <= 48) return 'Madhya Pradesh';
  if (p === 49) return 'Chhattisgarh';
  if (p >= 50 && p <= 53) return 'Andhra Pradesh';
  if (p >= 56 && p <= 59) return 'Karnataka';
  if (p >= 60 && p <= 64) return 'Tamil Nadu';
  if (p >= 67 && p <= 69) return 'Kerala';
  if (p >= 70 && p <= 74) return 'West Bengal';
  if (p >= 75 && p <= 77) return 'Odisha';
  if (p === 78) return 'Assam';
  if (p >= 80 && p <= 85) return 'Bihar';
  return '';
};

/** Extract a 6-digit pincode from free text (used when no structured pincode). */
const extractPincodeFromText = (text: string): string => {
  const m = String(text || '').match(/\b(\d{6})\b/);
  return m ? m[1] : '';
};

/** Best-effort State from GST prefix -> pincode prefix -> city. */
const deriveState = (gst: string, pin: string, city: string): string => {
  const code = String(gst || '')
    .trim()
    .substring(0, 2);
  if (GST_STATE_CODE_MAP[code]) return GST_STATE_CODE_MAP[code];
  const byPin = stateFromPincode(pin);
  if (byPin) return byPin;
  const c = String(city || '')
    .trim()
    .toLowerCase();
  return CITY_STATE_MAP[c] || '';
};

interface SectionProps {
  register: UseFormRegister<FieldIntelligenceReport>;
  formState: FormState<FieldIntelligenceReport>;
  setValue: UseFormSetValue<FieldIntelligenceReport>;
  watch: (name: keyof FieldIntelligenceReport) => any;
  onCustomerChange?: (customerName: string, customerData?: Customer) => void;
  customerDashboard?: any;
  disabled?: boolean;
  /** Save-Draft mode: only Customer Name stays required; other fields become optional. */
  isDraftMode?: boolean;
}

export const CustomerDetailsSection: React.FC<SectionProps> = ({
  register,
  formState,
  setValue,
  watch,
  onCustomerChange,
  customerDashboard,
  disabled = false,
  isDraftMode = false,
}) => {
  // Draft-aware required: only Customer Name is mandatory for a Draft.
  const req = (msg: string) => (isDraftMode ? false : msg) as string | false;
  const { errors } = formState;
  const selectedState: string = watch('state') || '';
  const customerId = watch('customerId');
  const customerName = watch('customerName');

  // Accordion: expand only after a customer is picked
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const detailsRef = useRef<HTMLDivElement>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerTypes, setCustomerTypes] = useState<{ value: string; label: string }[]>([]);
  const [salespersons, setSalespersons] = useState<{ value: string; label: string }[]>([]);
  const [showNewCustomerType, setShowNewCustomerType] = useState(false);
  const [newCustomerTypeName, setNewCustomerTypeName] = useState('');
  const [creatingCustomerType, setCreatingCustomerType] = useState(false);

  // Create a new Customer Type in the master (backend) inline, then select it.
  const handleCreateCustomerType = async () => {
    const name = newCustomerTypeName.trim();
    if (!name || creatingCustomerType) return;
    // Avoid duplicates (case-insensitive)
    const existing = customerTypes.find(ct => ct.label.toLowerCase() === name.toLowerCase());
    if (existing) {
      setValue('customerTypeId', existing.value, { shouldValidate: true });
      setShowNewCustomerType(false);
      setNewCustomerTypeName('');
      showToast.error('That customer type already exists — selected it for you.');
      return;
    }
    setCreatingCustomerType(true);
    try {
      const res = await customerTypeApi.create({ CustomerTypeName: name } as never);
      if (res.success && res.data) {
        const created = {
          value: String((res.data as any).CustomerTypeID),
          label: (res.data as any).CustomerTypeName ?? name,
        };
        setCustomerTypes(prev => [...prev, created]);
        setValue('customerTypeId', created.value, { shouldValidate: true });
        setShowNewCustomerType(false);
        setNewCustomerTypeName('');
        showToast.success(`Customer type "${created.label}" created.`);
      } else {
        showToast.error(res.error || 'Failed to create customer type.');
      }
    } catch (err: any) {
      showToast.error(err?.message || 'Failed to create customer type.');
    } finally {
      setCreatingCustomerType(false);
    }
  };

  useEffect(() => {
    register('customerName', {
      required: 'Customer / Organization Name is required',
      minLength: { value: 3, message: 'Company Name must be at least 3 characters' },
      maxLength: { value: 100, message: 'Company Name cannot exceed 100 characters' },
    });
    register('customerId', {
      validate: value => {
        const custName = watch('customerName');
        if (!value && custName) return true;
        return !!value || 'Customer / Organization Name is required';
      },
    });
    register('businessCategory', { required: req('Business Category is required') });
    register('designation', { required: req('Designation / Role is required') });
    register('purchaseDecisionBy', { required: false });
    register('countryCode', { required: false });
    register('state', { required: req('State is required') });
    register('city', { required: req('City is required') });
    register('pinCode', { required: req('Pin Code is required') });

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
  }, [register, watch, isDraftMode]);

  // Expand details panel when a customer is selected
  useEffect(() => {
    if (customerId || customerName) {
      setDetailsExpanded(true);
    } else {
      setDetailsExpanded(false);
    }
  }, [customerId, customerName]);

  // Filter cities based on selected state; fallback to full major cities list
  const cityOptions = useMemo<string[]>(() => {
    if (selectedState && INDIAN_CITIES[selectedState]) {
      return [...INDIAN_CITIES[selectedState]] as string[];
    }
    return MAJOR_CITIES;
  }, [selectedState]);

  return (
    <div className="card p-6 mb-6">
      <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="bg-primary-100 text-primary-600 p-1.5 rounded-md flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </span>
          <span>Customer Details</span>
        </span>
        <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-semibold whitespace-nowrap self-start sm:self-auto">
          Layer 1 – Required
        </span>
      </h3>

      {/* ── Company Name selector (always visible) ── */}
      <div className="mb-4">
        <label
          className={`block text-sm font-semibold mb-1 ${errors.customerId || errors.customerName ? 'text-red-500' : 'text-gray-700'}`}
        >
          Company Name <span className="text-red-500">*</span>
        </label>
        <SearchableSelectUI<number>
          name="customerId"
          disabled={disabled}
          creatable={true}
          customLabel={customerId ? undefined : customerName}
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
            setValue('area', '');
            setValue('customerTypeId', '');
            setValue('salesPersonId', '');

            if (onCustomerChange) {
              onCustomerChange(inputValue, undefined);
            }
          }}
          options={customers.map((c: any) => {
            const custId = c.CustomerID ?? c.customerId;
            const compName = c.CompanyName ?? c.companyName ?? '';
            const contact = c.ContactPerson ?? c.contactPerson ?? '';
            return {
              id: custId,
              label: compName,
              subLabel: contact ? `Contact: ${contact}` : undefined,
              value: custId,
            };
          })}
          value={watch('customerId') ? Number(watch('customerId')) : undefined}
          onChange={selectedId => {
            if (selectedId !== undefined && selectedId !== null) {
              const selectedCust: any = customers.find(
                (c: any) => (c.CustomerID ?? c.customerId) === Number(selectedId)
              );
              if (selectedCust) {
                const compName = selectedCust.CompanyName ?? selectedCust.companyName ?? '';
                const custId = selectedCust.CustomerID ?? selectedCust.customerId;
                const contact = selectedCust.ContactPerson ?? selectedCust.contactPerson ?? '';
                let mob = selectedCust.MobileNo ?? selectedCust.mobileNo ?? '';
                if (Array.isArray(mob)) mob = mob[0] || '';
                const email = selectedCust.EmailID ?? selectedCust.emailId ?? '';
                const addr = selectedCust.Address ?? selectedCust.address ?? '';

                // Robust State Auto-Fetch & Case-Insensitive Matching
                const rawState = (
                  selectedCust.State ??
                  selectedCust.state ??
                  selectedCust.state_name ??
                  ''
                )
                  .toString()
                  .trim();

                // Case-insensitive match against INDIAN_STATES.
                // Guard: never run substring matching on an empty string
                // ("".includes("") is always true and would wrongly pick the first state).
                const matchedState = !rawState
                  ? ''
                  : (INDIAN_STATES as readonly string[]).find(
                      s => s.toLowerCase() === rawState.toLowerCase()
                    ) ||
                    (INDIAN_STATES as readonly string[]).find(s =>
                      s.toLowerCase().includes(rawState.toLowerCase())
                    ) ||
                    rawState;

                // Location / City Auto-Fetch
                const cityVal = (
                  selectedCust.Location ??
                  selectedCust.location ??
                  selectedCust.city ??
                  ''
                )
                  .toString()
                  .trim();

                // Pincode Auto-Fetch
                const pinVal = String(
                  selectedCust.Pincode ??
                    selectedCust.pinCode ??
                    selectedCust.pincode ??
                    selectedCust.pin_code ??
                    ''
                ).trim();

                const gstVal = selectedCust.GSTNumber ?? selectedCust.gstNumber ?? '';
                const custTypeName =
                  selectedCust.CustomerTypeName ?? selectedCust.customerTypeName ?? '';
                const typeIdVal = selectedCust.CustomerTypeID ?? selectedCust.customerTypeId ?? '';
                const salesPersonIdVal =
                  selectedCust.SalesPersonID ?? selectedCust.salesPersonId ?? '';
                const areaVal = selectedCust.Area ?? selectedCust.area ?? '';

                setValue('customerName', compName, { shouldValidate: true });
                setValue('customerId', custId, { shouldValidate: true });
                setValue('contactPerson', contact, { shouldValidate: true });
                setValue('mobile', mob, { shouldValidate: true });
                setValue('email', email, { shouldValidate: true });
                setValue('address', addr, { shouldValidate: true });
                // Fallbacks: recover Pincode from the address text, and State
                // from GST prefix / pincode / city when not directly available.
                const finalPin = pinVal || extractPincodeFromText(addr);
                const finalState = matchedState || deriveState(gstVal, finalPin, cityVal);

                setValue('state', finalState, { shouldValidate: true });
                setValue('city', cityVal, { shouldValidate: true });
                setValue('pinCode', finalPin, { shouldValidate: true });
                setValue('gstNumber', gstVal, { shouldValidate: true });

                if (areaVal) setValue('area', areaVal);
                if (typeIdVal) setValue('customerTypeId', typeIdVal.toString());
                if (salesPersonIdVal) setValue('salesPersonId', salesPersonIdVal.toString());

                if (custTypeName) {
                  const typeName = custTypeName.toUpperCase();
                  if (typeName.includes('DEALER') || typeName.includes('RETAIL')) {
                    setValue('businessCategory', 'Dealer / Retailer', { shouldValidate: true });
                  } else if (typeName.includes('CONTRACTOR')) {
                    setValue('businessCategory', 'Project Contractor', { shouldValidate: true });
                  } else if (typeName.includes('INDUSTRIAL') || typeName.includes('OEM')) {
                    setValue('businessCategory', 'OEM / Manufacturing', { shouldValidate: true });
                  } else if (typeName.includes('BUILDER')) {
                    setValue('businessCategory', 'Construction & Real Estate', {
                      shouldValidate: true,
                    });
                  }
                }

                if (onCustomerChange) {
                  onCustomerChange(compName, selectedCust);
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
          placeholder="Enter company name"
          error={errors.customerId?.message || errors.customerName?.message}
        />
      </div>

      {/* ── Accordion: Detail fields drop down after customer selected ── */}
      <div
        ref={detailsRef}
        style={{
          maxHeight: detailsExpanded ? '2000px' : '0px',
          opacity: detailsExpanded ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.45s ease, opacity 0.35s ease',
        }}
      >
        {/* Hint bar */}
        {detailsExpanded && (
          <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
            <svg
              className="w-4 h-4 text-green-600 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-xs text-green-700 font-medium">
              Customer details auto-populated. Review and update if needed.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Row 1, Col 1: Business Category */}
          <SearchableSelect
            label="Business Category"
            required
            name="businessCategory"
            options={BUSINESS_CATEGORIES}
            value={watch('businessCategory') || ''}
            onChange={v => setValue('businessCategory', v, { shouldValidate: true })}
            placeholder="Select category"
            allowCustom
            error={errors.businessCategory?.message}
            disabled={disabled}
          />

          {/* Row 1, Col 2: Contact Person */}
          <div>
            <label
              className={`block text-sm font-semibold mb-1 ${errors.contactPerson ? 'text-red-500' : 'text-gray-700'}`}
            >
              Contact Person <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              disabled={disabled}
              className={`input disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed ${errors.contactPerson ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : ''}`}
              placeholder="Enter contact person"
              {...register('contactPerson', {
                required: req('Contact Person is required'),
                minLength: {
                  value: 3,
                  message: 'Contact Person name must be at least 3 characters',
                },
                maxLength: {
                  value: 50,
                  message: 'Contact Person name cannot exceed 50 characters',
                },
              })}
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

          {/* Row 1, Col 3: Designation / Role */}
          <SearchableSelect
            label="Designation / Role"
            name="designation"
            options={['N/A', ...DESIGNATION_OPTIONS]}
            value={watch('designation') || ''}
            onChange={v => setValue('designation', v, { shouldValidate: true })}
            placeholder="Select designation"
            allowCustom
            required
            error={errors.designation?.message}
            disabled={disabled}
          />

          {/* Row 2, Col 1: Mobile Number */}
          <div>
            <label
              className={`block text-sm font-semibold mb-1 ${errors.mobile ? 'text-red-500' : 'text-gray-700'}`}
            >
              Mobile Number <span className="text-red-500">*</span>
            </label>
            <div
              className={`flex rounded-md shadow-sm border ${errors.mobile ? 'border-red-500 bg-red-50/10' : 'border-gray-300'} focus-within:ring-1 focus-within:ring-primary focus-within:border-primary overflow-hidden`}
            >
              <select
                disabled={disabled}
                className="bg-gray-50 border-0 border-r border-gray-300 rounded-l-md text-gray-700 text-sm focus:ring-0 px-2.5 py-2 cursor-pointer disabled:bg-gray-100 disabled:text-gray-500"
                {...register('countryCode')}
              >
                <option value="+91">+91</option>
                <option value="+1">+1</option>
                <option value="+44">+44</option>
                <option value="+971">+971</option>
                <option value="+65">+65</option>
                <option value="+966">+966</option>
              </select>
              <input
                type="text"
                disabled={disabled}
                className="block w-full flex-1 min-w-0 border-0 rounded-r-md py-2 px-3 text-sm focus:ring-0 outline-none disabled:bg-gray-100 disabled:text-gray-500"
                placeholder="Enter mobile..."
                {...register('mobile', {
                  required: req('Mobile Number is required'),
                  pattern: {
                    value: /^\d{10}$/,
                    message: 'Enter a valid 10-digit mobile number',
                  },
                })}
              />
            </div>
            {errors.mobile && (
              <p
                className="text-red-500 text-xs mt-1"
                style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
              >
                {errors.mobile.message}
              </p>
            )}
          </div>

          {/* Row 2, Col 2: Email ID */}
          <div>
            <label
              className={`block text-sm font-semibold mb-1 ${errors.email ? 'text-red-500' : 'text-gray-700'}`}
            >
              Email ID
            </label>
            <input
              type="email"
              disabled={disabled}
              className={`input disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed ${errors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
              placeholder="Enter email address"
              {...register('email', {
                required: false,
                validate: value => {
                  if (!value || value.trim() === '' || value.toUpperCase() === 'N/A') return true;
                  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                  return emailRegex.test(value) || 'Enter valid email format';
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

          {/* Row 2, Col 3: GST Number */}
          <div>
            <label
              className={`block text-sm font-semibold mb-1 ${errors.gstNumber ? 'text-red-500' : 'text-gray-700'}`}
            >
              GST Number
            </label>
            <input
              type="text"
              disabled={disabled}
              className={`input disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed ${errors.gstNumber ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
              placeholder="27AAPFU0939F1ZV"
              {...register('gstNumber', {
                required: false,
                validate: value => {
                  if (!value || value.trim() === '') return true;
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

          {/* Row 3, Col 1: Purchase Decision By */}
          <SearchableSelect
            label="Purchase Decision By"
            name="purchaseDecisionBy"
            options={['N/A', ...PURCHASE_DECISION_OPTIONS]}
            value={watch('purchaseDecisionBy') || ''}
            onChange={v => setValue('purchaseDecisionBy', v, { shouldValidate: true })}
            placeholder="Select decision maker"
            allowCustom
            required={false}
            error={errors.purchaseDecisionBy?.message}
            disabled={disabled}
          />

          {/* Row 3, Col 2: Customer Type */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-semibold text-gray-700">Customer Type</label>
              {!disabled && !showNewCustomerType && (
                <button
                  type="button"
                  onClick={() => setShowNewCustomerType(true)}
                  className="text-xs font-semibold text-[var(--primary)] hover:underline"
                >
                  + New
                </button>
              )}
            </div>
            {showNewCustomerType ? (
              <div className="flex gap-1.5">
                <input
                  type="text"
                  autoFocus
                  value={newCustomerTypeName}
                  onChange={e => setNewCustomerTypeName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateCustomerType();
                    } else if (e.key === 'Escape') {
                      setShowNewCustomerType(false);
                      setNewCustomerTypeName('');
                    }
                  }}
                  placeholder="New customer type name"
                  className="input flex-1"
                />
                <button
                  type="button"
                  onClick={handleCreateCustomerType}
                  disabled={creatingCustomerType || !newCustomerTypeName.trim()}
                  className="btn bg-[var(--primary)] text-white px-3 text-sm disabled:opacity-50 whitespace-nowrap"
                >
                  {creatingCustomerType ? '...' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewCustomerType(false);
                    setNewCustomerTypeName('');
                  }}
                  className="btn border border-gray-300 text-gray-600 px-2 text-sm"
                >
                  ✕
                </button>
              </div>
            ) : (
              <select
                disabled={disabled}
                className="input disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                {...register('customerTypeId')}
              >
                <option value="">Select customer type</option>
                {customerTypes.map(ct => (
                  <option key={ct.value} value={ct.value}>
                    {ct.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Row 3, Col 3: Assigned Salesperson */}
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700">
              Assigned Salesperson
            </label>
            <select
              disabled={disabled}
              className="input disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
              {...register('salesPersonId')}
            >
              <option value="">Select salesperson</option>
              {salespersons.map(sp => (
                <option key={sp.value} value={sp.value}>
                  {sp.label}
                </option>
              ))}
            </select>
          </div>

          {/* Row 4, Col 1: Pincode */}
          <div>
            <label
              className={`block text-sm font-semibold mb-1 ${errors.pinCode ? 'text-red-500' : 'text-gray-700'}`}
            >
              Pincode <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              disabled={disabled}
              className={`input disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed ${errors.pinCode ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
              placeholder="Enter 6-digit pincode"
              {...register('pinCode', {
                required: req('Pin Code is required'),
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

          {/* Row 4, Col 2: Location / City */}
          <SearchableSelect
            label="Location / City"
            name="city"
            options={['N/A', ...cityOptions]}
            value={watch('city') || ''}
            onChange={v => setValue('city', v, { shouldValidate: true })}
            placeholder="City will be fetched from ..."
            allowCustom
            required
            error={errors.city?.message}
            disabled={disabled}
          />

          {/* Row 4, Col 3: State — native <select> so external setValue() is always reflected */}
          <div>
            <label
              className={`block text-sm font-semibold mb-1 ${errors.state ? 'text-red-500' : 'text-gray-700'}`}
            >
              State <span className="text-red-500">*</span>
            </label>
            <select
              disabled={disabled}
              className={`input disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed ${errors.state ? 'border-red-500 focus:border-red-500' : ''}`}
              value={selectedState}
              onChange={e => {
                setValue('state', e.target.value, { shouldValidate: true });
                setValue('city', '', { shouldValidate: true });
              }}
            >
              <option value="">Select State</option>
              <option value="N/A">N/A</option>
              {(INDIAN_STATES as readonly string[]).map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {errors.state && (
              <p
                className="text-red-500 text-xs mt-1"
                style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
              >
                {errors.state.message}
              </p>
            )}
          </div>

          {/* Row 5, Col 1: Area */}
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700">Area</label>
            <input
              type="text"
              disabled={disabled}
              className="input disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
              placeholder="Enter Area"
              {...register('area')}
            />
          </div>

          {/* Row 5, Col 2: Opening Balance (Rs.) */}
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700">
              Opening Balance (Rs.)
            </label>
            <input
              type="number"
              step="0.01"
              disabled={disabled}
              className="input disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
              placeholder="0.00"
              {...register('openingBalance')}
            />
          </div>

          {/* Row 6, Full Width: Complete Address */}
          <div className="sm:col-span-2 lg:col-span-3">
            <VoiceInput
              label="Complete Address"
              value={watch('address') || ''}
              onChange={val => setValue('address', val, { shouldValidate: true })}
              placeholder="Enter full billing/shipping address"
              rows={2}
              required
              error={errors.address?.message}
              name="address"
              disabled={disabled}
            />
            <input
              type="hidden"
              disabled={disabled}
              {...register('address', { required: req('Complete Address is required') })}
            />
          </div>
        </div>
      </div>

      {/* ── Hint shown when no customer selected yet ── */}
      {!detailsExpanded && !disabled && (
        <div className="mt-2 flex items-center gap-2 px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-lg">
          <svg
            className="w-4 h-4 text-blue-500 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-xs text-blue-600">
            Select a company above to auto-populate customer details.
          </span>
        </div>
      )}
    </div>
  );
};

export default CustomerDetailsSection;
