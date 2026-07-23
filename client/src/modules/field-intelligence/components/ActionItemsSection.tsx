import React from 'react';
import {
  useFieldArray,
  Control,
  UseFormRegister,
  FormState,
  useWatch,
  UseFormSetValue,
} from 'react-hook-form';
import { FieldIntelligenceReport } from '../types/fieldIntelligence.types';
import VoiceInput from './shared/VoiceInput';
import { FOLLOWUP_ACTION_TYPES, FOLLOWUP_TYPES } from '../constants/firConstants';

interface SectionProps {
  control: Control<FieldIntelligenceReport>;
  register: UseFormRegister<FieldIntelligenceReport>;
  formState?: FormState<FieldIntelligenceReport>;
  setValue: UseFormSetValue<FieldIntelligenceReport>;
  watch: (name: any) => any;
  isDraftMode?: boolean;
}

export const ActionItemsSection: React.FC<SectionProps> = ({
  control,
  register,
  formState,
  setValue,
  watch,
  isDraftMode = false,
}) => {
  const req = (msg: string) => (isDraftMode ? false : msg) as string | false;
  const { errors } = formState || {};
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'followups',
  });

  const visitType = useWatch({ control, name: 'visitType' }) || '';
  const isFollowupVisitType = visitType === 'Customer Follow-up' || visitType === 'Follow-up Visit';

  React.useEffect(() => {
    register('followups', {
      validate: val => {
        if (isFollowupVisitType && (!val || val.length === 0)) {
          return 'At least one follow-up action is required';
        }
        return true;
      },
    });
  }, [register, isFollowupVisitType, isDraftMode]);

  return (
    <div id="followups-section" className="card p-6 mb-6">
      <div className="flex justify-between items-center mb-4 border-b pb-2">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <span className="bg-primary-100 text-primary-600 p-1.5 rounded-md">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
          </span>
          Immediate Action Items & Followups
        </h3>
        <button
          type="button"
          onClick={() =>
            append({
              followupDate: '',
              notes: '',
              status: 'Open',
              actionType: '',
              followupMode: '',
            })
          }
          className="btn bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] px-3 py-1.5 text-xs font-semibold"
        >
          + Add Action Item
        </button>
      </div>

      {errors?.followups && 'message' in errors.followups && (
        <p
          className="text-red-500 text-sm mb-4 font-semibold"
          style={{ color: 'red', fontSize: 'small', marginBottom: '16px' }}
        >
          {String((errors.followups as any).message)}
        </p>
      )}

      {fields.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">
          No followups added yet. Add follow-ups to ensure deal progression.
        </p>
      ) : (
        <div className="space-y-4">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end border p-3 rounded-lg bg-gray-50 relative"
            >
              <button
                type="button"
                onClick={() => remove(index)}
                className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                title="Remove Action"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>

              {(() => {
                const followupError = errors?.followups?.[index] as any;
                return (
                  <>
                    {/* Action Type */}
                    <div className="md:col-span-1">
                      <label
                        className={`block text-xs font-semibold mb-1 ${followupError?.actionType ? 'text-red-500' : 'text-gray-700'}`}
                      >
                        Action Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        className={`input text-xs py-1.5 ${followupError?.actionType ? 'border-red-500 focus:border-red-500 focus:ring-red-500 bg-red-50/10' : ''}`}
                        {...register(`followups.${index}.actionType` as const, {
                          required: req('Action Type is required'),
                        })}
                      >
                        <option value="">Select Action...</option>
                        {FOLLOWUP_ACTION_TYPES.map(type => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                      {followupError?.actionType && (
                        <p className="text-red-500 text-[10px] mt-1">
                          {followupError.actionType.message}
                        </p>
                      )}
                    </div>

                    {/* Follow-up Mode */}
                    <div className="md:col-span-1">
                      <label
                        className={`block text-xs font-semibold mb-1 ${followupError?.followupMode ? 'text-red-500' : 'text-gray-700'}`}
                      >
                        Follow-up Mode <span className="text-red-500">*</span>
                      </label>
                      <select
                        className={`input text-xs py-1.5 ${followupError?.followupMode ? 'border-red-500 focus:border-red-500 focus:ring-red-500 bg-red-50/10' : ''}`}
                        {...register(`followups.${index}.followupMode` as const, {
                          required: req('Follow-up Mode is required'),
                        })}
                      >
                        <option value="">Select Mode...</option>
                        {FOLLOWUP_TYPES.map(mode => (
                          <option key={mode} value={mode}>
                            {mode}
                          </option>
                        ))}
                      </select>
                      {followupError?.followupMode && (
                        <p className="text-red-500 text-[10px] mt-1">
                          {followupError.followupMode.message}
                        </p>
                      )}
                    </div>

                    {/* Follow-up Date */}
                    <div className="md:col-span-1">
                      <label
                        className={`block text-xs font-semibold mb-1 ${followupError?.followupDate ? 'text-red-500' : 'text-gray-700'}`}
                      >
                        Followup Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        className={`input text-xs py-1.5 ${followupError?.followupDate ? 'border-red-500 focus:border-red-500 focus:ring-red-500 bg-red-50/10' : ''}`}
                        {...register(`followups.${index}.followupDate` as const, {
                          required: req('Follow-up Date is required'),
                        })}
                      />
                      {followupError?.followupDate && (
                        <p
                          className="text-red-500 text-xs mt-1"
                          style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
                        >
                          {followupError.followupDate.message}
                        </p>
                      )}
                    </div>

                    {/* Notes (Voice Input spanning full width) */}
                    <div className="sm:col-span-2 lg:col-span-3 pr-6">
                      <VoiceInput
                        label="Task / Action Notes"
                        value={watch(`followups.${index}.notes`) || ''}
                        onChange={val =>
                          setValue(`followups.${index}.notes` as any, val, { shouldValidate: true })
                        }
                        placeholder="e.g. Call for rate negotiation or deliver PU sample"
                        rows={1}
                        required
                        error={followupError?.notes?.message}
                        name={`followups.${index}.notes`}
                      />
                      <input
                        type="hidden"
                        {...register(`followups.${index}.notes` as const, {
                          required: req('Follow-up Notes are required'),
                        })}
                      />
                    </div>
                  </>
                );
              })()}

              {/* Status hidden input */}
              <input type="hidden" {...register(`followups.${index}.status` as const)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default ActionItemsSection;
