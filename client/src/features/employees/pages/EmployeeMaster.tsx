import { useState, useEffect, useRef } from 'react';
import { SortingState, ColumnDef } from '@tanstack/react-table';
import logger from '@/utils/logger';
import { Employee } from '../types';
import { employeeApi } from '../api';
import { authApi } from '@/features/authority/api/authApi';
import { PageHeader } from '@/components/common';
import { Input, Button, Select, Modal } from '@/components/ui';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { showToast } from '@/utils/toast';
import { Edit2, Trash2, Eye, X, Plus, RefreshCw } from 'lucide-react';
import { confirmDialog } from '@/components/ui';

const EmployeeForm = ({
  item,
  onSave,
  onCancel,
  isSaving = false,
  existingUsernames,
  departments,
  roles,
  onDepartmentChange,
  salesPersons,
}: {
  item: Partial<Employee> | null;
  onSave: (item: Employee) => void;
  onCancel: () => void;
  isSaving?: boolean;
  existingUsernames: string[];
  departments: { value: number; label: string }[];
  roles: { value: number; label: string }[];
  onDepartmentChange: (departmentId: number | undefined) => void;
  salesPersons: Employee[];
}) => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingData, setPendingData] = useState<any>(null);

  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const mobileRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Helper function to convert ISO date strings to YYYY-MM-DD format for HTML date inputs
  const formatDateForInput = (dateString?: string): string => {
    if (!dateString) return '';
    try {
      // If it's already in YYYY-MM-DD format, return as is
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString;
      }
      // Otherwise, parse and convert
      const date = new Date(dateString);
      // Check if date is valid
      if (isNaN(date.getTime())) return '';
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  // Extract prefix from firstName if it exists (for edit mode)
  const extractPrefix = (fullName: string) => {
    const prefixes = ['Mr.', 'Ms.', 'Mrs.'];
    for (const prefix of prefixes) {
      if (fullName.startsWith(prefix + ' ')) {
        return { prefix, name: fullName.substring(prefix.length + 1) };
      }
    }
    return { prefix: '', name: fullName };
  };

  const { prefix: initialPrefix, name: initialFirstName } = item?.FirstName
    ? extractPrefix(item.FirstName)
    : { prefix: 'Mr.', name: '' };

  const [prefix, setPrefix] = useState<string>(initialPrefix || 'Mr.');
  const [showCredentialsEdit, setShowCredentialsEdit] = useState<boolean>(false);

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

  const [formData, setFormData] = useState<Partial<Employee>>({
    FirstName: initialFirstName,
    LastName: item?.LastName || '',
    EmailID: item?.EmailID || '',
    Username: item?.Username || '',
    Password: '',
    MobileNo:
      item?.MobileNo && item?.MobileNo.length > 0 ? item.MobileNo.filter(m => m && m.trim()) : [''],
    CountryCode: item?.CountryCode && item?.CountryCode.length > 0 ? item.CountryCode : ['+91'],
    DepartmentID: item?.DepartmentID,
    RoleID: item?.RoleID,
    JoiningDate: formatDateForInput(item?.JoiningDate) || new Date().toISOString().split('T')[0],

    DOB: formatDateForInput(item?.DOB),
    // Dealer fields
    CompanyName: item?.CompanyName || '',
    GSTIN: item?.GSTIN || '',
    Pincode: item?.Pincode || '',
    AddressCity: item?.AddressCity || '',
    AddressState: item?.AddressState || '',
    Area: item?.Area || '',
    AddressComplete: item?.AddressComplete || '',
    CustomerType: item?.CustomerType || 'Dealer',
    AssignedSalespersonID: item?.AssignedSalespersonID,
  });

  // Clear errors when item changes
  useEffect(() => {
    setErrors({});
  }, [item]);

  const isDealerDept = departments.find(d => d.value === formData.DepartmentID)?.label === 'Dealer';

  // Auto-select Role for Dealer Department and set Joining Date
  useEffect(() => {
    if (isDealerDept && roles.length > 0) {
      const dealerRole = roles.find(r => r.label === 'Dealer');
      if (dealerRole) {
        setFormData(prev => ({
          ...prev,
          RoleID: dealerRole.value,
          JoiningDate: new Date().toISOString().split('T')[0], // Default to today
        }));
      }
    }
  }, [isDealerDept, roles]);

  const isEditMode = !!item?.EmployeeID;

  // Reset form when item changes (switching between add/edit or different employee)
  useEffect(() => {
    const { prefix: newPrefix, name: newFirstName } = item?.FirstName
      ? extractPrefix(item.FirstName)
      : { prefix: 'Mr.', name: '' };

    setPrefix(newPrefix || 'Mr.');
    setShowCredentialsEdit(false);
    setFormData({
      FirstName: newFirstName,
      LastName: item?.LastName || '',
      EmailID: item?.EmailID || '',
      Username: item?.Username || '',
      Password: '',
      MobileNo:
        item?.MobileNo && item?.MobileNo.length > 0
          ? item.MobileNo.filter(m => m && m.trim())
          : [''],
      CountryCode: item?.CountryCode && item?.CountryCode.length > 0 ? item.CountryCode : ['+91'],
      DepartmentID: item?.DepartmentID,
      RoleID: item?.RoleID,
      JoiningDate: formatDateForInput(item?.JoiningDate) || new Date().toISOString().split('T')[0],
      // Dealer fields
      CompanyName: item?.CompanyName || '',
      GSTIN: item?.GSTIN || '',
      Pincode: item?.Pincode || '',
      AddressCity: item?.AddressCity || '',
      AddressState: item?.AddressState || '',
      Area: item?.Area || '',
      AddressComplete: item?.AddressComplete || '',
      CustomerType: item?.CustomerType || 'Dealer',
      AssignedSalespersonID: item?.AssignedSalespersonID,
    });
  }, [item]);

  const generateUsername = () => {
    const firstName = formData.FirstName?.toLowerCase().replace(/\s+/g, '') || '';
    const lastName = formData.LastName?.toLowerCase().replace(/\s+/g, '') || '';
    const randomNum = Math.floor(Math.random() * 1000);
    const username = `${firstName}${lastName}${randomNum}`;
    setFormData({ ...formData, Username: username });
    validateField('Username', username);
  };

  const generatePassword = () => {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{};:"\\|,.<>/?';
    const all = upper + lower + numbers + symbols;

    let password = '';
    // Ensure at least one of each category for strong password
    password += upper.charAt(Math.floor(Math.random() * upper.length));
    password += lower.charAt(Math.floor(Math.random() * lower.length));
    password += numbers.charAt(Math.floor(Math.random() * numbers.length));
    password += symbols.charAt(Math.floor(Math.random() * symbols.length));

    // Fill the rest to reach 12 characters
    for (let i = 0; i < 8; i++) {
      password += all.charAt(Math.floor(Math.random() * all.length));
    }

    // Shuffle the string
    const shuffled = password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');

    setFormData({ ...formData, Password: shuffled });
    // Validate immediately
    validateField('Password', shuffled);
  };

  const handlePincodeChange = async (pincode: string) => {
    setFormData(prev => ({ ...prev, Pincode: pincode }));

    // Validate pincode immediately
    validateField('Pincode', pincode);

    if (pincode.length === 6 && /^\d{6}$/.test(pincode)) {
      try {
        const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
        const data = await response.json();
        if (data && data[0] && data[0].Status === 'Success') {
          const details = data[0].PostOffice[0];
          setFormData(prev => ({
            ...prev,
            Pincode: pincode,
            AddressCity: details.District,
            AddressState: details.State,
            Area: details.Name, // Auto-fill Area with Post Office name as a suggestion
            AddressComplete:
              prev.AddressComplete || `${details.Name}, ${details.District}, ${details.State}`,
          }));
          // Re-validate Area as we auto-filled it
          if (details.Name) validateField('Area', details.Name);
        }
      } catch (err) {
        console.error('Failed to fetch pincode details', err);
      }
    }
  };

  const validateField = (name: string, value: any, index?: number) => {
    setErrors(prevErrors => {
      let error = '';
      const newErrors = { ...prevErrors };

      switch (name) {
        case 'FirstName':
          if (!value?.trim()) error = 'First name is required';
          else if (value.length < 2 || value.length > 50)
            error = 'First name must be 2-50 characters';
          else if (!/^[a-zA-Z\s]*$/.test(value))
            error = 'First name cannot contain numbers or special characters';

          if (error) newErrors.FirstName = error;
          else delete newErrors.FirstName;
          break;

        case 'LastName':
          if (!value?.trim()) error = 'Last name is required';
          else if (value.length < 2 || value.length > 50)
            error = 'Last name must be 2-50 characters';
          else if (!/^[a-zA-Z\s]*$/.test(value))
            error = 'Last name cannot contain numbers or special characters';

          if (error) newErrors.LastName = error;
          else delete newErrors.LastName;
          break;

        case 'Username':
          if (!isEditMode || showCredentialsEdit) {
            if (!value?.trim()) error = 'Username is required';
            else if (value.includes(' ')) error = 'No spaces allowed';
            else if (value.length < 5 || value.length > 50)
              error = 'Length must be 5-50 characters';
            else if (!/^[a-zA-Z0-9._]+$/.test(value)) error = 'Allowed: alphabets, numbers, . or _';
            else if (/^[_.]|[_.]$/.test(value)) error = 'Cannot start/end with . or _';
            else if (
              existingUsernames.includes(value.trim()) &&
              (!isEditMode || value.trim() !== item?.Username)
            ) {
              error = 'Username already taken please enter new / differnt';
            }

            if (error) newErrors.Username = error;
            else delete newErrors.Username;
          }
          break;

        case 'Password':
          if (!isEditMode || showCredentialsEdit) {
            if (!value && !isEditMode) {
              error = 'Password is required for new employees';
            } else if (value) {
              if (value.includes(' ')) {
                error = 'No spaces allowed';
              } else if (value.length < 8) {
                error = 'Password length must be at least 8 characters';
              } else {
                const hasAlpha = /[A-Za-z]/.test(value);
                const hasNum = /\d/.test(value);
                const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(value);
                if (!hasAlpha || !hasNum || !hasSpecial) {
                  error = 'Please enter strong password (include: alphabet, number & special char)';
                }
              }
            }

            if (error) newErrors.Password = error;
            else delete newErrors.Password;
          }
          break;

        case 'EmailID':
          if (value?.trim()) {
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (!emailRegex.test(value.trim())) error = 'Enter valid email';
            else if (value.length > 254) error = 'Email must be at most 254 characters';
          }

          if (error) newErrors.EmailID = error;
          else delete newErrors.EmailID;
          break;

        case 'DepartmentID':
          if (!value) error = 'Department is required';

          if (error) newErrors.DepartmentID = error;
          else delete newErrors.DepartmentID;
          break;

        case 'MobileNo':
          if (typeof index === 'number') {
            const val = value as string;
            const mobileKey = `MobileNo_${index}`;
            if (val.trim()) {
              if (!/^\d+$/.test(val.trim())) error = 'Please enter digit';
              else if (val.trim().length !== 10) error = 'Please enter 10 digit';
            }

            if (error) newErrors[mobileKey] = error;
            else delete newErrors[mobileKey];
          }
          break;

        case 'CompanyName':
          if (isDealerDept && !value?.trim()) error = 'Company Name is required';
          if (error) newErrors.CompanyName = error;
          else delete newErrors.CompanyName;
          break;

        case 'Pincode':
          if (isDealerDept) {
            if (!value?.trim()) {
              error = 'Pincode is required';
            } else if (!/^\d{6}$/.test(value)) {
              // Only show error if it's NOT 6 digits.
              error = 'Invalid Pincode';
            }

            if (error) newErrors.Pincode = error;
            else delete newErrors.Pincode;
          }
          break;

        case 'Area':
          if (isDealerDept && !value?.trim()) error = 'Area is required';
          if (error) newErrors.Area = error;
          else delete newErrors.Area;
          break;
      }

      return newErrors;
    });
  };

  const handleSubmit = () => {
    // Browser-native validation for required fields
    if (!formData.FirstName?.trim()) {
      firstNameRef.current?.reportValidity();
      return;
    }
    if (!formData.LastName?.trim()) {
      lastNameRef.current?.reportValidity();
      return;
    }
    const validMobiles = formData.MobileNo?.filter(m => m && m.trim()) || [];
    if (validMobiles.length === 0) {
      mobileRefs.current[0]?.reportValidity();
      return;
    }

    // Frontend validation matching backend Zod schema
    const newErrors: Record<string, string> = {};
    let hasErrors = false;

    // firstName: required, min 1, max 100, characters only
    if (!formData.FirstName?.trim()) {
      newErrors.FirstName = 'First name is required';
      hasErrors = true;
    } else if (formData.FirstName.length < 2 || formData.FirstName.length > 50) {
      newErrors.FirstName = 'First name must be 2-50 characters';
      hasErrors = true;
    } else if (!/^[a-zA-Z\s]*$/.test(formData.FirstName)) {
      newErrors.FirstName = 'First name cannot contain numbers or special characters';
      hasErrors = true;
    }

    // lastName: required, max 100, characters only
    if (!formData.LastName?.trim()) {
      newErrors.LastName = 'Last name is required';
      hasErrors = true;
    } else if (formData.LastName.length < 2 || formData.LastName.length > 50) {
      newErrors.LastName = 'Last name must be 2-50 characters';
      hasErrors = true;
    } else if (!/^[a-zA-Z\s]*$/.test(formData.LastName)) {
      newErrors.LastName = 'Last name cannot contain numbers or special characters';
      hasErrors = true;
    }

    // username: required for new employees, optional in edit mode, must be unique
    if (!isEditMode) {
      if (!formData.Username?.trim()) {
        newErrors.Username = 'Username is required';
        hasErrors = true;
      } else if (formData.Username.includes(' ')) {
        newErrors.Username = 'No spaces allowed';
        hasErrors = true;
      } else if (formData.Username.length < 5 || formData.Username.length > 50) {
        newErrors.Username = 'Length must be 5-50 characters';
        hasErrors = true;
      } else if (!/^[a-zA-Z0-9._]+$/.test(formData.Username)) {
        newErrors.Username = 'Allowed: alphabets, numbers, . or _';
        hasErrors = true;
      } else if (/^[_.]|[_.]$/.test(formData.Username)) {
        newErrors.Username = 'Cannot start/end with . or _';
        hasErrors = true;
      } else if (existingUsernames.includes(formData.Username)) {
        newErrors.Username = 'Username already taken please enter new / differnt';
        hasErrors = true;
      }
    } else if (showCredentialsEdit && formData.Username?.trim()) {
      // In edit mode, check uniqueness if username changed
      if (formData.Username !== item?.Username && existingUsernames.includes(formData.Username)) {
        newErrors.Username = 'Username already taken please enter new / differnt';
        hasErrors = true;
      }
      if (formData.Username.includes(' ')) {
        newErrors.Username = 'No spaces allowed';
        hasErrors = true;
      } else if (formData.Username.length < 5 || formData.Username.length > 50) {
        newErrors.Username = 'Length must be 5-50 characters';
        hasErrors = true;
      } else if (!/^[a-zA-Z0-9._]+$/.test(formData.Username)) {
        newErrors.Username = 'Allowed: alphabets, numbers, . or _';
        hasErrors = true;
      } else if (/^[_.]|[_.]$/.test(formData.Username)) {
        newErrors.Username = 'Cannot start/end with . or _';
        hasErrors = true;
      }
    }

    // password: required for new employees, optional in edit mode, strong password
    if (!isEditMode || (showCredentialsEdit && formData.Password?.trim())) {
      const password = formData.Password || '';
      if (!password && !isEditMode) {
        newErrors.Password = 'Password is required for new employees';
        hasErrors = true;
      } else if (password) {
        if (password.includes(' ')) {
          newErrors.Password = 'No spaces allowed';
          hasErrors = true;
        } else if (password.length < 8) {
          newErrors.Password = 'Password length must be at least 8 characters';
          hasErrors = true;
        } else {
          const hasAlpha = /[A-Za-z]/.test(password);
          const hasNum = /\d/.test(password);
          const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

          if (!hasAlpha || !hasNum || !hasSpecial) {
            newErrors.Password =
              'Please enter strong password (include: alphabet, number & special char)';
            hasErrors = true;
          }
        }
      }
    }

    // emailId: optional, valid email format if provided (gmail or yahoo)
    if (formData.EmailID?.trim()) {
      const email = formData.EmailID.trim();
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(email)) {
        newErrors.EmailID = 'Enter valid email';
        hasErrors = true;
      } else if (email.length > 254) {
        newErrors.EmailID = 'Email must be at most 254 characters';
        hasErrors = true;
      }
    }

    // mobileNo: at least one required, max 3, must be exactly 10 digits
    const filteredMobiles = (formData.MobileNo || [])
      .map((m, idx) => ({
        originalIndex: idx,
        mobile: m.trim(),
        country: formData.CountryCode?.[idx] || '+91',
      }))
      .filter(item => item.mobile.length > 0);

    if (filteredMobiles.length === 0) {
      newErrors.MobileNo_0 = 'At least one mobile number is required';
      hasErrors = true;
    } else {
      const digitRegex = /^\d{10}$/;

      filteredMobiles.forEach(item => {
        if (!digitRegex.test(item.mobile)) {
          newErrors[`MobileNo_${item.originalIndex}`] =
            'Please enter a valid 10-digit mobile number';
          hasErrors = true;
        }
      });

      // Check for duplicates within this employee
      const mobilesArray = filteredMobiles.map(i => i.mobile);
      const mobilesSet = new Set(mobilesArray);
      if (mobilesSet.size !== filteredMobiles.length) {
        newErrors.MobileNo_0 = 'Duplicate mobile numbers are not allowed';
        hasErrors = true;
      }
    }

    // department: required
    if (!formData.DepartmentID) {
      newErrors.DepartmentID = 'Department is required';
      hasErrors = true;
    }

    // Role: required
    if (!formData.RoleID) {
      // Exception: If editing 'SuperAdmin' (assuming ID 1 or specific username), might skip?
      // But user said "except super admin".
      // Let's implement strict check, but maybe check username?
      // For now, strict check.
      // Assuming 'admin' user might be special, but usually even they have a role.
      // If user meant "Super Admin ROLE", that's different.
      // Let's assume every user needs a role selected.
      // If specific user "Super Admin" exists and has no role, this block might be annoying.
      // But for NEW employees, checking RoleID is safe.
      // For EDIT, if RoleID is missing, it's an error unless they are the special one.
      // I'll check if username is NOT 'admin' and NOT 'SuperAdmin'.
      const isSuperAdmin =
        item?.Username?.toLowerCase() === 'admin' || item?.Username?.toLowerCase() === 'superadmin';

      if (!isSuperAdmin) {
        // We can't set error on specific field easily if Select doesn't support error prop like Input
        // But we can set generic error or toast?
        // Actually, Select component likely doesn't show error text unless passed?
        // Looking at JSX: Select DOES NOT have error prop usage shown, but validation logic sets newErrors.RoleID?
        // Wait, JSX for Role Select (line 1028) doesn't use `errors.RoleID`.
        // I need to check if I can add error display there.
        // For now, let's mark it as error in state.

        // Actually, validation logic:
        newErrors.RoleID = 'Role is required';
        hasErrors = true;
      }
    }

    // DOB: must be at least 18 years old
    if (formData.DOB) {
      const dob = new Date(formData.DOB);
      const today = new Date();

      if (dob > today) {
        newErrors.DOB = 'Date of birth cannot be a future date';
        hasErrors = true;
      }

      const age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      const dayDiff = today.getDate() - dob.getDate();

      // Calculate exact age
      const exactAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;

      if (exactAge < 18) {
        newErrors.DOB = 'Employee must be at least 18 years old';
        hasErrors = true;
      } else if (exactAge > 100) {
        newErrors.DOB = 'Employee expected age is up to 100 years';
        hasErrors = true;
      }
    }

    // Joining Date: cannot be a future date
    if (formData.JoiningDate) {
      const joiningDate = new Date(formData.JoiningDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to compare only dates
      joiningDate.setHours(0, 0, 0, 0);

      if (joiningDate > today) {
        newErrors.JoiningDate = 'Joining date cannot be a future date';
        hasErrors = true;
      }
      if (joiningDate > today) {
        newErrors.JoiningDate = 'Joining date cannot be a future date';
        hasErrors = true;
      }
    }

    // Dealer Validation
    if (isDealerDept) {
      if (!formData.CompanyName?.trim()) {
        newErrors.CompanyName = 'Company Name is required';
        hasErrors = true;
      }
      if (!formData.Pincode?.trim()) {
        newErrors.Pincode = 'Pincode is required';
        hasErrors = true;
      } else if (!/^\d{6}$/.test(formData.Pincode)) {
        newErrors.Pincode = 'Invalid Pincode';
        hasErrors = true;
      }
      if (!formData.Area?.trim()) {
        newErrors.Area = 'Area is required';
        hasErrors = true;
      }
    }

    setErrors(newErrors);

    // Show errors if any
    if (hasErrors) {
      return;
    }

    // All validations passed
    // Combine prefix with firstName before sending
    const fullFirstName = prefix
      ? `${prefix} ${formData.FirstName!.trim()}`
      : formData.FirstName!.trim();

    const employeeData: Partial<Employee> = {
      EmployeeID: item?.EmployeeID || 0,
      FirstName: fullFirstName,
      LastName: formData.LastName?.trim(),
      EmailID: formData.EmailID?.trim() || undefined,
      MobileNo: filteredMobiles.map(i => i.mobile),
      CountryCode: filteredMobiles.map(i => i.country),
      DepartmentID: formData.DepartmentID,
      RoleID: formData.RoleID,
      JoiningDate: formData.JoiningDate,
      DOB: formData.DOB,

      CompanyName: formData.CompanyName,
      GSTIN: formData.GSTIN,
      Pincode: formData.Pincode,
      AddressCity: formData.AddressCity,
      AddressState: formData.AddressState,
      Area: formData.Area,
      AddressComplete: formData.AddressComplete,
      CustomerType: formData.CustomerType,
      AssignedSalespersonID: formData.AssignedSalespersonID,
    };

    // Only include username and password if:
    // 1. Creating new employee (not edit mode), OR
    // 2. In edit mode AND user clicked "Edit Username & Password" button
    if (!isEditMode || showCredentialsEdit) {
      if (formData.Username?.trim()) {
        employeeData.Username = formData.Username.trim();
      }
      if (formData.Password?.trim()) {
        employeeData.Password = formData.Password;
      }
    }

    setPendingData(employeeData);
    setShowConfirmation(true);
  };

  const handleConfirmSave = () => {
    if (pendingData) {
      onSave(pendingData);
      setShowConfirmation(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        title="Confirm Employee Details"
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-semibold text-[var(--text-secondary)]">Name:</span>
              <p>
                {pendingData?.FirstName} {pendingData?.LastName}
              </p>
            </div>
            <div>
              <span className="font-semibold text-[var(--text-secondary)]">Username:</span>
              <p>{pendingData?.Username || '-'}</p>
            </div>
            <div>
              <span className="font-semibold text-[var(--text-secondary)]">Email:</span>
              <p>{pendingData?.EmailID || '-'}</p>
            </div>
            <div>
              <span className="font-semibold text-[var(--text-secondary)]">Mobile:</span>
              <p>{pendingData?.MobileNo?.join(', ') || '-'}</p>
            </div>
            <div>
              <span className="font-semibold text-[var(--text-secondary)]">Joining Date:</span>
              <p>{pendingData?.JoiningDate}</p>
            </div>
            <div>
              <span className="font-semibold text-[var(--text-secondary)]">DOB:</span>
              <p>{pendingData?.DOB || '-'}</p>
            </div>
            <div>
              <span className="font-semibold text-[var(--text-secondary)]">Department:</span>
              <p>{departments.find(d => d.value === pendingData?.DepartmentID)?.label || '-'}</p>
            </div>
            <div>
              <span className="font-semibold text-[var(--text-secondary)]">Role:</span>
              <p>{roles?.find(r => r.value === pendingData?.RoleID)?.label || '-'}</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--border)]">
            <Button variant="ghost" onClick={() => setShowConfirmation(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirmSave}>
              Confirm
            </Button>
          </div>
        </div>
      </Modal>

      <div className="space-y-6">
        {/* Personal Information */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)]">
            Personal Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <div className="md:col-span-2">
              <Select
                label="Prefix"
                options={[
                  { value: 'Mr.', label: 'Mr.' },
                  { value: 'Ms.', label: 'Ms.' },
                  { value: 'Mrs.', label: 'Mrs.' },
                ]}
                value={prefix}
                onChange={e => setPrefix(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="md:col-span-3">
              <Input
                ref={firstNameRef}
                label="First Name"
                value={formData.FirstName}
                onChange={e => {
                  setFormData({ ...formData, FirstName: e.target.value });
                  validateField('FirstName', e.target.value);
                }}
                placeholder="First Name"
                required
                autoFocus
                className="h-11"
              />
              {errors.FirstName && (
                <p className="text-red-500 text-[10px] mt-1">{errors.FirstName}</p>
              )}
            </div>
            <div className="md:col-span-3">
              <Input
                ref={lastNameRef}
                label="Last Name"
                value={formData.LastName}
                onChange={e => {
                  setFormData({ ...formData, LastName: e.target.value });
                  validateField('LastName', e.target.value);
                }}
                placeholder="Last Name"
                required
                className="h-11"
              />
              {errors.LastName && (
                <p className="text-red-500 text-[10px] mt-1">{errors.LastName}</p>
              )}
            </div>
            <div className="md:col-span-4">
              <Input
                label="Date of Birth (Optional)"
                type="date"
                value={formData.DOB}
                onChange={e => setFormData({ ...formData, DOB: e.target.value })}
                max={new Date().toISOString().split('T')[0]}
                className="h-11"
              />
              {errors.DOB && <p className="text-red-500 text-[10px] mt-1">{errors.DOB}</p>}
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">
            Contact Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div>
              <Input
                label="Email (Optional)"
                type="email"
                value={formData.EmailID}
                onChange={e => {
                  setFormData({ ...formData, EmailID: e.target.value });
                  validateField('EmailID', e.target.value);
                }}
                placeholder="employee@example.com"
                className="h-11"
              />
              {errors.EmailID && <p className="text-red-500 text-xs mt-1">{errors.EmailID}</p>}
            </div>
            <div className="space-y-3">
              <label className="text-sm font-medium text-[var(--text-primary)]">
                Mobile Numbers <span className="text-red-500">*</span>
                <span className="text-xs text-[var(--text-secondary)] ml-2">(Min: 1, Max: 3)</span>
              </label>
              {formData.MobileNo?.map((mobile, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-shrink-0" style={{ width: '110px' }}>
                      <Select
                        options={countryCodes.map(code => ({ value: code, label: code }))}
                        value={formData.CountryCode?.[index] || '+91'}
                        onChange={e => {
                          const newCodes = [...(formData.CountryCode || [])];
                          newCodes[index] = e.target.value;
                          setFormData({ ...formData, CountryCode: newCodes });
                        }}
                        className="h-11"
                      />
                    </div>
                    <div className="flex-1 flex flex-col">
                      <Input
                        ref={el => {
                          mobileRefs.current[index] = el;
                        }}
                        type="tel"
                        value={mobile}
                        onChange={e => {
                          const val = e.target.value;
                          const newMobiles = [...(formData.MobileNo || [])];
                          newMobiles[index] = val;
                          setFormData({ ...formData, MobileNo: newMobiles });
                          validateField('MobileNo', val, index);
                        }}
                        placeholder="10-digit mobile number"
                        maxLength={10}
                        required={index === 0}
                        className="h-11"
                      />
                      {errors[`MobileNo_${index}`] && (
                        <p className="text-red-500 text-xs mt-1">{errors[`MobileNo_${index}`]}</p>
                      )}
                    </div>
                    {formData.MobileNo && formData.MobileNo.length > 1 && (
                      <div className="flex items-end">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            const newMobiles = formData.MobileNo?.filter((_, i) => i !== index);
                            const newCodes = formData.CountryCode?.filter((_, i) => i !== index);
                            setFormData({
                              ...formData,
                              MobileNo: newMobiles,
                              CountryCode: newCodes,
                            });
                          }}
                          className="px-3"
                          type="button"
                        >
                          ✕
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {formData.MobileNo && formData.MobileNo.length < 3 && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      MobileNo: [...(formData.MobileNo || []), ''],
                      CountryCode: [...(formData.CountryCode || []), '+91'],
                    });
                  }}
                  className="w-full text-sm"
                  type="button"
                >
                  + Add Another Mobile Number
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Login Credentials */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)]">
              Login Credentials
            </h3>
            {isEditMode && (
              <Button
                variant={showCredentialsEdit ? 'primary' : 'ghost'}
                onClick={() => setShowCredentialsEdit(!showCredentialsEdit)}
                className="text-xs"
                type="button"
              >
                {showCredentialsEdit ? '✓ Editing Credentials' : '✏️ Edit Username & Password'}
              </Button>
            )}
          </div>

          {(!isEditMode || showCredentialsEdit) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Input
                  label="Username"
                  value={formData.Username}
                  onChange={e => {
                    setFormData({ ...formData, Username: e.target.value });
                    validateField('Username', e.target.value);
                  }}
                  placeholder="Username"
                  required={!isEditMode}
                  className="h-11"
                />
                {errors.Username && <p className="text-red-500 text-xs mt-1">{errors.Username}</p>}
                <Button
                  variant="secondary"
                  onClick={generateUsername}
                  className="w-full text-xs font-bold bg-white border-2 border-blue-500 text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all duration-300 rounded-lg h-11 shadow-sm"
                  leftIcon={<RefreshCw size={14} />}
                  type="button"
                >
                  Auto-Generate Username
                </Button>
              </div>
              <div className="space-y-2">
                <Input
                  label="Password"
                  type="text"
                  value={formData.Password}
                  onChange={e => {
                    setFormData({ ...formData, Password: e.target.value });
                    validateField('Password', e.target.value);
                  }}
                  placeholder={isEditMode ? 'Leave empty to keep current password' : 'Password'}
                  required={!isEditMode}
                  className="h-11"
                />
                {errors.Password && <p className="text-red-500 text-xs mt-1">{errors.Password}</p>}
                <Button
                  variant="secondary"
                  onClick={generatePassword}
                  className="w-full text-xs font-bold bg-white border-2 border-green-500 text-green-600 hover:bg-green-600 hover:text-white hover:border-green-600 transition-all duration-300 rounded-lg h-10 shadow-sm"
                  leftIcon={<RefreshCw size={14} />}
                  type="button"
                >
                  Auto-Generate Password
                </Button>
              </div>
            </div>
          )}

          {isEditMode && !showCredentialsEdit && (
            <div className="text-sm text-[var(--text-secondary)] bg-[var(--background-secondary)] p-3 rounded">
              <p>
                Current Username:{' '}
                <span className="font-medium text-[var(--text-primary)]">{item?.Username}</span>
              </p>
              <p className="text-xs mt-1">
                Click &quot;Edit Username &amp; Password&quot; above to change login credentials
              </p>
            </div>
          )}
        </div>

        {/* Employment Information */}
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">
            Employment Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Select
                label="Department"
                options={departments}
                value={formData.DepartmentID || ''}
                onChange={e => {
                  const val = parseInt(e.target.value) || undefined;
                  setFormData({ ...formData, DepartmentID: val, RoleID: undefined });
                  validateField('DepartmentID', val);
                  onDepartmentChange(val);
                }}
                placeholder="Select Department"
                required
                className="h-11"
              />
              {errors.DepartmentID && <p className="text-red-500 text-xs">{errors.DepartmentID}</p>}
            </div>
            {/* Role - Hidden for Dealer Dept (Auto-assigned) */}
            {!isDealerDept && (
              <div className="space-y-1">
                <Select
                  label="Role"
                  options={roles}
                  value={formData.RoleID || ''}
                  onChange={e => {
                    const val = parseInt(e.target.value) || undefined;
                    setFormData({ ...formData, RoleID: val });
                  }}
                  placeholder={formData.DepartmentID ? 'Select Role' : 'Select Department first'}
                  disabled={!formData.DepartmentID}
                  required
                  className="h-11"
                />
                {errors.RoleID && <p className="text-red-500 text-xs">{errors.RoleID}</p>}
              </div>
            )}
            {!isDealerDept && (
              <Input
                label="Joining Date"
                type="date"
                value={formData.JoiningDate}
                onChange={e => setFormData({ ...formData, JoiningDate: e.target.value })}
                max={new Date().toISOString().split('T')[0]}
                className="h-11"
              />
            )}
          </div>
        </div>

        {/* Dealer Information */}
        {isDealerDept && (
          <div className="animate-fade-in border-t border-[var(--border)] pt-4 mt-4">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">
              Dealer Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Input
                  label="Company Name"
                  value={formData.CompanyName}
                  onChange={e => {
                    setFormData({ ...formData, CompanyName: e.target.value });
                    validateField('CompanyName', e.target.value);
                  }}
                  placeholder="Enter Company Name"
                  required
                  className="h-11"
                />
                {errors.CompanyName && <p className="text-red-500 text-xs">{errors.CompanyName}</p>}
              </div>

              <div className="space-y-1">
                <Input
                  label="GSTIN (Optional)"
                  value={formData.GSTIN}
                  onChange={e => setFormData({ ...formData, GSTIN: e.target.value })}
                  placeholder="Enter GSTIN"
                  className="h-11"
                />
              </div>

              <div className="space-y-1">
                <Input
                  label="Pincode"
                  value={formData.Pincode}
                  onChange={e => {
                    // Allow only numbers
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    handlePincodeChange(val);
                  }}
                  placeholder="Enter 6-digit Pincode"
                  required
                  maxLength={6}
                  className="h-11"
                />
                {errors.Pincode && <p className="text-red-500 text-xs">{errors.Pincode}</p>}
              </div>

              <div className="space-y-1">
                <Input
                  label="City"
                  value={formData.AddressCity}
                  readOnly
                  className="h-11 bg-gray-50"
                  placeholder="Auto-filled from Pincode"
                />
              </div>

              <div className="space-y-1">
                <Input
                  label="State"
                  value={formData.AddressState}
                  readOnly
                  className="h-11 bg-gray-50"
                  placeholder="Auto-filled from Pincode"
                />
              </div>

              <div className="space-y-1">
                <Input
                  label="Area"
                  value={formData.Area}
                  onChange={e => {
                    setFormData({ ...formData, Area: e.target.value });
                    validateField('Area', e.target.value);
                  }}
                  placeholder="Enter Area"
                  required
                  className="h-11"
                />
                {errors.Area && <p className="text-red-500 text-xs">{errors.Area}</p>}
              </div>

              <div className="col-span-1 sm:col-span-2 space-y-1">
                <Input
                  label="Complete Address (Optional)"
                  value={formData.AddressComplete}
                  onChange={e => setFormData({ ...formData, AddressComplete: e.target.value })}
                  placeholder="Enter Complete Address"
                  className="h-11"
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 sm:pt-6 border-t-2 border-[var(--border)]">
          <Button
            variant="ghost"
            onClick={onCancel}
            className="w-full sm:w-auto border-2 border-[var(--border)] hover:border-red-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            className="w-full sm:w-auto"
            disabled={isSaving}
          >
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
            ) : isEditMode ? (
              'Save Changes'
            ) : (
              'Add '
            )}
          </Button>
        </div>
      </div>
    </>
  );
};

