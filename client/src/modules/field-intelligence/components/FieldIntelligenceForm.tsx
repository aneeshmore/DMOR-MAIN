import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import MultiSearchableSelect from './shared/MultiSearchableSelect';
import { fieldIntelligenceApi } from '../services/fieldIntelligenceApi';
import { customerApi } from '@/features/masters/api/customerApi';
import { Customer } from '@/features/masters/types';
import { showToast } from '@/utils/toast';
import { FieldIntelligenceReport } from '../types/fieldIntelligence.types';
import VisitDetailsSection from './VisitDetailsSection';
import CustomerDetailsSection from './CustomerDetailsSection';
import MediaUploadSection, { MediaFile } from './MediaUploadSection';
import DynamicVisitSection from './DynamicVisitSection';
import SalesCommercialSection from './SalesCommercialSection';
import CompetitorAnalysisSection from './CompetitorAnalysisSection';
import DiscussionSummarySection from './DiscussionSummarySection';
import ActionItemsSection from './ActionItemsSection';
import OrderPossibilitySection from './OrderPossibilitySection';
import ManagementIntelligenceSection from './ManagementIntelligenceSection';
import PreviousVisitsPanel from './PreviousVisitsPanel';
import AISuggestionPanel from './AISuggestionPanel';
import { getSectionsForVisitType } from '../constants/firConstants';
import { useSidebar } from '@/contexts/SidebarContext';
import { cn } from '@/utils/cn';
import { useAuth } from '@/contexts/AuthContext';
import { confirmDialog } from '@/components/ui';

interface FormProps {
  initialData?: FieldIntelligenceReport;
  onSubmit: (data: FieldIntelligenceReport) => void;
  onSaveDraft?: (data: FieldIntelligenceReport) => void;
  isSubmitting: boolean;
}

const deserializeOrderStatus = (
  notes: string | undefined
): { cleanNotes: string; statuses: string[] } => {
  if (!notes) return { cleanNotes: '', statuses: [] };
  const markerRegex = /\n\n\[Order Status:\s*([^\]]*)\]$/s;
  const match = notes.match(markerRegex);
  if (match) {
    const statusesStr = match[1].trim();
    const statuses = statusesStr
      ? statusesStr
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [];
    const cleanNotes = notes.replace(markerRegex, '');
    return { cleanNotes, statuses };
  }
  return { cleanNotes: notes, statuses: [] };
};

const serializeOrderStatus = (notes: string | undefined, statuses: string[]): string => {
  const { cleanNotes } = deserializeOrderStatus(notes);
  if (statuses.length === 0) return cleanNotes;
  return `${cleanNotes.trim()}\n\n[Order Status: ${statuses.join(', ')}]`;
};

const getHighestBackendStatus = (selectedStatuses: string[]): string => {
  if (selectedStatuses.includes('Order Received')) return 'Won';
  if (selectedStatuses.includes('Quotation Sent')) return 'Proposal Sent';
  if (selectedStatuses.includes('Quotation Required')) return 'Proposal Sent';
  if (selectedStatuses.includes('Follow-up Required')) return 'Qualified';
  if (selectedStatuses.includes('Meeting Done')) return 'Qualified';
  if (selectedStatuses.includes('Customer Identified')) return 'Submitted';
  return 'Submitted'; // fallback
};

const DEFAULT_VALUES: FieldIntelligenceReport = {
  // ── Only these two have non-empty defaults ──────────────────────────────
  visitDate: new Date().toISOString().slice(0, 10), // today
  status: 'Draft',
  executiveId: 0,

  // ── Customer Details – all blank ────────────────────────────────────────
  customerName: '',
  customerId: undefined, // set when customer is selected from Customer Master
  contactPerson: '',
  designation: '',
  purchaseDecisionBy: '',
  businessCategory: '',
  gstNumber: '',
  countryCode: '+91',
  mobile: '',
  email: '',
  address: '',
  state: '',
  city: '',
  pinCode: '',

  // ── Visit Details – all blank ────────────────────────────────────────────
  visitType: 'Dealer Visit',
  visitPurpose: [], // string[] per type definition
  timeIn: '',
  timeOut: new Date().toTimeString().slice(0, 5),
  gpsLatitude: '',
  gpsLongitude: '',

  // ── Dynamic / multi-select fields – empty arrays ─────────────────────────
  paintRequirementTypes: [],
  surfaceTypes: [],
  applicationMethods: [],
  technicalChallenges: [],
  competitors: [],
  followups: [],
  uploads: [],
  sampleRequired: false,

  // ── Numeric scores – sensible defaults ───────────────────────────────────
  creditDays: 0,
  conversionProbability: 0,
  followupUrgencyScore: 5,
  dealerConfidence: 5,
  paymentReliability: 5,
  relationshipStrength: 5,
  technicalCapability: 5,
  longTermPotential: 5,
  potentialBusinessValue: 'N/A',
  expectedMonthlyBusiness: 'N/A',
};

