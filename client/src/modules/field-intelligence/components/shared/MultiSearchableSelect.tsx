import React, { useState, useRef, useEffect, useMemo } from 'react';

interface MultiSearchableSelectProps {
  label: string;
  options: readonly string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  /** If true, shows a "Create '...'" option when the query doesn't match any existing option */
  allowCustom?: boolean;
  /**
   * When set, values created via "Create" are remembered under this key so they
   * appear in the option list on subsequent uses (each key keeps its own list).
   */
  persistKey?: string;
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

export const MultiSearchableSelect: React.FC<MultiSearchableSelectProps> = ({
  label,
  options,
  value = [],
  onChange,
  placeholder = 'Select options...',
  required = false,
  error,
  allowCustom = false,
  persistKey,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [customOptions, setCustomOptions] = useState<string[]>(() => loadCustomOptions(persistKey));
  const containerRef = useRef<HTMLDivElement>(null);

  // Base options + any user-created (persisted) options, deduped case-insensitively.
  const mergedOptions = useMemo(() => {
    const seen = new Set(options.map(o => o.toLowerCase()));
    const extra = customOptions.filter(c => c && !seen.has(c.toLowerCase()));
    return [...options, ...extra];
  }, [options, customOptions]);

  // Filter options based on search query
  const filtered = query
    ? mergedOptions.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : mergedOptions;

  // Show "Create" row when allowCustom is on, there's a query, and it doesn't exactly match any option
  const trimmedQuery = query.trim();
  const showCreateOption =
    allowCustom &&
    trimmedQuery.length > 0 &&
    !mergedOptions.some(o => o.toLowerCase() === trimmedQuery.toLowerCase()) &&
    !value.some(v => v.toLowerCase() === trimmedQuery.toLowerCase());

  const handleToggle = (option: string) => {
    let nextValue;
    if (value.includes(option)) {
      nextValue = value.filter(v => v !== option);
    } else {
      nextValue = [...value, option];
    }
    onChange(nextValue);
  };

  const handleCreateCustom = () => {
    if (!trimmedQuery) return;
    // Remember the created value so it appears in the list next time.
    if (persistKey && !customOptions.some(c => c.toLowerCase() === trimmedQuery.toLowerCase())) {
      const next = [...customOptions, trimmedQuery];
      setCustomOptions(next);
      persistCustomOptions(persistKey, next);
    }
    const nextValue = [...value, trimmedQuery];
    onChange(nextValue);
    setQuery('');
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <label
        className={`block text-sm font-semibold mb-1 ${error ? 'text-red-500' : 'text-gray-700'}`}
      >
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          type="text"
          className={`input pr-8 cursor-pointer ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
          placeholder={value.length > 0 ? `${value.length} selected` : placeholder}
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          autoComplete="off"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </div>

      {isOpen && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {filtered.length > 0 ? (
            filtered.map(option => {
              const isSelected = value.includes(option);
              return (
                <li
                  key={option}
                  onClick={() => handleToggle(option)}
                  className={`
                    px-3 py-2.5 text-sm cursor-pointer transition-colors flex items-center gap-2 hover:bg-gray-50
                    ${isSelected ? 'bg-primary-50 text-[var(--primary)] font-semibold' : 'text-gray-700'}
                  `}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}} // handled by click on li
                    className="rounded border-gray-300 text-primary w-4 h-4 cursor-pointer"
                  />
                  <span>{option}</span>
                </li>
              );
            })
          ) : !showCreateOption ? (
            <li className="px-3 py-2.5 text-sm text-gray-500">No options found</li>
          ) : null}

          {/* "Create" option – only shown when allowCustom is true and query has no match */}
          {showCreateOption && (
            <li
              onClick={handleCreateCustom}
              className="px-3 py-2.5 text-sm cursor-pointer flex items-center gap-2 text-[var(--primary)] font-semibold hover:bg-primary-50 border-t border-gray-100"
            >
              <svg
                className="w-4 h-4 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create &quot;{trimmedQuery}&quot;
            </li>
          )}
        </ul>
      )}

      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map(v => (
            <span
              key={v}
              className="inline-flex items-center gap-1 bg-primary-50 text-[var(--primary)] text-xs font-semibold px-2 py-0.5 rounded-full"
            >
              {v}
              <button
                type="button"
                onClick={() => onChange(value.filter(item => item !== v))}
                className="ml-0.5 hover:text-red-500 transition-colors"
                aria-label={`Remove ${v}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
};

export default MultiSearchableSelect;
