import { useState, useEffect, useRef } from 'react';
import logger from '@/utils/logger';
import { showToast } from '@/utils/toast';
import { handleApiError } from '@/utils/errorHandler';
import { Customer, CustomerType } from '../types';
import { customerApi } from '../api';
import { customerTypeApi } from '../api/customerTypeApi';
import { employeeApi } from '@/features/employees/api';
import { Employee } from '@/features/employees/types';
import { PageHeader } from '@/components/common';
import { Input, Button, Select, Modal } from '@/components/ui';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { useAuth } from '@/contexts/AuthContext';
import { Edit2, Trash2, Plus, X, Lock, Unlock } from 'lucide-react';

// Helper to safely extract string from mobile number (might be array or string)
const extractMobileString = (value: string | string[] | null | undefined): string => {
  if (!value) return '';
  if (Array.isArray(value)) return value[0] || '';
  return String(value);
};

// Country codes list with +91 at the top
const countryCodes = [
  '+91',
  '+1',
  '+7',
  '+20',
  '+27',
  '+30',
  '+31',
  '+32',
  '+33',
  '+34',
  '+36',
  '+39',
  '+40',
  '+41',
  '+43',
  '+44',
  '+45',
  '+46',
  '+47',
  '+48',
  '+49',
  '+51',
  '+52',
  '+54',
  '+55',
  '+56',
  '+57',
  '+60',
  '+61',
  '+62',
  '+63',
  '+64',
  '+65',
  '+66',
  '+81',
  '+82',
  '+84',
  '+86',
  '+90',
  '+92',
  '+93',
  '+94',
  '+95',
  '+98',
  '+212',
  '+213',
  '+216',
  '+220',
  '+221',
  '+223',
  '+224',
  '+225',
  '+230',
  '+233',
  '+234',
  '+237',
  '+243',
  '+244',
  '+249',
  '+250',
  '+251',
  '+252',
  '+254',
  '+255',
  '+256',
  '+260',
  '+263',
  '+264',
  '+265',
  '+267',
  '+350',
  '+351',
  '+352',
  '+353',
  '+354',
  '+355',
  '+356',
  '+357',
  '+358',
  '+359',
  '+370',
  '+371',
  '+372',
  '+373',
  '+374',
  '+375',
  '+376',
  '+377',
  '+380',
  '+381',
  '+385',
  '+386',
  '+387',
  '+389',
  '+420',
  '+421',
  '+501',
  '+502',
  '+503',
  '+504',
  '+505',
  '+506',
  '+507',
  '+509',
  '+591',
  '+592',
  '+593',
  '+595',
  '+598',
  '+673',
  '+675',
  '+676',
  '+677',
  '+678',
  '+679',
  '+685',
  '+850',
  '+852',
  '+853',
  '+855',
  '+856',
  '+880',
  '+886',
  '+960',
  '+961',
  '+962',
  '+963',
  '+964',
  '+965',
  '+966',
  '+967',
  '+968',
  '+971',
  '+972',
  '+973',
  '+974',
  '+975',
  '+976',
  '+977',
  '+992',
  '+993',
  '+994',
  '+995',
  '+996',
  '+998',
];

