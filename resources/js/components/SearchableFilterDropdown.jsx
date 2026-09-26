import React, { useState, useRef, useEffect, useMemo } from 'react';

/**
 * Reusable SearchableFilterDropdown Component
 * Dropdown filter dengan kolom pencarian terintegrasi di dalamnya.
 */
export default function SearchableFilterDropdown({
  label,
  value,
  onChange,
  options = [],
  searchPlaceholder = 'Cari...',
  minWidth = 'min-w-[190px]',
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Find currently selected option
  const selectedOption = options.find(o => String(o.value) === String(value)) || options[0];

  // Filter & rank options based on search
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.trim().toLowerCase();

    return options
      .filter(o => {
        const labelStr = String(o.label || '').toLowerCase();
        const sublabelStr = String(o.sublabel || '').toLowerCase();
        return labelStr.includes(q) || sublabelStr.includes(q);
      })
      .sort((a, b) => {
        const aLabel = String(a.label || '').toLowerCase();
        const bLabel = String(b.label || '').toLowerCase();

        if (aLabel === q) return -1;
        if (bLabel === q) return 1;

        const aStarts = aLabel.startsWith(q) || aLabel.startsWith(`odp ${q}`) || aLabel.startsWith(`odc ${q}`);
        const bStarts = bLabel.startsWith(q) || bLabel.startsWith(`odp ${q}`) || bLabel.startsWith(`odc ${q}`);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        return 0;
      });
  }, [options, search]);

  const displayedOptions = useMemo(() => {
    if (search.trim()) return filteredOptions.slice(0, 150);
    const top = filteredOptions.slice(0, 150);
    if (selectedOption && !top.some(o => String(o.value) === String(selectedOption.value))) {
      return [selectedOption, ...top];
    }
    return top;
  }, [filteredOptions, search, selectedOption]);

  // Auto-focus search input when open
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    } else {
      setSearch('');
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (val) => {
    onChange(val);
    setIsOpen(false);
  };

  const isSelectedActive = value && value !== 'all';

  return (
    <div className={`relative ${className || 'inline-block'} text-left`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 text-xs rounded-md border border-black/70 dark:border-white/70 hover:border-black dark:hover:border-white flex items-center justify-between gap-1.5 shadow-2xs font-semibold transition-all cursor-pointer ${
          isSelectedActive
            ? 'bg-black/5 dark:bg-white/10 text-black dark:text-white font-bold'
            : 'bg-white dark:bg-black text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/10'
        }`}
      >
        <span className="flex items-center gap-1.5 truncate">
          {label && (
            <span className="text-[11px] font-bold uppercase tracking-wider shrink-0 text-black dark:text-white">
              {label}
            </span>
          )}
          <span className="truncate text-black dark:text-white">{selectedOption ? selectedOption.label : 'Pilih'}</span>
        </span>
        <svg
          className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 text-black dark:text-white ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          className={`absolute z-[9999] top-full left-0 mt-1.5 ${minWidth} w-full sm:w-auto max-w-[340px] bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100`}
        >
          {/* Search Header */}
          <div className="p-2 border-b border-black/30 dark:border-white/30 bg-white dark:bg-black">
            <div className="relative">
              <svg
                className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-black/60 dark:text-white/60"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white dark:bg-black border border-black dark:border-white rounded-md text-black dark:text-white placeholder-black/50 dark:placeholder-white/50 focus:outline-none font-medium"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto p-1 space-y-0.5">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-black/60 dark:text-white/60 italic">
                Data tidak ditemukan
              </div>
            ) : (
              <>
                {displayedOptions.map((opt) => {
                  const isSelected = String(opt.value) === String(value);
                  return (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => handleSelect(opt.value)}
                      className={`w-full text-left px-3 py-2 rounded-md text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-black text-white dark:bg-white dark:text-black font-bold'
                          : 'hover:bg-black/5 dark:hover:bg-white/10 text-black dark:text-white font-medium'
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {isSelected && (
                        <svg className="w-4 h-4 shrink-0 text-white dark:text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
                {filteredOptions.length > 150 && (
                  <div className="px-3 py-2 text-[10px] text-center text-black/60 dark:text-white/60 italic border-t border-black/20 dark:border-white/20">
                    Menampilkan 150 dari {filteredOptions.length} opsi. Ketik untuk mencari lebih spesifik...
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
