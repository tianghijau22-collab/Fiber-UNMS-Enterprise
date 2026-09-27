import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { decimalToDms, parseCoordsInput } from '../utils/coordinateParser.js';
import { naturalNodeCompare } from '../utils/naturalSort.js';
import { useAuth } from '../components/AuthContext';
import KmlImportModal from '../components/KmlImportModal.jsx';
import LoadingState from '../components/LoadingState.jsx';

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
  if (!node) return { key: 'active', label: 'Aktif Normal', badge: STATUS_META.active.badge, color: '#059669', pinBg: '#059669', isLoss: false, isTotalLoss: false, isInactive: false, hasRadar: false, hasNoClients: false };

  // 1. Status TIDAK AKTIF (Offline / Nonaktif) - Warna Abu-abu Netral
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
      isTotalLoss: false,
      isInactive: true,
      hasRadar: false,
      hasNoClients: false,
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
      isTotalLoss: false,
      isInactive: false,
      hasRadar: false,
      hasNoClients: false,
    };
  }

  const isOdp = node.node_type === 'ODP';
  const rangeStr = (node.rx_power_range || '').trim();
  const lowerRange = rangeStr.toLowerCase();

  // 3. Deteksi BELUM ADA PELANGGAN (ODP Baru / Belum ada klien terhubung)
  const totalClients = node.total_clients != null ? parseInt(node.total_clients, 10) : (node.used_ports != null ? parseInt(node.used_ports, 10) : null);
  const hasNoClients = isOdp && (
    node.total_clients === 0 ||
    lowerRange.includes('belum ada pelanggan') ||
    (totalClients === 0 && (!rangeStr || lowerRange.includes('belum')))
  );

  if (hasNoClients) {
    return {
      key: 'no_clients',
      label: 'Belum Ada Pelanggan',
      badge: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
      color: '#059669', // Identitas ODP tetap Emerald
      pinBg: '#059669',
      nameBorder: '#cbd5e1',
      nameText: '#475569',
      isLoss: false,
      isTotalLoss: false,
      isInactive: false,
      hasRadar: false,
      hasNoClients: true,
    };
  }

  // 4. Deteksi LOSS TOTAL (Seluruh Pelanggan pada ODP Loss)
  const effectivePower = node.best_rx_power ?? node.optical_power_dbm;
  const hasGenuineSignal = effectivePower != null && !isNaN(parseFloat(effectivePower)) && parseFloat(effectivePower) > -35.0;
  const isLossKeyword = lowerRange.includes('loss') || lowerRange.includes('los') || lowerRange.includes('rusak');
  const isPartialLoss = lowerRange.includes('ada los') || lowerRange.includes('sebagian');

  const isTotalLoss = isOdp && !hasNoClients && (
    node.is_loss_total === true ||
    (node.total_clients > 0 && node.online_clients === 0) ||
    node.status === 'damaged' ||
    (isLossKeyword && !isPartialLoss && !hasGenuineSignal)
  );

  // Status LOSS TOTAL (Merah Menyala dengan Radar Ping)
  if (isTotalLoss) {
    return {
      key: node.status === 'active' ? 'active_loss' : 'damaged',
      label: 'Loss Total (Semua Klien)',
      badge: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse font-bold',
      color: '#ef4444',
      pinBg: '#ef4444',
      nameBorder: '#f87171',
      nameText: '#991b1b',
      isLoss: true,
      isTotalLoss: true,
      hasRadar: true,
      isInactive: false,
      hasNoClients: false,
    };
  }

  // 5. Status AKTIF NORMAL / SEBAGIAN LOS
  let pinColor = '#059669'; // Emerald
  if (node.node_type === 'POP') pinColor = '#4f46e5'; // Indigo
  else if (node.node_type === 'ODC') pinColor = '#2563eb'; // Royal Blue

  return {
    key: 'active',
    label: isPartialLoss ? 'Aktif (Ada Klien LOS)' : 'Aktif Normal',
    badge: isPartialLoss
      ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
      : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
    color: pinColor,
    pinBg: pinColor,
    nameBorder: '#cbd5e1',
    nameText: '#0f172a',
    isLoss: isPartialLoss,
    isTotalLoss: false,
    isInactive: false,
    hasRadar: false,
    hasNoClients: false,
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

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] overflow-y-auto bg-black/60 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-white dark:bg-black rounded-lg sm:rounded-xl shadow-2xl border border-black/70 dark:border-white/70 my-auto max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150 text-black dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white dark:bg-black text-black dark:text-white px-5 py-4 flex items-center justify-between shrink-0 border-b border-black/20 dark:border-white/20">
          <div>
            <h3 className="text-sm sm:text-base font-bold flex items-center gap-2">
              <span>Google Street View 360°</span>
            </h3>
            <p className="text-[11px] text-black/70 dark:text-white/70 font-mono mt-0.5">{title || `Koordinat: ${lat}, ${lng}`}</p>
          </div>
          <div className="flex items-center space-x-2">
            <a
              href={directUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-md transition-colors shadow-sm"
            >
              Buka di Tab Baru ↗
            </a>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white font-bold cursor-pointer transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-[440px] bg-black relative">
          <iframe
            title="Street View 360"
            src={embedUrl}
            className="w-full h-full min-h-[440px] border-0"
            allowFullScreen
            loading="lazy"
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ══════════════════════════════════════════════════════════════════
   NODE DETAIL DRAWER / POPUP MODAL
══════════════════════════════════════════════════════════════════ */
function NodeDetailPanel({ node, onClose, onOpenStreetView, onTracePath, isFullscreen = false }) {
  if (!node) return null;

  const typeMeta = TYPE_META[node.node_type] ?? TYPE_META.ODC;
  const effStatus = getNodeEffectiveStatus(node);
  const effectivePower = node.best_rx_power ?? node.optical_power_dbm;
  const isLoss = effStatus.isTotalLoss;
  const optMeta = isLoss 
    ? { label: 'Loss Total (Kritis)', color: '#ef4444', badge: 'text-rose-600 dark:text-rose-400 font-bold' }
    : (effStatus.hasNoClients
        ? { label: 'Belum Ada Pelanggan', color: '#64748b', badge: 'text-black/60 dark:text-white/60 font-bold' }
        : getOpticalQuality(effectivePower));
  const p = node.total_ports > 0 ? Math.round(((node.total_clients ?? node.used_ports) / node.total_ports) * 100) : 0;

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
    <div className={`fixed sm:absolute bottom-0 sm:bottom-auto ${isFullscreen ? 'sm:top-16' : 'sm:top-4'} left-0 sm:left-4 right-0 sm:right-auto z-[1200] w-full sm:w-96 bg-white/95 dark:bg-black/95 backdrop-blur-md rounded-t-2xl sm:rounded-lg shadow-2xl border-t sm:border border-black/70 dark:border-white/70 p-4 sm:p-5 transition-all text-black dark:text-white max-h-[75vh] sm:max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom sm:slide-in-from-left duration-200`}>
      <div className="sm:hidden w-12 h-1.5 rounded-full bg-black/20 dark:bg-white/30 mx-auto mb-3" />
      <div className="flex items-start justify-between pb-3 border-b border-black/20 dark:border-white/20">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 text-black dark:text-white border border-black/20 dark:border-white/20">
              {node.node_type}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-black/5 dark:bg-white/5 border border-black/20 dark:border-white/20" style={{ color: effStatus.color }}>
              {effStatus.label}
            </span>
          </div>
          <h4 className="text-base font-bold text-black dark:text-white leading-tight">
            {node.name}
          </h4>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white font-bold transition-colors cursor-pointer"
        >
          ✕
        </button>
      </div>

      <div className="mt-4 space-y-3.5 text-xs">
        {/* Optical Telemetry Signal Box */}
        {node.node_type === 'ODP' && (
          <div className="p-3.5 bg-black/5 dark:bg-white/5 rounded-lg border border-black/20 dark:border-white/20 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-black/70 dark:text-white/70">Telemetry Redaman Rx</span>
              <span className="text-[10px] font-bold" style={{ color: optMeta.color }}>
                {optMeta.label}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-bold font-mono" style={{ color: optMeta.color }}>
                {effStatus.hasNoClients ? 'Belum Ada Pelanggan' : (node.rx_power_range ? node.rx_power_range : (effectivePower != null ? `${parseFloat(effectivePower).toFixed(2)} dBm` : '—'))}
              </span>
              <span className="text-[10px] font-mono text-black/60 dark:text-white/60">
                {effStatus.hasNoClients ? '0 Klien Terhubung' : `${node.total_clients ?? node.used_ports} Klien Terhubung`}
              </span>
            </div>
          </div>
        )}

        {/* GPS Coordinates & Google Earth / Maps Navigation */}
        <div className="space-y-2">
          <span className="text-[10px] text-black/70 dark:text-white/70 font-bold uppercase tracking-wider block">
            Posisi Geografis GPS
          </span>
          {node.latitude && node.longitude ? (
            <div className="p-3 bg-black/5 dark:bg-white/5 rounded-lg border border-black/20 dark:border-white/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-black dark:text-white">
                  Koordinat Desimal:
                </span>
                <button
                  onClick={handleCopyCoords}
                  className="px-2.5 py-0.5 text-[10px] font-bold bg-white dark:bg-black border border-black/20 dark:border-white/20 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-black dark:text-white cursor-pointer"
                >
                  {copied ? 'Tersalin!' : 'Salin'}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-1.5 font-mono text-xs">
                <div className="flex items-center justify-between text-black dark:text-white">
                  <span className="text-[10px] font-sans font-semibold text-black/60 dark:text-white/60">Google Maps:</span>
                  <span className="font-bold">{parseFloat(node.latitude).toFixed(6)}, {parseFloat(node.longitude).toFixed(6)}</span>
                </div>
                <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400">
                  <span className="text-[10px] font-sans font-semibold text-black/60 dark:text-white/60">Google Earth:</span>
                  <span className="font-bold">{dmsInfo.formattedDms || '—'}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-black/10 dark:border-white/10">
                <button
                  onClick={() => onOpenStreetView(node.latitude, node.longitude, node.name)}
                  className="py-2 px-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold rounded-md flex items-center justify-center gap-1 transition-colors text-center col-span-3 sm:col-span-1 cursor-pointer"
                >
                  <span>Street View</span>
                </button>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${node.latitude},${node.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold rounded-md flex items-center justify-center gap-1 transition-colors text-center"
                >
                  <span>Maps</span>
                </a>
                <a
                  href={`https://earth.google.com/web/search/${node.latitude},${node.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-2 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 text-[11px] font-bold rounded-md flex items-center justify-center gap-1 transition-colors text-center"
                >
                  <span>Earth</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300">
              Belum ada koordinat GPS terdaftar.
            </div>
          )}
        </div>

        <div className="space-y-3">
          {node.total_ports > 0 && (
            <div className="p-3 bg-black/5 dark:bg-white/5 rounded-lg border border-black/20 dark:border-white/20">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] text-black/70 dark:text-white/70 font-bold uppercase tracking-wider">Kapasitas Port</span>
                <span className="font-bold text-black dark:text-white font-mono">{node.used_ports}/{node.total_ports} Port ({p}%)</span>
              </div>
              <div className="w-full bg-black/10 dark:bg-white/10 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${p > 90 ? 'bg-rose-600' : p > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${p}%` }}
                />
              </div>
            </div>
          )}

          <div className="p-3 bg-black/5 dark:bg-white/5 rounded-lg border border-black/20 dark:border-white/20 text-black dark:text-white">
            <span className="text-[10px] text-black/70 dark:text-white/70 font-bold uppercase block mb-1">OLT &amp; Port Uplink</span>
            <p className="font-bold text-black dark:text-white">{node.olt_device?.name || node.parent_node?.olt_device?.name || 'OLT Region'}</p>
            <p className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-bold">{node.olt_port_ref || 'PON 1/1/1'}</p>
          </div>
        </div>
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
    <div className="bg-black/90 text-white backdrop-blur-md border border-amber-500/50 shadow-2xl rounded-full px-3.5 py-1.5 sm:py-2 flex items-center justify-between gap-3 text-xs animate-in fade-in zoom-in-95 duration-150">
      {/* Distance & Waypoints Info */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21.3 15.3l-6.6 6.6c-.4.4-1 .4-1.4 0l-12-12c-.4-.4-.4-1 0-1.4l6.6-6.6c.4-.4 1-.4 1.4 0l12 12c.4.4.4 1 0 1.4z" />
          </svg>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-emerald-400 font-mono font-bold text-xs sm:text-sm tracking-tight truncate">
            {displayDist}
          </span>
          <span className="text-[10px] text-amber-300 font-mono px-1.5 py-0.2 rounded-full bg-amber-500/15 border border-amber-500/30 shrink-0">
            {waypoints.length} titik
          </span>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-1 shrink-0 pl-1 border-l border-white/15">
        <button
          type="button"
          onClick={onUndo}
          disabled={waypoints.length === 0}
          className="px-2 py-1 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded-full text-[10px] font-bold text-white transition-all cursor-pointer flex items-center gap-1"
          title="Hapus titik terakhir (Undo)"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M3 10h10a5 5 0 0 1 5 5v2M3 10l6-6M3 10l6 6" />
          </svg>
          <span className="hidden sm:inline">Undo</span>
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={waypoints.length === 0}
          className="px-2 py-1 bg-rose-500/20 hover:bg-rose-500/30 disabled:opacity-30 disabled:cursor-not-allowed text-rose-300 border border-rose-500/30 rounded-full text-[10px] font-bold transition-all cursor-pointer"
          title="Reset pengukuran"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-6 h-6 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center text-xs font-bold transition-all cursor-pointer ml-0.5"
          title="Selesai ukur jarak"
        >
          ✕
        </button>
      </div>
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
  onClearTarget,
  isFullscreen,
  isSatellite = true,
  onToggleFullscreen,
  onSelectNode,
  onOpenStreetView,
  externalFlyToRef,
  externalRecenterRef,
}) {
  const safeNodes = useMemo(() => Array.isArray(nodes) ? nodes : (nodes && typeof nodes === 'object' ? Object.values(nodes) : []), [nodes]);
  const safeCables = useMemo(() => Array.isArray(cables) ? cables : (cables && typeof cables === 'object' ? Object.values(cables) : []), [cables]);
  const safeRulerPoints = useMemo(() => Array.isArray(rulerPoints) ? rulerPoints : [], [rulerPoints]);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const leafletRef = useRef(null);
  const canvasRendererRef = useRef(null);
  const tileLayerRef = useRef(null);
  const cablesLayerGroupRef = useRef(null);
  const nodesLayerGroupRef = useRef(null);
  const pathHighlightLayerGroupRef = useRef(null);
  const rulerLayerGroupRef = useRef(null);
  const targetPinLayerGroupRef = useRef(null);
  const isFirstRenderRef = useRef(true);
  const rulerActiveRef = useRef(rulerActive);
  const markersMapRef = useRef(new Map());
  const [mapLoaded, setMapLoaded] = useState(false);

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

  // 1. Initialize Map Instance with Canvas Hardware Acceleration
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
          zoom: 14,
          zoomControl: false,
          scrollWheelZoom: true,
          preferCanvas: true,
          bounceAtZoomLimits: false,
          inertia: true,
          inertiaDeceleration: 3000,
          fadeAnimation: true,
          markerZoomAnimation: true,
        });

        // Initialize dedicated Canvas Renderer with generous padding for 60 FPS mobile panning
        canvasRendererRef.current = Lf.canvas({ padding: 0.75, tolerance: 10 });

        // Zoom control at bottom right (only in standard mode; fullscreen uses touch pinch & Earth FAB stack)
        if (!isFullscreen) {
          Lf.control.zoom({ position: 'bottomright' }).addTo(map);
        }

        const satUrl = isSatellite
          ? 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        tileLayerRef.current = Lf.tileLayer(satUrl, {
          maxZoom: isSatellite ? 20 : 19,
          subdomains: isSatellite ? ['0', '1', '2', '3'] : ['a', 'b', 'c'],
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
        canvasRendererRef.current = null;
        markersMapRef.current.clear();
      }
    };
  }, []);

  // 2. Synchronize Satelit Hybrid vs Vektor tile layer
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !leafletRef.current) return;
    const Lf = leafletRef.current;
    const map = mapInstanceRef.current;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    if (isSatellite) {
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
  }, [isSatellite, mapLoaded]);

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

  useEffect(() => {
    if (externalRecenterRef) {
      externalRecenterRef.current = handleRecenterMap;
    }
  }, [externalRecenterRef, handleRecenterMap]);

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

  // 5b. Render Target Location Pin & Guide Line
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
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; user-select: none;">
          <!-- Ground Radar Ping -->
          <div style="
            position: absolute;
            top: 30px;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 26px;
            height: 26px;
            border-radius: 50%;
            border: 2px solid #ef4444;
            animation: targetPing 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
            pointer-events: none;
          "></div>

          <!-- Crisp Modern Location Drop Pin (Red & Compact) -->
          <div style="
            position: relative;
            filter: drop-shadow(0 3px 6px rgba(0,0,0,0.5));
            transition: transform 0.15s ease;
          ">
            <svg width="24" height="30" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 0C5.37258 0 0 5.37258 0 12C0 20.25 10.8 29.1 11.28 29.5C11.68 29.83 12.32 29.83 12.72 29.5C13.2 29.1 24 20.25 24 12C24 5.37258 18.6274 0 12 0Z" fill="#dc2626"/>
              <path d="M12 2C6.47715 2 2 6.47715 2 12C2 19 11 26.5 12 27.3C13 26.5 22 19 22 12C22 6.47715 17.5228 2 12 2Z" fill="#ef4444"/>
              <circle cx="12" cy="11" r="4.5" fill="#ffffff"/>
              <circle cx="12" cy="11" r="2.2" fill="#991b1b"/>
            </svg>
          </div>

          <!-- Label Chip -->
          <div style="
            background: #09090b;
            color: #ffffff;
            padding: 1.5px 6px;
            border-radius: 4px;
            font-size: 9.5px;
            font-weight: 800;
            white-space: nowrap;
            margin-top: 1px;
            border: 1px solid #ef4444;
            box-shadow: 0 2px 5px rgba(0,0,0,0.5);
            font-family: sans-serif;
          ">
            ${targetPin.label || 'Titik Lokasi'}
          </div>
        </div>
      `,
      iconSize: [120, 56],
      iconAnchor: [60, 30],
    });

    const marker = Lf.marker([lat, lng], { icon }).addTo(layer);

    marker.bindPopup(`
      <div style="padding: 6px 4px; font-family: sans-serif; text-align: center; min-width: 185px;">
        <div style="font-weight: 800; font-size: 12px; color: #dc2626; margin-bottom: 2px;">📍 Patokan Titik Lokasi</div>
        <div style="font-size: 11px; font-family: monospace; color: #475569; margin-bottom: 8px;">${lat.toFixed(6)}, ${lng.toFixed(6)}</div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <button id="btn-popup-streetview-target" style="
            background: linear-gradient(135deg, #0284c7, #2563eb);
            color: #ffffff;
            border: none;
            padding: 7px 12px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: bold;
            cursor: pointer;
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
          ">
            <span>🌐 Buka Street View 360°</span>
          </button>
          <button id="btn-popup-clear-target" style="
            background: #e11d48;
            color: #ffffff;
            border: none;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: bold;
            cursor: pointer;
            width: 100%;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
          ">✕ Hapus Titik Lokasi</button>
        </div>
      </div>
    `);

    marker.on('popupopen', () => {
      const btnSv = document.getElementById('btn-popup-streetview-target');
      if (btnSv) {
        btnSv.onclick = () => {
          if (onOpenStreetView) {
            onOpenStreetView(lat, lng, targetPin.label || 'Titik Lokasi');
          }
        };
      }
      const btn = document.getElementById('btn-popup-clear-target');
      if (btn) {
        btn.onclick = () => {
          if (onClearTarget) onClearTarget();
        };
      }
    });

    // If ruler is active, clicking target pin adds it as a waypoint
    marker.on('click', (e) => {
      if (rulerActiveRef.current) {
        if (e.originalEvent) e.originalEvent.stopPropagation();
        if (Lf.DomEvent) Lf.DomEvent.stopPropagation(e);
        setRulerPoints(pts => [...pts, [lat, lng]]);
      }
    });
  }, [targetPin, onClearTarget, onOpenStreetView, setRulerPoints]);

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
          renderer: canvasRendererRef.current || undefined,
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
              ${cable.name}
            </div>
            <div><strong>Panjang:</strong> ${lenText}</div>
            <div><strong>Kapasitas:</strong> ${cable.core_count_total || 6} Core</div>
            ${cable.notes ? `<div style="margin-top: 4px; color: #64748b; font-size: 10px; border-top: 1px solid #e2e8f0; padding-top: 4px; max-height: 80px; overflow-y: auto;">${cable.notes}</div>` : ''}
          </div>
        `);
      }
    });
  }, [mapLoaded, safeCables]);

  // Helper to format concise optical text: redaman terkecil - redaman terbesar atau label status
  const formatCompactOptical = (node, effStatus) => {
    if (effStatus.hasNoClients) return 'Belum ada pelanggan';
    if (effStatus.isTotalLoss) return 'Loss Total';
    if (effStatus.isInactive) return 'Nonaktif';
    if (effStatus.key === 'maintenance') return 'Maint';

    if (node.rx_power_range) {
      const lower = node.rx_power_range.toLowerCase();
      if (lower.includes('belum ada pelanggan')) {
        return 'Belum ada pelanggan';
      }
      if (lower.includes('loss total') || lower === 'los' || (lower.includes('loss') && !lower.includes('ada los'))) {
        return 'Loss Total';
      }
      if (lower.includes('ada los')) {
        const numbers = node.rx_power_range.match(/-?\d+(\.\d+)?/g);
        if (numbers && numbers.length > 0) {
          return `${parseFloat(numbers[0]).toFixed(1)} dBm (LOS)`;
        }
        return 'Ada LOS';
      }
      const numbers = node.rx_power_range.match(/-?\d+(\.\d+)?/g);
      if (numbers && numbers.length >= 2) {
        const val1 = parseFloat(numbers[0]);
        const val2 = parseFloat(numbers[1]);
        const minVal = Math.max(val1, val2); // redaman terbaik / terkecil e.g. -19.5
        const maxVal = Math.min(val1, val2); // redaman terbesar e.g. -24.2
        return `${minVal.toFixed(1)} - ${maxVal.toFixed(1)} dBm`;
      } else if (numbers && numbers.length === 1) {
        return `${parseFloat(numbers[0]).toFixed(1)} dBm`;
      }
    }

    const effectivePower = node.best_rx_power ?? node.optical_power_dbm;
    if (effectivePower != null && !isNaN(parseFloat(effectivePower))) {
      return `${parseFloat(effectivePower).toFixed(1)} dBm`;
    }

    return node.node_type === 'ODP' ? 'Belum ada pelanggan' : '';
  };

  // 6b. Ultra-Lightweight Unified Enterprise Marker System (Model Bulat / Circular Pin)
  const buildCircleHtml = (node, effStatus, optMeta, isSelected, isBadgeMode) => {
    const isOdp = node.node_type === 'ODP';
    const compactDbm = isOdp && !effStatus.isInactive ? formatCompactOptical(node, effStatus) : '';

    let statusCls = '';
    if (effStatus.isTotalLoss) statusCls = 'gis-circle-loss';
    else if (effStatus.isInactive) statusCls = 'gis-circle-inactive';
    else if (effStatus.key === 'maintenance') statusCls = 'gis-circle-maint';
    else if (effStatus.hasNoClients) statusCls = 'gis-circle-no-clients';

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

  const renderNodes = useCallback(() => {
    if (!mapLoaded || !mapInstanceRef.current || !leafletRef.current || !nodesLayerGroupRef.current) return;
    const Lf = leafletRef.current;
    const map = mapInstanceRef.current;
    const nodesGroup = nodesLayerGroupRef.current;
    const highlightGroup = pathHighlightLayerGroupRef.current;

    if (highlightGroup) highlightGroup.clearLayers();

    const zoom = map.getZoom();
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
            renderer: canvasRendererRef.current || undefined,
            color: '#0284c7',
            weight: 4,
            opacity: 0.9,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(highlightGroup);
        }
      });
    }

    // 2. High-performance Hybrid Marker System: Hardware Canvas GPU for Overview + Rich DOM for Details
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
      const isFault = effStatus.isTotalLoss;
      const optMeta = isFault 
        ? { label: 'Loss Total (Kritis)', color: '#ef4444', pillBg: '#fff1f2', pillBorder: '#fecdd3', badge: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800' } 
        : (effStatus.hasNoClients
            ? { label: 'Belum Ada Pelanggan', color: '#64748b', pillBg: '#f8fafc', pillBorder: '#cbd5e1', badge: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700' }
            : getOpticalQuality(effectiveBestPower));

      const opticalDbmText = formatCompactOptical(node, effStatus) || '—';

      const isPopOrOdc = node.node_type === 'POP' || node.node_type === 'ODC';
      
      // Use DOM element only if explicitly selected, critical total loss, POP/ODC, or zoomed in very close (>=17)
      const useDomMarker = isSelected || isFault || (isPopOrOdc ? zoom >= 14 : zoom >= 17);
      const isBadgeMode = isSelected || isFault || (isPopOrOdc ? zoom >= 16 : zoom >= 17);
      const markerType = useDomMarker ? (isBadgeMode ? 'dom-badge' : 'dom-circle') : 'canvas-dot';

      let existing = currentMarkers.get(id);

      if (existing) {
        if (
          existing.markerType !== markerType || 
          existing.statusKey !== effStatus.key || 
          existing.opticalDbm !== effectiveBestPower || 
          existing.isSelected !== isSelected
        ) {
          nodesGroup.removeLayer(existing.marker);
          existing = null;
        } else {
          const curLatLng = existing.marker.getLatLng();
          if (Math.abs(curLatLng.lat - lat) > 0.000001 || Math.abs(curLatLng.lng - lng) > 0.000001) {
            existing.marker.setLatLng([lat, lng]);
          }
        }
      }

      if (!existing) {
        let marker;
        if (useDomMarker) {
          const iconHtml = buildCircleHtml(node, effStatus, optMeta, isSelected, isBadgeMode);
          const icon = Lf.divIcon({
            className: 'gis-marker-container',
            html: iconHtml,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          });
          marker = Lf.marker([lat, lng], { icon }).addTo(nodesGroup);
        } else {
          // Hardware-accelerated Canvas circleMarker (0 DOM elements for 60-120 FPS mobile panning)
          const dotRadius = isPopOrOdc ? (zoom >= 13 ? 8 : 6) : (zoom >= 15 ? 6 : (zoom >= 13 ? 4.5 : 3.5));
          marker = Lf.circleMarker([lat, lng], {
            renderer: canvasRendererRef.current || undefined,
            radius: dotRadius,
            fillColor: effStatus.pinBg,
            color: '#ffffff',
            weight: zoom >= 15 ? 1.8 : 1.2,
            opacity: 0.95,
            fillOpacity: 0.9,
          }).addTo(nodesGroup);
        }

        const tooltipSub = effStatus.hasNoClients 
          ? '<br><span style="color:#64748b;font-weight:bold;">Belum Ada Pelanggan</span>'
          : (effStatus.isTotalLoss 
              ? '<br><span style="color:#ef4444;font-weight:bold;">Loss Total (Semua Klien)</span>'
              : (opticalDbmText !== '—' ? '<br>Rx: ' + opticalDbmText : ''));

        marker.bindTooltip(`<b>${node.name}</b> (${node.code})<br>Tipe: ${node.node_type} • Status: ${effStatus.label}${tooltipSub}`, {
          direction: 'top',
          offset: [0, useDomMarker ? -18 : -8],
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
          markerType,
          isSelected,
          statusKey: effStatus.key,
          opticalDbm: effectiveBestPower,
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

  // 6c. Attach Smooth Viewport & Zoom Listeners
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const handleZoom = () => {
      renderNodes();
    };

    map.on('zoomend', handleZoom);

    // Initial render
    renderNodes();

    // Fit bounds on first render with smart maximum zoom
    if (isFirstRenderRef.current && safeNodes.length > 0) {
      const validNodes = safeNodes.filter(n => n?.latitude && n?.longitude && parseFloat(n.latitude) !== 0);
      if (validNodes.length > 0) {
        const bounds = validNodes.map(n => [parseFloat(n.latitude), parseFloat(n.longitude)]);
        try {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
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
          border: 2px solid #10b981;
          background: #ffffff;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
          position: relative;
          transition: all 0.14s ease;
          flex-shrink: 0;
        }
        .dark .gis-circle-node {
          background: #000000;
          box-shadow: 0 1px 4px rgba(255, 255, 255, 0.2);
        }

        .gis-circle-marker.is-pop .gis-circle-node {
          width: 34px;
          height: 34px;
          border-width: 2.5px;
        }
        .gis-circle-marker.is-odc .gis-circle-node {
          width: 30px;
          height: 30px;
          border-width: 2px;
        }

        .gis-circle-icon {
          font-size: 8px;
          font-weight: 900;
          letter-spacing: -0.02em;
          color: #000000;
          line-height: 1;
        }
        .dark .gis-circle-icon {
          color: #ffffff;
        }
        .gis-circle-marker.is-pop .gis-circle-icon {
          font-size: 10.5px;
          color: #4f46e5;
        }
        .dark .gis-circle-marker.is-pop .gis-circle-icon {
          color: #818cf8;
        }
        .gis-circle-marker.is-odc .gis-circle-icon {
          font-size: 9px;
          color: #2563eb;
        }
        .dark .gis-circle-marker.is-odc .gis-circle-icon {
          color: #60a5fa;
        }
        .gis-circle-marker.is-odp .gis-circle-icon {
          font-size: 8px;
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
          margin-top: 3px;
          padding: 2px 6px;
          border-radius: 5px;
          background: #ffffff;
          border: 1px solid rgba(0, 0, 0, 0.6);
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
          white-space: nowrap;
          max-width: 125px;
          text-align: center;
        }
        .dark .gis-circle-stack {
          background: #000000;
          border-color: rgba(255, 255, 255, 0.5);
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
        }

        .gis-circle-name {
          font-size: 10px;
          font-weight: 800;
          color: #000000;
          max-width: 110px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          line-height: 1.2;
        }
        .dark .gis-circle-name {
          color: #ffffff;
        }

        .gis-circle-dbm {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 8.5px;
          font-weight: 800;
          padding: 1px 4px;
          border-radius: 3px;
          line-height: 1.2;
          border: 1px solid transparent;
          white-space: nowrap;
        }

        .gis-circle-loss .gis-circle-node {
          border-color: #ef4444 !important;
          background: #fff1f2 !important;
        }
        .dark .gis-circle-loss .gis-circle-node {
          background: #000000 !important;
        }
        .gis-circle-loss .gis-circle-icon {
          color: #ef4444 !important;
        }
        .gis-circle-loss .gis-circle-stack {
          border-color: #fca5a5 !important;
          background: #fff1f2 !important;
        }
        .dark .gis-circle-loss .gis-circle-stack {
          border-color: #ef4444 !important;
          background: #000000 !important;
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

        .gis-circle-no-clients .gis-circle-stack {
          max-width: 145px;
        }
        .gis-circle-no-clients .gis-circle-dbm {
          font-size: 8px !important;
          font-weight: 700 !important;
          padding: 1px 4.5px !important;
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
        className={`w-full overflow-hidden relative z-0 transition-all ${isFullscreen ? 'h-full rounded-none' : 'rounded-lg border border-black/70 dark:border-white/70 shadow-inner'}`}
        style={{ height: isFullscreen ? '100%' : '640px', minHeight: isFullscreen ? '100%' : '640px' }}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   STATS CARDS BAR (CLEAN OLT-MANAGEMENT STYLE)
══════════════════════════════════════════════════════════════════ */
function GisStatCards({ nodes = [] }) {
  const safeNodes = Array.isArray(nodes) ? nodes : (nodes && typeof nodes === 'object' ? Object.values(nodes) : []);

  // Count optical loss faults (total loss or damaged)
  const lossNodes = safeNodes.filter(n => {
    if (!n) return false;
    const eff = getNodeEffectiveStatus(n);
    return eff.isTotalLoss;
  });

  const inactiveNodes = safeNodes.filter(n => n?.status === 'inactive');
  const isLoss = lossNodes.length > 0;

  return (
    <div className="w-full">
      <div className="bg-white dark:bg-black rounded-lg border border-black/70 dark:border-white/70 shadow-2xs p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full shrink-0 ${isLoss ? 'bg-rose-500 animate-ping' : 'bg-emerald-500 animate-pulse'}`} />
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-black leading-none ${isLoss ? 'text-rose-600 dark:text-rose-400' : 'text-black dark:text-white'}`}>
                {lossNodes.length}
              </span>
              <p className="text-sm font-bold text-black dark:text-white">Gangguan Loss Total</p>
            </div>
            <p className="text-xs text-black/70 dark:text-white/70 mt-0.5 font-medium">
              {inactiveNodes.length > 0
                ? `${lossNodes.length} Total Loss • ${inactiveNodes.length} Tidak Aktif (Nonaktif)`
                : (isLoss ? 'Perlu Investigasi Lapangan Pada Titik ODP / Jalur Terkait' : 'Seluruh Jalur Distribusi FO & Titik ODP Beroperasi Normal')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className={`text-xs font-bold px-3 py-1.5 rounded-md ${
            isLoss 
              ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/40' 
              : 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/40'
          }`}>
            {isLoss ? 'Perhatian: Ada Gangguan' : 'Sistem Aman Normal'}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN GIS PAGE CONTROLLER
══════════════════════════════════════════════════════════════════ */
export default function GisTopologyMap({ isStandaloneFullscreen = false }) {
  const { currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'Super Administrator';
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
  const externalRecenterRef = useRef(null);

  // Satellite vs Vector Map Mode State
  const [isSatellite, setIsSatellite] = useState(true);

  // Target Coordinate / Client Benchmark State
  const [targetPin, setTargetPin] = useState(null);
  const searchInputRef = useRef(null);
  const fullscreenSearchInputRef = useRef(null);
  // KML / KMZ Import Modal State
  const [kmlImportModal, setKmlImportModal] = useState(false);

  // Tools Dropdown Menu State
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsDropdownRef = useRef(null);

  // Fullscreen Google Earth UI States & Refs
  const [fullscreenLegendOpen, setFullscreenLegendOpen] = useState(false);
  const [fullscreenMoreOpen, setFullscreenMoreOpen] = useState(false);
  const [fullscreenTypeOpen, setFullscreenTypeOpen] = useState(false);
  const fullscreenMoreRef = useRef(null);
  const fullscreenTypeRef = useRef(null);
  const fullscreenLegendRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (toolsDropdownRef.current && !toolsDropdownRef.current.contains(e.target)) {
        setToolsOpen(false);
      }
      if (fullscreenMoreRef.current && !fullscreenMoreRef.current.contains(e.target)) {
        setFullscreenMoreOpen(false);
      }
      if (fullscreenTypeRef.current && !fullscreenTypeRef.current.contains(e.target)) {
        setFullscreenTypeOpen(false);
      }
      if (fullscreenLegendRef.current && !fullscreenLegendRef.current.contains(e.target)) {
        setFullscreenLegendOpen(false);
      }
    };
    if (toolsOpen || fullscreenMoreOpen || fullscreenTypeOpen || fullscreenLegendOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [toolsOpen, fullscreenMoreOpen, fullscreenTypeOpen, fullscreenLegendOpen]);

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

  // Sub-Second Real-Time SNMP Trap & Telemetry Event Stream Listener (Polling ringan tiap 3.5s)
  const [recentTrapAlert, setRecentTrapAlert] = useState(null);
  const lastEventTimestampRef = useRef(null);

  useEffect(() => {
    if (!livePolling) return;
    const trapCheckTimer = setInterval(async () => {
      if (document.hidden) return;
      try {
        const sinceParam = lastEventTimestampRef.current ? `?since=${encodeURIComponent(lastEventTimestampRef.current)}` : '';
        const res = await fetch(`/api/telemetry/live-events${sinceParam}`).then(r => r.json());
        if (res?.data?.events && res.data.events.length > 0) {
          const newest = res.data.events[0];
          lastEventTimestampRef.current = newest.timestamp;
          
          // Tampilkan alert banner instan pada UI peta
          setRecentTrapAlert(newest);
          
          // Refresh data node seketika tanpa delay 25s
          fetchNodesAndCables(true);
        }
      } catch (err) {
        // silent fail
      }
    }, 3500);

    return () => clearInterval(trapCheckTimer);
  }, [livePolling, fetchNodesAndCables]);

  // Auto-dismiss alert banner setelah 10 detik
  useEffect(() => {
    if (!recentTrapAlert) return;
    const t = setTimeout(() => setRecentTrapAlert(null), 10000);
    return () => clearTimeout(t);
  }, [recentTrapAlert]);

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
          if (eff.key !== 'active_loss' && eff.key !== 'damaged' && !eff.isTotalLoss) return false;
        } else if (statusFilter === 'no_clients') {
          if (!eff.hasNoClients) return false;
        } else if (statusFilter === 'active') {
          if (eff.key !== 'active' || eff.hasNoClients || eff.isTotalLoss) return false;
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
        // If searchQuery is a GPS coordinate string, DO NOT filter out nodes on the map!
        // This ensures all ODP/ODC/POP nodes and cables remain fully visible around the location pin.
        const isCoords = parseCoordsInput(searchQuery).isValid;
        if (!isCoords) {
          const q = searchQuery.toLowerCase();
          const match = n.name?.toLowerCase().includes(q) || n.code?.toLowerCase().includes(q) || n.address?.toLowerCase().includes(q) || n.olt_port_ref?.toLowerCase().includes(q);
          if (!match) return false;
        }
      }
      return true;
    }).sort(naturalNodeCompare);
  }, [safeAllNodes, oltFilterParam, typeFilter, statusFilter, faultOnlyFilter, searchQuery]);

  const nodesWithCoords = useMemo(() => {
    return filteredNodes.filter(n => n.latitude && n.longitude && parseFloat(n.latitude) !== 0);
  }, [filteredNodes]);

  // Parse coordinates directly from the search query (e.g. decimal, DMS, or Google Maps URL)
  const parsedSearchCoords = useMemo(() => {
    if (!searchQuery || searchQuery.trim().length < 3) return null;
    const res = parseCoordsInput(searchQuery);
    return res.isValid ? res : null;
  }, [searchQuery]);

  const handleApplyTargetCoordinate = useCallback((coords) => {
    if (!coords || !coords.isValid) return;
    const target = {
      lat: coords.lat,
      lng: coords.lng,
      label: 'Titik Lokasi',
      dms: coords.formattedDms,
    };
    setTargetPin(target);
    setSearchQuery(''); // Reset search input so all map nodes stay visible!
    setIsSearchFocused(false);
    if (externalFlyToRef.current) {
      externalFlyToRef.current(coords.lat, coords.lng, 17);
    }
  }, []);

  const handleGpsCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Perangkat/browser Anda tidak mendukung GPS Geolocation.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const dms = decimalToDms(lat, lng);
        const target = {
          lat,
          lng,
          label: 'Posisi GPS Saya',
          dms: dms.formattedDms,
        };
        setTargetPin(target);
        setSearchQuery(''); // Reset search input so all map nodes stay visible!
        if (externalFlyToRef.current) {
          externalFlyToRef.current(lat, lng, 18);
        }
      },
      (err) => {
        alert('Gagal mendeteksi lokasi GPS: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

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
    setSearchQuery(''); // Reset search input so all surrounding map nodes stay visible!
    setIsSearchFocused(false);
    if (node.latitude && node.longitude && externalFlyToRef.current) {
      externalFlyToRef.current(parseFloat(node.latitude), parseFloat(node.longitude), 17);
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (parsedSearchCoords) {
        handleApplyTargetCoordinate(parsedSearchCoords);
      } else if (searchSuggestions.length > 0) {
        handleSelectSuggestion(searchSuggestions[0]);
      }
    }
  };

  // Dedicated Google Earth Mobile-Inspired Fullscreen View (100vw x 100vh / 100dvh)
  if (isFullscreenPage) {
    return (
      <div className="fixed inset-0 w-full h-screen h-[100dvh] z-[99999] bg-black text-white overflow-hidden select-none font-sans">
        {/* Fullscreen Map Canvas in Background */}
        <div className="absolute inset-0 w-full h-full z-0 overflow-hidden">
          {loading && safeAllNodes.length === 0 ? (
            <LoadingState
              type="full"
              title="Memuat Peta Spasial GIS..."
              description="Merender layer koordinat POP, ODC, ODP dan jalur kabel..."
            />
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
              onClearTarget={() => setTargetPin(null)}
              isFullscreen={true}
              isSatellite={isSatellite}
              onToggleFullscreen={() => navigate('/gis-map')}
              onSelectNode={node => setSelectedNode(node)}
              onOpenStreetView={(lat, lng, title) => setStreetViewTarget({ lat, lng, title })}
              externalFlyToRef={externalFlyToRef}
              externalRecenterRef={externalRecenterRef}
            />
          )}
        </div>

        {/* 1. Top Floating Search & Quick Layer Pill (Google Earth Mobile Header) */}
        <div className="fixed top-3 sm:top-4 left-3 right-3 sm:left-4 sm:right-auto sm:w-[460px] z-[1100]">
          <div className="bg-black/90 backdrop-blur-md border border-white/20 text-white rounded-full shadow-2xl p-1.5 flex items-center gap-1.5 transition-all">
            {/* Back to Standard UNMS Map */}
            <button
              type="button"
              onClick={() => navigate('/gis-map')}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-rose-600 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
              title="Kembali ke tampilan standar UNMS (Esc)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>

            {/* Search Box */}
            <div className="flex-1 flex items-center gap-1.5 pl-1 pr-1 min-w-0">
              <svg className="w-4 h-4 text-white/60 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={fullscreenSearchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                placeholder="Cari node / ketik koordinat GPS..."
                className="bg-transparent text-white placeholder-white/50 text-xs font-semibold focus:outline-none w-full min-w-0"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="w-5 h-5 rounded-full hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white text-xs font-bold cursor-pointer shrink-0"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Live Telemetry Stream Dot */}
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" title="Live Telemetry Aktif" />

            {/* Quick Layer Switcher Thumbnail */}
            <button
              type="button"
              onClick={() => setIsSatellite(!isSatellite)}
              className="w-8 h-8 rounded-full overflow-hidden border border-white/40 shadow-sm relative shrink-0 cursor-pointer hover:scale-105 active:scale-95 transition-transform flex items-center justify-center bg-zinc-800"
              title={isSatellite ? 'Ubah ke Mode Vektor' : 'Ubah ke Mode Satelit'}
            >
              {isSatellite ? (
                <div className="w-full h-full bg-linear-to-br from-emerald-600 via-blue-700 to-indigo-900 flex items-center justify-center text-[8px] font-black text-white tracking-tighter">
                  SAT
                </div>
              ) : (
                <div className="w-full h-full bg-linear-to-br from-zinc-200 via-slate-300 to-slate-400 flex items-center justify-center text-[8px] font-black text-black tracking-tighter">
                  MAP
                </div>
              )}
            </button>
          </div>

          {/* Smart Search & Coordinate Suggestions Dropdown */}
          {isSearchFocused && (parsedSearchCoords || searchSuggestions.length > 0) && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-black/95 text-white border border-white/20 rounded-2xl shadow-2xl overflow-hidden divide-y divide-white/10 z-[1101] backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
              {/* GPS Coordinate Match Option */}
              {parsedSearchCoords && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleApplyTargetCoordinate(parsedSearchCoords);
                  }}
                  className="w-full text-left px-3.5 py-2.5 bg-rose-950/50 hover:bg-rose-900/70 border-b border-rose-500/30 flex items-center justify-between cursor-pointer text-xs transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                        <circle cx="12" cy="9" r="2.5" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/30 text-rose-300 border border-rose-500/40">
                          TITIK LOKASI
                        </span>
                        <span className="font-bold text-white">
                          Tandai Patokan Titik Lokasi
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-rose-200/80 block truncate">
                        {parsedSearchCoords.lat.toFixed(6)}, {parsedSearchCoords.lng.toFixed(6)} {parsedSearchCoords.formattedDms ? `(${parsedSearchCoords.formattedDms})` : ''}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-rose-400 shrink-0 ml-2">Tandai ➔</span>
                </button>
              )}

              {/* Node Search Results */}
              {searchSuggestions.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectSuggestion(s);
                  }}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-white/10 flex items-center justify-between cursor-pointer text-xs transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-white/10 text-white border border-white/20">{s.node_type}</span>
                      <span className="font-bold text-white">{s.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-white/60 block">{s.code}</span>
                  </div>
                  <span className="text-[10px] text-blue-400 font-mono">Fokus ↗</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 3. Interactive Ruler Distance HUD */}
        {rulerActive && (
          <div className="fixed bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-[1080] w-full max-w-sm px-3 pointer-events-auto">
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
          </div>
        )}

        {/* 4. Floating GIS Spatial Legend Card */}
        {fullscreenLegendOpen && (
          <div
            ref={fullscreenLegendRef}
            className="fixed bottom-20 sm:bottom-24 left-3 sm:left-4 z-[1100] w-72 bg-black/95 text-white border border-white/20 rounded-2xl p-3.5 shadow-2xl backdrop-blur-md text-xs space-y-3 animate-in fade-in zoom-in-95 duration-150 pointer-events-auto"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="font-bold text-white text-xs">Legenda Peta Spasial GIS</span>
              <button
                onClick={() => setFullscreenLegendOpen(false)}
                className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-white/10 text-white/60 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase text-white/50">Tipe Node Perangkat</div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 mx-auto mb-1"></div>
                  <span className="font-bold text-[10px] text-indigo-400">POP</span>
                </div>
                <div className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 mx-auto mb-1"></div>
                  <span className="font-bold text-[10px] text-blue-400">ODC</span>
                </div>
                <div className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mx-auto mb-1"></div>
                  <span className="font-bold text-[10px] text-emerald-400">ODP</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5 pt-1 border-t border-white/10">
              <div className="text-[10px] font-bold uppercase text-white/50">Status Redaman Optik (ODP)</div>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Prima (&ge; -24 dBm)</span>
                </div>
                <div className="flex items-center gap-1.5 text-blue-400">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span>Optimal (&ge; -26 dBm)</span>
                </div>
                <div className="flex items-center gap-1.5 text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>Waspada (&ge; -27.5 dBm)</span>
                </div>
                <div className="flex items-center gap-1.5 text-rose-400">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                  <span>Loss / Kritis</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5. Google Earth Mobile Floating Bottom Toolbar & GPS Action Buttons (Hidden when Node Detail is open) */}
        {!selectedNode && (
          <>
            {/* Bottom Left: Tools Toolbar */}
            <div className="fixed bottom-4 sm:bottom-6 left-3 sm:left-4 z-[1100] pointer-events-auto">
              <div className="bg-black/90 backdrop-blur-md border border-white/20 text-white rounded-full shadow-2xl px-2.5 py-1.5 flex items-center gap-1.5 sm:gap-2 select-none transition-all">
                {/* Google Earth Brand / Recenter Icon */}
                <button
                  type="button"
                  onClick={() => {
                    if (externalRecenterRef.current) {
                      externalRecenterRef.current();
                    }
                  }}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-linear-to-br from-blue-500 via-indigo-600 to-sky-400 p-0.5 shadow-md flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer shrink-0"
                  title="Pusatkan Peta (Fit Bounds)"
                >
                  <div className="w-full h-full rounded-full bg-zinc-900/30 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                      <path d="M2 12h20" />
                    </svg>
                  </div>
                </button>

                {/* Vertical Divider */}
                <div className="w-px h-5 bg-white/20 mx-0.5 shrink-0" />

                {/* 1. Ukur Jarak (Ruler) */}
                <button
                  type="button"
                  onClick={() => {
                    const next = !rulerActive;
                    setRulerActive(next);
                    if (!next) setRulerPoints([]);
                  }}
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center relative transition-all cursor-pointer ${
                    rulerActive
                      ? 'bg-amber-500 text-black shadow-md shadow-amber-500/40 font-bold scale-105'
                      : 'hover:bg-white/15 text-white/80 hover:text-white'
                  }`}
                  title="Ukur Jarak Kabel Lapangan (Ruler)"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M21.3 15.3l-6.6 6.6c-.4.4-1 .4-1.4 0l-12-12c-.4-.4-.4-1 0-1.4l6.6-6.6c.4-.4 1-.4 1.4 0l12 12c.4.4.4 1 0 1.4z" />
                    <path d="m7.5 4.5 2 2M10.5 7.5l2 2M13.5 10.5l2 2M16.5 13.5l2 2" />
                  </svg>
                  {rulerActive && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-black animate-ping" />
                  )}
                </button>

                {/* 2. Gangguan Loss (Fault Only Filter) */}
                <button
                  type="button"
                  onClick={() => setFaultOnlyFilter(!faultOnlyFilter)}
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center relative transition-all cursor-pointer ${
                    faultOnlyFilter
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-600/50 font-bold scale-105'
                      : 'hover:bg-white/15 text-white/80 hover:text-white'
                  }`}
                  title={faultOnlyFilter ? 'Tampilkan Semua Status' : 'Filter Hanya Gangguan Loss Total'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {faultOnlyFilter && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-400 border-2 border-black animate-pulse" />
                  )}
                </button>

                {/* 3. Import KML / KMZ (Super Administrator Only) */}
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => setKmlImportModal(true)}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center hover:bg-white/15 text-white/80 hover:text-white transition-all cursor-pointer shrink-0"
                    title="Import Jalur KML / KMZ Google Earth"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </button>
                )}

                {/* 4. Filter Tipe Perangkat */}
                <div className="relative" ref={fullscreenTypeRef}>
                  <button
                    type="button"
                    onClick={() => setFullscreenTypeOpen(!fullscreenTypeOpen)}
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center relative transition-all cursor-pointer ${
                      typeFilter
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/50 font-bold scale-105'
                        : fullscreenTypeOpen
                        ? 'bg-white/25 text-white'
                        : 'hover:bg-white/15 text-white/80 hover:text-white'
                    }`}
                    title="Filter Tipe Perangkat (POP / ODC / ODP)"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <polygon points="12 2 2 7 12 12 22 7 12 2" />
                      <polyline points="2 17 12 22 22 17" />
                      <polyline points="2 12 12 17 22 12" />
                    </svg>
                    {typeFilter && (
                      <span className="absolute -top-1 -right-1 px-1 py-0.2 rounded-full bg-blue-400 text-black text-[8px] font-black leading-none border border-black">
                        {typeFilter}
                      </span>
                    )}
                  </button>

                  {/* Type Filter Popover */}
                  {fullscreenTypeOpen && (
                    <div className="absolute bottom-full mb-3 left-0 bg-black/95 text-white border border-white/20 rounded-2xl shadow-2xl p-2 z-[1150] backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 flex items-center gap-1.5 whitespace-nowrap">
                      {['', 'POP', 'ODC', 'ODP'].map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            setTypeFilter(t);
                            setFullscreenTypeOpen(false);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            typeFilter === t
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-white/10 hover:bg-white/20 text-white/70 hover:text-white'
                          }`}
                        >
                          {t || 'Semua'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Right: Floating Action Buttons (Street View & GPS My Location) */}
            <div className="fixed bottom-4 sm:bottom-6 right-3 sm:right-4 z-[1100] pointer-events-auto flex flex-col items-center gap-2">
              {/* Quick Street View 360 for Target Pin */}
              {targetPin && (
                <button
                  type="button"
                  onClick={() => {
                    setStreetViewTarget({
                      lat: targetPin.lat,
                      lng: targetPin.lng,
                      title: targetPin.label || 'Titik Lokasi'
                    });
                  }}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-linear-to-br from-blue-600 via-indigo-600 to-sky-500 text-white shadow-xl shadow-blue-500/40 border border-blue-400/60 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 animate-in zoom-in-90 duration-150"
                  title="Buka Street View 360° Titik Lokasi"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                </button>
              )}

              {/* GPS My Location Button */}
              <button
                type="button"
                onClick={() => {
                  if (targetPin) {
                    setTargetPin(null);
                  } else {
                    handleGpsCurrentLocation();
                  }
                }}
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full border backdrop-blur-md shadow-2xl flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                  targetPin
                    ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-400 shadow-rose-600/50 animate-pulse'
                    : 'bg-black/90 hover:bg-zinc-800 text-fuchsia-300 border-white/20 hover:border-white/40'
                }`}
                title={targetPin ? 'Hapus Patokan Titik Lokasi' : 'Deteksi & Tandai Lokasi GPS Saya Saat Ini'}
              >
                {targetPin ? (
                  <span className="text-sm font-black leading-none">✕</span>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="7" />
                    <line x1="12" y1="1" x2="12" y2="5" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="1" y1="12" x2="5" y2="12" />
                    <line x1="19" y1="12" x2="23" y2="12" />
                  </svg>
                )}
              </button>
            </div>
          </>
        )}

        {/* 6. Node Detail Drawer / Bottom Sheet */}
        <NodeDetailPanel
          node={selectedNode}
          isFullscreen={true}
          onClose={() => setSelectedNode(null)}
          onOpenStreetView={(lat, lng, title) => setStreetViewTarget({ lat, lng, title })}
          onTracePath={node => {
            setSelectedNode(node);
            if (node.latitude && node.longitude && externalFlyToRef.current) {
              externalFlyToRef.current(parseFloat(node.latitude), parseFloat(node.longitude), 17);
            }
          }}
        />

        {/* 7. Modals */}
        {streetViewTarget && (
          <StreetViewModal
            lat={streetViewTarget.lat}
            lng={streetViewTarget.lng}
            title={streetViewTarget.title}
            onClose={() => setStreetViewTarget(null)}
          />
        )}

        <KmlImportModal
          isOpen={kmlImportModal}
          onClose={() => setKmlImportModal(false)}
          onSuccess={() => fetchNodesAndCables(true)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 text-black dark:text-white">
      {/* Header Banner */}
      <div className="bg-white dark:bg-black border border-black/70 dark:border-white/70 p-4 sm:p-5 rounded-lg shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-colors duration-300">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <h3 className="text-xl font-bold text-black dark:text-white tracking-tight font-sans">
            Peta Monitoring
          </h3>
        </div>

        <div className="flex items-center gap-2.5 self-stretch sm:self-auto justify-between sm:justify-end">
          {/* View Tab Switchers (Segmented control) */}
          <div className="flex items-center bg-black/5 dark:bg-white/5 border border-black/20 dark:border-white/20 p-1 rounded-lg">
            <button
              onClick={() => setActiveView('map')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeView === 'map'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white'
              }`}
            >
              Peta GIS
            </button>
            <button
              onClick={() => setActiveView('list')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeView === 'list'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white'
              }`}
            >
              Tabel Redaman
            </button>
          </div>

          {/* Tools Dropdown Menu Button */}
          <div className="relative" ref={toolsDropdownRef}>
            <button
              onClick={() => setToolsOpen(!toolsOpen)}
              className="px-3.5 py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-black dark:text-white text-xs font-bold rounded-lg border border-black/20 dark:border-white/20 transition-colors flex items-center gap-2 cursor-pointer shadow-2xs"
            >
              <span>Tools</span>
              <span className={`transition-transform text-[10px] ${toolsOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {toolsOpen && (
              <div className="absolute right-0 top-full mt-2 w-60 bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg shadow-2xl z-[1100] py-1 divide-y divide-black/10 dark:divide-white/10 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3.5 py-2 text-[10px] font-bold text-black/50 dark:text-white/50 uppercase tracking-wider">
                  Opsi Tools Peta
                </div>

                <div className="py-1">
                  {isSuperAdmin && (
                    <button
                      onClick={() => {
                        setKmlImportModal(true);
                        setToolsOpen(false);
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-between text-xs font-semibold cursor-pointer"
                    >
                      <span>Import KML / KMZ</span>
                      <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400">Google Earth</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setIsSatellite(!isSatellite);
                      setToolsOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-between text-xs font-semibold cursor-pointer"
                  >
                    <span>Ganti Tampilan Peta</span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10">
                      {isSatellite ? 'Mode Vektor' : 'Mode Satelit'}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      if (externalRecenterRef.current) {
                        externalRecenterRef.current();
                      }
                      setToolsOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-between text-xs font-semibold cursor-pointer"
                  >
                    <span>Pusatkan Peta</span>
                    <span className="text-[10px] text-black/50 dark:text-white/50">Fit Bounds</span>
                  </button>

                  <button
                    onClick={() => {
                      const next = !rulerActive;
                      setRulerActive(next);
                      if (!next) setRulerPoints([]);
                      setToolsOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-between text-xs font-semibold cursor-pointer"
                  >
                    <span>{rulerActive ? 'Tutup Alat Ukur' : 'Ukur Jarak Kabel FO'}</span>
                    <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400">Ruler</span>
                  </button>

                  <button
                    onClick={() => {
                      navigate('/gis-map/fullscreen');
                      setToolsOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-between text-xs font-semibold cursor-pointer"
                  >
                    <span>Buka Layar Penuh</span>
                    <span className="text-[10px] text-black/50 dark:text-white/50">100% Layar</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <GisStatCards nodes={safeAllNodes} />

      {/* Main Controls Filter Bar with Smart Search & Fault Filter */}
      <div className="bg-white dark:bg-black border border-black/70 dark:border-white/70 p-4 rounded-lg shadow-2xs transition-colors duration-300 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        <div className="flex flex-col sm:flex-row sm:flex-wrap lg:flex-nowrap items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
          {/* Smart Search Input with Floating Dropdown Suggestions & Coordinate Support */}
          <div className="relative w-full sm:w-80">
            <div className="flex items-center bg-black/5 dark:bg-white/5 border border-black/20 dark:border-white/20 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                placeholder="Cari node / ketik koordinat GPS..."
                className="px-3.5 py-2 bg-transparent text-xs font-semibold text-black dark:text-white focus:outline-none w-full"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-2 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (targetPin) {
                    setTargetPin(null);
                  } else {
                    handleGpsCurrentLocation();
                  }
                }}
                className={`px-2.5 py-2 border-l border-black/10 dark:border-white/10 cursor-pointer transition-colors ${
                  targetPin
                    ? 'bg-rose-600 hover:bg-rose-700 text-white font-bold animate-pulse'
                    : 'hover:bg-black/10 dark:hover:bg-white/10 text-fuchsia-600 dark:text-fuchsia-400'
                }`}
                title={targetPin ? 'Hapus Patokan Titik Lokasi' : 'Tandai lokasi GPS saat ini (Patokan Titik Lokasi)'}
              >
                {targetPin ? (
                  <span className="text-xs font-bold leading-none">✕</span>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="7" />
                    <line x1="12" y1="1" x2="12" y2="5" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="1" y1="12" x2="5" y2="12" />
                    <line x1="19" y1="12" x2="23" y2="12" />
                  </svg>
                )}
              </button>
            </div>

            {/* Suggestions & Coordinate Target Dropdown */}
            {isSearchFocused && (parsedSearchCoords || searchSuggestions.length > 0) && (
              <div className="absolute top-full left-0 mt-1.5 w-full bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg shadow-2xl z-[1000] overflow-hidden divide-y divide-black/10 dark:divide-white/10 animate-in fade-in zoom-in-95 duration-150">
                {/* GPS Coordinate Match */}
                {parsedSearchCoords && (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleApplyTargetCoordinate(parsedSearchCoords);
                    }}
                    className="w-full text-left px-3 py-2.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 border-b border-rose-200 dark:border-rose-800 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                          <circle cx="12" cy="9" r="2.5" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                            TITIK LOKASI
                          </span>
                          <span className="font-bold text-xs text-rose-700 dark:text-rose-300">
                            Tandai Patokan Titik Lokasi
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-black/60 dark:text-white/60 block truncate">
                          {parsedSearchCoords.lat.toFixed(6)}, {parsedSearchCoords.lng.toFixed(6)} {parsedSearchCoords.formattedDms ? `(${parsedSearchCoords.formattedDms})` : ''}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 shrink-0 ml-2">Tandai ➔</span>
                  </button>
                )}

                {/* Node Suggestions */}
                {searchSuggestions.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectSuggestion(s);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-black/10 dark:bg-white/10 text-black dark:text-white border border-black/20 dark:border-white/20">
                          {s.node_type}
                        </span>
                        <span className="font-bold text-xs text-black dark:text-white">{s.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-black/60 dark:text-white/60 block">{s.code} • {s.olt_port_ref || 'PON'}</span>
                    </div>
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">Fly To ➔</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filter Dropdowns in clean 2 columns on mobile */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 bg-black/5 dark:bg-white/5 border border-black/20 dark:border-white/20 rounded-md text-xs font-semibold text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="">Semua Tipe Node</option>
              <option value="POP">POP Central</option>
              <option value="ODC">ODC Cabinet</option>
              <option value="ODP">ODP Point</option>
            </select>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 bg-black/5 dark:bg-white/5 border border-black/20 dark:border-white/20 rounded-md text-xs font-semibold text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="">Semua Status Node</option>
              <option value="active">Aktif Normal</option>
              <option value="active_loss">Aktif (Gangguan Loss)</option>
              <option value="no_clients">Belum Ada Pelanggan</option>
              <option value="damaged">Rusak / Loss Putus</option>
              <option value="inactive">Tidak Aktif (Nonaktif)</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
        </div>

        {/* Filter Quick Action & Telemetry Status in clean 2 columns on mobile */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full lg:w-auto">
          {/* Quick Filter: Hanya Gangguan Loss */}
          <button
            type="button"
            onClick={() => setFaultOnlyFilter(!faultOnlyFilter)}
            className={`w-full sm:w-auto px-3 py-2 rounded-md text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center ${
              faultOnlyFilter
                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/20'
            }`}
          >
            <span>Hanya Gangguan</span>
          </button>

          {/* Telemetry Live Polling Button */}
          <button
            onClick={() => setLivePolling(!livePolling)}
            className="w-full sm:w-auto px-3 py-2 rounded-md text-xs font-bold border border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/5 text-black dark:text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 text-center"
          >
            <span className={`w-2 h-2 rounded-full ${livePolling ? 'bg-emerald-500 animate-pulse' : 'bg-black/40 dark:bg-white/40'}`} />
            <span>{livePolling ? 'Telemetry Live' : 'Paused'}</span>
          </button>
        </div>
      </div>

      {/* Sub-Second Real-Time SNMP Trap Live Alert Banner (Outside Map) */}
      {recentTrapAlert && (
        <div className={`px-4 py-3 rounded-lg border shadow-xs flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 transition-all duration-300 ${
          recentTrapAlert.is_loss
            ? 'bg-rose-950/90 border-rose-500 text-white'
            : 'bg-emerald-950/90 border-emerald-500 text-white'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${recentTrapAlert.is_loss ? 'bg-rose-400 animate-ping' : 'bg-emerald-400 animate-ping'}`} />
            <div className="text-xs min-w-0">
              <div className="font-bold flex items-center gap-2">
                <span>{recentTrapAlert.event_label}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/20">
                  {recentTrapAlert.time_human}
                </span>
              </div>
              <div className="text-[11px] text-white/80 mt-0.5 truncate">
                <b>{recentTrapAlert.customer_name}</b> {recentTrapAlert.node_name ? `• ODP ${recentTrapAlert.node_name}` : `• Port ${recentTrapAlert.port}`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
            {recentTrapAlert.node_id && (
              <button
                onClick={() => {
                  const matched = safeAllNodes.find(n => n.id === recentTrapAlert.node_id);
                  if (matched) {
                    if (activeView !== 'map') setActiveView('map');
                    setSelectedNode(matched);
                    if (externalFlyToRef.current && matched.latitude && matched.longitude) {
                      externalFlyToRef.current(matched.latitude, matched.longitude, 18);
                    }
                  }
                }}
                className="px-3 py-1.5 rounded-md bg-white/20 hover:bg-white/30 text-xs font-bold transition-colors cursor-pointer"
              >
                Lihat ODP ➔
              </button>
            )}
            <button
              onClick={() => setRecentTrapAlert(null)}
              className="px-2 py-1 text-white/70 hover:text-white text-xs font-bold transition-colors cursor-pointer"
              title="Tutup Notifikasi"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <LoadingState
          type="table"
          rows={6}
          title="Memuat Topologi Spasial GIS..."
          description="Mengambil koordinat pemetaan node, bentangan rute kabel, dan telemetri redaman..."
        />
      ) : activeView === 'map' ? (
        <div className="bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg shadow-2xs overflow-hidden relative transition-colors duration-300 min-h-[640px]">
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



          {/* Interactive Ruler Distance HUD with Undo */}
          {rulerActive && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[999] max-w-sm px-3 pointer-events-auto">
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
            </div>
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
            onClearTarget={() => setTargetPin(null)}
            isFullscreen={false}
            isSatellite={isSatellite}
            onToggleFullscreen={() => navigate('/gis-map/fullscreen')}
            onSelectNode={node => setSelectedNode(node)}
            onOpenStreetView={(lat, lng, title) => setStreetViewTarget({ lat, lng, title })}
            externalFlyToRef={externalFlyToRef}
            externalRecenterRef={externalRecenterRef}
          />
        </div>
      ) : (
        /* Tabel Telemetry Redaman */
        <div className="bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg shadow-2xs overflow-hidden transition-colors duration-300">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/5 text-[10px] font-bold text-black/70 dark:text-white/70 uppercase tracking-wider">
                  <th className="px-5 py-3.5">Node &amp; Kode</th>
                  <th className="px-4 py-3.5">Tipe</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Port Terpakai</th>
                  <th className="px-4 py-3.5">Kualitas Redaman (Rx)</th>
                  <th className="px-4 py-3.5">Koordinat GPS</th>
                  <th className="px-4 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 dark:divide-white/10 text-xs">
                {filteredNodes.map(node => {
                  const effStatus = getNodeEffectiveStatus(node);
                  const effectivePower = node.best_rx_power ?? node.optical_power_dbm;
                  const isLoss = effStatus.isTotalLoss;
                  const optMeta = isLoss 
                    ? { label: 'Loss Total (Kritis)', color: '#ef4444', badge: 'text-rose-600 dark:text-rose-400 font-bold' }
                    : (effStatus.hasNoClients
                        ? { label: 'Belum Ada Pelanggan', color: '#64748b', badge: 'text-black/60 dark:text-white/60 font-bold' }
                        : getOpticalQuality(effectivePower));

                  return (
                    <tr key={node.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3">
                        <span className="font-bold text-black dark:text-white block">{node.name}</span>
                        <span className="text-[10px] font-mono text-black/60 dark:text-white/60">{node.code}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 text-black dark:text-white border border-black/20 dark:border-white/20">
                          {node.node_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-black/20 dark:border-white/20" style={{ color: effStatus.color }}>
                          {effStatus.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-black dark:text-white">
                        {node.total_ports > 0 ? `${node.total_clients ?? node.used_ports}/${node.total_ports} Port` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {node.node_type === 'ODP' ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold" style={{ color: optMeta.color }}>
                              {effStatus.hasNoClients ? 'Belum Ada Pelanggan' : (node.rx_power_range ? node.rx_power_range : (effectivePower != null ? `${parseFloat(effectivePower).toFixed(2)} dBm` : '—'))}
                            </span>
                            <span className="text-[10px] font-bold" style={{ color: optMeta.color }}>
                              {optMeta.label}
                            </span>
                          </div>
                        ) : (
                          <span className="text-black/60 dark:text-white/60 font-mono text-[10px]">Headend/Distribution</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-black/70 dark:text-white/70">
                        {node.latitude && node.longitude ? (
                          <span>{parseFloat(node.latitude).toFixed(5)}, {parseFloat(node.longitude).toFixed(5)}</span>
                        ) : (
                          <span className="text-black/40 dark:text-white/40 italic">Belum diset</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedNode(node);
                            setActiveView('map');
                          }}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold transition-colors shadow-sm cursor-pointer"
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

      {/* KML / KMZ Intelligent Importer Modal */}
      <KmlImportModal
        isOpen={kmlImportModal}
        onClose={() => setKmlImportModal(false)}
        onSuccess={() => fetchNodesAndCables(true)}
      />
    </div>
  );
}
