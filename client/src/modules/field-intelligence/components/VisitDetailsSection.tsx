import React from 'react';
import { UseFormRegister, FormState, UseFormSetValue, useWatch, Control } from 'react-hook-form';
import { FieldIntelligenceReport } from '../types/fieldIntelligence.types';
import { VISIT_PURPOSES } from '../constants/firConstants';
import SearchableSelect from './shared/SearchableSelect';
import { showToast } from '@/utils/toast';

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

  React.useEffect(() => {
    register('visitPurpose', {
      validate: val => (val && val.length > 0) || 'Visit Purpose is required',
    });
  }, [register]);

  const detectLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          setValue('gpsLatitude', position.coords.latitude.toFixed(6));
          setValue('gpsLongitude', position.coords.longitude.toFixed(6));
        },
        error => {
          console.error('Error detecting location', error);
          showToast.error('Could not detect location. Please enter manually.');
        }
      );
    } else {
      showToast.error('Geolocation is not supported by your browser.');
    }
  };

  return (
    <div className="card p-6 mb-6">
      <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="bg-primary-100 text-primary-600 p-1.5 rounded-md flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </span>
          <span>Visit Details</span>
        </span>
        <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-semibold whitespace-nowrap self-start sm:self-auto">
          Layer 1 – Required
        </span>
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Date */}
        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.visitDate ? 'text-red-500' : 'text-gray-700'}`}
          >
            Visit Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            className={`input ${errors.visitDate ? 'border-red-500 focus:border-red-500 bg-red-50/10' : ''}`}
            {...register('visitDate', { required: 'Visit Date is required' })}
          />
          {errors.visitDate && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.visitDate.message}
            </p>
          )}
        </div>

        {/* Time In */}
        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.timeIn ? 'text-red-500' : 'text-gray-700'}`}
          >
            Time In
          </label>
          <input
            type="time"
            className={`input ${errors.timeIn ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            {...register('timeIn', { required: false })}
          />
          {errors.timeIn && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.timeIn.message}
            </p>
          )}
        </div>

        {/* Time Out */}
        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.timeOut ? 'text-red-500' : 'text-gray-700'}`}
          >
            Time Out <span className="text-red-500">*</span>
          </label>
          <input
            type="time"
            className={`input ${errors.timeOut ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            {...register('timeOut', { required: 'Time Out is required' })}
          />
          {errors.timeOut && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.timeOut.message}
            </p>
          )}
        </div>

        {/* Visit Type hidden input */}
        <input type="hidden" {...register('visitType')} />

        {/* Duration */}
        <div>
          <label
            className={`block text-sm font-semibold mb-1 ${errors.visitDuration ? 'text-red-500' : 'text-gray-700'}`}
          >
            Visit Duration (Minutes)
          </label>
          <input
            type="text"
            className={`input ${errors.visitDuration ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            placeholder="e.g. 45 or N/A"
            {...register('visitDuration', {
              required: false,
              validate: val => {
                if (!val || val.toString().trim() === '') return true;
                return (val as any) === 'N/A' || !isNaN(Number(val)) || 'Must be a number or N/A';
              },
            })}
          />
          {errors.visitDuration && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.visitDuration.message}
            </p>
          )}
        </div>

        {/* GPS with detect button */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label
              className={`block text-sm font-semibold mb-1 ${errors.gpsLatitude ? 'text-red-500' : 'text-gray-700'}`}
            >
              Latitude <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={`input ${errors.gpsLatitude ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
              placeholder="18.5204 or N/A"
              {...register('gpsLatitude', { required: 'Latitude is required' })}
            />
            {errors.gpsLatitude && (
              <p
                className="text-red-500 text-xs mt-1"
                style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
              >
                {errors.gpsLatitude.message}
              </p>
            )}
          </div>
          <div>
            <label
              className={`block text-sm font-semibold mb-1 ${errors.gpsLongitude ? 'text-red-500' : 'text-gray-700'}`}
            >
              Longitude <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                className={`input pr-10 ${errors.gpsLongitude ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
                placeholder="73.8567 or N/A"
                {...register('gpsLongitude', { required: 'Longitude is required' })}
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

      {/* Visit Purpose – dropdown selector */}
      <div className="mt-5">
        <SearchableSelect
          label="Visit Purpose"
          name="visitPurpose"
          options={VISIT_PURPOSES}
          value={visitPurpose[0] || ''}
          onChange={newVal =>
            setValue('visitPurpose', newVal ? [newVal] : [], { shouldValidate: true })
          }
          placeholder="Select Visit Purpose..."
          required
          error={errors.visitPurpose?.message as string}
        />
      </div>
    </div>
  );
};
export default VisitDetailsSection;
