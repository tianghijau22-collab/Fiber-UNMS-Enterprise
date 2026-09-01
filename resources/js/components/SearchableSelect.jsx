import React, { useState, useRef, useEffect } from 'react';

/**
 * Reusable SearchableSelect Component
 * Replaces standard HTML <select> with a searchable popover dropdown.
 *
 * Props:
 * - options: Array<{ value: string|number, label: string, sublabel?: string, disabled?: boolean }>
 * - value: string | number
 * - onChange: (val: string|number) => void
 * - placeholder?: string
 * - searchPlaceholder?: string
 * - disabled?: boolean
 * - className?: string
 * - required?: boolean
 */
export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = '-- Pilih --',
  searchPlaceholder = 'Cari...',
  disabled = false,
  className = '',
  required = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Normalize options array
  const normalizedOptions = options.map(opt => {
    if (typeof opt === 'object' && opt !== null) {
      return {
        value: opt.value,
        label: opt.label !== undefined ? String(opt.label) : String(opt.value),
        sublabel: opt.sublabel,
        disabled: opt.disabled || false
      };
    }
    return { value: opt, label: String(opt), disabled: false };
  });

  const selectedOption = normalizedOptions.find(o => String(o.value) === String(value));

  // Filter options based on search input
  const filteredOptions = normalizedOptions.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase()) ||
    (o.sublabel && o.sublabel.toLowerCase().includes(search.toLowerCase()))
  );

  // Auto focus search input on open
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle ESC key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelect = (val) => {
    onChange(val);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3.5 py-2.5 text-left text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white flex items-center justify-between gap-2 shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
          disabled ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800/60' : 'cursor-pointer hover:border-slate-400 dark:hover:border-slate-600'
        } ${className}`}
      >
        <span className={`truncate ${!selectedOption ? 'text-slate-400 dark:text-slate-500 font-normal' : 'font-semibold'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Hidden input for HTML form validation if required */}
      {required && (
        <input
          type="text"
          name="searchable_select_required"
          value={value || ''}
          onChange={() => {}}
          required={required}
          className="sr-only"
          tabIndex={-1}
        />
      )}

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden flex flex-col max-h-72 text-xs transition-all animate-in fade-in zoom-in-95 duration-100">
          {/* Search Box */}
          <div className="p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 sticky top-0 z-10">
            <div className="relative">
              <svg
                className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-950 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="overflow-y-auto max-h-56 p-1 space-y-0.5 divide-y divide-slate-100 dark:divide-slate-800/40">
            {/* Clear option if placeholder is selectable */}
            {placeholder && (
              <button
                type="button"
                onClick={() => handleSelect('')}
                className={`w-full text-left px-3 py-2 rounded-lg text-slate-400 dark:text-slate-500 italic hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                  !value ? 'bg-slate-100 dark:bg-slate-800 font-semibold' : ''
                }`}
              >
                {placeholder}
              </button>
            )}

            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-slate-400 dark:text-slate-500 italic">
                Data tidak ditemukan
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => !opt.disabled && handleSelect(opt.value)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between ${
                      opt.disabled
                        ? 'opacity-40 cursor-not-allowed'
                        : isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div>
                      <div className="truncate">{opt.label}</div>
                      {opt.sublabel && (
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{opt.sublabel}</div>
                      )}
                    </div>
                    {isSelected && (
                      <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
