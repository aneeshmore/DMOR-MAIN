import React from 'react';
import { UseFormRegister, FormState, UseFormSetValue, Control, useWatch } from 'react-hook-form';
import { FieldIntelligenceReport } from '../types/fieldIntelligence.types';
import {
  getSectionsForVisitType,
  PAINT_REQUIREMENT_TYPES,
  SURFACE_TYPES,
  APPLICATION_METHODS,
  TECHNICAL_CHALLENGES,
  COMPLAINT_TYPES,
  RESOLUTION_STATUS_OPTIONS,
  SHADE_OPTIONS,
  FINISH_TYPES,
  PRODUCT_CATEGORIES,
} from '../constants/firConstants';
import ChipSelector from './shared/ChipSelector';
import SearchableSelect from './shared/SearchableSelect';

interface DynamicSectionProps {
  register: UseFormRegister<FieldIntelligenceReport>;
  formState: FormState<FieldIntelligenceReport>;
  setValue: UseFormSetValue<FieldIntelligenceReport>;
  control: Control<FieldIntelligenceReport>;
  watch: (name: keyof FieldIntelligenceReport) => any;
}

/**
 * DynamicVisitSection – renders only the fields relevant to the selected visit type.
 * This is the core of the 3-layer design: Layer 2 (Smart Dynamic Questions).
 */
