import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Input } from './Input';

export interface Option<T = any> {
  id: number | string;
  label: string;
  subLabel?: string;
  value: T;
  className?: string;
}

interface SearchableSelectProps<T = any> {
  options: Option<T>[];
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
  label?: string;
  creatable?: boolean; // Allow creating new values
  onCreateNew?: (inputValue: string) => void; // Callback when creating new value
  allowCustomValue?: boolean; // If true, preserve custom values that don't match options (useful with creatable)
  allowCustom?: boolean; // Allow typing custom values directly
  onEnter?: () => void; // Callback when Enter is pressed and an option is selected
  error?: string;
  name?: string;
  customLabel?: string; // Human-readable custom label (e.g. newly created customer name)
}

const SearchableSelect = <T = any,>({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  className = '',
  required = false,
  label,
  creatable = false,
  onCreateNew,
  allowCustomValue = false,
  allowCustom = false,
  onEnter,
  error,
  name,
  customLabel,
}: SearchableSelectProps<T>) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Sync searchTerm with selected value when not open
  useEffect(() => {
    if (!isOpen) {
      const selectedOption = options.find(option => option.value === value);
      if (selectedOption) {
        setSearchTerm(selectedOption.label || '');
      } else if (customLabel) {
        setSearchTerm(customLabel);
      } else if ((allowCustomValue || allowCustom) && value) {
        // Preserve custom value if allowCustomValue or allowCustom is enabled
        setSearchTerm(String(value));
      } else if (!value) {
        setSearchTerm('');
      }
    }
  }, [value, isOpen, options, allowCustomValue, allowCustom, customLabel]);

  const filteredOptions = options.filter(
    option =>
      (option.label && option.label.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (option.subLabel && option.subLabel.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Check if search term exactly matches any option
  const exactMatch = options.find(
    option => option.label && option.label.toLowerCase() === searchTerm.toLowerCase()
  );

  // Show "Create new" option if creatable mode and no exact match
  const showCreateOption = creatable && searchTerm.trim() !== '' && !exactMatch;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
    setHighlightedIndex(0); // Highlight first option on search

    // If user clears input, clear selection?
    if (e.target.value === '') {
      onChange(undefined);
    } else if (allowCustom) {
      onChange(e.target.value as unknown as T);
    }
  };

  const handleSelect = (option: Option<T>) => {
    onChange(option.value);
    setSearchTerm(option.label || '');
    setIsOpen(false);
  };

  const handleCreateNew = () => {
    if (onCreateNew && searchTerm.trim()) {
      onCreateNew(searchTerm.trim());
      setIsOpen(false);
    }
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
      setIsOpen(false);
      // Reset search term to selected value if we click out without selecting new
      const selectedOption = options.find(option => option.value === value);
      if (selectedOption) {
        setSearchTerm(selectedOption.label || '');
      } else if (customLabel) {
        setSearchTerm(customLabel);
      } else if ((allowCustomValue || allowCustom) && value) {
        // Preserve custom value if allowCustomValue or allowCustom is enabled
        setSearchTerm(String(value));
      } else {
        setSearchTerm(''); // Clear if nothing valid selected
        // Note: keeping invalid text is usually bad for a select component.
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        setHighlightedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredOptions.length > 0) {
          // Select highlighted or first option
          const indexToSelect = highlightedIndex >= 0 ? highlightedIndex : 0;
          if (filteredOptions[indexToSelect]) {
            handleSelect(filteredOptions[indexToSelect]);
            // Call onEnter callback if provided
            if (onEnter) {
              onEnter();
            }
          }
        } else if (showCreateOption) {
          // Create new if enabled and no match
          handleCreateNew();
        } else if (allowCustom) {
          setIsOpen(false);
          if (onEnter) {
            onEnter();
          }
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value, options, allowCustom]); // Fixed dependency array

  // Auto-scroll to highlighted option
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedEl = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      <div className="relative">
        <Input
          label={label}
          name={name}
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className="pr-8"
          autoComplete="off"
          error={error}
        />
        <span
          className={`absolute right-2.5 pointer-events-none text-[var(--text-secondary)] opacity-60 ${label ? 'bottom-2.5' : 'top-1/2 -translate-y-1/2'}`}
        >
          <ChevronDown size={16} />
        </span>
      </div>

      {isOpen && (
        <div
          ref={listRef}
          className="absolute z-[9999] w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-md shadow-lg max-h-60 overflow-y-auto"
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => (
              <div
                key={option.id}
                data-index={index}
                onClick={() => handleSelect(option)}
                className={`
                  px-4 py-2 text-sm cursor-pointer flex items-center justify-between
                  ${
                    index === highlightedIndex
                      ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
                      : value === option.value
                        ? 'bg-[var(--surface-hover)] text-[var(--text-primary)]'
                        : 'text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                  }
                  ${option.className || ''}
                `}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <div>
                  <span className="font-medium">{option.label}</span>
                  {option.subLabel && (
                    <span className="text-xs text-[var(--text-secondary)] ml-2">
                      {option.subLabel}
                    </span>
                  )}
                </div>
                {value === option.value && <Check size={16} />}
              </div>
            ))
          ) : showCreateOption ? (
            <div
              onClick={handleCreateNew}
              className="px-4 py-2 text-sm cursor-pointer hover:bg-[var(--surface-hover)] text-[var(--primary)] flex items-center gap-2"
            >
              <span className="font-medium">✨ Create new: &ldquo;{searchTerm}&rdquo;</span>
            </div>
          ) : (
            <div className="px-4 py-2 text-sm text-[var(--text-secondary)]">No results found</div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
