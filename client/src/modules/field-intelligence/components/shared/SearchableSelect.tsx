import React, { useState, useRef } from 'react';

interface SearchableSelectProps {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  allowCustom?: boolean; // allow user to type a value not in list
  name?: string;
}

/**
 * Searchable dropdown with autocomplete. Replaces plain free-text inputs
 * for fields that have a known set of options but occasionally need custom values.
 */
export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select or type to search...',
  required = false,
  error,
  allowCustom = false,
  name,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = query
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  const handleSelect = (option: string) => {
    onChange(option);
    setQuery('');
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setIsOpen(true);
    if (allowCustom) {
      onChange(e.target.value);
    }
  };

  const handleBlur = () => {
    // Small delay to allow click on option to register
    setTimeout(() => setIsOpen(false), 150);
  };

  const displayValue = value || query;

  return (
    <div ref={containerRef} className="relative">
      <label
        className={`block text-sm font-semibold mb-1 ${error ? 'text-red-500' : 'text-gray-700'}`}
      >
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          type="text"
          name={name}
          className={`input pr-8 ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : ''}`}
          placeholder={placeholder}
          value={isOpen ? query : displayValue}
          onChange={handleInputChange}
          onFocus={() => {
            setQuery('');
            setIsOpen(true);
          }}
          onBlur={handleBlur}
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </div>

      {isOpen && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {filtered.slice(0, 20).map(option => (
            <li
              key={option}
              onMouseDown={() => handleSelect(option)}
              className={`
                px-3 py-2.5 text-sm cursor-pointer transition-colors
                ${option === value ? 'bg-primary-50 text-[var(--primary)] font-semibold' : 'text-gray-700 hover:bg-gray-50'}
              `}
            >
              {option}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p
          className="text-red-500 text-xs mt-1"
          style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
        >
          {error}
        </p>
      )}
    </div>
  );
};

export default SearchableSelect;
