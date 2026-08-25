import React, { useState, useEffect, useRef, useMemo } from 'react';

/* ══════════════════════════════════════════════════════════════════
   SVG ICONS (Clean & Professional Enterprise Style)
══════════════════════════════════════════════════════════════════ */
const Icons = {
  Search: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  MapPin: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Swap: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  ),
  Zap: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  Layers: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  Eye: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ),
  Globe: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Send: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  ),
  Telegram: () => (
    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.121l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.458c.538-.196 1.006.128.832.943z"/>
    </svg>
  ),
  ExternalLink: () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  ),
  Check: () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
    </svg>
  ),
  ChevronDown: ({ open }) => (
    <svg className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
    </svg>
  ),
  Sliders: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    </svg>
  ),
  AlertTriangle: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  Tool: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  Users: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
};

/* ══════════════════════════════════════════════════════════════════
   STREET VIEW MODAL COMPONENT
══════════════════════════════════════════════════════════════════ */
function StreetViewModal({ lat, lng, title, onClose }) {
  if (!lat || !lng) return null;
  const embedUrl = `https://maps.google.com/maps?q=&layer=c&cbll=${lat},${lng}&cbp=11,0,0,0,0&output=svembed`;
  const directUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between flex-shrink-0 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2 text-slate-100">
              <Icons.Eye />
              Google Street View 360° — Titik Putus Serat Optik
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{title || `Koordinat: ${lat}, ${lng}`}</p>
          </div>
          <div className="flex items-center space-x-2">
            <a
              href={directUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shadow-xs"
            >
              <span>Buka di Tab Baru</span>
              <Icons.ExternalLink />
            </a>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white font-bold transition-all"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-[440px] bg-slate-950 relative">
          <iframe
            title="Street View 360"
            src={embedUrl}
            className="w-full h-full min-h-[440px] border-0"
            allowFullScreen
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   NODE TYPE BADGE HELPER (Muted Enterprise Palette)
══════════════════════════════════════════════════════════════════ */
const getNodeBadge = (type) => {
  switch (type) {
    case 'POP':
      return { label: 'POP', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800' };
    case 'ODC':
      return { label: 'ODC', bg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800' };
    case 'ODP':
      return { label: 'ODP', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' };
    case 'BTS':
      return { label: 'BTS', bg: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800' };
    case 'CLOSURE':
      return { label: 'CLOSURE', bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800' };
    default:
      return { label: type || 'NODE', bg: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' };
  }
};

/* ══════════════════════════════════════════════════════════════════
   SEARCHABLE NODE DROPDOWN COMPONENT (Clean & Professional)
══════════════════════════════════════════════════════════════════ */
function SearchableNodeSelect({
  nodes = [],
  value,
  onChange,
  placeholder = 'Pilih Node...',
  searchPlaceholder = 'Cari nama node, kode, atau alamat...',
  filterTab = 'ALL',
  onTabChange,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  const selectedNode = useMemo(() => {
    return nodes.find(n => String(n.id) === String(value));
  }, [nodes, value]);

  const filteredNodes = useMemo(() => {
    let list = nodes;
    if (filterTab !== 'ALL') {
      list = list.filter(n => n.type === filterTab);
    }
    if (!search.trim()) return list;

    const q = search.toLowerCase();
    return list.filter(n =>
      (n.name && n.name.toLowerCase().includes(q)) ||
      (n.type && n.type.toLowerCase().includes(q)) ||
      (n.code && n.code.toLowerCase().includes(q)) ||
      (n.address && n.address.toLowerCase().includes(q))
    );
  }, [nodes, filterTab, search]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSelect = (nodeId) => {
    onChange(nodeId);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full text-left bg-white dark:bg-slate-900 border rounded-xl p-3 flex items-center justify-between gap-3 shadow-2xs transition-all cursor-pointer ${
          isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20 dark:border-blue-500'
            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
        }`}
      >
        <div className="flex items-center gap-2.5 overflow-hidden flex-1">
          {selectedNode ? (
            <>
              {(() => {
                const badge = getNodeBadge(selectedNode.type);
                return (
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 border ${badge.bg}`}>
                    {badge.label}
                  </span>
                );
              })()}
              <div className="flex flex-col truncate">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                  {selectedNode.name}
                </span>
                {selectedNode.address && (
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                    {selectedNode.address}
                  </span>
                )}
              </div>
            </>
          ) : (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
          <Icons.ChevronDown open={isOpen} />
        </div>
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-[500] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 flex flex-col max-h-[360px]">

          {/* Sticky Header: Search Input & Category Filter Tabs */}
          <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 space-y-2 shrink-0">
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400">
                <Icons.Search />
              </span>
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {onTabChange && (
              <div className="flex flex-wrap gap-1 text-[10px]">
                {['ALL', 'POP', 'ODC', 'ODP', 'BTS'].map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => onTabChange(tab)}
                    className={`px-2 py-0.5 rounded-md font-semibold transition-all ${
                      filterTab === tab
                        ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {tab === 'ALL' ? 'Semua' : tab}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* List of Filtered Nodes */}
          <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 flex-1 p-1">
            {filteredNodes.length > 0 ? (
              filteredNodes.map(n => {
                const isSelected = String(n.id) === String(value);
                const badge = getNodeBadge(n.type);

                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleSelect(n.id)}
                    className={`w-full p-2 rounded-lg text-left flex items-center justify-between gap-2.5 transition-all ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden flex-1">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 border ${badge.bg}`}>
                        {badge.label}
                      </span>
                      <div className="flex flex-col truncate">
                        <span className={`text-xs font-semibold truncate ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-slate-800 dark:text-slate-200'}`}>
                          {n.name}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate">
                          {n.address || (n.code ? `Kode: ${n.code}` : 'Node terdaftar')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {n.total_ports > 0 && (
                        <span className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          {n.used_ports || 0}/{n.total_ports} Port
                        </span>
                      )}
                      {isSelected && (
                        <span className="text-blue-600 dark:text-blue-400">
                          <Icons.Check />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">
                Tidak ada node yang cocok dengan "{search}"
              </div>
            )}
          </div>

          <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 flex items-center justify-between shrink-0">
            <span>{filteredNodes.length} node ditemukan</span>
            <span>Klik untuk memilih</span>
          </div>

        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SEARCHABLE CABLE DROPDOWN COMPONENT (Clean & Professional)
══════════════════════════════════════════════════════════════════ */
function SearchableCableSelect({
  cables = [],
  value,
  onChange,
  placeholder = 'Auto-detect kabel berdasarkan node (atau pilih manual)...',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  const selectedCable = useMemo(() => {
    return cables.find(c => String(c.id) === String(value));
  }, [cables, value]);

  const filteredCables = useMemo(() => {
    if (!search.trim()) return cables;
    const q = search.toLowerCase();
    return cables.filter(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.installation_type && c.installation_type.toLowerCase().includes(q)) ||
      (c.from_node?.name && c.from_node.name.toLowerCase().includes(q)) ||
      (c.to_node?.name && c.to_node.name.toLowerCase().includes(q))
    );
  }, [cables, search]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSelect = (cableId) => {
    onChange(cableId);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full text-left bg-slate-50 dark:bg-slate-800/60 border rounded-xl p-3 flex items-center justify-between gap-3 shadow-2xs transition-all cursor-pointer ${
          isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20 bg-white dark:bg-slate-900'
            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
        }`}
      >
        <div className="flex items-center gap-2.5 overflow-hidden flex-1">
          {selectedCable ? (
            <>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 shrink-0">
                {selectedCable.core_count_total}C
              </span>
              <div className="flex flex-col truncate">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                  {selectedCable.name}
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                  {selectedCable.length_meters}m · {selectedCable.installation_type || 'Aerial'} {selectedCable.route_coordinates?.length ? `· ${selectedCable.route_coordinates.length} Tiang GIS` : ''}
                </span>
              </div>
            </>
          ) : (
            <span className="text-xs text-slate-400 dark:text-slate-500 truncate">
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
          <Icons.ChevronDown open={isOpen} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-[500] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 flex flex-col max-h-[340px]">

          <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400">
                <Icons.Search />
              </span>
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kabel atau bentangan..."
                className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600 font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 flex-1 p-1">
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={`w-full p-2 rounded-lg text-left flex items-center justify-between gap-2 transition-all ${
                !value ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Auto-Detect Berdasarkan Node
                </span>
                <span className="text-[10px] text-slate-400">
                  Sistem mencari kabel penghubung atau menarik kontur jalan GIS
                </span>
              </div>
              {!value && <span className="text-blue-600 dark:text-blue-400"><Icons.Check /></span>}
            </button>

            {filteredCables.map(c => {
              const isSelected = String(c.id) === String(value);

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelect(c.id)}
                  className={`w-full p-2 rounded-lg text-left flex items-center justify-between gap-2.5 transition-all ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden flex-1">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 shrink-0">
                      {c.core_count_total}C
                    </span>
                    <div className="flex flex-col truncate">
                      <span className={`text-xs font-semibold truncate ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-slate-800 dark:text-slate-200'}`}>
                        {c.name}
                      </span>
                      <span className="text-[10px] text-slate-400 truncate">
                        {c.from_node?.name || 'Node Awal'} ➔ {c.to_node?.name || 'Node Sasaran'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      {c.length_meters}m
                    </span>
                    {isSelected && (
                      <span className="text-blue-600 dark:text-blue-400">
                        <Icons.Check />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 flex items-center justify-between shrink-0">
            <span>{filteredCables.length} kabel ditemukan</span>
            <span>Klik untuk memilih</span>
          </div>

        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   LEAFLET MAP COMPONENT (Professional Minimal Markers)
══════════════════════════════════════════════════════════════════ */
function OtdrMap({ fromNode, toNode, estimatedLocation, waypoints, onOpenStreetView }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const leafletRef = useRef(null);
  const tileLayerRef = useRef(null);
  const layersGroupRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isSatellite, setIsSatellite] = useState(true);

  useEffect(() => {
    import('leaflet').then(L => {
      leafletRef.current = L.default || L;
      const Lf = leafletRef.current;

      delete Lf.Icon.Default.prototype._getIconUrl;
      Lf.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (!mapInstanceRef.current && mapRef.current) {
        const centerLat = estimatedLocation?.lat || -0.787123;
        const centerLng = estimatedLocation?.lng || 100.654123;

        const map = Lf.map(mapRef.current, {
          center: [centerLat, centerLng],
          zoom: 15,
          zoomControl: true,
        });

        const satUrl = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
        tileLayerRef.current = Lf.tileLayer(satUrl, {
          maxZoom: 20,
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        }).addTo(map);

        layersGroupRef.current = Lf.layerGroup().addTo(map);
        mapInstanceRef.current = map;
        setMapLoaded(true);
      }
    }).catch(err => console.error('Failed to load Leaflet:', err));

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const toggleMapMode = () => {
    if (!mapInstanceRef.current || !leafletRef.current || !tileLayerRef.current) return;
    const Lf = leafletRef.current;
    const map = mapInstanceRef.current;

    map.removeLayer(tileLayerRef.current);
    const nextMode = !isSatellite;
    setIsSatellite(nextMode);

    if (nextMode) {
      tileLayerRef.current = Lf.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', { maxZoom: 20 });
    } else {
      tileLayerRef.current = Lf.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });
    }
    tileLayerRef.current.addTo(map);
  };

  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !leafletRef.current || !layersGroupRef.current) return;
    const Lf = leafletRef.current;
    const map = mapInstanceRef.current;
    const layerGroup = layersGroupRef.current;

    layerGroup.clearLayers();

    if (!fromNode || !toNode || !estimatedLocation) return;

    const points = [];

    // From Node Marker
    if (fromNode.lat && fromNode.lng) {
      points.push([fromNode.lat, fromNode.lng]);
      const fromIcon = Lf.divIcon({
        className: 'custom-otdr-marker',
        html: `
          <div style="background:#0f766e; color:white; font-weight:700; font-size:10px; padding:3px 8px; border-radius:6px; border:1px solid rgba(255,255,255,0.8); box-shadow:0 2px 6px rgba(0,0,0,0.3); white-space:nowrap;">
            Asal: ${fromNode.name}
          </div>
        `,
        iconSize: [120, 24],
        iconAnchor: [60, 12],
      });
      Lf.marker([fromNode.lat, fromNode.lng], { icon: fromIcon })
        .bindPopup(`<b>Titik Penembakan OTDR</b><br/>${fromNode.name}`)
        .addTo(layerGroup);
    }

    // Waypoints
    if (Array.isArray(waypoints) && waypoints.length > 0) {
      waypoints.forEach((wp) => {
        if (wp.lat && wp.lng) {
          points.push([wp.lat, wp.lng]);
        }
      });
    }

    // To Node Marker
    if (toNode.lat && toNode.lng) {
      points.push([toNode.lat, toNode.lng]);
      const toIcon = Lf.divIcon({
        className: 'custom-otdr-marker',
        html: `
          <div style="background:#6d28d9; color:white; font-weight:700; font-size:10px; padding:3px 8px; border-radius:6px; border:1px solid rgba(255,255,255,0.8); box-shadow:0 2px 6px rgba(0,0,0,0.3); white-space:nowrap;">
            Tujuan: ${toNode.name}
          </div>
        `,
        iconSize: [120, 24],
        iconAnchor: [60, 12],
      });
      Lf.marker([toNode.lat, toNode.lng], { icon: toIcon })
        .bindPopup(`<b>Titik Lokasi Sasaran</b><br/>${toNode.name}`)
        .addTo(layerGroup);
    }

    // Breakpoint Marker
    const breakLat = estimatedLocation.lat;
    const breakLng = estimatedLocation.lng;

    const createBreakIcon = () => Lf.divIcon({
      className: 'custom-break-marker',
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center;">
          <div style="
            position: absolute;
            width: 36px;
            height: 36px;
            background-color: rgba(225, 29, 72, 0.4);
            border-radius: 50%;
            animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
          "></div>
          <div style="
            background: #be123c;
            color: white;
            font-weight: 800;
            font-size: 10px;
            padding: 5px 10px;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            border: 1.5px solid white;
            white-space: nowrap;
            display: flex;
            align-items: center;
            gap: 4px;
            z-index: 10;
          ">
            <span>Titik Putus Kabel</span>
          </div>
        </div>
      `,
      iconSize: [140, 36],
      iconAnchor: [70, 18],
    });

    Lf.marker([breakLat, breakLng], { icon: createBreakIcon() })
      .bindPopup(`<b>Titik Putus Serat Optik</b><br/>Koordinat: ${breakLat}, ${breakLng}<br/>${estimatedLocation.nearest_landmark || ''}`)
      .addTo(layerGroup);

    // Cable Line
    if (points.length >= 2) {
      Lf.polyline(points, {
        color: '#f59e0b',
        weight: 5,
        opacity: 0.9,
        dashArray: '6, 6',
      }).addTo(layerGroup);

      const bounds = Lf.latLngBounds([...points, [breakLat, breakLng]]);
      map.fitBounds(bounds, { padding: [45, 45] });
    }
  }, [mapLoaded, fromNode, toNode, estimatedLocation, waypoints]);

  return (
    <div className="relative w-full h-[440px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner">
      <div ref={mapRef} className="w-full h-full" />

      <div className="absolute top-3 right-3 z-[400] flex items-center space-x-2">
        <button
          onClick={toggleMapMode}
          className="px-3 py-1.5 bg-slate-900/90 hover:bg-slate-900 text-white font-semibold text-xs rounded-lg shadow border border-slate-700 backdrop-blur-xs transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Icons.Globe />
          <span>{isSatellite ? 'Peta Vektor' : 'Peta Satelit'}</span>
        </button>

        {estimatedLocation && (
          <button
            onClick={() => onOpenStreetView(estimatedLocation.lat, estimatedLocation.lng, `Titik Putus: ${estimatedLocation.nearest_landmark}`)}
            className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-semibold text-xs rounded-lg shadow transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Icons.Eye />
            <span>Street View 360°</span>
          </button>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN OTDR FAULT TRACING COMPONENT
══════════════════════════════════════════════════════════════════ */
export default function OtdrFaultTracing() {
  const [cables, setCables] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [selectedStartNodeId, setSelectedStartNodeId] = useState('');
  const [selectedEndNodeId, setSelectedEndNodeId] = useState('');
  const [selectedCableId, setSelectedCableId] = useState('');
  const [startNodeTypeFilter, setStartNodeTypeFilter] = useState('ALL');
  const [endNodeTypeFilter, setEndNodeTypeFilter] = useState('ALL');

  // Meter & Slack States
  const [distance, setDistance] = useState('350');
  const [slackCount, setSlackCount] = useState('0');
  const [slackLengthPerLoop, setSlackLengthPerLoop] = useState('20');
  const [slackPercentage, setSlackPercentage] = useState('0');
  const [slackPreset, setSlackPreset] = useState('none');

  const [loadingData, setLoadingData] = useState(true);
  const [tracing, setTracing] = useState(false);
  const [traceResult, setTraceResult] = useState(null);
  const [dispatchingTelegram, setDispatchingTelegram] = useState(false);
  const [telegramSentNotice, setTelegramSentNotice] = useState(null);
  const [streetViewTarget, setStreetViewTarget] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/fault-tracing/cables').then(r => r.json()),
      fetch('/api/fault-tracing/nodes').then(r => r.json()),
    ])
      .then(([cablesRes, nodesRes]) => {
        const cablesData = cablesRes.data || [];
        const nodesData = nodesRes.data || [];
        setCables(cablesData);
        setNodes(nodesData);

        if (nodesData.length > 0) {
          const popNode = nodesData.find(n => n.type === 'POP') || nodesData[0];
          const targetNode = nodesData.find(n => n.id !== popNode.id && (n.type === 'ODC' || n.type === 'ODP')) || nodesData[1] || nodesData[0];

          setSelectedStartNodeId(popNode.id);
          setSelectedEndNodeId(targetNode ? targetNode.id : '');

          if (cablesData.length > 0) {
            const matching = cablesData.find(c =>
              (String(c.from_node_id) === String(popNode.id) && String(c.to_node_id) === String(targetNode?.id)) ||
              (String(c.from_node_id) === String(targetNode?.id) && String(c.to_node_id) === String(popNode.id))
            );
            if (matching) {
              setSelectedCableId(matching.id);
              setDistance(String(Math.round(matching.length_meters * 0.4)));
            } else {
              setSelectedCableId(cablesData[0].id);
              setDistance(String(Math.round(cablesData[0].length_meters * 0.4)));
            }
          }
        }
        setLoadingData(false);
      })
      .catch(err => {
        console.error('Failed to load OTDR tracing data:', err);
        setLoadingData(false);
      });
  }, []);

  const activeCable = useMemo(() => {
    return cables.find(c => String(c.id) === String(selectedCableId));
  }, [cables, selectedCableId]);

  const handleStartNodeChange = (newStartId) => {
    setSelectedStartNodeId(newStartId);
    if (!newStartId || !selectedEndNodeId) return;

    const matching = cables.find(c =>
      (String(c.from_node_id) === String(newStartId) && String(c.to_node_id) === String(selectedEndNodeId)) ||
      (String(c.from_node_id) === String(selectedEndNodeId) && String(c.to_node_id) === String(newStartId))
    );
    if (matching) {
      setSelectedCableId(matching.id);
    }
  };

  const handleEndNodeChange = (newEndId) => {
    setSelectedEndNodeId(newEndId);
    if (!newEndId || !selectedStartNodeId) return;

    const matching = cables.find(c =>
      (String(c.from_node_id) === String(selectedStartNodeId) && String(c.to_node_id) === String(newEndId)) ||
      (String(c.from_node_id) === String(newEndId) && String(c.to_node_id) === String(selectedStartNodeId))
    );
    if (matching) {
      setSelectedCableId(matching.id);
    }
  };

  const handleSwapDirection = () => {
    const prevStart = selectedStartNodeId;
    const prevEnd = selectedEndNodeId;
    setSelectedStartNodeId(prevEnd);
    setSelectedEndNodeId(prevStart);
  };

  const handleCableSelect = (cableId) => {
    setSelectedCableId(cableId);
    const selected = cables.find(c => String(c.id) === String(cableId));
    if (selected) {
      if (selected.from_node_id) setSelectedStartNodeId(selected.from_node_id);
      if (selected.to_node_id) setSelectedEndNodeId(selected.to_node_id);
      if (parseFloat(distance) > selected.length_meters) {
        setDistance(String(Math.round(selected.length_meters / 2)));
      }
    }
  };

  const applySlackPreset = (preset) => {
    setSlackPreset(preset);
    if (preset === 'none') {
      setSlackCount('0');
      setSlackLengthPerLoop('0');
      setSlackPercentage('0');
    } else if (preset === 'custom') {
      if (slackCount === '0' || !slackCount) setSlackCount('1');
      if (slackLengthPerLoop === '0' || !slackLengthPerLoop) setSlackLengthPerLoop('20');
    }
  };

  const maxDistance = activeCable ? activeCable.length_meters : 2000;
  const currentDistanceNum = parseFloat(distance) || 0;
  const parsedSlackCount = parseInt(slackCount) || 0;
  const parsedSlackLen = parseFloat(slackLengthPerLoop) || 0;
  const parsedSlackPct = parseFloat(slackPercentage) || 0;

  const calculatedTotalSlack = (parsedSlackCount * parsedSlackLen) + (currentDistanceNum * (parsedSlackPct / 100));
  const calculatedEffectiveGroundDistance = Math.max(1, Math.round(currentDistanceNum - calculatedTotalSlack));
  const remainingDistanceCalc = Math.max(0, maxDistance - calculatedEffectiveGroundDistance);

  const handleTrace = (e) => {
    if (e) e.preventDefault();
    setTracing(true);
    setTelegramSentNotice(null);

    fetch('/api/fault-tracing/trace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        distance_meters: currentDistanceNum,
        cable_id: selectedCableId || null,
        start_node_id: selectedStartNodeId || null,
        end_node_id: selectedEndNodeId || null,
        slack_count: parsedSlackCount,
        slack_length_per_loop: parsedSlackLen,
        slack_percentage: parsedSlackPct,
      }),
    })
      .then(res => res.json())
      .then(data => {
        setTraceResult(data);
        setTracing(false);
      })
      .catch(err => {
        console.error(err);
        setTracing(false);
      });
  };

  const handleDispatchTelegram = () => {
    if (!traceResult || !traceResult.telegram_payload) return;
    setDispatchingTelegram(true);

    fetch('/api/fault-tracing/dispatch-telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: traceResult.telegram_payload.title,
        message: traceResult.telegram_payload.message,
        latitude: traceResult.estimated_location?.lat,
        longitude: traceResult.estimated_location?.lng,
      }),
    })
      .then(res => res.json())
      .then(data => {
        setDispatchingTelegram(false);
        setTelegramSentNotice(data.message || 'Alert maintenance berhasil disiarkan ke Telegram channel NOC.');
      })
      .catch(err => {
        console.error(err);
        setDispatchingTelegram(false);
      });
  };

  const setPresetDistance = (val) => {
    const clamped = Math.max(0, Math.min(maxDistance, Math.round(val)));
    setDistance(String(clamped));
  };

  return (
    <div className="space-y-5">
      {/* Top Banner Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-lg">
              <Icons.Zap />
            </span>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              OTDR Optical Fault Tracing
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Kalkulasi titik putus kabel optik dua arah dengan kalibrasi speran rute jalan GIS dan dispatch Telegram.
          </p>
        </div>

        {traceResult && (
          <div className="flex items-center gap-2">
            {traceResult.telegram_payload?.share_url && (
              <a
                href={traceResult.telegram_payload.share_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
              >
                <Icons.Telegram />
                <span>Share Telegram</span>
              </a>
            )}
            <a
              href={traceResult.estimated_location?.google_maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
            >
              <Icons.MapPin />
              <span>Google Maps</span>
            </a>
          </div>
        )}
      </div>

      {/* Main Form Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-2xs space-y-5">
        <form onSubmit={handleTrace} className="space-y-5">

          {/* Section 1: Dynamic Two-Way Node Selector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">

            {/* Step 1: Titik Asal Penembakan (Origin) */}
            <div className="lg:col-span-5 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 p-3.5 rounded-xl space-y-2.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                1. Titik Asal Penembakan (Origin)
              </label>

              {loadingData ? (
                <div className="py-2.5 px-3 bg-white dark:bg-slate-900 rounded-lg text-xs text-slate-400 animate-pulse border border-slate-200 dark:border-slate-700">
                  Memuat data node...
                </div>
              ) : (
                <SearchableNodeSelect
                  nodes={nodes}
                  value={selectedStartNodeId}
                  onChange={handleStartNodeChange}
                  placeholder="Pilih Titik Asal Penembakan..."
                  searchPlaceholder="Cari nama POP, ODC, ODP, atau alamat..."
                  filterTab={startNodeTypeFilter}
                  onTabChange={setStartNodeTypeFilter}
                />
              )}
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Pilih POP jika dari sentral, atau ODC / ODP jika menembak langsung dari tiang.
              </p>
            </div>

            {/* Swap Button */}
            <div className="lg:col-span-2 flex flex-col items-center justify-center py-1">
              <button
                type="button"
                onClick={handleSwapDirection}
                title="Tukar Arah Penembakan"
                className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-xs transition-all cursor-pointer hover:scale-105 active:scale-95"
              >
                <Icons.Swap />
              </button>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">
                Tukar
              </span>
            </div>

            {/* Step 2: Titik Sasaran (Destination) */}
            <div className="lg:col-span-5 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 p-3.5 rounded-xl space-y-2.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                2. Titik Lokasi Sasaran (Destination)
              </label>

              {loadingData ? (
                <div className="py-2.5 px-3 bg-white dark:bg-slate-900 rounded-lg text-xs text-slate-400 animate-pulse border border-slate-200 dark:border-slate-700">
                  Memuat data node...
                </div>
              ) : (
                <SearchableNodeSelect
                  nodes={nodes}
                  value={selectedEndNodeId}
                  onChange={handleEndNodeChange}
                  placeholder="Pilih Titik Sasaran..."
                  searchPlaceholder="Cari nama sasaran ODC, ODP, atau BTS..."
                  filterTab={endNodeTypeFilter}
                  onTabChange={setEndNodeTypeFilter}
                />
              )}
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Pilih titik sasaran bentangan kabel fiber (ODC atau ODP tujuan).
              </p>
            </div>

          </div>

          {/* Section 2: Bentangan Kabel & Pengukuran Jarak */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3 border-t border-slate-100 dark:border-slate-800">

            {/* Cable Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  3. Segmen Kabel Fiber Optik
                </label>
                {activeCable && (
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                    Total: {activeCable.length_meters}m · {activeCable.core_count_total} Core
                  </span>
                )}
              </div>

              {loadingData ? (
                <div className="py-2.5 px-3 bg-white dark:bg-slate-900 rounded-lg text-xs text-slate-400 animate-pulse border border-slate-200 dark:border-slate-700">
                  Memuat data kabel...
                </div>
              ) : (
                <SearchableCableSelect
                  cables={cables}
                  value={selectedCableId}
                  onChange={handleCableSelect}
                />
              )}

              {activeCable ? (
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-lg text-xs flex items-center justify-between flex-wrap gap-2">
                  <span className="text-slate-600 dark:text-slate-300">
                    {activeCable.from_node?.name || 'Pangkal'} ➔ {activeCable.to_node?.name || 'Ujung'}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 font-medium">
                    {activeCable.route_coordinates?.length ? `${activeCable.route_coordinates.length} Tiang GIS Terdaftar` : 'Rute Jalan Standar (OSRM)'}
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Sistem otomatis mencari rute jalan riil (Road GIS) antar kedua node jika kabel tidak dipilih manual.
                </p>
              )}
            </div>

            {/* Distance Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  4. Jarak Pengukuran OTDR
                </label>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Span Max: <strong className="font-mono text-slate-700 dark:text-slate-300">{maxDistance}m</strong>
                </span>
              </div>

              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max={maxDistance}
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  placeholder="0"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-slate-100 font-mono text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-inner"
                />
                <span className="absolute right-3.5 top-3 text-slate-400 font-mono text-xs font-semibold">
                  Meter OTDR
                </span>
              </div>

              <input
                type="range"
                min="0"
                max={maxDistance}
                value={currentDistanceNum}
                onChange={(e) => setDistance(e.target.value)}
                className="w-full accent-blue-600 cursor-pointer"
              />

              <div className="flex flex-wrap items-center justify-between gap-1 pt-0.5">
                <div className="flex items-center gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setPresetDistance(currentDistanceNum - 50)}
                    className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono font-semibold rounded"
                  >
                    -50m
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetDistance(currentDistanceNum + 50)}
                    className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono font-semibold rounded"
                  >
                    +50m
                  </button>
                </div>

                <div className="flex items-center gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setPresetDistance(maxDistance * 0.25)}
                    className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded"
                  >
                    25%
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetDistance(maxDistance * 0.5)}
                    className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded"
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetDistance(maxDistance * 0.75)}
                    className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded"
                  >
                    75%
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetDistance(maxDistance)}
                    className="px-2 py-0.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold rounded"
                  >
                    Max
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* Section 3: Analisa & Kalibrasi Speran Kabel */}
          <div className="bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 p-4 rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Icons.Sliders />
                  <span>5. Kompensasi Speran Kabel (Slack / Reserve Loop)</span>
                </h4>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                  Kompensasi gulungan cadangan kabel di tiang / closure agar letak titik putus pada rute jalan akurat.
                </p>
              </div>

              <div className="px-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-right">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Jarak Efektif Jalan (GIS)</span>
                <span className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">
                  {calculatedEffectiveGroundDistance} <span className="text-xs font-normal text-slate-500">Meter</span>
                </span>
              </div>
            </div>

            {/* Slack Mode Switcher: Only Tanpa Speran & Kustom */}
            <div className="flex items-center gap-2 text-xs">
              {[
                { id: 'none', label: 'Tanpa Speran (0m)' },
                { id: 'custom', label: 'Kustom' },
              ].map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applySlackPreset(p.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    slackPreset === p.id
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-2xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom Inputs for Slack (Displayed when Kustom is selected) */}
            {slackPreset === 'custom' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 animate-in fade-in duration-150">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Jumlah Titik Speran
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={slackCount}
                      onChange={(e) => {
                        setSlackCount(e.target.value);
                        setSlackPreset('custom');
                      }}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-slate-800 dark:text-slate-100 text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-1.5 text-slate-400 text-xs">Titik</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Panjang per Speran
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="5"
                      value={slackLengthPerLoop}
                      onChange={(e) => {
                        setSlackLengthPerLoop(e.target.value);
                        setSlackPreset('custom');
                      }}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-slate-800 dark:text-slate-100 text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-1.5 text-slate-400 text-xs">m / Loop</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Faktor Lendutan (Sagging)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={slackPercentage}
                      onChange={(e) => {
                        setSlackPercentage(e.target.value);
                        setSlackPreset('custom');
                      }}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-slate-800 dark:text-slate-100 text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-1.5 text-slate-400 text-xs">%</span>
                  </div>
                </div>
              </div>
            )}

            {calculatedTotalSlack > 0 && (
              <div className="p-2 bg-slate-100 dark:bg-slate-800/80 rounded-lg text-[11px] text-slate-600 dark:text-slate-300 flex items-center justify-between flex-wrap gap-2">
                <span>
                  Total Kompensasi: <strong>{calculatedTotalSlack} Meter</strong> ({parsedSlackCount} loop x {parsedSlackLen}m {parsedSlackPct > 0 ? `+ ${parsedSlackPct}% lendutan` : ''})
                </span>
                <span className="font-mono">
                  {currentDistanceNum}m (OTDR) - {calculatedTotalSlack}m = <strong>{calculatedEffectiveGroundDistance}m (Jalan)</strong>
                </span>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={tracing || (!selectedStartNodeId && !selectedCableId)}
              className="w-full sm:w-auto py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {tracing ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span>Mengkalkulasi Rute...</span>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Icons.Zap />
                  <span>Lacak Titik Putus (Trace Optical Fault)</span>
                </span>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Tracing Results Display */}
      {traceResult && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-200">

          {/* 4 Metric Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-1 shadow-2xs">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Jarak Efektif Jalan</div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
                {traceResult.effective_ground_distance_meters || traceResult.input_distance_meters} <span className="text-sm font-normal text-slate-500">m</span>
              </div>
              <div className="text-[11px] text-slate-400">
                OTDR: {traceResult.input_distance_meters}m {traceResult.total_slack_meters > 0 ? `· Speran: -${traceResult.total_slack_meters}m` : ''}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-1 shadow-2xs">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Titik Asal (Origin)</div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                {traceResult.from_node?.name}
              </div>
              <div className="text-[11px] text-slate-400">
                {traceResult.is_reverse ? 'Arah Balik (Reverse)' : 'Arah Maju (Forward)'}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-1 shadow-2xs">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Titik Sasaran</div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                {traceResult.to_node?.name}
              </div>
              <div className="text-[11px] text-slate-400">
                Sisa Jarak Jalan: <strong className="font-mono">{traceResult.remaining_distance_meters}m</strong>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-1 shadow-2xs">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Infrastruktur Terdekat</div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                {traceResult.nearest_infrastructure?.name}
              </div>
              <div className="text-[11px] text-slate-400">
                Estimasi selisih ±{traceResult.nearest_infrastructure?.distance_diff ?? 0}m
              </div>
            </div>
          </div>

          {/* GIS Satellite Map Container */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Icons.MapPin />
                  <span>Peta Jalur &amp; Titik Breakpoint</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Garis kuning menunjukkan lintasan kabel, titik merah menunjukkan estimasi letak putus fiber.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {traceResult.estimated_location && (
                  <button
                    onClick={() => setStreetViewTarget({
                      lat: traceResult.estimated_location.lat,
                      lng: traceResult.estimated_location.lng,
                      title: `Titik Putus: ${traceResult.estimated_location.nearest_landmark}`
                    })}
                    className="px-3 py-1.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Icons.Eye />
                    <span>Street View 360°</span>
                  </button>
                )}
                {traceResult.estimated_location?.google_maps_url && (
                  <a
                    href={traceResult.estimated_location.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-lg shadow-xs transition-all flex items-center gap-1.5"
                  >
                    <Icons.ExternalLink />
                    <span>Google Maps</span>
                  </a>
                )}
              </div>
            </div>

            <OtdrMap
              fromNode={traceResult.from_node}
              toNode={traceResult.to_node}
              estimatedLocation={traceResult.estimated_location}
              waypoints={traceResult.route_waypoints}
              onOpenStreetView={(lat, lng, title) => setStreetViewTarget({ lat, lng, title })}
            />
          </div>

          {/* Diagnostics, Impact & Telegram Dispatch */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Impact Analysis */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-4 shadow-2xs">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Icons.AlertTriangle />
                <span>Diagnosa Kerusakan &amp; Dampak Layanan</span>
              </h3>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 text-xs leading-relaxed">
                {traceResult.possible_cause}
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Pelanggan Terdampak ({traceResult.affected_customers?.length || 0} Customer)
                  </h4>
                  <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900/60">
                    LOS
                  </span>
                </div>

                <div className="overflow-hidden border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-2.5">ID</th>
                        <th className="p-2.5">Nama Customer</th>
                        <th className="p-2.5">Alamat</th>
                        <th className="p-2.5">SN ONU</th>
                        <th className="p-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                      {traceResult.affected_customers?.map((cust, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="p-2.5 font-mono text-slate-500">{cust.customer_code}</td>
                          <td className="p-2.5 font-semibold text-slate-900 dark:text-white">{cust.name}</td>
                          <td className="p-2.5 text-slate-500">{cust.address}</td>
                          <td className="p-2.5 font-mono text-slate-400">{cust.onu_id}</td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 font-semibold rounded text-[10px] border border-rose-200 dark:border-rose-900">
                              {cust.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Field Dispatch & Telegram Panel */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-4 shadow-2xs flex flex-col justify-between">
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Icons.Tool />
                  <span>Rekomendasi Penanganan</span>
                </h3>

                <div className="space-y-1.5">
                  <div className="text-[11px] text-slate-400 font-medium">Tim Lapangan</div>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700">
                    {traceResult.dispatch_recommendation?.suggested_team}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[11px] text-slate-400 font-medium">Peralatan Wajib</div>
                  <ul className="space-y-1">
                    {traceResult.dispatch_recommendation?.required_tools?.map((tool, idx) => (
                      <li key={idx} className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2 bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                        <span>{tool}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                {telegramSentNotice && (
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg text-center text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    {telegramSentNotice}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleDispatchTelegram}
                  disabled={dispatchingTelegram}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <Icons.Send />
                  <span>{dispatchingTelegram ? 'Menyiarkan...' : 'Siarkan Dispatch ke Bot Telegram'}</span>
                </button>

                {traceResult.telegram_payload?.share_url && (
                  <a
                    href={traceResult.telegram_payload.share_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl shadow-2xs transition-all flex items-center justify-center gap-2"
                  >
                    <Icons.Telegram />
                    <span>Share ke Chat Telegram</span>
                  </a>
                )}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Street View Modal */}
      {streetViewTarget && (
        <StreetViewModal
          lat={streetViewTarget.lat}
          lng={streetViewTarget.lng}
          title={streetViewTarget.title}
          onClose={() => setStreetViewTarget(null)}
        />
      )}
    </div>
  );
}
