import React from 'react';
import {
  useFieldArray,
  Control,
  UseFormRegister,
  FormState,
  UseFormSetValue,
} from 'react-hook-form';
import { FieldIntelligenceReport } from '../types/fieldIntelligence.types';
import { COMPETITOR_BRANDS } from '../constants/firConstants';
import SearchableSelect from './shared/SearchableSelect';
import VoiceInput from './shared/VoiceInput';

interface SectionProps {
  control: Control<FieldIntelligenceReport>;
  register: UseFormRegister<FieldIntelligenceReport>;
  formState?: FormState<FieldIntelligenceReport>;
  setValue: UseFormSetValue<FieldIntelligenceReport>;
  watch: (name: any) => any;
  isDraftMode?: boolean;
}

export const CompetitorAnalysisSection: React.FC<SectionProps> = ({
  control,
  register,
  formState,
  setValue,
  watch,
  isDraftMode,
}) => {
  const { errors } = formState || {};
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'competitors',
  });

  return (
    <div className="card p-6 mb-6">
      <div className="flex justify-between items-center mb-4 border-b pb-2">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <span className="bg-primary-100 text-primary-600 p-1.5 rounded-md">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          </span>
          Competitor Analysis
        </h3>
        <button
          type="button"
          onClick={() =>
            append({
              competitorName: '',
              strengths: '',
              weaknesses: '',
              reasonUsingCompetitor: '',
              reasonShiftToUs: '',
            })
          }
          className="btn bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] px-3 py-1.5 text-xs font-semibold"
        >
          + Add Competitor
        </button>
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">
          No competitors added yet. Click &quot;Add Competitor&quot; to begin analysis.
        </p>
      ) : (
        <div className="space-y-6">
          {fields.map((field, index) => {
            const competitorError = errors?.competitors?.[index] as any;
            const currentName = watch(`competitors.${index}.competitorName`);
            return (
              <div key={field.id} className="border p-4 rounded-lg bg-gray-50 relative">
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                  title="Remove Competitor"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Competitor Name – searchable select */}
                  <div className="md:col-span-2">
                    <SearchableSelect
                      label="Competitor Brand"
                      options={COMPETITOR_BRANDS}
                      value={currentName || ''}
                      onChange={v =>
                        setValue(`competitors.${index}.competitorName` as any, v, {
                          shouldValidate: true,
                        })
                      }
                      onCreateOption={v =>
                        setValue(`competitors.${index}.competitorName` as any, v, {
                          shouldValidate: true,
                        })
                      }
                      placeholder="e.g. Kansai Nerolac, Asian Paints"
                      allowCustom
                      persistKey="competitorName"
                      error={competitorError?.competitorName?.message}
                    />
                    {/* Hidden for RHF validation */}
                    <input
                      type="hidden"
                      {...register(`competitors.${index}.competitorName` as const, {
                        required: false,
                      })}
                    />
                  </div>

                  <div>
                    <VoiceInput
                      label="Strengths"
                      value={watch(`competitors.${index}.strengths`) || ''}
                      onChange={val =>
                        setValue(`competitors.${index}.strengths` as any, val, {
                          shouldValidate: true,
                        })
                      }
                      placeholder="What do they do well? (e.g. low price, wide network)"
                      rows={2}
                      name={`competitors.${index}.strengths`}
                    />
                    <input type="hidden" {...register(`competitors.${index}.strengths` as const)} />
                  </div>

                  <div>
                    <VoiceInput
                      label="Weaknesses"
                      value={watch(`competitors.${index}.weaknesses`) || ''}
                      onChange={val =>
                        setValue(`competitors.${index}.weaknesses` as any, val, {
                          shouldValidate: true,
                        })
                      }
                      placeholder="Where do they fail? (e.g. slow shade matching, poor delivery)"
                      rows={2}
                      name={`competitors.${index}.weaknesses`}
                    />
                    <input
                      type="hidden"
                      {...register(`competitors.${index}.weaknesses` as const)}
                    />
                  </div>

                  <div>
                    <VoiceInput
                      label="Reason for Using Competitor"
                      value={watch(`competitors.${index}.reasonUsingCompetitor`) || ''}
                      onChange={val =>
                        setValue(`competitors.${index}.reasonUsingCompetitor` as any, val, {
                          shouldValidate: true,
                        })
                      }
                      placeholder="Why is the customer currently purchasing from them?"
                      rows={2}
                      name={`competitors.${index}.reasonUsingCompetitor`}
                    />
                    <input
                      type="hidden"
                      {...register(`competitors.${index}.reasonUsingCompetitor` as const)}
                    />
                  </div>

                  <div>
                    <VoiceInput
                      label="Strategy / Reason to Shift to Us"
                      value={watch(`competitors.${index}.reasonShiftToUs`) || ''}
                      onChange={val =>
                        setValue(`competitors.${index}.reasonShiftToUs` as any, val, {
                          shouldValidate: true,
                        })
                      }
                      placeholder="How can we win this account? (e.g. sample validation, better credit)"
                      rows={2}
                      name={`competitors.${index}.reasonShiftToUs`}
                    />
                    <input
                      type="hidden"
                      {...register(`competitors.${index}.reasonShiftToUs` as const)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default CompetitorAnalysisSection;
