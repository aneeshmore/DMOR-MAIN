import React from 'react';
import { useFieldArray, Control, UseFormRegister, FormState } from 'react-hook-form';
import { FieldIntelligenceReport } from '../types/fieldIntelligence.types';

interface SectionProps {
  control: Control<FieldIntelligenceReport>;
  register: UseFormRegister<FieldIntelligenceReport>;
  formState?: FormState<FieldIntelligenceReport>;
}

export const CompetitorAnalysisSection: React.FC<SectionProps> = ({
  control,
  register,
  formState,
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
          {fields.map((field, index) => (
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Competitor Name *
                  </label>
                  {(() => {
                    const competitorError = errors?.competitors?.[index] as any;
                    return (
                      <>
                        <input
                          type="text"
                          className={`input ${competitorError?.competitorName ? 'border-red-500 focus:border-red-500 focus:ring-red-500 bg-red-50/10' : ''}`}
                          placeholder="e.g. Kansai Nerolac, Asian Paints"
                          {...register(`competitors.${index}.competitorName` as const, {
                            required: 'Competitor name is required',
                          })}
                        />
                        {competitorError?.competitorName && (
                          <p className="text-red-500 text-xs mt-1">
                            {competitorError.competitorName.message}
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Strengths
                  </label>
                  <textarea
                    rows={2}
                    className="input"
                    placeholder="What do they do well? (e.g. low price, wide network)"
                    {...register(`competitors.${index}.strengths` as const)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Weaknesses
                  </label>
                  <textarea
                    rows={2}
                    className="input"
                    placeholder="Where do they fail? (e.g. slow shade matching, poor delivery)"
                    {...register(`competitors.${index}.weaknesses` as const)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Reason for Using Competitor
                  </label>
                  <textarea
                    rows={2}
                    className="input"
                    placeholder="Why is the customer currently purchasing from them?"
                    {...register(`competitors.${index}.reasonUsingCompetitor` as const)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Strategy / Reason to Shift to Us
                  </label>
                  <textarea
                    rows={2}
                    className="input"
                    placeholder="How can we win this account? (e.g. sample validation, better credit)"
                    {...register(`competitors.${index}.reasonShiftToUs` as const)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default CompetitorAnalysisSection;
