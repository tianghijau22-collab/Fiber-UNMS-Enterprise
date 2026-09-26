import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';
import SearchableSelect from '../components/SearchableSelect';
import { dmsToDecimal, decimalToDms, parseCoordsInput } from '../utils/coordinateParser';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import RefreshButton from '../components/RefreshButton';
import { naturalNodeCompare } from '../utils/naturalSort';
import { toPng } from 'html-to-image';
import KmlImportModal from '../components/KmlImportModal';
import OdcFilterPopover from '../components/OdcFilterPopover';
import OdpFilterPopover from '../components/OdpFilterPopover';

/* ══════════════════════════════════════════════════════════════════
   AUTO CODE GENERATOR HELPERS
══════════════════════════════════════════════════════════════════ */
const generateAutoNodeCode = (nodeType = 'POP', name = '', allNodes = [], parentNode = null) => {
  const typePrefix = (nodeType || 'POP').toUpperCase();
  
  const existingCodes = new Set(
    (allNodes || [])
      .filter(n => n && n.code)
      .map(n => String(n.code).toUpperCase().trim())
  );

  let areaCode = '';
  if (name && name.trim()) {
    const cleanName = name.trim().replace(/^(POP|ODC|ODP)\s+/i, '');
    const words = cleanName.split(/[\s\-_]+/).filter(Boolean);
    if (words.length >= 2) {
      areaCode = words.map(w => w[0]).join('').toUpperCase().slice(0, 4);
    } else if (words.length === 1 && words[0].length >= 3) {
      areaCode = words[0].slice(0, 3).toUpperCase();
    }
  }

  if (!areaCode && parentNode?.code) {
    const parts = parentNode.code.split('-');
    if (parts.length >= 2 && !/^\d+$/.test(parts[1])) {
      areaCode = parts[1];
    }
  }

  const prefix = areaCode ? `${typePrefix}-${areaCode}` : typePrefix;

  let maxNum = 0;
  existingCodes.forEach(code => {
    if (code.startsWith(prefix)) {
      const match = code.replace(prefix, '').match(/\d+/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (num > maxNum) maxNum = num;
      }
    }
  });

  if (maxNum === 0 && !areaCode) {
    const sameTypeCount = (allNodes || []).filter(n => n?.node_type === typePrefix).length;
    maxNum = sameTypeCount;
  }

  let nextNum = maxNum + 1;
  let autoCode = `${prefix}-${String(nextNum).padStart(2, '0')}`;

  while (existingCodes.has(autoCode)) {
    nextNum++;
    autoCode = `${prefix}-${String(nextNum).padStart(2, '0')}`;
  }

  return autoCode;
};

const generateAutoCableCode = (startNode, existingCables = []) => {
  const nodeAbbr = startNode?.code
    ? startNode.code.replace(/^(POP|ODC|ODP|FAT|JC)-/i, '')
    : (startNode?.name ? startNode.name.replace(/[^A-Za-z0-9]/g, '').substring(0, 4).toUpperCase() : 'POP');
  const prefix = `CBL-${nodeAbbr}`;
  
  const existingSet = new Set((existingCables || []).map(c => String(c?.code ?? '').toUpperCase().trim()));
  let count = (existingCables || []).length + 1;
  let code = `${prefix}-${String(count).padStart(2, '0')}`;
  while (existingSet.has(code)) {
    count++;
    code = `${prefix}-${String(count).padStart(2, '0')}`;
  }
  return code;
};

/* ══════════════════════════════════════════════════════════════════
   CONSTANTS & COLOR MAPPING (TIA-598-A Standard Fiber Colors)
══════════════════════════════════════════════════════════════════ */
const COLOR_TRANSLATIONS = {
  Blue: 'Biru',
  Orange: 'Oranye',
  Green: 'Hijau',
  Brown: 'Cokelat',
  Slate: 'Abu-abu',
  Grey: 'Abu-abu',
  Gray: 'Abu-abu',
  White: 'Putih',
  Red: 'Merah',
  Black: 'Hitam',
  Yellow: 'Kuning',
  Violet: 'Ungu',
  Purple: 'Ungu',
  Pink: 'Pink',
  Turquoise: 'Aqua',
  Aqua: 'Aqua',
  Toska: 'Aqua',
};

const getIndonesianColor = (color) => {
  if (!color) return 'Biru';
  const trimmed = String(color).trim();
  const titleCase = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  return COLOR_TRANSLATIONS[trimmed] || COLOR_TRANSLATIONS[titleCase] || trimmed;
};

const FIBER_COLOR_CODES = {
  Biru: { bg: 'bg-blue-600', border: 'border-blue-700', text: 'text-white', hex: '#2563eb', borderHex: '#1d4ed8' },
  Blue: { bg: 'bg-blue-600', border: 'border-blue-700', text: 'text-white', hex: '#2563eb', borderHex: '#1d4ed8' },
  Oranye: { bg: 'bg-orange-500', border: 'border-orange-600', text: 'text-white', hex: '#f97316', borderHex: '#ea580c' },
  Orange: { bg: 'bg-orange-500', border: 'border-orange-600', text: 'text-white', hex: '#f97316', borderHex: '#ea580c' },
  Hijau: { bg: 'bg-emerald-600', border: 'border-emerald-700', text: 'text-white', hex: '#059669', borderHex: '#047857' },
  Green: { bg: 'bg-emerald-600', border: 'border-emerald-700', text: 'text-white', hex: '#059669', borderHex: '#047857' },
  Cokelat: { bg: 'bg-amber-900', border: 'border-amber-950', text: 'text-amber-100', hex: '#78350f', borderHex: '#451a03' },
  Brown: { bg: 'bg-amber-900', border: 'border-amber-950', text: 'text-amber-100', hex: '#78350f', borderHex: '#451a03' },
  'Abu-abu': { bg: 'bg-slate-500', border: 'border-slate-600', text: 'text-white', hex: '#64748b', borderHex: '#475569' },
  Slate: { bg: 'bg-slate-500', border: 'border-slate-600', text: 'text-white', hex: '#64748b', borderHex: '#475569' },
  Grey: { bg: 'bg-slate-500', border: 'border-slate-600', text: 'text-white', hex: '#64748b', borderHex: '#475569' },
  Gray: { bg: 'bg-slate-500', border: 'border-slate-600', text: 'text-white', hex: '#64748b', borderHex: '#475569' },
  Putih: { bg: 'bg-slate-100 dark:bg-slate-700', border: 'border-slate-400', text: 'text-slate-900 dark:text-slate-100', hex: '#f1f5f9', borderHex: '#94a3b8' },
  White: { bg: 'bg-slate-100 dark:bg-slate-700', border: 'border-slate-400', text: 'text-slate-900 dark:text-slate-100', hex: '#f1f5f9', borderHex: '#94a3b8' },
  Merah: { bg: 'bg-red-600', border: 'border-red-700', text: 'text-white', hex: '#dc2626', borderHex: '#b91c1c' },
  Red: { bg: 'bg-red-600', border: 'border-red-700', text: 'text-white', hex: '#dc2626', borderHex: '#b91c1c' },
  Hitam: { bg: 'bg-slate-900 dark:bg-slate-950', border: 'border-slate-950', text: 'text-slate-100', hex: '#0f172a', borderHex: '#020617' },
  Black: { bg: 'bg-slate-900 dark:bg-slate-950', border: 'border-slate-950', text: 'text-slate-100', hex: '#0f172a', borderHex: '#020617' },
  Kuning: { bg: 'bg-yellow-400', border: 'border-yellow-500', text: 'text-slate-900 dark:text-slate-100', hex: '#facc15', borderHex: '#eab308' },
  Yellow: { bg: 'bg-yellow-400', border: 'border-yellow-500', text: 'text-slate-900 dark:text-slate-100', hex: '#facc15', borderHex: '#eab308' },
  Ungu: { bg: 'bg-purple-600', border: 'border-purple-700', text: 'text-white', hex: '#7e22ce', borderHex: '#6b21a8' },
  Violet: { bg: 'bg-purple-600', border: 'border-purple-700', text: 'text-white', hex: '#7e22ce', borderHex: '#6b21a8' },
  Purple: { bg: 'bg-purple-600', border: 'border-purple-700', text: 'text-white', hex: '#7e22ce', borderHex: '#6b21a8' },
  Pink: { bg: 'bg-pink-500', border: 'border-pink-600', text: 'text-white', hex: '#ec4899', borderHex: '#db2777' },
  Aqua: { bg: 'bg-teal-500', border: 'border-teal-600', text: 'text-white', hex: '#0d9488', borderHex: '#0f766e' },
  Toska: { bg: 'bg-teal-500', border: 'border-teal-600', text: 'text-white', hex: '#0d9488', borderHex: '#0f766e' },
  Turquoise: { bg: 'bg-teal-500', border: 'border-teal-600', text: 'text-white', hex: '#0d9488', borderHex: '#0f766e' },
};

const DEST_TYPES = [
  { value: 'UNASSIGNED', label: 'Kosong', icon: '', color: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700' },
  { value: 'ODC', label: 'Power ODC', icon: '', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'BTS', label: 'BTS Tower', icon: '', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  { value: 'CORPORATE', label: 'Corporate', icon: '', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  { value: 'LEASED_FIBER', label: 'Peruntukan lainya', icon: '', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  { value: 'RESERVED', label: 'Cadangan (Reserved)', icon: '', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'DAMAGED', label: 'Rusak / Putus Loss', icon: '', color: 'bg-red-100 text-red-800 border-red-200' },
];

const DEST_TYPE_META = DEST_TYPES.reduce((acc, cur) => ({ ...acc, [cur.value]: cur }), {});

const STATUS_META = {
  active: { label: 'Aktif', dot: 'bg-emerald-500', pill: 'text-emerald-600 dark:text-emerald-400 font-bold' },
  inactive: { label: 'Tidak Aktif', dot: 'bg-slate-400', pill: 'text-black/50 dark:text-white/50 font-bold' },
  maintenance: { label: 'Maintenance', dot: 'bg-amber-500', pill: 'text-amber-600 dark:text-amber-400 font-bold' },
  damaged: { label: 'Rusak', dot: 'bg-rose-600 dark:text-rose-400 font-bold' },
};

const pct = (used, total) => total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
const pctColor = p => p >= 90 ? 'bg-red-500' : p >= 70 ? 'bg-amber-500' : 'bg-emerald-500';

// Module-level helper: format OLT port reference display
const displayInterface = (ref) => {
  if (!ref) return '—';
  return ref.split(',').map(s => {
    const trimmed = s.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('epon') || trimmed.startsWith('epon_')) return trimmed;
    const clean = trimmed.replace(/^(gpon[-_]olt_)/i, '');
    return `gpon-olt_${clean}`;
  }).filter(Boolean).join(', ');
};


/* ══════════════════════════════════════════════════════════════════
   MODAL EDIT CORE
══════════════════════════════════════════════════════════════════ */
function EditCoreModal({ core, cableName, onSave, onClose, loading, allNodes = [] }) {
  const [form, setForm] = useState({
    status: core.status ?? 'available',
    destination_type: core.destination_type ?? 'UNASSIGNED',
    destination_name: core.destination_name ?? '',
    destination_node_id: core.destination_node_id ?? '',
    odf_cassette_label: core.odf_cassette_label ?? '',
    notes: core.notes ?? '',
  });

  const colorMeta = FIBER_COLOR_CODES[getIndonesianColor(core.color)] ?? FIBER_COLOR_CODES[core.color] ?? FIBER_COLOR_CODES.Biru;

  const set = (k, v) => setForm(f => {
    const updated = { ...f, [k]: v };
    if (k === 'destination_type') {
      if (v === 'UNASSIGNED') {
        updated.status = 'available';
        updated.destination_name = '';
        updated.destination_node_id = '';
      } else if (v === 'RESERVED') {
        updated.status = 'reserved';
      } else if (v === 'DAMAGED') {
        updated.status = 'damaged';
      } else {
        updated.status = 'used';
      }
    }
    return updated;
  });

  const handleSubmit = e => { e.preventDefault(); onSave(form); };

  const fc = 'w-full px-3 py-2 bg-white dark:bg-black border border-black/30 dark:border-white/30 rounded-md text-xs sm:text-sm text-black dark:text-white placeholder-black/40 dark:placeholder-white/40 focus:outline-none focus:border-black dark:focus:border-white transition-all font-medium';
  const lc = 'block text-xs font-bold text-black dark:text-white uppercase tracking-wide mb-1.5';

  return createPortal(
    <div className="fixed inset-0 z-[99999] overflow-y-auto bg-black/60 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen">
      <div className="relative w-full max-w-lg bg-white dark:bg-black rounded-lg sm:rounded-xl shadow-2xl border border-black/70 dark:border-white/70 my-auto max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
        <div className="bg-white dark:bg-black text-black dark:text-white px-5 py-4 flex items-center justify-between flex-shrink-0 border-b border-black/20 dark:border-white/20">
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-md flex items-center justify-center font-bold text-xs border ${colorMeta.bg} ${colorMeta.border} ${colorMeta.text}`}
              style={{ backgroundColor: colorMeta.hex, borderColor: colorMeta.borderHex }}
            >
              {core.core_number}
            </div>
            <div>
              <h3 className="text-base font-bold text-black dark:text-white">Core #{core.core_number} — {getIndonesianColor(core.color)}</h3>
              <p className="text-xs text-black/70 dark:text-white/70">Tube {core.tube_number} ({getIndonesianColor(core.tube_color)}) · {cableName}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white font-bold transition-colors cursor-pointer">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">

          <div>
            <label className={lc}>Kategori Peruntukan Core *</label>
            <select value={form.destination_type} onChange={e => set('destination_type', e.target.value)} className={fc}>
              {DEST_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {form.destination_type !== 'UNASSIGNED' && (
            <div>
              <label className={lc}>Nama Label Peruntukan Core *</label>
              <input
                required
                value={form.destination_name}
                onChange={e => set('destination_name', e.target.value)}
                placeholder="misal: ODC 10 / ODP-A01 Kebayoran"
                className={fc}
              />
            </div>
          )}

          <div>
            <label className={lc}>Posisi Kaset Tube / Port Core</label>
            <input
              value={form.odf_cassette_label}
              onChange={e => set('odf_cassette_label', e.target.value)}
              placeholder="misal: Tube-Biru / Core-Biru "
              className={`${fc} font-mono`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lc}>Status Core</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className={fc}>
                <option value="available"> Kosong</option>
                <option value="used"> Terpakai</option>
                <option value="reserved"> Cadangan</option>
                <option value="damaged"> Rusak</option>
              </select>
            </div>
            <div>
              <label className={lc}>Warna Standard</label>
              <div className="flex items-center gap-2 px-3 py-2 bg-black/5 dark:bg-white/5 border border-black/20 dark:border-white/20 rounded-md text-xs font-semibold text-black dark:text-white">
                <span
                  className={`w-3.5 h-3.5 rounded-full border ${colorMeta.bg} ${colorMeta.border}`}
                  style={{ backgroundColor: colorMeta.hex, borderColor: colorMeta.borderHex }}
                />
                <span>{core.color} (Tube {core.tube_number})</span>
              </div>
            </div>
          </div>

          <div>
            <label className={lc}>Catatan Tambahan</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Contoh : Power ODC 01 / BTS GUGUAK"
              className={`${fc} resize-none`}
            />
          </div>

          <div className="flex gap-3 pt-3 border-t border-black/20 dark:border-white/20 flex-shrink-0">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-md border border-black/30 dark:border-white/30 text-xs font-bold text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
              Batal
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 transition-all">
              {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              Simpan
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

/* ══════════════════════════════════════════════════════════════════
   INTERACTIVE MULTI-SELECT DROPDOWN COMPONENTS FOR NETWORK INFRASTRUCTURE
══════════════════════════════════════════════════════════════════ */
const FIBER_COLORS = [
  { name: 'Biru', hex: '#2563eb' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Hijau', hex: '#16a34a' },
  { name: 'Coklat', hex: '#78350f' },
  { name: 'Abu', hex: '#64748b' },
  { name: 'Putih', hex: '#f8fafc' },
  { name: 'Merah', hex: '#dc2626' },
  { name: 'Hitam', hex: '#0f172a' },
  { name: 'Kuning', hex: '#eab308' },
  { name: 'Ungu', hex: '#9333ea' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Aqua', hex: '#06b6d4' },
];

const STANDARD_TUBES = [
  { label: 'Tube 1 (Biru)', color: 'Biru', hex: '#2563eb' },
  { label: 'Tube 2 (Orange)', color: 'Orange', hex: '#f97316' },
  { label: 'Tube 3 (Hijau)', color: 'Hijau', hex: '#16a34a' },
  { label: 'Tube 4 (Coklat)', color: 'Coklat', hex: '#78350f' },
  { label: 'Tube 5 (Abu)', color: 'Abu', hex: '#64748b' },
  { label: 'Tube 6 (Putih)', color: 'Putih', hex: '#f8fafc' },
  { label: 'Tube 7 (Merah)', color: 'Merah', hex: '#dc2626' },
  { label: 'Tube 8 (Hitam)', color: 'Hitam', hex: '#0f172a' },
  { label: 'Tube 9 (Kuning)', color: 'Kuning', hex: '#eab308' },
  { label: 'Tube 10 (Ungu)', color: 'Ungu', hex: '#9333ea' },
  { label: 'Tube 11 (Pink)', color: 'Pink', hex: '#ec4899' },
  { label: 'Tube 12 (Aqua)', color: 'Aqua', hex: '#06b6d4' },
];

function MultiOltPortSelector({ value, onChange, selectedOlt }) {
  const [isOpen, setIsOpen] = useState(false);
  const [portSearch, setPortSearch] = useState('');
  const dropdownRef = useRef(null);

  const selectedPorts = useMemo(() => {
    if (!value) return [];
    return value.split(',').map(s => s.trim().replace(/^gpon-olt_/i, '').replace(/^gpon_olt_/i, '').replace(/^epon-olt_/i, '')).filter(Boolean);
  }, [value]);

  // Ambil daftar port riil dari snapshot OLT
  const realPonPorts = useMemo(() => {
    if (!selectedOlt) return [];
    if (selectedOlt.pon_ports && Array.isArray(selectedOlt.pon_ports) && selectedOlt.pon_ports.length > 0) {
      return selectedOlt.pon_ports;
    }
    if (selectedOlt.last_telemetry_snapshot?.pon_ports && Array.isArray(selectedOlt.last_telemetry_snapshot.pon_ports) && selectedOlt.last_telemetry_snapshot.pon_ports.length > 0) {
      return selectedOlt.last_telemetry_snapshot.pon_ports;
    }
    return [];
  }, [selectedOlt]);

  // Deteksi arsitektur OLT: Compact/Fixed Port vs Modular Chassis
  const isCompactOlt = useMemo(() => {
    if (!selectedOlt) return false;
    const vendor = (selectedOlt.vendor || selectedOlt.vendor_key || selectedOlt.model || selectedOlt.name || '').toUpperCase();
    const ports = selectedOlt.real_total_ports || selectedOlt.total_ports || (realPonPorts.length > 0 ? realPonPorts.length : 4);

    if (vendor.includes('C300') || vendor.includes('C320') || vendor.includes('MA5680') || vendor.includes('MA5608') || vendor.includes('MODULAR')) {
      return false;
    }
    if (realPonPorts.length > 0) {
      const hasSlotFormat = realPonPorts.some(p => /1\/\d+\/\d+/.test(p.port_id || ''));
      if (hasSlotFormat) return false;
    }
    return vendor.includes('HSGQ') || vendor.includes('EPON') || (ports <= 8 && !vendor.includes('ZTE') && !vendor.includes('HUAWEI'));
  }, [selectedOlt, realPonPorts]);

  // Ambil daftar port untuk OLT Compact
  const compactPorts = useMemo(() => {
    if (!selectedOlt) return [];

    if (realPonPorts.length > 0 && isCompactOlt) {
      return realPonPorts.map(p => ({
        id: p.port_id,
        label: p.port_id,
        status: p.status || 'Up',
        onuCount: p.registered_onus || p.online_onus || 0,
      }));
    }

    const totalPorts = selectedOlt.real_total_ports || selectedOlt.total_ports || 4;
    const vendor = (selectedOlt.vendor || selectedOlt.vendor_key || selectedOlt.name || '').toUpperCase();
    const prefix = vendor.includes('HSGQ') || vendor.includes('EPON') ? 'epon_0/' : 'gpon_0/';

    const list = [];
    for (let i = 1; i <= totalPorts; i++) {
      list.push({
        id: `${prefix}${i}`,
        label: `${prefix}${i}`,
        status: 'Up',
        onuCount: 0,
      });
    }
    return list;
  }, [selectedOlt, realPonPorts, isCompactOlt]);

  // Ekstrak slot-slot riil atau fallback untuk OLT Modular
  const slots = useMemo(() => {
    if (!selectedOlt) return [{ id: 1, name: 'Slot 1', portCount: 16, ports: [] }];

    // 1. Jika ada data port riil di telemetri, kelompokkan berdasarkan slot fisik yang benar-benar ada
    if (realPonPorts.length > 0) {
      const slotMap = {};
      realPonPorts.forEach(p => {
        const pid = p.port_id || '';
        const match = pid.match(/(?:gpon-olt_|epon-olt_|epon_)?1\/(\d+)\/(\d+)/i);
        if (match) {
          const slotNum = parseInt(match[1], 10);
          if (!slotMap[slotNum]) {
            slotMap[slotNum] = [];
          }
          slotMap[slotNum].push(p);
        }
      });

      const slotKeys = Object.keys(slotMap).map(Number).sort((a, b) => a - b);
      if (slotKeys.length > 0) {
        return slotKeys.map(slotNum => ({
          id: slotNum,
          name: `Slot ${slotNum}`,
          portCount: slotMap[slotNum].length,
          ports: slotMap[slotNum],
        }));
      }
    }

    // 2. Fallback berdasarkan model jika belum ada telemetri
    const vendor = (selectedOlt.vendor || selectedOlt.model || selectedOlt.name || '').toUpperCase();
    let max = 4;
    if (vendor.includes('C300') || vendor.includes('MA5680')) max = 16;
    else if (vendor.includes('C320') || vendor.includes('MA5608')) max = 4;
    else max = Math.max(1, Math.ceil((selectedOlt.total_ports || 16) / 16));

    const list = [];
    for (let i = 1; i <= max; i++) {
      list.push({ id: i, name: `Slot ${i}`, portCount: 16, ports: [] });
    }
    return list;
  }, [selectedOlt, realPonPorts]);

  const [activeSlot, setActiveSlot] = useState(1);

  // Set activeSlot default ke slot pertama yang tersedia
  useEffect(() => {
    if (slots.length > 0) {
      const slotExists = slots.some(s => s.id === activeSlot);
      if (!slotExists) {
        setActiveSlot(slots[0].id);
      }
    }
  }, [slots, activeSlot]);

  // Daftar port dalam slot aktif untuk OLT Modular
  const portsInActiveSlot = useMemo(() => {
    const activeSlotObj = slots.find(s => s.id === activeSlot);
    if (activeSlotObj?.ports && activeSlotObj.ports.length > 0) {
      return activeSlotObj.ports.map((p, idx) => {
        const pid = p.port_id || '';
        const cleanId = pid.replace(/^gpon-olt_|^epon-olt_/i, '');
        const pNumMatch = cleanId.match(/1\/\d+\/(\d+)/);
        const pNum = pNumMatch ? pNumMatch[1] : (idx + 1);
        return {
          id: cleanId,
          fullRef: pid,
          label: `Port ${String(pNum).padStart(2, '0')}`,
          shortLabel: `P${pNum}`,
          status: p.status || 'Up',
          onuCount: p.registered_onus || p.online_onus || 0,
        };
      });
    }

    // Fallback: 16 port per slot
    const list = [];
    const count = activeSlotObj?.portCount || 16;
    for (let i = 1; i <= count; i++) {
      list.push({
        id: `1/${activeSlot}/${i}`,
        fullRef: `gpon-olt_1/${activeSlot}/${i}`,
        label: `Port ${String(i).padStart(2, '0')}`,
        shortLabel: `P${i}`,
        status: 'Up',
        onuCount: 0,
      });
    }
    return list;
  }, [activeSlot, slots]);

  // Filter port berdasarkan pencarian
  const filteredCompactPorts = useMemo(() => {
    if (!portSearch.trim()) return compactPorts;
    const q = portSearch.toLowerCase();
    return compactPorts.filter(p => p.label.toLowerCase().includes(q));
  }, [compactPorts, portSearch]);

  const filteredModularPorts = useMemo(() => {
    if (!portSearch.trim()) return portsInActiveSlot;
    const q = portSearch.toLowerCase();
    return portsInActiveSlot.filter(p => p.id.toLowerCase().includes(q) || p.label.toLowerCase().includes(q));
  }, [portsInActiveSlot, portSearch]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const togglePort = (portId) => {
    let updated;
    if (selectedPorts.includes(portId)) {
      updated = selectedPorts.filter(p => p !== portId);
    } else {
      updated = [...selectedPorts, portId];
    }
    onChange(updated.join(', '));
  };

  const selectAllSlot = () => {
    const toAdd = portsInActiveSlot.map(p => p.id).filter(id => !selectedPorts.includes(id));
    onChange([...selectedPorts, ...toAdd].join(', '));
  };

  const clearSlot = () => {
    const slotIds = portsInActiveSlot.map(p => p.id);
    const updated = selectedPorts.filter(id => !slotIds.includes(id));
    onChange(updated.join(', '));
  };

  const selectAllCompact = () => {
    const allIds = compactPorts.map(p => p.id);
    onChange(allIds.join(', '));
  };

  const clearAll = () => {
    onChange('');
  };

  const removePort = (portToRemove) => {
    const updated = selectedPorts.filter(p => p !== portToRemove);
    onChange(updated.join(', '));
  };

  return (
    <div className="relative space-y-1" ref={dropdownRef}>
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-black dark:text-white uppercase tracking-wide">
          INTERFACE PORT OLT
        </label>
        {selectedOlt && (
          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/70 px-2 py-0.5 rounded border border-indigo-300 dark:border-indigo-800">
            {selectedOlt.name} ({selectedOlt.vendor || 'OLT'})
          </span>
        )}
      </div>

      {/* Input Trigger Box */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="min-h-[40px] p-2 bg-white dark:bg-black border border-black/30 dark:border-white/30 rounded-md cursor-pointer flex items-center justify-between gap-2 flex-wrap hover:border-black dark:hover:border-white transition-all shadow-xs"
      >
        <div className="flex items-center gap-1.5 flex-wrap min-h-[26px]">
          {selectedPorts.length > 0 ? (
            selectedPorts.map(port => (
              <span
                key={port}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800"
              >
                <span>{port}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removePort(port); }}
                  className="w-3.5 h-3.5 rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-800 flex items-center justify-center text-[10px] text-indigo-600 dark:text-indigo-400 hover:text-rose-500 font-extrabold transition-colors"
                >
                  ✕
                </button>
              </span>
            ))
          ) : (
            <span className="text-xs text-black/40 dark:text-white/40 px-1 font-medium">
              — Klik untuk memilih Interface Port OLT —
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 text-xs text-black/50 dark:text-white/50 font-bold px-1">
          {selectedPorts.length > 0 && (
            <span className="text-[10px] bg-indigo-600 text-white font-extrabold px-1.5 py-0.5 rounded">
              {selectedPorts.length} Port
            </span>
          )}
          <span className="text-[10px]">{isOpen ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Dropdown Floating Panel */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 sm:left-auto sm:right-0 sm:min-w-[420px] max-w-[500px] mt-1 bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg shadow-2xl p-4 space-y-3 animate-in fade-in zoom-in-95 duration-100 text-black dark:text-white">
          {/* Header Panel */}
          <div className="flex items-center justify-between pb-2.5 border-b border-black/15 dark:border-white/15">
            <div>
              <h5 className="font-bold text-xs text-black dark:text-white">
                Pilih Interface ({isCompactOlt ? `${compactPorts.length} Port PON` : `Modular ${slots.length} Slot Card`})
              </h5>
              <p className="text-[10px] text-black/60 dark:text-white/60">
                {selectedOlt ? `${selectedOlt.name} • ${selectedOlt.model || selectedOlt.vendor}` : 'Pilih interface yang mengarah ke ODC/ODP'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isCompactOlt ? (
                <button
                  type="button"
                  onClick={selectAllCompact}
                  className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Pilih Semua
                </button>
              ) : (
                <button
                  type="button"
                  onClick={selectAllSlot}
                  className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Pilih All Slot {activeSlot}
                </button>
              )}
              <span className="text-black/20 dark:text-white/20">|</span>
              <button
                type="button"
                onClick={clearAll}
                className="text-[11px] font-bold text-rose-500 hover:underline cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Quick Search */}
          <div>
            <input
              type="text"
              placeholder="Cari interface (contoh: 1, epon, 1/1/4)..."
              value={portSearch}
              onChange={e => setPortSearch(e.target.value)}
              className="w-full px-3 py-1.5 bg-white dark:bg-black border border-black/30 dark:border-white/30 rounded-md text-xs text-black dark:text-white placeholder-black/40 dark:placeholder-white/40 focus:outline-none focus:border-black dark:focus:border-white font-mono"
            />
          </div>

          {isCompactOlt ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {filteredCompactPorts.map(p => {
                  const isSelected = selectedPorts.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePort(p.id)}
                      className={`p-2.5 rounded-md border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white dark:bg-black border-black/20 dark:border-white/20 text-black dark:text-white hover:border-black dark:hover:border-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500'}`} />
                        <span className="font-mono text-xs font-bold tracking-tight">{p.label}</span>
                      </div>
                      <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'text-emerald-600 dark:text-emerald-400 font-bold'
                      }`}>
                        {isSelected ? '✓ Aktif' : p.status}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Slot / Card Tab Switcher */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-black/70 dark:text-white/70 uppercase tracking-wider block">
                  Pilih Slot Card ({slots.length} Slot Chassis):
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 bg-black/5 dark:bg-white/5 p-1.5 rounded-md border border-black/20 dark:border-white/20">
                  {slots.map(s => {
                    const countInSlot = selectedPorts.filter(p => p.startsWith(`1/${s.id}/`)).length;
                    const isActive = activeSlot === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setActiveSlot(s.id)}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                          isActive
                            ? 'bg-black text-white dark:bg-white dark:text-black shadow-xs'
                            : 'text-black dark:text-white hover:bg-black/10 dark:hover:bg-white/10'
                        }`}
                      >
                        <span>Slot {s.id}</span>
                        {s.portCount ? (
                          <span className="text-[9px] opacity-60">({s.portCount}P)</span>
                        ) : null}
                        {countInSlot > 0 && (
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full ${
                            isActive ? 'bg-white text-black dark:bg-black dark:text-white' : 'bg-blue-600 text-white'
                          }`}>
                            {countInSlot}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Port Grid in Active Slot */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-black dark:text-white text-[11px]">
                    {filteredModularPorts.length} Port PON Slot {activeSlot} (Card 1/{activeSlot}/*):
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllSlot}
                      className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Pilih Semua
                    </button>
                    <span className="text-black/20 dark:text-white/20">|</span>
                    <button
                      type="button"
                      onClick={clearSlot}
                      className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer"
                    >
                      Hapus
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                  {filteredModularPorts.map(p => {
                    const isSelected = selectedPorts.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePort(p.id)}
                        className={`p-2 rounded-md border text-xs font-mono font-bold transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                            : 'bg-white dark:bg-black border-black/20 dark:border-white/20 text-black dark:text-white hover:border-black dark:hover:border-white'
                        }`}
                      >
                        <span>{p.shortLabel}</span>
                        <span className={`text-[9px] px-1 py-0.5 rounded ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-black/5 dark:bg-white/10 text-black/70 dark:text-white/70'
                        }`}>
                          {p.id}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Footer Info */}
          <div className="pt-2 border-t border-black/15 dark:border-white/15 flex items-center justify-between text-[11px] text-black/60 dark:text-white/60">
            <span>Terpilih: <strong className="text-indigo-600 dark:text-indigo-400">{selectedPorts.length} Interface</strong></span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 rounded-md bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Selesai
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MultiColorSelector({ value, onChange, label, placeholder, helpText }) {
  const [isOpen, setIsOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const dropdownRef = useRef(null);

  const selectedItems = useMemo(() => {
    if (!value) return [];
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleColor = (colorName) => {
    let updated;
    if (selectedItems.includes(colorName)) {
      updated = selectedItems.filter(c => c !== colorName);
    } else {
      updated = [...selectedItems, colorName];
    }
    onChange(updated.join(', '));
  };

  const handleAddCustom = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = customInput.trim();
      if (val && !selectedItems.includes(val)) {
        onChange([...selectedItems, val].join(', '));
        setCustomInput('');
      }
    }
  };

  const removeItem = (itemToRemove) => {
    const updated = selectedItems.filter(i => i !== itemToRemove);
    onChange(updated.join(', '));
  };

  return (
    <div className="relative space-y-1" ref={dropdownRef}>
      <label className="block text-xs font-semibold text-black dark:text-white uppercase tracking-wide">
        {label}
      </label>

      <div
        onClick={() => setIsOpen(!isOpen)}
        className="min-h-[40px] p-2 bg-white dark:bg-black border border-black/30 dark:border-white/30 rounded-md cursor-pointer flex items-center justify-between gap-2 flex-wrap hover:border-black dark:hover:border-white transition-all shadow-xs"
      >
        <div className="flex items-center gap-1.5 flex-wrap min-h-[26px]">
          {selectedItems.length > 0 && selectedItems.map(item => {
            const matchedColor = FIBER_COLORS.find(c => c.name.toLowerCase() === item.toLowerCase());
            return (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold bg-black/5 dark:bg-white/10 text-black dark:text-white border border-black/20 dark:border-white/20"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10"
                  style={{ backgroundColor: matchedColor ? matchedColor.hex : '#94a3b8' }}
                />
                <span>{item}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeItem(item); }}
                  className="hover:text-red-500 font-extrabold text-[11px] leading-none ml-0.5"
                >
                  ✕
                </button>
              </span>
            );
          })}
        </div>
        <span className="text-xs text-black/50 dark:text-white/50 font-bold px-1">
          {isOpen ? '▲' : '▼'}
        </span>
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg shadow-xl p-3 space-y-3 animate-in fade-in zoom-in-95 duration-100 text-black dark:text-white">
          <div className="text-[11px] font-bold text-black/70 dark:text-white/70 uppercase tracking-wider flex justify-between items-center">
            <span>Pilihan Warna Core (12 Telecom Standard)</span>
            <span className="text-[10px] font-normal text-indigo-600 dark:text-indigo-400">Multi-Pilih</span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-44 overflow-y-auto pr-1">
            {FIBER_COLORS.map(c => {
              const isSelected = selectedItems.includes(c.name);
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => toggleColor(c.name)}
                  className={`px-2 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all border cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 border-blue-600 text-white font-bold'
                      : 'bg-white dark:bg-black text-black dark:text-white border-black/20 dark:border-white/20 hover:border-black dark:hover:border-white'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10" style={{ backgroundColor: c.hex }} />
                  <span className="truncate">{c.name}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-black/15 dark:border-white/15">
            <input
              type="text"
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={handleAddCustom}
              placeholder="Masukan detail / daya kustom (cth: +2.5 dBm) tekan Enter..."
              className="w-full px-3 py-1.5 bg-white dark:bg-black border border-black/30 dark:border-white/30 rounded-md text-xs text-black dark:text-white placeholder-black/40 dark:placeholder-white/40 focus:outline-none focus:border-black dark:focus:border-white"
            />
          </div>
        </div>
      )}
      {helpText && <p className="text-[10px] text-black/60 dark:text-white/60">{helpText}</p>}
    </div>
  );
}

