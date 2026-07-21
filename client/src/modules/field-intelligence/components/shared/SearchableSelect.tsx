import React, { useState, useRef, useMemo } from 'react';

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
  disabled?: boolean;
  /**
   * Storage key for remembering user-created options. Defaults to `name`.
   * Pass a FIXED key (independent of array index) when many instances should
   * share one growing list — e.g. every competitor row shares "competitorName".
   */
  persistKey?: string;
  /**
   * Called when the user creates a brand-new option via the "Create" row.
   * The new value is also persisted (per `persistKey`/`name`) so it appears in
   * the list on subsequent uses.
   */
  onCreateOption?: (value: string) => void;
}

const CUSTOM_OPTS_PREFIX = 'smartcrm:customopts:';

const loadCustomOptions = (key?: string): string[] => {
  if (!key) return [];
  try {
    const raw = localStorage.getItem(CUSTOM_OPTS_PREFIX + key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(v => typeof v === 'string') : [];
  } catch {
    return [];
  }
};

const persistCustomOptions = (key: string, values: string[]) => {
  try {
    localStorage.setItem(CUSTOM_OPTS_PREFIX + key, JSON.stringify(values));
  } catch {
    /* storage unavailable — non-fatal */
  }
};

/**
 * Searchable dropdown with autocomplete. Supports creating new options inline:
 * when `allowCustom` is set and the typed text matches no existing option, a
 * "➕ Create <value>" row appears. Created values are remembered per field
 * (keyed by `name`) so each field keeps its own growing list.
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
  disabled = false,
  persistKey,
  onCreateOption,
}) => {
  const storageKey = persistKey ?? name;
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [customOptions, setCustomOptions] = useState<string[]>(() => loadCustomOptions(storageKey));
  const containerRef = useRef<HTMLDivElement>(null);

  // Base options + any user-created options (dedup, case-insensitive).
  const mergedOptions = useMemo(() => {
    const seen = new Set(options.map(o => o.toLowerCase()));
    const extra = customOptions.filter(c => c && !seen.has(c.toLowerCase()));
    return [...options, ...extra];
  }, [options, customOptions]);

  const trimmedQuery = query.trim();
  const filtered = trimmedQuery
    ? mergedOptions.filter(o => o.toLowerCase().includes(trimmedQuery.toLowerCase()))
    : mergedOptions;

  const hasExactMatch = mergedOptions.some(o => o.toLowerCase() === trimmedQuery.toLowerCase());
  const canCreate = allowCustom && trimmedQuery.length > 0 && !hasExactMatch;

  const handleSelect = (option: string) => {
    onChange(option);
    setQuery('');
    setIsOpen(false);
  };

  const handleCreate = () => {
    if (!canCreate) return;
    const v = trimmedQuery;
    if (storageKey && !customOptions.some(c => c.toLowerCase() === v.toLowerCase())) {
      const next = [...customOptions, v];
      setCustomOptions(next);
      persistCustomOptions(storageKey, next);
    }
    onCreateOption?.(v);
    handleSelect(v);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
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
          className={`input pr-8 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : ''}`}
          placeholder={placeholder}
          value={isOpen ? query : displayValue}
          onChange={handleInputChange}
          onFocus={() => {
            if (disabled) return;
            setQuery('');
            setIsOpen(true);
          }}
          onBlur={handleBlur}
          onKeyDown={e => {
            if (e.key === 'Enter' && canCreate) {
              e.preventDefault();
              handleCreate();
            }
          }}
          disabled={disabled}
          autoComplete="off"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </div>

      {isOpen && !disabled && (filtered.length > 0 || canCreate) && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {canCreate && (
            <li
              onMouseDown={handleCreate}
              className="px-3 py-2.5 text-sm cursor-pointer transition-colors bg-primary-50 text-[var(--primary)] font-semibold hover:bg-primary-100 flex items-center gap-1.5 border-b border-gray-100"
            >
              <span className="text-base leading-none">➕</span> Create &ldquo;{trimmedQuery}&rdquo;
            </li>
          )}
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
