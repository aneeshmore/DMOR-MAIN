import React, { useMemo } from 'react';
import { UseFormRegister, FormState, UseFormSetValue, Control, useWatch } from 'react-hook-form';
import { FieldIntelligenceReport } from '../types/fieldIntelligence.types';
import { EXECUTIVE_RECOMMENDATION_OPTIONS } from '../constants/firConstants';
import ChipSelector from './shared/ChipSelector';

interface SectionProps {
  register: UseFormRegister<FieldIntelligenceReport>;
  formState: FormState<FieldIntelligenceReport>;
  setValue: UseFormSetValue<FieldIntelligenceReport>;
  control: Control<FieldIntelligenceReport>;
  watch: (name: keyof FieldIntelligenceReport) => any;
}

type ScoreKey =
  | 'followupUrgencyScore'
  | 'dealerConfidence'
  | 'paymentReliability'
  | 'relationshipStrength'
  | 'technicalCapability'
  | 'longTermPotential';

const ScoreSlider: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  lowLabel?: string;
  highLabel?: string;
  danger?: boolean;
}> = ({ label, value, onChange, lowLabel = 'Low', highLabel = 'High', danger = false }) => {
  // Score color logic
  const scoreColor = danger
    ? value >= 8 ? 'text-red-600' : value >= 5 ? 'text-amber-600' : 'text-green-600'
    : value >= 8 ? 'text-green-600' : value >= 5 ? 'text-amber-600' : 'text-red-500';

  // Track fill color (for thumb and filled rail)
  const fillColor = danger
    ? value >= 8 ? '#ef4444' : value >= 5 ? '#f59e0b' : '#22c55e'
    : value >= 8 ? '#22c55e' : value >= 5 ? '#f59e0b' : '#ef4444';

  // Percentage across the track (min=1, max=10)
  const pct = ((value - 1) / 9) * 100;

  // Dynamic gradient: filled left = fillColor, unfilled right = light grey
  const trackStyle: React.CSSProperties = {
    background: `linear-gradient(to right, ${fillColor} 0%, ${fillColor} ${pct}%, #e5e7eb ${pct}%, #e5e7eb 100%)`,
    WebkitAppearance: 'none',
    appearance: 'none',
    height: '6px',
    borderRadius: '9999px',
    outline: 'none',
    cursor: 'pointer',
    width: '100%',
    // Sets both accentColor (thumb default in some browsers) and our CSS custom prop
    accentColor: fillColor,
    ['--slider-color' as any]: fillColor,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-semibold text-gray-700">{label}</label>
        <span className={`text-lg font-extrabold ${scoreColor}`}>{value}/10</span>
      </div>

      {/* Slider with visible track */}
      <div className="relative flex items-center">
        <input
          type="range"
          min={1}
          max={10}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={trackStyle}
          className="fir-score-slider"
        />
      </div>

      {/* Min / Max labels */}
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>{lowLabel}</span>
        <span className="text-gray-300">{'·'.repeat(11)}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
};


export const ManagementIntelligenceSection: React.FC<SectionProps> = ({
  register,
  formState,
  setValue,
  control,
  watch,
}) => {
  // Parse executive recommendation as chips (stored as comma-joined)
  const rawRec = watch('executiveRecommendation') || '';
  const recChips: string[] = useMemo(() => {
    try {
      const parsed = JSON.parse(rawRec);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return rawRec ? rawRec.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
  }, [rawRec]);

  const handleRecChange = (chips: string[]) => {
    setValue('executiveRecommendation', chips.join(', '));
  };

  const scores = {
    followupUrgencyScore: useWatch({ control, name: 'followupUrgencyScore' }) ?? 5,
    dealerConfidence: useWatch({ control, name: 'dealerConfidence' }) ?? 5,
    paymentReliability: useWatch({ control, name: 'paymentReliability' }) ?? 5,
    relationshipStrength: useWatch({ control, name: 'relationshipStrength' }) ?? 5,
    technicalCapability: useWatch({ control, name: 'technicalCapability' }) ?? 5,
    longTermPotential: useWatch({ control, name: 'longTermPotential' }) ?? 5,
  };

  return (
    <div className="card p-6 mb-6 border-2 border-indigo-100 bg-indigo-50/20">
      <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-indigo-100 pb-2 flex items-center gap-2">
        <span className="bg-indigo-500 text-white p-1.5 rounded-md">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </span>
        Executive Ratings & Management Intelligence
        <span className="ml-auto text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
          Layer 3 – Intel
        </span>
      </h3>

      {/* Score sliders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <ScoreSlider
          label="Follow-up Urgency"
          value={Number(scores.followupUrgencyScore)}
          onChange={v => setValue('followupUrgencyScore', v)}
          lowLabel="Routine"
          highLabel="Critical – Next Day"
          danger
        />
        <ScoreSlider
          label="Dealer / Customer Confidence"
          value={Number(scores.dealerConfidence)}
          onChange={v => setValue('dealerConfidence', v)}
          lowLabel="Very Low"
          highLabel="Very High"
        />
        <ScoreSlider
          label="Payment Reliability"
          value={Number(scores.paymentReliability)}
          onChange={v => setValue('paymentReliability', v)}
          lowLabel="Risky"
          highLabel="100% Reliable"
        />
        <ScoreSlider
          label="Relationship Strength"
          value={Number(scores.relationshipStrength)}
          onChange={v => setValue('relationshipStrength', v)}
          lowLabel="New Contact"
          highLabel="Strong Bond"
        />
        <ScoreSlider
          label="Technical Capability Level"
          value={Number(scores.technicalCapability)}
          onChange={v => setValue('technicalCapability', v)}
          lowLabel="No Technical Team"
          highLabel="Expert Team"
        />
        <ScoreSlider
          label="Long-Term Potential"
          value={Number(scores.longTermPotential)}
          onChange={v => setValue('longTermPotential', v)}
          lowLabel="One-Time"
          highLabel="Strategic Account"
        />
      </div>

      {/* Hidden inputs for RHF */}
      <input type="hidden" {...register('followupUrgencyScore', { valueAsNumber: true })} />
      <input type="hidden" {...register('dealerConfidence', { valueAsNumber: true })} />
      <input type="hidden" {...register('paymentReliability', { valueAsNumber: true })} />
      <input type="hidden" {...register('relationshipStrength', { valueAsNumber: true })} />
      <input type="hidden" {...register('technicalCapability', { valueAsNumber: true })} />
      <input type="hidden" {...register('longTermPotential', { valueAsNumber: true })} />

      {/* Executive Recommendations – chips */}
      <ChipSelector
        label="Executive Recommendation"
        options={EXECUTIVE_RECOMMENDATION_OPTIONS}
        value={recChips}
        onChange={handleRecChange}
      />
      <input type="hidden" {...register('executiveRecommendation')} />
    </div>
  );
};
export default ManagementIntelligenceSection;