const cleanPayloadForApi = (data: FieldIntelligenceReport): FieldIntelligenceReport => {
  const clean = { ...data };
  const isNA = (val: any) => typeof val === 'string' && val.trim().toUpperCase() === 'N/A';
  const isBlank = (val: any) =>
    val === undefined || val === null || (typeof val === 'string' && val.trim() === '');

  // 1. Optional text fields to map to "N/A" if blank
  const optionalTextFields = [
    'email',
    'gstNumber',
    'purchaseDecisionBy',
    'timeIn',
    'dealerStockLevel',
    'competitorDisplayPresent',
    'schemeDiscussionStatus',
    'hiddenOpportunity',
    'currentSupplier',
    'currentSystemUsed',
    'designation',
    'purchaseCycle',
    'importantObservations',
    'customerMood',
    'riskFactors',
    'immediateRequirement',
    'executiveRecommendation',
    'pinCode',
    'mobile',
    'whatsapp',
    'contactPerson',
  ];

  optionalTextFields.forEach(field => {
    const val = (clean as any)[field];
    if (isBlank(val)) {
      (clean as any)[field] = 'N/A';
    } else {
      (clean as any)[field] = String(val).trim();
    }
  });

  // 2. Optional numeric/date fields to map to "N/A" if blank.
  const optionalNumericFields = [
    'visitDuration',
    'outstandingAmount',
    'monthlyConsumption',
    'currentPurchaseRate',
    'expectedRate',
    'potentialBusinessValue',
    'expectedMonthlyBusiness',
    'expectedOrderQuantity',
    'estimatedArea',
    'creditDays',
    'conversionProbability',
  ];

  optionalNumericFields.forEach(field => {
    const val = (clean as any)[field];
    if (isBlank(val) || isNA(val)) {
      (clean as any)[field] = 'N/A';
    } else {
      const num = Number(val);
      (clean as any)[field] = isNaN(num) ? 'N/A' : num;
    }
  });

  // Expected Order Date field
  if (isBlank(clean.expectedOrderDate) || isNA(clean.expectedOrderDate)) {
    clean.expectedOrderDate = 'N/A';
  } else {
    if (clean.expectedOrderDate instanceof Date) {
      clean.expectedOrderDate = clean.expectedOrderDate.toISOString().slice(0, 10);
    } else {
      clean.expectedOrderDate = String(clean.expectedOrderDate).trim();
    }
  }

  // Multi-select arrays (remove N/A)
  const arrayFields = [
    'paintRequirementTypes',
    'surfaceTypes',
    'applicationMethods',
    'technicalChallenges',
    'visitPurpose',
  ];
  arrayFields.forEach(field => {
    const arr = (clean as any)[field];
    if (Array.isArray(arr)) {
      (clean as any)[field] = arr.filter(item => !isBlank(item) && !isNA(item));
    }
  });

  // Delete inline customer creation fields that do not belong to visit reports
  delete (clean as any).mobile2;
  delete (clean as any).mobile3;
  delete (clean as any).area;
  delete (clean as any).customerTypeId;
  delete (clean as any).salesPersonId;

  return clean;
};

const AILockedPanel: React.FC<{ currentVisits: number }> = ({ currentVisits }) => {
  const remaining = Math.max(0, 3 - currentVisits);
  return (
    <div className="card p-5 border border-amber-250 bg-amber-50/20 text-slate-700 space-y-4 rounded-2xl shadow-sm">
      <div className="flex items-center gap-2 pb-2 border-b border-amber-200/60 text-amber-850 font-bold text-sm">
        <span className="text-lg">🔒</span>
        <span>AI Intelligence Available After More History</span>
      </div>
      <p className="text-xs leading-relaxed text-slate-600">
        AI insights become available once this customer has at least 3 completed Smart CRM visits.
      </p>

      <div className="bg-white p-3 rounded-xl border border-amber-100/70 space-y-2">
        <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
          <span>Current Visits</span>
          <span className="font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
            {currentVisits}
          </span>
        </div>
        <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
          <span>Required Visits Remaining</span>
          <span className="font-bold text-amber-850">{remaining}</span>
        </div>
        <div className="text-[10px] text-gray-400 mt-1 font-semibold text-center border-t pt-1.5 border-dashed">
          AI Intelligence unlocks after 3 completed visits.
        </div>
      </div>

      <div className="text-xs text-slate-700 space-y-2 mt-2">
        <span className="font-bold text-[10px] uppercase text-slate-450 tracking-wider block">
          Complete {remaining} more visit{remaining > 1 ? 's' : ''} to enable:
        </span>
        <ul className="list-disc pl-4 space-y-1 text-slate-600 font-medium">
          <li>Customer Intelligence</li>
          <li>AI Decision Support</li>
          <li>Executive Summary</li>
          <li>Smart Recommendations</li>
          <li>AI Chat Assistant</li>
        </ul>
      </div>
    </div>
  );
};

