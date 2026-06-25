import React, { useCallback } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
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
import AISuggestionPanel from './AISuggestionPanel';
import { getSectionsForVisitType } from '../constants/firConstants';
import { useSidebar } from '@/contexts/SidebarContext';
import { cn } from '@/utils/cn';

interface FormProps {
  initialData?: FieldIntelligenceReport;
  onSubmit: (data: FieldIntelligenceReport) => void;
  onSaveDraft?: (data: FieldIntelligenceReport) => void;
  isSubmitting: boolean;
}

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
  timeOut: '',
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

  // Format-dependent text fields
  const textFieldsToClear = [
    'email',
    'expectedOrderDate',
    'gpsLatitude',
    'gpsLongitude',
    'pinCode',
    'mobile',
    'gstNumber',
    'timeIn',
    'timeOut',
  ];
  textFieldsToClear.forEach(field => {
    if (isNA((clean as any)[field])) {
      (clean as any)[field] = undefined;
    }
  });

  // Numeric fields
  const numericFields = [
    'visitDuration',
    'monthlyConsumption',
    'currentPurchaseRate',
    'expectedRate',
    'outstandingAmount',
    'potentialBusinessValue',
    'expectedMonthlyBusiness',
    'expectedOrderQuantity',
    'estimatedArea',
  ];
  numericFields.forEach(field => {
    const val = (clean as any)[field];
    if (isNA(val)) {
      (clean as any)[field] = undefined;
    } else if (val !== undefined && val !== null && val !== '') {
      const num = Number(val);
      (clean as any)[field] = isNaN(num) ? undefined : num;
    }
  });

  const creditDaysVal = clean.creditDays as any;
  if (isNA(creditDaysVal)) {
    clean.creditDays = undefined;
  } else if (creditDaysVal !== undefined && creditDaysVal !== null && creditDaysVal !== '') {
    const num = Number(creditDaysVal);
    clean.creditDays = isNaN(num) ? undefined : num;
  }

  const convProbVal = clean.conversionProbability as any;
  if (isNA(convProbVal)) {
    clean.conversionProbability = undefined;
  } else if (convProbVal !== undefined && convProbVal !== null && convProbVal !== '') {
    const num = Number(convProbVal);
    clean.conversionProbability = isNaN(num) ? undefined : num;
  }

  // Dropdowns
  const dropdownFields = [
    'designation',
    'purchaseDecisionBy',
    'state',
    'city',
    'complaintType',
    'complaintResolutionStatus',
    'dealerStockLevel',
    'competitorDisplayPresent',
    'schemeDiscussionStatus',
    'industrialApprovalStatus',
    'trialRequirement',
    'architectProjectScale',
    'productPerformanceObserved',
    'constructionStage',
    'marketPriceTrend',
    'marketDemandTrend',
    'executiveRecommendation',
    'riskFactors',
    'requiredFinish',
    'currentSupplier',
  ];
  dropdownFields.forEach(field => {
    if (isNA((clean as any)[field])) {
      (clean as any)[field] = undefined;
    }
  });

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
      (clean as any)[field] = arr.filter(item => !isNA(item));
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

