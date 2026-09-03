import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { decimalToDms, parseCoordsInput } from '../utils/coordinateParser.js';

/* ══════════════════════════════════════════════════════════════════
   CLEAN & MODERN ENTERPRISE COLOR PALETTE (MATCHING OLT-MANAGEMENT)
══════════════════════════════════════════════════════════════════ */
const TYPE_META = {
  POP: {
    label: 'POP Central',
    bg: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800',
    color: '#4f46e5',
    pillBg: '#eef2ff',
    pillText: '#3730a3',
    pillBorder: '#c7d2fe',
    size: 22,
  },
  ODC: {
    label: 'ODC Cabinet',
    bg: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
    color: '#2563eb',
    pillBg: '#eff6ff',
    pillText: '#1d4ed8',
    pillBorder: '#bfdbfe',
    size: 19,
  },
  ODP: {
    label: 'ODP Point',
    bg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
    color: '#059669',
    pillBg: '#ecfdf5',
    pillText: '#047857',
    pillBorder: '#a7f3d0',
    size: 16,
  },
};

const STATUS_META = {
  active: {
    label: 'Online',
    badge: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
    color: '#059669',
  },
  maintenance: {
    label: 'Maintenance',
    badge: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
    color: '#d97706',
  },
  inactive: {
    label: 'Down',
    badge: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800',
    color: '#e11d48',
  },
  damaged: {
    label: 'Loss',
    badge: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 animate-pulse',
    color: '#e11d48',
  },
};

const getOpticalQuality = (dbm) => {
  if (dbm == null) {
    return {
      label: '—',
      color: '#64748b',
      pillBg: '#f8fafc',
      pillText: '#475569',
      pillBorder: '#e2e8f0',
      badge: 'bg-slate-50 dark:bg-neutral-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-neutral-800'
    };
  }

  const num = parseFloat(dbm);
  if (num >= -24.0) {
    return {
      label: 'Prima (Bagus)',
      color: '#059669',
      lineColor: '#10b981',
      glowColor: 'rgba(16, 185, 129, 0.25)',
      pillBg: '#ecfdf5',
      pillText: '#047857',
      pillBorder: '#a7f3d0',
      badge: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
    };
  }
  if (num >= -26.0) {
    return {
      label: 'Optimal',
      color: '#0284c7',
      lineColor: '#0ea5e9',
      glowColor: 'rgba(14, 165, 233, 0.25)',
      pillBg: '#f0f9ff',
      pillText: '#0369a1',
      pillBorder: '#bae6fd',
      badge: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
    };
  }
  if (num >= -27.5) {
    return {
      label: 'Waspada (Tinggi)',
      color: '#d97706',
      lineColor: '#f59e0b',
      glowColor: 'rgba(245, 158, 11, 0.25)',
      pillBg: '#fffbeb',
      pillText: '#b45309',
      pillBorder: '#fde68a',
      badge: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
    };
  }
  return {
    label: 'Loss / Kritis',
    color: '#e11d48',
    lineColor: '#f43f5e',
    glowColor: 'rgba(244, 63, 94, 0.35)',
    pillBg: '#fff1f2',
    pillText: '#be123c',
    pillBorder: '#fecdd3',
    badge: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
  };
};

