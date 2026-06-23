import React from 'react';
import { UseFormRegister, FormState, UseFormSetValue, useWatch, Control } from 'react-hook-form';
import { FieldIntelligenceReport } from '../types/fieldIntelligence.types';
import { VISIT_TYPES, VISIT_PURPOSES } from '../constants/firConstants';
import ChipSelector from './shared/ChipSelector';

interface SectionProps {
  register: UseFormRegister<FieldIntelligenceReport>;
  formState: FormState<FieldIntelligenceReport>;
  setValue: UseFormSetValue<FieldIntelligenceReport>;
  control: Control<FieldIntelligenceReport>;
}

export const VisitDetailsSection: React.FC<SectionProps> = ({
  register,
  formState,
  setValue,
  control,
}) => {
  const { errors } = formState;
  const visitPurpose = useWatch({ control, name: 'visitPurpose' }) || [];

  const detectLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          setValue('gpsLatitude', position.coords.latitude.toFixed(6));
          setValue('gpsLongitude', position.coords.longitude.toFixed(6));
        },
        error => {
          console.error('Error detecting location', error);
          alert('Could not detect location. Please enter manually.');
        }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  };

  return (
    <div className="card p-6 mb-6">
      <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2">
        <span className="bg-primary-100 text-primary-600 p-1.5 rounded-md">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </span>
        Visit Details
        <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
          Layer 1 – Required
        </span>
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Date */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Visit Date *</label>
          <input
            type="date"
            className={`input ${errors.visitDate ? 'border-red-500 focus:border-red-500 bg-red-50/10' : ''}`}
            {...register('visitDate', { required: 'Visit date is required' })}
          />
          {errors.visitDate && (
            <p className="text-red-500 text-xs mt-1">{errors.visitDate.message}</p>
          )}
        </div>

        {/* Time In */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Time In</label>
          <input type="time" className="input" {...register('timeIn')} />
        </div>

        {/* Time Out */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Time Out</label>
          <input type="time" className="input" {...register('timeOut')} />
        </div>

        {/* Visit Type – now covers all 10 required types */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Visit Type *
          </label>
          <select
            className={`input font-semibold ${errors.visitType ? 'border-red-500' : ''}`}
            {...register('visitType', { required: 'Visit type is required' })}
          >
            {VISIT_TYPES.map(type => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {errors.visitType && (
            <p className="text-red-500 text-xs mt-1">{errors.visitType.message}</p>
          )}
        </div>

        {/* Duration */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Visit Duration (Minutes)
          </label>
          <input
            type="number"
            className="input"
            placeholder="e.g. 45"
            {...register('visitDuration', { valueAsNumber: true })}
          />
        </div>

        {/* GPS with detect button */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Latitude</label>
            <input
              type="text"
              className="input"
              placeholder="18.5204"
              {...register('gpsLatitude')}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Longitude</label>
            <div className="relative">
              <input
                type="text"
                className="input pr-10"
                placeholder="73.8567"
                {...register('gpsLongitude')}
              />
              <button
                type="button"
                onClick={detectLocation}
                className="absolute right-2 top-2 text-primary hover:text-primary-hover"
                title="Detect GPS Location"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Visit Purpose – chip selector */}
      <div className="mt-5">
        <ChipSelector
          label="Visit Purpose"
          options={VISIT_PURPOSES}
          value={visitPurpose}
          onChange={newVal => setValue('visitPurpose', newVal)}
        />
      </div>
    </div>
  );
};
export default VisitDetailsSection;
