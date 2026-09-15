import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { decimalToDms, parseCoordsInput } from '../utils/coordinateParser.js';
import { naturalNodeCompare } from '../utils/naturalSort.js';
import KmlImportModal from '../components/KmlImportModal.jsx';

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
    label: 'Aktif Normal',
    badge: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
    color: '#059669',
  },
  active_loss: {
    label: 'Aktif (Gangguan Loss)',
    badge: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse font-bold',
    color: '#ef4444',
  },
  maintenance: {
    label: 'Maintenance',
    badge: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
    color: '#d97706',
  },
  inactive: {
    label: 'Tidak Aktif',
    badge: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700',
    color: '#64748b',
  },
  damaged: {
    label: 'Gangguan Loss',
    badge: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse font-bold',
    color: '#ef4444',
  },
};

const getNodeEffectiveStatus = (node) => {
  if (!node) return { key: 'active', label: 'Aktif Normal', badge: STATUS_META.active.badge, color: '#059669', pinBg: '#059669', isLoss: false, isInactive: false, hasRadar: false };

  const effectivePower = node.best_rx_power ?? node.optical_power_dbm;
  const isLossRange = node.rx_power_range && (node.rx_power_range.includes('Loss') || node.rx_power_range.includes('LOS'));
  const isOpticalLoss = isLossRange || (effectivePower != null && parseFloat(effectivePower) <= -27.5);

  // 1. Status TIDAK AKTIF (Offline / Nonaktif) - Warna Abu-abu Netral, BUKAN Gangguan Loss
  if (node.status === 'inactive') {
    return {
      key: 'inactive',
      label: 'Tidak Aktif',
      badge: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700',
      color: '#64748b',
      pinBg: '#64748b',
      nameBorder: '#94a3b8',
      nameText: '#475569',
      isLoss: false,
      isInactive: true,
      hasRadar: false,
    };
  }

  // 2. Status MAINTENANCE
  if (node.status === 'maintenance') {
    return {
      key: 'maintenance',
      label: 'Maintenance',
      badge: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
      color: '#d97706',
      pinBg: '#d97706',
      nameBorder: '#f59e0b',
      nameText: '#0f172a',
      isLoss: false,
      isInactive: false,
      hasRadar: false,
    };
  }

  // 3. Status DAMAGED atau STATUS AKTIF TETAPI SEDANG GANGGUAN LOSS
  if (node.status === 'damaged' || isOpticalLoss) {
    const isActuallyActive = node.status === 'active';
    return {
      key: isActuallyActive ? 'active_loss' : 'damaged',
      label: isActuallyActive ? 'Aktif (Gangguan Loss)' : 'Gangguan Loss',
      badge: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse font-bold',
      color: '#ef4444',
      pinBg: '#ef4444',
      nameBorder: '#f87171',
      nameText: '#991b1b',
      isLoss: true,
      isInactive: false,
      hasRadar: true,
    };
  }

  // 4. Status AKTIF NORMAL
  let pinColor = '#059669'; // Emerald
  if (node.node_type === 'POP') pinColor = '#4f46e5'; // Indigo
  else if (node.node_type === 'ODC') pinColor = '#2563eb'; // Royal Blue

  return {
    key: 'active',
    label: 'Online / Aktif Normal',
    badge: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
    color: pinColor,
    pinBg: pinColor,
    nameBorder: '#cbd5e1',
    nameText: '#0f172a',
    isLoss: false,
    isInactive: false,
    hasRadar: false,
  };
};

