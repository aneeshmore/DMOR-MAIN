import React from 'react';
import { UseFormRegister, FormState, UseFormSetValue, useWatch, Control } from 'react-hook-form';
import { FieldIntelligenceReport } from '../types/fieldIntelligence.types';
import { VISIT_PURPOSES, VISIT_TYPES } from '../constants/firConstants';
import SearchableSelect from './shared/SearchableSelect';
import { showToast } from '@/utils/toast';

interface SectionProps {
  register: UseFormRegister<FieldIntelligenceReport>;
  formState: FormState<FieldIntelligenceReport>;
  setValue: UseFormSetValue<FieldIntelligenceReport>;
  control: Control<FieldIntelligenceReport>;
  disabled?: boolean;
}

export const VisitDetailsSection: React.FC<SectionProps> = ({
  register,
  formState,
  setValue,
  control,
  disabled = false,
}) => {
  const { errors } = formState;
  const visitPurpose = useWatch({ control, name: 'visitPurpose' }) || [];
  const timeIn = useWatch({ control, name: 'timeIn' });
  const timeOut = useWatch({ control, name: 'timeOut' });
  const gpsLat = useWatch({ control, name: 'gpsLatitude' });
  const gpsLng = useWatch({ control, name: 'gpsLongitude' });

  React.useEffect(() => {
    register('visitPurpose', {
      validate: val => (val && val.length > 0) || 'Visit Purpose is required',
    });
    register('visitType');
    setValue('visitType', 'Dealer Visit');
  }, [register, setValue]);

  // Auto-calculate Visit Duration (Minutes) from Time In and Time Out
  React.useEffect(() => {
    if (timeIn && timeOut) {
      const [hIn, mIn] = timeIn.split(':').map(Number);
      const [hOut, mOut] = timeOut.split(':').map(Number);
      if (!isNaN(hIn) && !isNaN(mIn) && !isNaN(hOut) && !isNaN(mOut)) {
        const startMin = hIn * 60 + mIn;
        const endMin = hOut * 60 + mOut;
        if (endMin >= startMin) {
          const diffMinutes = endMin - startMin;
          setValue('visitDuration', diffMinutes.toString(), { shouldValidate: true });
        }
      }
    }
  }, [timeIn, timeOut, setValue]);

  const setNow = (field: 'timeIn' | 'timeOut') => {
    if (disabled) return;
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    setValue(field, `${hours}:${minutes}`, { shouldValidate: true });
  };

  const detectLocation = () => {
    if (disabled) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          setValue('gpsLatitude', position.coords.latitude.toFixed(6), { shouldValidate: true });
          setValue('gpsLongitude', position.coords.longitude.toFixed(6), { shouldValidate: true });
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
            disabled={disabled}
            className={`input disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed ${errors.visitDate ? 'border-red-500 focus:border-red-500 bg-red-50/10' : ''}`}
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
          <div className="flex justify-between items-center mb-1">
            <label
              className={`text-sm font-semibold ${errors.timeIn ? 'text-red-500' : 'text-gray-700'}`}
            >
              Time In
            </label>
            {!disabled && (
              <button
                type="button"
                onClick={() => setNow('timeIn')}
                className="text-xs text-primary font-medium hover:underline flex items-center gap-0.5"
              >
                Set Now
              </button>
            )}
          </div>
          <input
            type="time"
            disabled={disabled}
            className={`input disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed ${errors.timeIn ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
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
          <div className="flex justify-between items-center mb-1">
            <label
              className={`text-sm font-semibold ${errors.timeOut ? 'text-red-500' : 'text-gray-700'}`}
            >
              Time Out <span className="text-red-500">*</span>
            </label>
            {!disabled && (
              <button
                type="button"
                onClick={() => setNow('timeOut')}
                className="text-xs text-primary font-medium hover:underline flex items-center gap-0.5"
              >
                Set Now
              </button>
            )}
          </div>
          <input
            type="time"
            disabled={disabled}
            className={`input disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed ${errors.timeOut ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
            {...register('timeOut', {
              required: 'Time Out is required',
              validate: val => {
                if (!timeIn || !val) return true;
                return val > timeIn || 'Time Out cannot be before Time In';
              },
            })}
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

        {/* Duration (Auto-Calculated) */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label
              className={`text-sm font-semibold ${errors.visitDuration ? 'text-red-500' : 'text-gray-700'}`}
            >
              Visit Duration
            </label>
            <span className="text-xs text-emerald-600 font-medium">Auto-Calculated</span>
          </div>
          <div className="relative">
            <input
              type="text"
              readOnly
              disabled={disabled}
              className={`input bg-gray-50 text-gray-800 font-semibold pr-14 truncate disabled:bg-gray-100 disabled:text-gray-500 ${errors.visitDuration ? 'border-red-500' : ''}`}
              placeholder="Auto from Time In / Out"
              {...register('visitDuration', { required: false })}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500 pointer-events-none bg-gray-50 pl-1">
              Mins
            </span>
          </div>
          {errors.visitDuration && (
            <p
              className="text-red-500 text-xs mt-1"
              style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
            >
              {errors.visitDuration.message}
            </p>
          )}
        </div>

        {/* GPS Coordinates Section */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-sm font-semibold text-gray-700">
              GPS Location <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={detectLocation}
              disabled={disabled}
              className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              Auto-Detect GPS
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <input
                type="text"
                disabled={disabled}
                className={`input w-full disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed ${errors.gpsLatitude ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
                placeholder="Lat (e.g. 18.5204)"
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
              <input
                type="text"
                disabled={disabled}
                className={`input w-full disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed ${errors.gpsLongitude ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
                placeholder="Lon (e.g. 73.8567)"
                {...register('gpsLongitude', { required: 'Longitude is required' })}
              />
              {errors.gpsLongitude && (
                <p
                  className="text-red-500 text-xs mt-1"
                  style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
                >
                  {errors.gpsLongitude.message}
                </p>
              )}
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
          disabled={disabled}
        />
      </div>
    </div>
  );
};
export default VisitDetailsSection;