const CustomerForm = ({
  item,
  onSave,
  onCancel,
  isSaving = false,
  allCustomers = [],
}: {
  item: Partial<Customer> | null;
  onSave: (item: Customer) => void;
  onCancel: () => void;
  isSaving?: boolean;
  allCustomers: Customer[];
}) => {
  const [formData, setFormData] = useState<Partial<Customer>>({
    CustomerID: item?.CustomerID || 0,
    CompanyName: item?.CompanyName || '',
    ContactPerson: item?.ContactPerson || '',
    MobileNo: extractMobileString(item?.MobileNo),
    MobileNo2: extractMobileString(item?.MobileNo2),
    MobileNo3: extractMobileString(item?.MobileNo3),
    CountryCode: item?.CountryCode || '+91',
    CountryCode2: item?.CountryCode2 || '+91',
    CountryCode3: item?.CountryCode3 || '+91',
    EmailID: item?.EmailID || '',
    Location: item?.Location || '',
    State: item?.State || '',
    Area: item?.Area || '',
    Address: item?.Address || '',
    Pincode: item?.Pincode || '',
    GSTNumber: item?.GSTNumber || '',
    SalesPersonID: item?.SalesPersonID,
    CustomerTypeID: item?.CustomerTypeID,
    IsActive: item?.IsActive ?? true,
  });

  const { user } = useAuth();
  const [salespersons, setSalespersons] = useState<{ value: string; label: string }[]>([]);
  const [customerTypes, setCustomerTypes] = useState<{ value: string; label: string }[]>([]);
  const [showMobile2, setShowMobile2] = useState(false);
  const [showMobile3, setShowMobile3] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingData, setPendingData] = useState<Customer | null>(null);
  const [isFetchingState, setIsFetchingState] = useState(false);

  const companyNameRef = useRef<HTMLInputElement>(null);
  const mobileRef = useRef<HTMLInputElement>(null);
  const pincodeRef = useRef<HTMLInputElement>(null);

  // Update form data when item prop changes (for editing)
  useEffect(() => {
    if (item) {
      const mobile2 = extractMobileString(item.MobileNo2);
      const mobile3 = extractMobileString(item.MobileNo3);

      setFormData({
        CustomerID: item.CustomerID || 0,
        CompanyName: item.CompanyName || '',
        ContactPerson: item.ContactPerson || '',
        MobileNo: extractMobileString(item.MobileNo),
        MobileNo2: mobile2,
        MobileNo3: mobile3,
        CountryCode: item.CountryCode || '+91',
        CountryCode2: item.CountryCode2 || '+91',
        CountryCode3: item.CountryCode3 || '+91',
        EmailID: item.EmailID || '',
        Location: item.Location || '',
        State: item.State || '',
        Area: item.Area || '',
        Address: item.Address || '',
        Pincode: item.Pincode || '',
        GSTNumber: item.GSTNumber || '',
        SalesPersonID: item.SalesPersonID,
        CustomerTypeID: item.CustomerTypeID,
        IsActive: item.IsActive ?? true,
      });

      // Show additional mobile fields if they have values
      setShowMobile2(!!mobile2);
      setShowMobile3(!!mobile3);
    } else {
      // Reset form when item is null (add mode)
      setFormData({
        CustomerID: 0,
        CompanyName: '',
        ContactPerson: '',
        MobileNo: '',
        MobileNo2: '',
        MobileNo3: '',
        CountryCode: '+91',
        CountryCode2: '+91',
        CountryCode3: '+91',
        EmailID: '',
        Location: '',
        Area: '',
        Address: '',
        GSTNumber: '',
        Pincode: '',
        SalesPersonID:
          user?.EmployeeID && salespersons.some(s => s.value === user.EmployeeID.toString())
            ? user.EmployeeID
            : undefined,
        CustomerTypeID: undefined,
        IsActive: true,
        OpeningBalance: 0,
      });

      // Hide additional mobile fields
      setShowMobile2(false);
      setShowMobile3(false);
    }
    setErrors({});
  }, [item]);

  useEffect(() => {
    const loadSalespersons = async () => {
      try {
        const response = await employeeApi.getSalesPersons();
        if (response.success && response.data) {
          logger.info('Total employees fetched:', response.data.length);

          // Get current user's role
          const isAdmin = user?.Role
            ? ['Admin', 'SuperAdmin', 'Accounts Manager'].includes(user.Role)
            : false;

          let filteredEmployees = response.data;

          if (isAdmin) {
            // Admin and Accounts Manager can see all employees with sales-related roles
            filteredEmployees = response.data.filter(
              (emp: Employee) =>
                emp.Role?.toLowerCase().includes('sales') ||
                emp.Role?.toLowerCase().includes('admin') ||
                emp.Role === 'Accounts Manager'
            );
          } else if (user?.EmployeeID) {
            // Other non-admin users can only see themselves
            filteredEmployees = response.data.filter(
              (emp: Employee) => emp.EmployeeID === user.EmployeeID
            );
          }

          // Create dropdown options
          const options = filteredEmployees.map(emp => ({
            value: emp.EmployeeID.toString(),
            label:
              `${emp.FirstName} ${emp.LastName || ''}`.trim() + (emp.Role ? ` (${emp.Role})` : ''),
          }));

          setSalespersons(options);

          // Auto-select immediately if:
          // 1. Not admin (so user is restricted to self)
          // 2. Options list has exactly the user (length 1)
          // 3. No salesperson currently selected
          if (!isAdmin && !formData.SalesPersonID && options.length === 1) {
            const val = parseInt(options[0].value);
            logger.info('Auto-selecting salesperson (immediate):', val);
            setFormData(prev => ({ ...prev, SalesPersonID: val }));
          } else if (isAdmin && !formData.SalesPersonID && user?.EmployeeID) {
            // For Admin, if they are in the list, auto-select them initially too?
            // User said "take loggedin user directly if not super admin".
            // Logic for admin was: only if they are "sales" related.
            // We'll leave Admin prompt as is (manual selection), or auto-select if they are in list?
            // Previous behavior: auto-select if present.
            const userInList = options.find(o => o.value === user.EmployeeID.toString());
            if (userInList) {
              setFormData(prev => ({ ...prev, SalesPersonID: user.EmployeeID }));
            }
          }
        }
      } catch (error) {
        logger.error('Failed to load salespersons:', error);
      }
    };
    loadSalespersons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.EmployeeID, user?.Role]);

  useEffect(() => {
    const loadCustomerTypes = async () => {
      try {
        const response = await customerTypeApi.getAll();
        if (response.success && response.data) {
          const options = response.data.map(ct => ({
            value: ct.CustomerTypeID.toString(),
            label: ct.CustomerTypeName,
          }));
          setCustomerTypes(options);
        }
      } catch (error) {
        logger.error('Failed to load customer types:', error);
      }
    };
    loadCustomerTypes();
  }, []);

  const validateField = (name: string, value: string): string => {
    let error = '';
    const currentId = formData.CustomerID || 0;

    switch (name) {
      case 'CompanyName':
        if (!value.trim()) {
          error = 'Company Name is required';
        } else if (value.length < 3) {
          error = 'Company Name must be at least 3 characters';
        } else if (value.length > 100) {
          error = 'Company Name must be at most 100 characters';
        } else if (/^\d+$/.test(value)) {
          error = 'Company Name cannot be only numbers';
        } else if (/^\s|\s$/.test(value)) {
          error = 'No leading or trailing spaces allowed';
        } else if (/\s\s+/.test(value)) {
          error = 'No multiple continuous spaces allowed';
        } else if (
          allCustomers.some(
            c =>
              c.CompanyName.toLowerCase() === value.trim().toLowerCase() &&
              c.CustomerID !== currentId
          )
        ) {
          error = 'Company name already exists';
        }
        break;

      case 'ContactPerson':
        if (!value.trim()) {
          error = 'Contact Person is required';
        } else if (value.length < 3) {
          error = 'Contact person name must be at least 3 characters';
        } else if (value.length > 50) {
          error = 'Contact person name must be at most 50 characters';
        } else if (!/^[a-zA-Z\s]*$/.test(value)) {
          error = 'Contact person name should contain only alphabets';
        }
        break;

      case 'MobileNo':
      case 'MobileNo2':
      case 'MobileNo3':
        if (name === 'MobileNo' && !value.trim()) {
          error = 'Mobile Number is required';
        } else if (value.trim()) {
          if (!/^\d{10}$/.test(value.trim())) {
            error = 'Enter a valid 10-digit mobile number';
          } else if (
            allCustomers.some(
              c =>
                (c.MobileNo === value.trim() ||
                  c.MobileNo2 === value.trim() ||
                  c.MobileNo3 === value.trim()) &&
                c.CustomerID !== currentId
            )
          ) {
            error = 'Mobile number already exists';
          } else {
            // Check duplicates within the same form
            const otherMobiles = [
              name !== 'MobileNo' ? formData.MobileNo : null,
              name !== 'MobileNo2' ? formData.MobileNo2 : null,
              name !== 'MobileNo3' ? formData.MobileNo3 : null,
            ].filter(Boolean);
            if (otherMobiles.includes(value.trim())) {
              error = 'Duplicate mobile number not allowed for same customer';
            }
          }
        }
        break;

      case 'EmailID':
        if (value.trim()) {
          const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
          if (!emailRegex.test(value.trim())) {
            error = 'Enter valid email format';
          } else if (value.length > 100) {
            error = 'Email must be at most 100 characters';
          } else if (value.includes(' ')) {
            error = 'No spaces allowed in email';
          } else if (
            allCustomers.some(
              c =>
                c.EmailID?.toLowerCase() === value.trim().toLowerCase() &&
                c.CustomerID !== currentId
            )
          ) {
            error = 'Email already exists';
          }
        }
        break;

      case 'Address':
        if (value.trim()) {
          if (value.length < 5) {
            error = 'Address must be at least 5 characters';
          } else if (value.length > 500) {
            error = 'Address must be at most 500 characters';
          }
        }
        break;

      case 'Pincode':
        if (!value.trim()) {
          error = 'Pincode is required';
        } else if (!/^\d{6}$/.test(value.trim())) {
          error = 'Enter a valid 6-digit pincode';
        }
        break;

      case 'Location':
      case 'State':
        if (value.trim()) {
          if (value.length < 3) {
            error = `${name} must be at least 3 characters`;
          } else if (value.length > 50) {
            error = `${name} must be at most 50 characters`;
          } else if (!/^[a-zA-Z\s]*$/.test(value)) {
            error = `${name} should contain only alphabets and spaces`;
          }
        }
        break;

      case 'Area':
        if (value.trim()) {
          if (value.length < 3) {
            error = 'Area must be at least 3 characters';
          } else if (value.length > 50) {
            error = 'Area must be at most 50 characters';
          }
        }
        break;

      case 'GSTNumber':
        if (value.trim()) {
          const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
          if (value.length !== 15 || !gstinRegex.test(value)) {
            error = 'Enter a valid GSTIN';
          }
        }
        break;
    }

    setErrors(prev => {
      const newErrors = { ...prev };
      if (error) newErrors[name] = error;
      else delete newErrors[name];
      return newErrors;
    });

    return error;
  };

  const handlePincodeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setFormData(prev => ({
      ...prev,
      Pincode: val,
      State: val.length < 6 ? '' : prev.State,
      Location: val.length < 6 ? '' : prev.Location,
    }));

    if (val.length < 6) {
      validateField('Pincode', val);
      return;
    }

    if (val === formData.Pincode) return;

    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.Pincode;
      return newErrors;
    });

    const target = e.target;

    try {
      setIsFetchingState(true);
      let resData = null;

      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${val}`);
        if (!res.ok) throw new Error('API fetch failed');
        resData = await res.json();
      } catch (err) {
        const fallbackRes = await fetch(`https://api.zippopotam.us/in/${val}`);
        if (!fallbackRes.ok) throw new Error('Fallback API fetch failed');
        const fallbackData = await fallbackRes.json();
        if (fallbackData && fallbackData.places && fallbackData.places.length > 0) {
          resData = [
            {
              Status: 'Success',
              PostOffice: [
                {
                  State: fallbackData.places[0].state,
                  District: fallbackData.places[0]['place name'] || '',
                },
              ],
            },
          ];
        } else {
          throw new Error('No records found in fallback');
        }
      }

      if (target.value.replace(/\D/g, '').slice(0, 6) !== val) return;

      if (resData?.[0]?.Status === 'Success' && resData[0].PostOffice?.length > 0) {
        const postOffice = resData[0].PostOffice[0];
        setFormData(prev => ({
          ...prev,
          State: postOffice.State,
          Location: postOffice.District || prev.Location,
        }));
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.State;
          if (postOffice.District) delete newErrors.Location;
          return newErrors;
        });
      } else {
        setErrors(prev => ({ ...prev, Pincode: 'Invalid pincode — no records found' }));
      }
    } catch (error) {
      if (target.value.replace(/\D/g, '').slice(0, 6) !== val) return;
      setErrors(prev => ({
        ...prev,
        Pincode: 'Failed to auto-fetch state. Please enter manually.',
      }));
    } finally {
      if (target.value.replace(/\D/g, '').slice(0, 6) === val) {
        setIsFetchingState(false);
      }
    }
  };

  const handleSubmit = () => {
    // 1. Browser-native validation for mandatory fields (shows tooltip)
    if (!formData.CompanyName?.trim()) {
      companyNameRef.current?.reportValidity();
      return;
    }
    if (!formData.MobileNo?.trim()) {
      mobileRef.current?.reportValidity();
      return;
    }
    if (!formData.Pincode?.trim()) {
      pincodeRef.current?.reportValidity();
      return;
    }

    // 2. Manual validation for all fields to collect other errors (duplicates, format, etc.)
    const newErrors: Record<string, string> = {};

    const companyError = validateField('CompanyName', formData.CompanyName || '');
    const mobileError = validateField('MobileNo', formData.MobileNo || '');
    const contactError = validateField('ContactPerson', formData.ContactPerson || '');
    const emailError = validateField('EmailID', formData.EmailID || '');
    const addressError = validateField('Address', formData.Address || '');
    const locationError = validateField('Location', formData.Location || '');
    const stateError = validateField('State', formData.State || '');
    const areaError = validateField('Area', formData.Area || '');
    const gstinError = validateField('GSTNumber', formData.GSTNumber || '');
    const pincodeError = validateField('Pincode', formData.Pincode || '');

    if (companyError) newErrors.CompanyName = companyError;
    if (mobileError) newErrors.MobileNo = mobileError;
    if (contactError) newErrors.ContactPerson = contactError;
    if (emailError) newErrors.EmailID = emailError;
    if (addressError) newErrors.Address = addressError;
    if (locationError) newErrors.Location = locationError;
    if (stateError) newErrors.State = stateError;
    if (areaError) newErrors.Area = areaError;
    if (gstinError) newErrors.GSTNumber = gstinError;
    if (pincodeError) newErrors.Pincode = pincodeError;

    const hasErrors = Object.keys(newErrors).length > 0;

    if (hasErrors) {
      // If there are errors (like duplicates or format), focus the first one
      if (companyError) companyNameRef.current?.focus();
      else if (mobileError) mobileRef.current?.focus();
      return;
    }

    const customerData: Customer = {
      CustomerID: formData.CustomerID || 0,
      CompanyName: formData.CompanyName!.trim(),
      ContactPerson: formData.ContactPerson?.trim() || '',
      MobileNo: formData.MobileNo!.trim(),
      MobileNo2: formData.MobileNo2?.trim() || '',
      MobileNo3: formData.MobileNo3?.trim() || '',
      CountryCode: formData.CountryCode || '+91',
      CountryCode2: formData.MobileNo2?.trim() ? formData.CountryCode2 || '+91' : '',
      CountryCode3: formData.MobileNo3?.trim() ? formData.CountryCode3 || '+91' : '',
      EmailID: formData.EmailID?.trim() || '',
      Location: formData.Location?.trim() || '',
      State: formData.State?.trim() || '',
      Area: formData.Area?.trim() || '',
      Address: formData.Address?.trim() || '',
      Pincode: formData.Pincode?.trim() || '',
      GSTNumber: formData.GSTNumber?.trim() || '',
      SalesPersonID: formData.SalesPersonID,
      CustomerTypeID: formData.CustomerTypeID,
      IsActive: formData.IsActive ?? true,
      OpeningBalance: formData.OpeningBalance,
    } as Customer;

    setPendingData(customerData);
    setShowConfirmation(true);
  };

  const handleConfirmSave = () => {
    if (pendingData) {
      onSave(pendingData);
      setShowConfirmation(false);
    }
  };

  const handleCancel = () => {
    if (!item) {
      setFormData({
        CustomerID: 0,
        CompanyName: '',
        ContactPerson: '',
        MobileNo: '',
        MobileNo2: '',
        MobileNo3: '',
        CountryCode: '+91',
        CountryCode2: '+91',
        CountryCode3: '+91',
        EmailID: '',
        Location: '',
        State: '',
        Area: '',
        Address: '',
        GSTNumber: '',
        Pincode: '',
        SalesPersonID: undefined,
        IsActive: true,
      });
      setShowMobile2(false);
      setShowMobile3(false);
      setErrors({});
    }
    onCancel();
  };

  return (
    <>
      <Modal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        title="Confirm Customer Details"
        size="lg"
      >
        <div className="space-y-5">
          {/* Company Name - Prominent */}
          <div className="bg-[var(--surface-highlight)]/40 p-4 rounded-lg border border-[var(--border)]/50">
            <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              Company Name
            </span>
            <p className="text-lg font-bold text-[var(--text-primary)] mt-1">
              {pendingData?.CompanyName}
            </p>
          </div>

          {/* Contact Information */}
          <div>
            <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              Contact Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  Contact Person
                </span>
                <p className="text-[var(--text-primary)] font-medium">
                  {pendingData?.ContactPerson || '-'}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-[var(--text-secondary)]">Email</span>
                <p className="text-[var(--text-primary)] font-medium break-all">
                  {pendingData?.EmailID || '-'}
                </p>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  Mobile Numbers
                </span>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1.5 bg-[var(--primary)]/10 text-[var(--primary)] rounded-md font-medium text-sm">
                    {pendingData?.CountryCode} {pendingData?.MobileNo}
                  </span>
                  {pendingData?.MobileNo2 && (
                    <span className="px-3 py-1.5 bg-[var(--primary)]/10 text-[var(--primary)] rounded-md font-medium text-sm">
                      {pendingData?.CountryCode2} {pendingData.MobileNo2}
                    </span>
                  )}
                  {pendingData?.MobileNo3 && (
                    <span className="px-3 py-1.5 bg-[var(--primary)]/10 text-[var(--primary)] rounded-md font-medium text-sm">
                      {pendingData?.CountryCode3} {pendingData.MobileNo3}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div>
            <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Address Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <span className="text-xs font-medium text-[var(--text-secondary)]">Pincode</span>
                <p className="text-[var(--text-primary)] font-medium">
                  {pendingData?.Pincode || '-'}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  Location / City
                </span>
                <p className="text-[var(--text-primary)] font-medium">
                  {pendingData?.Location || '-'}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-[var(--text-secondary)]">Area</span>
                <p className="text-[var(--text-primary)] font-medium">{pendingData?.Area || '-'}</p>
              </div>
              {pendingData?.Address && (
                <div className="space-y-1 sm:col-span-2">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    Complete Address
                  </span>
                  <p className="text-[var(--text-primary)] whitespace-pre-wrap bg-[var(--surface-highlight)]/30 p-3 rounded-md border border-[var(--border)]/30">
                    {pendingData.Address}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Business Information */}
          <div>
            <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              Business Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <span className="text-xs font-medium text-[var(--text-secondary)]">GSTIN</span>
                <p className="text-[var(--text-primary)] font-medium font-mono">
                  {pendingData?.GSTNumber || '-'}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  Customer Type
                </span>
                <p className="text-[var(--text-primary)] font-medium">
                  {customerTypes.find(ct => ct.value === pendingData?.CustomerTypeID?.toString())
                    ?.label || '-'}
                </p>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  Assigned Salesperson
                </span>
                <p className="text-[var(--text-primary)] font-medium">
                  {salespersons.find(s => s.value === pendingData?.SalesPersonID?.toString())
                    ?.label || '-'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-5 border-t border-[var(--border)]">
            <Button variant="ghost" onClick={() => setShowConfirmation(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirmSave}>
              Confirm & Save
            </Button>
          </div>
        </div>
      </Modal>

      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Primary Information */}
          <div className="space-y-4">
            <div className="space-y-1">
              <Input
                ref={companyNameRef}
                label="Company Name"
                value={formData.CompanyName || ''}
                onChange={e => {
                  setFormData({ ...formData, CompanyName: e.target.value });
                  validateField('CompanyName', e.target.value);
                }}
                placeholder="Enter company name"
                required
                autoFocus
                className="h-10"
              />
              {errors.CompanyName && (
                <p className="text-xs text-red-500 font-medium">{errors.CompanyName}</p>
              )}
            </div>

            <div className="space-y-1">
              <Input
                label="Contact Person"
                value={formData.ContactPerson || ''}
                onChange={e => {
                  setFormData({ ...formData, ContactPerson: e.target.value });
                  validateField('ContactPerson', e.target.value);
                }}
                placeholder="Enter contact person"
                required
                className="h-10"
              />
              {errors.ContactPerson && (
                <p className="text-xs text-red-500 font-medium">{errors.ContactPerson}</p>
              )}
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-[var(--text-primary)]">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="flex-shrink-0 h-10" style={{ width: '100px' }}>
                    <Select
                      options={countryCodes.map(code => ({ value: code, label: code }))}
                      value={formData.CountryCode || '+91'}
                      onChange={e => {
                        setFormData({ ...formData, CountryCode: e.target.value });
                      }}
                    />
                  </div>
                  <div className="flex-1 h-10">
                    <Input
                      ref={mobileRef}
                      type="tel"
                      value={formData.MobileNo || ''}
                      onChange={e => {
                        setFormData({ ...formData, MobileNo: e.target.value });
                        validateField('MobileNo', e.target.value);
                      }}
                      placeholder="Enter 10-digit mobile number"
                      required
                      maxLength={10}
                      className="h-10"
                    />
                  </div>
                </div>
                {errors.MobileNo && (
                  <p className="text-xs text-red-500 font-medium">{errors.MobileNo}</p>
                )}
              </div>

              {(formData.MobileNo2 || showMobile2) && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-[var(--text-primary)]">
                    Mobile Number 2 (Optional)
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-shrink-0 h-10" style={{ width: '100px' }}>
                      <Select
                        options={countryCodes.map(code => ({ value: code, label: code }))}
                        value={formData.CountryCode2 || '+91'}
                        onChange={e => {
                          setFormData({ ...formData, CountryCode2: e.target.value });
                        }}
                      />
                    </div>
                    <div className="flex-1 relative h-10">
                      <Input
                        type="tel"
                        value={formData.MobileNo2 || ''}
                        onChange={e => {
                          setFormData({ ...formData, MobileNo2: e.target.value });
                          validateField('MobileNo2', e.target.value);
                        }}
                        placeholder="Enter 10-digit mobile number"
                        maxLength={10}
                        className="h-10"
                      />
                      <button
                        onClick={() => {
                          setFormData({ ...formData, MobileNo2: '', CountryCode2: '+91' });
                          validateField('MobileNo2', '');
                          setShowMobile2(false);
                        }}
                        className="absolute right-3 top-2 text-gray-400 hover:text-red-500"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                  {errors.MobileNo2 && (
                    <p className="text-xs text-red-500 font-medium">{errors.MobileNo2}</p>
                  )}
                </div>
              )}

              {(formData.MobileNo3 || showMobile3) && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-[var(--text-primary)]">
                    Mobile Number 3 (Optional)
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-shrink-0 h-10" style={{ width: '100px' }}>
                      <Select
                        options={countryCodes.map(code => ({ value: code, label: code }))}
                        value={formData.CountryCode3 || '+91'}
                        onChange={e => {
                          setFormData({ ...formData, CountryCode3: e.target.value });
                        }}
                      />
                    </div>
                    <div className="flex-1 relative h-10">
                      <Input
                        type="tel"
                        value={formData.MobileNo3 || ''}
                        onChange={e => {
                          setFormData({ ...formData, MobileNo3: e.target.value });
                          validateField('MobileNo3', e.target.value);
                        }}
                        placeholder="Enter 10-digit mobile number"
                        maxLength={10}
                        className="h-10"
                      />
                      <button
                        onClick={() => {
                          setFormData({ ...formData, MobileNo3: '', CountryCode3: '+91' });
                          validateField('MobileNo3', '');
                          setShowMobile3(false);
                        }}
                        className="absolute right-3 top-2 text-gray-400 hover:text-red-500"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                  {errors.MobileNo3 && (
                    <p className="text-xs text-red-500 font-medium">{errors.MobileNo3}</p>
                  )}
                </div>
              )}

              {!(showMobile3 || formData.MobileNo3) && (
                <button
                  onClick={() => {
                    if (!showMobile2 && !formData.MobileNo2) setShowMobile2(true);
                    else if (!showMobile3 && !formData.MobileNo3) setShowMobile3(true);
                  }}
                  className="text-xs text-[var(--primary)] hover:underline flex items-center gap-1 w-fit font-medium"
                >
                  <Plus size={14} /> Add another mobile number
                </button>
              )}
            </div>

            <div className="space-y-1">
              <Input
                label="Email ID (Optional)"
                type="email"
                value={formData.EmailID || ''}
                onChange={e => {
                  setFormData({ ...formData, EmailID: e.target.value });
                  validateField('EmailID', e.target.value);
                }}
                placeholder="Enter email address"
                className="h-10"
              />
              {errors.EmailID && (
                <p className="text-xs text-red-500 font-medium">{errors.EmailID}</p>
              )}
            </div>

            <div className="space-y-1">
              <Input
                label="GSTIN (Optional)"
                value={formData.GSTNumber || ''}
                onChange={e => {
                  const value = e.target.value.toUpperCase();
                  setFormData({ ...formData, GSTNumber: value });
                  validateField('GSTNumber', value);
                }}
                placeholder="27AAPFU0939F1ZV"
                maxLength={15}
                className="h-10"
              />
              {errors.GSTNumber && (
                <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {errors.GSTNumber}
                </p>
              )}
            </div>

            {!item && (
              <div className="mt-4 border-t border-[var(--border)] pt-4">
                <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                  Initial Setup
                </h4>
                <div className="space-y-1">
                  <Input
                    label="Opening Balance (Rs.)"
                    type="number"
                    value={formData.OpeningBalance || ''}
                    onChange={e =>
                      setFormData({ ...formData, OpeningBalance: Number(e.target.value) })
                    }
                    placeholder="0.00"
                    className="h-10 font-medium"
                  />
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Initial balance for the customer. Positive for Debit (Due), Negative for Credit
                    (Advance).
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Additional Details */}
          <div className="space-y-4">
            <div className="space-y-1">
              <Input
                ref={pincodeRef}
                label="Pincode"
                value={formData.Pincode || ''}
                onChange={handlePincodeChange}
                placeholder="Enter 6-digit pincode"
                maxLength={6}
                required
                className="h-10"
              />
              {errors.Pincode && (
                <p className="text-xs text-red-500 font-medium">{errors.Pincode}</p>
              )}
            </div>

            <div className="space-y-1">
              <Input
                label="Location / District (Auto-fetched)"
                value={formData.Location || ''}
                onChange={e => {
                  setFormData({ ...formData, Location: e.target.value });
                  validateField('Location', e.target.value);
                }}
                placeholder="District will be fetched from pincode"
                className="h-10"
                disabled={isFetchingState}
              />
              {errors.Location && (
                <p className="text-xs text-red-500 font-medium">{errors.Location}</p>
              )}
            </div>

            <div className="space-y-1">
              <Input
                label="State (Auto-fetched)"
                value={formData.State || ''}
                onChange={e => {
                  setFormData({ ...formData, State: e.target.value });
                  validateField('State', e.target.value);
                }}
                placeholder="State will be fetched from pincode"
                className="h-10"
                disabled={isFetchingState}
              />
              {errors.State && <p className="text-xs text-red-500 font-medium">{errors.State}</p>}
            </div>

            <div className="space-y-1">
              <Input
                label="Area"
                value={formData.Area || ''}
                onChange={e => {
                  setFormData({ ...formData, Area: e.target.value });
                  validateField('Area', e.target.value);
                }}
                placeholder="Enter Area"
                className="h-10"
              />
              {errors.Area && <p className="text-xs text-red-500 font-medium">{errors.Area}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--text-primary)]">
                Complete Address (Optional)
              </label>
              <textarea
                className={`w-full h-10 px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface)] border ${
                  errors.Address ? 'border-red-500' : 'border-[var(--border)]'
                } text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] placeholder:opacity-60 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all duration-200 resize-none`}
                value={formData.Address || ''}
                onChange={e => {
                  setFormData({ ...formData, Address: e.target.value });
                  validateField('Address', e.target.value);
                }}
                placeholder="Enter full billing/shipping address"
                maxLength={500}
              />
              {errors.Address && (
                <p className="text-xs text-red-500 font-medium">{errors.Address}</p>
              )}
            </div>

            <Select
              label="Customer Type (Optional)"
              options={customerTypes}
              value={formData.CustomerTypeID?.toString() || ''}
              onChange={e =>
                setFormData({
                  ...formData,
                  CustomerTypeID: e.target.value ? parseInt(e.target.value) : undefined,
                })
              }
              placeholder="Select customer type"
              className="h-10"
            />

            <Select
              label="Assigned Salesperson"
              options={salespersons}
              value={formData.SalesPersonID?.toString() || ''}
              onChange={e =>
                setFormData({
                  ...formData,
                  SalesPersonID: e.target.value ? parseInt(e.target.value) : undefined,
                })
              }
              placeholder="Select salesperson"
              disabled={
                !(user?.Role
                  ? ['Admin', 'SuperAdmin', 'Accounts Manager'].includes(user?.Role)
                  : false)
              }
              className="h-10"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-6 border-t border-[var(--border)] mt-2">
          <Button variant="ghost" onClick={handleCancel} size="md">
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} size="md" disabled={isSaving}>
            {isSaving ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Processing...
              </span>
            ) : (
              'Save Customer'
            )}
          </Button>
        </div>
      </div>
    </>
  );
};

