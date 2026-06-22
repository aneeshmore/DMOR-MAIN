import React, { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { showToast } from '@/utils/toast';
import { FieldIntelligenceReport } from '../types/fieldIntelligence.types';
import VisitDetailsSection from './VisitDetailsSection';
import CustomerDetailsSection from './CustomerDetailsSection';
import TechnicalDetailsSection from './TechnicalDetailsSection';
import SalesCommercialSection from './SalesCommercialSection';
import CompetitorAnalysisSection from './CompetitorAnalysisSection';
import DiscussionSummarySection from './DiscussionSummarySection';
import ActionItemsSection from './ActionItemsSection';
import PhotoUploadSection from './PhotoUploadSection';
import OrderPossibilitySection from './OrderPossibilitySection';
import ManagementIntelligenceSection from './ManagementIntelligenceSection';
import AISuggestionPanel from './AISuggestionPanel';

interface FormProps {
  initialData?: FieldIntelligenceReport;
  onSubmit: (data: FieldIntelligenceReport) => void;
  isSubmitting: boolean;
}

export const FieldIntelligenceForm: React.FC<FormProps> = ({
  initialData,
  onSubmit,
  isSubmitting,
}) => {
  const navigate = useNavigate();

  // Resolve defaults - either InitialData, or check LocalStorage, or fallback
  const getInitialValues = (): FieldIntelligenceReport => {
    if (initialData) return initialData;
    try {
      const draft = localStorage.getItem('fir_draft_report');
      if (draft) {
        return JSON.parse(draft);
      }
    } catch (e) {
      console.error('Failed parsing form draft', e);
    }

    // Fallback defaults
    return {
      visitDate: new Date().toISOString().slice(0, 10),
      visitType: 'New Visit',
      visitPurpose: [],
      customerName: '',
      paintRequirementTypes: [],
      surfaceTypes: [],
      applicationMethods: [],
      technicalChallenges: [],
      status: 'Draft',
      creditDays: 0,
      conversionProbability: 0,
      followupUrgencyScore: 5,
      dealerConfidence: 5,
      paymentReliability: 5,
      relationshipStrength: 5,
      technicalCapability: 5,
      longTermPotential: 5,
      executiveId: 0, // Will be overridden by backend with session ID
      competitors: [],
      followups: [],
      uploads: [],
    };
  };

  const { register, control, handleSubmit, formState, setValue, watch, reset } =
    useForm<FieldIntelligenceReport>({
      defaultValues: getInitialValues(),
    });

  const watchedValues = watch();

  // Autosave draft to localStorage on values change
  useEffect(() => {
    if (!initialData) {
      localStorage.setItem('fir_draft_report', JSON.stringify(watchedValues));
    }
  }, [watchedValues, initialData]);

  // Handle manual draft clear
  const clearDraft = () => {
    if (window.confirm('Are you sure you want to clear this report draft?')) {
      localStorage.removeItem('fir_draft_report');
      reset({
        visitDate: new Date().toISOString().slice(0, 10),
        visitType: 'New Visit',
        visitPurpose: [],
        customerName: '',
        paintRequirementTypes: [],
        surfaceTypes: [],
        applicationMethods: [],
        technicalChallenges: [],
        status: 'Draft',
        creditDays: 0,
        conversionProbability: 0,
        followupUrgencyScore: 5,
        dealerConfidence: 5,
        paymentReliability: 5,
        relationshipStrength: 5,
        technicalCapability: 5,
        longTermPotential: 5,
        competitors: [],
        followups: [],
        uploads: [],
      });
    }
  };

  const onValidationError = (errors: any) => {
    // Count total missing required fields
    let errorCount = 0;
    const countErrors = (obj: any) => {
      if (!obj) return;
      if (obj.message) {
        errorCount++;
        return;
      }
      Object.values(obj).forEach(val => {
        if (val && typeof val === 'object') {
          countErrors(val);
        }
      });
    };
    countErrors(errors);

    if (errorCount > 0) {
      showToast.error(
        `${errorCount} required ${errorCount === 1 ? 'field is' : 'fields are'} missing.`
      );
    }

    // Scroll to the first invalid field
    const findFirstErrorKey = (obj: any, prefix = ''): string | null => {
      for (const key of Object.keys(obj)) {
        const val = obj[key];
        const path = prefix ? `${prefix}.${key}` : key;
        if (val && val.message) {
          return path;
        }
        if (val && typeof val === 'object') {
          const nested = findFirstErrorKey(val, path);
          if (nested) return nested;
        }
      }
      return null;
    };

    const firstErrorPath = findFirstErrorKey(errors);
    if (firstErrorPath) {
      // Find element by name attribute or selector
      const escapedPath = firstErrorPath.replace(/\./g, '\\.');
      const element = document.querySelector(
        `[name="${firstErrorPath}"], [name="${escapedPath}"]`
      ) as HTMLElement;
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          element.focus?.();
        }, 300);
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit, onValidationError)}
      className="space-y-6 max-w-6xl mx-auto pb-24 relative"
    >
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            {initialData
              ? `Edit Report: ${initialData.reportNumber}`
              : 'Create Field Intelligence Report'}
          </h2>
          <p className="text-xs text-gray-500">
            {initialData
              ? 'Update field parameters and followup logs'
              : 'Fill in the customer visit report parameters. Draft autosaved.'}
          </p>
        </div>

        <div className="flex gap-2">
          {!initialData && (
            <button
              type="button"
              onClick={clearDraft}
              className="btn border border-gray-300 text-gray-700 hover:bg-gray-100 px-4 py-2"
            >
              Clear Draft
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <VisitDetailsSection register={register} formState={formState} setValue={setValue} />

          <CustomerDetailsSection register={register} formState={formState} />

          <TechnicalDetailsSection register={register} formState={formState} />

          <SalesCommercialSection register={register} formState={formState} />

          <CompetitorAnalysisSection control={control} register={register} formState={formState} />

          <DiscussionSummarySection register={register} formState={formState} />

          <OrderPossibilitySection register={register} formState={formState} />

          <ManagementIntelligenceSection register={register} formState={formState} />

          <ActionItemsSection control={control} register={register} formState={formState} />

          <PhotoUploadSection control={control} register={register} />
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-6">
            <div>
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

            <AISuggestionPanel draftReport={watchedValues} />
          </div>
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="sticky bottom-4 left-0 right-0 bg-white border border-gray-200 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] flex justify-between items-center z-50 rounded-xl">
        <div className="flex items-center text-xs text-gray-500 font-medium">
          {!initialData ? 'Draft report autosaved' : 'Editing Mode'}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate('/operations/field-intelligence')}
            className="btn border border-gray-300 text-gray-700 hover:bg-gray-100 px-6 py-2.5 rounded-lg font-semibold transition-all cursor-pointer"
          >
            Cancel
          </button>
          {!initialData && (
            <button
              type="button"
              onClick={() => {
                localStorage.setItem('fir_draft_report', JSON.stringify(watchedValues));
                alert('Draft saved to browser storage.');
              }}
              className="btn border border-[var(--primary)] text-[var(--primary)] hover:bg-blue-50 px-6 py-2.5 rounded-lg font-semibold transition-all cursor-pointer"
            >
              Save Draft
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] px-8 py-2.5 rounded-lg shadow-sm font-semibold transition-all cursor-pointer"
          >
            {isSubmitting ? 'Saving...' : initialData ? 'Save Changes' : 'Save Report'}
          </button>
        </div>
      </div>
    </form>
  );
};
export default FieldIntelligenceForm;