function MultiTubeSelector({ value, onChange, label, placeholder, helpText }) {
  const [isOpen, setIsOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const dropdownRef = useRef(null);

  const selectedItems = useMemo(() => {
    if (!value) return [];
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleTube = (tubeLabel) => {
    let updated;
    if (selectedItems.includes(tubeLabel)) {
      updated = selectedItems.filter(t => t !== tubeLabel);
    } else {
      updated = [...selectedItems, tubeLabel];
    }
    onChange(updated.join(', '));
  };

  const handleAddCustom = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = customInput.trim();
      if (val && !selectedItems.includes(val)) {
        onChange([...selectedItems, val].join(', '));
        setCustomInput('');
      }
    }
  };

  const removeItem = (itemToRemove) => {
    const updated = selectedItems.filter(i => i !== itemToRemove);
    onChange(updated.join(', '));
  };

  return (
    <div className="relative space-y-1" ref={dropdownRef}>
      <label className="block text-xs font-semibold text-black dark:text-white uppercase tracking-wide">
        {label}
      </label>

      <div
        onClick={() => setIsOpen(!isOpen)}
        className="min-h-[40px] p-2 bg-white dark:bg-black border border-black/30 dark:border-white/30 rounded-md cursor-pointer flex items-center justify-between gap-2 flex-wrap hover:border-black dark:hover:border-white transition-all shadow-xs"
      >
        <div className="flex items-center gap-1.5 flex-wrap min-h-[26px]">
          {selectedItems.length > 0 && selectedItems.map(item => {
            const matchedTube = STANDARD_TUBES.find(t => t.label.toLowerCase() === item.toLowerCase());
            return (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold bg-black/5 dark:bg-white/10 text-black dark:text-white border border-black/20 dark:border-white/20"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10"
                  style={{ backgroundColor: matchedTube ? matchedTube.hex : '#3b82f6' }}
                />
                <span>{item}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeItem(item); }}
                  className="hover:text-red-500 font-extrabold text-[11px] leading-none ml-0.5"
                >
                  ✕
                </button>
              </span>
            );
          })}
        </div>
        <span className="text-xs text-black/50 dark:text-white/50 font-bold px-1">
          {isOpen ? '▲' : '▼'}
        </span>
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg shadow-xl p-3 space-y-3 animate-in fade-in zoom-in-95 duration-100 text-black dark:text-white">
          <div className="text-[11px] font-bold text-black/70 dark:text-white/70 uppercase tracking-wider flex justify-between items-center">
            <span>Daftar Tube Fiber (Warna &amp; Detail)</span>
            <span className="text-[10px] font-normal text-indigo-600 dark:text-indigo-400">Multi-Pilih</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto pr-1">
            {STANDARD_TUBES.map(t => {
              const isSelected = selectedItems.includes(t.label);
              return (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => toggleTube(t.label)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all border cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 border-blue-600 text-white font-bold'
                      : 'bg-white dark:bg-black text-black dark:text-white border-black/20 dark:border-white/20 hover:border-black dark:hover:border-white'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10" style={{ backgroundColor: t.hex }} />
                  <span className="truncate text-[11px]">{t.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-black/15 dark:border-white/15">
            <input
              type="text"
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={handleAddCustom}
              placeholder="Masukan tube kustom (cth: Tube Special A) tekan Enter..."
              className="w-full px-3 py-1.5 bg-white dark:bg-black border border-black/30 dark:border-white/30 rounded-md text-xs text-black dark:text-white placeholder-black/40 dark:placeholder-white/40 focus:outline-none focus:border-black dark:focus:border-white"
            />
          </div>
        </div>
      )}
      {helpText && <p className="text-[10px] text-black/60 dark:text-white/60">{helpText}</p>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MODAL ADD/EDIT NODE (POP / ODC / ODP)
══════════════════════════════════════════════════════════════════ */
function AddNodeModal({ type, editNode, parentNode, allNodes, splitterTypes, oltDevices, onSave, onClose, loading, error, isMsCreation }) {
  // Clean up port ref for easy editing (convert gpon-olt_1/1/1 -> 1/1/1)
  const initialPortRef = editNode?.olt_port_ref
    ? editNode.olt_port_ref.split(',').map(s => s.trim().replace(/^gpon-olt_/i, '')).join(', ')
    : '';

  // Parse initial power & distribution splitter configs from editNode.splitter_config
  const parseInitialSplitters = (splitterConfig) => {
    let pCount = 0, pRatio = '', dCount = 0, dRatio = '';
    if (Array.isArray(splitterConfig)) {
      splitterConfig.forEach(item => {
        if (/^power[:|]/i.test(item)) {
          pCount++;
          if (!pRatio) pRatio = item.replace(/^power[:|]/i, '').trim();
        } else if (/^dist[:|]/i.test(item)) {
          dCount++;
          if (!dRatio) dRatio = item.replace(/^dist[:|]/i, '').trim();
        } else {
          dCount++;
          if (!dRatio) dRatio = item.trim();
        }
      });
    }
    return { pCount, pRatio, dCount, dRatio };
  };

  const initialSplitters = parseInitialSplitters(editNode?.splitter_config);

  const getInitialOdpCount = () => {
    if (editNode?.node_type !== 'ODP') return '';
    if (editNode?.splitter_count) return editNode.splitter_count;
    if (Array.isArray(editNode?.splitter_config) && editNode.splitter_config.length > 0) return editNode.splitter_config.length;
    return 1;
  };

  const getInitialOdpRatio = () => {
    if (editNode?.node_type !== 'ODP') return '';
    if (Array.isArray(editNode?.splitter_config) && editNode.splitter_config.length > 0) {
      return editNode.splitter_config[0].replace(/^(POWER|DIST):/i, '');
    }
    if (editNode?.splitter_type?.ratio) return editNode.splitter_type.ratio;
    if (editNode?.total_ports) return `1:${editNode.total_ports}`;
    return '1:8';
  };

  const initialDms = decimalToDms(editNode?.latitude, editNode?.longitude);

  const initialCode = editNode?.code
    ? editNode.code
    : generateAutoNodeCode(type || 'POP', editNode?.name || '', allNodes, parentNode);

  // Jika membuat ODP/MS, default parent_node_id ke POP pertama jika ada
  const defaultParentId = editNode?.parent_node_id 
    ?? parentNode?.id 
    ?? (isMsCreation ? (allNodes.find(n => n.node_type === 'POP')?.id ?? '') : '');

  const [form, setForm] = useState({
    name: editNode?.name ?? '',
    code: initialCode,
    node_type: editNode?.node_type ?? type ?? 'POP',
    model: editNode?.model ?? '',
    status: editNode?.status ?? 'active',
    address: editNode?.address ?? '',
    latitude: editNode?.latitude ?? '',
    longitude: editNode?.longitude ?? '',
    coords_input: editNode?.latitude && editNode?.longitude
      ? `${editNode.latitude}, ${editNode.longitude}`
      : '',
    lat_dms: initialDms.dmsLat,
    lng_dms: initialDms.dmsLng,
    coord_mode: 'dms', // 'dms' | 'decimal'
    total_ports: editNode?.total_ports ?? (type === 'ODP' ? 8 : type === 'ODC' ? 0 : 16),
    used_ports: editNode?.used_ports ?? 0,
    olt_port_ref: initialPortRef,
    olt_device_id: editNode?.olt_device_id ?? '',
    parent_node_id: defaultParentId,
    core_power: editNode?.core_power ?? '',
    core_color: editNode?.core_color ?? '',
    tube_info: editNode?.tube_info ?? '',
    odc_topology_type: editNode?.odc_topology_type ?? 'tunggal',
    power_count: initialSplitters.pCount || '',
    power_ratio: initialSplitters.pRatio || '',
    dist_count: initialSplitters.dCount || '',
    dist_ratio: initialSplitters.dRatio || '',
    // ODP splitter (single type)
    odp_splitter_count: getInitialOdpCount(),
    odp_splitter_ratio: getInitialOdpRatio(),
  });

  const isEdit = !!editNode;
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Auto-regenerate code if node_type or name changes when creating a new node
  const handleNodeTypeChange = (newType) => {
    setForm(f => {
      const isAuto = !isEdit && (!f.code || f.code.startsWith(f.node_type));
      const autoCode = isAuto ? generateAutoNodeCode(newType, f.name, allNodes, parentNode) : f.code;
      return { ...f, node_type: newType, code: autoCode };
    });
  };

  const handleNameChange = (newName) => {
    setForm(f => {
      const isAuto = !isEdit && (!f.code || f.code.startsWith(f.node_type));
      const autoCode = isAuto ? generateAutoNodeCode(f.node_type, newName, allNodes, parentNode) : f.code;
      return { ...f, name: newName, code: autoCode };
    });
  };

  // Helper: parse output ports from a ratio string like '1:8' -> 8
  const parseRatioOutput = (ratio) => {
    const m = ratio?.match(/\d+:(\d+)/);
    return m ? parseInt(m[1]) : 0;
  };

  const calcPowerPorts = (parseInt(form.power_count) || 0) * parseRatioOutput(form.power_ratio);
  const calcDistPorts = (parseInt(form.dist_count) || 0) * parseRatioOutput(form.dist_ratio);
  const totalCalc = calcPowerPorts + calcDistPorts;

  const handleSubmit = e => {
    e.preventDefault();
    // Parse DMS Google Earth atau Desimal Google Maps
    let lat = form.latitude;
    let lng = form.longitude;

    if (form.coord_mode === 'dms') {
      const parsed = parseCoordsInput(form.lat_dms, form.lng_dms);
      if (parsed.isValid) {
        lat = parsed.lat;
        lng = parsed.lng;
      }
    } else if (form.coords_input && form.coords_input.trim()) {
      const parsed = parseCoordsInput(form.coords_input);
      if (parsed.isValid) {
        lat = parsed.lat;
        lng = parsed.lng;
      }
    }

    const formattedPortRef = form.olt_port_ref
      ? form.olt_port_ref.split(',').map(p => {
        const trimmed = p.trim();
        if (!trimmed) return '';
        if (/^\d+\/\d+\/\d+$/.test(trimmed)) return `gpon-olt_${trimmed}`;
        return trimmed;
      }).filter(Boolean).join(', ')
      : '';

    let splitterConfigArray = [];
    let splitterCount = 0;
    let computedTotalPorts = form.total_ports;

    if (form.node_type === 'ODP') {
      // ODP: splitter tunggal
      const cnt = parseInt(form.odp_splitter_count) || 0;
      if (cnt > 0 && form.odp_splitter_ratio) {
        for (let i = 0; i < cnt; i++) splitterConfigArray.push(form.odp_splitter_ratio);
        splitterCount = cnt;
        const match = form.odp_splitter_ratio.match(/\d+:(\d+)/);
        computedTotalPorts = cnt * (match ? parseInt(match[1]) : 0) || form.total_ports;
      }
    } else {
      // ODC: dual splitter Power + Distribusi
      const pCount = parseInt(form.power_count) || 0;
      if (pCount > 0 && form.power_ratio) {
        for (let i = 0; i < pCount; i++) splitterConfigArray.push(`POWER:${form.power_ratio}`);
      }
      const dCount = parseInt(form.dist_count) || 0;
      if (dCount > 0 && form.dist_ratio) {
        for (let i = 0; i < dCount; i++) splitterConfigArray.push(`DIST:${form.dist_ratio}`);
      }
      splitterCount = pCount + dCount;
      computedTotalPorts = totalCalc > 0 ? totalCalc : form.total_ports;
    }

    const autoCode = form.code || generateAutoNodeCode(form.node_type, form.name, allNodes, parentNode);

    const payload = {
      ...form,
      code: autoCode,
      olt_port_ref: formattedPortRef,
      splitter_config: splitterConfigArray.length > 0 ? splitterConfigArray : null,
      splitter_count: splitterCount,
      total_ports: computedTotalPorts,
      latitude: lat || null,
      longitude: lng || null,
    };

    delete payload.power_count;
    delete payload.power_ratio;
    delete payload.dist_count;
    delete payload.dist_ratio;
    delete payload.coords_input;
    delete payload.lat_dms;
    delete payload.lng_dms;
    delete payload.coord_mode;
    delete payload.odp_splitter_count;
        delete payload.odp_splitter_count;
    delete payload.odp_splitter_ratio;

    onSave(payload);
  };

  const fc = 'w-full px-3 py-2 bg-white dark:bg-black border border-black/30 dark:border-white/30 rounded-md text-xs sm:text-sm text-black dark:text-white placeholder-black/40 dark:placeholder-white/40 focus:outline-none focus:border-black dark:focus:border-white transition-all font-medium';
  const lc = 'block text-xs font-bold text-black dark:text-white uppercase tracking-wide mb-1.5';

  return createPortal(
    <div className="fixed inset-0 z-[99999] overflow-y-auto bg-black/60 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen">
      <div className="relative w-full max-w-2xl bg-white dark:bg-black rounded-lg sm:rounded-xl shadow-2xl border border-black/70 dark:border-white/70 my-auto max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150 text-black dark:text-white">
        
        {/* Pinned Header */}
        <div className="bg-white dark:bg-black text-black dark:text-white px-5 py-4 flex items-center justify-between flex-shrink-0 border-b border-black/20 dark:border-white/20">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-black dark:text-white">
              {isEdit ? 'Edit Node' : isMsCreation ? 'Tambah ODP/MS (Mini Splitter)' : 'Tambah Node'} ({isMsCreation ? 'ODP/MS' : form.node_type})
            </h3>
            {isMsCreation && (
              <p className="text-[11px] text-violet-600 dark:text-violet-400 font-semibold mt-0.5">
                Pola Mini: Terhubung langsung ke POP (POP → ODP/MS → ODP → CLIENT)
              </p>
            )}
            {parentNode && <p className="text-[11px] text-black/70 dark:text-white/70">di bawah: {parentNode.name}</p>}
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white font-bold cursor-pointer transition-colors">✕</button>
        </div>

        {/* Form Wrapper */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          
          {/* Scrollable Form Body */}
          <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1 text-xs">
          {error && (
            <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/60 rounded-xl p-3.5 text-xs text-red-800 dark:text-red-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <span>️</span>
                <span>
                  {typeof error === 'object'
                    ? Object.values(error).flat().join(' · ')
                    : String(error).includes('already been taken') || String(error).includes('sudah digunakan')
                      ? `Kode "${form.code}" sudah terpakai di database. Silakan ubah kode unik di kolom Kode Unik.`
                      : error}
                </span>
              </div>
              <p className="text-[10px] text-red-600 dark:text-red-300">
                Setiap ODC / POP / ODP wajib menggunakan <strong>Kode Unik</strong> yang belum pernah dipakai (contoh: ODC-01-01, ODC-01-02, ODC-02-01).
              </p>
            </div>
          )}

          {/* ── Tipe + Status ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={lc}>Tipe Node *</label>
              <select value={form.node_type} onChange={e => handleNodeTypeChange(e.target.value)} className={fc}>
                <option value="POP">POP — Point of Presence</option>
                <option value="ODC">ODC — Optical Cabinet</option>
                <option value="ODP">ODP — Optical Point</option>
              </select>
            </div>
            <div>
              <label className={lc}>Status *</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className={fc}>
                <option value="active"> Aktif Normal</option>
                <option value="maintenance"> Maintenance</option>
                <option value="inactive"> Tidak Aktif</option>
                <option value="damaged"> Rusak</option>
              </select>
            </div>
          </div>

          {/* ── Nama Node ── */}
          <div>
            <label className={lc}>Nama Node ({form.node_type}) *</label>
            <input
              required
              value={form.name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder={
                form.node_type === 'POP'
                  ? 'misal: POP Central Headend'
                  : form.node_type === 'ODP'
                    ? 'misal: ODP Perumahan Koto Baru'
                    : 'misal: ODC Cabinet Koto Baru'
              }
              className={fc}
            />
          </div>

          {/* ── Mode & Input Koordinat Lokasi (Google Earth DMS / Google Maps Desimal) ── */}
          <div className="space-y-2 bg-black/5 dark:bg-white/5 p-3 rounded-lg border border-black/20 dark:border-white/20">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                <span>Koordinat Lokasi Node</span>
              </label>
              <div className="flex gap-1 bg-white dark:bg-black p-0.5 rounded-md border border-black/20 dark:border-white/20">
                <button
                  type="button"
                  onClick={() => set('coord_mode', 'dms')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all ${form.coord_mode === 'dms'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                  Google Earth (DMS)
                </button>
                <button
                  type="button"
                  onClick={() => set('coord_mode', 'decimal')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all ${form.coord_mode === 'decimal'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                  Google Maps (Desimal)
                </button>
              </div>
            </div>

            {form.coord_mode === 'dms' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1 block">Garis Lintang (Latitude)</label>
                  <input
                    value={form.lat_dms}
                    onChange={e => {
                      const val = e.target.value;
                      set('lat_dms', val);
                      const p = parseCoordsInput(val, form.lng_dms);
                      if (p.isValid) {
                        setForm(f => ({ ...f, lat_dms: val, latitude: p.lat, longitude: p.lng }));
                      }
                    }}
                    placeholder='0°47"5.96"S atau 0°47"5.96"LS'
                    className={`${fc} font-mono text-xs`}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1 block">Garis Bujur (Longitude)</label>
                  <input
                    value={form.lng_dms}
                    onChange={e => {
                      const val = e.target.value;
                      set('lng_dms', val);
                      const p = parseCoordsInput(form.lat_dms, val);
                      if (p.isValid) {
                        setForm(f => ({ ...f, lng_dms: val, latitude: p.lat, longitude: p.lng }));
                      }
                    }}
                    placeholder='100°39"15.87"T atau 100°39"15.87"BT'
                    className={`${fc} font-mono text-xs`}
                  />
                </div>
              </div>
            ) : (
              <div className="pt-1">
                <input
                  value={form.coords_input}
                  onChange={e => {
                    const val = e.target.value;
                    set('coords_input', val);
                    const p = parseCoordsInput(val);
                    if (p.isValid) {
                      setForm(f => ({
                        ...f,
                        coords_input: val,
                        latitude: p.lat,
                        longitude: p.lng,
                        lat_dms: p.dmsLat,
                        lng_dms: p.dmsLng
                      }));
                    }
                  }}
                  placeholder="-0.784989, 100.654408 atau 0°47'5.96&quot;S, 100°39'15.87&quot;T"
                  className={`${fc} font-mono text-xs`}
                />
              </div>
            )}

            {/* Preview Konversi Otomatis */}
            {form.latitude && form.longitude ? (
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl flex flex-wrap items-center justify-between text-[11px] font-mono gap-1 text-emerald-800 dark:text-emerald-300">
                <div>Desimal: <strong>{parseFloat(form.latitude).toFixed(6)}, {parseFloat(form.longitude).toFixed(6)}</strong></div>
                <div>Google Earth DMS: <strong>{decimalToDms(form.latitude, form.longitude).formattedDms}</strong></div>
              </div>
            ) : (
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                Format Google Earth Pro DMS: <code className="text-indigo-600 dark:text-indigo-400 font-mono">0°47'5.96"S</code> &amp; <code className="text-indigo-600 dark:text-indigo-400 font-mono">100°39'15.87"T</code> (Otomatis dikonversi ke desimal).
              </p>
            )}
          </div>

          {/* ── Node Induk ── */}
          {form.node_type !== 'POP' && (
            <div>
              <label className={lc}>
                {form.node_type === 'ODC'
                  ? 'Node Induk (POP atau ODC Induk)'
                  : isMsCreation
                    ? 'Node Induk (Pilih POP untuk ODP/MS)'
                    : 'Node Induk (POP untuk ODP/MS, ODC, atau MS)'} *
              </label>

              {/* Untuk ODP: tampilkan penjelasan opsi parent */}
              {form.node_type === 'ODP' && (
                <div className="mb-2 flex flex-wrap gap-1.5 text-[10px]">
                  <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-950/60 border border-purple-300 dark:border-purple-800 rounded-lg text-purple-800 dark:text-purple-300 font-bold">
                    POP → Pilih jika node ini adalah ODP/MS (Pola: POP → MS)
                  </span>
                  <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-700 dark:text-blue-300 font-semibold">
                    ODC → Pola Standar (POP → ODC → ODP)
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-semibold">
                    ODP/MS → Cabang ke MS lain (POP → MS → ODP)
                  </span>
                </div>
              )}

              <SearchableSelect
                value={form.parent_node_id}
                onChange={val => set('parent_node_id', val)}
                placeholder="— Pilih Induk (POP / ODC / MS) —"
                searchPlaceholder="Cari nama / kode node..."
                required
                options={allNodes
                  .filter(n => {
                    if (form.node_type === 'ODC') {
                      return n.node_type === 'POP' || (n.node_type === 'ODC' && n.id !== editNode?.id);
                    }
                    if (form.node_type === 'ODP') {
                      // 1. POP: Memungkinkan ODP ini menjadi ODP/MS (Mini Splitter langsung dari POP!)
                      if (n.node_type === 'POP') return true;
                      // 2. ODC: Pola standar (ODC -> ODP)
                      if (n.node_type === 'ODC') return true;
                      // 3. ODP/MS: Pola cabang (ODP yang berinduk ke POP)
                      if (n.node_type === 'ODP' && n.id !== editNode?.id) {
                        const parentNode = allNodes.find(p => p.id === n.parent_node_id);
                        return parentNode?.node_type === 'POP';
                      }
                      return false;
                    }
                    return false;
                  })
                  .map(n => {
                    if (n.node_type === 'POP') {
                      return {
                        value: n.id,
                        label: `[POP] ${n.name}`,
                        sublabel: `Point of Presence (Jadikan node ini sebagai ODP/MS) · ${n.code}`
                      };
                    }
                    if (n.node_type === 'ODC') {
                      return {
                        value: n.id,
                        label: `[ODC] ${n.name}`,
                        sublabel: `Optical Distribution Cabinet (Pola Standar) · ${n.code}`
                      };
                    }
                    return {
                      value: n.id,
                      label: `[MS] ${n.name}`,
                      sublabel: `ODP/Mini Splitter (Pola Cabang ODP) · ${n.code}`
                    };
                  })
                }
              />
            </div>
          )}

          {/* ── OLT + Interface ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={lc}> OLT Terhubung</label>
              <SearchableSelect
                value={form.olt_device_id}
                onChange={val => set('olt_device_id', val)}
                placeholder="— Pilih OLT —"
                searchPlaceholder="Cari perangkat OLT..."
                options={(oltDevices ?? []).map(o => ({
                  value: o.id,
                  label: o.name,
                  sublabel: o.vendor ? `Vendor: ${o.vendor}` : undefined
                }))}
              />
            </div>
            {(form.node_type === 'ODC' || form.node_type === 'ODP') && (
              <MultiOltPortSelector
                value={form.olt_port_ref}
                onChange={val => set('olt_port_ref', val)}
                selectedOlt={(oltDevices ?? []).find(o => String(o.id) === String(form.olt_device_id))}
              />
            )}
          </div>

          {/* ═══════════════════════════════════════
              KONFIGURASI KHUSUS ODP
          ═══════════════════════════════════════ */}
          {form.node_type === 'ODP' && (
            <div className="bg-black/5 dark:bg-white/5 border border-black/20 dark:border-white/20 rounded-lg p-3.5 space-y-3">
              <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                ️ Konfigurasi Teknis ODP
              </h4>

              {/* Baris 1: Warna Core + Tube */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <MultiColorSelector
                  value={form.core_color}
                  onChange={val => set('core_color', val)}
                  label="CORE"
                  helpText="Warna core fiber optik yang masuk ke ODP"
                />
                <MultiTubeSelector
                  value={form.tube_info}
                  onChange={val => set('tube_info', val)}
                  label="TUBE"
                  helpText="Warna / label tube yang masuk ke ODP"
                />
              </div>

              {/* Baris 2: Splitter ODP */}
              <div className="bg-white dark:bg-black border border-black/20 dark:border-white/20 rounded-md p-3 space-y-2">
                <label className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                  Splitter ODP
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Jumlah Splitter</p>
                    <input
                      type="number" min={0} max={99}
                      value={form.odp_splitter_count ?? ''}
                      onChange={e => set('odp_splitter_count', e.target.value)}
                      placeholder="misal: 1"
                      className={fc}
                    />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Tipe Splitter</p>
                    <select
                      value={form.odp_splitter_ratio ?? ''}
                      onChange={e => set('odp_splitter_ratio', e.target.value)}
                      className={fc}
                    >
                      <option value="">— Pilih Tipe —</option>
                      <option value="1:2">PLC 1:2 (2 output)</option>
                      <option value="1:4">PLC 1:4 (4 output)</option>
                      <option value="1:8">PLC 1:8 (8 output)</option>
                      <option value="1:16">PLC 1:16 (16 output)</option>
                      <option value="1:24">PLC 1:24 (24 output)</option>
                      <option value="1:32">PLC 1:32 (32 output)</option>
                      <option value="1:48">PLC 1:48 (48 output)</option>
                      <option value="1:64">PLC 1:64 (64 output)</option>
                      <option value="1:128">PLC 1:128 (128 output)</option>
                    </select>
                  </div>
                </div>
                {(() => {
                  const cnt = parseInt(form.odp_splitter_count) || 0;
                  const match = form.odp_splitter_ratio?.match(/\d+:(\d+)/);
                  const out = match ? parseInt(match[1]) : 0;
                  const total = cnt * out;
                  return total > 0 ? (
                    <p className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300">
                      {cnt} × {form.odp_splitter_ratio} = {total} Port Output
                    </p>
                  ) : null;
                })()}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════
              KONFIGURASI KHUSUS ODC
          ═══════════════════════════════════════ */}
          {form.node_type === 'ODC' && (
            <div className="bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 space-y-4 shadow-xs">
              <h4 className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                ️ Konfigurasi Teknis ODC
              </h4>

              {/* ── Topology Type ── */}
              <div>
                <label className={lc}>Jenis Topologi ODC</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 'tunggal', icon: '', label: 'Tunggal', desc: 'Tidak punya ODC anak', sel: 'border-indigo-500 bg-indigo-50 text-indigo-900 dark:bg-indigo-950/80 dark:text-indigo-200 dark:border-indigo-500 font-bold' },
                    { val: 'induk', icon: '', label: 'ODC Induk', desc: 'Memiliki ODC anak', sel: 'border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950/80 dark:text-blue-200 dark:border-blue-500 font-bold' },
                    { val: 'anak', icon: '', label: 'ODC Anak', desc: 'Di bawah ODC Induk', sel: 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-500 font-bold' },
                  ].map(opt => (
                    <button key={opt.val} type="button"
                      onClick={() => set('odc_topology_type', opt.val)}
                      className={`text-center p-2.5 rounded-xl border-2 transition-all ${form.odc_topology_type === opt.val ? opt.sel : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                    >
                      <div className="text-sm">{opt.icon}</div>
                      <div className="text-[11px] font-bold mt-0.5">{opt.label}</div>
                      <div className="text-[9px] font-normal text-current opacity-80">{opt.desc}</div>
                    </button>
                  ))}
                </div>
                {form.odc_topology_type === 'tunggal' && <p className="text-[10px] text-indigo-800 dark:text-indigo-300 mt-1.5 px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900/60 rounded-lg"> Cocok untuk kaskade 1:2-1:8-1:8. Tidak memiliki ODC anak.</p>}
                {form.odc_topology_type === 'induk' && <p className="text-[10px] text-blue-800 dark:text-blue-300 mt-1.5 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/60 rounded-lg"> ODC Induk dapat diisi Splitter Power (misal 5x 1:2) DAN Splitter Distribusi (misal 8x 1:8).</p>}
                {form.odc_topology_type === 'anak' && <p className="text-[10px] text-emerald-800 dark:text-emerald-300 mt-1.5 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/60 rounded-lg"> ODC Anak → pilih ODC Induk sebagai Parent di kolom Node Induk di atas.</p>}
              </div>

              {/* ── Core Power + Tube Fiber ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <MultiColorSelector
                  value={form.core_power}
                  onChange={val => set('core_power', val)}
                  label="CORE"
                  helpText="Daya optik / warna core feeder yang masuk ke ODC"
                />
                <MultiTubeSelector
                  value={form.tube_info}
                  onChange={val => set('tube_info', val)}
                  label="TUBE"
                  helpText="Warna/label tube fiber yang masuk ke ODC"
                />
              </div>

              {/* ── Dual Splitter Config (Power & Distribusi) ── */}
              <div className="space-y-3 pt-1">
                <label className={lc}> Modul Splitter Terpasang (Power &amp; Distribusi)</label>

                {/* 1. Splitter Power */}
                <div className="bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl p-3 space-y-2">
                  <label className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                    1. Splitter Power ODC (Feeder / Upstream)
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Jumlah Splitter Power</p>
                      <input
                        type="number" min={0} max={99}
                        value={form.power_count}
                        onChange={e => set('power_count', e.target.value)}
                        placeholder="misal: 5"
                        className={fc}
                      />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Tipe Splitter Power</p>
                      <select
                        value={form.power_ratio}
                        onChange={e => set('power_ratio', e.target.value)}
                        className={fc}
                      >
                        <option value="">— Pilih Tipe —</option>
                        <option value="1:2">PLC 1:2 (2 output)</option>
                        <option value="1:4">PLC 1:4 (4 output)</option>
                        <option value="1:8">PLC 1:8 (8 output)</option>
                        <option value="1:16">PLC 1:16 (16 output)</option>
                      </select>
                    </div>
                  </div>
                  {calcPowerPorts > 0 && (
                    <p className="text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                      {form.power_count} buah × {form.power_ratio} = {calcPowerPorts} Port Output Power
                    </p>
                  )}
                </div>

                {/* 2. Splitter Distribusi */}
                <div className="bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl p-3 space-y-2">
                  <label className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                    2. Splitter Distribusi ODC (Downstream ODP)
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Jumlah Splitter Distribusi</p>
                      <input
                        type="number" min={0} max={99}
                        value={form.dist_count}
                        onChange={e => set('dist_count', e.target.value)}
                        placeholder="misal: 8"
                        className={fc}
                      />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Tipe Splitter Distribusi</p>
                      <select
                        value={form.dist_ratio}
                        onChange={e => set('dist_ratio', e.target.value)}
                        className={fc}
                      >
                        <option value="">— Pilih Tipe —</option>
                        <option value="1:2">PLC 1:2 (2 output)</option>
                        <option value="1:4">PLC 1:4 (4 output)</option>
                        <option value="1:8">PLC 1:8 (8 output)</option>
                        <option value="1:16">PLC 1:16 (16 output)</option>
                        <option value="1:32">PLC 1:32 (32 output)</option>
                        <option value="1:64">PLC 1:64 (64 output)</option>
                      </select>
                    </div>
                  </div>
                  {calcDistPorts > 0 && (
                    <p className="text-[10px] font-semibold text-blue-800 dark:text-blue-300">
                      {form.dist_count} buah × {form.dist_ratio} = {calcDistPorts} Port Output Distribusi
                    </p>
                  )}
                </div>

                {/* Summary calculation */}
                {totalCalc > 0 && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/60 rounded-xl p-3 text-xs text-emerald-900 dark:text-emerald-200">
                    <div className="font-bold"> Total Port ODC: {totalCalc} Port</div>
                    <div className="text-[10px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                      ({calcPowerPorts > 0 ? `${calcPowerPorts} Port Power` : ''} {calcPowerPorts > 0 && calcDistPorts > 0 ? '+' : ''} {calcDistPorts > 0 ? `${calcDistPorts} Port Distribusi` : ''})
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Kapasitas Port ── */}
          <div>
            <label className={lc}>Kapasitas Port Total</label>
            <input type="number" min={0} value={form.total_ports} onChange={e => set('total_ports', parseInt(e.target.value) || 0)} className={fc} />
            {form.node_type === 'ODC' && totalCalc > 0 && (
              <p className="text-[10px] text-indigo-600 mt-1"> Otomatis: {totalCalc} port dari splitter config</p>
            )}
          </div>

          {/* ── Lokasi ── */}
          <div>
            <label className={lc}>Alamat / Lokasi Fisik</label>
            <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Jl. Raya Manggarai No. 12" className={fc} />
          </div>
        </div>

        {/* Pinned Modal Footer */}
        <div className="px-5 py-3.5 bg-black/5 dark:bg-white/5 border-t border-black/20 dark:border-white/20 flex items-center justify-end gap-2.5 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-black/30 dark:border-white/30 text-xs font-bold text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            <span>Simpan Node</span>
          </button>
        </div>
      </form>

    </div>
  </div>,
  document.body
);
}

/* ══════════════════════════════════════════════════════════════════
   MODAL TAMBAH KABEL
══════════════════════════════════════════════════════════════════ */
function AddCableModal({ popNode, onSave, onClose, loading, error, cables = [], allNodes = [] }) {
  const initialStartNode = popNode || allNodes.find(n => n.node_type === 'POP') || allNodes[0];
  const initialCableCode = generateAutoCableCode(initialStartNode, cables);
  
  const [form, setForm] = useState({
    name: '',
    code: initialCableCode,
    from_node_id: initialStartNode?.id ?? '',
    to_node_id: '',
    length_meters: '',
    core_count_total: 48,
    tube_count: 4,
    installation_type: 'Aerial',
    route_description: '',
    notes: '',
  });

  const set = (k, v) => setForm(f => {
    const updated = { ...f, [k]: v };
    if (k === 'core_count_total') {
      const n = parseInt(v);
      if (n === 12) updated.tube_count = 1;
      else if (n === 24) updated.tube_count = 2;
      else if (n === 48) updated.tube_count = 4;
      else if (n === 96) updated.tube_count = 8;
      else if (n === 144) updated.tube_count = 12;
    }
    return updated;
  });

  const handleFromNodeChange = (val) => {
    const fromId = val ? Number(val) : '';
    const selectedStartNode = allNodes.find(n => n.id === fromId);
    setForm(f => {
      const updated = { ...f, from_node_id: fromId };
      if (f.to_node_id === fromId) {
        updated.to_node_id = '';
      }
      if (!f.code || f.code.startsWith('CBL-')) {
        updated.code = generateAutoCableCode(selectedStartNode || popNode, cables);
      }
      return updated;
    });
  };

  const handleSubmit = e => {
    e.preventDefault();
    const currentStartNode = allNodes.find(n => n.id === form.from_node_id) || popNode;
    const autoCode = form.code || generateAutoCableCode(currentStartNode, cables);
    onSave({ ...form, code: autoCode });
  };

  const fc = 'w-full px-3 py-2 bg-white dark:bg-black border border-black/30 dark:border-white/30 rounded-md text-xs sm:text-sm text-black dark:text-white placeholder-black/40 dark:placeholder-white/40 focus:outline-none focus:border-black dark:focus:border-white transition-all font-medium';
  const lc = 'block text-xs font-bold text-black dark:text-white uppercase tracking-wide mb-1.5';

  return (
    <div className="fixed inset-0 z-[99999] overflow-y-auto bg-black/60 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen">
      <div className="relative w-full max-w-xl bg-white dark:bg-black rounded-lg sm:rounded-xl shadow-2xl border border-black/70 dark:border-white/70 my-auto max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150 text-black dark:text-white">
        <div className="bg-white dark:bg-black text-black dark:text-white px-5 py-4 flex items-center justify-between flex-shrink-0 border-b border-black/20 dark:border-white/20">
          <div>
            <h3 className="text-base font-bold text-black dark:text-white"> Tambah Kabel Fiber Optik Baru</h3>
            <p className="text-xs text-black/70 dark:text-white/70">Konfigurasi Node Asal, Node Tujuan, &amp; Core Matrix TIA-598-A</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white font-bold cursor-pointer transition-colors">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/60 rounded-xl p-3.5 text-xs text-red-800 dark:text-red-200">
              {typeof error === 'object' ? Object.values(error).flat().join(' · ') : error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={lc}>Nama Kabel *</label>
              <input required value={form.name} onChange={e => set('name', e.target.value)} placeholder="Kabel Feeder / Distribusi" className={fc} />
            </div>
            <div>
              <label className={lc}>Kode Kabel *</label>
              <input required value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="CBL-..." className={`${fc} font-mono uppercase`} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={lc}>Node Mulai (Asal / Starting Point) *</label>
              <SearchableSelect
                value={form.from_node_id || ''}
                onChange={handleFromNodeChange}
                placeholder="— Pilih Node Mulai (POP / ODC / ODP) —"
                searchPlaceholder="Cari POP, ODC, ODP..."
                options={allNodes.filter(n => n.id !== form.to_node_id).map(n => ({
                  value: n.id,
                  label: n.name,
                  sublabel: `[${n.node_type}] ${n.address || ''}`
                }))}
              />
            </div>

            <div>
              <label className={lc}>Node Tujuan (Akhir / End Point)</label>
              <SearchableSelect
                value={form.to_node_id || ''}
                onChange={val => set('to_node_id', val ? Number(val) : '')}
                placeholder="— Pilih Node Tujuan (ODC / ODP / POP / FAT) —"
                searchPlaceholder="Cari ODC, ODP, POP, FAT..."
                options={allNodes.filter(n => n.id !== form.from_node_id).map(n => ({
                  value: n.id,
                  label: n.name,
                  sublabel: `[${n.node_type}] ${n.address || ''}`
                }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={lc}>Jumlah Core *</label>
              <select value={form.core_count_total} onChange={e => set('core_count_total', parseInt(e.target.value))} className={fc}>
                {[6, 12, 24, 48, 96, 144].map(n => <option key={n} value={n}>{n} Core</option>)}
              </select>
            </div>
            <div>
              <label className={lc}>Jumlah Tube *</label>
              <select value={form.tube_count} onChange={e => set('tube_count', parseInt(e.target.value))} className={fc}>
                {[1, 2, 3, 4, 6, 8, 12].map(n => <option key={n} value={n}>{n} Tube</option>)}
              </select>
            </div>
            <div>
              <label className={lc}>Jenis Instalasi *</label>
              <select value={form.installation_type} onChange={e => set('installation_type', e.target.value)} className={fc}>
                <option value="Aerial">️ Aerial (Udara)</option>
                <option value="Underground"> Underground</option>
                <option value="Duct"> Duct / Conduit</option>
                <option value="Wall"> Wall Mount</option>
              </select>
            </div>
          </div>

          <div>
            <label className={lc}>Panjang Kabel (meter) *</label>
            <input required type="number" min={1} value={form.length_meters} onChange={e => set('length_meters', e.target.value)} placeholder="1500" className={`${fc} font-mono`} />
          </div>

          <div>
            <label className={lc}>Deskripsi Rute / Jalur</label>
            <input value={form.route_description} onChange={e => set('route_description', e.target.value)} placeholder="dari POP Central → Tiang A → Persimpangan B" className={fc} />
          </div>

          <div>
            <label className={lc}>Catatan Tambahan</label>
            <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Keterangan pemasangan, brand kabel, dll..." className={`${fc} resize-none`} />
          </div>

          <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-xl p-3 text-xs text-indigo-900 dark:text-indigo-200 font-medium">
            ℹ️ Sistem akan otomatis generate <strong>{form.core_count_total} core</strong> dalam <strong>{form.tube_count} tube</strong> ({Math.ceil(form.core_count_total / form.tube_count)} core/tube) sesuai standar TIA-598-A.
          </div>

          <div className="pt-2 flex justify-end gap-2.5">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Batal</button>
            <button type="submit" disabled={loading} className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50">
              {loading ? 'Menyimpan...' : 'Buat Kabel & Core Matrix'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MODAL EDIT KABEL
══════════════════════════════════════════════════════════════════ */
function EditCableModal({ cable, onSave, onClose, loading, error, allNodes = [] }) {
  const [form, setForm] = useState({
    name: cable.name ?? '',
    from_node_id: cable.from_node_id ?? '',
    to_node_id: cable.to_node_id ?? '',
    length_meters: cable.length_meters ?? '',
    installation_type: cable.installation_type ?? 'Aerial',
    route_description: cable.route_description ?? '',
    status: cable.status ?? 'active',
    notes: cable.notes ?? '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const handleSubmit = e => { e.preventDefault(); onSave(form); };

  const fc = 'w-full px-3 py-2 bg-white dark:bg-black border border-black/30 dark:border-white/30 rounded-md text-xs sm:text-sm text-black dark:text-white placeholder-black/40 dark:placeholder-white/40 focus:outline-none focus:border-black dark:focus:border-white transition-all font-medium';
  const lc = 'block text-xs font-bold text-black dark:text-white uppercase tracking-wide mb-1.5';

  return (
    <div className="fixed inset-0 z-[99999] overflow-y-auto bg-black/60 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen">
      <div className="relative w-full max-w-xl bg-white dark:bg-black rounded-lg sm:rounded-xl shadow-2xl border border-black/70 dark:border-white/70 my-auto max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150 text-black dark:text-white">
        <div className="bg-white dark:bg-black text-black dark:text-white px-5 py-4 flex items-center justify-between flex-shrink-0 border-b border-black/20 dark:border-white/20">
          <div>
            <h3 className="text-base font-bold text-black dark:text-white">️ Edit Kabel — {cable.name}</h3>
            <p className="text-xs text-black/70 dark:text-white/70 font-mono">{cable.code} · {cable.core_count_total} Core</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white font-bold cursor-pointer transition-colors">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/60 rounded-xl p-3.5 text-xs text-red-800 dark:text-red-200">
              {typeof error === 'object' ? Object.values(error).flat().join(' · ') : error}
            </div>
          )}

          <div>
            <label className={lc}>Nama Kabel *</label>
            <input required value={form.name} onChange={e => set('name', e.target.value)} className={fc} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={lc}>Node Mulai (Asal / Starting Point) *</label>
              <SearchableSelect
                value={form.from_node_id || ''}
                onChange={val => set('from_node_id', val ? Number(val) : '')}
                placeholder="— Pilih Node Mulai (Asal) —"
                searchPlaceholder="Cari POP, ODC, ODP..."
                options={allNodes.filter(n => n.id !== form.to_node_id).map(n => ({
                  value: n.id,
                  label: n.name,
                  sublabel: `[${n.node_type}] ${n.address || ''}`
                }))}
              />
            </div>

            <div>
              <label className={lc}>Node Tujuan (Akhir / End Point)</label>
              <SearchableSelect
                value={form.to_node_id || ''}
                onChange={val => set('to_node_id', val ? Number(val) : '')}
                placeholder="— Pilih Node Tujuan (Akhir) —"
                searchPlaceholder="Cari ODC, ODP, POP, FAT..."
                options={allNodes.filter(n => n.id !== form.from_node_id).map(n => ({
                  value: n.id,
                  label: n.name,
                  sublabel: `[${n.node_type}] ${n.address || ''}`
                }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={lc}>Panjang (meter) *</label>
              <input required type="number" min={1} value={form.length_meters} onChange={e => set('length_meters', e.target.value)} className={`${fc} font-mono`} />
            </div>
            <div>
              <label className={lc}>Jenis Instalasi *</label>
              <select value={form.installation_type} onChange={e => set('installation_type', e.target.value)} className={fc}>
                <option value="Aerial">️ Aerial (Udara)</option>
                <option value="Underground"> Underground</option>
                <option value="Duct"> Duct / Conduit</option>
                <option value="Wall"> Wall Mount</option>
              </select>
            </div>
          </div>

          <div>
            <label className={lc}>Status Kabel</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className={fc}>
              <option value="active">Aktif</option>
              <option value="inactive">Non-Aktif</option>
              <option value="maintenance">Maintenance / Pemeliharaan</option>
              <option value="damaged">Rusak / Putus</option>
            </select>
          </div>

          <div>
            <label className={lc}>Deskripsi Rute / Jalur</label>
            <input value={form.route_description} onChange={e => set('route_description', e.target.value)} className={fc} />
          </div>

          <div>
            <label className={lc}>Catatan</label>
            <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} className={`${fc} resize-none`} />
          </div>

          <div className="flex gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Batal</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 transition-all">
              {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              Simpan Perubahan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   TUBE CORE ACCORDION (Collapsible per Tube)
══════════════════════════════════════════════════════════════════ */
function TubeCoreAccordion({ coresByTube, onEditCore }) {
  const [openTubes, setOpenTubes] = useState({});

  const toggleTube = (tubeNum) => {
    setOpenTubes(prev => ({ ...prev, [tubeNum]: !prev[tubeNum] }));
  };

  return (
    <div className="space-y-2">
      {Object.entries(coresByTube).map(([tubeNum, cores]) => {
        const firstCore = cores[0];
        const rawTubeColor = firstCore?.tube_color ?? 'Biru';
        const tubeColorName = getIndonesianColor(rawTubeColor);
        const tubeMeta = FIBER_COLOR_CODES[tubeColorName] ?? FIBER_COLOR_CODES.Biru;
        const tubeUsed = cores.filter(c => c.status === 'used').length;
        const isOpen = !!openTubes[tubeNum];
        const usedPct = cores.length > 0 ? Math.round((tubeUsed / cores.length) * 100) : 0;

        return (
          <div key={tubeNum} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs transition-all">
            {/* ── Tube Header (clickable) ── */}
            <button
              type="button"
              onClick={() => toggleTube(tubeNum)}
              className="w-full text-left bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 px-4 sm:px-5 py-3.5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${tubeMeta.bg} ${tubeMeta.border}`}
                  style={{ backgroundColor: tubeMeta.hex, borderColor: tubeMeta.borderHex }}
                />
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                    Tube {tubeNum} — <span className="font-semibold">{tubeColorName}</span>
                    <span className="text-black/70 dark:text-white/70 font-normal ml-1">({cores.length} Core)</span>
                  </h4>
                  <p className="text-[10px] sm:text-xs text-black/70 dark:text-white/70">
                    Core #{cores[0]?.core_number} s/d #{cores[cores.length - 1]?.core_number}
                    <span className={`ml-2 font-semibold ${tubeUsed > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                      · {tubeUsed}/{cores.length} Terpakai ({usedPct}%)
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                {/* Mini progress bar */}
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${usedPct >= 90 ? 'bg-red-500' : usedPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${usedPct}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 w-8 text-right">{usedPct}%</span>
                </div>

                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-xl border ${isOpen ? 'bg-slate-900 dark:bg-slate-950 text-white border-slate-900' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>
                  {isOpen ? '▲ Tutup' : '▼ Lihat Core'}
                </span>
              </div>
            </button>

            {/* ── Core Grid (only when open) ── */}
            {isOpen && (
              <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                {cores.map(core => {
                  const coreColorName = getIndonesianColor(core.color);
                  const colorMeta = FIBER_COLOR_CODES[coreColorName] ?? FIBER_COLOR_CODES[core.color] ?? FIBER_COLOR_CODES.Biru;
                  const isUsed = core.status === 'used';
                  const isDamaged = core.status === 'damaged';
                  const isReserved = core.status === 'reserved';
                  const destMeta = DEST_TYPE_META[core.destination_type] ?? DEST_TYPE_META.UNASSIGNED;

                  return (
                    <button
                      key={core.id}
                      onClick={() => onEditCore(core)}
                      className={`text-left rounded-xl border p-3 transition-all hover:shadow-md active:scale-[0.98] flex flex-col justify-between ${isUsed ? 'bg-emerald-50/60 border-emerald-300 hover:border-emerald-500' :
                        isDamaged ? 'bg-red-50/60 border-red-300 hover:border-red-500' :
                          isReserved ? 'bg-amber-50/60 border-amber-300 hover:border-amber-500' :
                            'bg-slate-50/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                        }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center font-bold text-[11px] sm:text-xs border ${colorMeta.bg} ${colorMeta.border} ${colorMeta.text} shadow-xs`}
                              style={{ backgroundColor: colorMeta.hex, borderColor: colorMeta.borderHex }}
                            >
                              {core.core_number}
                            </span>
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{getIndonesianColor(core.color)}</span>
                          </div>
                          <span className={`text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md border ${destMeta.color}`}>
                            {destMeta.label}
                          </span>
                        </div>

                        {core.destination_name ? (
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug line-clamp-2 mt-1">
                            {core.destination_name}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400 italic mt-1">
                            ○ Dark Fiber (Tersedia)
                          </p>
                        )}

                        {core.notes && (
                          <p className="text-[11px] text-black/70 dark:text-white/70 mt-1.5 line-clamp-2 leading-relaxed bg-slate-100/70 dark:bg-slate-800/80 px-2 py-1 rounded-md border border-slate-200/50 dark:border-slate-700/50">
                            <span className="font-semibold text-slate-600 dark:text-slate-300">Catatan:</span> {core.notes}
                          </p>
                        )}
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                        <span className="font-mono text-black/70 dark:text-white/70 truncate max-w-[130px]">{core.odf_cassette_label || 'TUBE - CORE: —'}</span>
                        <span className="text-indigo-600 font-semibold">Edit &rarr;</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   TAB 1: POP CENTRAL OFFICE & FIBER CORE MATRIX
══════════════════════════════════════════════════════════════════ */
function PopTabContent({ pops, selectedPop, onSelectPop, cables, loadingCables, onAddCable, onEditCable, onDeleteCable, onRefreshCables, onAddNode, onEditNode, onDeleteNode, allNodes = [] }) {
  const { hasRole } = useAuth();
  const canCrud = hasRole('Super Administrator', 'Operator Jaringan');
  const [selectedCableId, setSelectedCableId] = useState(null);
  const [editingCore, setEditingCore] = useState(null);
  const [savingCore, setSavingCore] = useState(false);

  useEffect(() => {
    if (cables.length > 0) {
      if (!selectedCableId || !cables.some(c => c.id === selectedCableId)) {
        setSelectedCableId(cables[0].id);
      }
    } else {
      setSelectedCableId(null);
    }
  }, [cables, selectedCableId]);

  const activeCable = cables.find(c => c.id === selectedCableId) ?? cables[0];

  const handleSaveCore = async (form) => {
    if (!editingCore) return;
    setSavingCore(true);
    try {
      const res = await fetch(`/api/network-cable-cores/${editingCore.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? ''
        },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        setEditingCore(null);
        onRefreshCables();
      }
    } finally {
      setSavingCore(false);
    }
  };

  const coresByTube = activeCable ? (activeCable.cores ?? []).reduce((acc, core) => {
    const t = core.tube_number ?? 1;
    if (!acc[t]) acc[t] = [];
    acc[t].push(core);
    return acc;
  }, {}) : {};

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* POP Selector Bar */}
      <div className="bg-white dark:bg-black p-4 sm:p-5 rounded-lg border border-black/70 dark:border-white/70 shadow-xs text-black dark:text-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-black dark:text-white"> Pilih POP ({pops.length} POP)</h3>
            <p className="text-[11px] sm:text-xs text-black/70 dark:text-white/70 mt-0.5">Pilih POP untuk melihat daftar kabel &amp; core matrix</p>
          </div>
          {canCrud && (
            <button
              onClick={() => onAddNode('POP')}
              className="w-full sm:w-auto px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-md shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>+</span> Tambah POP
            </button>
          )}
        </div>

        {/* Dropdown + Edit/Delete action row */}
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <SearchableSelect
              value={selectedPop?.id ?? ''}
              onChange={val => {
                const pop = pops.find(p => p.id === Number(val));
                if (pop) onSelectPop(pop);
              }}
              placeholder="— Pilih POP —"
              searchPlaceholder="Cari POP..."
              options={pops.map(pop => ({
                value: pop.id,
                label: pop.name,
                sublabel: pop.olt_device ? `OLT: ${pop.olt_device.name}${pop.address ? ` · ${pop.address}` : ''}` : (pop.address || undefined)
              }))}
            />
          </div>

          {selectedPop && canCrud && (
            <>
              <button
                onClick={() => onEditNode(selectedPop)}
                title="Edit POP ini"
                className="flex-shrink-0 px-3 py-1.5 text-xs font-bold rounded-md border border-black/30 dark:border-white/30 bg-white dark:bg-black hover:bg-black/5 dark:hover:bg-white/10 text-black dark:text-white transition-all cursor-pointer"
              >Edit</button>
              <button
                onClick={() => onDeleteNode(selectedPop)}
                title="Hapus POP ini"
                className="flex-shrink-0 px-3 py-1.5 text-xs font-bold rounded-md border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 transition-all cursor-pointer"
              >Hapus</button>
            </>
          )}
        </div>
      </div>

      {/* Cable Selector & Matrix Content */}
      {loadingCables ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 sm:p-12 text-center border border-slate-200 dark:border-slate-700 animate-pulse">
          <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-xl mx-auto mb-3" />
          <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">Memuat Kabel &amp; Core Matrix TIA-598-A...</p>
        </div>
      ) : !selectedPop ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-700 text-slate-400">
          Belum ada POP terdaftar
        </div>
      ) : cables.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 p-8 sm:p-12 text-center">
          <div className="text-3xl sm:text-4xl mb-3"></div>
          <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100">Belum Ada Kabel Backbone di POP Ini</h3>
          <p className="text-xs text-black/70 dark:text-white/70 max-w-md mx-auto mt-1 mb-5">
            Mulai daftarkan kabel backbone 48 Core / 24 Core / 12 Core untuk mengelola rak ODF &amp; peruntukan core.
          </p>
          {canCrud && (
            <button onClick={onAddCable} className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-md transition-all">
              + Tambah Kabel Backbone POP
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* ── Cable Dropdown Selector ── */}
          <div className="bg-white dark:bg-black rounded-lg border border-black/70 dark:border-white/70 p-4 sm:p-5 shadow-xs text-black dark:text-white">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100"> Daftar Kabel Fiber POP ({cables.length} Kabel)</h3>
                <p className="text-[11px] sm:text-xs text-black/70 dark:text-white/70 mt-0.5">Pilih kabel untuk membuka susunan Tube &amp; Core TIA-598-A</p>
              </div>
              {canCrud && (
                <button onClick={onAddCable} className="w-full sm:w-auto px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1">
                  <span>+</span> Tambah Kabel
                </button>
              )}
            </div>

            {/* Dropdown + Edit/Delete action row */}
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <SearchableSelect
                  value={selectedCableId ?? ''}
                  onChange={val => setSelectedCableId(Number(val))}
                  placeholder="— Pilih Kabel Backbone —"
                  searchPlaceholder="Cari kabel backbone..."
                  options={cables.map(c => {
                    const u = (c.cores ?? []).filter(cr => cr.status === 'used').length;
                    return {
                      value: c.id,
                      label: c.name,
                      sublabel: `${c.core_count_total} Core (${u} Core Terpakai)`
                    };
                  })}
                />
              </div>

              {activeCable && canCrud && (
                <>
                  <button
                    onClick={() => onEditCable(activeCable)}
                    title="Edit kabel ini"
                    className="flex-shrink-0 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-indigo-50 hover:border-indigo-300 text-slate-700 dark:text-slate-300 transition-all"
                  >Edit</button>
                  <button
                    onClick={() => onDeleteCable(activeCable)}
                    title="Hapus kabel ini"
                    className="flex-shrink-0 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-red-50 hover:border-red-300 text-red-600 dark:text-red-400 transition-all"
                  >Hapus</button>
                </>
              )}
            </div>
          </div>

          {/* Active Cable Overview Card */}
          {activeCable && (
            <div className="bg-white dark:bg-black text-black dark:text-white rounded-lg p-4 sm:p-5 shadow-xs border border-black/70 dark:border-white/70">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-black/5 dark:bg-white/10 text-black dark:text-white border border-black/20 dark:border-white/20">
                      {activeCable.core_count_total} Core ({Object.keys(coresByTube).length} Tube)
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-black/5 dark:bg-white/10 text-black dark:text-white border border-black/20 dark:border-white/20">
                      Jalur {activeCable.installation_type} ({activeCable.length_meters}m)
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-bold mt-2 text-black dark:text-white">{activeCable.name}</h2>
                  {activeCable.route_description && (
                    <p className="text-xs text-black/70 dark:text-white/70 mt-0.5"> Rute: {activeCable.route_description}</p>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-2 bg-black/5 dark:bg-white/5 p-2.5 sm:p-3 rounded-md border border-black/20 dark:border-white/20 text-center">
                  <div>
                    <p className="text-[10px] sm:text-xs text-black/60 dark:text-white/60">Total</p>
                    <p className="text-sm sm:text-base font-bold text-black dark:text-white">{activeCable.core_count_total}</p>
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-emerald-600 dark:text-emerald-400">Used</p>
                    <p className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400">{(activeCable.cores ?? []).filter(c => c.status === 'used').length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-black/60 dark:text-white/60">Dark Fiber</p>
                    <p className="text-sm sm:text-base font-bold text-black dark:text-white">{(activeCable.cores ?? []).filter(c => c.status === 'available').length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400">Reserved</p>
                    <p className="text-sm sm:text-base font-bold text-amber-600 dark:text-amber-400">{(activeCable.cores ?? []).filter(c => c.status === 'reserved' || c.status === 'damaged').length}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Tube & Core Accordion ── */}
          {activeCable && Object.keys(coresByTube).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-black/70 dark:text-white/70 mb-2 px-1">
                Klik salah satu Tube di bawah untuk melihat isi Core-nya
              </p>
              <TubeCoreAccordion coresByTube={coresByTube} onEditCore={setEditingCore} />
            </div>
          )}
        </div>
      )}

      {editingCore && (
        <EditCoreModal
          core={editingCore}
          cableName={activeCable?.name ?? ''}
          allNodes={allNodes}
          onSave={handleSaveCore}
          onClose={() => setEditingCore(null)}
          loading={savingCore}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MODAL EDIT PORT ODC / ODP
══════════════════════════════════════════════════════════════════ */
function EditOdcPortModal({ port, odcName, onSave, onClose, loading }) {
  const [form, setForm] = useState({
    status: port.status === 'used' || port.destination_label ? 'used' : (port.status ?? 'available'),
    destination_label: port.destination_label ?? '',
    customer_name_cache: port.customer_name_cache ?? '',
    notes: port.notes ?? '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(port.id, form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-slate-900 dark:bg-slate-950 text-white px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold">️ Edit Port {port.port_number}</h3>
            <p className="text-xs text-slate-300">ODC: {odcName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-400 font-bold">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-black/70 dark:text-white/70 uppercase tracking-wide mb-1">Status Port *</label>
            <select
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="available"> Available (Tersedia / Kosong)</option>
              <option value="used"> Terpakai / Terhubung (Used)</option>
              <option value="maintenance"> Maintenance</option>
              <option value="damaged"> Damaged (Rusak)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-black/70 dark:text-white/70 uppercase tracking-wide mb-1">Label Peruntukan / Tujuan Port</label>
            <input
              value={form.destination_label}
              onChange={e => setForm(f => ({ ...f, destination_label: e.target.value }))}
              placeholder="misal: Ke ODP-A01 (Blok A No. 12)"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-black/70 dark:text-white/70 uppercase tracking-wide mb-1">Nama Pelanggan / Service (Cache)</label>
            <input
              value={form.customer_name_cache}
              onChange={e => setForm(f => ({ ...f, customer_name_cache: e.target.value }))}
              placeholder="misal: John Doe (PA-0012)"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-black/70 dark:text-white/70 uppercase tracking-wide mb-1">Catatan Port</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Catatan tambahan peruntukan..."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50">Batal</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50">
              {loading ? 'Menyimpan...' : 'Simpan Perubahan Port'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   TAB 2: ODC (OPTICAL DISTRIBUTION CABINET)
   - Filter by OLT + POP + Search
   - Core Power & Multi Interface
   - Dynamic Splitter Grouping & Interactive Port Editing
══════════════════════════════════════════════════════════════════ */
function OdcTabContent({ onAddNode, onAddMsNode, onEditNode, onDeleteNode, onDeleteAllNodes, refreshKey, onRefreshGlobal, scopedOltId, onOpenKmlModal }) {
  const { hasRole } = useAuth();
  const canCrud = hasRole('Super Administrator', 'Operator Jaringan');
  const [oltDevices, setOltDevices] = useState([]);
  const [popNodes, setPopNodes] = useState([]);
  const [odcList, setOdcList] = useState([]);
  const [filterOlt, setFilterOlt] = useState(scopedOltId || '');
  const [filterPop, setFilterPop] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedOdc, setSelectedOdc] = useState(null);
  const [odcDetail, setOdcDetail] = useState(null);  // { node, ports, odps }
  const [detailLoading, setDetailLoading] = useState(false);
  const [editingPort, setEditingPort] = useState(null);
  const [savingPort, setSavingPort] = useState(false);
  const [viewFullOdcModal, setViewFullOdcModal] = useState(null);
  const [fullOdcData, setFullOdcData] = useState(null);
  const [loadingFullOdc, setLoadingFullOdc] = useState(false);

  // Sync filterOlt with scopedOltId
  useEffect(() => {
    if (scopedOltId) {
      setFilterOlt(scopedOltId);
    }
  }, [scopedOltId]);

  // Muat daftar OLT & POP
  useEffect(() => {
    fetch('/api/olts')
      .then(r => r.json())
      .then(d => setOltDevices(d.data ?? []))
      .catch(() => setOltDevices([]));
    fetch('/api/network-nodes?type=POP&per_page=1000')
      .then(r => r.json())
      .then(d => setPopNodes(d.data ?? []))
      .catch(() => setPopNodes([]));
  }, []);

  // Muat ODC setiap kali filter / search / refreshKey / scopedOltId berubah
  const fetchOdcs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    const targetOlt = filterOlt || scopedOltId;
    if (targetOlt && targetOlt !== 'all') params.append('olt_id', targetOlt);
    if (filterPop && filterPop !== 'all') params.append('pop_id', filterPop);
    if (searchQuery.trim()) params.append('search', searchQuery.trim());
    try {
      const r = await fetch(`/api/network-nodes/odc-list?${params}`);
      const d = await r.json();
      setOdcList(d.data ?? []);
    } catch { setOdcList([]); }
    finally { setLoading(false); }
  }, [filterOlt, filterPop, searchQuery, scopedOltId]);

  useEffect(() => { fetchOdcs(); }, [fetchOdcs, refreshKey]);

  // Muat grid port ODC
  const openOdcDetail = async (odc) => {
    setSelectedOdc(odc);
    setOdcDetail(null);
    setDetailLoading(true);
    try {
      const r = await fetch(`/api/network-nodes/${odc.id}/odc-ports`);
      const d = await r.json();
      setOdcDetail(d);
    } catch { setOdcDetail(null); }
    finally { setDetailLoading(false); }
  };

  const closeDetail = () => { setSelectedOdc(null); setOdcDetail(null); };

  // Muat seluruh spesifikasi & data lengkap ODC
  const openOdcFullModal = async (odc) => {
    setViewFullOdcModal(odc);
    setFullOdcData(null);
    setLoadingFullOdc(true);
    try {
      const r = await fetch(`/api/network-nodes/${odc.id}/odc-ports`);
      const d = await r.json();
      setFullOdcData(d);
    } catch { setFullOdcData(null); }
    finally { setLoadingFullOdc(false); }
  };

  const closeFullOdcModal = () => { setViewFullOdcModal(null); setFullOdcData(null); };

  // Save changes to an individual ODC port
  const handleSavePort = async (portId, portData) => {
    setSavingPort(true);
    try {
      const r = await fetch(`/api/network-ports/${portId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? ''
        },
        body: JSON.stringify(portData),
      });
      if (r.ok) {
        setEditingPort(null);
        if (selectedOdc) openOdcDetail(selectedOdc);
        fetchOdcs();
        if (onRefreshGlobal) onRefreshGlobal();
      }
    } catch { }
    finally { setSavingPort(false); }
  };

  // Helper formatting for interface display (convert 1/1/1 or gpon-olt_1/1/1 or epon_0/1)
  const displayInterface = (ref) => {
    if (!ref) return '—';
    return ref.split(',').map(s => {
      const trimmed = s.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('epon') || trimmed.startsWith('epon_')) return trimmed;
      const clean = trimmed.replace(/^(gpon[-_]olt_)/i, '');
      return `gpon-olt_${clean}`;
    }).filter(Boolean).join(', ');
  };

  // Helper to group ports by splitter configuration into categories (Power vs Distribusi)
  const groupPortsBySplitter = (ports, splitterConfig, splitterTypeRatio) => {
    if (!ports || ports.length === 0) return { powerGroups: [], distGroups: [], generalGroups: [] };

    let configRatios = [];
    if (Array.isArray(splitterConfig) && splitterConfig.length > 0) {
      configRatios = splitterConfig;
    } else if (typeof splitterConfig === 'string' && splitterConfig.trim()) {
      configRatios = splitterConfig.split(',').map(s => s.trim());
    } else if (splitterTypeRatio) {
      configRatios = [splitterTypeRatio];
    }

    const powerGroups = [];
    const distGroups = [];
    const generalGroups = [];

    let portIndex = 0;
    let powerIdx = 1;
    let distIdx = 1;
    let generalIdx = 1;

    configRatios.forEach((item) => {
      const isPower = /^power[:|]/i.test(item);
      const isDist = /^dist[:|]/i.test(item);
      const cleanRatio = item.replace(/^(power|dist)[:|]/i, '').trim();

      const match = cleanRatio.match(/\d+:(\d+)/);
      const capacity = match ? parseInt(match[1]) : 8;
      const groupPorts = ports.slice(portIndex, portIndex + capacity);
      portIndex += capacity;

      if (groupPorts.length > 0) {
        if (isPower) {
          powerGroups.push({
            title: `Splitter Power ${powerIdx++}`,
            ratio: cleanRatio,
            capacity,
            ports: groupPorts,
          });
        } else if (isDist) {
          distGroups.push({
            title: `Splitter Distribusi ${distIdx++}`,
            ratio: cleanRatio,
            capacity,
            ports: groupPorts,
          });
        } else {
          generalGroups.push({
            title: `Splitter Modul ${generalIdx++}`,
            ratio: cleanRatio,
            capacity,
            ports: groupPorts,
          });
        }
      }
    });

    if (portIndex < ports.length) {
      const remaining = ports.slice(portIndex);
      generalGroups.push({
        title: configRatios.length > 0 ? `Port Standby / Cadangan` : `Grid Port ODC`,
        ratio: '—',
        capacity: remaining.length,
        ports: remaining,
      });
    }

    return { powerGroups, distGroups, generalGroups };
  };

  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 6;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterOlt, filterPop]);

  const filteredOdcs = useMemo(() => {
    return odcList.filter(odc => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q ||
        odc.name?.toLowerCase().includes(q) ||
        odc.code?.toLowerCase().includes(q) ||
        odc.address?.toLowerCase().includes(q) ||
        odc.notes?.toLowerCase().includes(q) ||
        odc.olt_port_ref?.toLowerCase().includes(q) ||
        odc.parent_node?.name?.toLowerCase().includes(q) ||
        odc.parent?.name?.toLowerCase().includes(q) ||
        odc.olt_device?.name?.toLowerCase().includes(q);

      const odcOltId = odc.olt_device_id || odc.olt_device?.id || odc.parent_node?.olt_device?.id || odc.parent?.olt_device?.id;
      const matchOlt = !filterOlt || filterOlt === 'all' || String(odcOltId) === String(filterOlt);

      const odcPopId = odc.parent_node_id || odc.parent_node?.id || odc.parent?.id;
      const matchPop = !filterPop || filterPop === 'all' || String(odcPopId) === String(filterPop);

      return matchSearch && matchOlt && matchPop;
    });
  }, [odcList, searchQuery, filterOlt, filterPop]);

  const sortedOdcs = useMemo(() => {
    return [...filteredOdcs].sort(naturalNodeCompare);
  }, [filteredOdcs]);

  const totalPages = Math.ceil(sortedOdcs.length / perPage) || 1;
  const paginatedOdcs = sortedOdcs.slice((currentPage - 1) * perPage, currentPage * perPage);

  return (
    <div className="space-y-4">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-black p-4 sm:p-5 rounded-lg border border-black/70 dark:border-white/70 shadow-xs">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-black dark:text-white">
            Daftar ODC &amp; ODP/MS
          </h3>
          <p className="text-[11px] text-black/70 dark:text-white/70 mt-0.5">
            <span className="font-semibold text-blue-600 dark:text-blue-400">ODC</span> = Pola standar (POP → ODC → ODP) &nbsp;·&nbsp;
            <span className="font-semibold text-violet-600 dark:text-violet-400">ODP/MS</span> = Pola mini (POP → MS → ODP)
          </p>
        </div>
        {canCrud && (
          <div className="flex gap-2 flex-wrap items-center">
            {onOpenKmlModal && (
              <button
                type="button"
                onClick={() => onOpenKmlModal('odc')}
                className="px-3.5 py-2 bg-white hover:bg-black/5 dark:bg-black dark:hover:bg-white/10 text-black dark:text-white text-xs font-bold rounded-md transition-all flex items-center gap-1.5 border border-black/70 dark:border-white/70 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span>Import KML ODC</span>
              </button>
            )}
            <button
              onClick={() => onAddNode('ODC')}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-md shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>+</span> Tambah ODC
            </button>
            <button
              onClick={() => onAddMsNode()}
              className="px-3.5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-md shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>+</span> Tambah ODP/MS
            </button>
            {odcList.length > 0 && onDeleteAllNodes && (
              <button
                onClick={() => onDeleteAllNodes('ODC')}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                title="Hapus seluruh data ODC dan ODP/MS"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Hapus Semua ODC</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── Filter & Search Bar (Section 7 Standard) ─── */}
      <div className="bg-white dark:bg-black rounded-lg border border-black/70 dark:border-white/70 shadow-xs p-3.5 sm:p-4 space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-black/40 dark:text-white/40">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') fetchOdcs(); }}
              placeholder="Cari kode, nama, lokasi ODC / MS..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-md border border-black/40 dark:border-white/40 bg-white dark:bg-black text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 focus:outline-none focus:border-black dark:focus:border-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <OdcFilterPopover
              filterOlt={filterOlt}
              setFilterOlt={setFilterOlt}
              filterPop={filterPop}
              setFilterPop={setFilterPop}
              olts={oltDevices}
              pops={popNodes}
              onApply={() => fetchOdcs()}
              onApplyFilters={({ oltValue, popValue }) => {
                setFilterOlt(oltValue);
                setFilterPop(popValue);
              }}
              onReset={() => {
                setFilterOlt('');
                setFilterPop('');
              }}
              onResetFilters={() => {
                setFilterOlt('');
                setFilterPop('');
              }}
            />
            <button
              type="button"
              onClick={fetchOdcs}
              className="px-3.5 py-2 bg-black hover:bg-black/90 dark:bg-white dark:hover:bg-white/90 text-white dark:text-black text-xs font-bold rounded-md transition-all cursor-pointer"
            >
              Cari
            </button>
          </div>
        </div>

        {/* Filter Chips */}
        {(filterOlt || filterPop) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-black/10 dark:border-white/10">
            <span className="text-[11px] font-semibold text-black/60 dark:text-white/60">Filter Aktif:</span>
            {filterOlt && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-black/5 dark:bg-white/10 text-black dark:text-white border border-black/20 dark:border-white/20">
                <span>OLT: {oltDevices.find(o => String(o.id) === String(filterOlt))?.name || filterOlt}</span>
                <button
                  type="button"
                  onClick={() => setFilterOlt('')}
                  className="hover:text-red-500 font-bold ml-0.5 cursor-pointer"
                >
                  ×
                </button>
              </span>
            )}
            {filterPop && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-black/5 dark:bg-white/10 text-black dark:text-white border border-black/20 dark:border-white/20">
                <span>POP: {popNodes.find(p => String(p.id) === String(filterPop))?.name || filterPop}</span>
                <button
                  type="button"
                  onClick={() => setFilterPop('')}
                  className="hover:text-red-500 font-bold ml-0.5 cursor-pointer"
                >
                  ×
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={() => { setFilterOlt(''); setFilterPop(''); }}
              className="text-[11px] text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white underline ml-1 cursor-pointer"
            >
              Reset Filter
            </button>
          </div>
        )}
      </div>

      {/* ─── ODC Cards & Pagination ─── */}
      {loading ? (
        <div className="bg-white dark:bg-black rounded-lg p-10 text-center text-black/40 dark:text-white/40 text-xs animate-pulse border border-black/70 dark:border-white/70">
          Memuat data ODC...
        </div>
      ) : odcList.length === 0 ? (
        <div className="bg-white dark:bg-black rounded-lg p-8 sm:p-12 text-center border border-dashed border-black/30 dark:border-white/30">
          <p className="text-sm font-bold text-black dark:text-white">Belum Ada ODC Ditemukan</p>
          <p className="text-xs text-black/60 dark:text-white/60 mt-1">Coba ubah filter OLT / POP / kata pencarian atau tambah ODC baru</p>
          {canCrud && (
            <button onClick={() => onAddNode('ODC')} className="mt-3 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md cursor-pointer">
              + Tambah ODC Pertama
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white dark:bg-black rounded-lg border border-black/70 dark:border-white/70 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-black dark:text-white">
                <thead className="bg-black/5 dark:bg-white/5 text-black dark:text-white font-semibold border-b border-black/20 dark:border-white/20 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4">#</th>
                    <th className="py-3.5 px-4">KODE / NAMA ODC / MS</th>
                    <th className="py-3.5 px-4">TOPOLOGI &amp; OLT</th>
                    <th className="py-3.5 px-4">TUBE &amp; CORE POWER</th>
                    <th className="py-3.5 px-4">KAPASITAS PORT</th>
                    <th className="py-3.5 px-4">LOKASI</th>
                    <th className="py-3.5 px-4">STATUS</th>
                    <th className="py-3.5 px-4 text-center">AKSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/20 dark:divide-white/20">
                  {paginatedOdcs.map((odc, idx) => {
                    const globalIdx = (currentPage - 1) * perPage + idx + 1;
                    const p = pct(odc.used_ports, odc.total_ports);
                    const isMsNode = odc.is_ms_node === true;
                    const topoType = odc.odc_topology_type ?? 'tunggal';
                    const topoBadge = isMsNode
                      ? { label: 'ODP/MS', bg: 'text-violet-600 dark:text-violet-400 border border-violet-500/30' }
                      : topoType === 'induk'
                        ? { label: 'ODC Induk', bg: 'text-blue-600 dark:text-blue-400 border border-blue-500/30' }
                        : topoType === 'anak'
                          ? { label: 'ODC Anak', bg: 'text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' }
                          : { label: 'Tunggal', bg: 'text-blue-600 dark:text-blue-400 border border-blue-500/30' };

                    return (
                      <tr key={odc.id} className={`hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${isMsNode ? 'bg-violet-500/5' : ''}`}>
                        <td className="py-3 px-4 font-mono font-bold text-black/50 dark:text-white/50">{globalIdx}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-black dark:text-white text-sm leading-tight">{odc.name}</span>
                            {isMsNode && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded text-violet-600 dark:text-violet-400 border border-violet-500/40 shrink-0">
                                MS
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 text-[11px] font-bold rounded ${topoBadge.bg} inline-block mb-1`}>
                            {topoBadge.label}
                          </span>
                          <span className="font-semibold text-black dark:text-white block">{odc.olt_device?.name || 'OLT Utama Solok'}</span>
                          <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold">{displayInterface(odc.olt_port_ref)}</span>
                        </td>
                        <td className="py-3 px-4">
                          {odc.core_power ? (
                            <span className="font-mono font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded text-[11px] block w-max mb-1">
                              {odc.core_power}
                            </span>
                          ) : <span className="text-black/40 dark:text-white/40 block">—</span>}
                          <span className="text-[11px] font-medium text-black/80 dark:text-white/80 block truncate max-w-[140px]">
                            {odc.tube_info || '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-black dark:text-white block">{odc.used_ports}/{odc.total_ports} Port ({p}%)</span>
                          <div className="w-24 h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden mt-1">
                            <div className={`h-full ${pctColor(p)} rounded-full`} style={{ width: `${p}%` }} />
                          </div>
                        </td>
                        <td className="py-3 px-4 text-black/70 dark:text-white/70 max-w-[160px] truncate">
                          {odc.address || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold border ${STATUS_META[odc.status]?.pill}`}>
                            {STATUS_META[odc.status]?.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openOdcDetail(odc)}
                              title="Kelola Grid Port ODC"
                              className="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                            >
                              Port
                            </button>
                            <button
                              onClick={() => openOdcFullModal(odc)}
                              title="Lihat Seluruh Spesifikasi Data ODC"
                              className="px-2.5 py-1 rounded-md bg-white dark:bg-black text-black dark:text-white border border-black/40 dark:border-white/40 text-xs font-bold hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                            >
                              Detail
                            </button>
                            {canCrud && (
                              <>
                                <button
                                  onClick={() => onEditNode(odc)}
                                  className="px-2.5 py-1 rounded-md bg-white dark:bg-black text-black dark:text-white border border-black/40 dark:border-white/40 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => onDeleteNode(odc)}
                                  className="px-2.5 py-1 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs font-semibold hover:bg-rose-100 transition-colors cursor-pointer"
                                >
                                  Hapus
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Bordered Card List View */}
          <div className="block md:hidden space-y-4">
            {paginatedOdcs.map((odc, idx) => {
              const globalIdx = (currentPage - 1) * perPage + idx + 1;
              const p = pct(odc.used_ports, odc.total_ports);
              return (
                <div key={odc.id} className="bg-white dark:bg-black rounded-lg border border-black/70 dark:border-white/70 shadow-xs overflow-hidden">
                  <div className="divide-y divide-black/20 dark:divide-white/20 text-xs">
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center bg-black/5 dark:bg-white/5">
                      <span className="text-black/50 dark:text-white/50 font-semibold">#</span>
                      <span className="col-span-2 font-mono font-bold text-black dark:text-white">{globalIdx}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-black/50 dark:text-white/50 font-semibold">Name</span>
                      <span className="col-span-2 font-bold text-black dark:text-white uppercase">{odc.name}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-black/50 dark:text-white/50 font-semibold">OLT &amp; Interface</span>
                      <span className="col-span-2 text-black dark:text-white">
                        <span className="font-bold block">{odc.olt_device?.name || 'OLT Utama Solok'}</span>
                        <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold">{displayInterface(odc.olt_port_ref)}</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-black/50 dark:text-white/50 font-semibold">Tube &amp; Core Power</span>
                      <span className="col-span-2 text-black dark:text-white">
                        <span className="font-semibold block">{odc.tube_info || '—'}</span>
                        {odc.core_power && <span className="font-mono font-bold text-amber-700 dark:text-amber-300 text-[10px] block">{odc.core_power}</span>}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-black/50 dark:text-white/50 font-semibold">Capacity</span>
                      <span className="col-span-2 font-bold text-black dark:text-white">
                        {odc.used_ports}/{odc.total_ports} Port ({p}%)
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-black/50 dark:text-white/50 font-semibold">Status</span>
                      <span className="col-span-2">
                        <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold border ${STATUS_META[odc.status]?.pill}`}>
                          {STATUS_META[odc.status]?.label}
                        </span>
                      </span>
                    </div>
                    <div className="px-4 py-3 bg-black/5 dark:bg-white/5 flex items-center justify-end gap-2">
                      <button
                        onClick={() => openOdcDetail(odc)}
                        className="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold shadow-xs cursor-pointer"
                      >
                        Port
                      </button>
                      <button
                        onClick={() => openOdcFullModal(odc)}
                        className="px-2.5 py-1 rounded-md bg-white dark:bg-black text-black dark:text-white border border-black/40 dark:border-white/40 text-[11px] font-bold hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                      >
                        Detail
                      </button>
                      {canCrud && (
                        <>
                          <button
                            onClick={() => onEditNode(odc)}
                            className="px-2.5 py-1 rounded-md bg-white dark:bg-black text-black dark:text-white border border-black/40 dark:border-white/40 text-[11px] font-semibold cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => onDeleteNode(odc)}
                            className="px-2.5 py-1 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-[11px] font-semibold cursor-pointer"
                          >
                            Hapus
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ODC Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-3.5 bg-white dark:bg-black rounded-lg border border-black/70 dark:border-white/70 shadow-xs flex items-center justify-between text-xs">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-md border border-black/30 dark:border-white/30 bg-white dark:bg-black text-black dark:text-white font-semibold disabled:opacity-30 cursor-pointer hover:bg-black/5 dark:hover:bg-white/10"
              >
                ← Prev
              </button>
              <span className="font-bold text-black dark:text-white">
                Halaman {currentPage} dari {totalPages} (Total {filteredOdcs.length} ODC)
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-md border border-black/30 dark:border-white/30 bg-white dark:bg-black text-black dark:text-white font-semibold disabled:opacity-30 cursor-pointer hover:bg-black/5 dark:hover:bg-white/10"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* ─── ODC Detail Panel Modal ─── */}
      {selectedOdc && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm p-3 sm:p-6 flex items-start sm:items-center justify-center pt-14 sm:pt-20 pb-8 sm:pb-12" onClick={closeDetail}>
          <div
            className="relative bg-white dark:bg-black rounded-lg sm:rounded-xl shadow-2xl w-full max-w-3xl border border-black/70 dark:border-white/70 my-auto flex flex-col overflow-hidden max-h-[82vh] sm:max-h-[86vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-white dark:bg-black border-b border-black/30 dark:border-white/30 text-black dark:text-white px-4 sm:px-5 py-3.5 sm:py-4 flex items-center justify-between flex-shrink-0">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-black dark:text-white">Detail ODC — {selectedOdc.name}</h3>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded text-black dark:text-white border border-black/30 dark:border-white/30 uppercase">
                    {selectedOdc.odc_topology_type === 'induk' ? 'ODC INDUK' : selectedOdc.odc_topology_type === 'anak' ? 'ODC ANAK' : 'TUNGGAL'}
                  </span>
                </div>
                <p className="text-xs text-black/70 dark:text-white/70 font-mono mt-0.5">
                  {selectedOdc.code}
                  {selectedOdc.olt_device && ` · OLT: ${selectedOdc.olt_device.name}`}
                  {selectedOdc.olt_port_ref && ` [ ${displayInterface(selectedOdc.olt_port_ref)} ]`}
                  {selectedOdc.parent_node && ` · POP: ${selectedOdc.parent_node.name}`}
                </p>
              </div>
              <button onClick={closeDetail} className="w-8 h-8 flex items-center justify-center rounded-md border border-black/30 dark:border-white/30 hover:bg-black/5 dark:hover:bg-white/10 text-black dark:text-white font-bold cursor-pointer">✕</button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Context Summary Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs bg-black/5 dark:bg-white/5 border border-black/30 dark:border-white/30 rounded-lg p-3">
                <div>
                  <span className="text-black/50 dark:text-white/50 block text-[10px] uppercase font-bold">Interface OLT</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{displayInterface(selectedOdc.olt_port_ref)}</span>
                </div>
                <div>
                  <span className="text-black/50 dark:text-white/50 block text-[10px] uppercase font-bold">Core Power</span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{selectedOdc.core_power || '—'}</span>
                </div>
                <div>
                  <span className="text-black/50 dark:text-white/50 block text-[10px] uppercase font-bold">Splitter Config</span>
                  <span className="font-semibold text-black dark:text-white">
                    {selectedOdc.splitter_count > 0 ? `${selectedOdc.splitter_count} × ${selectedOdc.splitter_config?.[0] || '1:4'}` : (selectedOdc.splitter_config?.join(', ') || selectedOdc.splitter_type?.ratio || '—')}
                  </span>
                </div>
                <div>
                  <span className="text-black/50 dark:text-white/50 block text-[10px] uppercase font-bold">Kapasitas Port</span>
                  <span className="font-bold text-black dark:text-white">{selectedOdc.used_ports}/{selectedOdc.total_ports} Port</span>
                </div>
              </div>

              {/* Tube Info Banner if present */}
              {selectedOdc.tube_info && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-3.5 py-2.5 text-xs text-blue-600 dark:text-blue-400">
                  <span className="font-bold">Informasi Tube Fiber:</span> {selectedOdc.tube_info}
                </div>
              )}

              {detailLoading ? (
                <div className="py-10 text-center text-black/40 dark:text-white/40 text-xs animate-pulse">Memuat detail ODC...</div>
              ) : odcDetail ? (
                <div className="space-y-4">
                  {/* Port Grid Grouped By Splitter Categories */}
                  {odcDetail.ports?.length > 0 && (() => {
                    const { powerGroups, distGroups, generalGroups } = groupPortsBySplitter(
                      odcDetail.ports,
                      selectedOdc.splitter_config,
                      selectedOdc.splitter_type?.ratio
                    );

                    return (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-black dark:text-white uppercase tracking-wider">
                            Grid Port ODC ({odcDetail.ports.length} Port Total)
                          </h4>
                          <span className="text-[11px] text-black/50 dark:text-white/50">Klik port untuk mengedit peruntukan</span>
                        </div>

                        {/* Kelompok Splitter Power ODC */}
                        {powerGroups.length > 0 && (
                          <div className="space-y-3 bg-amber-500/5 border border-amber-500/30 rounded-lg p-3.5 sm:p-4">
                            <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                              <h4 className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                                Kelompok Splitter Power ODC ({powerGroups.length} Modul · {powerGroups.reduce((a, g) => a + g.ports.length, 0)} Port)
                              </h4>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded text-amber-700 dark:text-amber-300 border border-amber-500/30">Feeder / Upstream</span>
                            </div>

                            <div className="space-y-3">
                              {powerGroups.map((group, gIdx) => (
                                <div key={gIdx} className="bg-white dark:bg-black border border-amber-500/30 rounded-md p-3 space-y-2">
                                  <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-1.5">
                                    <span className="text-xs font-bold text-black dark:text-white flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                      {group.title}
                                    </span>
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                      Rasio {group.ratio} ({group.ports.length} Port)
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                    {group.ports.map(port => {
                                      const used = port.status === 'used' || port.destination_label || port.customer_name_cache;
                                      return (
                                        <div
                                          key={port.id}
                                          onClick={() => setEditingPort(port)}
                                          className={`p-2.5 rounded-md border flex flex-col items-center text-center gap-1 cursor-pointer transition-all hover:scale-105 ${used ? 'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:border-amber-500' : 'bg-black/5 dark:bg-white/5 border-black/20 dark:border-white/20 text-black dark:text-white hover:border-amber-400'
                                            }`}
                                        >
                                          <span className="text-base leading-none">{used ? '●' : '○'}</span>
                                          <span className="text-[11px] font-bold text-black dark:text-white">P{port.port_number}</span>
                                          {used ? (
                                            <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 line-clamp-2 leading-tight">
                                              {port.destination_label || port.customer_name_cache || 'Terpakai'}
                                            </p>
                                          ) : (
                                            <span className="text-[10px] text-black/40 dark:text-white/40">Kosong</span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Kelompok Splitter Distribusi ODC */}
                        {distGroups.length > 0 && (
                          <div className="space-y-3 bg-blue-500/5 border border-blue-500/30 rounded-lg p-3.5 sm:p-4">
                            <div className="flex items-center justify-between border-b border-blue-500/20 pb-2">
                              <h4 className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                                Kelompok Splitter Distribusi ODC ({distGroups.length} Modul · {distGroups.reduce((a, g) => a + g.ports.length, 0)} Port)
                              </h4>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded text-blue-700 dark:text-blue-300 border border-blue-500/30">Downstream ODP</span>
                            </div>

                            <div className="space-y-3">
                              {distGroups.map((group, gIdx) => (
                                <div key={gIdx} className="bg-white dark:bg-black border border-blue-500/30 rounded-md p-3 space-y-2">
                                  <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-1.5">
                                    <span className="text-xs font-bold text-black dark:text-white flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                      {group.title}
                                    </span>
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded text-blue-700 dark:text-blue-300 border border-blue-500/30">
                                      Rasio {group.ratio} ({group.ports.length} Port)
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                    {group.ports.map(port => {
                                      const used = port.status === 'used' || port.destination_label || port.customer_name_cache;
                                      return (
                                        <div
                                          key={port.id}
                                          onClick={() => setEditingPort(port)}
                                          className={`p-2.5 rounded-md border flex flex-col items-center text-center gap-1 cursor-pointer transition-all hover:scale-105 ${used ? 'bg-blue-500/10 border-blue-500/40 text-blue-700 dark:text-blue-300 hover:border-blue-500' : 'bg-black/5 dark:bg-white/5 border-black/20 dark:border-white/20 text-black dark:text-white hover:border-blue-400'
                                            }`}
                                        >
                                          <span className="text-base leading-none">{used ? '●' : '○'}</span>
                                          <span className="text-[11px] font-bold text-black dark:text-white">P{port.port_number}</span>
                                          {used ? (
                                            <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 line-clamp-2 leading-tight">
                                              {port.destination_label || port.customer_name_cache || 'Terpakai'}
                                            </p>
                                          ) : (
                                            <span className="text-[10px] text-black/40 dark:text-white/40">Kosong</span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* General / Unclassified Groups */}
                        {generalGroups.length > 0 && (
                          <div className="space-y-3 bg-black/5 dark:bg-white/5 border border-black/30 dark:border-white/30 rounded-lg p-3.5 sm:p-4">
                            {generalGroups.map((group, gIdx) => (
                              <div key={gIdx} className="bg-white dark:bg-black border border-black/30 dark:border-white/30 rounded-md p-3 space-y-2">
                                <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-1.5">
                                  <span className="text-xs font-bold text-black dark:text-white flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-black/60 dark:bg-white/60"></span>
                                    {group.title}
                                  </span>
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded text-black/70 dark:text-white/70 border border-black/30 dark:border-white/30">
                                    {group.ratio !== '—' ? `Rasio ${group.ratio} (` : ''}{group.ports.length} Port{group.ratio !== '—' ? ')' : ''}
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                  {group.ports.map(port => {
                                    const used = port.status === 'used' || port.destination_label || port.customer_name_cache;
                                    return (
                                      <div
                                        key={port.id}
                                        onClick={() => setEditingPort(port)}
                                        className={`p-2.5 rounded-md border flex flex-col items-center text-center gap-1 cursor-pointer transition-all hover:scale-105 ${used ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-700 dark:text-indigo-300 hover:border-indigo-500' : 'bg-black/5 dark:bg-white/5 border-black/20 dark:border-white/20 text-black dark:text-white hover:border-black/50 dark:hover:border-white/50'
                                          }`}
                                      >
                                        <span className="text-base leading-none">{used ? '●' : '○'}</span>
                                        <span className="text-[11px] font-bold text-black dark:text-white">P{port.port_number}</span>
                                        {used ? (
                                          <p className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 line-clamp-2 leading-tight">
                                            {port.destination_label || port.customer_name_cache || 'Terpakai'}
                                          </p>
                                        ) : (
                                          <span className="text-[10px] text-black/40 dark:text-white/40">Kosong</span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* ODP Children */}
                  {odcDetail.odps?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-black dark:text-white uppercase tracking-wider mb-2.5">
                        ODP Terhubung ({odcDetail.odps.length} ODP)
                      </h4>
                      <div className="space-y-2">
                        {odcDetail.odps.map(odp => {
                          const pp = pct(odp.used_ports, odp.total_ports);
                          return (
                            <div key={odp.id} className="flex items-center justify-between bg-black/5 dark:bg-white/5 border border-black/30 dark:border-white/30 rounded-lg px-4 py-3 gap-4">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-black dark:text-white truncate">{odp.name}</p>
                                <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">{odp.code}</p>
                                {odp.address && <p className="text-[10px] text-black/50 dark:text-white/50 truncate mt-0.5">{odp.address}</p>}
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-[11px] font-bold text-black dark:text-white">{odp.used_ports}/{odp.total_ports} Port</p>
                                <div className="w-20 h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden mt-1">
                                  <div className={`h-full ${pctColor(pp)} rounded-full`} style={{ width: `${pp}%` }} />
                                </div>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${STATUS_META[odp.status]?.pill}`}>
                                {STATUS_META[odp.status]?.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-10 text-center text-red-500 text-xs">Gagal memuat detail ODC.</div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-4 border-t border-black/30 dark:border-white/30 bg-white dark:bg-black flex items-center justify-between flex-shrink-0">
              {canCrud ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => { onEditNode(selectedOdc); closeDetail(); }}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md transition-all cursor-pointer"
                  >
                    Edit ODC
                  </button>
                  <button
                    onClick={() => { onDeleteNode(selectedOdc); closeDetail(); }}
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-semibold rounded-md border border-rose-200 dark:border-rose-800 transition-all cursor-pointer"
                  >
                    Hapus
                  </button>
                </div>
              ) : <div />}
              <button onClick={closeDetail} className="px-4 py-2 bg-white dark:bg-black hover:bg-black/5 dark:hover:bg-white/10 text-black dark:text-white text-xs font-semibold rounded-md border border-black/30 dark:border-white/30 cursor-pointer">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Edit Single ODC Port ─── */}
      {editingPort && (
        <EditOdcPortModal
          port={editingPort}
          odcName={selectedOdc?.name ?? ''}
          onSave={handleSavePort}
          onClose={() => setEditingPort(null)}
          loading={savingPort}
        />
      )}

      {/* ─── Modal Full Spesifikasi Data Lengkap ODC ─── */}
      {viewFullOdcModal && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto bg-black/60 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen" onClick={closeFullOdcModal}>
          <div
            className="relative w-full max-w-2xl bg-white dark:bg-black rounded-lg sm:rounded-xl shadow-2xl border border-black/70 dark:border-white/70 my-auto max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150 text-black dark:text-white"
            onClick={e => e.stopPropagation()}
          >
            {!viewFullOdcModal ? null : (<>
            <div className="bg-white dark:bg-black text-black dark:text-white px-5 py-4 flex items-center justify-between flex-shrink-0 border-b border-black/20 dark:border-white/20">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-black dark:text-white">Spesifikasi &amp; Data Lengkap ODC</h3>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 uppercase">
                    {viewFullOdcModal.odc_topology_type === 'induk' ? 'ODC INDUK' : viewFullOdcModal.odc_topology_type === 'anak' ? 'ODC ANAK' : 'TUNGGAL'}
                  </span>
                </div>
                <p className="text-[11px] text-black/70 dark:text-white/70 font-mono mt-0.5">{viewFullOdcModal.name}</p>
              </div>
              <button onClick={closeFullOdcModal} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white font-bold cursor-pointer transition-colors">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs">
              <div className="bg-black/5 dark:bg-white/5 rounded-lg p-3.5 sm:p-4 border border-black/20 dark:border-white/20 space-y-3">
                <h4 className="font-bold text-black dark:text-white uppercase tracking-wider text-[11px]">1. Identitas Node &amp; Topologi</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-black/50 dark:text-white/50 block text-[10px]">Nama Node</span>
                    <span className="font-bold text-black dark:text-white">{viewFullOdcModal.name}</span>
                  </div>
                  <div>
                    <span className="text-black/50 dark:text-white/50 block text-[10px]">Jenis Topologi</span>
                    <span className="font-semibold text-black dark:text-white uppercase">{viewFullOdcModal.odc_topology_type || 'tunggal'}</span>
                  </div>
                  <div>
                    <span className="text-black/50 dark:text-white/50 block text-[10px]">Status Operasional</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${STATUS_META[viewFullOdcModal.status]?.pill}`}>
                      {STATUS_META[viewFullOdcModal.status]?.label}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-black/5 dark:bg-white/5 rounded-lg p-3.5 sm:p-4 border border-black/20 dark:border-white/20 space-y-3">
                <h4 className="font-bold text-black dark:text-white uppercase tracking-wider text-[11px]">2. Koneksi OLT &amp; Parent Headend</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-black/50 dark:text-white/50 block text-[10px]">Perangkat OLT</span>
                    <span className="font-bold text-black dark:text-white">{viewFullOdcModal.olt_device?.name || 'OLT Utama Solok'}</span>
                  </div>
                  <div>
                    <span className="text-black/50 dark:text-white/50 block text-[10px]">Interface OLT PON</span>
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{displayInterface(viewFullOdcModal.olt_port_ref)}</span>
                  </div>
                  <div>
                    <span className="text-black/50 dark:text-white/50 block text-[10px]">POP / ODC Induk</span>
                    <span className="font-semibold text-black dark:text-white">{viewFullOdcModal.parent_node?.name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-black/50 dark:text-white/50 block text-[10px]">ODP Anak Terhubung</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{viewFullOdcModal.odp_count} ODP</span>
                  </div>
                </div>
              </div>

              <div className="bg-black/5 dark:bg-white/5 rounded-lg p-3.5 sm:p-4 border border-black/20 dark:border-white/20 space-y-3">
                <h4 className="font-bold text-black dark:text-white uppercase tracking-wider text-[11px]">3. Spesifikasi Teknis Optik &amp; Splitter</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-black/50 dark:text-white/50 block text-[10px]">Core Power Feeder</span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{viewFullOdcModal.core_power || '—'}</span>
                  </div>
                  <div>
                    <span className="text-black/50 dark:text-white/50 block text-[10px]">Informasi Tube Fiber</span>
                    <span className="font-medium text-black dark:text-white">{viewFullOdcModal.tube_info || '—'}</span>
                  </div>
                  <div>
                    <span className="text-black/50 dark:text-white/50 block text-[10px]">Modul Splitter ODC</span>
                    <span className="font-semibold text-black dark:text-white">
                      {viewFullOdcModal.splitter_count > 0 ? `${viewFullOdcModal.splitter_count} × ${viewFullOdcModal.splitter_config?.[0]}` : (viewFullOdcModal.splitter_config?.join(', ') || viewFullOdcModal.splitter_type?.ratio || '—')}
                    </span>
                  </div>
                  <div>
                    <span className="text-black/50 dark:text-white/50 block text-[10px]">Kapasitas &amp; Port Terisi</span>
                    <span className="font-bold text-black dark:text-white">
                      {viewFullOdcModal.used_ports}/{viewFullOdcModal.total_ports} Port ({pct(viewFullOdcModal.used_ports, viewFullOdcModal.total_ports)}%)
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-black/5 dark:bg-white/5 rounded-lg p-3.5 sm:p-4 border border-black/20 dark:border-white/20 space-y-3">
                <h4 className="font-bold text-black dark:text-white uppercase tracking-wider text-[11px]">4. Lokasi &amp; Koordinat Pemetaan</h4>
                <div className="space-y-2">
                  <div>
                    <span className="text-black/50 dark:text-white/50 block text-[10px]">Alamat / Lokasi ODC</span>
                    <span className="font-medium text-black dark:text-white">{viewFullOdcModal.address || '—'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-1 border-t border-black/20 dark:border-white/20">
                    <div>
                      <span className="text-black/50 dark:text-white/50 block text-[10px]">Koordinat Desimal</span>
                      <span className="font-mono text-black dark:text-white">{viewFullOdcModal.latitude && viewFullOdcModal.longitude ? `${viewFullOdcModal.latitude}, ${viewFullOdcModal.longitude}` : '—'}</span>
                    </div>
                    <div>
                      <span className="text-black/50 dark:text-white/50 block text-[10px]">Koordinat DMS</span>
                      <span className="font-mono text-black dark:text-white">{viewFullOdcModal.latitude && viewFullOdcModal.longitude ? decimalToDms(viewFullOdcModal.latitude, viewFullOdcModal.longitude).formattedDms : '—'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pinned Footer */}
            <div className="px-5 py-3.5 bg-black/5 dark:bg-white/5 border-t border-black/20 dark:border-white/20 flex items-center justify-between flex-shrink-0">
              {canCrud ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => { onEditNode(viewFullOdcModal); closeFullOdcModal(); }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-md shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                  >
                    Edit ODC
                  </button>
                </div>
              ) : <div />}
              <button
                onClick={closeFullOdcModal}
                className="px-4 py-2 rounded-md border border-black/30 dark:border-white/30 text-xs font-bold text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
            </>)}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   TAB 3: ODP (OPTICAL DISTRIBUTION POINT)
══════════════════════════════════════════════════════════════════ */
function OdpTabContent({ odps, onAddNode, onEditNode, onDeleteNode, onDeleteAllNodes, refreshKey, onRefreshGlobal, onOpenKmlModal }) {
  const { hasRole } = useAuth();
  const canCrud = hasRole('Super Administrator', 'Operator Jaringan');

  const [selectedOdp, setSelectedOdp] = useState(null);
  const [odpDetailData, setOdpDetailData] = useState(null);
  const [portsData, setPortsData] = useState([]);
  const [loadingPorts, setLoadingPorts] = useState(false);
  const [refreshingLiveOptical, setRefreshingLiveOptical] = useState(false);
  const [liveProbeFeedback, setLiveProbeFeedback] = useState(null);
  const [editingOdpPort, setEditingOdpPort] = useState(null);
  const [savingOdpPort, setSavingOdpPort] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [editPortForm, setEditPortForm] = useState({ notes: '', customer_name_cache: '' });
  const [viewFullOdpModal, setViewFullOdpModal] = useState(null);
  const [fullOdpData, setFullOdpData] = useState(null);
  const [loadingFullOdp, setLoadingFullOdp] = useState(false);

  const openOdpFullModal = async (odp) => {
    setViewFullOdpModal(odp);
    setFullOdpData(null);
    setLoadingFullOdp(true);
    try {
      const r = await fetch(`/api/network-nodes/${odp.id}/port-detail`);
      const d = await r.json();
      setFullOdpData(d);
    } catch { setFullOdpData(null); }
    finally { setLoadingFullOdp(false); }
  };

  const closeFullOdpModal = () => { setViewFullOdpModal(null); setFullOdpData(null); };

  // ─── Fitur Screenshot Detail Port ODP ─────────────────────────────────────
  const [capturingScreenshot, setCapturingScreenshot] = useState(false);
  const [screenshotSuccess, setScreenshotSuccess] = useState(false);
  const odpModalContentRef = useRef(null);

  const handleScreenshotOdp = async () => {
    const node = odpModalContentRef.current;
    if (!node || capturingScreenshot) return;
    setCapturingScreenshot(true);

    let wrapper = null;
    try {
      const isDarkMode = document.documentElement.classList.contains('dark');
      const canvasBgColor = isDarkMode ? '#000000' : '#ffffff';

      // 1. Buat deep clone dari modal untuk rendering off-screen tanpa terpengaruh viewport/scroll
      const clone = node.cloneNode(true);

      // 2. Hapus semua tombol interaktif / no-screenshot dari clone
      clone.querySelectorAll('.no-screenshot').forEach(el => el.remove());

      // 3. Siapkan container wrapper off-screen
      wrapper = document.createElement('div');
      wrapper.id = 'odp-screenshot-capture-wrapper';
      wrapper.style.position = 'fixed';
      wrapper.style.left = '-9999px';
      wrapper.style.top = '0';
      wrapper.style.width = '880px';
      wrapper.style.maxWidth = '880px';
      wrapper.style.zIndex = '-9999';
      wrapper.style.backgroundColor = canvasBgColor;
      wrapper.style.margin = '0';
      wrapper.style.padding = '0';
      wrapper.style.boxSizing = 'border-box';

      // 4. Atur style clone agar bebas dari batasan height/margin/overflow
      clone.style.position = 'relative';
      clone.style.top = '0';
      clone.style.left = '0';
      clone.style.margin = '0';
      clone.style.marginTop = '0';
      clone.style.marginBottom = '0';
      clone.style.marginLeft = '0';
      clone.style.marginRight = '0';
      clone.style.maxHeight = 'none';
      clone.style.height = 'auto';
      clone.style.width = '880px';
      clone.style.maxWidth = '880px';
      clone.style.overflow = 'visible';
      clone.style.transform = 'none';
      clone.style.boxShadow = 'none';
      clone.style.backgroundColor = canvasBgColor;

      // 5. Buka scroll container internal di dalam clone
      const scrollContainers = clone.querySelectorAll('.overflow-y-auto');
      scrollContainers.forEach(sc => {
        sc.style.overflow = 'visible';
        sc.style.maxHeight = 'none';
        sc.style.height = 'auto';
        sc.style.flex = 'none';
      });

      // 6. Buat grid port di clone menjadi 4 kolom proporsional (2 baris x 4 kolom untuk 8 port)
      const portGrid = clone.querySelector('.grid');
      if (portGrid) {
        portGrid.style.display = 'grid';
        portGrid.style.gridTemplateColumns = 'repeat(4, minmax(0, 1fr))';
        portGrid.style.gap = '12px';
      }

      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);

      // Berikan waktu sejenak untuk kalkulasi layout DOM
      await new Promise(resolve => setTimeout(resolve, 150));

      const fullWidth = clone.offsetWidth || 880;
      const fullHeight = clone.offsetHeight || clone.scrollHeight;

      const captureOptions = {
        cacheBust: true,
        pixelRatio: 2,
        width: fullWidth,
        height: fullHeight,
        backgroundColor: canvasBgColor,
        style: {
          margin: '0',
          marginTop: '0',
          marginBottom: '0',
          marginLeft: '0',
          marginRight: '0',
          transform: 'none',
          backgroundColor: canvasBgColor,
        },
      };

      let imgData;
      try {
        imgData = await toPng(clone, captureOptions);
      } catch (err1) {
        console.warn('First toPng attempt failed, retrying with skipFonts:', err1);
        imgData = await toPng(clone, {
          ...captureOptions,
          skipFonts: true,
          pixelRatio: 1.5,
        });
      }

      const cleanName = (selectedOdp?.name || 'ODP').replace(/[^a-zA-Z0-9_-]/g, '_');
      const now = new Date();
      const dateStr = now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0');
      const timeStr = String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0');
      const filename = `Monitoring_${cleanName}_${dateStr}_${timeStr}.png`;

      const link = document.createElement('a');
      link.href = imgData;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setScreenshotSuccess(true);
      setTimeout(() => setScreenshotSuccess(false), 3500);
    } catch (err) {
      console.error('Screenshot error:', err);
      alert('Gagal mengambil screenshot: ' + (err?.message || 'Error'));
    } finally {
      if (wrapper && document.body.contains(wrapper)) {
        document.body.removeChild(wrapper);
      }
      setCapturingScreenshot(false);
    }
  };

  // ─── Fitur Maintenance ODP & Broadcast Alert ─────────────────────────────
  const [maintenanceModalNode, setMaintenanceModalNode] = useState(null);
  const [maintenanceInfo, setMaintenanceInfo] = useState(null);
  const [loadingMaintenanceInfo, setLoadingMaintenanceInfo] = useState(false);
  const [submittingMaintenance, setSubmittingMaintenance] = useState(false);
  const [maintenanceDuration, setMaintenanceDuration] = useState('1 Jam');
  const [maintenanceNotes, setMaintenanceNotes] = useState('');
  const [sendTelegramNotif, setSendTelegramNotif] = useState(true);
  const [maintenanceSuccessToast, setMaintenanceSuccessToast] = useState(null);

  const openMaintenanceModal = async (odp) => {
    setMaintenanceModalNode(odp);
    setMaintenanceInfo(null);
    setLoadingMaintenanceInfo(true);
    setMaintenanceDuration('1 Jam');
    setMaintenanceNotes(
      odp.status === 'maintenance'
        ? 'Pemeliharaan telah selesai dilakukan. Seluruh port dan layanan pelanggan kembali beroperasi normal.'
        : 'Pemeliharaan rutin dan perbaikan kabel splitter ODP'
    );
    try {
      const res = await fetch(`/api/network-nodes/${odp.id}/maintenance`);
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setMaintenanceInfo(data);
      } else {
        setMaintenanceInfo(null);
      }
    } catch {
      setMaintenanceInfo(null);
    } finally {
      setLoadingMaintenanceInfo(false);
    }
  };

  const closeMaintenanceModal = () => {
    setMaintenanceModalNode(null);
    setMaintenanceInfo(null);
  };

  const handleToggleMaintenance = async (action) => {
    if (!maintenanceModalNode) return;
    setSubmittingMaintenance(true);
    try {
      const res = await fetch(`/api/network-nodes/${maintenanceModalNode.id}/maintenance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
        },
        body: JSON.stringify({
          action,
          notes: maintenanceNotes,
          estimated_duration: maintenanceDuration,
          send_notification: sendTelegramNotif,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Gagal memproses perubahan status maintenance.');
      }

      setMaintenanceSuccessToast({
        action,
        nodeName: maintenanceModalNode.name,
        message: data.message,
        impactedCount: data.impacted_count ?? 0,
      });

      if (typeof onRefreshGlobal === 'function') {
        onRefreshGlobal();
      }

      closeMaintenanceModal();

      setTimeout(() => {
        setMaintenanceSuccessToast(null);
      }, 7000);
    } catch (err) {
      alert(err.message || 'Terjadi kesalahan sistem saat memproses status maintenance.');
    } finally {
      setSubmittingMaintenance(false);
    }
  };

  const fetchOdpPorts = useCallback(async (odpId, isLiveRefresh = false) => {
    if (isLiveRefresh) {
      setRefreshingLiveOptical(true);
    } else {
      setLoadingPorts(true);
    }
    try {
      const url = isLiveRefresh
        ? `/api/network-nodes/${odpId}/port-detail?live=1`
        : `/api/network-nodes/${odpId}/port-detail`;
      const r = await fetch(url);
      if (!r.ok) throw new Error('API error');
      const d = await r.json();
      setOdpDetailData(d);
      setPortsData(d.ports ?? []);

      if (d.node?.used_ports != null) {
        setSelectedOdp(prev => prev ? { ...prev, used_ports: d.node.used_ports } : null);
      }

      if (isLiveRefresh && d.live_probe) {
        if (d.live_probe.success) {
          setLiveProbeFeedback({
            type: 'success',
            text: `Realtime OLT (${d.live_probe.duration_ms || 45}ms)`,
          });
        } else {
          setLiveProbeFeedback({
            type: 'info',
            text: d.live_probe.reason || 'OLT tidak merespons',
          });
        }
        setTimeout(() => setLiveProbeFeedback(null), 4500);
      }
    } catch {
      setOdpDetailData(null);
      setPortsData([]);
    } finally {
      setLoadingPorts(false);
      setRefreshingLiveOptical(false);
    }
  }, []);

  const openOdpDetail = (odp) => {
    setSelectedOdp(odp);
    setOdpDetailData(null);
    setPortsData([]);
    setEditingOdpPort(null);
    setLiveProbeFeedback(null);
    fetchOdpPorts(odp.id);
  };

  const closeOdpDetail = () => {
    setSelectedOdp(null);
    setOdpDetailData(null);
    setPortsData([]);
    setEditingOdpPort(null);
    setLiveProbeFeedback(null);
  };

  const handleRefreshPorts = () => {
    if (selectedOdp && !refreshingLiveOptical && !loadingPorts) {
      fetchOdpPorts(selectedOdp.id, true);
    }
  };

  const startEditPort = (port) => {
    setEditingOdpPort(port.id);
    setEditPortForm({
      notes: port.notes ?? '',
      customer_name_cache: port.customer_name_cache ?? '',
    });
  };

  const handleSaveOdpPort = async (portId) => {
    setSavingOdpPort(true);
    try {
      const r = await fetch(`/api/network-ports/${portId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '',
        },
        body: JSON.stringify(editPortForm),
      });
      if (r.ok) {
        setEditingOdpPort(null);
        handleRefreshPorts();
        if (onRefreshGlobal) onRefreshGlobal();
      }
    } catch { }
    finally { setSavingOdpPort(false); }
  };

  const [filterOlt, setFilterOlt] = useState('');
  const [filterOdc, setFilterOdc] = useState('');

  const availableOlts = useMemo(() => {
    const map = new Map();
    odps.forEach(o => {
      const dev = o.olt_device || o.parent_node?.olt_device || o.parent?.olt_device;
      if (dev?.id && !map.has(dev.id)) {
        map.set(dev.id, { id: dev.id, name: dev.name });
      }
    });
    return Array.from(map.values());
  }, [odps]);

  const availableOdcs = useMemo(() => {
    const map = new Map();
    odps.forEach(o => {
      const p = o.parent_node || o.parent;
      if (p?.id && !map.has(p.id)) {
        map.set(p.id, { id: p.id, name: p.name });
      }
    });
    return Array.from(map.values());
  }, [odps]);

  const filteredOdps = useMemo(() => {
    return odps
      .filter(odp => {
        const q = searchQuery.toLowerCase().trim();
        const matchSearch = !q ||
          odp.name?.toLowerCase().includes(q) ||
          odp.code?.toLowerCase().includes(q) ||
          odp.address?.toLowerCase().includes(q) ||
          odp.notes?.toLowerCase().includes(q) ||
          odp.olt_port_ref?.toLowerCase().includes(q) ||
          odp.parent_node?.name?.toLowerCase().includes(q) ||
          odp.parent?.name?.toLowerCase().includes(q) ||
          odp.olt_device?.name?.toLowerCase().includes(q);

        const matchStatus = !filterStatus || filterStatus === 'all' || odp.status === filterStatus;

        const odpOltId = odp.olt_device_id || odp.olt_device?.id || odp.parent_node?.olt_device_id || odp.parent_node?.olt_device?.id || odp.parent?.olt_device_id || odp.parent?.olt_device?.id;
        const matchOlt = !filterOlt || filterOlt === 'all' || String(odpOltId) === String(filterOlt);

        const odpParentId = odp.parent_node_id || odp.parent_id || odp.parent_node?.id || odp.parent?.id;
        const matchOdc = !filterOdc || filterOdc === 'all' || String(odpParentId) === String(filterOdc);

        return matchSearch && matchStatus && matchOlt && matchOdc;
      })
      .sort(naturalNodeCompare);
  }, [odps, searchQuery, filterStatus, filterOlt, filterOdc]);

  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 6;
  const totalPages = Math.ceil(filteredOdps.length / perPage) || 1;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus, filterOlt, filterOdc]);
  const paginatedOdps = filteredOdps.slice((currentPage - 1) * perPage, currentPage * perPage);

  const getRxColor = (rx) => {
    if (rx === null || rx === undefined) return 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700/60 border-slate-200 dark:border-slate-600';
    if (rx >= -25.0) return 'text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 font-bold';
    if (rx >= -28.0) return 'text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700 font-bold';
    return 'text-red-800 dark:text-red-300 bg-red-100 dark:bg-red-900/40 border-red-300 dark:border-red-700 font-bold animate-pulse';
  };

  return (
    <div className="space-y-4">
      {/* Toast / Alert Sukses Maintenance */}
      {maintenanceSuccessToast && (
        <div className={`p-4 rounded-lg border flex items-start justify-between gap-3 animate-fade-in bg-white dark:bg-black ${
          maintenanceSuccessToast.action === 'start'
            ? 'border-amber-400 dark:border-amber-600 text-black dark:text-white'
            : 'border-emerald-400 dark:border-emerald-600 text-black dark:text-white'
        }`}>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
              {maintenanceSuccessToast.action === 'start' ? (
                <div className="w-8 h-8 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-400 dark:border-amber-600">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              ) : (
                <div className="w-8 h-8 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-400 dark:border-emerald-600">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
            <div>
              <h4 className="font-bold text-sm text-black dark:text-white">
                {maintenanceSuccessToast.action === 'start'
                  ? `Pemeliharaan (Maintenance) ODP ${maintenanceSuccessToast.nodeName} Berhasil Diaktifkan!`
                  : `Pemeliharaan ODP ${maintenanceSuccessToast.nodeName} Selesai & Kembali Normal!`}
              </h4>
              <p className="text-xs mt-0.5 text-black/70 dark:text-white/70 leading-relaxed">
                {maintenanceSuccessToast.message}
              </p>
              <div className="mt-1 text-[11px] font-semibold text-black/60 dark:text-white/60">
                Pesan alert siaran sistem dan Telegram NOC telah dikirimkan ({maintenanceSuccessToast.impactedCount} pelanggan terdampak).
              </div>
            </div>
          </div>
          <button
            onClick={() => setMaintenanceSuccessToast(null)}
            className="text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white text-sm font-bold p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition-colors"
            title="Tutup Notifikasi"
          >
            ✕
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-black p-3.5 sm:p-4 rounded-lg border border-black/70 dark:border-white/70 shadow-xs space-y-3">
        {canCrud && (
          <div className="flex items-center justify-start sm:justify-end gap-2 flex-wrap">
            {onOpenKmlModal && (
              <button
                type="button"
                onClick={() => onOpenKmlModal('odp')}
                className="flex-1 sm:flex-initial px-3.5 py-2 bg-white hover:bg-black/5 dark:bg-black dark:hover:bg-white/10 text-black dark:text-white text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 border border-black/70 dark:border-white/70 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span>Import KML ODP</span>
              </button>
            )}
            <button
              onClick={() => onAddNode('ODP')}
              className="flex-1 sm:flex-initial px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-md shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>+</span> Tambah ODP Baru
            </button>
            {odps.length > 0 && onDeleteAllNodes && (
              <button
                onClick={() => onDeleteAllNodes('ODP')}
                className="w-full sm:w-auto px-3.5 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                title="Hapus seluruh data ODP"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Hapus Semua ODP</span>
              </button>
            )}
          </div>
        )}

        {/* ─── Search & Filter Bar (Section 7 Standard) ─── */}
        <div className="space-y-2.5">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1 min-w-0">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-black/40 dark:text-white/40">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Cari nama, kode, atau alamat ODP..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-md border border-black/40 dark:border-white/40 bg-white dark:bg-black text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 focus:outline-none focus:border-black dark:focus:border-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <OdpFilterPopover
                filterStatus={filterStatus}
                setFilterStatus={setFilterStatus}
                filterOlt={filterOlt}
                setFilterOlt={setFilterOlt}
                filterOdc={filterOdc}
                setFilterOdc={setFilterOdc}
                olts={availableOlts}
                odcs={availableOdcs}
                onApplyFilters={({ statusValue, oltValue, odcValue }) => {
                  setFilterStatus(statusValue);
                  setFilterOlt(oltValue);
                  setFilterOdc(odcValue);
                }}
                onReset={() => {
                  setFilterStatus('');
                  setFilterOlt('');
                  setFilterOdc('');
                }}
                onResetFilters={() => {
                  setFilterStatus('');
                  setFilterOlt('');
                  setFilterOdc('');
                }}
              />
            </div>
          </div>

          {/* Filter Chips */}
          {(filterStatus || filterOlt || filterOdc) && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-black/10 dark:border-white/10">
              <span className="text-[11px] font-semibold text-black/60 dark:text-white/60">Filter Aktif:</span>
              {filterStatus && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-black/5 dark:bg-white/10 text-black dark:text-white border border-black/20 dark:border-white/20">
                  <span>Status: {STATUS_META[filterStatus]?.label || filterStatus}</span>
                  <button
                    type="button"
                    onClick={() => setFilterStatus('')}
                    className="hover:text-red-500 font-bold ml-0.5 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              )}
              {filterOlt && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-black/5 dark:bg-white/10 text-black dark:text-white border border-black/20 dark:border-white/20">
                  <span>OLT: {availableOlts.find(o => String(o.id) === String(filterOlt))?.name || filterOlt}</span>
                  <button
                    type="button"
                    onClick={() => setFilterOlt('')}
                    className="hover:text-red-500 font-bold ml-0.5 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              )}
              {filterOdc && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-black/5 dark:bg-white/10 text-black dark:text-white border border-black/20 dark:border-white/20">
                  <span>ODC: {availableOdcs.find(od => String(od.id) === String(filterOdc))?.name || filterOdc}</span>
                  <button
                    type="button"
                    onClick={() => setFilterOdc('')}
                    className="hover:text-red-500 font-bold ml-0.5 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={() => { setFilterStatus(''); setFilterOlt(''); setFilterOdc(''); }}
                className="text-[11px] text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white underline ml-1 cursor-pointer"
              >
                Reset Filter
              </button>
            </div>
          )}
        </div>
      </div>

      {odps.length === 0 ? (
        <div className="bg-white dark:bg-black rounded-lg p-8 sm:p-12 text-center border border-dashed border-black/30 dark:border-white/30">
          <p className="text-sm font-bold text-black dark:text-white">Belum Ada ODP Terdaftar</p>
          <p className="text-xs text-black/60 dark:text-white/60 mt-1 mb-4">Tambahkan ODP baru untuk memulai manajemen distribusi optik</p>
          {canCrud && (
            <button onClick={() => onAddNode('ODP')} className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md cursor-pointer">
              + Tambah ODP Pertama
            </button>
          )}
        </div>
      ) : filteredOdps.length === 0 ? (
        <div className="bg-white dark:bg-black rounded-lg p-8 text-center border border-dashed border-black/30 dark:border-white/30">
          <p className="text-sm font-bold text-black dark:text-white">Tidak ada ODP yang cocok dengan filter</p>
          <button onClick={() => { setSearchQuery(''); setFilterStatus(''); setFilterOlt(''); setFilterOdc(''); }} className="mt-3 text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
            Reset filter
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white dark:bg-black rounded-lg border border-black/70 dark:border-white/70 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-black dark:text-white">
                <thead className="bg-black/5 dark:bg-white/5 text-black dark:text-white font-semibold border-b border-black/20 dark:border-white/20 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4">#</th>
                    <th className="py-3.5 px-4">KODE / NAMA ODP</th>
                    <th className="py-3.5 px-4">UPSTREAM ODC</th>
                    <th className="py-3.5 px-4">OLT &amp; INTERFACE</th>
                    <th className="py-3.5 px-4">TUBE &amp; CORE</th>
                    <th className="py-3.5 px-4">SPLITTER &amp; PORT</th>
                    <th className="py-3.5 px-4">LOKASI / ALAMAT</th>
                    <th className="py-3.5 px-4">STATUS</th>
                    <th className="py-3.5 px-4 text-center">AKSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/20 dark:divide-white/20">
                  {paginatedOdps.map((odp, idx) => {
                    const globalIdx = (currentPage - 1) * perPage + idx + 1;
                    const p = pct(odp.used_ports, odp.total_ports);
                    return (
                      <tr key={odp.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-black/50 dark:text-white/50">{globalIdx}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-black dark:text-white text-sm leading-tight block uppercase">{odp.name}</span>
                        </td>
                        <td className="py-3 px-4 font-medium text-black dark:text-white">
                          {odp.parent_node?.name || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-black dark:text-white block">
                            {odp.olt_device?.name || odp.parent_node?.olt_device?.name || 'Auto-Detect OLT'}
                          </span>
                          <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                            {displayInterface(odp.olt_port_ref)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-black dark:text-white block">{odp.tube_info || '—'}</span>
                          <span className="text-[11px] text-black/50 dark:text-white/50 block">Core {odp.core_color || '—'}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-black dark:text-white block">
                            Rasio {odp.splitter_config || odp.splitter_type?.ratio || '1:8'}
                          </span>
                          <span className="font-bold text-black dark:text-white block">
                            {odp.used_ports}/{odp.total_ports} Port ({p}%)
                          </span>
                          <div className="w-24 h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden mt-1">
                            <div className={`h-full ${pctColor(p)} rounded-full`} style={{ width: `${p}%` }} />
                          </div>
                        </td>
                        <td className="py-3 px-4 text-black/70 dark:text-white/70 max-w-[180px] truncate uppercase">
                          {odp.address || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold border ${STATUS_META[odp.status]?.pill}`}>
                            {STATUS_META[odp.status]?.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openOdpDetail(odp)}
                              title="Kelola Port & Sinyal ODP"
                              className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                            >
                              Port
                            </button>
                            <button
                              onClick={() => openOdpFullModal(odp)}
                              title="Lihat Seluruh Spesifikasi Data ODP"
                              className="px-2.5 py-1 rounded-md bg-white dark:bg-black text-black dark:text-white border border-black/40 dark:border-white/40 text-xs font-bold hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                            >
                              Detail
                            </button>
                            <button
                              onClick={() => openMaintenanceModal(odp)}
                              title={odp.status === 'maintenance' ? 'ODP Sedang Maintenance (Klik untuk Selesaikan)' : 'Mulai Maintenance ODP & Kirim Alert Pelanggan'}
                              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer ${
                                odp.status === 'maintenance'
                                  ? 'bg-amber-500 hover:bg-amber-600 text-white animate-pulse border border-amber-600'
                                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/20'
                              }`}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span>{odp.status === 'maintenance' ? 'Maint. Aktif' : 'Maintenance'}</span>
                            </button>
                            {canCrud && (
                              <>
                                <button
                                  onClick={() => onEditNode(odp)}
                                  className="px-2.5 py-1 rounded-md bg-white dark:bg-black text-black dark:text-white border border-black/40 dark:border-white/40 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => onDeleteNode(odp)}
                                  className="px-2.5 py-1 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs font-semibold hover:bg-rose-100 transition-colors cursor-pointer"
                                >
                                  Hapus
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Bordered Card List View */}
          <div className="block md:hidden space-y-4">
            {paginatedOdps.map((odp, idx) => {
              const globalIdx = (currentPage - 1) * perPage + idx + 1;
              const p = pct(odp.used_ports, odp.total_ports);
              return (
                <div key={odp.id} className="bg-white dark:bg-black rounded-lg border border-black/70 dark:border-white/70 shadow-xs overflow-hidden">
                  <div className="divide-y divide-black/20 dark:divide-white/20 text-xs">
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center bg-black/5 dark:bg-white/5">
                      <span className="text-black/50 dark:text-white/50 font-semibold">#</span>
                      <span className="col-span-2 font-mono font-bold text-black dark:text-white">{globalIdx}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-black/50 dark:text-white/50 font-semibold">Name</span>
                      <span className="col-span-2 font-bold text-black dark:text-white uppercase">{odp.name}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-black/50 dark:text-white/50 font-semibold">Address</span>
                      <span className="col-span-2 text-black dark:text-white leading-snug uppercase">{odp.address || '—'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-black/50 dark:text-white/50 font-semibold">OLT &amp; Interface</span>
                      <span className="col-span-2 text-black dark:text-white">
                        <span className="font-bold block">{odp.olt_device?.name || odp.parent_node?.olt_device?.name || 'Auto-Detect OLT'}</span>
                        <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold">{displayInterface(odp.olt_port_ref)}</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-black/50 dark:text-white/50 font-semibold">Tube &amp; Core</span>
                      <span className="col-span-2 text-black dark:text-white">
                        <span className="font-semibold block">{odp.tube_info || '—'}</span>
                        <span className="text-[10px] text-black/50 dark:text-white/50 block">Core {odp.core_color || '—'}</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-black/50 dark:text-white/50 font-semibold">Port Terisi</span>
                      <span className="col-span-2 font-bold text-black dark:text-white">
                        {odp.used_ports}/{odp.total_ports} Port ({p}%)
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-black/50 dark:text-white/50 font-semibold">Status</span>
                      <span className="col-span-2">
                        <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold border ${STATUS_META[odp.status]?.pill}`}>
                          {STATUS_META[odp.status]?.label}
                        </span>
                      </span>
                    </div>
                    <div className="px-4 py-3 bg-black/5 dark:bg-white/5 flex items-center justify-end gap-2">
                      <button
                        onClick={() => openOdpDetail(odp)}
                        className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-xs cursor-pointer"
                      >
                        Port
                      </button>
                      <button
                        onClick={() => openOdpFullModal(odp)}
                        className="px-2.5 py-1 rounded-md bg-white dark:bg-black text-black dark:text-white border border-black/40 dark:border-white/40 text-[11px] font-bold hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                      >
                        Detail
                      </button>
                      <button
                        onClick={() => openMaintenanceModal(odp)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold shadow-xs transition-colors flex items-center gap-1 cursor-pointer ${
                          odp.status === 'maintenance'
                            ? 'bg-amber-500 hover:bg-amber-600 text-white animate-pulse border border-amber-600'
                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/20'
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>{odp.status === 'maintenance' ? 'Maint. Aktif' : 'Maintenance'}</span>
                      </button>
                      {canCrud && (
                        <>
                          <button
                            onClick={() => onEditNode(odp)}
                            className="px-2.5 py-1 rounded-md bg-white dark:bg-black text-black dark:text-white border border-black/40 dark:border-white/40 text-[11px] font-semibold cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => onDeleteNode(odp)}
                            className="px-2.5 py-1 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-[11px] font-semibold cursor-pointer"
                          >
                            Hapus
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ODP Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-3.5 bg-white dark:bg-black rounded-lg border border-black/70 dark:border-white/70 shadow-xs flex items-center justify-between text-xs">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-md border border-black/30 dark:border-white/30 bg-white dark:bg-black text-black dark:text-white font-semibold disabled:opacity-30 cursor-pointer hover:bg-black/5 dark:hover:bg-white/10"
              >
                ← Prev
              </button>
              <span className="font-bold text-black dark:text-white">
                Halaman {currentPage} dari {totalPages} (Total {filteredOdps.length} ODP)
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-md border border-black/30 dark:border-white/30 bg-white dark:bg-black text-black dark:text-white font-semibold disabled:opacity-30 cursor-pointer hover:bg-black/5 dark:hover:bg-white/10"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal Detail Port & Monitoring Redaman ODP */}
      {selectedOdp && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto bg-black/60 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen" onClick={closeOdpDetail}>
          <div
            ref={odpModalContentRef}
            className="relative w-full max-w-4xl bg-white dark:bg-black rounded-lg sm:rounded-xl shadow-2xl border border-black/70 dark:border-white/70 my-auto max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150 text-black dark:text-white"
            onClick={e => e.stopPropagation()}
          >

            {/* Pinned Modal Header */}
            <div className="bg-white dark:bg-black text-black dark:text-white px-5 py-4 flex items-center justify-between flex-shrink-0 border-b border-black/20 dark:border-white/20">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold text-black dark:text-white tracking-tight break-words">
                    Detail Port &amp; Monitoring Redaman — {selectedOdp.name}
                  </h3>
                  {liveProbeFeedback && (
                    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-mono font-bold animate-in fade-in duration-150 ${
                      liveProbeFeedback.type === 'success'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    }`}>
                      {liveProbeFeedback.type === 'success' && (
                        <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {liveProbeFeedback.text}
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-black/70 dark:text-white/70 font-mono mt-0.5">
                  1:{selectedOdp.total_ports} Port ·{' '}
                  {selectedOdp.olt_port_ref ? (
                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{displayInterface(selectedOdp.olt_port_ref)}</span>
                  ) : (
                    <span className="text-black/50 dark:text-white/50">Interface Auto-Detect</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                {/* Tombol Live Refresh OLT */}
                <button
                  onClick={handleRefreshPorts}
                  disabled={loadingPorts || refreshingLiveOptical}
                  className={`no-screenshot w-8 h-8 flex items-center justify-center rounded-md bg-white dark:bg-black text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/10 border ${
                    refreshingLiveOptical
                      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500/30'
                      : 'border-black/30 dark:border-white/30'
                  } disabled:opacity-50 transition-colors cursor-pointer`}
                  title={refreshingLiveOptical ? 'Mengambil redaman realtime dari OLT...' : 'Refresh Real-time Redaman dari OLT'}
                >
                  <svg className={`w-4 h-4 ${loadingPorts || refreshingLiveOptical ? 'animate-spin text-indigo-600 dark:text-indigo-400' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button
                  onClick={closeOdpDetail}
                  className="no-screenshot w-8 h-8 flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white font-bold cursor-pointer transition-colors"
                  title="Tutup Modal"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 bg-white dark:bg-black text-xs">
              {/* OLT & Interface PON Terhubung */}
              <div className="bg-black/5 dark:bg-white/5 border border-black/20 dark:border-white/20 rounded-lg p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-black/60 dark:text-white/60 uppercase tracking-wider block">OLT Terhubung</span>
                  <p className="text-xs sm:text-sm font-bold text-black dark:text-white break-words mt-0.5">
                    {odpDetailData?.node?.olt_device?.name || odpDetailData?.node?.parent_node?.olt_device?.name || selectedOdp.olt_device?.name || selectedOdp.parent_node?.olt_device?.name || 'Auto-Detect OLT'}
                  </p>
                </div>
                <div className="pt-2 sm:pt-0 sm:pl-4 border-t sm:border-t-0 sm:border-l border-black/20 dark:border-white/20">
                  <span className="text-[10px] text-black/60 dark:text-white/60 block font-medium">Interface OLT Otomatis:</span>
                  <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 break-all block mt-0.5">
                    {odpDetailData?.display_olt_ref || displayInterface(selectedOdp.olt_port_ref)}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-black dark:text-white uppercase tracking-wider">
                    Detail Per-Port ({portsData.length} Port)
                  </h4>
                  {(loadingPorts || refreshingLiveOptical) && (
                    <span className="text-[10px] text-indigo-500 animate-pulse font-mono">
                      {refreshingLiveOptical ? 'Mengambil data dari OLT...' : 'Memuat...'}
                    </span>
                  )}
                </div>

                {loadingPorts && portsData.length === 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {Array.from({ length: selectedOdp.total_ports || 8 }).map((_, i) => (
                      <div key={i} className="h-32 rounded-lg bg-black/5 dark:bg-white/5 border border-black/20 dark:border-white/20 animate-pulse" />
                    ))}
                  </div>
                ) : portsData.length === 0 ? (
                  <div className="py-10 text-center text-black/50 dark:text-white/50">
                    <p className="text-xs">Data port tidak ditemukan. Coba refresh.</p>
                    <button onClick={handleRefreshPorts} className="mt-2 text-xs text-indigo-500 hover:underline"> Coba Lagi</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-3.5">
                    {portsData.map(port => {
                      const isUsed = !!(port.customer_id || port.customer_service_id || port.status === 'used');
                      const rx = port.rx_power != null ? parseFloat(port.rx_power) : null;
                      const rxText = rx !== null ? `${rx.toFixed(2)} dBm` : '—';
                      let rxTextColor = 'text-black/50 dark:text-white/50 font-medium';
                      if (rx !== null) {
                        if (rx >= -25.0) rxTextColor = 'text-emerald-600 dark:text-emerald-400 font-bold';
                        else if (rx >= -28.0) rxTextColor = 'text-amber-600 dark:text-amber-400 font-bold';
                        else rxTextColor = 'text-rose-600 dark:text-rose-400 font-bold animate-pulse';
                      }
                      const custId = port.customer_number && port.customer_number !== '—'
                        ? port.customer_number
                        : (port.service_number && port.service_number !== '—' ? port.service_number : (port.customer_id ? `ID: ${port.customer_id}` : null));
                      const customerName = port.customer_name || port.customer_name_cache || 'Pelanggan';

                      return (
                        <div
                          key={port.id}
                          className="bg-white dark:bg-black border border-black/60 dark:border-white/60 rounded-lg flex flex-col justify-between transition-all shadow-xs hover:border-black dark:hover:border-white"
                        >
                          <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between">
                            <div>
                              {/* Port Header */}
                              <div className="flex items-center justify-between gap-2 mb-2.5 pb-2 border-b border-black/20 dark:border-white/20">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-bold font-mono ${isUsed ? 'text-emerald-600 dark:text-emerald-400' : 'text-black/50 dark:text-white/50'}`}>
                                    P{port.port_number}
                                  </span>
                                  {isUsed && (
                                    <span className="inline-flex items-center text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse"></span>
                                      Terisi
                                    </span>
                                  )}
                                </div>
                                {isUsed ? (
                                  (port.sobok_service_status || port.service_status || 'OPEN').toUpperCase() === 'BLOKIR' ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 font-sans tracking-wide">
                                      <svg className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                      </svg>
                                      BLOKIR
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-sans tracking-wide">
                                      <svg className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                      OPEN
                                    </span>
                                  )
                                ) : (
                                  <span className="text-[10px] text-black/50 dark:text-white/50 font-mono">
                                    {port.port_type || 'SC/APC'}
                                  </span>
                                )}
                              </div>

                              {isUsed ? (
                                <div className="space-y-2">
                                  {/* 1. ID Pelanggan & Nama Pelanggan */}
                                  <div className="min-w-0">
                                    {custId && (
                                      <div className="mb-1 flex items-center">
                                        <span className="inline-flex items-center whitespace-nowrap font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400 leading-none shrink-0">
                                          {custId}
                                        </span>
                                      </div>
                                    )}
                                    <h5 className="text-xs sm:text-sm font-bold text-black dark:text-white break-words leading-snug">
                                      {customerName}
                                    </h5>
                                  </div>

                                  {/* 2. Detail Teknis (SN ONT & Interface) */}
                                  <div className="space-y-1 pt-1 text-[11px] font-mono text-black dark:text-white">
                                    <div className="flex items-baseline gap-1 break-all">
                                      <span className="text-black/60 dark:text-white/60 shrink-0 text-[10px]">SN:</span>
                                      <span className="font-semibold text-black dark:text-white">
                                        {port.onu_serial || '—'}
                                      </span>
                                    </div>
                                    <div className="flex items-baseline gap-1 break-all">
                                      <span className="text-black/60 dark:text-white/60 shrink-0 text-[10px]">IF:</span>
                                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                        {port.olt_port_name
                                          ? (port.olt_port_name.startsWith('gpon') ? port.olt_port_name : `gpon_olt_${port.olt_port_name}`)
                                          : (odpDetailData?.display_olt_ref && odpDetailData.display_olt_ref !== '—' ? odpDetailData.display_olt_ref : 'gpon_olt_1/1/1')}
                                      </span>
                                    </div>
                                  </div>

                                  {/* 3. Redaman Optik */}
                                  <div className="pt-2 border-t border-black/20 dark:border-white/20 flex items-center justify-between">
                                    <span className="text-[10px] text-black/70 dark:text-white/70 font-medium">Redaman Rx:</span>
                                    <span className={`text-[11px] font-mono ${rxTextColor}`}>
                                      {rxText}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="py-5 text-center flex flex-col items-center justify-center">
                                  <div className="w-8 h-8 rounded-full border border-dashed border-black/40 dark:border-white/40 flex items-center justify-center text-black/50 dark:text-white/50 mb-1.5">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                  </div>
                                  <p className="text-[11px] font-medium text-black/50 dark:text-white/50">Port Tersedia</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Pinned Modal Footer */}
            <div className="px-5 py-3.5 bg-black/5 dark:bg-white/5 border-t border-black/20 dark:border-white/20 flex items-center justify-between flex-shrink-0">
              <div className="text-[11px] text-black/70 dark:text-white/70 font-mono truncate mr-2">
                {selectedOdp.name?.startsWith('ODP') ? selectedOdp.name : `ODP ${selectedOdp.name}`} · {selectedOdp.total_ports || 8} Port
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleScreenshotOdp}
                  disabled={capturingScreenshot}
                  className="no-screenshot px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-md flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {capturingScreenshot ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : screenshotSuccess ? (
                    <>
                      <svg className="w-4 h-4 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-emerald-200">Tersimpan</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <circle cx="12" cy="13" r="3" strokeWidth={2} />
                      </svg>
                      <span>Screenshot</span>
                    </>
                  )}
                </button>
                <button
                  onClick={closeOdpDetail}
                  className="no-screenshot px-4 py-2 rounded-md border border-black/30 dark:border-white/30 text-xs font-bold text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── Modal Full Spesifikasi Data Lengkap ODP ─── */}
      {viewFullOdpModal && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto bg-black/60 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen" onClick={closeFullOdpModal}>
          <div
            className="relative w-full max-w-2xl bg-white dark:bg-black rounded-lg sm:rounded-xl shadow-2xl border border-black/70 dark:border-white/70 my-auto max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150 text-black dark:text-white"
            onClick={e => e.stopPropagation()}
          >
            {(() => {
              const node = fullOdpData?.node ?? viewFullOdpModal;
              if (!node) return null;
              const displayOltRef = fullOdpData?.display_olt_ref || displayInterface(node?.olt_port_ref);
              const attenuation = fullOdpData?.attenuation;
              const ports = fullOdpData?.ports ?? [];
              const hasCoords = Boolean(node?.latitude && node?.longitude);

              return (
                <>
                  <div className="bg-white dark:bg-black text-black dark:text-white px-5 py-4 flex items-center justify-between flex-shrink-0 border-b border-black/20 dark:border-white/20">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm sm:text-base font-bold text-black dark:text-white">Spesifikasi &amp; Data Lengkap ODP</h3>
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-600 text-white uppercase">
                          TERMINAL ODP
                        </span>
                      </div>
                      <p className="text-[11px] text-black/70 dark:text-white/70 font-mono mt-0.5">{node.name}</p>
                    </div>
                    <button onClick={closeFullOdpModal} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white font-bold cursor-pointer transition-colors">✕</button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs">
                    {loadingFullOdp ? (
                      <div className="py-12 text-center text-black/50 dark:text-white/50 font-medium space-y-2">
                        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                        <p>Memuat spesifikasi lengkap ODP...</p>
                      </div>
                    ) : (
                      <>
                        <div className="bg-black/5 dark:bg-white/5 rounded-lg p-3.5 sm:p-4 border border-black/20 dark:border-white/20 space-y-3">
                          <h4 className="font-bold text-black dark:text-white uppercase tracking-wider text-[11px]">1. Identitas Node &amp; Status</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <span className="text-black/50 dark:text-white/50 block text-[10px]">Nama ODP</span>
                              <span className="font-bold text-black dark:text-white uppercase">{node.name}</span>
                            </div>
                            <div>
                              <span className="text-black/50 dark:text-white/50 block text-[10px]">Tipe Node</span>
                              <span className="font-semibold text-black dark:text-white">ODP (Optical Distribution Point)</span>
                            </div>
                            <div>
                              <span className="text-black/50 dark:text-white/50 block text-[10px]">Status Operasional</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${STATUS_META[node.status]?.pill}`}>
                                {STATUS_META[node.status]?.label}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-black/5 dark:bg-white/5 rounded-lg p-3.5 sm:p-4 border border-black/20 dark:border-white/20 space-y-3">
                          <h4 className="font-bold text-black dark:text-white uppercase tracking-wider text-[11px]">2. Upstream ODC &amp; Perangkat OLT</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <span className="text-black/50 dark:text-white/50 block text-[10px]">ODC Induk (Upstream)</span>
                              <span className="font-bold text-black dark:text-white">{node.parent_node?.name || '—'}</span>
                            </div>
                            <div>
                              <span className="text-black/50 dark:text-white/50 block text-[10px]">Perangkat OLT</span>
                              <span className="font-bold text-black dark:text-white">{node.olt_device?.name || node.parent_node?.olt_device?.name || 'Auto-Detect OLT'}</span>
                            </div>
                            <div>
                              <span className="text-black/50 dark:text-white/50 block text-[10px]">Interface OLT PON</span>
                              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{displayOltRef}</span>
                            </div>
                            <div>
                              <span className="text-black/50 dark:text-white/50 block text-[10px]">Status Sinyal Rx Power</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border inline-block ${getRxColor(attenuation?.avg_rx_power ?? node.rx_power)}`}>
                                {attenuation?.avg_rx_power ? `${parseFloat(attenuation.avg_rx_power).toFixed(2)} dBm (Rata-rata)` : (node.rx_power != null ? `${parseFloat(node.rx_power).toFixed(2)} dBm` : 'Normal (-21.50 dBm)')}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-black/5 dark:bg-white/5 rounded-lg p-3.5 sm:p-4 border border-black/20 dark:border-white/20 space-y-3">
                          <h4 className="font-bold text-black dark:text-white uppercase tracking-wider text-[11px]">3. Spesifikasi Teknis Optik &amp; Splitter</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <span className="text-black/50 dark:text-white/50 block text-[10px]">Rasio Splitter ODP</span>
                              <span className="font-bold text-black dark:text-white">Rasio {node.splitter_config || node.splitter_type?.ratio || '1:8'}</span>
                            </div>
                            <div>
                              <span className="text-black/50 dark:text-white/50 block text-[10px]">Informasi Tube &amp; Warna Core</span>
                              <span className="font-semibold text-black dark:text-white">{node.tube_info || '—'} (Core {node.core_color || '—'})</span>
                            </div>
                            <div>
                              <span className="text-black/50 dark:text-white/50 block text-[10px]">Kapasitas Total Port</span>
                              <span className="font-mono font-bold text-black dark:text-white">{node.total_ports} Port</span>
                            </div>
                            <div>
                              <span className="text-black/50 dark:text-white/50 block text-[10px]">Port Terisi (Digunakan)</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                {node.used_ports}/{node.total_ports} Port ({pct(node.used_ports, node.total_ports)}%)
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-black/5 dark:bg-white/5 rounded-lg p-3.5 sm:p-4 border border-black/20 dark:border-white/20 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-black dark:text-white uppercase tracking-wider text-[11px]">4. Lokasi &amp; Pemetaan Koordinat</h4>
                            {hasCoords && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${node.latitude},${node.longitude}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                              >
                                Buka di Google Maps ↗
                              </a>
                            )}
                          </div>
                          <div className="space-y-2">
                            <div>
                              <span className="text-black/50 dark:text-white/50 block text-[10px]">Alamat Lengkap / Area</span>
                              <span className="font-medium text-black dark:text-white uppercase">{node.address || '—'}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-black/20 dark:border-white/20">
                              <div>
                                <span className="text-black/50 dark:text-white/50 block text-[10px]">Koordinat Desimal</span>
                                <span className="font-mono text-black dark:text-white">{hasCoords ? `${node.latitude}, ${node.longitude}` : '—'}</span>
                              </div>
                              <div>
                                <span className="text-black/50 dark:text-white/50 block text-[10px]">Koordinat DMS</span>
                                <span className="font-mono text-black dark:text-white">{hasCoords ? decimalToDms(node.latitude, node.longitude).formattedDms : '—'}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {ports.length > 0 && (
                          <div className="bg-black/5 dark:bg-white/5 rounded-lg p-3.5 sm:p-4 border border-black/20 dark:border-white/20 space-y-3">
                            <h4 className="font-bold text-black dark:text-white uppercase tracking-wider text-[11px]">5. Daftar Port Pelanggan ({ports.length} Port)</h4>
                            <div className="max-h-48 overflow-y-auto rounded-md border border-black/20 dark:border-white/20">
                              <table className="w-full text-left text-[11px]">
                                <thead className="bg-black/5 dark:bg-white/5 text-black/70 dark:text-white/70 font-semibold sticky top-0">
                                  <tr>
                                    <th className="py-2 px-3">Port</th>
                                    <th className="py-2 px-3">Pelanggan / Label</th>
                                    <th className="py-2 px-3">Status</th>
                                    <th className="py-2 px-3">Rx Sinyal</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-black/20 dark:divide-white/20 bg-white dark:bg-black">
                                  {ports.map((p) => (
                                    <tr key={p.id} className="hover:bg-black/5 dark:hover:bg-white/5">
                                      <td className="py-1.5 px-3 font-mono font-bold text-black dark:text-white">P-{p.port_number}</td>
                                      <td className="py-1.5 px-3 font-medium text-black dark:text-white">
                                        {p.customer_name_cache || p.customer_name || p.notes || '—'}
                                      </td>
                                      <td className="py-1.5 px-3">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.status === 'used' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-black/10 dark:bg-white/10 text-black/70 dark:text-white/70'}`}>
                                          {p.status === 'used' ? 'Terisi' : 'Kosong'}
                                        </span>
                                      </td>
                                      <td className="py-1.5 px-3 font-mono text-[10px]">
                                        {p.rx_power != null ? `${parseFloat(p.rx_power).toFixed(2)} dBm` : '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Pinned Footer */}
                  <div className="px-5 py-3.5 bg-black/5 dark:bg-white/5 border-t border-black/20 dark:border-white/20 flex items-center justify-between flex-shrink-0">
                    {canCrud ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => { onEditNode(node); closeFullOdpModal(); }}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-md shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                        >
                          Edit ODP
                        </button>
                      </div>
                    ) : <div />}
                    <button
                      onClick={closeFullOdpModal}
                      className="px-4 py-2 rounded-md border border-black/30 dark:border-white/30 text-xs font-bold text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      Tutup
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>,
        document.body
      )}

      {/* MODAL FITUR MAINTENANCE ODP & BROADCAST ALERT */}
      {maintenanceModalNode && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto bg-black/60 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen" onClick={closeMaintenanceModal}>
          <div
            className="relative w-full max-w-2xl bg-white dark:bg-black rounded-lg sm:rounded-xl shadow-2xl border border-black/70 dark:border-white/70 my-auto max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150 text-black dark:text-white"
            onClick={e => e.stopPropagation()}
          >
            
            {/* Modal Header */}
            <div className="bg-white dark:bg-black text-black dark:text-white px-5 py-4 flex items-center justify-between flex-shrink-0 border-b border-black/20 dark:border-white/20">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-black dark:text-white tracking-tight">
                      {maintenanceModalNode.status === 'maintenance'
                        ? 'Kelola / Selesaikan Maintenance ODP'
                        : 'Mulai Maintenance ODP & Kirim Alert'}
                    </h3>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 uppercase tracking-wider">
                      ODP NODE
                    </span>
                  </div>
                  <p className="text-[11px] text-black/70 dark:text-white/70 font-mono mt-0.5">
                    {maintenanceModalNode.name}
                  </p>
                </div>
              </div>
              <button
                onClick={closeMaintenanceModal}
                disabled={submittingMaintenance}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white font-bold transition-colors disabled:opacity-50 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs">
              {/* Status Alert Banner */}
              {maintenanceModalNode.status === 'maintenance' ? (
                <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-400 dark:border-amber-600/60 text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                  <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <h5 className="font-bold text-xs uppercase tracking-wide">Status ODP: Sedang Dalam Maintenance</h5>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">
                      ODP ini saat ini tercatat dalam masa pemeliharaan teknis. Klik tombol <strong>Selesaikan Maintenance</strong> di bawah jika pekerjaan telah rampung agar status kembali <strong>Aktif</strong> dan notifikasi pemulihan dikirim ke sistem &amp; Telegram NOC.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                  <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h5 className="font-bold text-xs uppercase tracking-wide">Pemberitahuan Pemeliharaan Jaringan</h5>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">
                      Mengaktifkan maintenance akan mengubah status ODP menjadi <span className="font-bold text-amber-700 dark:text-amber-400">Maintenance</span> dan secara otomatis mendistribusikan notifikasi alert siaran ke seluruh pengguna sistem UNMS serta kanal Telegram NOC mengenai detail pemeliharaan beserta jumlah pelanggan terdampak.
                    </p>
                  </div>
                </div>
              )}

              {/* Node Specifications & Affected Customers Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-black/5 dark:bg-white/5 p-3 rounded-lg border border-black/20 dark:border-white/20">
                  <span className="text-black/50 dark:text-white/50 text-[10px] block font-medium">Upstream ODC</span>
                  <span className="font-bold text-black dark:text-white text-xs block mt-0.5">
                    {maintenanceInfo?.node?.parent_name || maintenanceModalNode.parent_node?.name || '—'}
                  </span>
                </div>
                <div className="bg-black/5 dark:bg-white/5 p-3 rounded-lg border border-black/20 dark:border-white/20">
                  <span className="text-black/50 dark:text-white/50 text-[10px] block font-medium">OLT &amp; Interface PON</span>
                  <span className="font-bold text-black dark:text-white text-xs block mt-0.5">
                    {maintenanceInfo?.node?.olt_device || maintenanceModalNode.olt_device?.name || 'Auto-Detect OLT'}
                  </span>
                  <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold block">
                    {displayInterface(maintenanceInfo?.node?.olt_port_ref || maintenanceModalNode.olt_port_ref)}
                  </span>
                </div>
                <div className="bg-black/5 dark:bg-white/5 p-3 rounded-lg border border-amber-500/40 flex flex-col justify-center">
                  <span className="text-amber-600 dark:text-amber-400 text-[10px] block font-bold uppercase tracking-wider">
                    Pelanggan Terdampak
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                      {loadingMaintenanceInfo ? '...' : (maintenanceInfo?.impacted_count ?? 0)}
                    </span>
                    <span className="text-xs font-semibold text-amber-600/80 dark:text-amber-400/80">
                      Pelanggan
                    </span>
                  </div>
                </div>
              </div>

              {/* Impacted Customers Table */}
              <div className="bg-black/5 dark:bg-white/5 rounded-lg p-3.5 sm:p-4 border border-black/20 dark:border-white/20 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-black dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-black/50 dark:text-white/50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span>Daftar Pelanggan Terhubung Pada Node Ini</span>
                  </h4>
                  <span className="text-[10px] text-black/50 dark:text-white/50 font-mono">
                    {loadingMaintenanceInfo ? 'Memuat...' : `${maintenanceInfo?.impacted_count ?? 0} Pelanggan`}
                  </span>
                </div>

                {loadingMaintenanceInfo ? (
                  <div className="py-6 text-center text-black/50 dark:text-white/50 space-y-2">
                    <div className="w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-[11px]">Memeriksa daftar pelanggan terdampak pada ODP...</p>
                  </div>
                ) : maintenanceInfo?.impacted_customers?.length > 0 ? (
                  <div className="max-h-44 overflow-y-auto rounded-md border border-black/20 dark:border-white/20 bg-white dark:bg-black">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-black/5 dark:bg-white/5 text-black/70 dark:text-white/70 font-semibold sticky top-0">
                        <tr>
                          <th className="py-1.5 px-3">Nomor Port</th>
                          <th className="py-1.5 px-3">ID Pelanggan</th>
                          <th className="py-1.5 px-3">Nama Pelanggan</th>
                          <th className="py-1.5 px-3 text-right">Redaman</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/20 dark:divide-white/20 text-black dark:text-white">
                        {maintenanceInfo.impacted_customers.map((c, i) => (
                          <tr key={i} className="hover:bg-black/5 dark:hover:bg-white/5">
                            <td className="py-1.5 px-3 font-mono font-bold text-black/70 dark:text-white/70">P-{c.port_number}</td>
                            <td className="py-1.5 px-3 font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                              {c.customer_number && c.customer_number !== '—' ? c.customer_number : (c.service_number !== '—' ? c.service_number : '—')}
                            </td>
                            <td className="py-1.5 px-3 font-semibold text-black dark:text-white">
                              {c.name}
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono text-[10px]">
                              {c.rx_power != null && isFinite(Number(c.rx_power))
                                ? `${parseFloat(c.rx_power).toFixed(2)} dBm`
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-4 text-center text-black/50 dark:text-white/50 bg-white dark:bg-black rounded-md border border-dashed border-black/30 dark:border-white/30">
                    <p className="text-[11px] font-medium">Tidak ada pelanggan aktif yang terhubung pada port ODP ini.</p>
                  </div>
                )}
              </div>

              {/* Maintenance Settings Form */}
              <div className="space-y-3 pt-1">
                {/* Estimated Duration */}
                <div>
                  <label className="block text-[11px] font-bold text-black dark:text-white mb-1.5 uppercase tracking-wide">
                    Estimasi Durasi Pengerjaan
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {['30 Menit', '1 Jam', '2 Jam', '4 Jam', 'Selesai Hari Ini'].map(dur => (
                      <button
                        key={dur}
                        type="button"
                        onClick={() => setMaintenanceDuration(dur)}
                        className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                          maintenanceDuration === dur
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-white dark:bg-black text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/10 border border-black/30 dark:border-white/30'
                        }`}
                      >
                        {dur}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={maintenanceDuration}
                    onChange={e => setMaintenanceDuration(e.target.value)}
                    placeholder="Atau ketik durasi kustom (misal: 3 Jam, Sampai Pukul 17:00 WIB)"
                    className="w-full px-3 py-2 bg-white dark:bg-black border border-black/30 dark:border-white/30 rounded-md text-xs sm:text-sm text-black dark:text-white placeholder-black/40 dark:placeholder-white/40 focus:outline-none focus:border-amber-500 transition-all font-medium"
                  />
                </div>

                {/* Maintenance Notes */}
                <div>
                  <label className="block text-[11px] font-bold text-black dark:text-white mb-1.5 uppercase tracking-wide">
                    Keterangan / Rincian Pekerjaan Pemeliharaan
                  </label>
                  <textarea
                    rows={3}
                    value={maintenanceNotes}
                    onChange={e => setMaintenanceNotes(e.target.value)}
                    placeholder="Contoh: Perbaikan kabel distribusi fiber optic, penggantian pigtail splitter ODP, perapihan kabel dropcore..."
                    className="w-full px-3 py-2 bg-white dark:bg-black border border-black/30 dark:border-white/30 rounded-md text-xs sm:text-sm text-black dark:text-white placeholder-black/40 dark:placeholder-white/40 focus:outline-none focus:border-amber-500 transition-all font-medium"
                  />
                </div>

                {/* Broadcast Telegram & System Notification Checkbox */}
                <label className="flex items-center gap-2.5 p-3 rounded-lg bg-black/5 dark:bg-white/5 border border-black/20 dark:border-white/20 cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                  <input
                    type="checkbox"
                    checked={sendTelegramNotif}
                    onChange={e => setSendTelegramNotif(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-black/30 dark:border-white/30"
                  />
                  <div className="flex-1">
                    <span className="font-bold text-black dark:text-white text-xs block">
                      Kirim Pesan Alert ke Notifikasi Sistem &amp; Telegram NOC
                    </span>
                    <span className="text-[10px] text-black/50 dark:text-white/50 block">
                      Otomatis membuat notifikasi siaran (Broadcast) dan mengirim pesan detail ke bot Telegram NOC dengan rincian {maintenanceInfo?.impacted_count ?? 0} pelanggan terdampak.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Pinned Modal Footer Actions */}
            <div className="px-5 py-3.5 bg-black/5 dark:bg-white/5 border-t border-black/20 dark:border-white/20 flex items-center justify-between flex-shrink-0">
              <button
                type="button"
                onClick={closeMaintenanceModal}
                disabled={submittingMaintenance}
                className="px-4 py-2 rounded-md border border-black/30 dark:border-white/30 text-xs font-bold text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>

              <div className="flex items-center gap-2">
                {maintenanceModalNode.status === 'maintenance' ? (
                  <button
                    type="button"
                    disabled={submittingMaintenance}
                    onClick={() => handleToggleMaintenance('end')}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-md shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {submittingMaintenance ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Memproses...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Selesaikan Maintenance &amp; Pulihkan Normal</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={submittingMaintenance}
                    onClick={() => handleToggleMaintenance('start')}
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-md shadow-md shadow-amber-600/20 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {submittingMaintenance ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Mengirim Alert &amp; Memulai...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Mulai Maintenance &amp; Kirim Alert</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN PAGE CONTROLLER
══════════════════════════════════════════════════════════════════ */
export default function NetworkInfrastructure() {
  const { hasRole } = useAuth();
  const canCrud = hasRole('Super Administrator', 'Operator Jaringan');
  const [searchParams] = useSearchParams();
  const scopedOltId = searchParams.get('olt_id');

  const [activeTab, setActiveTab] = useState('ODP'); // 'ODP' | 'ODC' | 'POP'
  const [stats, setStats] = useState(null);
  const [allNodes, setAllNodes] = useState([]);
  const [splitterTypes, setSplitterTypes] = useState([]);
  const [oltDevices, setOltDevices] = useState([]);

  const [selectedPop, setSelectedPop] = useState(null);
  const [popCables, setPopCables] = useState([]);
  const [loadingCables, setLoadingCables] = useState(false);

  // Find active scoped OLT if olt_id is provided in URL
  const activeScopedOlt = useMemo(() => {
    return scopedOltId ? oltDevices.find(o => String(o.id) === String(scopedOltId)) : null;
  }, [scopedOltId, oltDevices]);

  // Filter nodes according to active scoped OLT ("Kamar Pribadi per OLT")
  const filteredAllNodes = useMemo(() => {
    if (!scopedOltId) return allNodes;
    return allNodes.filter(n => {
      if (String(n.olt_device_id) === String(scopedOltId)) return true;
      if (n.parent_node && String(n.parent_node.olt_device_id) === String(scopedOltId)) return true;
      if (n.parent_node?.parent_node && String(n.parent_node.parent_node.olt_device_id) === String(scopedOltId)) return true;
      return false;
    });
  }, [allNodes, scopedOltId]);

  const pops = useMemo(() => {
    const scopedPops = scopedOltId
      ? allNodes.filter(n => n.node_type === 'POP' && (String(n.olt_device_id) === String(scopedOltId) || (n.olt_device && String(n.olt_device.id) === String(scopedOltId))))
      : [];
    const list = (scopedOltId && scopedPops.length > 0)
      ? scopedPops
      : allNodes.filter(n => n.node_type === 'POP');
    return [...list].sort(naturalNodeCompare);
  }, [allNodes, scopedOltId]);

  const odcs = useMemo(() => {
    return filteredAllNodes
      .filter(n => n.node_type === 'ODC')
      .sort(naturalNodeCompare);
  }, [filteredAllNodes]);

  const odps = useMemo(() => {
    return filteredAllNodes
      .filter(n => n.node_type === 'ODP')
      .sort(naturalNodeCompare);
  }, [filteredAllNodes]);

  const [modalAddNode, setModalAddNode] = useState(null); // { type }
  const [showAddCableModal, setShowAddCableModal] = useState(false);
  const [editingCable, setEditingCable] = useState(null);
  const [showKmlModal, setShowKmlModal] = useState(false);
  const [kmlInitialTarget, setKmlInitialTarget] = useState('all');

  const handleOpenKml = (target = 'all') => {
    setKmlInitialTarget(target);
    setShowKmlModal(true);
  };

  const [savingNode, setSavingNode] = useState(false);
  const [savingCable, setSavingCable] = useState(false);
  const [nodeErr, setNodeErr] = useState(null);
  const [cableErr, setCableErr] = useState(null);

  // Custom Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Ya, Hapus',
    cancelText: 'Batal',
    type: 'danger',
    loading: false,
    onConfirm: null,
  });

  const openConfirm = ({ title, message, confirmText, type = 'danger', onConfirm }) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      confirmText,
      cancelText: 'Batal',
      type,
      loading: false,
      onConfirm: () => {
        setConfirmDialog(prev => ({ ...prev, loading: true }));
        onConfirm();
      },
    });
  };

  const closeConfirm = () => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false, loading: false }));
  };

  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    if (typeof window !== 'undefined' && window.showAppAlert) {
      window.showAppAlert({
        type: type === 'error' ? 'error' : 'success',
        title: type === 'error' ? 'Pemberitahuan Gagal' : 'Berhasil!',
        message: msg,
        duration: 2600,
      });
    }
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  /* Fetch Stats */
  const fetchStats = useCallback(async () => {
    try {
      const r = await fetch('/api/network-nodes/stats');
      const d = await r.json();
      setStats(d);
    } catch { }
  }, []);

  /* Fetch All Nodes */
  const fetchAllNodes = useCallback(async () => {
    try {
      const r = await fetch('/api/network-nodes?per_page=10000');
      const d = await r.json();
      const list = d.data ?? [];
      setAllNodes(list);
    } catch { setAllNodes([]); }
  }, []);

  /* Fetch Splitter Types */
  const fetchSplitterTypes = useCallback(async () => {
    try {
      const r = await fetch('/api/network-nodes/splitter-types');
      const d = await r.json();
      setSplitterTypes(d ?? []);
    } catch { setSplitterTypes([]); }
  }, []);

  /* Fetch OLT Devices */
  const fetchOltDevices = useCallback(async () => {
    try {
      const r = await fetch('/api/olt-devices?per_page=100');
      const d = await r.json();
      setOltDevices(d.data ?? []);
    } catch { setOltDevices([]); }
  }, []);

  /* Fetch Cables & Core Matrix for selected POP */
  const fetchPopCables = useCallback(async (popId, silent = false) => {
    if (!popId) return;
    if (!silent) setLoadingCables(true);
    try {
      const r = await fetch(`/api/network-nodes/${popId}/pop-cables`);
      const d = await r.json();
      if (d.cables) setPopCables(d.cables);
    } catch {
      // Keep existing data
    }
    finally { setLoadingCables(false); }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchAllNodes();
    fetchSplitterTypes();
    fetchOltDevices();
  }, [fetchStats, fetchAllNodes, fetchSplitterTypes, fetchOltDevices]);

  useEffect(() => {
    if (selectedPop) {
      fetchPopCables(selectedPop.id, false);
    }
  }, [selectedPop, fetchPopCables]);

  // Auto pre-select POP matching the active OLT room so data appears immediately
  useEffect(() => {
    if (pops.length > 0) {
      const isStillValid = selectedPop && pops.some(p => p.id === selectedPop.id);
      if (!isStillValid) {
        setSelectedPop(pops[0]);
      }
    } else {
      setSelectedPop(null);
    }
  }, [scopedOltId, pops]);

  const [refreshKey, setRefreshKey] = useState(0);

  const refreshAll = useCallback((silent = true) => {
    fetchStats();
    fetchAllNodes();
    if (selectedPop) fetchPopCables(selectedPop.id, silent);
    setRefreshKey(k => k + 1);
  }, [fetchStats, fetchAllNodes, selectedPop, fetchPopCables]);

  const { isRefreshing, triggerRefresh, timeAgoText } = useAutoRefresh(refreshAll);

  /* Save Node (Create / Update) */
  const handleSaveNode = async (form) => {
    setSavingNode(true);
    setNodeErr(null);
    try {
      const isEdit = !!modalAddNode?.editNode;
      const url = isEdit ? `/api/network-nodes/${modalAddNode.editNode.id}` : '/api/network-nodes';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? ''
        },
        body: JSON.stringify(form)
      });
      if (!res.ok) {
        const err = await res.json();
        const errStr = err.errors ? (typeof err.errors === 'object' ? Object.values(err.errors).flat().join(', ') : err.errors) : (err.message ?? 'Gagal menyimpan node');
        setNodeErr(errStr);
        if (typeof window !== 'undefined' && window.showAppAlert) {
          window.showAppAlert({
            type: 'error',
            title: 'Gagal Menyimpan Node!',
            message: errStr,
          });
        }
        return;
      }
      setModalAddNode(null);
      showToast(isEdit ? ' Node berhasil diperbarui!' : ' Node baru berhasil ditambahkan!');
      refreshAll();
    } finally {
      setSavingNode(false);
    }
  };

  /* Save Cable */
  const handleSaveCable = async (form) => {
    setSavingCable(true);
    setCableErr(null);
    try {
      const res = await fetch('/api/network-cables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? ''
        },
        body: JSON.stringify(form)
      });
      if (!res.ok) {
        const err = await res.json();
        const errStr = err.errors ? (typeof err.errors === 'object' ? Object.values(err.errors).flat().join(', ') : err.errors) : (err.message ?? 'Gagal membuat kabel');
        setCableErr(errStr);
        if (typeof window !== 'undefined' && window.showAppAlert) {
          window.showAppAlert({
            type: 'error',
            title: 'Gagal Membuat Kabel!',
            message: errStr,
          });
        }
        return;
      }
      setShowAddCableModal(false);
      showToast('Kabel & Core Matrix TIA-598-A berhasil dibuat!');
      refreshAll();
    } finally {
      setSavingCable(false);
    }
  };

  /* Update Cable */
  const handleUpdateCable = async (form) => {
    if (!editingCable) return;
    setSavingCable(true);
    setCableErr(null);
    try {
      const res = await fetch(`/api/network-cables/${editingCable.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? ''
        },
        body: JSON.stringify(form)
      });
      if (!res.ok) {
        const err = await res.json();
        const errStr = err.errors ? (typeof err.errors === 'object' ? Object.values(err.errors).flat().join(', ') : err.errors) : (err.message ?? 'Gagal memperbarui kabel');
        setCableErr(errStr);
        if (typeof window !== 'undefined' && window.showAppAlert) {
          window.showAppAlert({
            type: 'error',
            title: 'Gagal Memperbarui Kabel!',
            message: errStr,
          });
        }
        return;
      }
      setEditingCable(null);
      showToast(' Data kabel berhasil diperbarui!');
      refreshAll();
    } finally {
      setSavingCable(false);
    }
  };

  /* Delete Cable */
  const handleDeleteCable = (cable) => {
    if (!cable) return;
    openConfirm({
      title: 'Hapus Kabel Fiber?',
      message: (
        <span>
          Apakah Anda yakin ingin menghapus kabel <strong className="text-slate-700 dark:text-slate-200">"{cable.name}"</strong> beserta <strong className="text-rose-600 dark:text-rose-400">SEMUA {cable.core_count_total} core datanya</strong>? <br />
          <span className="text-rose-600 dark:text-rose-400 font-bold mt-1 block">️ Tindakan ini tidak dapat dibatalkan!</span>
        </span>
      ),
      confirmText: 'Ya, Hapus Kabel',
      type: 'danger',
      onConfirm: async () => {
        try {
          await fetch(`/api/network-cables/${cable.id}`, {
            method: 'DELETE',
            headers: { 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '' }
          });
          closeConfirm();
          showToast('️ Kabel berhasil dihapus');
          refreshAll();
        } catch {
          closeConfirm();
        }
      },
    });
  };

  /* Delete Node */
  const handleDeleteNode = (node) => {
    if (!node) return;
    openConfirm({
      title: 'Hapus Node Infrastruktur?',
      message: (
        <span>
          Apakah Anda yakin ingin menghapus node <strong className="text-slate-700 dark:text-slate-200">"{node.name}"</strong>? Data titik lokasi ini akan dihapus permanen.
        </span>
      ),
      confirmText: 'Ya, Hapus Node',
      type: 'danger',
      onConfirm: async () => {
        try {
          await fetch(`/api/network-nodes/${node.id}`, {
            method: 'DELETE',
            headers: { 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '' }
          });
          closeConfirm();
          showToast('️ Node berhasil dihapus');
          refreshAll();
        } catch {
          closeConfirm();
        }
      },
    });
  };

  /* Delete All Nodes by Type (ODP / ODC) */
  const handleDeleteAllNodes = (type) => {
    const count = type === 'ODP' ? odps.length : type === 'ODC' ? odcs.length : 0;
    const typeLabel = type === 'ODC' ? 'ODC & ODP/MS' : type;

    openConfirm({
      title: `Hapus SEMUA Data ${typeLabel}?`,
      message: (
        <div className="space-y-2 text-left">
          <p>
            Apakah Anda yakin ingin menghapus <strong className="text-rose-600 dark:text-rose-400">SEMUA {count} unit {typeLabel}</strong>?
          </p>
          <p className="text-xs text-black/70 dark:text-white/70">
            {type === 'ODC'
              ? 'Relasi node induk pada ODP di bawah ODC ini akan dilepaskan secara aman, dan seluruh konfigurasi port ODC akan dibersihkan.'
              : 'Seluruh konfigurasi port, riwayat redaman, dan penugasan pelanggan pada ODP ini akan dibersihkan.'}
          </p>
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-700 dark:text-rose-300 font-bold">
            PERINGATAN: Tindakan ini bersifat permanen dan tidak dapat dibatalkan!
          </div>
        </div>
      ),
      confirmText: `Ya, Hapus Semua ${typeLabel} (${count})`,
      type: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch('/api/network-nodes/delete-all', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '',
            },
            body: JSON.stringify({
              node_type: type,
              scoped_olt_id: scopedOltId ? parseInt(scopedOltId) : null,
            }),
          });
          const data = await res.json();
          closeConfirm();
          if (res.ok && data.status === 'success') {
            showToast(data.message);
            refreshAll();
          } else {
            showToast(data.message || 'Gagal menghapus data', 'error');
          }
        } catch (err) {
          closeConfirm();
          showToast(`Gagal menghapus: ${err.message}`, 'error');
        }
      },
    });
  };

  const totalCores = popCables.reduce((a, c) => a + c.core_count_total, 0);
  const usedCores = popCables.reduce((a, c) => a + (c.cores ?? []).filter(cr => cr.status === 'used').length, 0);

  return (
    <div className="space-y-4 sm:space-y-6">



      {/* ── Top Header Banner ──────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-black border border-black/70 dark:border-white/70 p-5 rounded-lg shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-black dark:text-white tracking-tight font-sans">
            Data POP - ODC - ODP
          </h1>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {canCrud && (
            <button
              type="button"
              onClick={() => handleOpenKml('all')}
              className="px-3.5 py-2 bg-black hover:bg-black/80 text-white dark:bg-white dark:text-black dark:hover:bg-white/90 rounded-md text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>{scopedOltId && activeScopedOlt ? `Import KMZ/KML (${activeScopedOlt.name})` : 'Import KMZ / KML'}</span>
            </button>
          )}
          <RefreshButton
            isRefreshing={isRefreshing}
            onRefresh={triggerRefresh}
            lastUpdatedText={timeAgoText}
            label="Segarkan Infrastruktur"
          />
        </div>
      </div>

      {/* TAB NAVIGATION BAR (Sleek & Segmented) */}
      <div className="bg-white dark:bg-black p-1.5 rounded-lg border border-black/70 dark:border-white/70 shadow-xs flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('ODP')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-md text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${activeTab === 'ODP'
            ? 'bg-black text-white dark:bg-white dark:text-black shadow-xs'
            : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
            }`}
        >
          <span>ODP</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${activeTab === 'ODP' ? 'bg-white/20 dark:bg-black/20 text-white dark:text-black font-bold' : 'bg-black/10 dark:bg-white/10 text-black/70 dark:text-white/70'}`}>{odps.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('ODC')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-md text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${activeTab === 'ODC'
            ? 'bg-black text-white dark:bg-white dark:text-black shadow-xs'
            : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
            }`}
        >
          <span>ODC / MS</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${activeTab === 'ODC' ? 'bg-white/20 dark:bg-black/20 text-white dark:text-black font-bold' : 'bg-black/10 dark:bg-white/10 text-black/70 dark:text-white/70'}`}>{odcs.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('POP')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-md text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${activeTab === 'POP'
            ? 'bg-black text-white dark:bg-white dark:text-black shadow-xs'
            : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
            }`}
        >
          <span>POP</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${activeTab === 'POP' ? 'bg-white/20 dark:bg-black/20 text-white dark:text-black font-bold' : 'bg-black/10 dark:bg-white/10 text-black/70 dark:text-white/70'}`}>{pops.length}</span>
        </button>
      </div>

      {/* TAB CONTENTS */}
      {activeTab === 'ODP' && (
        <OdpTabContent
          odps={odps}
          onAddNode={t => setModalAddNode({ type: t })}
          onEditNode={node => setModalAddNode({ type: 'ODP', editNode: node })}
          onDeleteNode={handleDeleteNode}
          onDeleteAllNodes={handleDeleteAllNodes}
          refreshKey={refreshKey}
          onRefreshGlobal={refreshAll}
          onOpenKmlModal={handleOpenKml}
        />
      )}

      {activeTab === 'ODC' && (
        <OdcTabContent
          onAddNode={t => setModalAddNode({ type: t })}
          onAddMsNode={() => setModalAddNode({ type: 'ODP', isMsCreation: true })}
          onEditNode={node => setModalAddNode({ type: node.is_ms_node ? 'ODP' : 'ODC', editNode: node })}
          onDeleteNode={handleDeleteNode}
          onDeleteAllNodes={handleDeleteAllNodes}
          refreshKey={refreshKey}
          onRefreshGlobal={refreshAll}
          scopedOltId={scopedOltId}
          onOpenKmlModal={handleOpenKml}
        />
      )}

      {activeTab === 'POP' && (
        <PopTabContent
          pops={pops}
          selectedPop={selectedPop}
          onSelectPop={setSelectedPop}
          cables={popCables}
          loadingCables={loadingCables}
          allNodes={allNodes}
          onAddCable={() => setShowAddCableModal(true)}
          onEditCable={cable => { setEditingCable(cable); setCableErr(null); }}
          onDeleteCable={handleDeleteCable}
          onRefreshCables={() => fetchPopCables(selectedPop?.id)}
          onAddNode={t => setModalAddNode({ type: t })}
          onEditNode={node => setModalAddNode({ type: 'POP', editNode: node })}
          onDeleteNode={handleDeleteNode}
        />
      )}

      {/* Modal Add/Edit Node */}
      {modalAddNode && (
        <AddNodeModal
          type={modalAddNode.type}
          editNode={modalAddNode.editNode}
          parentNode={modalAddNode.parentNode || null}
          isMsCreation={modalAddNode.isMsCreation}
          allNodes={allNodes}
          splitterTypes={splitterTypes}
          oltDevices={oltDevices}
          onSave={handleSaveNode}
          onClose={() => { setModalAddNode(null); setNodeErr(null); }}
          loading={savingNode}
          error={nodeErr}
        />
      )}

      {/* Modal Add Cable */}
      {showAddCableModal && (
        <AddCableModal
          popNode={selectedPop || allNodes.find(n => n.node_type === 'POP') || allNodes[0]}
          cables={popCables}
          allNodes={allNodes}
          onSave={handleSaveCable}
          onClose={() => { setShowAddCableModal(false); setCableErr(null); }}
          loading={savingCable}
          error={cableErr}
        />
      )}

      {/* Modal Edit Cable */}
      {editingCable && (
        <EditCableModal
          cable={editingCable}
          allNodes={allNodes}
          onSave={handleUpdateCable}
          onClose={() => { setEditingCable(null); setCableErr(null); }}
          loading={savingCable}
          error={cableErr}
        />
      )}

      {/* Modal Import KML / KMZ */}
      <KmlImportModal
        isOpen={showKmlModal}
        onClose={() => setShowKmlModal(false)}
        initialTarget={kmlInitialTarget}
        scopedOltId={scopedOltId ? parseInt(scopedOltId) : null}
        scopedOltName={activeScopedOlt?.name || null}
        lockOlt={!!scopedOltId}
        onSuccess={() => {
          refreshAll();
          showToast(`Import KML/KMZ berhasil disimpan${activeScopedOlt ? ` ke OLT ${activeScopedOlt.name}` : ''}!`);
        }}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        type={confirmDialog.type}
        loading={confirmDialog.loading}
        onConfirm={confirmDialog.onConfirm}
        onClose={closeConfirm}
      />
    </div>
  );
}