const getOpticalQuality = (dbm) => {
  if (dbm == null) {
    return {
      label: '—',
      color: '#64748b',
      pillBg: '#f8fafc',
      pillText: '#475569',
      pillBorder: '#e2e8f0',
      badge: 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
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
  const effStatus = getNodeEffectiveStatus(node);
  const effectivePower = node.best_rx_power ?? node.optical_power_dbm;
  const isLoss = effStatus.isLoss;
  const optMeta = isLoss 
    ? { label: 'Loss / Kritis', color: '#ef4444', badge: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800' }
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
    <div className="fixed sm:absolute bottom-0 sm:bottom-auto sm:top-4 left-0 sm:left-4 right-0 sm:right-auto z-[999] w-full sm:w-96 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-slate-200 dark:border-slate-800 p-4 sm:p-5 transition-all text-slate-800 dark:text-slate-100 max-h-[75vh] sm:max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom sm:slide-in-from-left duration-200">
      <div className="sm:hidden w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mb-3" />
      <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${typeMeta.bg}`}>
              {node.node_type}
            </span>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${effStatus.badge}`}>
              {effStatus.label}
            </span>
          </div>
          <h4 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
            {node.name}
          </h4>
          <p className="text-xs text-slate-400 font-mono mt-0.5">{node.code}</p>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all text-xs font-bold cursor-pointer"
        >
          ✕
        </button>
      </div>

      <div className="mt-4 space-y-4 text-xs">
        {/* Optical Telemetry Signal Box */}
        {node.node_type === 'ODP' && (
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Telemetry Redaman Rx</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${optMeta.badge}`}>
                {optMeta.label}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono" style={{ color: optMeta.color }}>
                {node.rx_power_range ? node.rx_power_range : (effectivePower != null ? `${parseFloat(effectivePower).toFixed(2)} dBm` : '—')}
              </span>
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                {node.used_ports} Klien Terhubung
              </span>
            </div>
          </div>
        )}

        {/* GPS Coordinates & Google Earth / Maps Navigation */}
        <div className="space-y-2">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">
            Posisi Geografis GPS
          </span>
          {node.latitude && node.longitude ? (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Koordinat Desimal:
                </span>
                <button
                  onClick={handleCopyCoords}
                  className="px-2.5 py-0.5 text-[10px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {copied ? 'Tersalin!' : 'Salin'}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-1.5 font-mono text-xs">
                <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                  <span className="text-[10px] font-sans font-semibold text-slate-500 dark:text-slate-400">Google Maps:</span>
                  <span className="font-bold">{parseFloat(node.latitude).toFixed(6)}, {parseFloat(node.longitude).toFixed(6)}</span>
                </div>
                <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400">
                  <span className="text-[10px] font-sans font-semibold text-slate-500 dark:text-slate-400">Google Earth:</span>
                  <span className="font-bold">{dmsInfo.formattedDms || '—'}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => onOpenStreetView(node.latitude, node.longitude, node.name)}
                  className="py-2 px-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold rounded-xl flex items-center justify-center gap-1 transition-all text-center col-span-3 sm:col-span-1 shadow-2xs cursor-pointer"
                >
                  <span>👁️ Street View</span>
                </button>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${node.latitude},${node.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold rounded-xl flex items-center justify-center gap-1 transition-all text-center shadow-2xs"
                >
                  <span>🗺️ Maps</span>
                </a>
                <a
                  href={`https://earth.google.com/web/search/${node.latitude},${node.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-2 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 text-[11px] font-bold rounded-xl flex items-center justify-center gap-1 transition-all text-center shadow-2xs"
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
            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Kapasitas Port</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{node.used_ports}/{node.total_ports} Port ({p}%)</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${p > 90 ? 'bg-rose-600' : p > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${p}%` }}
                />
              </div>
            </div>
          )}

          <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block mb-1">OLT &amp; Port Uplink</span>
            <p className="font-bold text-slate-900 dark:text-white">{node.olt_device?.name || node.parent_node?.olt_device?.name || 'OLT Region'}</p>
            <p className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold">{node.olt_port_ref || 'PON 1/1/1'}</p>
          </div>
        </div>

        {/* Quick Action Button to Trace Path */}
        <button
          onClick={() => onTracePath && onTracePath(node)}
          className="w-full py-2.5 px-3 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
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
   TARGET CLIENT COORDINATE MODAL (MANUAL INPUT ONLY)
══════════════════════════════════════════════════════════════════ */
function TargetCoordModal({ isOpen, onClose, onSetTarget }) {
  const [inputVal, setInputVal] = useState('');

  const parsed = useMemo(() => {
    return parseCoordsInput(inputVal);
  }, [inputVal]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!parsed.isValid) return;

    onSetTarget({
      lat: parsed.lat,
      lng: parsed.lng,
      label: 'Patokan Lokasi',
      dms: parsed.formattedDms,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-800 dark:text-slate-100">
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-lg">📍</span>
            <div>
              <h3 className="text-sm font-bold">Cek Koordinat Rumah Client / Patokan</h3>
              <p className="text-[11px] text-slate-400">Masukkan koordinat untuk menandai patokan titik ukur di peta</p>
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
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block">
              Koordinat GPS (Desimal / Google Earth DMS) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              placeholder="Contoh: -0.785123, 100.654123 atau 0°47'5.96&quot;S 100°39'15.87&quot;T"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 text-xs"
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

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!parsed.isValid}
              className="px-5 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>📍 Tampilkan di Peta</span>
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
function TargetPinBanner({ targetPin, onFlyToTarget, onClearTarget }) {
  if (!targetPin) return null;

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[998] bg-slate-900/95 text-white backdrop-blur-md border border-fuchsia-500/70 shadow-2xl rounded-2xl px-4 py-2.5 flex items-center gap-3 text-xs max-w-[92vw] animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center gap-2 shrink-0">
        <span className="w-2.5 h-2.5 rounded-full bg-fuchsia-400 animate-ping"></span>
        <div>
          <span className="font-extrabold text-fuchsia-300 block">🏠 Patokan Titik Rumah</span>
          <span className="text-[10px] font-mono text-slate-300">
            {targetPin.lat.toFixed(6)}, {targetPin.lng.toFixed(6)} {targetPin.dms ? `(${targetPin.dms})` : ''}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-auto">
        <button
          onClick={onFlyToTarget}
          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[11px] font-bold text-slate-200 transition-all cursor-pointer flex items-center gap-1"
        >
          🎯 Fokus
        </button>

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
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[998] bg-slate-900/95 text-white backdrop-blur-md border border-cyan-500/60 shadow-2xl rounded-2xl px-4 py-2.5 flex items-center gap-3 text-xs max-w-[92vw] overflow-hidden">
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
  nodes = [],
  cables = [],
  selectedNode,
  tracedPath,
  rulerActive,
  rulerPoints = [],
  setRulerPoints,
  targetPin,
  isFullscreen,
  onToggleFullscreen,
  onSelectNode,
  onOpenStreetView,
  externalFlyToRef,
}) {
  const safeNodes = useMemo(() => Array.isArray(nodes) ? nodes : (nodes && typeof nodes === 'object' ? Object.values(nodes) : []), [nodes]);
  const safeCables = useMemo(() => Array.isArray(cables) ? cables : (cables && typeof cables === 'object' ? Object.values(cables) : []), [cables]);
  const safeRulerPoints = useMemo(() => Array.isArray(rulerPoints) ? rulerPoints : [], [rulerPoints]);

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
  const markersMapRef = useRef(new Map());
  const currentZoomTierRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isSatellite, setIsSatellite] = useState(true);

  useEffect(() => {
    rulerActiveRef.current = rulerActive;
  }, [rulerActive]);

  // Invalidate map size when fullscreen mode toggles
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const t1 = setTimeout(() => mapInstanceRef.current?.invalidateSize(), 60);
    const t2 = setTimeout(() => mapInstanceRef.current?.invalidateSize(), 250);
    const t3 = setTimeout(() => mapInstanceRef.current?.invalidateSize(), 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isFullscreen]);

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
          preferCanvas: true,
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
        markersMapRef.current.clear();
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
    const validNodes = safeNodes.filter(n => n?.latitude && n?.longitude && parseFloat(n.latitude) !== 0);
    if (validNodes.length === 0) return;

    const bounds = validNodes.map(n => [parseFloat(n.latitude), parseFloat(n.longitude)]);
    if (bounds.length === 1) {
      mapInstanceRef.current.setView(bounds[0], 16);
    } else {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
    }
  }, [safeNodes]);

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

    if (!rulerActive || safeRulerPoints.length === 0) return;

    // Draw waypoints
    safeRulerPoints.forEach((pt, idx) => {
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
    if (safeRulerPoints.length >= 2) {
      Lf.polyline(safeRulerPoints, {
        color: '#f97316',
        weight: 3.5,
        opacity: 0.95,
        dashArray: '8, 6',
      }).addTo(layer);
    }
  }, [rulerActive, safeRulerPoints]);

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
  }, [targetPin, setRulerPoints]);

  // 6a. Render Physical Network Cables (Canvas Hardware-Accelerated)
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !leafletRef.current || !cablesLayerGroupRef.current) return;
    const Lf = leafletRef.current;
    const cablesGroup = cablesLayerGroupRef.current;
    cablesGroup.clearLayers();

    safeCables.forEach(cable => {
      if (!cable) return;
      let coords = cable.route_coordinates;
      if (typeof coords === 'string') {
        try { coords = JSON.parse(coords); } catch (e) { coords = null; }
      }
      if (Array.isArray(coords) && coords.length >= 2) {
        const cableColor = cable.cable_color || '#2563eb';
        
        // Single clean solid polyline - hardware accelerated by Canvas
        const poly = Lf.polyline(coords, {
          color: cableColor,
          weight: 3.5,
          opacity: 0.85,
          lineJoin: 'round',
          lineCap: 'round',
        }).addTo(cablesGroup);

        const lenText = cable.length_meters
          ? (cable.length_meters >= 1000 ? (cable.length_meters / 1000).toFixed(2) + ' km' : cable.length_meters + ' m')
          : '—';

        poly.bindPopup(`
          <div style="font-family: inherit; font-size: 11px; padding: 4px; min-width: 170px;">
            <div style="font-weight: 800; font-size: 12px; margin-bottom: 4px; color: #1e293b;">
              🧵 ${cable.name}
            </div>
            <div><strong>Panjang:</strong> ${lenText}</div>
            <div><strong>Kapasitas:</strong> ${cable.core_count_total || 6} Core</div>
            ${cable.notes ? `<div style="margin-top: 4px; color: #64748b; font-size: 10px; border-top: 1px solid #e2e8f0; padding-top: 4px; max-height: 80px; overflow-y: auto;">${cable.notes}</div>` : ''}
          </div>
        `);
      }
    });
  }, [mapLoaded, safeCables]);

  // Helper to format concise optical text
  const formatCompactOptical = (node, effStatus) => {
    if (effStatus.isLoss) return 'LOS';
    if (effStatus.isInactive) return '';
    const effectivePower = node.best_rx_power ?? node.optical_power_dbm;
    if (effectivePower != null && !isNaN(parseFloat(effectivePower))) {
      return `${parseFloat(effectivePower).toFixed(1)} dBm`;
    }
    if (node.rx_power_range) {
      if (node.rx_power_range.includes('Loss') || node.rx_power_range.includes('LOS')) return 'LOS';
      const match = node.rx_power_range.match(/-?\d+(\.\d+)?/g);
      if (match && match.length >= 2) {
        return `${parseFloat(match[0]).toFixed(1)} ~ ${parseFloat(match[1]).toFixed(1)}`;
      } else if (match && match.length === 1) {
        return `${parseFloat(match[0]).toFixed(1)} dBm`;
      }
    }
    return '';
  };

  // 6b. Ultra-Lightweight Unified Enterprise Marker System (Model Bulat / Circular Pin)
  const buildCircleHtml = (node, effStatus, optMeta, isSelected, isBadgeMode) => {
    const isOdp = node.node_type === 'ODP';
    const compactDbm = isOdp && !effStatus.isInactive ? formatCompactOptical(node, effStatus) : '';

    let statusCls = '';
    if (effStatus.isLoss) statusCls = 'gis-circle-loss';
    else if (effStatus.isInactive) statusCls = 'gis-circle-inactive';
    else if (effStatus.key === 'maintenance') statusCls = 'gis-circle-maint';

    const nodeTypeCls = node.node_type === 'POP' ? 'is-pop' : node.node_type === 'ODC' ? 'is-odc' : 'is-odp';

    return `
      <div class="gis-circle-marker ${nodeTypeCls} ${statusCls} ${isSelected ? 'is-selected' : ''}">
        <div class="gis-circle-node" style="border-color: ${effStatus.pinBg};">
          <span class="gis-circle-icon">${node.node_type}</span>
          ${effStatus.hasRadar ? `<span class="gis-circle-ping" style="border-color: ${effStatus.pinBg};"></span>` : ''}
        </div>
        ${isBadgeMode ? `
          <div class="gis-circle-stack">
            <span class="gis-circle-name" title="${node.name} (${node.code})">${node.name}</span>
            ${compactDbm ? `
              <span class="gis-circle-dbm" style="color:${optMeta.color};background:${optMeta.pillBg};border-color:${optMeta.pillBorder};">
                ${compactDbm}
              </span>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  };

  const buildDotHtml = (node, effStatus, isSelected) => {
    return `
      <div class="gis-micro-dot ${isSelected ? 'is-selected' : ''}" style="background:${effStatus.pinBg};">
        ${effStatus.hasRadar ? '<span class="gis-micro-ping"></span>' : ''}
      </div>
    `;
  };

  const renderNodes = useCallback(() => {
    if (!mapLoaded || !mapInstanceRef.current || !leafletRef.current || !nodesLayerGroupRef.current) return;
    const Lf = leafletRef.current;
    const map = mapInstanceRef.current;
    const nodesGroup = nodesLayerGroupRef.current;
    const highlightGroup = pathHighlightLayerGroupRef.current;

    if (highlightGroup) highlightGroup.clearLayers();

    const zoom = map.getZoom();
    const zoomTier = zoom >= 16 ? 'badge' : (zoom >= 14 ? 'circle-only' : 'dot');
    const tierChanged = currentZoomTierRef.current !== zoomTier;
    currentZoomTierRef.current = zoomTier;

    const nodeMap = new Map();
    safeNodes.forEach(n => {
      if (n?.latitude && n?.longitude && parseFloat(n.latitude) !== 0) {
        nodeMap.set(n.id, n);
      }
    });

    // 1. Draw Fiber Connections ONLY when Path Tracing is explicitly active
    const isPathTracingActive = tracedPath?.nodeIds && tracedPath.nodeIds.size > 1;
    if (isPathTracingActive && highlightGroup) {
      safeNodes.forEach(node => {
        if (!node?.latitude || !node?.longitude || parseFloat(node.latitude) === 0) return;
        if (!tracedPath.nodeIds.has(node.id)) return;

        let parent = null;
        if (node.parent_node_id && nodeMap.has(node.parent_node_id)) {
          parent = nodeMap.get(node.parent_node_id);
        }

        if (parent && parent.latitude && parent.longitude && tracedPath.nodeIds.has(parent.id)) {
          const lineCoords = [
            [parseFloat(parent.latitude), parseFloat(parent.longitude)],
            [parseFloat(node.latitude), parseFloat(node.longitude)]
          ];

          Lf.polyline(lineCoords, {
            color: '#0284c7',
            weight: 4,
            opacity: 0.9,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(highlightGroup);
        }
      });
    }

    // 2. High-performance Persistent Marker Diffing (Zero DOM Thrashing on Pan)
    const currentMarkers = markersMapRef.current;
    const nextNodeIds = new Set();

    safeNodes.forEach(node => {
      if (!node?.latitude || !node?.longitude || parseFloat(node.latitude) === 0) return;
      const id = node.id;
      nextNodeIds.add(id);

      const lat = parseFloat(node.latitude);
      const lng = parseFloat(node.longitude);
      const isSelected = selectedNode?.id === id;
      const effStatus = getNodeEffectiveStatus(node);
      const effectiveBestPower = node.best_rx_power ?? node.optical_power_dbm;
      const isFault = effStatus.isLoss;
      const optMeta = isFault 
        ? { label: 'Loss / Kritis', color: '#ef4444', pillBg: '#fff1f2', pillBorder: '#fecdd3' } 
        : getOpticalQuality(effectiveBestPower);

      const opticalDbmText = node.rx_power_range 
        ? node.rx_power_range 
        : (effectiveBestPower != null ? `${parseFloat(effectiveBestPower).toFixed(1)} dBm` : '—');

      const isBadgeMode = zoomTier === 'badge' || isSelected || node.node_type === 'POP' || node.node_type === 'ODC';
      const isCircleMode = zoomTier !== 'dot' || isSelected || node.node_type === 'POP' || node.node_type === 'ODC';

      let existing = currentMarkers.get(id);

      if (existing) {
        // Visual update only if properties or zoom tier changed
        const needsIconUpdate = tierChanged || 
          existing.isSelected !== isSelected || 
          existing.statusKey !== effStatus.key || 
          existing.opticalDbm !== effectiveBestPower ||
          existing.isBadgeMode !== isBadgeMode ||
          existing.isCircleMode !== isCircleMode;

        if (needsIconUpdate) {
          const iconHtml = isCircleMode
            ? buildCircleHtml(node, effStatus, optMeta, isSelected, isBadgeMode)
            : buildDotHtml(node, effStatus, isSelected);

          const newIcon = Lf.divIcon({
            className: 'gis-marker-container',
            html: iconHtml,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          });

          existing.marker.setIcon(newIcon);
          existing.isSelected = isSelected;
          existing.statusKey = effStatus.key;
          existing.opticalDbm = effectiveBestPower;
          existing.isBadgeMode = isBadgeMode;
          existing.isCircleMode = isCircleMode;
        }

        const curLatLng = existing.marker.getLatLng();
        if (Math.abs(curLatLng.lat - lat) > 0.000001 || Math.abs(curLatLng.lng - lng) > 0.000001) {
          existing.marker.setLatLng([lat, lng]);
        }
      } else {
        // Create new marker once and cache
        const iconHtml = isCircleMode
          ? buildCircleHtml(node, effStatus, optMeta, isSelected, isBadgeMode)
          : buildDotHtml(node, effStatus, isSelected);

        const icon = Lf.divIcon({
          className: 'gis-marker-container',
          html: iconHtml,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const marker = Lf.marker([lat, lng], { icon }).addTo(nodesGroup);

        marker.bindTooltip(`<b>${node.name}</b> (${node.code})<br>Tipe: ${node.node_type} • Status: ${effStatus.label}${opticalDbmText !== '—' ? '<br>Rx: ' + opticalDbmText : ''}`, {
          direction: 'top',
          offset: [0, -18],
          opacity: 0.95,
        });

        marker.on('click', (e) => {
          if (rulerActiveRef.current) {
            if (e.originalEvent) e.originalEvent.stopPropagation();
            if (Lf.DomEvent) Lf.DomEvent.stopPropagation(e);
            setRulerPoints(pts => [...pts, [lat, lng]]);
            return;
          }
          onSelectNode(node);
        });

        currentMarkers.set(id, {
          marker,
          isSelected,
          statusKey: effStatus.key,
          opticalDbm: effectiveBestPower,
          isBadgeMode,
          isCircleMode,
        });
      }
    });

    // Remove markers that are filtered out
    for (const [id, record] of currentMarkers.entries()) {
      if (!nextNodeIds.has(id)) {
        nodesGroup.removeLayer(record.marker);
        currentMarkers.delete(id);
      }
    }
  }, [mapLoaded, safeNodes, selectedNode, tracedPath, onSelectNode, setRulerPoints]);

  // 6c. Attach Smooth Viewport & Zoom Listeners (NO moveend listener = 60 FPS silky smooth panning)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const handleZoom = () => {
      renderNodes();
    };

    map.on('zoomend', handleZoom);

    // Initial render
    renderNodes();

    // Fit bounds on first render
    if (isFirstRenderRef.current && safeNodes.length > 0) {
      const validNodes = safeNodes.filter(n => n?.latitude && n?.longitude && parseFloat(n.latitude) !== 0);
      if (validNodes.length > 0) {
        const bounds = validNodes.map(n => [parseFloat(n.latitude), parseFloat(n.longitude)]);
        try {
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        } catch { }
        isFirstRenderRef.current = false;
      }
    }

    return () => {
      map.off('zoomend', handleZoom);
    };
  }, [renderNodes, safeNodes]);

  return (
    <div className="relative w-full h-full">
      {/* Sleek GPU-Accelerated GIS Chip Styles */}
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

        /* Marker Zero-Size Anchor with GPU Translate */
        .gis-marker-container {
          width: 0 !important;
          height: 0 !important;
          border: none !important;
          background: transparent !important;
        }

        /* ── CIRCULAR GIS NODE MARKER ── */
        .gis-circle-marker {
          position: absolute;
          left: 0;
          top: 0;
          transform: translate3d(-50%, -50%, 0);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          user-select: none;
          transition: transform 0.14s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.14s ease;
          pointer-events: auto;
          will-change: transform;
        }

        .gis-circle-marker:hover {
          transform: translate3d(-50%, -50%, 0) scale(1.15);
          z-index: 1000 !important;
        }

        .gis-circle-marker.is-selected {
          transform: translate3d(-50%, -50%, 0) scale(1.22);
          z-index: 1001 !important;
        }

        .gis-circle-node {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2.5px solid #10b981;
          background: #ffffff;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.28);
          position: relative;
          transition: all 0.14s ease;
          flex-shrink: 0;
        }
        .dark .gis-circle-node {
          background: #0f172a;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.65);
        }

        .gis-circle-marker.is-pop .gis-circle-node {
          width: 32px;
          height: 32px;
          border-width: 3px;
        }
        .gis-circle-marker.is-odc .gis-circle-node {
          width: 28px;
          height: 28px;
          border-width: 2.5px;
        }

        .gis-circle-icon {
          font-size: 8px;
          font-weight: 900;
          letter-spacing: -0.02em;
          color: #0f172a;
          line-height: 1;
        }
        .dark .gis-circle-icon {
          color: #f8fafc;
        }
        .gis-circle-marker.is-pop .gis-circle-icon {
          font-size: 9.5px;
          color: #4f46e5;
        }
        .dark .gis-circle-marker.is-pop .gis-circle-icon {
          color: #818cf8;
        }
        .gis-circle-marker.is-odc .gis-circle-icon {
          font-size: 8.5px;
          color: #2563eb;
        }
        .dark .gis-circle-marker.is-odc .gis-circle-icon {
          color: #60a5fa;
        }
        .gis-circle-marker.is-odp .gis-circle-icon {
          font-size: 7.5px;
          color: #059669;
        }
        .dark .gis-circle-marker.is-odp .gis-circle-icon {
          color: #34d399;
        }

        .gis-circle-ping {
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 2px solid #ef4444;
          animation: radarPing 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
          pointer-events: none;
        }

        /* Vertical Stack Card under the circle */
        .gis-circle-stack {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1.5px;
          margin-top: 2px;
          padding: 1.5px 5px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.94);
          backdrop-filter: blur(4px);
          border: 1px solid #cbd5e1;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.16);
          white-space: nowrap;
          max-width: 90px;
          text-align: center;
        }
        .dark .gis-circle-stack {
          background: rgba(15, 23, 42, 0.92);
          border-color: #334155;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
        }

        .gis-circle-name {
          font-size: 9px;
          font-weight: 800;
          color: #0f172a;
          max-width: 78px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          line-height: 1.1;
        }
        .dark .gis-circle-name {
          color: #f1f5f9;
        }

        .gis-circle-dbm {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 7.5px;
          font-weight: 800;
          padding: 0.5px 3.5px;
          border-radius: 4px;
          line-height: 1.1;
          border: 1px solid transparent;
          white-space: nowrap;
        }

        .gis-circle-loss .gis-circle-node {
          border-color: #ef4444 !important;
          background: #fff1f2 !important;
        }
        .dark .gis-circle-loss .gis-circle-node {
          background: #2b0b14 !important;
        }
        .gis-circle-loss .gis-circle-icon {
          color: #ef4444 !important;
        }
        .gis-circle-loss .gis-circle-stack {
          border-color: #fca5a5 !important;
          background: #fff1f2 !important;
        }
        .dark .gis-circle-loss .gis-circle-stack {
          border-color: #e11d48 !important;
          background: #2b0b14 !important;
        }
        .gis-circle-loss .gis-circle-name {
          color: #e11d48 !important;
        }
        .dark .gis-circle-loss .gis-circle-name {
          color: #fb7185 !important;
        }

        .gis-circle-inactive {
          opacity: 0.75;
        }
        .gis-circle-inactive .gis-circle-node {
          border-color: #94a3b8 !important;
        }

        .gis-micro-dot {
          position: absolute;
          left: 0;
          top: 0;
          transform: translate3d(-50%, -50%, 0);
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: 2px solid #ffffff;
          box-shadow: 0 1px 5px rgba(0, 0, 0, 0.4);
          cursor: pointer;
          transition: transform 0.1s ease;
          will-change: transform;
        }
        .gis-micro-dot:hover {
          transform: translate3d(-50%, -50%, 0) scale(1.6);
          z-index: 1000 !important;
        }
        .gis-micro-dot.is-selected {
          transform: translate3d(-50%, -50%, 0) scale(1.8);
          box-shadow: 0 0 0 3px #3b82f6;
          z-index: 1001 !important;
        }
        .gis-micro-ping {
          position: absolute;
          inset: -3px;
          border-radius: 50%;
          border: 2px solid #ef4444;
          animation: radarPing 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
          pointer-events: none;
        }

        @keyframes radarPing {
          0% { transform: scale(0.85); opacity: 0.9; }
          70% { transform: scale(2.2); opacity: 0; }
          100% { transform: scale(2.4); opacity: 0; }
        }

        @keyframes targetPing {
          0% { transform: scale(0.85); opacity: 0.9; }
          70% { transform: scale(2.2); opacity: 0; }
          100% { transform: scale(2.4); opacity: 0; }
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
        className={`w-full overflow-hidden relative z-0 transition-all ${isFullscreen ? 'h-full rounded-none' : 'rounded-2xl shadow-inner'}`}
        style={{ height: isFullscreen ? '100%' : '640px', minHeight: isFullscreen ? '100%' : '640px' }}
      />

      {/* Floating Mode Controls */}
      <div className="absolute top-4 right-4 z-[999] flex flex-wrap items-center justify-end gap-2">
        {!isFullscreen && (
          <button
            onClick={onToggleFullscreen}
            className="px-3.5 py-2 text-xs font-bold rounded-xl border shadow-md backdrop-blur-md transition-all flex items-center gap-1.5 cursor-pointer bg-white/95 dark:bg-slate-900/95 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700"
            title="Buka Peta Mode Layar Penuh"
          >
            <span>⛶ Layar Penuh</span>
          </button>
        )}

        <button
          onClick={toggleMapMode}
          className="px-3.5 py-2 bg-white/95 dark:bg-slate-900/95 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 shadow-md backdrop-blur-md transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <span>{isSatellite ? '🗺️ Mode Vektor' : '🛰️ Mode Satelit'}</span>
        </button>

        {selectedNode && selectedNode.latitude && selectedNode.longitude && (
          <button
            onClick={() => onOpenStreetView(selectedNode.latitude, selectedNode.longitude, selectedNode.name)}
            className="px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>👁️ Street View 360°</span>
          </button>
        )}
      </div>

      <button
        onClick={handleRecenterMap}
        className="absolute bottom-4 left-4 z-[999] px-3.5 py-2 bg-white/95 dark:bg-slate-900/95 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 shadow-md backdrop-blur-md flex items-center gap-1.5 transition-all cursor-pointer"
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
function GisStatCards({ nodes = [] }) {
  const safeNodes = Array.isArray(nodes) ? nodes : (nodes && typeof nodes === 'object' ? Object.values(nodes) : []);
  const pops = safeNodes.filter(n => n?.node_type === 'POP');
  const odcs = safeNodes.filter(n => n?.node_type === 'ODC');
  const odps = safeNodes.filter(n => n?.node_type === 'ODP');

  const activeOdps = odps.filter(n => n?.used_ports > 0 && n?.optical_power_dbm != null);
  const odpOptValues = activeOdps.map(n => parseFloat(n.optical_power_dbm));
  const avgOdpDbm = odpOptValues.length > 0 ? (odpOptValues.reduce((a, b) => a + b, 0) / odpOptValues.length).toFixed(2) : '—';

  // Count optical loss faults (active loss or damaged)
  const lossNodes = safeNodes.filter(n => {
    if (!n) return false;
    const eff = getNodeEffectiveStatus(n);
    return eff.isLoss;
  });

  const inactiveNodes = safeNodes.filter(n => n?.status === 'inactive');

  const cards = [
    { label: 'POP Central', value: pops.length, sub: `${pops.filter(n => n.status === 'active').length} Aktif Normal`, badge: 'Core Headend', badgeCls: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800' },
    { label: 'ODC Cabinet', value: odcs.length, sub: `${odcs.filter(n => n.status === 'active').length} Aktif Normal`, badge: 'Distribution', badgeCls: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800' },
    { label: 'ODP Point', value: odps.length, sub: `${odps.filter(n => n.status === 'active').length} Total Point ODP`, badge: 'Access Terminal', badgeCls: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' },
    { 
      label: 'Gangguan Loss Optik', 
      value: lossNodes.length, 
      sub: inactiveNodes.length > 0 ? `${lossNodes.length} Loss • ${inactiveNodes.length} Tidak Aktif` : (lossNodes.length > 0 ? 'Perlu Investigasi Lapangan' : 'Seluruh Jalur Sehat'), 
      badge: lossNodes.length > 0 ? '🚨 Gangguan' : (inactiveNodes.length > 0 ? `${inactiveNodes.length} Nonaktif` : 'Aman Normal'), 
      badgeCls: lossNodes.length > 0 
        ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800' 
        : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 stagger-enter">
      {cards.map((c, i) => (
        <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs p-4 transition-colors duration-300">
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
export default function GisTopologyMap({ isStandaloneFullscreen = false }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isFullscreenPage = isStandaloneFullscreen || location.pathname.includes('/fullscreen');
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

  // KML / KMZ Import Modal State
  const [kmlImportModal, setKmlImportModal] = useState(false);

  // Esc key listener to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreenPage) {
        navigate('/gis-map');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreenPage, navigate]);

  const fetchNodesAndCables = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/gis/map-data').then(r => r.json());
      if (res?.data) {
        const rawNodes = res.data.nodes;
        const rawCables = res.data.cables;
        const parsedNodes = Array.isArray(rawNodes)
          ? rawNodes
          : (rawNodes && typeof rawNodes === 'object' ? Object.values(rawNodes) : []);
        const parsedCables = Array.isArray(rawCables)
          ? rawCables
          : (rawCables && typeof rawCables === 'object' ? Object.values(rawCables) : []);

        setAllNodes(parsedNodes);
        setAllCables(parsedCables);
      }
    } catch (err) {
      console.warn('Failed to load GIS map data:', err);
      if (!silent) {
        setAllNodes([]);
        setAllCables([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const safeAllNodes = useMemo(() => Array.isArray(allNodes) ? allNodes : (allNodes && typeof allNodes === 'object' ? Object.values(allNodes) : []), [allNodes]);
  const safeAllCables = useMemo(() => Array.isArray(allCables) ? allCables : (allCables && typeof allCables === 'object' ? Object.values(allCables) : []), [allCables]);

  useEffect(() => {
    fetchNodesAndCables();
  }, [fetchNodesAndCables]);

  // Live polling telemetry: silent fetch setiap 25 detik (hemat resource server & camera persisten)
  useEffect(() => {
    if (!livePolling) return;
    const timer = setInterval(() => {
      if (document.hidden) return;
      fetchNodesAndCables(true);
    }, 25000);

    return () => clearInterval(timer);
  }, [livePolling, fetchNodesAndCables]);

  // Update selectedNode live values smoothly
  useEffect(() => {
    if (selectedNode) {
      const updated = safeAllNodes.find(n => n?.id === selectedNode.id);
      if (updated && updated.optical_power_dbm !== selectedNode.optical_power_dbm) {
        setSelectedNode(updated);
      }
    }
  }, [safeAllNodes, selectedNode]);

  // Compute End-to-End Traced Path Hierarchy for Selected Node
  const tracedPath = useMemo(() => {
    if (!selectedNode) return { nodeIds: new Set(), pathNodes: [] };
    const nodeMap = new Map(safeAllNodes.map(n => [n.id, n]));
    const path = [];
    let curr = selectedNode;
    const visited = new Set();

    while (curr && !visited.has(curr.id)) {
      visited.add(curr.id);
      path.unshift(curr);
      if (curr.parent_node_id && nodeMap.has(curr.parent_node_id)) {
        curr = nodeMap.get(curr.parent_node_id);
      } else if (curr.node_type === 'ODP') {
        const potentialOdc = safeAllNodes.find(n => n?.node_type === 'ODC' && n?.olt_device_id === curr.olt_device_id);
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
  }, [selectedNode, safeAllNodes]);

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

  // Filtered Nodes
  const filteredNodes = useMemo(() => {
    return safeAllNodes.filter(n => {
      if (!n || !['POP', 'ODC', 'ODP'].includes(n.node_type)) return false;
      if (oltFilterParam) {
        if (String(n.olt_device_id) !== String(oltFilterParam) && String(n.parent_node?.olt_device_id) !== String(oltFilterParam)) {
          return false;
        }
      }
      if (typeFilter && n.node_type !== typeFilter) return false;
      if (statusFilter) {
        const eff = getNodeEffectiveStatus(n);
        if (statusFilter === 'active_loss') {
          if (eff.key !== 'active_loss' && eff.key !== 'damaged') return false;
        } else if (statusFilter === 'active') {
          if (eff.key !== 'active') return false;
        } else if (statusFilter === 'inactive') {
          if (n.status !== 'inactive') return false;
        } else if (n.status !== statusFilter) {
          return false;
        }
      }
      if (faultOnlyFilter) {
        const eff = getNodeEffectiveStatus(n);
        if (!eff.isLoss) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match = n.name?.toLowerCase().includes(q) || n.code?.toLowerCase().includes(q) || n.address?.toLowerCase().includes(q) || n.olt_port_ref?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    }).sort(naturalNodeCompare);
  }, [safeAllNodes, oltFilterParam, typeFilter, statusFilter, faultOnlyFilter, searchQuery]);

  const nodesWithCoords = useMemo(() => {
    return filteredNodes.filter(n => n.latitude && n.longitude && parseFloat(n.latitude) !== 0);
  }, [filteredNodes]);

  // Search Auto-Suggestions
  const searchSuggestions = useMemo(() => {
    if (!searchQuery || searchQuery.trim().length === 0) return [];
    const q = searchQuery.toLowerCase();
    return safeAllNodes.filter(n => {
      return n?.name?.toLowerCase().includes(q) || n?.code?.toLowerCase().includes(q) || n?.address?.toLowerCase().includes(q) || n?.olt_port_ref?.toLowerCase().includes(q);
    }).slice(0, 6);
  }, [safeAllNodes, searchQuery]);

  const handleSelectSuggestion = (node) => {
    setSelectedNode(node);
    setSearchQuery(node.name);
    setIsSearchFocused(false);
    if (node.latitude && node.longitude && externalFlyToRef.current) {
      externalFlyToRef.current(parseFloat(node.latitude), parseFloat(node.longitude), 17);
    }
  };

  // Dedicated Clean Fullscreen View (No sidebar, no layout overlap, pure 100vw x 100vh)
  if (isFullscreenPage) {
    return (
      <div className="fixed inset-0 w-screen h-screen z-[99999] bg-slate-950 flex flex-col overflow-hidden select-none font-sans">
        {/* Top Control Bar for Fullscreen */}
        <div className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5 text-white z-[1000] shrink-0 shadow-lg">
          <div className="flex items-center gap-2.5">
            {/* Back to Standard GIS Map */}
            <button
              type="button"
              onClick={() => navigate('/gis-map')}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs font-black shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              title="Kembali ke tampilan standar UNMS (Esc)"
            >
              <span className="text-sm">↩️</span>
              <span>Kembali</span>
              <span className="text-[10px] opacity-75 font-mono px-1.5 py-0.5 rounded bg-black/40">ESC</span>
            </button>

            <div className="hidden sm:flex items-center gap-2 border-l border-slate-700 pl-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-extrabold text-xs text-slate-200 tracking-tight">🗺️ GIS Peta Spasial (Layar Penuh)</span>
            </div>
          </div>

          {/* Action Tools: Cek Koordinat & Ukur Jarak */}
          <div className="flex items-center gap-2">
            {/* Target Coordinate Button */}
            <button
              type="button"
              onClick={() => setTargetCoordModal(true)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                targetPin
                  ? 'bg-fuchsia-600 text-white border-fuchsia-500 shadow-md ring-2 ring-fuchsia-400/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
              title="Cek titik koordinat rumah client di peta"
            >
              <span>📍 {targetPin ? 'Patokan Rumah Aktif' : 'Cek Koordinat'}</span>
            </button>

            {/* Ruler Tool Button */}
            <button
              type="button"
              onClick={() => {
                const next = !rulerActive;
                setRulerActive(next);
                if (!next) setRulerPoints([]);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                rulerActive
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md ring-2 ring-amber-400/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
              title="Ukur total jarak bentangan kabel FO"
            >
              <span>📏 {rulerActive ? 'Tutup Penggaris' : 'Ukur Jarak FO'}</span>
            </button>

            {/* Fault Filter Button */}
            <button
              type="button"
              onClick={() => setFaultOnlyFilter(!faultOnlyFilter)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                faultOnlyFilter
                  ? 'bg-rose-600 text-white border-rose-500 shadow-md ring-2 ring-rose-400/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              <span>🚨 {faultOnlyFilter ? 'Filter: Gangguan' : 'Hanya Gangguan'}</span>
            </button>

            {/* Import KML / KMZ Button */}
            <button
              onClick={() => setKmlImportModal(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer bg-blue-600/90 hover:bg-blue-600 text-white border-blue-500 shadow-sm"
              title="Import Data Jaringan Google Earth (.kml / .kmz)"
            >
              <span>📥 Import KML</span>
            </button>
          </div>

          {/* Search & Type Filter */}
          <div className="flex items-center gap-2">
            {/* Smart Search */}
            <div className="relative w-44 sm:w-60">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                placeholder="Cari ODP, ODC, POP..."
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              )}
              {isSearchFocused && searchSuggestions.length > 0 && (
                <div className="absolute top-full right-0 mt-1.5 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[1000] overflow-hidden">
                  {searchSuggestions.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectSuggestion(s)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-800 flex items-center justify-between border-b border-slate-800 last:border-0 cursor-pointer text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-bold px-1.5 rounded bg-slate-800 text-blue-400 border border-blue-500/40">{s.node_type}</span>
                          <span className="font-bold text-slate-200">{s.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 block">{s.code}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Filter Node Type */}
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="">Semua Tipe</option>
              <option value="POP">POP</option>
              <option value="ODC">ODC</option>
              <option value="ODP">ODP</option>
            </select>
          </div>
        </div>

        {/* Fullscreen Map Canvas */}
        <div className="flex-1 w-full relative overflow-hidden">
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
              onFlyToTarget={() => {
                if (externalFlyToRef.current) {
                  externalFlyToRef.current(targetPin.lat, targetPin.lng, 17);
                }
              }}
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
          {loading && safeAllNodes.length === 0 ? (
            <div className="flex items-center justify-center h-full w-full bg-slate-950 text-slate-400">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs font-semibold">Memuat peta spasial GIS...</span>
              </div>
            </div>
          ) : (
            <LeafletMap
              nodes={nodesWithCoords}
              cables={safeAllCables}
              selectedNode={selectedNode}
              tracedPath={tracedPath}
              rulerActive={rulerActive}
              rulerPoints={rulerPoints}
              setRulerPoints={setRulerPoints}
              targetPin={targetPin}
              isFullscreen={true}
              onToggleFullscreen={() => navigate('/gis-map')}
              onSelectNode={node => setSelectedNode(node)}
              onOpenStreetView={(lat, lng, title) => setStreetViewTarget({ lat, lng, title })}
              externalFlyToRef={externalFlyToRef}
            />
          )}
        </div>

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

        {/* KML / KMZ Import Modal in Fullscreen */}
        <KmlImportModal
          isOpen={kmlImportModal}
          onClose={() => setKmlImportModal(false)}
          onSuccess={() => fetchNodesAndCables(true)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors duration-300">
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
          {/* Import KML / KMZ Button */}
          <button
            onClick={() => setKmlImportModal(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 shadow-2xs"
            title="Import Data Jaringan dari Google Earth (.kml / .kmz)"
          >
            <span>📥 Import KML / KMZ</span>
          </button>

          {/* Target Location / Check Coordinates Button */}
          <button
            onClick={() => setTargetCoordModal(true)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
              targetPin
                ? 'bg-fuchsia-600 text-white border-fuchsia-600 shadow-md ring-2 ring-fuchsia-400/40'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
            title="Cek lokasi rumah pelanggan dari koordinat GPS"
          >
            <span>📍 {targetPin ? 'Patokan Rumah Aktif' : 'Cek Koordinat Rumah'}</span>
          </button>

          {/* Dedicated Fullscreen Page Button */}
          <button
            onClick={() => navigate('/gis-map/fullscreen')}
            className="px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs"
            title="Buka Peta GIS di Halaman Khusus Layar Penuh (100% Layar Bersih)"
          >
            <span>⛶ Buka Layar Penuh</span>
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
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <span>📏 {rulerActive ? 'Tutup Penggaris' : 'Ukur Jarak FO'}</span>
          </button>

          <button
            onClick={() => setActiveView('map')}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${activeView === 'map'
              ? 'bg-blue-600 text-white border-blue-600 shadow-md'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
          >
            Peta GIS Interaktif
          </button>
          <button
            onClick={() => setActiveView('list')}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${activeView === 'list'
              ? 'bg-blue-600 text-white border-blue-600 shadow-md'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
          >
            Tabel Telemetry Redaman
          </button>
        </div>
      </div>

      <GisStatCards nodes={safeAllNodes} />

      {/* Main Controls Filter Bar with Smart Search & Fault Filter */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-2xs transition-colors duration-300 flex flex-col md:flex-row md:items-center justify-between gap-4">
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
              className="px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
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
              <div className="absolute top-full left-0 mt-1.5 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-[1000] overflow-hidden">
                {searchSuggestions.map(s => {
                  const tm = TYPE_META[s.node_type] ?? TYPE_META.ODC;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectSuggestion(s)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 last:border-0 cursor-pointer"
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
            className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">Semua Tipe Node</option>
            <option value="POP">POP Central</option>
            <option value="ODC">ODC Cabinet</option>
            <option value="ODP">ODP Point</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">Semua Status Node</option>
            <option value="active">🟢 Aktif Normal</option>
            <option value="active_loss">🔴 Aktif (Gangguan Loss)</option>
            <option value="damaged">🚨 Rusak / Loss Putus</option>
            <option value="inactive">⚪ Tidak Aktif (Nonaktif)</option>
            <option value="maintenance">🟡 Maintenance</option>
          </select>

          {/* Quick Filter: Hanya Gangguan Loss */}
          <button
            type="button"
            onClick={() => setFaultOnlyFilter(!faultOnlyFilter)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
              faultOnlyFilter
                ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-400/40'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:bg-rose-100'
            }`}
          >
            <span>🚨 Hanya Gangguan Loss</span>
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setLivePolling(!livePolling)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${livePolling
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
              }`}
          >
            <span className={`w-2 h-2 rounded-full ${livePolling ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            <span>{livePolling ? 'Telemetry Live' : 'Telemetry Paused'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400 dark:text-slate-500 text-xs animate-pulse">
          Memuat topologi spasial GIS &amp; data redaman...
        </div>
      ) : activeView === 'map' ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden relative transition-colors duration-300 min-h-[640px]">
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
              onFlyToTarget={() => {
                if (externalFlyToRef.current) {
                  externalFlyToRef.current(targetPin.lat, targetPin.lng, 17);
                }
              }}
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
            cables={safeAllCables}
            selectedNode={selectedNode}
            tracedPath={tracedPath}
            rulerActive={rulerActive}
            rulerPoints={rulerPoints}
            setRulerPoints={setRulerPoints}
            targetPin={targetPin}
            isFullscreen={false}
            onToggleFullscreen={() => navigate('/gis-map/fullscreen')}
            onSelectNode={node => setSelectedNode(node)}
            onOpenStreetView={(lat, lng, title) => setStreetViewTarget({ lat, lng, title })}
            externalFlyToRef={externalFlyToRef}
          />
        </div>
      ) : (
        /* Tabel Telemetry Redaman */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden transition-colors duration-300">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-5 py-3.5">Node &amp; Kode</th>
                  <th className="px-4 py-3.5">Tipe</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Port Terpakai</th>
                  <th className="px-4 py-3.5">Kualitas Redaman (Rx)</th>
                  <th className="px-4 py-3.5">Koordinat GPS</th>
                  <th className="px-4 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredNodes.map(node => {
                  const typeMeta = TYPE_META[node.node_type] ?? TYPE_META.ODC;
                  const effStatus = getNodeEffectiveStatus(node);
                  const effectivePower = node.best_rx_power ?? node.optical_power_dbm;
                  const isLoss = effStatus.isLoss;
                  const optMeta = isLoss 
                    ? { label: 'Loss / Kritis', color: '#ef4444', badge: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800' }
                    : getOpticalQuality(effectivePower);

                  return (
                    <tr key={node.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors">
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
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${effStatus.badge}`}>
                          {effStatus.label}
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

      {/* KML / KMZ Intelligent Importer Modal */}
      <KmlImportModal
        isOpen={kmlImportModal}
        onClose={() => setKmlImportModal(false)}
        onSuccess={() => fetchNodesAndCables(true)}
      />
    </div>
  );
}
