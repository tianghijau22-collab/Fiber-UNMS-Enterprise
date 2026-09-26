import React, { useState, useEffect, useRef, useMemo } from 'react';

/**
 * FilterSearchSelect: Sub-component with search box inside the dropdown
 */
function FilterSearchSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Pilih...',
  searchPlaceholder = 'Cari...',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selectRef = useRef(null);
  const inputRef = useRef(null);

  const selectedOpt = options.find(o => String(o.value) === String(value));

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase().trim();
    return options.filter(o => (o.label || '').toLowerCase().includes(q));
  }, [options, search]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (selectRef.current && !selectRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative w-full" ref={selectRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white dark:bg-black text-black dark:text-white border border-black/30 dark:border-white/30 hover:border-black dark:hover:border-white rounded-md px-2.5 py-1.5 text-xs flex items-center justify-between gap-2 shadow-xs transition-colors cursor-pointer text-left"
      >
        <span className="truncate font-medium">
          {selectedOpt ? selectedOpt.label : placeholder}
        </span>
        <svg className={`w-3.5 h-3.5 text-black/50 dark:text-white/50 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 z-30 bg-white dark:bg-[#121212] border border-black/40 dark:border-white/40 rounded-md shadow-xl overflow-hidden text-xs animate-in fade-in duration-100">
          <div className="p-1.5 border-b border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5 sticky top-0 z-10">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-6 pr-2 py-1 bg-white dark:bg-black border border-black/20 dark:border-white/20 rounded text-[11px] text-black dark:text-white placeholder-black/40 dark:placeholder-white/40 outline-none"
              />
              <svg className="w-3 h-3 absolute left-1.5 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto divide-y divide-black/5 dark:divide-white/5">
            {filtered.length === 0 ? (
              <div className="p-2.5 text-center text-[11px] text-black/50 dark:text-white/50">
                Tidak ada data ditemukan
              </div>
            ) : (
              filtered.map(opt => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`w-full text-left px-2.5 py-1.5 text-xs transition-colors flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/10'
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <span className="text-[10px]">✓</span>}
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

export default function OdpFilterPopover({
  filterStatus,
  setFilterStatus,
  filterOlt,
  setFilterOlt,
  filterOdc,
  setFilterOdc,
  olts = [],
  oltDevices = [],
  odcs = [],
  odcNodes = [],
  onApply,
  onApplyFilters,
  onReset,
  onResetFilters,
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const modalCardRef = useRef(null);

  const effectiveOlts = (olts && olts.length > 0) ? olts : (oltDevices || []);
  const effectiveOdcs = (odcs && odcs.length > 0) ? odcs : (odcNodes || []);

  const [draft, setDraft] = useState({
    statusActive: false,
    oltActive: false,
    odcActive: false,
    statusValue: 'all',
    oltValue: 'all',
    odcValue: 'all',
  });

  const activeCount = useMemo(() => {
    let count = 0;
    if (filterStatus && filterStatus !== 'all' && filterStatus !== '') count++;
    if (filterOlt && filterOlt !== 'all' && filterOlt !== '') count++;
    if (filterOdc && filterOdc !== 'all' && filterOdc !== '') count++;
    return count;
  }, [filterStatus, filterOlt, filterOdc]);

  const syncDraft = () => {
    setDraft({
      statusActive: Boolean(filterStatus && filterStatus !== 'all' && filterStatus !== ''),
      oltActive: Boolean(filterOlt && filterOlt !== 'all' && filterOlt !== ''),
      odcActive: Boolean(filterOdc && filterOdc !== 'all' && filterOdc !== ''),
      statusValue: filterStatus || 'all',
      oltValue: filterOlt || 'all',
      odcValue: filterOdc || 'all',
    });
  };

  useEffect(() => {
    if (isOpen) syncDraft();
  }, [isOpen, filterStatus, filterOlt, filterOdc]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleBackdropClick = (e) => {
    if (modalCardRef.current && !modalCardRef.current.contains(e.target)) {
      setIsOpen(false);
    }
  };

  const handleApply = () => {
    const finalStatus = draft.statusActive && draft.statusValue !== 'all' ? draft.statusValue : '';
    const finalOlt = draft.oltActive && draft.oltValue !== 'all' ? draft.oltValue : '';
    const finalOdc = draft.odcActive && draft.odcValue !== 'all' ? draft.odcValue : '';
    if (setFilterStatus) setFilterStatus(finalStatus);
    if (setFilterOlt) setFilterOlt(finalOlt);
    if (setFilterOdc) setFilterOdc(finalOdc);
    if (onApplyFilters) onApplyFilters({ statusValue: finalStatus, oltValue: finalOlt, odcValue: finalOdc });
    if (onApply) onApply({ statusValue: finalStatus, oltValue: finalOlt, odcValue: finalOdc });
    setIsOpen(false);
  };

  const handleClear = () => {
    setDraft({
      statusActive: false,
      oltActive: false,
      odcActive: false,
      statusValue: 'all',
      oltValue: 'all',
      odcValue: 'all',
    });
    if (setFilterStatus) setFilterStatus('');
    if (setFilterOlt) setFilterOlt('');
    if (setFilterOdc) setFilterOdc('');
    if (onResetFilters) onResetFilters();
    if (onReset) onReset();
    setIsOpen(false);
  };

  const statusOptions = useMemo(() => [
    { value: 'all', label: 'Semua Status' },
    { value: 'active', label: 'Aktif' },
    { value: 'inactive', label: 'Tidak Aktif' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'damaged', label: 'Rusak' },
  ], []);

  const oltOptions = useMemo(() => [
    { value: 'all', label: 'Semua OLT' },
    ...effectiveOlts.map(o => ({ value: o.id, label: o.name }))
  ], [effectiveOlts]);

  const odcOptions = useMemo(() => [
    { value: 'all', label: 'Semua ODC' },
    ...effectiveOdcs.map(o => ({ value: o.id, label: o.name }))
  ], [effectiveOdcs]);

  return (
    <div className={`relative inline-block ${className}`}>
      {/* ── Trigger Button ── */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`px-3 py-2 rounded-md text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer ${
          activeCount > 0
            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-600 dark:border-blue-500'
            : 'bg-white dark:bg-black text-black dark:text-white border border-black/70 dark:border-white/70 hover:border-black dark:hover:border-white'
        }`}
        title="Filter Data ODP"
      >
        <svg className="w-3.5 h-3.5 text-current shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        <span>Filter</span>
        {activeCount > 0 && (
          <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>

      {/* ── Top-Centered Modal ── */}
      {isOpen && (
        <div
          onClick={handleBackdropClick}
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-start justify-center pt-14 sm:pt-20 pb-8 px-3 sm:px-4 animate-in fade-in duration-150"
        >
          <div
            ref={modalCardRef}
            onClick={e => e.stopPropagation()}
            className="relative bg-white dark:bg-[#18181b] text-black dark:text-white border border-black/70 dark:border-white/40 rounded-lg shadow-2xl w-full max-w-md sm:max-w-lg overflow-hidden text-xs flex flex-col max-h-[82vh] animate-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="px-4 py-3 bg-white dark:bg-[#18181b] flex items-center justify-between border-b border-black/15 dark:border-white/15 select-none shrink-0">
              <button
                type="button"
                onClick={handleClear}
                className="px-2.5 py-1 rounded-md text-xs font-semibold text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 border border-black/20 dark:border-white/20 transition-all cursor-pointer flex items-center gap-1"
              >
                <span className="text-[11px]">✕</span>
                <span>Bersihkan</span>
              </button>

              <div className="flex items-center gap-1.5 font-bold text-black dark:text-white">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span className="text-sm">Filter ODP</span>
              </div>

              <button
                type="button"
                onClick={handleApply}
                className="px-3.5 py-1.5 rounded-md text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all shadow-xs cursor-pointer flex items-center gap-1"
              >
                <span>✓</span>
                <span>Terapkan</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="divide-y divide-black/10 dark:divide-white/10 overflow-y-auto flex-1 font-sans p-2">
              {/* 1. STATUS */}
              <div className="p-2.5 sm:p-3">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={draft.statusActive}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setDraft(prev => ({
                        ...prev,
                        statusActive: isChecked,
                        statusValue: isChecked ? prev.statusValue : 'all'
                      }));
                    }}
                    className="w-4 h-4 rounded border-black/40 dark:border-white/40 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-blue-600 dark:text-blue-400 font-medium hover:underline text-xs">
                    Status ODP
                  </span>
                </label>

                {draft.statusActive && (
                  <div className="mt-2.5 pl-6 animate-in fade-in duration-150">
                    <FilterSearchSelect
                      value={draft.statusValue}
                      onChange={(val) => setDraft(prev => ({ ...prev, statusValue: val }))}
                      options={statusOptions}
                      placeholder="Pilih Status ODP..."
                      searchPlaceholder="Cari status..."
                    />
                  </div>
                )}
              </div>

              {/* 2. OLT */}
              <div className="p-2.5 sm:p-3">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={draft.oltActive}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setDraft(prev => ({
                        ...prev,
                        oltActive: isChecked,
                        oltValue: isChecked ? prev.oltValue : 'all'
                      }));
                    }}
                    className="w-4 h-4 rounded border-black/40 dark:border-white/40 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-blue-600 dark:text-blue-400 font-medium hover:underline text-xs">
                    OLT
                  </span>
                </label>

                {draft.oltActive && (
                  <div className="mt-2.5 pl-6 animate-in fade-in duration-150">
                    <FilterSearchSelect
                      value={draft.oltValue}
                      onChange={(val) => setDraft(prev => ({ ...prev, oltValue: val }))}
                      options={oltOptions}
                      placeholder="Pilih OLT..."
                      searchPlaceholder="Cari nama OLT..."
                    />
                  </div>
                )}
              </div>

              {/* 3. UPSTREAM ODC */}
              <div className="p-2.5 sm:p-3">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={draft.odcActive}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setDraft(prev => ({
                        ...prev,
                        odcActive: isChecked,
                        odcValue: isChecked ? prev.odcValue : 'all'
                      }));
                    }}
                    className="w-4 h-4 rounded border-black/40 dark:border-white/40 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-blue-600 dark:text-blue-400 font-medium hover:underline text-xs">
                    ODC Induk
                  </span>
                </label>

                {draft.odcActive && (
                  <div className="mt-2.5 pl-6 animate-in fade-in duration-150">
                    <FilterSearchSelect
                      value={draft.odcValue}
                      onChange={(val) => setDraft(prev => ({ ...prev, odcValue: val }))}
                      options={odcOptions}
                      placeholder="Pilih ODC Induk..."
                      searchPlaceholder="Cari nama ODC..."
                    />
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
