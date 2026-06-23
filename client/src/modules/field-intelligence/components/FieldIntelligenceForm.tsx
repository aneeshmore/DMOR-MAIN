import React, { useEffect, useCallback } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
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

interface FormProps {
  initialData?: FieldIntelligenceReport;
  onSubmit: (data: FieldIntelligenceReport) => void;
  isSubmitting: boolean;
}

const DEFAULT_VALUES: FieldIntelligenceReport = {
  visitDate: new Date().toISOString().slice(0, 10),
  visitType: 'Dealer Visit',
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
  executiveId: 0,
  competitors: [],
  followups: [],
  uploads: [],
};

export const FieldIntelligenceForm: React.FC<FormProps> = ({
  initialData,
  onSubmit,
  isSubmitting,
}) => {
  const navigate = useNavigate();

  // Resolve defaults – initialData > LocalStorage draft > fallback
  const getInitialValues = (): FieldIntelligenceReport => {
    if (initialData) return initialData;
    try {
      const draft = localStorage.getItem('fir_draft_report');
      if (draft) return JSON.parse(draft);
    } catch (e) {
      console.error('Failed parsing form draft', e);
    }
    return DEFAULT_VALUES;
  };

  const { register, control, handleSubmit, formState, setValue, watch, reset } =
    useForm<FieldIntelligenceReport>({
      defaultValues: getInitialValues(),
    });

  const watchedValues = watch();
  const visitType: string = useWatch({ control, name: 'visitType' }) || 'Dealer Visit';
  const sections = getSectionsForVisitType(visitType);

  // ── Autosave draft ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!initialData) {
      localStorage.setItem('fir_draft_report', JSON.stringify(watchedValues));
    }
  }, [watchedValues, initialData]);

  const clearDraft = () => {
    if (window.confirm('Clear this report draft?')) {
      localStorage.removeItem('fir_draft_report');
      reset(DEFAULT_VALUES);
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
    let errorCount = 0;
    const countErrors = (obj: any) => {
      if (!obj) return;
      if (obj.message) { errorCount++; return; }
      Object.values(obj).forEach(val => {
        if (val && typeof val === 'object') countErrors(val);
      });
    };
    countErrors(errors);

    if (errorCount > 0) {
      showToast.error(
        `${errorCount} required ${errorCount === 1 ? 'field is' : 'fields are'} missing.`
      );
    }

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
      const element = document.querySelector(
        `[name="${firstErrorPath}"], [name="${escapedPath}"]`
      ) as HTMLElement;
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => element.focus?.(), 300);
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit, onValidationError)}
      className="space-y-0 max-w-6xl mx-auto pb-28 relative"
    >
      {/* Form Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            {initialData ? `Edit Report: ${initialData.reportNumber}` : 'New Field Intelligence Report'}
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

          {/* ═══ LAYER 1: Quick Mandatory Entry ═══════════════════════════ */}
          <VisitDetailsSection
            register={register}
            formState={formState}
            setValue={setValue}
            control={control}
          />

          <CustomerDetailsSection
            register={register}
            formState={formState}
            setValue={setValue}
            watch={watch as any}
          />

          {/* ═══ MEDIA SECTION (between customer & visit details) ════════ */}
          <MediaUploadSection
            value={mediaFiles}
            onChange={handleMediaChange}
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
            <OrderPossibilitySection register={register} formState={formState} />
          )}

          {/* Action Items & Follow-ups – always shown */}
          <ActionItemsSection control={control} register={register} formState={formState} />

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

      {/* ── Sticky Bottom Action Bar ───────────────────────────────────── */}
      <div className="sticky bottom-4 left-0 right-0 bg-white border border-gray-200 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] flex justify-between items-center z-50 rounded-xl">
        <div className="flex items-center text-xs text-gray-500 font-medium">
          {!initialData ? (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Draft autosaved
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
          {!initialData && (
            <button
              type="button"
              onClick={() => {
                localStorage.setItem('fir_draft_report', JSON.stringify(watchedValues));
                showToast.success('Draft saved locally.');
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