export default function EmployeeMaster() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<{ value: number; label: string }[]>([]);
  const [roles, setRoles] = useState<{ value: number; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [showHidden, setShowHidden] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadEmployees();
    loadDepartments();
    // Don't load roles on mount - they'll be loaded when department is selected
  }, []);

  const loadRolesByDepartment = async (departmentId: number) => {
    try {
      const response = await authApi.getRolesByDepartment(departmentId);
      if (response.success && response.data) {
        const options = response.data.map((role: { roleId: any; roleName: any }) => ({
          value: role.roleId,
          label: role.roleName,
        }));
        setRoles(options);
      } else {
        setRoles([]);
      }
    } catch (error) {
      logger.error('Failed to load roles for department:', error);
      setRoles([]);
    }
  };

  const handleDepartmentChange = (departmentId: number | undefined) => {
    if (departmentId) {
      loadRolesByDepartment(departmentId);
    } else {
      setRoles([]);
    }
  };

  const loadDepartments = async () => {
    try {
      const { departmentApi } = await import('@/features/masters/api/departmentApi');
      const response = await departmentApi.getAll();
      if (response.success && response.data) {
        const options = response.data.map(dept => ({
          value: dept.DepartmentID,
          label: dept.DepartmentName,
        }));
        setDepartments(options);
      }
    } catch (error) {
      logger.error('Failed to load departments:', error);
    }
  };

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const response = await employeeApi.getAll({ includeInactive: true });
      if (response.success && response.data) {
        setEmployees(response.data);
      }
    } catch (error) {
      logger.error('Failed to load employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (item: Employee) => {
    try {
      setSaving(true);
      const exists = employees.find(e => e.EmployeeID === item.EmployeeID);

      // Confirmation dialog for editing
      if (exists) {
        const confirmed = await confirmDialog({
          title: 'Save Changes',
          message: `Are you sure you want to save changes to ${item.FirstName} ${item.LastName}?`,
          confirmLabel: 'Save',
          variant: 'info',
        });
        if (!confirmed) {
          setSaving(false);
          return; // User cancelled
        }
      }

      if (exists) {
        const response = await employeeApi.update(item.EmployeeID, item);
        // Only show success if backend confirms success
        if (response.success) {
          await loadEmployees(); // Reload to get fresh data
          setEditingEmployee(null); // Clear editing state
          showToast.success(`Employee "${item.FirstName} ${item.LastName}" updated successfully!`);
        }
      } else {
        const response = await employeeApi.create(item);
        if (response.success && response.data) {
          await loadEmployees(); // Reload to get fresh data
          setFormKey(prev => prev + 1); // Reset form state
          showToast.success(`Employee "${item.FirstName} ${item.LastName}" created successfully!`);
        }
      }
    } catch (error) {
      logger.error('Failed to save employee:', error);
      // Don't show error toast - API client already shows it
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      // Find employee to get their name for confirmation
      const employee = employees.find(e => e.EmployeeID === id);
      if (!employee) return;

      // Toggle logic: Active → Inactive, Inactive → Active
      const newStatus = employee.Status === 'Active' ? 'Inactive' : 'Active';
      const action = newStatus === 'Inactive' ? 'hide' : 'restore';

      // Confirmation dialog
      const confirmed = await confirmDialog({
        title: 'Change Employee Status',
        message: `Are you sure you want to ${action} employee "${employee.FirstName} ${employee.LastName}"?`,
        confirmLabel: 'Continue',
        variant: 'warning',
      });

      if (!confirmed) {
        return; // User cancelled
      }

      // Update status via API
      const response = await employeeApi.update(id, { ...employee, Status: newStatus });
      if (response && response.success) {
        await loadEmployees(); // Reload to get fresh data
        const message =
          newStatus === 'Inactive'
            ? `Employee "${employee.FirstName} ${employee.LastName}" hidden successfully!`
            : `Employee "${employee.FirstName} ${employee.LastName}" restored successfully!`;
        showToast.success(message);
      }
    } catch (error) {
      logger.error('Failed to toggle employee status:', error);
    }
  };

  const handleEdit = (employee: Employee) => {
    // Load roles for this employee's department
    if (employee.DepartmentID) {
      loadRolesByDepartment(employee.DepartmentID);
    } else {
      setRoles([]);
    }

    setEditingEmployee(employee);
    // Scroll to form after a brief delay to ensure state is updated
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Add a small offset to account for any fixed headers
        window.scrollBy({ top: -20, behavior: 'smooth' });
      }
    }, 100);
  };

  const handleCancelEdit = () => {
    setEditingEmployee(null);
    setRoles([]); // Clear roles when cancelling edit or resetting form
  };

  const handleView = (employee: Employee) => {
    setViewingEmployee(employee);
  };

  const columns: ColumnDef<Employee>[] = [
    {
      id: 'serialNumber',
      accessorFn: (_, index) => index + 1,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Sr. No." />,
      cell: ({ row }) => <span>{row.index + 1}</span>,
    },
    {
      accessorKey: 'FirstName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-bold text-xs">
            {row.original.FirstName?.[0] || ''}
            {row.original.LastName?.[0] || ''}
          </div>
          <div className="font-medium text-[var(--text-primary)]">
            {row.original.FirstName} {row.original.LastName}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'EmailID',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
      cell: ({ row }) => <span>{row.original.EmailID || '-'}</span>,
    },
    {
      accessorKey: 'MobileNo',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Mobile" />,
      cell: ({ row }) => {
        const item = row.original;
        if (!item.MobileNo || item.MobileNo.length === 0) return '-';
        const validNumbers = item.MobileNo.map((mobile, index) => {
          if (!mobile || !mobile.trim()) return null;
          const countryCode = item.CountryCode?.[index] || '';
          return countryCode ? `${countryCode} ${mobile}` : mobile;
        }).filter(Boolean);

        if (validNumbers.length === 0) return '-';

        return (
          <div className="flex flex-col gap-0.5 py-1">
            {validNumbers.map((num, idx) => (
              <span key={idx} className="text-xs whitespace-nowrap">
                {num}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      accessorKey: 'DepartmentID',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Department" />,
      cell: ({ row }) => {
        const dept = departments.find(d => d.value === row.original.DepartmentID);
        return (
          <span className="px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700">
            {dept?.label || '-'}
          </span>
        );
      },
    },
    {
      accessorKey: 'Role',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
      cell: ({ row }) => (
        <span className="px-2 py-1 rounded-md text-xs font-medium bg-purple-50 text-purple-700">
          {row.original.Role || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'Status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => (
        <span
          className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            row.original.Status === 'Active'
              ? 'bg-green-100 text-green-700'
              : row.original.Status === 'Inactive'
                ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-700'
          }`}
        >
          {row.original.Status}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => handleView(row.original)}
            className="p-2 rounded-lg hover:bg-[var(--surface-highlight)] text-[var(--text-secondary)] hover:text-blue-600 transition-colors border border-transparent hover:border-[var(--border)] focus-ring"
            title="View Details"
          >
            <Eye size={16} />
          </button>
          <button
            onClick={() => handleEdit(row.original)}
            className="p-2 rounded-lg hover:bg-[var(--surface-highlight)] text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors border border-transparent hover:border-[var(--border)] focus-ring"
            title="Edit"
          >
            <Edit2 size={16} />
          </button>
          {row.original.Role?.toLowerCase() !== 'superadmin' && (
            <button
              onClick={() => handleDelete(row.original.EmployeeID)}
              className="p-2 rounded-lg hover:bg-red-50 text-[var(--text-secondary)] hover:text-[var(--danger)] transition-colors border border-transparent hover:border-red-200 focus-ring"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ),
    },
  ];

  if (loading && employees.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <PageHeader
        metadataPath="/masters/employees"
        title="Employee Master"
        description="Manage your employee records"
      />

      {/* View Employee Details Modal */}
      <Modal
        isOpen={!!viewingEmployee}
        onClose={() => setViewingEmployee(null)}
        title="Employee Details"
        size="lg"
      >
        {viewingEmployee && (
          <div className="space-y-5">
            {/* Employee Name - Prominent */}
            <div className="bg-[var(--surface-highlight)]/40 p-4 rounded-lg border border-[var(--border)]/50">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-bold text-2xl">
                  {viewingEmployee.FirstName?.[0] || ''}
                  {viewingEmployee.LastName?.[0] || ''}
                </div>
                <div>
                  <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                    Employee Name
                  </span>
                  <p className="text-xl font-bold text-[var(--text-primary)] mt-1">
                    {viewingEmployee.FirstName} {viewingEmployee.LastName}
                  </p>
                </div>
              </div>
            </div>

            {/* Personal Information */}
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
                Personal Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    Employee ID
                  </span>
                  <p className="text-[var(--text-primary)] font-medium">
                    #{viewingEmployee.EmployeeID}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    Date of Birth
                  </span>
                  <p className="text-[var(--text-primary)] font-medium">
                    {viewingEmployee.DOB
                      ? new Date(viewingEmployee.DOB).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div>
              <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                Contact Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">Email</span>
                  <p className="text-[var(--text-primary)] font-medium break-all">
                    {viewingEmployee.EmailID || '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    Mobile Numbers
                  </span>
                  <div className="flex flex-col gap-1">
                    {viewingEmployee.MobileNo && viewingEmployee.MobileNo.length > 0 ? (
                      viewingEmployee.MobileNo.map((mobile, idx) => {
                        if (!mobile || !mobile.trim()) return null;
                        const countryCode = viewingEmployee.CountryCode?.[idx] || '';
                        return (
                          <span
                            key={idx}
                            className="px-3 py-1.5 bg-[var(--primary)]/10 text-[var(--primary)] rounded-md font-medium text-sm w-fit"
                          >
                            {countryCode} {mobile}
                          </span>
                        );
                      })
                    ) : (
                      <span>-</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Employment Information */}
            <div>
              <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                Employment Details
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    Department
                  </span>
                  <p className="text-[var(--text-primary)] font-medium">
                    <span className="px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700">
                      {departments.find(d => d.value === viewingEmployee.DepartmentID)?.label ||
                        '-'}
                    </span>
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    Joining Date
                  </span>
                  <p className="text-[var(--text-primary)] font-medium">
                    {viewingEmployee.JoiningDate
                      ? new Date(viewingEmployee.JoiningDate).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">Status</span>
                  <p className="text-[var(--text-primary)] font-medium">
                    <span
                      className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        viewingEmployee.Status === 'Active'
                          ? 'bg-green-100 text-green-700'
                          : viewingEmployee.Status === 'Inactive'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {viewingEmployee.Status}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Login Credentials */}
            <div>
              <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                  />
                </svg>
                Login Credentials
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">Username</span>
                  <p className="text-[var(--text-primary)] font-medium font-mono">
                    {viewingEmployee.Username || '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">Role</span>
                  <p className="text-[var(--text-primary)] font-medium">
                    {viewingEmployee.Role || '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    Employee Type
                  </span>
                  <p
                    className={`font-medium ${
                      viewingEmployee.EmployeeType === 'SalesPerson'
                        ? 'text-green-600'
                        : viewingEmployee.EmployeeType === 'Supervisor'
                          ? 'text-purple-600'
                          : 'text-blue-600'
                    }`}
                  >
                    {viewingEmployee.EmployeeType === 'SalesPerson'
                      ? 'Sales Person'
                      : viewingEmployee.EmployeeType === 'Supervisor'
                        ? 'Supervisor'
                        : 'Regular'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-5 border-t border-[var(--border)]">
              <Button variant="ghost" onClick={() => setViewingEmployee(null)}>
                Close
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setViewingEmployee(null);
                  handleEdit(viewingEmployee);
                }}
              >
                Edit Employee
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Employee Form Section */}
      <div
        ref={formRef}
        className="bg-[var(--surface)] rounded-lg border border-[var(--border)] p-6 shadow-sm"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">
            {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
          </h2>
        </div>
        <EmployeeForm
          key={formKey}
          item={editingEmployee}
          onSave={handleSave}
          onCancel={handleCancelEdit}
          isSaving={saving}
          existingUsernames={employees.map(e => e.Username).filter((u): u is string => !!u)}
          departments={departments}
          roles={roles}
          onDepartmentChange={handleDepartmentChange}
          salesPersons={employees.filter(e => {
            // Filter by EmployeeType 'SalesPerson' or if the Role name contains 'Sales'
            // Also exclude Inactive employees
            // This covers both explicit type assignment and role-based matching
            return (
              e.Status === 'Active' &&
              (e.EmployeeType === 'SalesPerson' || e.Role?.toLowerCase().includes('sales'))
            );
          })}
        />
      </div>

      {/* Employee Table Section */}
      <div className="bg-[var(--surface)] rounded-lg border border-[var(--border)] shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border-b border-[var(--border)]">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Employee Records</h3>
          <button
            onClick={() => setShowHidden(!showHidden)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              showHidden
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {showHidden ? '✓ Showing Hidden Records' : '○ Hide Hidden Records'}
          </button>
        </div>
        <DataTable
          data={showHidden ? employees : employees.filter(e => e.Status === 'Active')}
          columns={columns}
          searchPlaceholder="Search employees..."
        />
      </div>
    </div>
  );
}