export const FieldIntelligenceForm: React.FC<FormProps> = ({
  initialData,
  onSubmit,
  onSaveDraft,
  isSubmitting,
}) => {
  const navigate = useNavigate();
  const { isCollapsed } = useSidebar();

  // For NEW reports: always start blank (DEFAULT_VALUES).
  // For EDIT reports: initialData is provided by the edit page.
  // Draft auto-loading happens ONLY when the user selects a customer (handleCustomerChange).
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
  } = useForm<FieldIntelligenceReport>({
    defaultValues: initialData
      ? {
          ...initialData,
          visitType: initialData.visitType || 'Dealer Visit',
          potentialBusinessValue: initialData.potentialBusinessValue || 'N/A',
          expectedMonthlyBusiness: initialData.expectedMonthlyBusiness || 'N/A',
        }
      : DEFAULT_VALUES,
  });

  const watchedValues = watch();
  const visitType: string = useWatch({ control, name: 'visitType' }) || 'Dealer Visit';
  const sections = getSectionsForVisitType(visitType);

  // NOTE: localStorage autosave has been removed.
  // Drafts are now persisted to the database via the "Save Draft" button.
  // The form will never pre-populate from localStorage on a fresh "New Report" open.

  const clearDraft = () => {
    if (window.confirm('Clear all entered data and start fresh?')) {
      reset(DEFAULT_VALUES);
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

        // Form expects date string format YYYY-MM-DD
        if (fullDraft.visitDate) {
          fullDraft.visitDate = new Date(fullDraft.visitDate).toISOString().slice(0, 10);
        }
        if (fullDraft.expectedOrderDate) {
          fullDraft.expectedOrderDate = new Date(fullDraft.expectedOrderDate)
            .toISOString()
            .slice(0, 10);
        }

        fullDraft.visitType = fullDraft.visitType || 'Dealer Visit';
        fullDraft.potentialBusinessValue = fullDraft.potentialBusinessValue || 'N/A';
        fullDraft.expectedMonthlyBusiness = fullDraft.expectedMonthlyBusiness || 'N/A';

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
          OpeningBalance: 0,
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

      // 2. Clean payload and submit report
      const cleanedData = cleanPayloadForApi(data);
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
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit, onValidationError)}
      className="space-y-0 max-w-6xl mx-auto pb-28 relative"
    >
      {/* Form Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border mb-4">
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
        <div className="flex gap-2">
          {!initialData && (
            <button
              type="button"
              onClick={clearDraft}
              className="btn border border-gray-300 text-gray-700 hover:bg-gray-100 px-4 py-2 text-sm"
            >
              Clear Draft
            </button>
          )}
        </div>
      </div>

      {/* ── 3-Layer Layout ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Left: Main Form Column */}
        <div className="lg:col-span-3 space-y-0">
          <CustomerDetailsSection
            register={register}
            formState={formState}
            setValue={setValue}
            watch={watch as any}
            onCustomerChange={handleCustomerChange}
          />

          {/* ═══ MEDIA SECTION (between customer & visit details) ════════ */}
          <MediaUploadSection value={mediaFiles} onChange={handleMediaChange} />

          {/* ═══ LAYER 1: Quick Mandatory Entry ═══════════════════════════ */}
          <VisitDetailsSection
            register={register}
            formState={formState}
            setValue={setValue}
            control={control}
          />

          {/* ═══ LAYER 2: Dynamic Sections Per Visit Type ════════════════ */}
          <DynamicVisitSection
            register={register}
            formState={formState}
            setValue={setValue}
            control={control}
            watch={watch as any}
          />

          {/* Sales & Commercial – shown for most visit types */}
          {sections.showSalesCommercial && (
            <SalesCommercialSection
              register={register}
              formState={formState}
              setValue={setValue}
              watch={watch as any}
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
            />
          )}

          {/* Discussion Summary – always shown */}
          <DiscussionSummarySection
            register={register}
            formState={formState}
            setValue={setValue}
            control={control}
            watch={watch as any}
          />

          {/* Order Possibility */}
          {sections.showOrderPossibility && (
            <OrderPossibilitySection
              register={register}
              formState={formState}
              setValue={setValue}
              watch={watch as any}
            />
          )}

          {/* Action Items & Follow-ups – always shown */}
          <ActionItemsSection
            control={control}
            register={register}
            formState={formState}
            setValue={setValue}
            watch={watch as any}
          />

          {/* ═══ LAYER 3: Management Intelligence ════════════════════════ */}
          <ManagementIntelligenceSection
            register={register}
            formState={formState}
            setValue={setValue}
            control={control}
            watch={watch as any}
          />
        </div>

        {/* Right: Status + AI Panel (sticky) */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-4">
            {/* Report Status */}
            <div className="card p-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Report Status *
              </label>
              <select className="input font-bold" {...register('status')}>
                <option value="Draft">Draft</option>
                <option value="Submitted">Submitted</option>
                <option value="Qualified">Qualified</option>
                <option value="Proposal Sent">Proposal Sent</option>
                <option value="Trial Running">Trial Running</option>
                <option value="Negotiation">Negotiation</option>
                <option value="Won">Won</option>
                <option value="Lost">Lost</option>
                <option value="Archived">Archived</option>
              </select>
            </div>

            {/* AI Intelligence Panel */}
            <AISuggestionPanel draftReport={watchedValues} />
          </div>
        </div>
      </div>

      {/* ── Fixed Bottom Action Bar ────────────────────────────────────── */}
      <div
        className={cn(
          'fixed bottom-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] flex justify-between items-center z-50 transition-all duration-300',
          'left-0 md:left-20',
          !isCollapsed && 'lg:left-72'
        )}
      >
        <div className="flex items-center text-xs text-gray-500 font-medium">
          {!initialData ? (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-amber-400 rounded-full" />
              Click &quot;Save Draft&quot; to preserve data
            </span>
          ) : (
            'Editing Mode'
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate('/operations/field-intelligence')}
            className="btn border border-gray-300 text-gray-700 hover:bg-gray-100 px-6 py-2.5 rounded-lg font-semibold transition-all cursor-pointer"
          >
            Cancel
          </button>
          {(!initialData || watchedValues.status === 'Draft') && (
            <button
              type="button"
              onClick={() => {
                const runSave = async () => {
                  const isValid = await trigger(['customerId', 'customerName']);
                  if (!isValid) {
                    onValidationError(formState.errors);
                    return;
                  }
                  const currentValues = getValues();
                  const dataToSave = cleanPayloadForApi({
                    ...currentValues,
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
              className="btn border border-[var(--primary)] text-[var(--primary)] hover:bg-blue-50 px-6 py-2.5 rounded-lg font-semibold transition-all cursor-pointer"
            >
              Save Draft
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] px-8 py-2.5 rounded-lg shadow-sm font-semibold transition-all cursor-pointer disabled:opacity-60"
          >
            {isSubmitting ? 'Saving...' : initialData ? 'Save Changes' : 'Submit Report'}
          </button>
        </div>
      </div>
    </form>
  );
};
export default FieldIntelligenceForm;
