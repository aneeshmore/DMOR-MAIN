import React from 'react';
import { UseFormRegister, FormState } from 'react-hook-form';
import { FieldIntelligenceReport } from '../types/fieldIntelligence.types';

interface SectionProps {
  register: UseFormRegister<FieldIntelligenceReport>;
  formState: FormState<FieldIntelligenceReport>;
}

export const TechnicalDetailsSection: React.FC<SectionProps> = ({ register, formState }) => {
  const { errors } = formState;

  return (
    <div className="card p-6 mb-6">
      <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2">
        <span className="bg-primary-100 text-primary-600 p-1.5 rounded-md">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </span>
        Technical Specifications
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Paint Requirement Types *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              'PU Coatings',
              'Epoxy Primers',
              'Acrylic Topcoats',
              'NC Paints',
              'Heat Resistant Coatings',
              'Specialty Thinners',
            ].map(type => (
              <label
                key={type}
                className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  value={type}
                  className="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4"
                  {...register('paintRequirementTypes')}
                />
                {type}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Surface Substrates *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              'Mild Steel (MS)',
              'Stainless Steel (SS)',
              'Aluminum',
              'Plastics / ABS',
              'Concrete / Masonry',
              'Wood',
            ].map(surf => (
              <label
                key={surf}
                className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  value={surf}
                  className="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4"
                  {...register('surfaceTypes')}
                />
                {surf}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Application Methods *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              'Conventional Air Spray',
              'Airless Spraying',
              'Electrostatic Spray',
              'Dip Coating',
              'Roller / Brush',
              'Auto-Coating Line',
            ].map(method => (
              <label
                key={method}
                className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  value={method}
                  className="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4"
                  {...register('applicationMethods')}
                />
                {method}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Technical Challenges Encountered
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              'Adhesion Failure',
              'Color Variations',
              'Slow Curing',
              'Corrosion / Rusting',
              'Sagging / Runs',
              'Orange Peel Effect',
            ].map(challenge => (
              <label
                key={challenge}
                className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  value={challenge}
                  className="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4"
                  {...register('technicalChallenges')}
                />
                {challenge}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Required Shade / Code
          </label>
          <input
            type="text"
            className="input"
            placeholder="RAL 7035 / Custom"
            {...register('requiredShade')}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Required Finish</label>
          <select className="input" {...register('requiredFinish')}>
            <option value="Glossy">Glossy (90%+ Gloss)</option>
            <option value="Matt">Matt (10-20% Gloss)</option>
            <option value="Semi-Gloss">Semi-Gloss (50-60% Gloss)</option>
            <option value="Satin">Satin</option>
            <option value="Texture">Texture / Structure</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Current Painting System Used
          </label>
          <input
            type="text"
            className="input"
            placeholder="Epoxy primer + PU topcoat"
            {...register('currentSystemUsed')}
          />
        </div>
      </div>
    </div>
  );
};
export default TechnicalDetailsSection;
