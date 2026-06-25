import React from 'react';

interface ChipSelectorProps {
  label: string;
  options: readonly string[];
  value: string[];
  onChange: (newValue: string[]) => void;
  required?: boolean;
  error?: string;
  maxSelect?: number;
}

/**
 * Multi-select chip component for touch-friendly, fast selection.
 * Replaces traditional checkbox grids for frequently-used multi-selects.
 */
export const ChipSelector: React.FC<ChipSelectorProps> = ({
  label,
  options,
  value = [],
  onChange,
  required = false,
  error,
  maxSelect,
}) => {
  const toggle = (option: string) => {
    if (value.includes(option)) {
      onChange(value.filter(v => v !== option));
    } else {
      if (maxSelect && value.length >= maxSelect) return;
      onChange([...value, option]);
    }
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
        {maxSelect && value.length > 0 && (
          <span className="ml-2 text-xs text-gray-400 font-normal">
            {value.length}/{maxSelect}
          </span>
        )}
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map(option => {
          const isSelected = value.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggle(option)}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
                border transition-all duration-150 cursor-pointer select-none
                active:scale-95 touch-manipulation
                ${
                  isSelected
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-[var(--primary)] hover:text-[var(--primary)]'
                }
              `}
            >
              {isSelected && (
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
              {option}
            </button>
          );
        })}
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
};

export default ChipSelector;
