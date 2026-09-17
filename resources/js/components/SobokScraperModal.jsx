import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import SearchableSelect from './SearchableSelect';

// In-cell Searchable ODP Picker with instant search and smart dropup detection
function RowOdpPicker({
  row,
  selectedOdpId,
  odpOptions = [],
  isManualOdp = false,
  onSelectOdp,
  onResetOdp,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropUp, setDropUp] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Find currently selected ODP option
  const selectedOption = useMemo(() => {
    return odpOptions.find(o => String(o.value) === String(selectedOdpId));
  }, [odpOptions, selectedOdpId]);

  // Check positioning (drop up or drop down)
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setDropUp(spaceBelow < 280);
      if (inputRef.current) {
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Smart Filter with digit and name matching
  const filteredOptions = useMemo(() => {
    const list = odpOptions.filter(o => o.value !== 'all');
    if (!searchTerm.trim()) return list.slice(0, 80);

    const q = searchTerm.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');

    return list
      .filter(o => {
        const label = String(o.label || '').toLowerCase();
        if (label.includes(q)) return true;
        if (qDigits && label.replace(/\D/g, '').includes(qDigits)) return true;
        return false;
      })
      .slice(0, 80);
  }, [odpOptions, searchTerm]);

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Trigger Button with Search Icon */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs flex items-center justify-between gap-1.5 border transition-all cursor-pointer ${
          isManualOdp
            ? 'border-amber-400 dark:border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 font-bold ring-1 ring-amber-400/50'
            : selectedOption
              ? 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold hover:border-slate-400'
              : 'border-rose-300 dark:border-rose-700 bg-rose-50/60 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 font-bold ring-1 ring-rose-400/40'
        }`}
      >
        <span className="flex items-center gap-1.5 truncate">
          <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="truncate">
            {selectedOption ? selectedOption.label : '-- Pilih ODP (Cari) --'}
          </span>
        </span>
        <svg
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Searchable Dropdown Popover */}
      {isOpen && (
        <div
          className={`absolute z-[9999] left-0 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100 ${
            dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
        >
          {/* Search Header */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80">
            <div className="relative">
              <svg
                className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Cari nama atau nomor ODP..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Shortcut to Auto-Match if available */}
          {row.matched_odp_id && (
            <div className="px-2 pt-1.5 pb-1 border-b border-slate-100 dark:border-slate-800/80 bg-emerald-50/40 dark:bg-emerald-950/20 flex items-center justify-between">
              <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold truncate max-w-[170px]">
                Auto-Match: {row.matched_odp_name}
              </span>
              <button
                type="button"
                onClick={() => {
                  onSelectOdp(row.matched_odp_id);
                  setIsOpen(false);
                }}
                className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer shrink-0"
              >
                Pilih ★
              </button>
            </div>
          )}

          {/* List of Options */}
          <div className="max-h-56 overflow-y-auto p-1 space-y-0.5">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-400 italic">
                ODP tidak ditemukan
              </div>
            ) : (
              filteredOptions.map(opt => {
                const isSelected = String(opt.value) === String(selectedOdpId);
                const isAutoMatch = String(opt.value) === String(row.matched_odp_id);

                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => {
                      onSelectOdp(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500 text-white font-bold shadow-xs'
                        : isAutoMatch
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-semibold hover:bg-emerald-100'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium'
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {isAutoMatch && !isSelected && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-bold">
                          Auto
                        </span>
                      )}
                      {isSelected && (
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
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

export default function SobokScraperModal({
  isOpen,
  onClose,
  odpOptions = [],
  onCustomerImported,
}) {
  // Scraping & Auth state
  const [username, setUsername] = useState('jasen');
  const [password, setPassword] = useState('jasen2401');
  const [isScraping, setIsScraping] = useState(false);
  const [hasScraped, setHasScraped] = useState(false);
  const [scrapeError, setScrapeError] = useState(null);

  // Data & Stats
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({
    total_records: 0,
    valid_cmn_count: 0,
    needs_normalization_count: 0,
    no_odp_count: 0,
    has_odp_count: 0,
    already_exists_count: 0,
    new_records_count: 0,
    registered_in_olt_count: 0,
    not_in_olt_count: 0,
  });

  // Filters & Search
  const [search, setSearch] = useState('');
  const [filterOlt, setFilterOlt] = useState('all'); // 'all', or specific OLT name
  const [filterOltValidation, setFilterOltValidation] = useState('all'); // 'all', 'in_olt', 'not_in_olt'
  const [filterOdp, setFilterOdp] = useState('all'); // 'all', 'has_odp', 'no_odp'
  const [filterIdFormat, setFilterIdFormat] = useState('all'); // 'all', 'valid_cmn', 'needs_normalization'
  const [filterUnmsStatus, setFilterUnmsStatus] = useState('all'); // 'all', 'new', 'exists'
  const [autoNormalizeId, setAutoNormalizeId] = useState(true);

  // Distinct OLTs from records with count
  const oltList = useMemo(() => {
    const counts = {};
    records.forEach(r => {
      const name = (r.olt || '').trim() || 'Lainnya / Tidak Diketahui';
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [records]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  // Row-level submission tracking
  const [submittingRowId, setSubmittingRowId] = useState(null);
  const [rowErrors, setRowErrors] = useState({});
  const [rowOverrides, setRowOverrides] = useState({}); // { [rowId]: { customer_number, odp_id } }

  // Batch selection
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isBatchImporting, setIsBatchImporting] = useState(false);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterOlt, filterOltValidation, filterOdp, filterIdFormat, filterUnmsStatus]);

  // Initial scrape when modal opens for the first time
  useEffect(() => {
    if (isOpen && !hasScraped && !isScraping) {
      handleScrape();
    }
  }, [isOpen]);

  const handleScrape = async () => {
    setIsScraping(true);
    setScrapeError(null);
    try {
      const res = await fetch('/api/customers/sobok/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const json = await res.json();
      if (json.status === 'success') {
        setRecords(json.data || []);
        setStats(json.stats || {});
        setHasScraped(true);
        setSelectedIds(new Set());
        setRowOverrides({});
        setRowErrors({});
      } else {
        setScrapeError(json.message || 'Gagal menarik data dari Sobok.');
      }
    } catch (err) {
      setScrapeError('Koneksi ke server gagal: ' + err.message);
    } finally {
      setIsScraping(false);
    }
  };

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter(item => {
      // Search
      const q = search.toLowerCase().trim();
      const matchSearch = !q ||
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.raw_id && item.raw_id.toLowerCase().includes(q)) ||
        (item.normalized_id && item.normalized_id.toLowerCase().includes(q)) ||
        (item.raw_odp && item.raw_odp.toLowerCase().includes(q)) ||
        (item.address && item.address.toLowerCase().includes(q)) ||
        (item.onu_serial && item.onu_serial.toLowerCase().includes(q));

      // Filter OLT
      let matchOlt = true;
      if (filterOlt !== 'all') {
        const rowOlt = (item.olt || '').trim() || 'Lainnya / Tidak Diketahui';
        matchOlt = rowOlt === filterOlt;
      }

      // Filter Validasi OLT
      let matchOltValidation = true;
      if (filterOltValidation === 'in_olt') matchOltValidation = item.is_registered_in_olt;
      else if (filterOltValidation === 'not_in_olt') matchOltValidation = !item.is_registered_in_olt;

      // Filter ODP
      let matchOdp = true;
      if (filterOdp === 'has_odp') matchOdp = item.has_odp;
      else if (filterOdp === 'no_odp') matchOdp = !item.has_odp;

      // Filter ID Format
      let matchId = true;
      if (filterIdFormat === 'valid_cmn') matchId = !item.needs_normalization;
      else if (filterIdFormat === 'needs_normalization') matchId = item.needs_normalization;

      // Filter UNMS Status
      let matchUnms = true;
      if (filterUnmsStatus === 'new') matchUnms = !item.already_exists && item.import_status !== 'imported';
      else if (filterUnmsStatus === 'exists') matchUnms = item.already_exists || item.import_status === 'imported';

      return matchSearch && matchOlt && matchOltValidation && matchOdp && matchId && matchUnms;
    });
  }, [records, search, filterOlt, filterOltValidation, filterOdp, filterIdFormat, filterUnmsStatus]);

  // Paginated records
  const totalPages = Math.ceil(filteredRecords.length / perPage) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return filteredRecords.slice(start, start + perPage);
  }, [filteredRecords, currentPage, perPage]);

  // Update a row override (e.g. user edits ID or selects custom ODP)
  const handleRowOverrideChange = (rowId, field, value) => {
    setRowOverrides(prev => ({
      ...prev,
      [rowId]: {
        ...(prev[rowId] || {}),
        [field]: value,
      },
    }));
  };

  // Single record import execution
  const handleImportSingle = async (row) => {
    const overrides = rowOverrides[row.id] || {};
    const finalCustNumber = overrides.customer_number !== undefined
      ? overrides.customer_number
      : (autoNormalizeId ? row.normalized_id : row.raw_id);

    const finalOdpId = overrides.odp_id !== undefined
      ? overrides.odp_id
      : (row.matched_odp_id || null);

    setSubmittingRowId(row.id);
    setRowErrors(prev => ({ ...prev, [row.id]: null }));

    try {
      const payload = {
        customer_number: finalCustNumber,
        name: overrides.name || row.name,
        address: overrides.address || row.address,
        odp_id: finalOdpId,
        onu_serial: row.onu_serial,
        rx_power: row.rx_power,
        phone: row.phone || '-',
        interface: row.interface || null,
      };

      const res = await fetch('/api/customers/sobok/import-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.status === 'success') {
        // Mark row as imported in-place
        setRecords(prev => prev.map(r => {
          if (r.id === row.id) {
            return {
              ...r,
              already_exists: true,
              import_status: 'imported',
              exists_by: 'Baru Saja Diimpor',
            };
          }
          return r;
        }));

        // Remove from batch selection
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(row.id);
          return next;
        });

        if (onCustomerImported) {
          onCustomerImported(json.data);
        }
      } else {
        setRowErrors(prev => ({ ...prev, [row.id]: json.message || 'Gagal menambahkan data' }));
      }
    } catch (err) {
      setRowErrors(prev => ({ ...prev, [row.id]: err.message || 'Koneksi error' }));
    } finally {
      setSubmittingRowId(null);
    }
  };

  // Batch import selected rows
  const handleBatchImport = async () => {
    const selectedRows = records.filter(r => selectedIds.has(r.id) && !r.already_exists && r.import_status !== 'imported');
    if (selectedRows.length === 0) return;

    setIsBatchImporting(true);
    let successCount = 0;

    for (const row of selectedRows) {
      await handleImportSingle(row);
      successCount++;
    }

    setIsBatchImporting(false);
  };

  // Toggle selection
  const toggleSelectAllPage = () => {
    const pageSelectable = paginatedRecords.filter(r => !r.already_exists && r.import_status !== 'imported');
    const allSelected = pageSelectable.every(r => selectedIds.has(r.id));

    setSelectedIds(prev => {
      const next = new Set(prev);
      pageSelectable.forEach(r => {
        if (allSelected) next.delete(r.id);
        else next.add(r.id);
      });
      return next;
    });
  };

  const toggleSelectRow = (rowId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-7xl max-h-[95vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-black text-lg border border-amber-500/20">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Tarik &amp; Sinkronisasi Data Pelanggan Sobok
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  sobok.cinoxmedia.net
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ambil ribuan data pelanggan FO, normalisasi ID (CMN), cek ODP kosong, dan verifikasi sebelum ditambahkan ke sistem.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleScrape}
              disabled={isScraping}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {isScraping ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Sedang Menarik Data...</span>
                </>
              ) : (
                <>
                  <span>↻</span>
                  <span>Tarik Ulang Data</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrape Error Alert */}
        {scrapeError && (
          <div className="m-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold">⚠️ Error:</span>
              <span>{scrapeError}</span>
            </div>
            <button
              type="button"
              onClick={handleScrape}
              className="underline font-bold hover:text-rose-900 dark:hover:text-rose-100"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* 6 KPI Ringkasan Data */}
        <div className="p-4 grid grid-cols-2 sm:grid-cols-6 gap-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total di Sobok</span>
            <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-0.5">
              {stats.total_records?.toLocaleString() || 0}
            </div>
            <span className="text-[10px] text-slate-400">Data Pelanggan FO</span>
          </div>

          <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800">
            <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">Validasi OLT</span>
            <div className="text-xl font-black font-mono text-teal-600 dark:text-teal-400 mt-0.5">
              {stats.registered_in_olt_count?.toLocaleString() || 0}
            </div>
            <span className="text-[10px] text-teal-500">SN Ada di OLT ({stats.not_in_olt_count || 0} tidak ada)</span>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">ID CMN Valid</span>
            <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
              {stats.valid_cmn_count?.toLocaleString() || 0}
            </div>
            <span className="text-[10px] text-emerald-500">Awalan CMN Sesuai</span>
          </div>

          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">ID Normalisasi</span>
            <div className="text-xl font-black font-mono text-amber-600 dark:text-amber-400 mt-0.5">
              {stats.needs_normalization_count?.toLocaleString() || 0}
            </div>
            <span className="text-[10px] text-amber-500">Hanya Angka (e.g. 8061)</span>
          </div>

          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Tanpa Data ODP</span>
            <div className="text-xl font-black font-mono text-rose-600 dark:text-rose-400 mt-0.5">
              {stats.no_odp_count?.toLocaleString() || 0}
            </div>
            <span className="text-[10px] text-rose-500">Perlu Penugasan ODP</span>
          </div>

          <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800">
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Sudah di UNMS</span>
            <div className="text-xl font-black font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
              {stats.already_exists_count?.toLocaleString() || 0}
            </div>
            <span className="text-[10px] text-indigo-500">Terdaftar di Sistem</span>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            
            {/* Quick Search */}
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <input
                type="text"
                placeholder="Cari nama, ID, ODP, SN, atau alamat..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Filter Group */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* OLT Filter */}
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-600 dark:text-slate-400">Filter OLT:</span>
                <select
                  value={filterOlt}
                  onChange={e => setFilterOlt(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500 max-w-[210px]"
                >
                  <option value="all">Semua OLT ({records.length.toLocaleString()})</option>
                  {oltList.map(([oltName, count]) => (
                    <option key={oltName} value={oltName}>
                      {oltName} ({count})
                    </option>
                  ))}
                </select>
              </div>

              {/* Validasi OLT Filter */}
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-600 dark:text-slate-400">Validasi OLT:</span>
                <select
                  value={filterOltValidation}
                  onChange={e => setFilterOltValidation(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500"
                >
                  <option value="all">Semua SN ({records.length.toLocaleString()})</option>
                  <option value="in_olt">🟢 Terdaftar di OLT ({stats.registered_in_olt_count || 0})</option>
                  <option value="not_in_olt">⚪ Tidak di OLT ({stats.not_in_olt_count || 0})</option>
                </select>
              </div>

              {/* ODP Filter */}
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-600 dark:text-slate-400">Filter ODP:</span>
                <select
                  value={filterOdp}
                  onChange={e => setFilterOdp(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500"
                >
                  <option value="all">Semua Data ODP</option>
                  <option value="has_odp">Hanya Yang Ada ODP</option>
                  <option value="no_odp">⚠️ Tanpa ODP / Kosong ({stats.no_odp_count})</option>
                </select>
              </div>

              {/* ID Format Filter */}
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-600 dark:text-slate-400">Format ID:</span>
                <select
                  value={filterIdFormat}
                  onChange={e => setFilterIdFormat(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500"
                >
                  <option value="all">Semua Format ID</option>
                  <option value="valid_cmn">Format CMN Valid</option>
                  <option value="needs_normalization">ID Perlu Normalisasi (Angka)</option>
                </select>
              </div>

              {/* UNMS Status Filter */}
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-600 dark:text-slate-400">Status UNMS:</span>
                <select
                  value={filterUnmsStatus}
                  onChange={e => setFilterUnmsStatus(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500"
                >
                  <option value="all">Semua Status</option>
                  <option value="new">Belum Ada (Baru)</option>
                  <option value="exists">Sudah Terdaftar</option>
                </select>
              </div>
            </div>
          </div>

          {/* Normalization Toggle & Bulk Action */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-200/60 dark:border-slate-800/60 text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoNormalizeId}
                onChange={e => setAutoNormalizeId(e.target.checked)}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 dark:border-slate-700 cursor-pointer"
              />
              <span className="font-bold text-slate-700 dark:text-slate-300">
                Otomatis Normalisasi ID Angka ke CMN (contoh: <code className="text-amber-600 dark:text-amber-400">8061</code> ➔ <code className="text-emerald-600 dark:text-emerald-400">CMN8061</code>)
              </span>
            </label>

            {/* Batch Action Button if any selected */}
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={handleBatchImport}
                disabled={isBatchImporting}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {isBatchImporting ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Menambahkan {selectedIds.size} Pelanggan...</span>
                  </>
                ) : (
                  <>
                    <span>+</span>
                    <span>Tambahkan {selectedIds.size} Data Terpilih ke Sistem</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Preview Table Container */}
        <div className="flex-1 overflow-auto min-h-[350px]">
          {isScraping ? (
            <div className="flex flex-col items-center justify-center h-72 gap-3 text-slate-500 dark:text-slate-400">
              <div className="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="font-bold text-sm">Menghubungi Sobok (cinoxmedia.net) &amp; mengekstrak seluruh 2.054 data pelanggan...</p>
              <p className="text-xs text-slate-400">Mohon tunggu beberapa detik...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-500 dark:text-slate-400">
              <span className="text-3xl">🔍</span>
              <p className="font-bold text-sm">Tidak ada data pelanggan yang cocok dengan filter.</p>
              <p className="text-xs">Coba ubah kata kunci pencarian atau reset filter ODP / Format ID.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800/95 backdrop-blur-sm z-10 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={paginatedRecords.length > 0 && paginatedRecords.filter(r => !r.already_exists && r.import_status !== 'imported').every(r => selectedIds.has(r.id))}
                      onChange={toggleSelectAllPage}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                    />
                  </th>
                  <th className="p-3 font-bold text-slate-700 dark:text-slate-300">ID Pelanggan (Sobok ➔ UNMS)</th>
                  <th className="p-3 font-bold text-slate-700 dark:text-slate-300">Nama Pelanggan</th>
                  <th className="p-3 font-bold text-slate-700 dark:text-slate-300">Titik ODP</th>
                  <th className="p-3 font-bold text-slate-700 dark:text-slate-300">Alamat / Daerah</th>
                  <th className="p-3 font-bold text-slate-700 dark:text-slate-300">Serial Number (SN) &amp; Interface</th>
                  <th className="p-3 font-bold text-slate-700 dark:text-slate-300">Redaman</th>
                  <th className="p-3 font-bold text-slate-700 dark:text-slate-300 text-center w-48">Aksi Verifikasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {paginatedRecords.map((row) => {
                  const overrides = rowOverrides[row.id] || {};
                  const isAlreadyExists = row.already_exists || row.import_status === 'imported';
                  const isRowSubmitting = submittingRowId === row.id;
                  const rowErr = rowErrors[row.id];

                  // Target ID to display/import
                  const targetId = overrides.customer_number !== undefined
                    ? overrides.customer_number
                    : (autoNormalizeId ? row.normalized_id : row.raw_id);

                  // ODP Selection
                  const isOdpOverridden = overrides.odp_id !== undefined;
                  const selectedOdpId = isOdpOverridden
                    ? overrides.odp_id
                    : (row.matched_odp_id || null);
                  const isManualOdp = isOdpOverridden && overrides.odp_id !== row.matched_odp_id;

                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${
                        isAlreadyExists ? 'bg-slate-50/40 dark:bg-slate-900/30 opacity-80' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          disabled={isAlreadyExists}
                          checked={selectedIds.has(row.id)}
                          onChange={() => toggleSelectRow(row.id)}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 dark:border-slate-700 disabled:opacity-30 cursor-pointer"
                        />
                      </td>

                      {/* ID Pelanggan */}
                      <td className="p-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-xs text-indigo-600 dark:text-indigo-400">
                              {targetId}
                            </span>
                            {row.needs_normalization && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                                Normalisasi
                              </span>
                            )}
                          </div>
                          {row.needs_normalization && (
                            <span className="block text-[10px] font-mono text-slate-400">
                              Asli Sobok: {row.raw_id || '—'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Nama Pelanggan */}
                      <td className="p-3">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {row.name || '—'}
                        </div>
                        {rowErr && (
                          <div className="text-[10px] text-rose-500 font-semibold mt-0.5">
                            ⚠️ {rowErr}
                          </div>
                        )}
                      </td>

                      {/* ODP */}
                      <td className="p-3 min-w-[210px] max-w-[260px]">
                        {isAlreadyExists ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-md font-mono font-bold text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                                {row.raw_odp || '—'}
                              </span>
                              {row.matched_odp_name && (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                  ({row.matched_odp_name})
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {/* Raw info & Status match */}
                            <div className="flex flex-wrap items-center justify-between gap-1 text-[10px]">
                              <div className="flex items-center gap-1">
                                <span className="text-slate-400 font-medium">Sobok:</span>
                                <span className={`font-mono font-bold px-1.5 py-0.5 rounded border ${
                                  row.has_odp
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                                }`}>
                                  {row.raw_odp || 'Kosong'}
                                </span>
                              </div>

                              {/* Status Badge */}
                              {isManualOdp ? (
                                <div className="flex items-center gap-1">
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                    ✏️ Pilihan Manual
                                  </span>
                                  {row.matched_odp_id && (
                                    <button
                                      type="button"
                                      onClick={() => handleRowOverrideChange(row.id, 'odp_id', row.matched_odp_id)}
                                      title="Kembalikan ke hasil auto-match"
                                      className="text-[9px] text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 underline cursor-pointer"
                                    >
                                      Reset
                                    </button>
                                  )}
                                </div>
                              ) : row.matched_odp_id ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                  ✓ Auto-Match
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                                  Wajib Pilih
                                </span>
                              )}
                            </div>

                            {/* Searchable Dropdown to pick or change ODP */}
                            <RowOdpPicker
                              row={row}
                              selectedOdpId={selectedOdpId}
                              odpOptions={odpOptions}
                              isManualOdp={isManualOdp}
                              onSelectOdp={(val) => handleRowOverrideChange(row.id, 'odp_id', val ? parseInt(val) : null)}
                              onResetOdp={() => handleRowOverrideChange(row.id, 'odp_id', row.matched_odp_id || null)}
                            />
                          </div>
                        )}
                      </td>

                      {/* Alamat / Daerah */}
                      <td className="p-3 text-slate-600 dark:text-slate-300 max-w-xs truncate" title={row.address}>
                        {row.address || '—'}
                      </td>

                      {/* Serial Number & Interface */}
                      <td className="p-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                            {row.onu_serial || '—'}
                          </span>
                          {/* Validasi OLT Status Badge */}
                          {row.is_registered_in_olt ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              <span>Ada di OLT</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-medium bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                              <span>Tdk Ada di OLT</span>
                            </span>
                          )}
                          {row.is_duplicate_sn && (
                            <span
                              title={`SN ini juga digunakan oleh ${row.duplicate_with || 'pelanggan lain'}`}
                              className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shrink-0 cursor-help"
                            >
                              <span>⚠️ SN Berbagi/Kembar</span>
                            </span>
                          )}
                        </div>

                        <div className="text-[10px] font-mono mt-1 flex flex-wrap items-center gap-1">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            {row.olt || 'OLT'}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400">
                            {row.interface || '—'} (Port {row.port_onu || '1'})
                          </span>
                          {row.olt_details?.rx_power && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold ml-1">
                              [Live: {row.olt_details.rx_power} dBm]
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Redaman */}
                      <td className="p-3">
                        {row.redaman ? (
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {row.redaman}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">—</span>
                        )}
                      </td>

                      {/* Per-Row Action Button */}
                      <td className="p-3 text-center">
                        {isAlreadyExists ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-[11px]">
                            <span>✓</span>
                            <span>Sudah di Sistem</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleImportSingle(row)}
                            disabled={isRowSubmitting}
                            className="w-full py-1.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            {isRowSubmitting ? (
                              <>
                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Menyimpan...</span>
                              </>
                            ) : (
                              <>
                                <span>+</span>
                                <span>Tambahkan ke Sistem</span>
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal Footer / Pagination */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
            <span>
              Menampilkan {filteredRecords.length > 0 ? (currentPage - 1) * perPage + 1 : 0} - {Math.min(currentPage * perPage, filteredRecords.length)} dari {filteredRecords.length.toLocaleString()} pelanggan
            </span>
            <div className="flex items-center gap-1">
              <span>Per halaman:</span>
              <select
                value={perPage}
                onChange={e => {
                  setPerPage(parseInt(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              >
                <option value={15}>15</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {/* Page Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage <= 1}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold"
            >
              «
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold"
            >
              ‹ Prev
            </button>
            <span className="px-3 py-1.5 font-bold text-slate-800 dark:text-slate-200 font-mono">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold"
            >
              Next ›
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage >= totalPages}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold"
            >
              »
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
