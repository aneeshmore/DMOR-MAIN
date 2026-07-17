import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

interface AccountsApprovedDropdownProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Yes / No selector for the Account Approved column.
 * Rendered through a portal so the menu is not clipped by the table's overflow.
 */
export const AccountsApprovedDropdown: React.FC<AccountsApprovedDropdownProps> = ({
  value,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 80 });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    // Close on scroll so the menu doesn't float detached from the scrolling table
    const handleScroll = (event: Event) => {
      if (dropdownRef.current && dropdownRef.current.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownWidth = 80;
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX + rect.width / 2 - dropdownWidth / 2,
        width: dropdownWidth,
      });
    }
    setIsOpen(!isOpen);
  };

  const isApproved = value === 'Approved';

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className={`border flex items-center justify-between gap-1.5 text-[11px] rounded px-2 py-0.5 outline-none transition-all duration-300 font-bold tracking-wider cursor-pointer shadow-sm min-w-[50px] ${
          isApproved
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 focus:ring-2 focus:ring-emerald-200'
            : 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100 focus:ring-2 focus:ring-red-200'
        }`}
      >
        <span>{isApproved ? 'Yes' : 'No'}</span>
        <ChevronDown
          className={`h-3 w-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={dropdownRef}
            className="absolute z-[9999] bg-white rounded shadow-lg border border-gray-100 py-1 overflow-hidden"
            style={{
              top: `${coords.top + 4}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
            }}
          >
            <button
              onClick={e => {
                e.stopPropagation();
                onChange('No');
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs font-semibold transition-colors ${
                !isApproved ? 'bg-red-50 text-red-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              No
            </button>
            <button
              onClick={e => {
                e.stopPropagation();
                onChange('Approved');
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs font-semibold transition-colors ${
                isApproved ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Yes
            </button>
          </div>,
          document.body
        )}
    </>
  );
};