export const DynamicVisitSection: React.FC<DynamicSectionProps> = ({
  register,
  formState,
  setValue,
  control,
  watch,
}) => {
  const { errors } = formState;
  const visitType: string = useWatch({ control, name: 'visitType' }) || 'New Visit';
  const sections = getSectionsForVisitType(visitType);

  const paintTypes = useWatch({ control, name: 'paintRequirementTypes' }) || [];
  const surfaceTypes = useWatch({ control, name: 'surfaceTypes' }) || [];
  const appMethods = useWatch({ control, name: 'applicationMethods' }) || [];
  const techChallenges = useWatch({ control, name: 'technicalChallenges' }) || [];

  // ── Complaint Visit Fields ────────────────────────────────────────────────
  const ComplaintFields = () => (
    <div className="bg-red-50 border border-red-200 rounded-xl p-5">
      <h4 className="font-bold text-red-800 mb-4 flex items-center gap-2">
        <span>⚠️</span> Complaint Details
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Complaint Type *
          </label>
          <select className="input" {...register('complaintType' as any)}>
            <option value="">Select complaint type...</option>
            {COMPLAINT_TYPES.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Product Used
          </label>
          <input
            type="text"
            className="input"
            placeholder="e.g. PU 2K Glossy – Shade 7035"
            {...register('complaintProduct' as any)}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Batch Number</label>
          <input
            type="text"
            className="input"
            placeholder="e.g. B24-0912-A"
            {...register('complaintBatchNumber' as any)}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Resolution Status
          </label>
          <select className="input" {...register('complaintResolutionStatus' as any)}>
            <option value="">Select status...</option>
            {RESOLUTION_STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Issue Description *
          </label>
          <textarea
            rows={3}
            className="input"
            placeholder="Describe the complaint in detail – surface condition, application method, failure mode..."
            {...register('complaintDescription' as any)}
          />
        </div>
      </div>
    </div>
  );

  // ── Dealer Visit Fields ───────────────────────────────────────────────────
  const DealerFields = () => (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
      <h4 className="font-bold text-blue-800 mb-4 flex items-center gap-2">
        <span>🏪</span> Dealer Intelligence
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Stock Level</label>
          <select className="input" {...register('dealerStockLevel' as any)}>
            <option value="">Select stock level...</option>
            <option value="Overstocked">Overstocked</option>
            <option value="Adequate">Adequate</option>
            <option value="Low Stock">Low Stock</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Competitor Display Present?
          </label>
          <select className="input" {...register('competitorDisplayPresent' as any)}>
            <option value="No">No competitor display</option>
            <option value="Yes - Prominent">Yes – Prominent display</option>
            <option value="Yes - Minor">Yes – Minor display</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Scheme Discussion
          </label>
          <select className="input" {...register('schemeDiscussionStatus' as any)}>
            <option value="">Select...</option>
            <option value="Discussed - Accepted">Discussed – Accepted</option>
            <option value="Discussed - Pending">Discussed – Pending Approval</option>
            <option value="Not Discussed">Not Discussed</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Order Requirement
          </label>
          <input
            type="text"
            className="input"
            placeholder="e.g. 200L PU next week"
            {...register('dealerOrderRequirement' as any)}
          />
        </div>
      </div>
    </div>
  );

  // ── Industrial Visit Fields ───────────────────────────────────────────────
  const IndustrialFields = () => (
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
      <h4 className="font-bold text-orange-800 mb-4 flex items-center gap-2">
        <span>🏭</span> Industrial Details
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Current Coating System
          </label>
          <SearchableSelect
            label=""
            options={PRODUCT_CATEGORIES as unknown as readonly string[]}
            value={watch('currentSystemUsed') || ''}
            onChange={v => setValue('currentSystemUsed' as any, v)}
            placeholder="e.g. EP primer + PU topcoat"
            allowCustom
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Approval Status
          </label>
          <select className="input" {...register('industrialApprovalStatus' as any)}>
            <option value="">Select approval status...</option>
            <option value="Not Started">Not Started</option>
            <option value="Trial Requested">Trial Requested</option>
            <option value="Trial Running">Trial Running</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Trial Requirement
          </label>
          <select className="input" {...register('trialRequirement' as any)}>
            <option value="">Select...</option>
            <option value="Immediate Trial Required">Immediate Trial Required</option>
            <option value="Trial Approved - Pending Sample">Trial Approved – Pending Sample</option>
            <option value="Trial Completed">Trial Completed</option>
            <option value="No Trial Required">No Trial Required</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Production Volume (units/month)
          </label>
          <input
            type="text"
            className="input"
            placeholder="e.g. 500 tractors/month"
            {...register('industrialProductionVolume' as any)}
          />
        </div>
      </div>
    </div>
  );

  // ── Architect Visit Fields ────────────────────────────────────────────────
  const ArchitectFields = () => (
    <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
      <h4 className="font-bold text-purple-800 mb-4 flex items-center gap-2">
        <span>🏗️</span> Project & Specification Details
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Project Name</label>
          <input
            type="text"
            className="input"
            placeholder="e.g. Nile Residency – Tower B"
            {...register('architectProjectName' as any)}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Project Scale</label>
          <select className="input" {...register('architectProjectScale' as any)}>
            <option value="">Select scale...</option>
            <option value="Small (<10 units)">Small (&lt;10 units)</option>
            <option value="Medium (10-50 units)">Medium (10–50 units)</option>
            <option value="Large (50+ units)">Large (50+ units)</option>
            <option value="Commercial / Office">Commercial / Office</option>
            <option value="Industrial">Industrial</option>
          </select>
        </div>

        <div>
          <SearchableSelect
            label="Shade Preference"
            options={SHADE_OPTIONS as unknown as readonly string[]}
            value={watch('requiredShade') || ''}
            onChange={v => setValue('requiredShade', v)}
            placeholder="e.g. Off-White, RAL 9010, Custom"
            allowCustom
          />
        </div>

        <div>
          <SearchableSelect
            label="Required Finish"
            options={FINISH_TYPES as unknown as readonly string[]}
            value={watch('requiredFinish') || ''}
            onChange={v => setValue('requiredFinish', v)}
            placeholder="Glossy / Matt / Satin..."
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Product Recommendation Discussed
          </label>
          <input
            type="text"
            className="input"
            placeholder="e.g. Recommended Premium Acrylic Emulsion + Texture Finish"
            {...register('architectProductRecommendation' as any)}
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-primary w-4 h-4"
              {...register('sampleGiven')}
            />
            Shade / Product Samples Provided
          </label>
        </div>
      </div>
    </div>
  );

  // ── Technical Visit Fields ────────────────────────────────────────────────
  const TechnicalFields = () => (
    <div className="bg-teal-50 border border-teal-200 rounded-xl p-5">
      <h4 className="font-bold text-teal-800 mb-4 flex items-center gap-2">
        <span>🔧</span> Technical Assessment
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <SearchableSelect
            label="Technical Issue / Reason for Visit"
            options={TECHNICAL_CHALLENGES as unknown as readonly string[]}
            value={watch('technicalIssue' as any) || ''}
            onChange={v => setValue('technicalIssue' as any, v)}
            placeholder="e.g. Adhesion Failure, Shade Mismatch"
            allowCustom
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Product Performance Observed
          </label>
          <select className="input" {...register('productPerformanceObserved' as any)}>
            <option value="">Select...</option>
            <option value="Excellent">Excellent</option>
            <option value="Good">Good</option>
            <option value="Acceptable">Acceptable</option>
            <option value="Poor">Poor – Action Required</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Site Observations
          </label>
          <textarea
            rows={2}
            className="input"
            placeholder="Describe surface conditions, environment, application method observed..."
            {...register('technicalSiteObservations' as any)}
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Corrective Actions Suggested
          </label>
          <textarea
            rows={2}
            className="input"
            placeholder="e.g. Apply zinc phosphate primer before epoxy, check DFT..."
            {...register('technicalCorrectiveActions' as any)}
          />
        </div>
      </div>
    </div>
  );

  // ── Site Visit Fields ─────────────────────────────────────────────────────
  const SiteFields = () => (
    <div className="bg-green-50 border border-green-200 rounded-xl p-5">
      <h4 className="font-bold text-green-800 mb-4 flex items-center gap-2">
        <span>🏗️</span> Site Information
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Site / Project Name
          </label>
          <input
            type="text"
            className="input"
            placeholder="e.g. Brigade Cosmos Phase 2"
            {...register('siteName' as any)}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Construction Stage
          </label>
          <select className="input" {...register('constructionStage' as any)}>
            <option value="">Select stage...</option>
            <option value="Foundation">Foundation</option>
            <option value="Structure">Structure</option>
            <option value="Plastering">Plastering</option>
            <option value="Putty Stage">Putty Stage</option>
            <option value="Painting Stage">Painting Stage</option>
            <option value="Finishing">Finishing</option>
            <option value="Completed">Completed</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Contractor / Applicator Name
          </label>
          <input
            type="text"
            className="input"
            placeholder="e.g. Rajesh Construction"
            {...register('contractorName' as any)}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Estimated Painting Area (sq.ft.)
          </label>
          <input
            type="number"
            className="input"
            placeholder="e.g. 15000"
            {...register('estimatedArea' as any)}
          />
        </div>
      </div>
    </div>
  );

  // ── Market Feedback Fields ────────────────────────────────────────────────
  const MarketFeedbackFields = () => (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
      <h4 className="font-bold text-yellow-800 mb-4 flex items-center gap-2">
        <span>📊</span> Market Intelligence
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Market Feedback Summary
          </label>
          <textarea
            rows={3}
            className="input"
            placeholder="Describe pricing trends, competitor activities, new product launches, market demand..."
            {...register('marketFeedbackNotes' as any)}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Price Trend Observed
          </label>
          <select className="input" {...register('marketPriceTrend' as any)}>
            <option value="">Select trend...</option>
            <option value="Prices Rising">Prices Rising</option>
            <option value="Prices Stable">Prices Stable</option>
            <option value="Prices Falling">Prices Falling</option>
            <option value="Highly Competitive">Highly Competitive</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Demand Trend
          </label>
          <select className="input" {...register('marketDemandTrend' as any)}>
            <option value="">Select trend...</option>
            <option value="High Demand">High Demand</option>
            <option value="Normal Demand">Normal Demand</option>
            <option value="Low Demand / Slow Season">Low Demand / Slow Season</option>
          </select>
        </div>
      </div>
    </div>
  );

  // ── General Technical Details ─────────────────────────────────────────────
  const GeneralTechnicalFields = () => (
    <div className="space-y-5">
      <ChipSelector
        label="Paint / Product Requirement Types"
        options={PAINT_REQUIREMENT_TYPES}
        value={paintTypes}
        onChange={v => setValue('paintRequirementTypes', v)}
      />

      <ChipSelector
        label="Surface Substrates"
        options={SURFACE_TYPES}
        value={surfaceTypes}
        onChange={v => setValue('surfaceTypes', v)}
      />

      <ChipSelector
        label="Application Methods"
        options={APPLICATION_METHODS}
        value={appMethods}
        onChange={v => setValue('applicationMethods', v)}
      />

      <ChipSelector
        label="Technical Challenges"
        options={TECHNICAL_CHALLENGES}
        value={techChallenges}
        onChange={v => setValue('technicalChallenges', v)}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        <SearchableSelect
          label="Required Shade / Code"
          options={SHADE_OPTIONS as unknown as readonly string[]}
          value={watch('requiredShade') || ''}
          onChange={v => setValue('requiredShade', v)}
          placeholder="RAL 7035 / Off-White / Custom"
          allowCustom
        />

        <SearchableSelect
          label="Required Finish"
          options={FINISH_TYPES as unknown as readonly string[]}
          value={watch('requiredFinish') || ''}
          onChange={v => setValue('requiredFinish', v)}
          placeholder="Glossy / Matt / Satin..."
        />
      </div>
    </div>
  );

  // Nothing to show for this visit type
  const hasAnythingToShow =
    sections.showComplaintFields ||
    sections.showDealerFields ||
    sections.showIndustrialFields ||
    sections.showArchitectFields ||
    sections.showTechnicalFields ||
    sections.showSiteFields ||
    sections.showMarketFeedback ||
    sections.showGeneralTechnical;

  if (!hasAnythingToShow) return null;

  return (
    <div className="card p-6 mb-6">
      <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2">
        <span className="bg-indigo-100 text-indigo-600 p-1.5 rounded-md">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        </span>
        {visitType} — Dynamic Fields
        <span className="ml-auto text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
          Layer 2 – Smart Form
        </span>
      </h3>

      <div className="space-y-5">
        {sections.showComplaintFields && <ComplaintFields />}
        {sections.showDealerFields && <DealerFields />}
        {sections.showIndustrialFields && <IndustrialFields />}
        {sections.showArchitectFields && <ArchitectFields />}
        {sections.showTechnicalFields && <TechnicalFields />}
        {sections.showSiteFields && <SiteFields />}
        {sections.showMarketFeedback && <MarketFeedbackFields />}
        {sections.showGeneralTechnical && <GeneralTechnicalFields />}
      </div>
    </div>
  );
};

export default DynamicVisitSection;
