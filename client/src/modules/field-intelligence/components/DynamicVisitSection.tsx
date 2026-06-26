import React, { useEffect } from 'react';
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
import MultiSearchableSelect from './shared/MultiSearchableSelect';
import VoiceInput from './shared/VoiceInput';

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
  const errors: any = formState.errors;
  const visitType: string = useWatch({ control, name: 'visitType' }) || 'New Visit';
  const sections = getSectionsForVisitType(visitType);

  const paintTypes = useWatch({ control, name: 'paintRequirementTypes' }) || [];
  const surfaceTypes = useWatch({ control, name: 'surfaceTypes' }) || [];
  const appMethods = useWatch({ control, name: 'applicationMethods' }) || [];
  const techChallenges = useWatch({ control, name: 'technicalChallenges' }) || [];

  // Register the custom components' fields on mount and when sections/visitType changes
  useEffect(() => {
    if (sections.showIndustrialFields) {
      register('currentSystemUsed' as any, { required: 'Current Coating System is required' });
    } else {
      register('currentSystemUsed' as any, { required: false });
    }

    if (sections.showArchitectFields) {
      register('requiredShade' as any, { required: 'Shade Preference is required' });
      register('requiredFinish' as any, { required: 'Required Finish is required' });
    } else {
      register('requiredShade' as any, { required: false });
      register('requiredFinish' as any, { required: false });
    }

    if (sections.showTechnicalFields) {
      register('technicalIssue' as any, { required: 'Technical Issue is required' });
    } else {
      register('technicalIssue' as any, { required: false });
    }

    if (sections.showGeneralTechnical) {
      register('paintRequirementTypes' as any, {
        validate: val =>
          !val || val.length === 0 ? 'At least one requirement type is required' : true,
      });
      register('surfaceTypes' as any, {
        validate: val =>
          !val || val.length === 0 ? 'At least one surface substrate is required' : true,
      });
      register('applicationMethods' as any, {
        validate: val =>
          !val || val.length === 0 ? 'At least one application method is required' : true,
      });
      register('technicalChallenges' as any, { validate: undefined });
    } else {
      register('paintRequirementTypes' as any, { validate: undefined });
      register('surfaceTypes' as any, { validate: undefined });
      register('applicationMethods' as any, { validate: undefined });
      register('technicalChallenges' as any, { validate: undefined });
    }
  }, [register, sections, visitType]);

  // ── Complaint Visit Fields ────────────────────────────────────────────────
  const ComplaintFields = () => (
    <div className="bg-red-50 border border-red-200 rounded-xl p-5">
      <h4 className="font-bold text-red-800 mb-4 flex items-center gap-2">
        <span>⚠️</span> Complaint Details
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.complaintType ? 'text-red-500' : 'text-gray-700'}`}
          >
            Complaint Type <span className="text-red-500">*</span>
          </label>
          <select
            className={`input ${errors.complaintType ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            {...register('complaintType' as any, {
              required: sections.showComplaintFields ? 'Complaint Type is required' : false,
            })}
          >
            <option value="">Select complaint type...</option>
            <option value="N/A">N/A</option>
            {COMPLAINT_TYPES.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {errors.complaintType && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.complaintType.message as string}
            </p>
          )}
        </div>

        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.complaintProduct ? 'text-red-500' : 'text-gray-700'}`}
          >
            Product Used <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className={`input ${errors.complaintProduct ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            placeholder="e.g. PU 2K Glossy – Shade 7035 or N/A"
            {...register('complaintProduct' as any, {
              required: sections.showComplaintFields ? 'Product Used is required' : false,
            })}
          />
          {errors.complaintProduct && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.complaintProduct.message as string}
            </p>
          )}
        </div>

        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.complaintBatchNumber ? 'text-red-500' : 'text-gray-700'}`}
          >
            Batch Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className={`input ${errors.complaintBatchNumber ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            placeholder="e.g. B24-0912-A or N/A"
            {...register('complaintBatchNumber' as any, {
              required: sections.showComplaintFields ? 'Batch Number is required' : false,
            })}
          />
          {errors.complaintBatchNumber && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.complaintBatchNumber.message as string}
            </p>
          )}
        </div>

        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.complaintResolutionStatus ? 'text-red-500' : 'text-gray-700'}`}
          >
            Resolution Status <span className="text-red-500">*</span>
          </label>
          <select
            className={`input ${errors.complaintResolutionStatus ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            {...register('complaintResolutionStatus' as any, {
              required: sections.showComplaintFields ? 'Resolution Status is required' : false,
            })}
          >
            <option value="">Select status...</option>
            <option value="N/A">N/A</option>
            {RESOLUTION_STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {errors.complaintResolutionStatus && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.complaintResolutionStatus.message as string}
            </p>
          )}
        </div>

        <div className="md:col-span-2">
          <VoiceInput
            label="Issue Description"
            value={watch('complaintDescription' as any) || ''}
            onChange={val => setValue('complaintDescription' as any, val, { shouldValidate: true })}
            placeholder="Describe the complaint in detail – surface condition, application method, failure mode..."
            rows={3}
            required={sections.showComplaintFields}
            error={errors.complaintDescription?.message}
            name="complaintDescription"
          />
          <input
            type="hidden"
            {...register('complaintDescription' as any, {
              required: sections.showComplaintFields ? 'Issue Description is required' : false,
            })}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.dealerStockLevel ? 'text-red-500' : 'text-gray-700'}`}
          >
            Stock Level
          </label>
          <select
            className={`input ${errors.dealerStockLevel ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            {...register('dealerStockLevel' as any, { required: false })}
          >
            <option value="">Select stock level...</option>
            <option value="N/A">N/A</option>
            <option value="Overstocked">Overstocked</option>
            <option value="Adequate">Adequate</option>
            <option value="Low Stock">Low Stock</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>
          {errors.dealerStockLevel && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.dealerStockLevel.message as string}
            </p>
          )}
        </div>

        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.competitorDisplayPresent ? 'text-red-500' : 'text-gray-700'}`}
          >
            Competitor Display Present?
          </label>
          <select
            className={`input ${errors.competitorDisplayPresent ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            {...register('competitorDisplayPresent' as any, { required: false })}
          >
            <option value="">Select competitor display...</option>
            <option value="N/A">N/A</option>
            <option value="No">No competitor display</option>
            <option value="Yes - Prominent">Yes – Prominent display</option>
            <option value="Yes - Minor">Yes – Minor display</option>
          </select>
          {errors.competitorDisplayPresent && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.competitorDisplayPresent.message as string}
            </p>
          )}
        </div>

        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.schemeDiscussionStatus ? 'text-red-500' : 'text-gray-700'}`}
          >
            Scheme Discussion
          </label>
          <select
            className={`input ${errors.schemeDiscussionStatus ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            {...register('schemeDiscussionStatus' as any, { required: false })}
          >
            <option value="">Select...</option>
            <option value="N/A">N/A</option>
            <option value="Discussed - Accepted">Discussed – Accepted</option>
            <option value="Discussed - Pending">Discussed – Pending Approval</option>
            <option value="Not Discussed">Not Discussed</option>
            <option value="Rejected">Rejected</option>
          </select>
          {errors.schemeDiscussionStatus && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.schemeDiscussionStatus.message as string}
            </p>
          )}
        </div>

        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.dealerOrderRequirement ? 'text-red-500' : 'text-gray-700'}`}
          >
            Order Requirement <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className={`input ${errors.dealerOrderRequirement ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            placeholder="e.g. 200L PU next week or N/A"
            {...register('dealerOrderRequirement' as any, {
              required: sections.showDealerFields ? 'Order Requirement is required' : false,
            })}
          />
          {errors.dealerOrderRequirement && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.dealerOrderRequirement.message as string}
            </p>
          )}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <SearchableSelect
            label="Current Coating System"
            options={['N/A', ...(PRODUCT_CATEGORIES as unknown as readonly string[])]}
            value={watch('currentSystemUsed') || ''}
            onChange={v => setValue('currentSystemUsed' as any, v, { shouldValidate: true })}
            placeholder="e.g. EP primer + PU topcoat"
            allowCustom
            required
            error={errors.currentSystemUsed?.message}
          />
        </div>

        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.industrialApprovalStatus ? 'text-red-500' : 'text-gray-700'}`}
          >
            Approval Status <span className="text-red-500">*</span>
          </label>
          <select
            className={`input ${errors.industrialApprovalStatus ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            {...register('industrialApprovalStatus' as any, {
              required: sections.showIndustrialFields ? 'Approval Status is required' : false,
            })}
          >
            <option value="">Select approval status...</option>
            <option value="N/A">N/A</option>
            <option value="Not Started">Not Started</option>
            <option value="Trial Requested">Trial Requested</option>
            <option value="Trial Running">Trial Running</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
          {errors.industrialApprovalStatus && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.industrialApprovalStatus.message as string}
            </p>
          )}
        </div>

        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.trialRequirement ? 'text-red-500' : 'text-gray-700'}`}
          >
            Trial Requirement <span className="text-red-500">*</span>
          </label>
          <select
            className={`input ${errors.trialRequirement ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            {...register('trialRequirement' as any, {
              required: sections.showIndustrialFields ? 'Trial Requirement is required' : false,
            })}
          >
            <option value="">Select...</option>
            <option value="N/A">N/A</option>
            <option value="Immediate Trial Required">Immediate Trial Required</option>
            <option value="Trial Approved - Pending Sample">Trial Approved – Pending Sample</option>
            <option value="Trial Completed">Trial Completed</option>
            <option value="No Trial Required">No Trial Required</option>
          </select>
          {errors.trialRequirement && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.trialRequirement.message as string}
            </p>
          )}
        </div>

        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.industrialProductionVolume ? 'text-red-500' : 'text-gray-700'}`}
          >
            Production Volume (units/month) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className={`input ${errors.industrialProductionVolume ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            placeholder="e.g. 500 tractors/month or N/A"
            {...register('industrialProductionVolume' as any, {
              required: sections.showIndustrialFields ? 'Production Volume is required' : false,
            })}
          />
          {errors.industrialProductionVolume && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.industrialProductionVolume.message as string}
            </p>
          )}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.architectProjectName ? 'text-red-500' : 'text-gray-700'}`}
          >
            Project Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className={`input ${errors.architectProjectName ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            placeholder="e.g. Nile Residency – Tower B or N/A"
            {...register('architectProjectName' as any, {
              required: sections.showArchitectFields ? 'Project Name is required' : false,
            })}
          />
          {errors.architectProjectName && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.architectProjectName.message as string}
            </p>
          )}
        </div>

        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.architectProjectScale ? 'text-red-500' : 'text-gray-700'}`}
          >
            Project Scale <span className="text-red-500">*</span>
          </label>
          <select
            className={`input ${errors.architectProjectScale ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            {...register('architectProjectScale' as any, {
              required: sections.showArchitectFields ? 'Project Scale is required' : false,
            })}
          >
            <option value="">Select scale...</option>
            <option value="N/A">N/A</option>
            <option value="Small (<10 units)">Small (&lt;10 units)</option>
            <option value="Medium (10-50 units)">Medium (10–50 units)</option>
            <option value="Large (50+ units)">Large (50+ units)</option>
            <option value="Commercial / Office">Commercial / Office</option>
            <option value="Industrial">Industrial</option>
          </select>
          {errors.architectProjectScale && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.architectProjectScale.message as string}
            </p>
          )}
        </div>

        <div>
          <SearchableSelect
            label="Shade Preference"
            options={['N/A', ...(SHADE_OPTIONS as unknown as readonly string[])]}
            value={watch('requiredShade') || ''}
            onChange={v => setValue('requiredShade', v, { shouldValidate: true })}
            placeholder="e.g. Off-White, RAL 9010, Custom"
            allowCustom
            required
            error={errors.requiredShade?.message}
          />
        </div>

        <div>
          <SearchableSelect
            label="Required Finish"
            options={['N/A', ...(FINISH_TYPES as unknown as readonly string[])]}
            value={watch('requiredFinish') || ''}
            onChange={v => setValue('requiredFinish', v, { shouldValidate: true })}
            placeholder="Glossy / Matt / Satin..."
            required
            error={errors.requiredFinish?.message}
          />
        </div>

        <div className="md:col-span-2">
          <label
            className={`block text-sm font-semibold mb-1 ${errors.architectProductRecommendation ? 'text-red-500' : 'text-gray-700'}`}
          >
            Product Recommendation Discussed <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className={`input ${errors.architectProductRecommendation ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            placeholder="e.g. Recommended Premium Acrylic Emulsion + Texture Finish or N/A"
            {...register('architectProductRecommendation' as any, {
              required: sections.showArchitectFields ? 'Product Recommendation is required' : false,
            })}
          />
          {errors.architectProductRecommendation && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.architectProductRecommendation.message as string}
            </p>
          )}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <SearchableSelect
            label="Technical Issue / Reason for Visit"
            options={['N/A', ...(TECHNICAL_CHALLENGES as unknown as readonly string[])]}
            value={watch('technicalIssue' as any) || ''}
            onChange={v => setValue('technicalIssue' as any, v, { shouldValidate: true })}
            placeholder="e.g. Adhesion Failure, Shade Mismatch"
            allowCustom
            required
            error={errors.technicalIssue?.message}
          />
        </div>

        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.productPerformanceObserved ? 'text-red-500' : 'text-gray-700'}`}
          >
            Product Performance Observed <span className="text-red-500">*</span>
          </label>
          <select
            className={`input ${errors.productPerformanceObserved ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            {...register('productPerformanceObserved' as any, {
              required: sections.showTechnicalFields ? 'Product Performance is required' : false,
            })}
          >
            <option value="">Select...</option>
            <option value="N/A">N/A</option>
            <option value="Excellent">Excellent</option>
            <option value="Good">Good</option>
            <option value="Acceptable">Acceptable</option>
            <option value="Poor">Poor – Action Required</option>
          </select>
          {errors.productPerformanceObserved && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.productPerformanceObserved.message as string}
            </p>
          )}
        </div>

        <div className="md:col-span-2">
          <VoiceInput
            label="Site Observations"
            value={watch('technicalSiteObservations' as any) || ''}
            onChange={val =>
              setValue('technicalSiteObservations' as any, val, { shouldValidate: true })
            }
            placeholder="Describe surface conditions, environment, application method observed... or N/A"
            rows={2}
            required={sections.showTechnicalFields}
            error={errors.technicalSiteObservations?.message}
            name="technicalSiteObservations"
          />
          <input
            type="hidden"
            {...register('technicalSiteObservations' as any, {
              required: sections.showTechnicalFields ? 'Site Observations are required' : false,
            })}
          />
        </div>

        <div className="md:col-span-2">
          <VoiceInput
            label="Corrective Actions Suggested"
            value={watch('technicalCorrectiveActions' as any) || ''}
            onChange={val =>
              setValue('technicalCorrectiveActions' as any, val, { shouldValidate: true })
            }
            placeholder="e.g. Apply zinc phosphate primer before epoxy, check DFT... or N/A"
            rows={2}
            required={sections.showTechnicalFields}
            error={errors.technicalCorrectiveActions?.message}
            name="technicalCorrectiveActions"
          />
          <input
            type="hidden"
            {...register('technicalCorrectiveActions' as any, {
              required: sections.showTechnicalFields ? 'Corrective Actions are required' : false,
            })}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.siteName ? 'text-red-500' : 'text-gray-700'}`}
          >
            Site / Project Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className={`input ${errors.siteName ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            placeholder="e.g. Brigade Cosmos Phase 2 or N/A"
            {...register('siteName' as any, {
              required: sections.showSiteFields ? 'Site Name is required' : false,
            })}
          />
          {errors.siteName && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.siteName.message as string}
            </p>
          )}
        </div>

        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.constructionStage ? 'text-red-500' : 'text-gray-700'}`}
          >
            Construction Stage <span className="text-red-500">*</span>
          </label>
          <select
            className={`input ${errors.constructionStage ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            {...register('constructionStage' as any, {
              required: sections.showSiteFields ? 'Construction Stage is required' : false,
            })}
          >
            <option value="">Select stage...</option>
            <option value="N/A">N/A</option>
            <option value="Foundation">Foundation</option>
            <option value="Structure">Structure</option>
            <option value="Plastering">Plastering</option>
            <option value="Putty Stage">Putty Stage</option>
            <option value="Painting Stage">Painting Stage</option>
            <option value="Finishing">Finishing</option>
            <option value="Completed">Completed</option>
          </select>
          {errors.constructionStage && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.constructionStage.message as string}
            </p>
          )}
        </div>

        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.contractorName ? 'text-red-500' : 'text-gray-700'}`}
          >
            Contractor / Applicator Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className={`input ${errors.contractorName ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            placeholder="e.g. Rajesh Construction or N/A"
            {...register('contractorName' as any, {
              required: sections.showSiteFields ? 'Contractor Name is required' : false,
            })}
          />
          {errors.contractorName && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.contractorName.message as string}
            </p>
          )}
        </div>

        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.estimatedArea ? 'text-red-500' : 'text-gray-700'}`}
          >
            Estimated Painting Area (sq.ft.) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className={`input ${errors.estimatedArea ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            placeholder="e.g. 15000 or N/A"
            {...register('estimatedArea' as any, {
              required: sections.showSiteFields ? 'Estimated Area is required' : false,
              validate: val => {
                if (!sections.showSiteFields) return true;
                return val === 'N/A' || !isNaN(Number(val)) || 'Must be a number or N/A';
              },
            })}
          />
          {errors.estimatedArea && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.estimatedArea.message as string}
            </p>
          )}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <VoiceInput
            label="Market Feedback Summary"
            value={watch('marketFeedbackNotes' as any) || ''}
            onChange={val => setValue('marketFeedbackNotes' as any, val, { shouldValidate: true })}
            placeholder="Describe pricing trends, competitor activities, new product launches, market demand... or N/A"
            rows={3}
            required={sections.showMarketFeedback}
            error={errors.marketFeedbackNotes?.message}
            name="marketFeedbackNotes"
          />
          <input
            type="hidden"
            {...register('marketFeedbackNotes' as any, {
              required: sections.showMarketFeedback ? 'Market Feedback is required' : false,
            })}
          />
        </div>

        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.marketPriceTrend ? 'text-red-500' : 'text-gray-700'}`}
          >
            Price Trend Observed <span className="text-red-500">*</span>
          </label>
          <select
            className={`input ${errors.marketPriceTrend ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            {...register('marketPriceTrend' as any, {
              required: sections.showMarketFeedback ? 'Price Trend is required' : false,
            })}
          >
            <option value="">Select trend...</option>
            <option value="N/A">N/A</option>
            <option value="Prices Rising">Prices Rising</option>
            <option value="Prices Stable">Prices Stable</option>
            <option value="Prices Falling">Prices Falling</option>
            <option value="Highly Competitive">Highly Competitive</option>
          </select>
          {errors.marketPriceTrend && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.marketPriceTrend.message as string}
            </p>
          )}
        </div>

        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.marketDemandTrend ? 'text-red-500' : 'text-gray-700'}`}
          >
            Demand Trend <span className="text-red-500">*</span>
          </label>
          <select
            className={`input ${errors.marketDemandTrend ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            {...register('marketDemandTrend' as any, {
              required: sections.showMarketFeedback ? 'Demand Trend is required' : false,
            })}
          >
            <option value="">Select trend...</option>
            <option value="N/A">N/A</option>
            <option value="High Demand">High Demand</option>
            <option value="Normal Demand">Normal Demand</option>
            <option value="Low Demand / Slow Season">Low Demand / Slow Season</option>
          </select>
          {errors.marketDemandTrend && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.marketDemandTrend.message as string}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  // ── General Technical Details ─────────────────────────────────────────────
  const GeneralTechnicalFields = () => (
    <div className="space-y-5">
      <MultiSearchableSelect
        label="Paint / Product Requirement Types"
        options={['N/A', ...PAINT_REQUIREMENT_TYPES]}
        value={paintTypes}
        onChange={v => setValue('paintRequirementTypes', v, { shouldValidate: true })}
        placeholder="Select or create requirement types..."
        allowCustom
        required
        error={errors.paintRequirementTypes?.message}
      />

      <MultiSearchableSelect
        label="Surface Substrates"
        options={['N/A', ...SURFACE_TYPES]}
        value={surfaceTypes}
        onChange={v => setValue('surfaceTypes', v, { shouldValidate: true })}
        placeholder="Select or create surface substrates..."
        allowCustom
        required
        error={errors.surfaceTypes?.message}
      />

      <MultiSearchableSelect
        label="Application Methods"
        options={['N/A', ...APPLICATION_METHODS]}
        value={appMethods}
        onChange={v => setValue('applicationMethods', v, { shouldValidate: true })}
        placeholder="Select or create application methods..."
        allowCustom
        required
        error={errors.applicationMethods?.message}
      />

      <MultiSearchableSelect
        label="Technical Challenges"
        options={['N/A', ...TECHNICAL_CHALLENGES]}
        value={techChallenges}
        onChange={v => setValue('technicalChallenges', v, { shouldValidate: true })}
        placeholder="Select or create technical challenges..."
        allowCustom
        required={false}
        error={errors.technicalChallenges?.message}
      />
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
      <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="bg-indigo-100 text-indigo-600 p-1.5 rounded-md flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </span>
          <span>{visitType} — Dynamic Fields</span>
        </span>
        <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full font-semibold whitespace-nowrap self-start sm:self-auto">
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