export default function CustomerMaster() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formKey, setFormKey] = useState(0);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const response = await customerApi.getAll();
      if (response.success && response.data) {
        if (response.data.length > 0) {
          console.log('DEBUG: Customer Keys:', Object.keys(response.data[0]));
          // Log raw balance values to check if they are string or number
          console.log(
            'DEBUG: Balance Value Sample:',
            response.data[0].currentBalance,
            (response.data[0] as any).CurrentBalance
          );
        }
        setCustomers(response.data);
      }
    } catch (error) {
      logger.error('Failed to load customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (item: Customer) => {
    const isEditMode = !!(item.CustomerID && item.CustomerID > 0);

    try {
      setSaving(true);

      if (isEditMode) {
        // Update
        logger.info('Updating customer:', item);
        const response = await customerApi.update(item.CustomerID, item);
        logger.info('Update response:', response);

        if (response.success && response.data) {
          setCustomers(prev =>
            prev.map(c => (c.CustomerID === item.CustomerID ? (response.data as Customer) : c))
          );
          setEditingCustomer(null);
          showToast.success('Customer updated successfully!');
        } else if (!response.success) {
          logger.error('Update failed:', response.error);
        }
      } else {
        // Create
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { CustomerID, ...createData } = item;
        logger.info('Creating customer:', createData);
        const response = await customerApi.create(createData as Omit<Customer, 'CustomerID'>);

        if (response.success && response.data) {
          setCustomers(prev => [...prev, response.data as Customer]);
          setEditingCustomer(null);
          setFormKey(prev => prev + 1); // Force form reset
          showToast.success('Customer created successfully!');
        } else if (!response.success) {
          logger.error('Create failed:', response.error);
        }
      }
    } catch (error) {
      const action = isEditMode ? 'update customer' : 'create customer';
      logger.error(`Failed to ${action}:`, error);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (customer: Customer) => {
    const newStatus = !customer.IsActive;
    const action = newStatus ? 'activate' : 'deactivate';

    if (!window.confirm(`Are you sure you want to ${action} this customer?`)) return;

    try {
      logger.info(`${action}ing customer:`, { id: customer.CustomerID });
      // We use update instead of delete
      const response = await customerApi.update(customer.CustomerID, {
        ...customer,
        IsActive: newStatus,
      });

      if (response.success) {
        setCustomers(prev =>
          prev.map(c => (c.CustomerID === customer.CustomerID ? { ...c, IsActive: newStatus } : c))
        );
        showToast.success(`Customer ${action}d successfully!`);
        logger.info(`Customer ${action}d successfully:`, { id: customer.CustomerID });

        if (editingCustomer?.CustomerID === customer.CustomerID) {
          setEditingCustomer(null);
        }
      } else {
        logger.error(`${action} failed:`, response.error);
        showToast.error(`Failed to ${action} customer`);
      }
    } catch (error) {
      logger.error(`Failed to ${action} customer:`, error);
      showToast.error(`Failed to ${action} customer`);
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleCancel = () => {
    setEditingCustomer(null);
  };

  const columns: ColumnDef<Customer>[] = [
    {
      accessorKey: 'CustomerID',
      header: ({ column }) => <DataTableColumnHeader column={column} title="ID" />,
      cell: ({ row }) => <span>{row.original.CustomerID}</span>,
    },
    {
      accessorKey: 'CompanyName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Company Name" />,
      cell: ({ row }) => <span className="font-medium">{row.original.CompanyName}</span>,
    },
    {
      accessorKey: 'ContactPerson',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Contact Person" />,
      cell: ({ row }) => <span>{row.original.ContactPerson || '-'}</span>,
    },
    {
      accessorKey: 'MobileNo',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Mobile" />,
      cell: ({ row }) => {
        const mobiles = [
          { number: row.original.MobileNo, code: row.original.CountryCode || '+91' },
          { number: row.original.MobileNo2, code: row.original.CountryCode2 || '+91' },
          { number: row.original.MobileNo3, code: row.original.CountryCode3 || '+91' },
        ].filter(m => m.number);

        // Deduplicate mobile numbers to prevent key errors
        const uniqueMobiles = Array.from(new Set(mobiles.map(m => JSON.stringify(m)))).map(s =>
          JSON.parse(s)
        );

        if (uniqueMobiles.length === 0) return '-';

        return (
          <div className="flex flex-col gap-0.5 py-1">
            {uniqueMobiles.map((m: any, i: number) => (
              <span key={i} className="text-xs whitespace-nowrap">
                <span className="text-[var(--text-secondary)] font-medium">{m.code}</span>{' '}
                {m.number}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      accessorKey: 'Location',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Location" />,
      cell: ({ row }) => <span>{row.original.Location || '-'}</span>,
    },
    {
      accessorKey: 'Area',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Area" />,
      cell: ({ row }) => <span>{row.original.Area || '-'}</span>,
    },
    {
      accessorKey: 'Pincode',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Pincode" />,
      cell: ({ row }) => <span>{row.original.Pincode || '-'}</span>,
    },
    {
      accessorKey: 'SalesPersonName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Salesperson" />,
      cell: ({ row }) => <span>{row.original.SalesPersonName || '-'}</span>,
    },
    {
      accessorKey: 'EmailID',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
      cell: ({ row }) => <span>{row.original.EmailID || '-'}</span>,
    },
    {
      accessorKey: 'currentBalance',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Balance" />,
      cell: ({ row }) => {
        // Handle both camelCase and PascalCase
        const val =
          row.original.currentBalance !== undefined
            ? row.original.currentBalance
            : (row.original as any).CurrentBalance;
        const balance = Number(val || 0);
        return (
          <span
            className={`font-medium ${balance > 0 ? 'text-red-600' : balance < 0 ? 'text-green-600' : ''}`}
          >
            Rs. {Math.abs(balance).toFixed(2)} {balance > 0 ? ' (Dr)' : balance < 0 ? ' (Cr)' : ''}
          </span>
        );
      },
    },
    {
      accessorKey: 'IsActive',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => (
        <span
          className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${row.original.IsActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
        >
          {row.original.IsActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => handleEdit(row.original)}
            className="p-2 rounded-lg hover:bg-[var(--surface-highlight)] text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors border border-transparent hover:border-[var(--border)] focus-ring"
            title="Edit"
            aria-label="Edit"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => handleToggleStatus(row.original)}
            className={`p-2 rounded-lg transition-colors border border-transparent focus-ring ${
              row.original.IsActive
                ? 'hover:bg-red-50 text-[var(--text-secondary)] hover:text-[var(--danger)] hover:border-red-200'
                : 'hover:bg-green-50 text-[var(--text-secondary)] hover:text-green-600 hover:border-green-200'
            }`}
            title={row.original.IsActive ? 'Deactivate' : 'Activate'}
            aria-label={row.original.IsActive ? 'Deactivate' : 'Activate'}
          >
            {row.original.IsActive ? <Lock size={16} /> : <Unlock size={16} />}
          </button>
        </div>
      ),
    },
  ];

  if (loading && customers.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <PageHeader title="Customer Master" description="Manage your customer records" />

      {/* Form Section - Always visible */}
      <div
        ref={formRef}
        className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6 shadow-sm"
      >
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {editingCustomer
              ? 'Update the customer information below'
              : 'Fill in the details to add a new customer'}
          </p>
        </div>
        <CustomerForm
          key={formKey}
          item={editingCustomer}
          onSave={handleSave}
          onCancel={handleCancel}
          isSaving={saving}
          allCustomers={customers}
        />
      </div>

      {/* Table Section - Always visible */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-sm overflow-hidden">
        <DataTable
          data={customers}
          columns={columns}
          searchPlaceholder="Search customers..."
          getRowClassName={row =>
            !row.original.IsActive
              ? 'opacity-60 bg-[var(--surface-highlight)]/30 grayscale-[0.5]'
              : ''
          }
        />
      </div>
    </div>
  );
}