export const FieldIntelligenceForm: React.FC<FormProps> = ({
  initialData,
  onSubmit,
  onSaveDraft,
  isSubmitting,
}) => {
  const navigate = useNavigate();
  const { isCollapsed } = useSidebar();
  const { user } = useAuth();
  const isDraftEdit = !!initialData;

  const executiveName = user ? `${user.FirstName} ${user.LastName || ''}`.trim() : 'N/A';

  const processedInitialData = useMemo(() => {
    if (!initialData) return undefined;
    const { cleanNotes } = deserializeOrderStatus(initialData.discussionNotes);
    return {
      ...initialData,
      visitType: initialData.visitType || 'Dealer Visit',
      potentialBusinessValue: initialData.potentialBusinessValue || 'N/A',
      expectedMonthlyBusiness: initialData.expectedMonthlyBusiness || 'N/A',
      discussionNotes: cleanNotes,
    };
  }, [initialData]);

  const {
    register,
    control,
    handleSubmit,
    formState,
    setValue,
    watch,
    reset,
    getValues,
    trigger,
    setError,
    clearErrors,
  } = useForm<FieldIntelligenceReport>({
    defaultValues: processedInitialData || DEFAULT_VALUES,
  });

  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [customerDashboard, setCustomerDashboard] = useState<any>(null);
  const [customerHistory, setCustomerHistory] = useState<any[]>([]);
  // isDraftMode=true disables required rules in all non-core sections so Save Draft
  // never triggers validation outside Customer Details + Visit Details.
  const [isDraftMode, setIsDraftMode] = useState(true);

  useEffect(() => {
    if (initialData) {
      const { statuses } = deserializeOrderStatus(initialData.discussionNotes);
      setSelectedStatuses(statuses);
    } else {
      setSelectedStatuses([]);
    }
  }, [initialData]);

  const watchedValues = watch();
  const customerId = watchedValues.customerId;

  // Auto-detect location on mount for new reports
  useEffect(() => {
    if (
      !initialData &&
      !watchedValues.gpsLatitude &&
      !watchedValues.gpsLongitude &&
      navigator.geolocation
    ) {
      navigator.geolocation.getCurrentPosition(
        position => {
          setValue('gpsLatitude', position.coords.latitude.toFixed(6), { shouldValidate: true });
          setValue('gpsLongitude', position.coords.longitude.toFixed(6), { shouldValidate: true });
        },
        error => {
          console.warn('Auto geolocation on mount failed:', error);
        }
      );
    }
  }, [initialData, setValue]);

  useEffect(() => {
    const fetchDashboard = async () => {
      if (customerId && !isNaN(Number(customerId))) {
        try {
          const result = await fieldIntelligenceApi.getCustomerDashboard(Number(customerId));
          setCustomerDashboard(result);
        } catch (err) {
          console.error('Failed to fetch customer dashboard details', err);
          setCustomerDashboard(null);
        }
      } else {
        setCustomerDashboard(null);
      }
    };
    fetchDashboard();
  }, [customerId]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (customerId && !isNaN(Number(customerId))) {
        try {
          const result = await fieldIntelligenceApi.getCustomerHistory(Number(customerId));
          setCustomerHistory(result || []);
        } catch (err) {
          console.error('Failed to fetch customer history', err);
          setCustomerHistory([]);
        }
      } else if (watchedValues.customerName && watchedValues.customerName.trim() !== '') {
        try {
          const result = await fieldIntelligenceApi.getCustomerUnlinkedHistory(
            watchedValues.customerName
          );
          setCustomerHistory(result || []);
        } catch (err) {
          console.error('Failed to fetch unlinked customer history', err);
          setCustomerHistory([]);
        }
      } else {
        setCustomerHistory([]);
      }
    };
    fetchHistory();
  }, [customerId, watchedValues.customerName]);

  const visitType: string = useWatch({ control, name: 'visitType' }) || 'Dealer Visit';
  const sections = getSectionsForVisitType(visitType);

  const isCustomerSelected = !!(
    customerId ||
    (watchedValues.customerName && watchedValues.customerName.trim() !== '')
  );
  const submittedVisitsCount = customerHistory.filter((v: any) => v.status === 'Submitted').length;
  const showAIIntelligence = submittedVisitsCount >= 3;
  const latestSubmittedVisit = useMemo(() => {
    return customerHistory.find((v: any) => v.status === 'Submitted');
  }, [customerHistory]);

  // NOTE: localStorage autosave has been removed.
  // Drafts are now persisted to the database via the "Save Draft" button.
  // The form will never pre-populate from localStorage on a fresh "New Report" open.

  const clearDraft = async () => {
    if (
      await confirmDialog({
        title: 'Clear Form',
        message: 'Clear all entered data and start fresh?',
        confirmLabel: 'Continue',
        variant: 'warning',
      })
    ) {
      reset(DEFAULT_VALUES);
      setSelectedStatuses([]);
    }
  };

  // Draft reopen priority checker on Customer Name Selection
  const handleCustomerChange = async (customerName: string, customerData?: Customer) => {
    if (!customerName) {
      reset(DEFAULT_VALUES);
      return;
    }

    try {
      // Step 1: Check whether a Draft report exists for that customer in the database
      const reports = await fieldIntelligenceApi.getAll({
        status: 'Draft',
        search: customerName,
      });

      // Filter to find exact case-insensitive match on customerName
      const exactDraft = reports.find(
        r => r.customerName && r.customerName.toLowerCase() === customerName.toLowerCase()
      );

      if (exactDraft && exactDraft.id) {
        // Load full draft details by ID
        const fullDraft = await fieldIntelligenceApi.getById(exactDraft.id);

        const { cleanNotes, statuses } = deserializeOrderStatus(fullDraft.discussionNotes);
        setSelectedStatuses(statuses);

        // Form expects YYYY-MM-DD. Guard against 'N/A'/invalid dates (drafts
        // often have no expectedOrderDate → 'N/A'); new Date('N/A').toISOString()
        // throws RangeError and would abort restoring the draft.
        const toDateInput = (v: unknown): string | undefined => {
          if (v === null || v === undefined || String(v).trim().toUpperCase() === 'N/A') {
            return undefined;
          }
          const d = new Date(v as string | number | Date);
          return isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
        };
        const normalizedVisitDate = toDateInput(fullDraft.visitDate);
        if (normalizedVisitDate) fullDraft.visitDate = normalizedVisitDate;
        fullDraft.expectedOrderDate = toDateInput(fullDraft.expectedOrderDate);

        fullDraft.visitType = fullDraft.visitType || 'Dealer Visit';
        fullDraft.potentialBusinessValue = fullDraft.potentialBusinessValue || 'N/A';
        fullDraft.expectedMonthlyBusiness = fullDraft.expectedMonthlyBusiness || 'N/A';
        fullDraft.discussionNotes = cleanNotes;

        // Load Draft data and populate entire form
        reset(fullDraft);
        showToast.success(`Loaded draft report for ${customerName}`);
      } else {
        // Draft does NOT exist - Load customer details only from Customer Master as fallback
        const newValues = {
          ...DEFAULT_VALUES,
          customerName: customerName,
        };

        if (customerData) {
          newValues.customerId = customerData.CustomerID;
          newValues.contactPerson = customerData.ContactPerson || '';
          newValues.mobile = customerData.MobileNo || '';
          newValues.email = customerData.EmailID || '';
          newValues.address = customerData.Address || '';
          newValues.state = customerData.State || '';
          newValues.city = customerData.Location || '';
          newValues.pinCode = customerData.Pincode || '';
          newValues.gstNumber = customerData.GSTNumber || '';

          if (customerData.CustomerTypeName) {
            const typeName = customerData.CustomerTypeName.toUpperCase();
            if (typeName === 'DEALER') {
              newValues.businessCategory = 'Dealer / Retailer';
            } else if (typeName === 'CONTRACTOR') {
              newValues.businessCategory = 'Project Contractor';
            } else if (typeName === 'INDUSTRIAL') {
              newValues.businessCategory = 'OEM / Manufacturing';
            } else if (typeName === 'BUILDER') {
              newValues.businessCategory = 'Construction & Real Estate';
            }
          }
        }

        reset(newValues);
      }
    } catch (err) {
      console.error('Failed to query customer drafts', err);
    }
  };

  // ── Media upload sync ───────────────────────────────────────────────────
  const mediaFiles: MediaFile[] = (watchedValues.uploads || []).map((u: any) => ({
    id: u.id || `upload_${Math.random()}`,
    fileType: u.fileType || 'Product Photo',
    fileName: u.fileName || '',
    filePath: u.filePath || '',
    mimeType: u.mimeType || 'image/jpeg',
    fileSize: u.fileSize || 0,
    previewUrl: u.previewUrl,
    uploadedAt: u.createdAt,
  }));

  const handleMediaChange = useCallback(
    (files: MediaFile[]) => {
      setValue(
        'uploads',
        files.map(f => ({
          id: f.id,
          fileType: f.fileType,
          fileName: f.fileName,
          filePath: f.filePath,
          mimeType: f.mimeType,
          fileSize: f.fileSize,
          createdAt: f.uploadedAt,
        })) as any
      );
    },
    [setValue]
  );

  // ── Validation error handler ────────────────────────────────────────────
  const onValidationError = (errors: any) => {
    const findFirstErrorKey = (obj: any, prefix = ''): string | null => {
      for (const key of Object.keys(obj)) {
        const val = obj[key];
        const path = prefix ? `${prefix}.${key}` : key;
        if (val?.message) return path;
        if (val && typeof val === 'object') {
          const nested = findFirstErrorKey(val, path);
          if (nested) return nested;
        }
      }
      return null;
    };

    const firstErrorPath = findFirstErrorKey(errors);
    if (firstErrorPath) {
      const escapedPath = firstErrorPath.replace(/\./g, '\\.');
      let element = document.querySelector(
        `[name="${firstErrorPath}"], [name="${escapedPath}"]`
      ) as HTMLElement;

      if (!element) {
        // Fallback for special fields like arrays or custom fields
        if (firstErrorPath === 'followups') {
          element = document.getElementById('followups-section') as HTMLElement;
        } else if (firstErrorPath === 'customerName') {
          element = document.querySelector('[name="customerId"]') as HTMLElement;
        }
      }

      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          if (
            element.tagName === 'INPUT' ||
            element.tagName === 'TEXTAREA' ||
            element.tagName === 'SELECT'
          ) {
            element.focus?.();
          } else {
            const focusable = element.querySelector('input, textarea, select') as HTMLElement;
            focusable?.focus?.();
          }
        }, 300);
      }
    }
  };

  const handleFormSubmit = async (data: FieldIntelligenceReport) => {
    try {
      // 1. If it's a new customer (no customerId but has customerName), create customer first in Customer Master
      if (!data.customerId && data.customerName) {
        const customerPayload = {
          CompanyName: data.customerName.trim(),
          ContactPerson: data.contactPerson?.trim() || '',
          MobileNo: data.mobile?.trim() || '',
          MobileNo2: data.mobile2?.trim() || '',
          MobileNo3: data.mobile3?.trim() || '',
          CountryCode: '+91',
          EmailID: data.email?.trim() || '',
          Location: data.city?.trim() || '',
          State: data.state?.trim() || '',
          Area: data.area?.trim() || '',
          Address: data.address?.trim() || '',
          Pincode: data.pinCode?.trim() || '',
          GSTNumber: data.gstNumber?.trim() || '',
          SalesPersonID: data.salesPersonId ? Number(data.salesPersonId) : undefined,
          CustomerTypeID: data.customerTypeId ? Number(data.customerTypeId) : undefined,
          IsActive: true,
          OpeningBalance:
            data.openingBalance !== undefined &&
            data.openingBalance !== null &&
            String(data.openingBalance).trim() !== '' &&
            !isNaN(Number(data.openingBalance))
              ? Number(data.openingBalance)
              : 0,
        };

        const custRes = await customerApi.create(customerPayload);

        if (!custRes.success || !custRes.data) {
          const errMsg = custRes.error || 'Failed to create customer';
          showToast.error(errMsg);

          // Map error to specific fields
          if (errMsg.toLowerCase().includes('mobile number')) {
            setError('mobile', { type: 'server', message: errMsg });
          } else if (
            errMsg.toLowerCase().includes('gst number') ||
            errMsg.toLowerCase().includes('gstin')
          ) {
            setError('gstNumber', { type: 'server', message: errMsg });
          } else if (
            errMsg.toLowerCase().includes('company name') ||
            errMsg.toLowerCase().includes('companyname')
          ) {
            setError('customerName', { type: 'server', message: errMsg });
          } else {
            setError('customerName', { type: 'server', message: errMsg });
          }

          setTimeout(() => {
            onValidationError(formState.errors);
          }, 100);
          return; // Abort submission
        }

        // Set the newly generated CustomerID and update name
        data.customerId = custRes.data.CustomerID;
        data.customerName = custRes.data.CompanyName;
        setValue('customerId', custRes.data.CustomerID);
        setValue('customerName', custRes.data.CompanyName);
        showToast.success(`Customer "${custRes.data.CompanyName}" created in Customer Master`);
      }

      // Check Order Status validation
      if (selectedStatuses.length === 0) {
        setError('status', {
          type: 'manual',
          message: 'At least one Order Status must be selected',
        });
        const element = document.getElementById('order-status-card');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      // 2. Clean payload and submit report
      const serializedNotes = serializeOrderStatus(data.discussionNotes, selectedStatuses);
      const mappedStatus = getHighestBackendStatus(selectedStatuses);

      // Drop empty competitor/follow-up cards (same rule as Save Draft) so a
      // lingering blank card cannot trigger a backend 400 on submit.
      const finalData = {
        ...data,
        competitors: (data.competitors || []).filter(
          c => String(c?.competitorName || '').trim() !== ''
        ),
        followups: (data.followups || []).filter(f => String(f?.followupDate || '').trim() !== ''),
        discussionNotes: serializedNotes,
        status: mappedStatus as any,
      };

      const cleanedData = cleanPayloadForApi(finalData);
      await onSubmit(cleanedData);
    } catch (err: any) {
      console.error('Submit error caught in form wrapper:', err);
      if (err.status === 400 && err.data?.errors) {
        err.data.errors.forEach((backendErr: any) => {
          setError(backendErr.field as any, {
            type: 'server',
            message: backendErr.message,
          });
        });
        setTimeout(() => {
          onValidationError(formState.errors);
        }, 100);
      } else {
        // Surface non-validation failures (e.g. 409 duplicate mobile/GST on
        // customer creation) instead of failing silently.
        const msg =
          err?.data?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to submit report';
        showToast.error(msg);
      }
    }
  };

  return (
    <form onSubmit={e => e.preventDefault()} className="space-y-6 max-w-6xl mx-auto pb-12 relative">
      {/* Form Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white p-4 rounded-xl shadow-sm border mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            {initialData
              ? `Edit Report: ${initialData.reportNumber}`
              : 'New SMART CRM Visit Report'}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {initialData
              ? 'Update field parameters and follow-up logs'
              : 'Draft autosaved · Complete in 2–4 minutes'}
          </p>
        </div>
        <div className="flex w-full sm:w-auto">
          {!initialData && (
            <button
              type="button"
              onClick={clearDraft}
              className="btn border border-gray-300 text-gray-700 hover:bg-gray-100 px-4 py-2 text-sm w-full sm:w-auto text-center min-h-[44px]"
            >
              Clear Draft
            </button>
          )}
        </div>
      </div>

      {/* ── 3-Layer Layout ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Left: Main Form Column */}
        <div className={cn('space-y-0', isCustomerSelected ? 'lg:col-span-3' : 'lg:col-span-4')}>
          <PreviousVisitsPanel history={customerHistory} />
          <CustomerDetailsSection
            register={register}
            formState={formState}
            setValue={setValue}
            watch={watch as any}
            onCustomerChange={handleCustomerChange}
            customerDashboard={customerDashboard}
            disabled={isDraftEdit}
            isDraftMode={isDraftMode}
          />

          {/* ═══ MEDIA SECTION (between customer & visit details) ════════ */}
          <MediaUploadSection
            value={mediaFiles}
            onChange={handleMediaChange}
            disabled={isDraftEdit}
            executiveName={executiveName}
            customerName={watchedValues.customerName}
            latitude={watchedValues.gpsLatitude ? String(watchedValues.gpsLatitude) : undefined}
            longitude={watchedValues.gpsLongitude ? String(watchedValues.gpsLongitude) : undefined}
            onLocationDetected={(lat, lon) => {
              setValue('gpsLatitude', lat, { shouldValidate: true });
              setValue('gpsLongitude', lon, { shouldValidate: true });
            }}
          />

          {/* ═══ LAYER 1: Quick Mandatory Entry ═══════════════════════════ */}
          <VisitDetailsSection
            register={register}
            formState={formState}
            setValue={setValue}
            control={control}
            disabled={isDraftEdit}
          />

          {/* ═══ LAYER 2: Dynamic Sections Per Visit Type ════════════════ */}
          <DynamicVisitSection
            register={register}
            formState={formState}
            setValue={setValue}
            control={control}
            watch={watch as any}
            isDraftMode={isDraftMode}
          />

          {/* Sales & Commercial – shown for most visit types */}
          {sections.showSalesCommercial && (
            <SalesCommercialSection
              register={register}
              formState={formState}
              setValue={setValue}
              watch={watch as any}
              control={control}
              isDraftMode={isDraftMode}
            />
          )}

          {/* Competitor Analysis */}
          {sections.showCompetitorAnalysis && (
            <CompetitorAnalysisSection
              control={control}
              register={register}
              formState={formState}
              setValue={setValue}
              watch={watch as any}
              isDraftMode={isDraftMode}
            />
          )}

          {/* Discussion Summary – always shown */}
          <DiscussionSummarySection
            register={register}
            formState={formState}
            setValue={setValue}
            control={control}
            watch={watch as any}
            isDraftMode={isDraftMode}
          />

          {/* Order Possibility */}
          {sections.showOrderPossibility && (
            <OrderPossibilitySection
              register={register}
              formState={formState}
              setValue={setValue}
              watch={watch as any}
              isDraftMode={isDraftMode}
            />
          )}

          {/* Action Items & Follow-ups – always shown */}
          <ActionItemsSection
            control={control}
            register={register}
            formState={formState}
            setValue={setValue}
            watch={watch as any}
            isDraftMode={isDraftMode}
          />

          {/* ═══ LAYER 3: Management Intelligence ════════════════════════ */}
          <ManagementIntelligenceSection
            register={register}
            formState={formState}
            setValue={setValue}
            control={control}
            watch={watch as any}
            isDraftMode={isDraftMode}
          />
        </div>

        {/* Right: Status + AI Panel (sticky) */}
        {isCustomerSelected && (
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-4">
              {/* Order Status */}
              <div id="order-status-card" className="card p-4">
                <MultiSearchableSelect
                  label="Order Status"
                  options={[
                    'Customer Identified',
                    'Meeting Done',
                    'Follow-up Required',
                    'Quotation Required',
                    'Quotation Sent',
                    'Order Received',
                  ]}
                  value={selectedStatuses}
                  onChange={v => {
                    setSelectedStatuses(v);
                    if (v.length > 0) {
                      setError('status', { type: 'manual', message: '' });
                    }
                  }}
                  placeholder="Select order statuses..."
                  required
                  error={formState.errors.status?.message}
                />
              </div>

              {/* AI Intelligence Panel / Locked Educational empty state */}
              {showAIIntelligence ? (
                <AISuggestionPanel
                  draftReport={latestSubmittedVisit}
                  customerHistory={customerHistory}
                />
              ) : (
                <AILockedPanel currentVisits={submittedVisitsCount} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Action Bar Positioned Statically at the End ────────────────────────────────────── */}
      <div className="mt-8 bg-white border border-gray-200 p-4 rounded-xl shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4 transition-all duration-200">
        <div className="flex items-center text-xs font-semibold">
          {Object.keys(formState.errors).length > 0 ? (
            <span className="flex items-center gap-1.5 text-red-650 bg-red-50 px-3 py-1.5 rounded-full border border-red-200 animate-pulse">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full" />
              Fill required fields to Submit (Draft can be saved anytime)
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-green-700 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
              <span className="w-2.5 h-2.5 bg-green-500 rounded-full" />
              Ready to submit
            </span>
          )}
        </div>
        <div className="flex flex-row gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => navigate('/operations/smart-crm')}
            className="btn border border-gray-300 text-gray-700 hover:bg-gray-100 px-3 sm:px-6 py-2.5 rounded-lg font-semibold text-xs sm:text-sm transition-all cursor-pointer flex-1 sm:flex-initial text-center min-h-[44px] whitespace-nowrap"
          >
            Cancel
          </button>
          {(!initialData || watchedValues.status === 'Draft') && (
            <button
              type="button"
              onClick={() => {
                const runSave = async () => {
                  // ── DRAFT VALIDATION PATH ─────────────────────────────────
                  // ONLY validates the strict minimum required fields from:
                  //   • Customer Details  → customerName (mandatory)
                  //   • Visit Details     → visitDate(*), timeOut(*),
                  //                         gpsLatitude(*), gpsLongitude(*),
                  //                         visitPurpose(*)
                  //
                  // Fields intentionally NOT validated for Draft:
                  //   • timeIn            → optional (no * in UI)
                  //   • visitType         → always has default 'Dealer Visit'
                  //   • contactPerson, mobile, address, state, city, pinCode,
                  //     designation, businessCategory, email, gstNumber, area,
                  //     customerTypeId, salesPersonId  → not required for Draft
                  //
                  // Every other section (Layer 2 dynamic, commercial, product,
                  // competitor, narrative, order, follow-ups, ratings, executive
                  // intel, AI, media) is COMPLETELY IGNORED for Draft.
                  // isDraftMode=true disables required rules in those sections.
                  // ──────────────────────────────────────────────────────────
                  setIsDraftMode(true);
                  // Let React re-render with isDraftMode=true so all non-core
                  // required rules are removed before we validate.
                  await new Promise(resolve => setTimeout(resolve, 0));
                  const v = getValues();
                  const draftMissing: Array<{
                    field: keyof FieldIntelligenceReport;
                    message: string;
                  }> = [];

                  // ── Customer Details required for Draft ───────────────────
                  if (!String(v.customerName || '').trim())
                    draftMissing.push({
                      field: 'customerName',
                      message: 'Customer Name is required to save a Draft',
                    });

                  // ── Visit Details required for Draft ──────────────────────
                  if (!v.visitDate)
                    draftMissing.push({ field: 'visitDate', message: 'Visit Date is required' });
                  // timeIn is intentionally OPTIONAL — NOT checked here
                  if (!v.timeOut)
                    draftMissing.push({ field: 'timeOut', message: 'Time Out is required' });
                  if (
                    !v.visitPurpose ||
                    (Array.isArray(v.visitPurpose) && v.visitPurpose.length === 0)
                  )
                    draftMissing.push({
                      field: 'visitPurpose',
                      message: 'Visit Purpose is required',
                    });
                  if (!v.gpsLatitude)
                    draftMissing.push({
                      field: 'gpsLatitude',
                      message: 'GPS Latitude is required',
                    });
                  if (!v.gpsLongitude)
                    draftMissing.push({
                      field: 'gpsLongitude',
                      message: 'GPS Longitude is required',
                    });

                  // Clear ALL prior errors first so stale validation from Submit
                  // or other sections can never leak into the Draft path.
                  clearErrors();
                  if (draftMissing.length > 0) {
                    draftMissing.forEach(m =>
                      setError(m.field as any, { type: 'required', message: m.message })
                    );
                    showToast.error(
                      'To save a draft, please complete the required Customer & Visit Details.'
                    );
                    const firstEl = document.getElementsByName(String(draftMissing[0].field))[0];
                    firstEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    return;
                  }
                  const currentValues = getValues();
                  const serializedNotes = serializeOrderStatus(
                    currentValues.discussionNotes,
                    selectedStatuses
                  );
                  // Drafts must never be blocked by incomplete OPTIONAL sections.
                  // Drop half-filled competitor / follow-up cards (the backend
                  // requires a name / date only when the card is present) so the
                  // Draft save can never fail on Competitor or Follow-up rules.
                  const draftSafeCompetitors = (currentValues.competitors || []).filter(
                    c => c && String(c.competitorName || '').trim()
                  );
                  const draftSafeFollowups = (currentValues.followups || []).filter(
                    f => f && String(f.followupDate || '').trim()
                  );
                  const dataToSave = cleanPayloadForApi({
                    ...currentValues,
                    competitors: draftSafeCompetitors,
                    followups: draftSafeFollowups,
                    discussionNotes: serializedNotes,
                    status: 'Draft' as const,
                  });
                  if (onSaveDraft) {
                    try {
                      await onSaveDraft(dataToSave);
                    } catch (err: any) {
                      console.error('Draft save error caught in form wrapper:', err);
                      if (err.status === 400 && err.data?.errors) {
                        err.data.errors.forEach((backendErr: any) => {
                          setError(backendErr.field as any, {
                            type: 'server',
                            message: backendErr.message,
                          });
                        });
                        setTimeout(() => {
                          onValidationError(formState.errors);
                        }, 100);
                      }
                    }
                  } else {
                    localStorage.setItem('fir_draft_report', JSON.stringify(watchedValues));
                    showToast.success('Draft saved locally.');
                  }
                };
                runSave();
              }}
              className="btn border border-[var(--primary)] text-[var(--primary)] hover:bg-blue-50 px-3 sm:px-6 py-2.5 rounded-lg font-semibold text-xs sm:text-sm transition-all cursor-pointer flex-1 sm:flex-initial text-center min-h-[44px] whitespace-nowrap"
            >
              Save Draft
            </button>
          )}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={async () => {
              // SUBMIT PATH: enable full validation, let React re-register the
              // now-required rules, then run the complete validation. Separate
              // from Save Draft, which keeps isDraftMode = true.
              setIsDraftMode(false);
              await new Promise(resolve => setTimeout(resolve, 0));
              handleSubmit(handleFormSubmit, onValidationError)();
            }}
            className="btn bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] px-3 sm:px-8 py-2.5 rounded-lg shadow-sm font-semibold text-xs sm:text-sm transition-all cursor-pointer disabled:opacity-60 flex-1 sm:flex-initial text-center min-h-[44px] whitespace-nowrap"
          >
            {isSubmitting ? 'Saving...' : initialData ? 'Save Changes' : 'Submit Report'}
          </button>
        </div>
      </div>
    </form>
  );
};
export default FieldIntelligenceForm;