/* ══════════════════════════════════════════════════════════════════
   STREET VIEW 360 MODAL
══════════════════════════════════════════════════════════════════ */
function StreetViewModal({ lat, lng, title, onClose }) {
  if (!lat || !lng) return null;
  const embedUrl = `https://maps.google.com/maps?q=&layer=c&cbll=${lat},${lng}&cbp=11,0,0,0,0&output=svembed`;
  const directUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <span>Google Street View 360°</span>
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">{title || `Koordinat: ${lat}, ${lng}`}</p>
          </div>
          <div className="flex items-center space-x-2">
            <a
              href={directUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all"
            >
              Buka di Tab Baru ↗
            </a>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white font-bold transition-all cursor-pointer"
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
   NODE DETAIL DRAWER / POPUP MODAL
══════════════════════════════════════════════════════════════════ */
function NodeDetailPanel({ node, onClose, onOpenStreetView, onTracePath }) {
  if (!node) return null;

  const typeMeta = TYPE_META[node.node_type] ?? TYPE_META.ODC;
  const statusMeta = STATUS_META[node.status] ?? STATUS_META.active;
  const effectivePower = node.best_rx_power ?? node.optical_power_dbm;
  const isLoss = node.status === 'damaged' || (node.rx_power_range && (node.rx_power_range.includes('Loss') || node.rx_power_range.includes('LOS')));
  const optMeta = isLoss 
    ? { label: 'Loss / Kritis', color: '#e11d48', badge: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800' }
    : getOpticalQuality(effectivePower);
  const p = node.total_ports > 0 ? Math.round((node.used_ports / node.total_ports) * 100) : 0;

  const [copied, setCopied] = useState(false);
  const dmsInfo = useMemo(() => {
    if (!node.latitude || !node.longitude) return { formattedDms: '' };
    return decimalToDms(node.latitude, node.longitude);
  }, [node.latitude, node.longitude]);

  const handleCopyCoords = () => {
    if (node.latitude && node.longitude) {
      navigator.clipboard.writeText(`${node.latitude}, ${node.longitude}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="absolute top-4 left-4 z-[999] w-84 sm:w-96 bg-white/95 dark:bg-black/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 dark:border-neutral-800 p-5 transition-all text-slate-800 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
      <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-neutral-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${typeMeta.bg}`}>
              {node.node_type}
            </span>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${statusMeta.badge}`}>
              {statusMeta.label}
            </span>
          </div>
          <h4 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
            {node.name}
          </h4>
          <p className="text-xs text-slate-400 font-mono mt-0.5">{node.code}</p>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all text-xs font-bold cursor-pointer"
        >
          ✕
        </button>
      </div>

      <div className="mt-4 space-y-4 text-xs">
        {/* Optical Telemetry Signal Box */}
        {node.node_type === 'ODP' && (
          <div className="p-3.5 bg-slate-50 dark:bg-neutral-900 rounded-xl border border-slate-200 dark:border-neutral-800 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Telemetry Redaman Rx</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${optMeta.badge}`}>
                {optMeta.label}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono" style={{ color: optMeta.color }}>
                {node.rx_power_range ? node.rx_power_range : (effectivePower != null ? `${parseFloat(effectivePower).toFixed(2)} dBm` : '—')}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {node.used_ports} Klien Terhubung
              </span>
            </div>
          </div>
        )}

        {/* GPS Coordinates & Google Earth / Maps Navigation */}
        <div className="space-y-2">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            Posisi Geografis GPS
          </span>
          {node.latitude && node.longitude ? (
            <div className="p-3 bg-slate-50 dark:bg-neutral-900 rounded-xl border border-slate-200 dark:border-neutral-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Koordinat Desimal:
                </span>
                <button
                  onClick={handleCopyCoords}
                  className="px-2.5 py-0.5 text-[10px] font-bold bg-white dark:bg-black border border-slate-200 dark:border-neutral-700 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 transition-all text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {copied ? 'Tersalin!' : 'Salin'}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-1.5 font-mono text-xs">
                <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                  <span className="text-[10px] font-sans font-semibold text-slate-400">Google Maps:</span>
                  <span className="font-bold">{parseFloat(node.latitude).toFixed(6)}, {parseFloat(node.longitude).toFixed(6)}</span>
                </div>
                <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
                  <span className="text-[10px] font-sans font-semibold text-slate-400">Google Earth:</span>
                  <span className="font-bold">{dmsInfo.formattedDms || '—'}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200/60 dark:border-neutral-800">
                <button
                  onClick={() => onOpenStreetView(node.latitude, node.longitude, node.name)}
                  className="py-2 px-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold rounded-xl flex items-center justify-center gap-1 transition-all text-center col-span-3 sm:col-span-1 shadow-2xs cursor-pointer"
                >
                  <span>👁️ Street View</span>
                </button>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${node.latitude},${node.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold rounded-xl flex items-center justify-center gap-1 transition-all text-center shadow-2xs"
                >
                  <span>🗺️ Maps</span>
                </a>
                <a
                  href={`https://earth.google.com/web/search/${node.latitude},${node.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-2 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 text-[11px] font-bold rounded-xl flex items-center justify-center gap-1 transition-all text-center shadow-2xs"
                >
                  <span>🌍 Earth</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900/60 text-xs text-amber-700 dark:text-amber-300">
              Belum ada koordinat GPS terdaftar.
            </div>
          )}
        </div>

        <div className="space-y-3">
          {node.total_ports > 0 && (
            <div className="p-3 bg-slate-50 dark:bg-neutral-900 rounded-xl border border-slate-100 dark:border-neutral-800">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Kapasitas Port</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{node.used_ports}/{node.total_ports} Port ({p}%)</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${p > 90 ? 'bg-rose-600' : p > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${p}%` }}
                />
              </div>
            </div>
          )}

          <div className="p-3 bg-slate-50 dark:bg-neutral-900 rounded-xl border border-slate-100 dark:border-neutral-800 text-slate-700 dark:text-slate-300">
            <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">OLT &amp; Port Uplink</span>
            <p className="font-bold">{node.olt_device?.name || node.parent_node?.olt_device?.name || 'OLT Region'}</p>
            <p className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold">{node.olt_port_ref || 'PON 1/1/1'}</p>
          </div>
        </div>

        {/* Quick Action Button to Trace Path */}
        <button
          onClick={() => onTracePath && onTracePath(node)}
          className="w-full py-2.5 px-3 bg-cyan-50 dark:bg-cyan-950/60 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
        >
          <span>🧭 Lacak Jalur Kabel (Path Tracing)</span>
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   RULER & DISTANCE MEASUREMENT FLOATING HUD
══════════════════════════════════════════════════════════════════ */
function RulerHud({ waypoints, totalMeters, onUndo, onReset, onClose }) {
  const km = (totalMeters / 1000).toFixed(2);
  const m = Math.round(totalMeters);
  const displayDist = totalMeters >= 1000 ? `${km} km (${m} m)` : `${m} meter`;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[999] bg-slate-900/95 text-white backdrop-blur-md border border-amber-500/60 shadow-2xl rounded-2xl p-4 w-full max-w-sm animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
          <span className="font-bold text-xs text-amber-300">📏 Alat Ukur Jarak Kabel Lapangan</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white text-xs font-bold px-1 cursor-pointer"
        >
          ✕ Selesai
        </button>
      </div>

      <div className="mt-3 bg-slate-800/80 rounded-xl p-3 border border-slate-700/60 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Jarak Kabel</span>
          <span className="text-xl font-black font-mono text-emerald-400 leading-tight">{displayDist}</span>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Titik Waypoint</span>
          <span className="text-base font-black font-mono text-amber-400 leading-tight">{waypoints.length} Titik</span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
        <span className="text-[10px]">💡 Klik titik peta / marker node</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onUndo}
            disabled={waypoints.length === 0}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-35 disabled:cursor-not-allowed text-slate-200 border border-slate-700 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
            title="Hapus titik waypoint terakhir"
          >
            ↩️ Undo
          </button>
          <button
            onClick={onReset}
            disabled={waypoints.length === 0}
            className="px-2 py-1 bg-rose-500/20 hover:bg-rose-500/40 disabled:opacity-35 disabled:cursor-not-allowed text-rose-300 border border-rose-500/40 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   TARGET CLIENT COORDINATE MODAL
══════════════════════════════════════════════════════════════════ */
function TargetCoordModal({ isOpen, onClose, onSetTarget }) {
  const [inputVal, setInputVal] = useState('');
  const [labelVal, setLabelVal] = useState('');
  const [custSearch, setCustSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [loadingCust, setLoadingCust] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingCust(true);
    fetch('/api/customers')
      .then(r => r.json())
      .then(res => {
        const list = res.data ?? res ?? [];
        setCustomers(Array.isArray(list) ? list : []);
      })
      .catch(() => setCustomers([]))
      .finally(() => setLoadingCust(false));
  }, [isOpen]);

  const parsed = useMemo(() => {
    return parseCoordsInput(inputVal);
  }, [inputVal]);

  const filteredCustomers = useMemo(() => {
    if (!custSearch.trim()) return [];
    const q = custSearch.toLowerCase();
    return customers.filter(c => 
      c.name?.toLowerCase().includes(q) || 
      c.customer_id?.toLowerCase().includes(q) || 
      c.pppoe_user?.toLowerCase().includes(q) ||
      c.address?.toLowerCase().includes(q)
    ).slice(0, 5);
  }, [customers, custSearch]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!parsed.isValid) return;

    onSetTarget({
      lat: parsed.lat,
      lng: parsed.lng,
      label: labelVal.trim() || 'Rumah Pelanggan',
      dms: parsed.formattedDms,
    });
    onClose();
  };

  const handleSelectCustomer = (c) => {
    if (c.latitude && c.longitude) {
      setInputVal(`${c.latitude}, ${c.longitude}`);
      setLabelVal(c.name || 'Rumah Pelanggan');
      setCustSearch('');
    } else {
      setLabelVal(c.name || 'Rumah Pelanggan');
      alert('Pelanggan ini belum memiliki koordinat GPS tersimpan di database. Silakan masukkan koordinat manual.');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-neutral-800 overflow-hidden text-slate-800 dark:text-slate-100">
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-lg">📍</span>
            <div>
              <h3 className="text-sm font-bold">Cek Koordinat Rumah Client / Patokan Ukur</h3>
              <p className="text-[11px] text-slate-400">Tentukan titik target rumah pelanggan sebelum mengukur penarikan kabel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white font-bold transition-all cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Opsi A: Cari dari database pelanggan */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block">
              Opsi A: Cari Pelanggan Terdaftar
            </label>
            <div className="relative">
              <input
                type="text"
                value={custSearch}
                onChange={e => setCustSearch(e.target.value)}
                placeholder="Ketik nama pelanggan, nomor pppoe, atau alamat..."
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-black border border-slate-200 dark:border-neutral-700 rounded-xl font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 text-xs"
              />
              {loadingCust && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 animate-pulse">Memuat...</span>
              )}

              {/* Suggestions */}
              {filteredCustomers.length > 0 && (
                <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto">
                  {filteredCustomers.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectCustomer(c)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-neutral-700 flex items-center justify-between border-b border-slate-100 dark:border-neutral-700 last:border-0 cursor-pointer"
                    >
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">{c.name}</span>
                        <span className="text-[10px] text-slate-400 block font-mono">{c.customer_id || c.pppoe_user || 'Pelanggan'} • {c.address || '—'}</span>
                      </div>
                      <span className="text-[10px] font-bold text-fuchsia-600 dark:text-fuchsia-400">
                        {c.latitude && c.longitude ? 'Pilih ➔' : 'Tanpa GPS'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="relative flex items-center justify-center py-1">
            <div className="border-t border-slate-200 dark:border-neutral-800 w-full"></div>
            <span className="bg-white dark:bg-neutral-900 px-3 text-[10px] font-bold uppercase text-slate-400 absolute">ATAU INPUT KOORDINAT MANUAL</span>
          </div>

          {/* Opsi B: Input Manual Koordinat */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block">
              Koordinat GPS (Desimal / Google Earth DMS) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              placeholder="Contoh: -0.785123, 100.654123 atau 0°47'5.96&quot;S 100°39'15.87&quot;T"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black border border-slate-200 dark:border-neutral-700 rounded-xl font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 text-xs"
            />
            {inputVal && (
              <div className="text-[11px] mt-1">
                {parsed.isValid ? (
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                    <span>✓ Valid: <b>{parsed.lat.toFixed(6)}, {parsed.lng.toFixed(6)}</b></span>
                    <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">{parsed.formattedDms}</span>
                  </div>
                ) : (
                  <div className="p-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300">
                    ✕ Format koordinat tidak dikenali. Masukkan contoh: <code>-0.785123, 100.654123</code>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block">
              Nama / Keterangan Patokan (Opsional)
            </label>
            <input
              type="text"
              value={labelVal}
              onChange={e => setLabelVal(e.target.value)}
              placeholder="Contoh: Rumah Bpk. Ahmad / Ruko No. 12"
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-black border border-slate-200 dark:border-neutral-700 rounded-xl font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 text-xs"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!parsed.isValid}
              className="px-5 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>📍 Pasang Patokan di Peta</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   TARGET PIN FLOATING BANNER
══════════════════════════════════════════════════════════════════ */
function TargetPinBanner({ targetPin, nearestOdp, onFlyToTarget, onStartMeasureFromOdp, onClearTarget }) {
  if (!targetPin) return null;

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[998] bg-slate-900/95 text-white backdrop-blur-md border border-fuchsia-500/70 shadow-2xl rounded-2xl px-4 py-2.5 flex flex-col sm:flex-row items-center gap-3 text-xs max-w-[92vw] animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center gap-2 shrink-0">
        <span className="w-2.5 h-2.5 rounded-full bg-fuchsia-400 animate-ping"></span>
        <div>
          <span className="font-extrabold text-fuchsia-300 block">🏠 Patokan Rumah: {targetPin.label}</span>
          <span className="text-[10px] font-mono text-slate-300">
            {targetPin.lat.toFixed(6)}, {targetPin.lng.toFixed(6)}
          </span>
        </div>
      </div>

      {nearestOdp && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-fuchsia-950/60 border border-fuchsia-700/60 rounded-xl text-[11px] text-fuchsia-200">
          <span>ODP Terdekat: <b>{nearestOdp.name}</b></span>
          <span className="font-mono text-emerald-300 font-bold">(~{Math.round(nearestOdp.distanceMeters)} m)</span>
        </div>
      )}

      <div className="flex items-center gap-2 shrink-0 ml-auto">
        <button
          onClick={onFlyToTarget}
          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[11px] font-bold text-slate-200 transition-all cursor-pointer"
        >
          🎯 Fokus
        </button>

        {nearestOdp && (
          <button
            onClick={() => onStartMeasureFromOdp(nearestOdp, targetPin)}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-[11px] font-bold shadow-md transition-all flex items-center gap-1 cursor-pointer"
            title="Mulai tarik garis penggaris dari ODP terdekat ke rumah pelanggan"
          >
            <span>📏 Ukur dari ODP Ini</span>
          </button>
        )}

        <button
          onClick={onClearTarget}
          className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 font-bold text-xs transition-all cursor-pointer"
          title="Hapus Patokan"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PATH TRACING BREADCRUMB BANNER
══════════════════════════════════════════════════════════════════ */
function PathTracingBanner({ pathNodes, activeNodeId, onSelectNode, onClose }) {
  if (!pathNodes || pathNodes.length <= 1) return null;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[998] bg-slate-900/90 dark:bg-black/90 backdrop-blur-md border border-cyan-500/60 shadow-2xl rounded-2xl px-4 py-2.5 flex items-center gap-3 text-white text-xs max-w-[92vw] overflow-hidden">
      <div className="flex items-center gap-1.5 font-bold text-cyan-400 shrink-0">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
        <span>Jalur Traced:</span>
      </div>
      <div className="flex items-center gap-2 overflow-x-auto py-0.5 scrollbar-none">
        {pathNodes.map((pn, idx) => (
          <React.Fragment key={pn.id}>
            {idx > 0 && <span className="text-slate-500 font-mono shrink-0">➔</span>}
            <button
              onClick={() => onSelectNode(pn)}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                pn.id === activeNodeId
                  ? 'bg-cyan-500 text-slate-950 shadow-md ring-2 ring-cyan-400/50'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
            >
              <span className="text-[9px] px-1 py-0.2 rounded bg-black/40 text-cyan-300 font-mono font-bold">
                {pn.node_type}
              </span>
              <span>{pn.name}</span>
            </button>
          </React.Fragment>
        ))}
      </div>
      <button
        onClick={onClose}
        className="ml-1 w-6 h-6 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-bold text-xs transition-all shrink-0 cursor-pointer"
        title="Tutup Tracing"
      >
        ✕
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   FAST INTERACTIVE LEAFLET TOPOLOGY MAP
══════════════════════════════════════════════════════════════════ */
function LeafletMap({
  nodes,
  cables = [],
  selectedNode,
  tracedPath,
  rulerActive,
  rulerPoints,
  setRulerPoints,
  targetPin,
  nearestOdp,
  onSelectNode,
  onOpenStreetView,
  externalFlyToRef,
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const leafletRef = useRef(null);
  const tileLayerRef = useRef(null);
  const cablesLayerGroupRef = useRef(null);
  const nodesLayerGroupRef = useRef(null);
  const pathHighlightLayerGroupRef = useRef(null);
  const rulerLayerGroupRef = useRef(null);
  const targetPinLayerGroupRef = useRef(null);
  const isFirstRenderRef = useRef(true);
  const rulerActiveRef = useRef(rulerActive);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isSatellite, setIsSatellite] = useState(true);

  useEffect(() => {
    rulerActiveRef.current = rulerActive;
  }, [rulerActive]);

  // 1. Initialize Map Instance with SVG Renderer (ONLY ONCE ON MOUNT)
  useEffect(() => {
    if (mapInstanceRef.current) return;

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
        const defaultCenter = [-0.785, 100.654];

        const map = Lf.map(mapRef.current, {
          center: defaultCenter,
          zoom: 15,
          zoomControl: false,
          scrollWheelZoom: true,
          preferCanvas: false,
          renderer: Lf.svg(),
        });

        // Zoom control at bottom right
        Lf.control.zoom({ position: 'bottomright' }).addTo(map);

        const satUrl = 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
        tileLayerRef.current = Lf.tileLayer(satUrl, {
          maxZoom: 20,
          subdomains: ['0', '1', '2', '3'],
        }).addTo(map);

        // Separate layer groups for high-performance in-place updates
        cablesLayerGroupRef.current = Lf.layerGroup().addTo(map);
        pathHighlightLayerGroupRef.current = Lf.layerGroup().addTo(map);
        nodesLayerGroupRef.current = Lf.layerGroup().addTo(map);
        rulerLayerGroupRef.current = Lf.layerGroup().addTo(map);
        targetPinLayerGroupRef.current = Lf.layerGroup().addTo(map);

        mapInstanceRef.current = map;
        setMapLoaded(true);

        // Expose flyTo capability
        if (externalFlyToRef) {
          externalFlyToRef.current = (lat, lng, zoom = 17) => {
            map.flyTo([lat, lng], zoom, { duration: 1.2 });
          };
        }

        map.invalidateSize();
        setTimeout(() => map?.invalidateSize(), 150);
        setTimeout(() => map?.invalidateSize(), 500);
      }
    }).catch(err => console.warn('Leaflet load failed:', err));

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        cablesLayerGroupRef.current = null;
        nodesLayerGroupRef.current = null;
        pathHighlightLayerGroupRef.current = null;
        rulerLayerGroupRef.current = null;
        targetPinLayerGroupRef.current = null;
      }
    };
  }, []);

  // 2. Toggle Satelit Hybrid vs Vektor smoothly
  const toggleMapMode = () => {
    if (!mapInstanceRef.current || !leafletRef.current || !tileLayerRef.current) return;
    const Lf = leafletRef.current;
    const map = mapInstanceRef.current;

    map.removeLayer(tileLayerRef.current);
    const nextMode = !isSatellite;
    setIsSatellite(nextMode);

    if (nextMode) {
      tileLayerRef.current = Lf.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['0', '1', '2', '3'],
      });
    } else {
      tileLayerRef.current = Lf.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
      });
    }
    tileLayerRef.current.addTo(map);
  };

  // 3. Recenter to all nodes
  const handleRecenterMap = useCallback(() => {
    if (!mapInstanceRef.current) return;
    const validNodes = nodes.filter(n => n.latitude && n.longitude && parseFloat(n.latitude) !== 0);
    if (validNodes.length === 0) return;

    const bounds = validNodes.map(n => [parseFloat(n.latitude), parseFloat(n.longitude)]);
    if (bounds.length === 1) {
      mapInstanceRef.current.setView(bounds[0], 16);
    } else {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
    }
  }, [nodes]);

  // 4. Ruler Map Click Listener
  useEffect(() => {
    if (!mapInstanceRef.current || !rulerActive) return;
    const map = mapInstanceRef.current;

    const handleMapClick = (e) => {
      const { lat, lng } = e.latlng;
      setRulerPoints(pts => [...pts, [lat, lng]]);
    };

    map.on('click', handleMapClick);
    map.getContainer().style.cursor = 'crosshair';

    return () => {
      map.off('click', handleMapClick);
      if (map.getContainer()) {
        map.getContainer().style.cursor = '';
      }
    };
  }, [rulerActive, setRulerPoints]);

  // 5. Render Ruler Waypoints & Lines
  useEffect(() => {
    if (!rulerLayerGroupRef.current || !leafletRef.current || !mapInstanceRef.current) return;
    const Lf = leafletRef.current;
    const layer = rulerLayerGroupRef.current;
    layer.clearLayers();

    if (!rulerActive || rulerPoints.length === 0) return;

    // Draw waypoints
    rulerPoints.forEach((pt, idx) => {
      const icon = Lf.divIcon({
        className: 'custom-ruler-pin',
        html: `
          <div style="
            background: #f97316;
            color: #ffffff;
            border: 2px solid #ffffff;
            width: 22px;
            height: 22px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 10px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          ">
            ${idx + 1}
          </div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      Lf.marker(pt, { icon }).addTo(layer);
    });

    // Draw connecting line
    if (rulerPoints.length >= 2) {
      Lf.polyline(rulerPoints, {
        color: '#f97316',
        weight: 3.5,
        opacity: 0.95,
        dashArray: '8, 6',
      }).addTo(layer);
    }
  }, [rulerActive, rulerPoints]);

  // 5b. Render Target House Pin & Guide Line to Nearest ODP
  useEffect(() => {
    if (!targetPinLayerGroupRef.current || !leafletRef.current || !mapInstanceRef.current) return;
    const Lf = leafletRef.current;
    const layer = targetPinLayerGroupRef.current;
    layer.clearLayers();

    if (!targetPin || !targetPin.lat || !targetPin.lng) return;

    const lat = targetPin.lat;
    const lng = targetPin.lng;

    const icon = Lf.divIcon({
      className: 'custom-target-client-pin',
      html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
          <div class="target-house-ping"></div>
          <div style="
            background: #d946ef;
            color: #ffffff;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border: 3px solid #ffffff;
            box-shadow: 0 4px 14px rgba(217,70,239,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            z-index: 10;
          ">
            🏠
          </div>
          <div style="
            background: #18181b;
            color: #fdf4ff;
            padding: 3px 8px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 800;
            white-space: nowrap;
            margin-top: 4px;
            border: 1.5px solid #d946ef;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            z-index: 10;
          ">
            ${targetPin.label || 'Rumah Pelanggan'}
          </div>
        </div>
      `,
      iconSize: [160, 75],
      iconAnchor: [80, 20],
    });

    const marker = Lf.marker([lat, lng], { icon }).addTo(layer);

    // If ruler is active, clicking target pin adds it as a waypoint
    marker.on('click', (e) => {
      if (rulerActiveRef.current) {
        if (e.originalEvent) e.originalEvent.stopPropagation();
        if (Lf.DomEvent) Lf.DomEvent.stopPropagation(e);
        setRulerPoints(pts => [...pts, [lat, lng]]);
      }
    });

    // Guide line from nearest ODP to Target Pin
    if (nearestOdp && nearestOdp.latitude && nearestOdp.longitude) {
      const odpLat = parseFloat(nearestOdp.latitude);
      const odpLng = parseFloat(nearestOdp.longitude);
      Lf.polyline([[odpLat, odpLng], [lat, lng]], {
        color: '#d946ef',
        weight: 2,
        opacity: 0.7,
        dashArray: '4, 6',
      }).addTo(layer);
    }
  }, [targetPin, nearestOdp, setRulerPoints]);

  // 6. In-Place Rendering of Nodes, Cables, & Path Tracing Highlights
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !leafletRef.current) return;
    const Lf = leafletRef.current;
    const map = mapInstanceRef.current;

    const cablesGroup = cablesLayerGroupRef.current;
    const highlightGroup = pathHighlightLayerGroupRef.current;
    const nodesGroup = nodesLayerGroupRef.current;

    if (!cablesGroup || !highlightGroup || !nodesGroup) return;

    cablesGroup.clearLayers();
    highlightGroup.clearLayers();
    nodesGroup.clearLayers();

    const nodeMap = new Map();
    nodes.forEach(n => {
      if (n.latitude && n.longitude && parseFloat(n.latitude) !== 0) {
        nodeMap.set(n.id, n);
      }
    });

    const isPathTracingActive = tracedPath?.nodeIds && tracedPath.nodeIds.size > 1;
    const bounds = [];

    // Draw Fiber Connections (Parent-Child)
    nodes.forEach(node => {
      if (!node.latitude || !node.longitude || parseFloat(node.latitude) === 0) return;

      let parent = null;
      if (node.parent_node_id && nodeMap.has(node.parent_node_id)) {
        parent = nodeMap.get(node.parent_node_id);
      } else if (node.node_type === 'ODP') {
        const potentialOdcs = nodes.filter(n => n.node_type === 'ODC' && n.latitude && n.longitude);
        if (potentialOdcs.length > 0) parent = potentialOdcs[0];
      }

      if (parent && parent.latitude && parent.longitude) {
        const pLat = parseFloat(parent.latitude);
        const pLng = parseFloat(parent.longitude);
        const nLat = parseFloat(node.latitude);
        const nLng = parseFloat(node.longitude);

        const isOdpLine = node.node_type === 'ODP';
        let lineColor = '#2563eb'; // Clean Royal Blue for Feeder Backbone
        let glowColor = 'rgba(37, 99, 235, 0.22)';

        if (isOdpLine) {
          const bestPower = node.best_rx_power != null 
            ? parseFloat(node.best_rx_power) 
            : (node.optical_power_dbm != null ? parseFloat(node.optical_power_dbm) : null);

          const isLossLine = node.status === 'damaged' 
            || (node.rx_power_range && (node.rx_power_range.includes('Loss') || node.rx_power_range.includes('LOS')))
            || (bestPower != null && bestPower <= -27.5);

          if (isLossLine) {
            lineColor = '#e11d48'; // Rose Red
            glowColor = 'rgba(225, 29, 72, 0.28)';
          } else if (bestPower != null && bestPower <= -25.9) {
            lineColor = '#d97706'; // Amber
            glowColor = 'rgba(217, 119, 6, 0.25)';
          } else if (bestPower != null && bestPower <= -23.9) {
            lineColor = '#0284c7'; // Sky Azure
            glowColor = 'rgba(2, 132, 199, 0.25)';
          } else if (bestPower != null && bestPower > -23.9) {
            lineColor = '#059669'; // Mint Emerald
            glowColor = 'rgba(5, 150, 105, 0.25)';
          } else {
            lineColor = '#10b981';
            glowColor = 'rgba(16, 185, 129, 0.22)';
          }
        }

        const lineCoords = [[pLat, pLng], [nLat, nLng]];
        const isInSelectedPath = isPathTracingActive && tracedPath.nodeIds.has(node.id) && tracedPath.nodeIds.has(parent.id);

        if (isInSelectedPath) {
          // Highlight glowing laser line for selected end-to-end path
          Lf.polyline(lineCoords, {
            color: '#38bdf8', // Cyan glow
            weight: isOdpLine ? 10 : 12,
            opacity: 0.6,
            lineCap: 'round',
          }).addTo(highlightGroup);

          Lf.polyline(lineCoords, {
            color: '#06b6d4', // Bright Cyan Laser
            weight: isOdpLine ? 4.5 : 5.5,
            opacity: 1,
            dashArray: '10, 8',
            className: 'animated-fiber-laser-flow',
          }).addTo(highlightGroup);
        } else {
          // Standard / Dimmed connection
          const opacityMultiplier = isPathTracingActive ? 0.2 : 1;

          Lf.polyline(lineCoords, {
            color: glowColor,
            weight: isOdpLine ? 6 : 8,
            opacity: 0.9 * opacityMultiplier,
            lineCap: 'round',
          }).addTo(cablesGroup);

          Lf.polyline(lineCoords, {
            color: lineColor,
            weight: isOdpLine ? 3.5 : 4.5,
            opacity: 1 * opacityMultiplier,
            dashArray: '12, 10',
            className: isPathTracingActive ? '' : 'animated-fiber-laser-flow',
          }).addTo(cablesGroup);
        }
      }
    });

    // Draw Modern Clean Node Markers with Pulsing Radar for Faults
    nodes.forEach(node => {
      if (!node.latitude || !node.longitude || parseFloat(node.latitude) === 0) return;

      const lat = parseFloat(node.latitude);
      const lng = parseFloat(node.longitude);
      bounds.push([lat, lng]);

      const typeMeta = TYPE_META[node.node_type] ?? TYPE_META.ODC;
      const isSelected = selectedNode?.id === node.id;
      const isOdp = node.node_type === 'ODP';
      const effectiveBestPower = node.best_rx_power ?? node.optical_power_dbm;
      const isLossRange = node.rx_power_range && (node.rx_power_range.includes('Loss') || node.rx_power_range.includes('LOS'));
      const isFault = isLossRange || node.status === 'damaged' || (effectiveBestPower != null && parseFloat(effectiveBestPower) <= -27.5);

      const optMeta = isLossRange 
        ? { label: 'Loss / Kritis', color: '#e11d48', pillBg: '#fff1f2', pillText: '#be123c', pillBorder: '#fecdd3' } 
        : getOpticalQuality(effectiveBestPower);
      const opticalDbmText = node.rx_power_range ? node.rx_power_range : (effectiveBestPower != null ? `${effectiveBestPower > 0 ? '+' : ''}${parseFloat(effectiveBestPower).toFixed(2)} dBm` : '—');

      const size = isSelected ? typeMeta.size + 4 : typeMeta.size;

      let pinBg = '#059669'; // Mint Emerald
      if (node.node_type === 'POP') {
        pinBg = '#4f46e5'; // Indigo
      } else if (node.node_type === 'ODC') {
        pinBg = '#2563eb'; // Royal Blue
      }

      if (isFault) {
        pinBg = '#e11d48'; // Rose Red
      }

      const icon = Lf.divIcon({
        className: `custom-gis-node-marker ${isSelected ? 'is-selected' : ''}`,
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
            ${(isOdp && node.used_ports > 0 && (node.optical_power_dbm != null || node.rx_power_range != null)) ? `
              <div style="
                background: ${optMeta.pillBg};
                color: ${optMeta.pillText};
                border: 1.5px solid ${optMeta.pillBorder};
                font-weight: 800;
                font-size: 11px;
                padding: 2px 8px;
                border-radius: 9999px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.18);
                white-space: nowrap;
                margin-bottom: 4px;
                font-family: ui-monospace, monospace;
              ">
                ${opticalDbmText}
              </div>
            ` : ''}

            <div style="
              position: relative;
              width: ${size * 2}px;
              height: ${size * 2}px;
              border-radius: 50%;
              background: ${pinBg};
              border: 3px solid #ffffff;
              box-shadow: 0 3px 10px rgba(0,0,0,0.25);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #ffffff;
              font-weight: 800;
              font-size: ${size >= 20 ? '12px' : size >= 17 ? '11px' : '10px'};
            ">
              ${isFault ? '<div class="radar-ping-ring"></div>' : ''}
              ${node.node_type}
            </div>

            <div style="
              background: #ffffff;
              color: #0f172a;
              padding: 2px 7px;
              border-radius: 6px;
              font-size: 11px;
              font-weight: 700;
              white-space: nowrap;
              margin-top: 3px;
              border: 1.5px solid #cbd5e1;
              box-shadow: 0 2px 6px rgba(0,0,0,0.16);
            ">
              ${node.name}
            </div>
          </div>
        `,
        iconSize: [180, size * 2 + 55],
        iconAnchor: [90, size * 2 + 30],
      });

      const marker = Lf.marker([lat, lng], { icon }).addTo(nodesGroup);
      marker.on('click', (e) => {
        if (rulerActiveRef.current) {
          if (e.originalEvent) {
            e.originalEvent.stopPropagation();
          }
          if (Lf.DomEvent) {
            Lf.DomEvent.stopPropagation(e);
          }
          setRulerPoints(pts => [...pts, [lat, lng]]);
          return;
        }
        onSelectNode(node);
      });
    });

    // Fit bounds ONLY ONCE on first load
    if (bounds.length > 0) {
      map.invalidateSize();
      if (isFirstRenderRef.current) {
        if (bounds.length === 1) {
          map.setView(bounds[0], 16);
        } else {
          try {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
          } catch { }
        }
        isFirstRenderRef.current = false;
      }
    }
  }, [mapLoaded, nodes, selectedNode, tracedPath]);

  return (
    <div className="relative w-full h-full">
      {/* CSS Keyframes for Pulsing Radar & Smooth Laser Flow */}
      <style>{`
        @keyframes fiberFlowAnimation {
          0% { stroke-dashoffset: 44; }
          100% { stroke-dashoffset: 0; }
        }
        .animated-fiber-laser-flow,
        .leaflet-overlay-pane svg path.animated-fiber-laser-flow {
          stroke-dasharray: 12 10 !important;
          animation: fiberFlowAnimation 1.1s linear infinite !important;
        }

        @keyframes radarPing {
          0% {
            transform: scale(0.85);
            opacity: 0.9;
          }
          70% {
            transform: scale(2.3);
            opacity: 0;
          }
          100% {
            transform: scale(2.5);
            opacity: 0;
          }
        }
        .radar-ping-ring {
          position: absolute;
          top: -3px;
          left: -3px;
          width: calc(100% + 6px);
          height: calc(100% + 6px);
          border-radius: 50%;
          border: 3px solid #ef4444;
          animation: radarPing 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
          pointer-events: none;
        }

        @keyframes targetPing {
          0% {
            transform: scale(0.85);
            opacity: 0.9;
          }
          70% {
            transform: scale(2.2);
            opacity: 0;
          }
          100% {
            transform: scale(2.4);
            opacity: 0;
          }
        }
        .target-house-ping {
          position: absolute;
          top: -3px;
          left: calc(50% - 21px);
          width: 42px;
          height: 42px;
          border-radius: 50%;
          border: 3px solid #d946ef;
          animation: targetPing 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
          pointer-events: none;
        }
      `}</style>

      <div
        ref={mapRef}
        className="w-full rounded-2xl overflow-hidden shadow-inner relative z-0"
        style={{ height: '640px', minHeight: '640px' }}
      />

      {/* Floating Mode Controls */}
      <div className="absolute top-4 right-4 z-[999] flex flex-wrap items-center justify-end gap-2">
        <button
          onClick={toggleMapMode}
          className="px-3.5 py-2 bg-white/95 dark:bg-neutral-900/95 hover:bg-white text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-neutral-700 shadow-md backdrop-blur-md transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <span>{isSatellite ? '🗺️ Mode Vektor' : '🛰️ Mode Satelit'}</span>
        </button>

        {selectedNode && selectedNode.latitude && selectedNode.longitude && (
          <button
            onClick={() => onOpenStreetView(selectedNode.latitude, selectedNode.longitude, selectedNode.name)}
            className="px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>👁️ Street View 360°</span>
          </button>
        )}
      </div>

      <button
        onClick={handleRecenterMap}
        className="absolute bottom-4 left-4 z-[999] px-3.5 py-2 bg-white/95 dark:bg-neutral-900/95 hover:bg-white text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-neutral-700 shadow-md backdrop-blur-md flex items-center gap-1.5 transition-all cursor-pointer"
        title="Pusatkan Peta ke Lokasi Node"
      >
        <span>🎯 Pusatkan Peta</span>
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   STATS CARDS BAR (CLEAN OLT-MANAGEMENT STYLE)
══════════════════════════════════════════════════════════════════ */
function GisStatCards({ nodes }) {
  const pops = nodes.filter(n => n.node_type === 'POP');
  const odcs = nodes.filter(n => n.node_type === 'ODC');
  const odps = nodes.filter(n => n.node_type === 'ODP');

  const activeOdps = odps.filter(n => n.used_ports > 0 && n.optical_power_dbm != null);
  const odpOptValues = activeOdps.map(n => parseFloat(n.optical_power_dbm));
  const avgOdpDbm = odpOptValues.length > 0 ? (odpOptValues.reduce((a, b) => a + b, 0) / odpOptValues.length).toFixed(2) : '—';

  // Count faults
  const faultyNodes = nodes.filter(n => {
    const eff = n.best_rx_power ?? n.optical_power_dbm;
    return n.status === 'damaged' || n.status === 'inactive' || (eff != null && parseFloat(eff) <= -27.5) || (n.rx_power_range && n.rx_power_range.includes('Loss'));
  });

  const cards = [
    { label: 'POP Central', value: pops.length, sub: `${pops.filter(n => n.status === 'active').length} Aktif Normal`, badge: 'Core Headend', badgeCls: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800' },
    { label: 'ODC Cabinet', value: odcs.length, sub: `${odcs.filter(n => n.status === 'active').length} Aktif Normal`, badge: 'Distribution', badgeCls: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800' },
    { label: 'ODP Point', value: odps.length, sub: `${odps.filter(n => n.status === 'active').length} Total Point ODP`, badge: 'Access Terminal', badgeCls: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' },
    { 
      label: 'Node Bermasalah (LOS/Warning)', 
      value: faultyNodes.length, 
      sub: faultyNodes.length > 0 ? 'Perlu Investigasi Lapangan' : 'Seluruh Jaringan Sehat', 
      badge: faultyNodes.length > 0 ? '🚨 Gangguan' : 'Semua Normal', 
      badgeCls: faultyNodes.length > 0 
        ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800' 
        : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 stagger-enter">
      {cards.map((c, i) => (
        <div key={i} className="bg-white dark:bg-black rounded-2xl border border-slate-200 dark:border-neutral-800 shadow-2xs p-4 transition-colors duration-300">
          <div className="flex justify-between items-start mb-1">
            <span className={`text-2xl font-black leading-none ${c.label.includes('Bermasalah') && c.value > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
              {c.value}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.badgeCls}`}>
              {c.badge}
            </span>
          </div>
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">{c.label}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN GIS PAGE CONTROLLER
══════════════════════════════════════════════════════════════════ */
export default function GisTopologyMap() {
  const [searchParams] = useSearchParams();
  const oltFilterParam = searchParams.get('olt_id');

  const [allNodes, setAllNodes] = useState([]);
  const [allCables, setAllCables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [faultOnlyFilter, setFaultOnlyFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [livePolling, setLivePolling] = useState(true);
  const [activeView, setActiveView] = useState('map');
  const [streetViewTarget, setStreetViewTarget] = useState(null);

  // Ruler state
  const [rulerActive, setRulerActive] = useState(false);
  const [rulerPoints, setRulerPoints] = useState([]);
  const externalFlyToRef = useRef(null);

  // Target Coordinate / Client Benchmark State
  const [targetCoordModal, setTargetCoordModal] = useState(false);
  const [targetPin, setTargetPin] = useState(null);

  const fetchNodesAndCables = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [resNodes, resCables] = await Promise.allSettled([
        fetch('/api/network-nodes?per_page=500').then(r => r.json()),
        fetch('/api/network-cables').then(r => r.json()),
      ]);

      if (resNodes.status === 'fulfilled' && resNodes.value?.data) {
        setAllNodes(resNodes.value.data);
      }
      if (resCables.status === 'fulfilled' && resCables.value?.data) {
        setAllCables(resCables.value.data);
      }
    } catch {
      if (!silent) {
        setAllNodes([]);
        setAllCables([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNodesAndCables();
  }, [fetchNodesAndCables]);

  // Live polling telemetry: silent fetch setiap 6 detik (kamera peta persisten)
  useEffect(() => {
    if (!livePolling) return;
    const timer = setInterval(() => {
      if (document.hidden) return;
      fetchNodesAndCables(true);
    }, 6000);

    return () => clearInterval(timer);
  }, [livePolling, fetchNodesAndCables]);

  // Update selectedNode live values smoothly
  useEffect(() => {
    if (selectedNode) {
      const updated = allNodes.find(n => n.id === selectedNode.id);
      if (updated && updated.optical_power_dbm !== selectedNode.optical_power_dbm) {
        setSelectedNode(updated);
      }
    }
  }, [allNodes, selectedNode]);

  // Compute End-to-End Traced Path Hierarchy for Selected Node
  const tracedPath = useMemo(() => {
    if (!selectedNode) return { nodeIds: new Set(), pathNodes: [] };
    const nodeMap = new Map(allNodes.map(n => [n.id, n]));
    const path = [];
    let curr = selectedNode;
    const visited = new Set();

    while (curr && !visited.has(curr.id)) {
      visited.add(curr.id);
      path.unshift(curr);
      if (curr.parent_node_id && nodeMap.has(curr.parent_node_id)) {
        curr = nodeMap.get(curr.parent_node_id);
      } else if (curr.node_type === 'ODP') {
        const potentialOdc = allNodes.find(n => n.node_type === 'ODC' && n.olt_device_id === curr.olt_device_id);
        if (potentialOdc && !visited.has(potentialOdc.id)) {
          curr = potentialOdc;
        } else {
          curr = null;
        }
      } else {
        curr = null;
      }
    }

    return {
      nodeIds: visited,
      pathNodes: path,
    };
  }, [selectedNode, allNodes]);

  // Calculate Total Distance for Ruler Tool
  const rulerTotalMeters = useMemo(() => {
    if (rulerPoints.length < 2) return 0;
    const R = 6371e3; // Earth radius in meters
    let sum = 0;

    for (let i = 0; i < rulerPoints.length - 1; i++) {
      const [lat1, lon1] = rulerPoints[i];
      const [lat2, lon2] = rulerPoints[i + 1];

      const φ1 = (lat1 * Math.PI) / 180;
      const φ2 = (lat2 * Math.PI) / 180;
      const Δφ = ((lat2 - lat1) * Math.PI) / 180;
      const Δλ = ((lon2 - lon1) * Math.PI) / 180;

      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      sum += R * c;
    }

    return sum;
  }, [rulerPoints]);

  // Calculate Nearest ODP to Target Client Pin
  const nearestOdp = useMemo(() => {
    if (!targetPin || allNodes.length === 0) return null;
    const odps = allNodes.filter(n => n.node_type === 'ODP' && n.latitude && n.longitude && parseFloat(n.latitude) !== 0);
    if (odps.length === 0) return null;

    const R = 6371e3;
    let closest = null;
    let minDist = Infinity;

    odps.forEach(odp => {
      const lat1 = targetPin.lat;
      const lon1 = targetPin.lng;
      const lat2 = parseFloat(odp.latitude);
      const lon2 = parseFloat(odp.longitude);

      const φ1 = (lat1 * Math.PI) / 180;
      const φ2 = (lat2 * Math.PI) / 180;
      const Δφ = ((lat2 - lat1) * Math.PI) / 180;
      const Δλ = ((lon2 - lon1) * Math.PI) / 180;

      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const d = R * c;

      if (d < minDist) {
        minDist = d;
        closest = { ...odp, distanceMeters: d };
      }
    });

    return closest;
  }, [targetPin, allNodes]);

  const handleStartMeasureFromOdp = (odp, target) => {
    setRulerActive(true);
    setRulerPoints([
      [parseFloat(odp.latitude), parseFloat(odp.longitude)],
      [target.lat, target.lng]
    ]);
  };

  // Filtered Nodes
  const filteredNodes = useMemo(() => {
    return allNodes.filter(n => {
      if (!['POP', 'ODC', 'ODP'].includes(n.node_type)) return false;
      if (oltFilterParam) {
        if (String(n.olt_device_id) !== String(oltFilterParam) && String(n.parent_node?.olt_device_id) !== String(oltFilterParam)) {
          return false;
        }
      }
      if (typeFilter && n.node_type !== typeFilter) return false;
      if (statusFilter && n.status !== statusFilter) return false;
      if (faultOnlyFilter) {
        const eff = n.best_rx_power ?? n.optical_power_dbm;
        const isFault = n.status === 'damaged' || n.status === 'inactive' || (eff != null && parseFloat(eff) <= -27.5) || (n.rx_power_range && n.rx_power_range.includes('Loss'));
        if (!isFault) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match = n.name?.toLowerCase().includes(q) || n.code?.toLowerCase().includes(q) || n.address?.toLowerCase().includes(q) || n.olt_port_ref?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [allNodes, oltFilterParam, typeFilter, statusFilter, faultOnlyFilter, searchQuery]);

  const nodesWithCoords = useMemo(() => {
    return filteredNodes.filter(n => n.latitude && n.longitude && parseFloat(n.latitude) !== 0);
  }, [filteredNodes]);

  // Search Auto-Suggestions
  const searchSuggestions = useMemo(() => {
    if (!searchQuery || searchQuery.trim().length === 0) return [];
    const q = searchQuery.toLowerCase();
    return allNodes.filter(n => {
      return n.name?.toLowerCase().includes(q) || n.code?.toLowerCase().includes(q) || n.address?.toLowerCase().includes(q) || n.olt_port_ref?.toLowerCase().includes(q);
    }).slice(0, 6);
  }, [allNodes, searchQuery]);

  const handleSelectSuggestion = (node) => {
    setSelectedNode(node);
    setSearchQuery(node.name);
    setIsSearchFocused(false);
    if (node.latitude && node.longitude && externalFlyToRef.current) {
      externalFlyToRef.current(parseFloat(node.latitude), parseFloat(node.longitude), 17);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 p-5 rounded-2xl shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors duration-300">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight font-sans">
              Peta Topologi GIS Spasial (POP-ODC-ODP)
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Monitoring transmisi optik, rute feeder FO, dan sebaran ODP secara real-time
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Target Location / Check Coordinates Button */}
          <button
            onClick={() => setTargetCoordModal(true)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
              targetPin
                ? 'bg-fuchsia-600 text-white border-fuchsia-600 shadow-md ring-2 ring-fuchsia-400/40'
                : 'bg-white dark:bg-neutral-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-800'
            }`}
            title="Cek lokasi rumah pelanggan dari koordinat GPS / cari nama pelanggan"
          >
            <span>📍 {targetPin ? 'Patokan Rumah Aktif' : 'Cek Koordinat Rumah'}</span>
          </button>

          {/* Ruler Button */}
          <button
            onClick={() => {
              const next = !rulerActive;
              setRulerActive(next);
              if (!next) setRulerPoints([]);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
              rulerActive
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md ring-2 ring-amber-400/40'
                : 'bg-white dark:bg-neutral-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-800'
            }`}
          >
            <span>📏 {rulerActive ? 'Tutup Penggaris' : 'Ukur Jarak FO'}</span>
          </button>

          <button
            onClick={() => setActiveView('map')}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${activeView === 'map'
              ? 'bg-blue-600 text-white border-blue-600 shadow-md'
              : 'bg-white dark:bg-neutral-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-800'
              }`}
          >
            Peta GIS Interaktif
          </button>
          <button
            onClick={() => setActiveView('list')}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${activeView === 'list'
              ? 'bg-blue-600 text-white border-blue-600 shadow-md'
              : 'bg-white dark:bg-neutral-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-800'
              }`}
          >
            Tabel Telemetry Redaman
          </button>
        </div>
      </div>

      <GisStatCards nodes={allNodes} />

      {/* Main Controls Filter Bar with Smart Search & Fault Filter */}
      <div className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 p-4 rounded-2xl shadow-2xs transition-colors duration-300 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 relative">
          {/* Smart Search Input with Floating Dropdown Suggestions */}
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              placeholder="Cari ODP, ODC, POP, OLT, Port..."
              className="px-3.5 py-2 bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}

            {/* Suggestions Dropdown */}
            {isSearchFocused && searchSuggestions.length > 0 && (
              <div className="absolute top-full left-0 mt-1.5 w-full bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-xl shadow-2xl z-[1000] overflow-hidden">
                {searchSuggestions.map(s => {
                  const tm = TYPE_META[s.node_type] ?? TYPE_META.ODC;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectSuggestion(s)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-neutral-800 flex items-center justify-between border-b border-slate-100 dark:border-neutral-800 last:border-0 cursor-pointer"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border ${tm.bg}`}>
                            {s.node_type}
                          </span>
                          <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{s.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 block">{s.code} • {s.olt_port_ref || 'PON'}</span>
                      </div>
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">Fly To ➔</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">Semua Tipe Node</option>
            <option value="POP">POP Central</option>
            <option value="ODC">ODC Cabinet</option>
            <option value="ODP">ODP Point</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">Semua Status</option>
            <option value="active">Aktif Normal</option>
            <option value="maintenance">Maintenance</option>
            <option value="inactive">Tidak Aktif</option>
            <option value="damaged">Rusak / Loss</option>
          </select>

          {/* Quick Filter: Hanya Gangguan / LOS */}
          <button
            type="button"
            onClick={() => setFaultOnlyFilter(!faultOnlyFilter)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
              faultOnlyFilter
                ? 'bg-rose-500 text-white border-rose-600 shadow-md ring-2 ring-rose-400/40'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:bg-rose-100'
            }`}
          >
            <span>🚨 Hanya Node Bermasalah</span>
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setLivePolling(!livePolling)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${livePolling
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
              : 'bg-slate-100 dark:bg-neutral-900 border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-slate-400'
              }`}
          >
            <span className={`w-2 h-2 rounded-full ${livePolling ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            <span>{livePolling ? 'Telemetry Live' : 'Telemetry Paused'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white dark:bg-black rounded-2xl border border-slate-200 dark:border-neutral-800 p-12 text-center text-slate-400 dark:text-slate-500 text-xs animate-pulse">
          Memuat topologi spasial GIS &amp; data redaman...
        </div>
      ) : activeView === 'map' ? (
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl shadow-2xs overflow-hidden relative transition-colors duration-300 min-h-[640px]">
          {/* Node Detail Drawer */}
          <NodeDetailPanel
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
            onOpenStreetView={(lat, lng, title) => setStreetViewTarget({ lat, lng, title })}
            onTracePath={node => {
              setSelectedNode(node);
              if (node.latitude && node.longitude && externalFlyToRef.current) {
                externalFlyToRef.current(parseFloat(node.latitude), parseFloat(node.longitude), 17);
              }
            }}
          />

          {/* Path Tracing Hierarchy Breadcrumb Banner */}
          {tracedPath.pathNodes.length > 1 && (
            <PathTracingBanner
              pathNodes={tracedPath.pathNodes}
              activeNodeId={selectedNode?.id}
              onSelectNode={node => {
                setSelectedNode(node);
                if (node.latitude && node.longitude && externalFlyToRef.current) {
                  externalFlyToRef.current(parseFloat(node.latitude), parseFloat(node.longitude), 17);
                }
              }}
              onClose={() => setSelectedNode(null)}
            />
          )}

          {/* Target House Pin Floating Banner */}
          {targetPin && (
            <TargetPinBanner
              targetPin={targetPin}
              nearestOdp={nearestOdp}
              onFlyToTarget={() => {
                if (externalFlyToRef.current) {
                  externalFlyToRef.current(targetPin.lat, targetPin.lng, 17);
                }
              }}
              onStartMeasureFromOdp={handleStartMeasureFromOdp}
              onClearTarget={() => setTargetPin(null)}
            />
          )}

          {/* Interactive Ruler Distance HUD with Undo */}
          {rulerActive && (
            <RulerHud
              waypoints={rulerPoints}
              totalMeters={rulerTotalMeters}
              onUndo={() => setRulerPoints(pts => pts.slice(0, -1))}
              onReset={() => setRulerPoints([])}
              onClose={() => {
                setRulerActive(false);
                setRulerPoints([]);
              }}
            />
          )}

          {/* Leaflet Map Component */}
          <LeafletMap
            nodes={nodesWithCoords}
            cables={allCables}
            selectedNode={selectedNode}
            tracedPath={tracedPath}
            rulerActive={rulerActive}
            rulerPoints={rulerPoints}
            setRulerPoints={setRulerPoints}
            targetPin={targetPin}
            nearestOdp={nearestOdp}
            onSelectNode={node => setSelectedNode(node)}
            onOpenStreetView={(lat, lng, title) => setStreetViewTarget({ lat, lng, title })}
            externalFlyToRef={externalFlyToRef}
          />
        </div>
      ) : (
        /* Tabel Telemetry Redaman */
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl shadow-2xs overflow-hidden transition-colors duration-300">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-950 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-5 py-3.5">Node &amp; Kode</th>
                  <th className="px-4 py-3.5">Tipe</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Port Terpakai</th>
                  <th className="px-4 py-3.5">Kualitas Redaman (Rx)</th>
                  <th className="px-4 py-3.5">Koordinat GPS</th>
                  <th className="px-4 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-neutral-900 text-xs">
                {filteredNodes.map(node => {
                  const typeMeta = TYPE_META[node.node_type] ?? TYPE_META.ODC;
                  const statusMeta = STATUS_META[node.status] ?? STATUS_META.active;
                  const effectivePower = node.best_rx_power ?? node.optical_power_dbm;
                  const isLoss = node.status === 'damaged' || (node.rx_power_range && (node.rx_power_range.includes('Loss') || node.rx_power_range.includes('LOS')));
                  const optMeta = isLoss 
                    ? { label: 'Loss / Kritis', color: '#e11d48', badge: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800' }
                    : getOpticalQuality(effectivePower);

                  return (
                    <tr key={node.id} className="hover:bg-slate-50/60 dark:hover:bg-neutral-900/50 transition-colors">
                      <td className="px-5 py-3">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">{node.name}</span>
                        <span className="text-[10px] font-mono text-slate-400">{node.code}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${typeMeta.bg}`}>
                          {node.node_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${statusMeta.badge}`}>
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-slate-600 dark:text-slate-400">
                        {node.total_ports > 0 ? `${node.used_ports}/${node.total_ports} Port` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {node.node_type === 'ODP' ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold" style={{ color: optMeta.color }}>
                              {node.rx_power_range ? node.rx_power_range : (effectivePower != null ? `${parseFloat(effectivePower).toFixed(2)} dBm` : '—')}
                            </span>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${optMeta.badge}`}>
                              {optMeta.label}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono text-[10px]">Headend/Distribution</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                        {node.latitude && node.longitude ? (
                          <span>{parseFloat(node.latitude).toFixed(5)}, {parseFloat(node.longitude).toFixed(5)}</span>
                        ) : (
                          <span className="text-slate-400 italic">Belum diset</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedNode(node);
                            setActiveView('map');
                          }}
                          className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 rounded-lg text-xs font-bold transition-all border border-blue-200 dark:border-blue-800 cursor-pointer"
                        >
                          Lihat Peta
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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

      {/* Target Client Coordinate Modal */}
      <TargetCoordModal
        isOpen={targetCoordModal}
        onClose={() => setTargetCoordModal(false)}
        onSetTarget={(target) => {
          setTargetPin(target);
          if (externalFlyToRef.current) {
            externalFlyToRef.current(target.lat, target.lng, 17);
          }
        }}
      />
    </div>
  );
}
