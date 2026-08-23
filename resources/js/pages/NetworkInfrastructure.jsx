import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';
import SearchableSelect from '../components/SearchableSelect';
import { dmsToDecimal, decimalToDms, parseCoordsInput } from '../utils/coordinateParser';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import RefreshButton from '../components/RefreshButton';

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
  active: { label: 'Aktif', dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  inactive: { label: 'Tidak Aktif', dot: 'bg-slate-400', pill: 'bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700' },
  maintenance: { label: 'Maintenance', dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-700 border-amber-200' },
  damaged: { label: 'Rusak', dot: 'bg-red-500', pill: 'bg-red-50 text-red-700 border-red-200' },
};

const pct = (used, total) => total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
const pctColor = p => p >= 90 ? 'bg-red-500' : p >= 70 ? 'bg-amber-500' : 'bg-emerald-500';

// Module-level helper: format OLT port reference display
const displayInterface = (ref) => {
  if (!ref) return '—';
  return ref.split(',').map(s => {
    const trimmed = s.trim();
    if (!trimmed) return '';
    const clean = trimmed.replace(/^(gpon[-_]olt_)/i, '');
    return `gpon_olt_${clean}`;
  }).filter(Boolean).join(', ');
};

function StatCard({ label, value, sub, badgeText }) {
  return (
    <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#3f3f46] rounded-lg p-4 flex flex-col justify-between shadow-2xs">
      <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
        <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
        {badgeText && (
          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-blue-100 dark:bg-neutral-900 text-blue-700 dark:text-blue-400">
            {badgeText}
          </span>
        )}
      </div>
      <div className="my-2.5 flex items-baseline justify-between">
        <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-sans">{value}</span>
      </div>
      {sub && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate pt-2 border-t border-slate-100 dark:border-[#1f1f1f]">
          {sub}
        </p>
      )}
    </div>
  );
}

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

  const fc = 'w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all font-medium';
  const lc = 'block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1';

  return createPortal(
    <div className="fixed inset-0 z-[99999] overflow-y-auto bg-black/75 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 my-auto max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
        <div className="bg-slate-900 dark:bg-slate-950 text-white px-5 py-4 flex items-center justify-between flex-shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs border ${colorMeta.bg} ${colorMeta.border} ${colorMeta.text}`}
              style={{ backgroundColor: colorMeta.hex, borderColor: colorMeta.borderHex }}
            >
              {core.core_number}
            </div>
            <div>
              <h3 className="text-base font-bold">Core #{core.core_number} — {getIndonesianColor(core.color)}</h3>
              <p className="text-xs text-slate-300">Tube {core.tube_number} ({getIndonesianColor(core.tube_color)}) · {cableName}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-400 font-bold">✕</button>
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
              <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-100 dark:bg-slate-700 rounded-xl text-xs font-semibold">
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

          <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50">
              Batal
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20">
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
  const [activeSlot, setActiveSlot] = useState(1);
  const [portSearch, setPortSearch] = useState('');
  const dropdownRef = useRef(null);

  const selectedPorts = useMemo(() => {
    if (!value) return [];
    return value.split(',').map(s => s.trim().replace(/^gpon-olt_/i, '').replace(/^gpon_olt_/i, '')).filter(Boolean);
  }, [value]);

  // Deteksi arsitektur OLT: Compact/Fixed Port (HSGQ, VSOL 4/8P) vs Modular Multi-Slot Chassis (ZTE C300, Huawei)
  const isCompactOlt = useMemo(() => {
    if (!selectedOlt) return false;
    const vendor = (selectedOlt.vendor || selectedOlt.vendor_key || selectedOlt.model || '').toUpperCase();
    const ports = selectedOlt.total_ports || 4;
    return vendor.includes('HSGQ') || vendor.includes('EPON') || (ports <= 8 && !vendor.includes('C300') && !vendor.includes('MA5680'));
  }, [selectedOlt]);

  // Ambil daftar port riil untuk OLT Compact
  const compactPorts = useMemo(() => {
    if (!selectedOlt) return [];

    // Dari snapshot telemetri database
    if (selectedOlt.last_telemetry_snapshot?.pon_ports?.length > 0) {
      return selectedOlt.last_telemetry_snapshot.pon_ports.map(p => ({
        id: p.port_id,
        label: p.port_id,
        status: p.status || 'Up',
      }));
    }

    const totalPorts = selectedOlt.total_ports || 4;
    const vendor = (selectedOlt.vendor || selectedOlt.vendor_key || '').toUpperCase();
    const prefix = vendor.includes('HSGQ') || vendor.includes('EPON') ? 'epon_0/' : 'gpon_0/';

    const list = [];
    for (let i = 1; i <= totalPorts; i++) {
      list.push({
        id: `${prefix}${i}`,
        label: `${prefix}${i}`,
        status: 'Up',
      });
    }
    return list;
  }, [selectedOlt]);

  // Penentuan Slot untuk OLT Modular (ZTE C300 = 16 Slot, C320 = 4 Slot, Huawei = 8-16 Slot)
  const maxSlots = useMemo(() => {
    if (!selectedOlt) return 4;
    const vendor = (selectedOlt.vendor || selectedOlt.model || '').toUpperCase();
    const ports = selectedOlt.total_ports || 0;
    if (vendor.includes('C300') || vendor.includes('MA5680T')) return 16;
    if (vendor.includes('C320') || vendor.includes('MA5608T')) return 4;
    return Math.max(1, Math.ceil((ports || 16) / 16));
  }, [selectedOlt]);

  const slots = useMemo(() => {
    const list = [];
    for (let i = 1; i <= maxSlots; i++) {
      list.push({ id: i, name: `Slot ${i}` });
    }
    return list;
  }, [maxSlots]);

  // Daftar 16 port dalam slot aktif untuk OLT Modular
  const portsInActiveSlot = useMemo(() => {
    const list = [];
    for (let i = 1; i <= 16; i++) {
      list.push({
        id: `1/${activeSlot}/${i}`,
        label: `Port ${String(i).padStart(2, '0')}`,
        shortLabel: `P${i}`,
        fullRef: `gpon-olt_1/${activeSlot}/${i}`,
      });
    }
    return list;
  }, [activeSlot]);

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
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
          INTERFACE PORT OLT
        </label>
        {selectedOlt && (
          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/70 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
            {selectedOlt.name} ({selectedOlt.vendor || 'OLT'})
          </span>
        )}
      </div>

      {/* Input Trigger Box */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="min-h-[44px] p-2 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer flex items-center justify-between gap-2 flex-wrap hover:border-indigo-500 dark:hover:border-indigo-400 transition-all shadow-2xs"
      >
        <div className="flex items-center gap-1.5 flex-wrap min-h-[26px]">
          {selectedPorts.length > 0 ? (
            selectedPorts.map(port => (
              <span
                key={port}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-2xs"
              >
                <span>{port}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removePort(port); }}
                  className="w-4 h-4 rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-800 flex items-center justify-center text-[10px] text-indigo-600 dark:text-indigo-400 hover:text-rose-500 font-extrabold transition-colors"
                >
                  ✕
                </button>
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-400 dark:text-slate-500 px-1 font-medium">
              — Klik untuk memilih Interface Port OLT —
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 text-xs text-slate-400 dark:text-slate-500 font-bold px-1">
          {selectedPorts.length > 0 && (
            <span className="text-[10px] bg-indigo-600 text-white font-extrabold px-2 py-0.5 rounded-full shadow-2xs">
              {selectedPorts.length} Port
            </span>
          )}
          <span className="text-[10px] text-slate-400">{isOpen ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Dropdown Floating Panel */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 sm:left-auto sm:right-0 sm:min-w-[420px] max-w-[500px] mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/90 rounded-2xl shadow-2xl p-4 space-y-3.5 animate-in fade-in zoom-in-95 duration-100">
          {/* Header Panel */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h5 className="font-bold text-xs text-slate-900 dark:text-slate-100">
                Pilih Interface ({isCompactOlt ? `${compactPorts.length} Port PON` : `Modular ${maxSlots} Slot Card`})
              </h5>
              <p className="text-[10px] text-slate-400">
                {selectedOlt ? `${selectedOlt.name} • ${selectedOlt.model || selectedOlt.vendor}` : 'Pilih interface yang mengarah ke ODC/ODP'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isCompactOlt ? (
                <button
                  type="button"
                  onClick={selectAllCompact}
                  className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Pilih Semua
                </button>
              ) : (
                <button
                  type="button"
                  onClick={selectAllSlot}
                  className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Pilih All Slot {activeSlot}
                </button>
              )}
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <button
                type="button"
                onClick={clearAll}
                className="text-[11px] font-bold text-rose-500 hover:underline"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Quick Search */}
          <div>
            <input
              type="text"
              placeholder="🔍 Cari interface (contoh: 1, epon, 1/1/4)..."
              value={portSearch}
              onChange={e => setPortSearch(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>

          {isCompactOlt ? (
            /* ══════════════════════════════════════════════════════════════
               LAYOUT A: COMPACT OLT (HSGQ 4-Port, VSOL, HIOSO)
            ══════════════════════════════════════════════════════════════ */
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {filteredCompactPorts.map(p => {
                  const isSelected = selectedPorts.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePort(p.id)}
                      className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/20'
                          : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-indigo-400 dark:hover:border-indigo-500'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500'}`} />
                        <span className="font-mono text-xs font-bold tracking-tight">{p.label}</span>
                      </div>
                      <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      }`}>
                        {isSelected ? '✓ Aktif' : p.status}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ══════════════════════════════════════════════════════════════
               LAYOUT B: MODULAR CHASSIS OLT (ZTE C300/C320, HUAWEI)
            ══════════════════════════════════════════════════════════════ */
            <div className="space-y-3">
              {/* Slot / Card Tab Switcher */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Pilih Slot Card ({maxSlots} Slot Chassis):
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  {slots.map(s => {
                    const countInSlot = selectedPorts.filter(p => p.startsWith(`1/${s.id}/`)).length;
                    const isActive = activeSlot === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setActiveSlot(s.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                          isActive
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        <span>Slot {s.id}</span>
                        {countInSlot > 0 && (
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full ${
                            isActive ? 'bg-white text-indigo-700' : 'bg-indigo-600 text-white'
                          }`}>
                            {countInSlot}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 16 Port Grid in Active Slot */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-200 text-[11px]">
                    16 Port PON Slot {activeSlot} (Card 1/{activeSlot}/*):
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllSlot}
                      className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Pilih Semua
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={clearSlot}
                      className="text-[10px] font-bold text-rose-500 hover:underline"
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
                        className={`p-2.5 rounded-xl border text-xs font-mono font-bold transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
                        }`}
                      >
                        <span>{p.shortLabel}</span>
                        <span className={`text-[9px] px-1 py-0.5 rounded ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
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
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span>Terpilih: <strong className="text-indigo-600 dark:text-indigo-400">{selectedPorts.length} Interface</strong></span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors"
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
      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
        {label}
      </label>

      <div
        onClick={() => setIsOpen(!isOpen)}
        className="min-h-[42px] p-2 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer flex items-center justify-between gap-2 flex-wrap hover:border-indigo-500 transition-all"
      >
        <div className="flex items-center gap-1.5 flex-wrap min-h-[26px]">
          {selectedItems.length > 0 && selectedItems.map(item => {
            const matchedColor = FIBER_COLORS.find(c => c.name.toLowerCase() === item.toLowerCase());
            return (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 shadow-2xs"
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
        <span className="text-xs text-slate-400 dark:text-slate-500 font-bold px-1">
          {isOpen ? '▲' : '▼'}
        </span>
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-3 space-y-3 animate-in fade-in zoom-in-95 duration-100">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex justify-between items-center">
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
                  className={`px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-900 dark:text-indigo-200 border-indigo-400 font-bold shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10" style={{ backgroundColor: c.hex }} />
                  <span className="truncate">{c.name}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <input
              type="text"
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={handleAddCustom}
              placeholder="Masukan detail / daya kustom (cth: +2.5 dBm) tekan Enter..."
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      )}
      {helpText && <p className="text-[10px] text-slate-400 dark:text-slate-500">{helpText}</p>}
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
      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
        {label}
      </label>

      <div
        onClick={() => setIsOpen(!isOpen)}
        className="min-h-[42px] p-2 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer flex items-center justify-between gap-2 flex-wrap hover:border-indigo-500 transition-all"
      >
        <div className="flex items-center gap-1.5 flex-wrap min-h-[26px]">
          {selectedItems.length > 0 && selectedItems.map(item => {
            const matchedTube = STANDARD_TUBES.find(t => t.label.toLowerCase() === item.toLowerCase());
            return (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 shadow-2xs"
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
        <span className="text-xs text-slate-400 dark:text-slate-500 font-bold px-1">
          {isOpen ? '▲' : '▼'}
        </span>
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-3 space-y-3 animate-in fade-in zoom-in-95 duration-100">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex justify-between items-center">
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
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/80 text-blue-900 dark:text-blue-200 border-blue-400 font-bold shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-300'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10" style={{ backgroundColor: t.hex }} />
                  <span className="truncate text-[11px]">{t.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <input
              type="text"
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={handleAddCustom}
              placeholder="Masukan tube kustom (cth: Tube Special A) tekan Enter..."
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      )}
      {helpText && <p className="text-[10px] text-slate-400 dark:text-slate-500">{helpText}</p>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MODAL ADD/EDIT NODE (POP / ODC / ODP)
══════════════════════════════════════════════════════════════════ */
function AddNodeModal({ type, editNode, parentNode, allNodes, splitterTypes, oltDevices, onSave, onClose, loading, error }) {
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
    parent_node_id: editNode?.parent_node_id ?? parentNode?.id ?? '',
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

  const fc = 'w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all font-medium';
  const lc = 'block text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-1';

  return createPortal(
    <div className="fixed inset-0 z-[99999] overflow-y-auto bg-black/75 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 my-auto max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
        
        {/* Pinned Header */}
        <div className="bg-slate-900 dark:bg-slate-950 text-white px-5 py-3.5 flex items-center justify-between flex-shrink-0 border-b border-slate-800">
          <div>
            <h3 className="text-sm sm:text-base font-bold">{isEdit ? '✏️ Edit Node' : '➕ Tambah Node'} ({form.node_type})</h3>
            {parentNode && <p className="text-[11px] text-slate-300">di bawah: {parentNode.name}</p>}
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white font-bold cursor-pointer transition-colors">✕</button>
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
          <div className="space-y-2 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                <span>📍 Koordinat Lokasi Node</span>
              </label>
              <div className="flex gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => set('coord_mode', 'dms')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all ${form.coord_mode === 'dms'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                >
                  🌍 Google Earth (DMS)
                </button>
                <button
                  type="button"
                  onClick={() => set('coord_mode', 'decimal')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all ${form.coord_mode === 'decimal'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                >
                  🗺️ Google Maps (Desimal)
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
                {form.node_type === 'ODC' ? 'Node Induk (POP atau ODC Induk)' : 'Node Induk (ODC)'} *
              </label>
              <SearchableSelect
                value={form.parent_node_id}
                onChange={val => set('parent_node_id', val)}
                placeholder="— Pilih Induk —"
                searchPlaceholder="Cari nama / kode node..."
                required
                options={allNodes
                  .filter(n => {
                    if (form.node_type === 'ODC') return n.node_type === 'POP' || (n.node_type === 'ODC' && n.id !== editNode?.id);
                    return n.node_type === 'ODC';
                  })
                  .map(n => ({
                    value: n.id,
                    label: n.name,
                    sublabel: `Tipe: ${n.node_type}`
                  }))
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
            <div className="bg-emerald-50/50 dark:bg-slate-800/80 border border-emerald-200/80 dark:border-slate-700 rounded-2xl p-4 space-y-3">
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
              <div className="bg-white dark:bg-slate-900/90 border border-emerald-200 dark:border-emerald-900/60 rounded-xl p-3 space-y-2">
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
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
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

  const fc = 'w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all font-medium';
  const lc = 'block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-xl border border-slate-200 dark:border-slate-700 max-h-[92vh] flex flex-col overflow-hidden">
        <div className="bg-slate-900 dark:bg-slate-950 text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-base font-bold"> Tambah Kabel Fiber Optik Baru</h3>
            <p className="text-xs text-slate-300">Konfigurasi Node Asal, Node Tujuan, &amp; Core Matrix TIA-598-A</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-400 font-bold">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
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

          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-800">
            ℹ️ Sistem akan otomatis generate <strong>{form.core_count_total} core</strong> dalam <strong>{form.tube_count} tube</strong> ({Math.ceil(form.core_count_total / form.tube_count)} core/tube) sesuai standar TIA-598-A.
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">Batal</button>
            <button type="submit" disabled={loading} className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all disabled:opacity-50">
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

  const fc = 'w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all font-medium';
  const lc = 'block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-xl border border-slate-200 dark:border-slate-700 max-h-[92vh] flex flex-col overflow-hidden">
        <div className="bg-slate-900 dark:bg-slate-950 text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-base font-bold">️ Edit Kabel — {cable.name}</h3>
            <p className="text-xs text-slate-300 font-mono">{cable.code} · {cable.core_count_total} Core</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-400 font-bold">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
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
              <option value="active">🟢 Aktif</option>
              <option value="inactive">⚪ Non-Aktif</option>
              <option value="maintenance">🟡 Maintenance / Pemeliharaan</option>
              <option value="damaged">🔴 Rusak / Putus</option>
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

          <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50">Batal</button>
            <button type="submit" disabled={loading} className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20">
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
                    <span className="text-slate-500 dark:text-slate-400 font-normal ml-1">({cores.length} Core)</span>
                  </h4>
                  <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
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
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2 leading-relaxed bg-slate-100/70 dark:bg-slate-800/80 px-2 py-1 rounded-md border border-slate-200/50 dark:border-slate-700/50">
                            <span className="font-semibold text-slate-600 dark:text-slate-300">Catatan:</span> {core.notes}
                          </p>
                        )}
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                        <span className="font-mono text-slate-500 dark:text-slate-400 truncate max-w-[130px]">{core.odf_cassette_label || 'TUBE - CORE: —'}</span>
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
  const canCrud = hasRole('Super Administrator', 'Operator Jaringan', 'NOC Operator');
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
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100"> Pilih POP Central Office (Headend) ({pops.length} POP)</h3>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">Pilih POP untuk melihat daftar kabel &amp; core matrix</p>
          </div>
          {canCrud && (
            <button
              onClick={() => onAddNode('POP')}
              className="w-full sm:w-auto px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1"
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
              placeholder="— Pilih POP Central —"
              searchPlaceholder="Cari POP Central..."
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
                className="flex-shrink-0 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-indigo-50 hover:border-indigo-300 text-slate-700 dark:text-slate-300 transition-all"
              >Edit</button>
              <button
                onClick={() => onDeleteNode(selectedPop)}
                title="Hapus POP ini"
                className="flex-shrink-0 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-red-50 hover:border-red-300 text-red-600 dark:text-red-400 transition-all"
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
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 mb-5">
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100"> Daftar Kabel Fiber POP ({cables.length} Kabel)</h3>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">Pilih kabel untuk membuka susunan Tube &amp; Core TIA-598-A</p>
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
            <div className="bg-slate-900 dark:bg-slate-950 text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-slate-800">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-lg bg-slate-800 text-slate-300 text-[11px] font-semibold border border-slate-700">
                      {activeCable.core_count_total} Core ({Object.keys(coresByTube).length} Tube)
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-slate-800 text-slate-300 text-[11px] font-semibold border border-slate-700">
                      ️ Jalur {activeCable.installation_type} ({activeCable.length_meters}m)
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-bold mt-2">{activeCable.name}</h2>
                  {activeCable.route_description && (
                    <p className="text-xs text-slate-400 mt-0.5"> Rute: {activeCable.route_description}</p>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-2 bg-slate-800/90 p-2.5 sm:p-3 rounded-xl border border-slate-700 text-center">
                  <div>
                    <p className="text-[10px] sm:text-xs text-slate-400">Total</p>
                    <p className="text-sm sm:text-base font-bold text-white">{activeCable.core_count_total}</p>
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-emerald-400">Used</p>
                    <p className="text-sm sm:text-base font-bold text-emerald-400">{(activeCable.cores ?? []).filter(c => c.status === 'used').length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-slate-300">Dark Fiber</p>
                    <p className="text-sm sm:text-base font-bold text-slate-300">{(activeCable.cores ?? []).filter(c => c.status === 'available').length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-amber-400">Reserved</p>
                    <p className="text-sm sm:text-base font-bold text-amber-400">{(activeCable.cores ?? []).filter(c => c.status === 'reserved' || c.status === 'damaged').length}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Tube & Core Accordion ── */}
          {activeCable && Object.keys(coresByTube).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 px-1">
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
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Status Port *</label>
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
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Label Peruntukan / Tujuan Port</label>
            <input
              value={form.destination_label}
              onChange={e => setForm(f => ({ ...f, destination_label: e.target.value }))}
              placeholder="misal: Ke ODP-A01 (Blok A No. 12)"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Nama Pelanggan / Service (Cache)</label>
            <input
              value={form.customer_name_cache}
              onChange={e => setForm(f => ({ ...f, customer_name_cache: e.target.value }))}
              placeholder="misal: John Doe (PA-0012)"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Catatan Port</label>
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
function OdcTabContent({ onAddNode, onEditNode, onDeleteNode, refreshKey, onRefreshGlobal, scopedOltId }) {
  const { hasRole } = useAuth();
  const canCrud = hasRole('Super Administrator', 'Operator Jaringan', 'NOC Operator');
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
    fetch('/api/network-nodes?type=POP&per_page=100')
      .then(r => r.json())
      .then(d => setPopNodes(d.data ?? []))
      .catch(() => setPopNodes([]));
  }, []);

  // Muat ODC setiap kali filter / search / refreshKey / scopedOltId berubah
  const fetchOdcs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    const targetOlt = filterOlt || scopedOltId;
    if (targetOlt) params.append('olt_id', targetOlt);
    if (filterPop) params.append('pop_id', filterPop);
    if (searchQuery) params.append('search', searchQuery);
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

  // Helper formatting for interface display (convert 1/1/1 or gpon-olt_1/1/1 -> gpon_olt_1/1/1)
  const displayInterface = (ref) => {
    if (!ref) return '—';
    return ref.split(',').map(s => {
      const trimmed = s.trim();
      if (!trimmed) return '';
      const clean = trimmed.replace(/^(gpon[-_]olt_)/i, '');
      return `gpon_olt_${clean}`;
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

  const totalPages = Math.ceil(odcList.length / perPage) || 1;
  const paginatedOdcs = odcList.slice((currentPage - 1) * perPage, currentPage * perPage);

  return (
    <div className="space-y-4">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100">Daftar ODC (Optical Distribution Cabinet)</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Kabinet distribusi sekunder — kelola interface OLT, core power, splitter modul, dan port peruntukan</p>
        </div>
        {canCrud && (
          <button
            onClick={() => onAddNode('ODC')}
            className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
          >
            <span>+</span> Tambah ODC Baru
          </button>
        )}
      </div>

      {/* ─── Filter & Search Bar ─── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1"> Cari ODC</label>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari kode, nama, lokasi..."
            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-800/80 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1"> Filter OLT</label>
          <SearchableSelect
            value={filterOlt}
            onChange={val => { setFilterOlt(val); setFilterPop(''); }}
            placeholder="— Semua OLT —"
            searchPlaceholder="Cari OLT..."
            options={oltDevices.map(o => ({
              value: o.id,
              label: o.name
            }))}
          />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1"> Filter POP</label>
          <SearchableSelect
            value={filterPop}
            onChange={val => setFilterPop(val)}
            placeholder="— Semua POP —"
            searchPlaceholder="Cari POP..."
            options={popNodes.map(p => ({
              value: p.id,
              label: p.name
            }))}
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={fetchOdcs}
            className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-all"
          >
            Cari &amp; Filter
          </button>
        </div>
      </div>

      {/* ─── ODC Cards & Pagination ─── */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center text-slate-400 text-xs animate-pulse border border-slate-200 dark:border-slate-700">
          Memuat data ODC...
        </div>
      ) : odcList.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 sm:p-12 text-center border border-dashed border-slate-300 dark:border-slate-600">
          <p className="text-4xl mb-2"></p>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Belum Ada ODC Ditemukan</p>
          <p className="text-xs text-slate-400 mt-1">Coba ubah filter OLT / POP / kata pencarian atau tambah ODC baru</p>
          {canCrud && (
            <button onClick={() => onAddNode('ODC')} className="mt-3 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl">
              + Tambah ODC Pertama
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4">#</th>
                    <th className="py-3.5 px-4">KODE / NAMA ODC</th>
                    <th className="py-3.5 px-4">TOPOLOGI &amp; OLT</th>
                    <th className="py-3.5 px-4">TUBE &amp; CORE POWER</th>
                    <th className="py-3.5 px-4">KAPASITAS PORT</th>
                    <th className="py-3.5 px-4">LOKASI</th>
                    <th className="py-3.5 px-4">STATUS</th>
                    <th className="py-3.5 px-4 text-center">AKSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {paginatedOdcs.map((odc, idx) => {
                    const globalIdx = (currentPage - 1) * perPage + idx + 1;
                    const p = pct(odc.used_ports, odc.total_ports);
                    const topoType = odc.odc_topology_type ?? 'tunggal';
                    const topoBadge = topoType === 'induk'
                      ? { label: 'ODC Induk', bg: 'bg-blue-100 text-blue-800 border-blue-200' }
                      : topoType === 'anak'
                        ? { label: 'ODC Anak', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
                        : { label: 'Tunggal', bg: 'bg-blue-100 text-blue-800 border-blue-200' };

                    return (
                      <tr key={odc.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-500">{globalIdx}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight block">{odc.name}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 text-[11px] font-bold rounded border ${topoBadge.bg} inline-block mb-1`}>
                            {topoBadge.label}
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-100 block">{odc.olt_device?.name || 'OLT Utama Solok'}</span>
                          <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400 font-semibold">{displayInterface(odc.olt_port_ref)}</span>
                        </td>
                        <td className="py-3 px-4">
                          {odc.core_power ? (
                            <span className="font-mono font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/60 px-2 py-0.5 rounded text-[11px] block w-max mb-1">
                              {odc.core_power}
                            </span>
                          ) : <span className="text-slate-400 block">—</span>}
                          <span className="text-[11px] font-medium text-blue-800 dark:text-blue-300 block truncate max-w-[140px]">
                            {odc.tube_info || '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-800 dark:text-slate-100 block">{odc.used_ports}/{odc.total_ports} Port ({p}%)</span>
                          <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mt-1">
                            <div className={`h-full ${pctColor(p)} rounded-full`} style={{ width: `${p}%` }} />
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-[160px] truncate">
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
                              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors"
                            >
                              Port
                            </button>
                            <button
                              onClick={() => openOdcFullModal(odc)}
                              title="Lihat Seluruh Spesifikasi Data ODC"
                              className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold hover:bg-blue-100 transition-colors"
                            >
                              Detail
                            </button>
                            {canCrud && (
                              <>
                                <button
                                  onClick={() => onEditNode(odc)}
                                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => onDeleteNode(odc)}
                                  className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs font-semibold hover:bg-rose-100 transition-colors"
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
                <div key={odc.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                  <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center bg-slate-50/70 dark:bg-slate-800/40">
                      <span className="text-slate-400 font-semibold">#</span>
                      <span className="col-span-2 font-mono font-bold text-slate-700 dark:text-slate-200">{globalIdx}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-slate-400 font-semibold">Name</span>
                      <span className="col-span-2 font-bold text-slate-800 dark:text-slate-100 uppercase">{odc.name}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-slate-400 font-semibold">OLT &amp; Interface</span>
                      <span className="col-span-2 text-slate-700 dark:text-slate-300">
                        <span className="font-bold block">{odc.olt_device?.name || 'OLT Utama Solok'}</span>
                        <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-semibold">{displayInterface(odc.olt_port_ref)}</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-slate-400 font-semibold">Tube &amp; Core Power</span>
                      <span className="col-span-2 text-slate-700 dark:text-slate-300">
                        <span className="font-semibold block">{odc.tube_info || '—'}</span>
                        {odc.core_power && <span className="font-mono font-bold text-amber-700 dark:text-amber-300 text-[10px] block">{odc.core_power}</span>}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-slate-400 font-semibold">Capacity</span>
                      <span className="col-span-2 font-bold text-slate-800 dark:text-slate-100">
                        {odc.used_ports}/{odc.total_ports} Port ({p}%)
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-slate-400 font-semibold">Status</span>
                      <span className="col-span-2">
                        <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${STATUS_META[odc.status]?.pill}`}>
                          {STATUS_META[odc.status]?.label}
                        </span>
                      </span>
                    </div>
                    <div className="px-4 py-3 bg-slate-50/50 dark:bg-slate-800/20 flex items-center justify-end gap-2">
                      <button
                        onClick={() => openOdcDetail(odc)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold shadow-xs"
                      >
                        Port
                      </button>
                      <button
                        onClick={() => openOdcFullModal(odc)}
                        className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] font-bold hover:bg-blue-100"
                      >
                        Detail
                      </button>
                      {canCrud && (
                        <>
                          <button
                            onClick={() => onEditNode(odc)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => onDeleteNode(odc)}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-[11px] font-semibold"
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
            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between text-xs">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="font-bold text-slate-700 dark:text-slate-300">
                Halaman {currentPage} dari {totalPages} (Total {odcList.length} ODC)
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* ─── ODC Detail Panel Modal ─── */}
      {selectedOdc && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={closeDetail}>
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-3xl border border-slate-200 dark:border-slate-700 max-h-[92vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-slate-900 border-b border-slate-800 text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold">Detail ODC — {selectedOdc.name}</h3>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-white/20 text-white uppercase">
                    {selectedOdc.odc_topology_type === 'induk' ? 'ODC INDUK' : selectedOdc.odc_topology_type === 'anak' ? 'ODC ANAK' : 'TUNGGAL'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-mono mt-0.5">
                  {selectedOdc.code}
                  {selectedOdc.olt_device && ` · OLT: ${selectedOdc.olt_device.name}`}
                  {selectedOdc.olt_port_ref && ` [ ${displayInterface(selectedOdc.olt_port_ref)} ]`}
                  {selectedOdc.parent_node && ` · POP: ${selectedOdc.parent_node.name}`}
                </p>
              </div>
              <button onClick={closeDetail} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10 text-slate-300 font-bold">✕</button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Context Summary Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Interface OLT</span>
                  <span className="font-mono font-bold text-indigo-700">{displayInterface(selectedOdc.olt_port_ref)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Core Power</span>
                  <span className="font-mono font-bold text-amber-700">{selectedOdc.core_power || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Splitter Config</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {selectedOdc.splitter_count > 0 ? `${selectedOdc.splitter_count} × ${selectedOdc.splitter_config?.[0] || '1:4'}` : (selectedOdc.splitter_config?.join(', ') || selectedOdc.splitter_type?.ratio || '—')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Kapasitas Port</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{selectedOdc.used_ports}/{selectedOdc.total_ports} Port</span>
                </div>
              </div>

              {/* Tube Info Banner if present */}
              {selectedOdc.tube_info && (
                <div className="bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl px-3.5 py-2.5 text-xs text-blue-900 dark:text-blue-200">
                  <span className="font-bold"> Informasi Tube Fiber:</span> {selectedOdc.tube_info}
                </div>
              )}

              {detailLoading ? (
                <div className="py-10 text-center text-slate-400 text-xs animate-pulse">Memuat detail ODC...</div>
              ) : odcDetail ? (
                <div className="space-y-5">
                  {/* Port Grid Grouped By Splitter Categories */}
                  {odcDetail.ports?.length > 0 && (() => {
                    const { powerGroups, distGroups, generalGroups } = groupPortsBySplitter(
                      odcDetail.ports,
                      selectedOdc.splitter_config,
                      selectedOdc.splitter_type?.ratio
                    );

                    return (
                      <div className="space-y-5">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                            Grid Port ODC ({odcDetail.ports.length} Port Total)
                          </h4>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500"> Klik port untuk mengedit peruntukan</span>
                        </div>

                        {/*  Kelompok Splitter Power ODC */}
                        {powerGroups.length > 0 && (
                          <div className="space-y-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-2xl p-4">
                            <div className="flex items-center justify-between border-b border-amber-200/80 dark:border-amber-900/40 pb-2">
                              <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                                Kelompok Splitter Power ODC ({powerGroups.length} Modul · {powerGroups.reduce((a, g) => a + g.ports.length, 0)} Port)
                              </h4>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">Feeder / Upstream</span>
                            </div>

                            <div className="space-y-3">
                              {powerGroups.map((group, gIdx) => (
                                <div key={gIdx} className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3 space-y-2">
                                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                      {group.title}
                                    </span>
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
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
                                          className={`p-2.5 rounded-xl border flex flex-col items-center text-center gap-1 cursor-pointer transition-all hover:scale-105 hover:shadow-sm ${used ? 'bg-amber-100/70 dark:bg-amber-950/70 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:border-amber-500' : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                                            }`}
                                        >
                                          <span className="text-base leading-none">{used ? '' : '○'}</span>
                                          <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100">Port {port.port_number}</span>
                                          {used ? (
                                            <p className="text-[10px] font-semibold text-amber-900 dark:text-amber-300 line-clamp-2 leading-tight">
                                              {port.destination_label || port.customer_name_cache || 'Terpakai'}
                                            </p>
                                          ) : (
                                            <span className="text-[10px] text-slate-400 dark:text-slate-500">Kosong</span>
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

                        {/*  Kelompok Splitter Distribusi ODC */}
                        {distGroups.length > 0 && (
                          <div className="space-y-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40 rounded-2xl p-4">
                            <div className="flex items-center justify-between border-b border-blue-200/80 dark:border-blue-900/40 pb-2">
                              <h4 className="text-xs font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                                Kelompok Splitter Distribusi ODC ({distGroups.length} Modul · {distGroups.reduce((a, g) => a + g.ports.length, 0)} Port)
                              </h4>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800">Downstream ODP</span>
                            </div>

                            <div className="space-y-3">
                              {distGroups.map((group, gIdx) => (
                                <div key={gIdx} className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-slate-800 rounded-xl p-3 space-y-2">
                                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                      {group.title}
                                    </span>
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
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
                                          className={`p-2.5 rounded-xl border flex flex-col items-center text-center gap-1 cursor-pointer transition-all hover:scale-105 hover:shadow-sm ${used ? 'bg-blue-50 dark:bg-blue-950/80 border-blue-300 dark:border-blue-700 hover:border-blue-500' : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                                            }`}
                                        >
                                          <span className="text-base leading-none">{used ? '' : '○'}</span>
                                          <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100">Port {port.port_number}</span>
                                          {used ? (
                                            <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 line-clamp-2 leading-tight">
                                              {port.destination_label || port.customer_name_cache || 'Terpakai'}
                                            </p>
                                          ) : (
                                            <span className="text-[10px] text-slate-400 dark:text-slate-500">Kosong</span>
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
                          <div className="space-y-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
                            {generalGroups.map((group, gIdx) => (
                              <div key={gIdx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2">
                                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                                    {group.title}
                                  </span>
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600">
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
                                        className={`p-2.5 rounded-xl border flex flex-col items-center text-center gap-1 cursor-pointer transition-all hover:scale-105 hover:shadow-sm ${used ? 'bg-blue-50 dark:bg-blue-950/80 border-blue-300 dark:border-blue-700 hover:border-blue-500' : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                                          }`}
                                      >
                                        <span className="text-base leading-none">{used ? '' : '○'}</span>
                                        <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100">Port {port.port_number}</span>
                                        {used ? (
                                          <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 line-clamp-2 leading-tight">
                                            {port.destination_label || port.customer_name_cache || 'Terpakai'}
                                          </p>
                                        ) : (
                                          <span className="text-[10px] text-slate-400 dark:text-slate-500">Kosong</span>
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
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-3">
                        ODP Terhubung ({odcDetail.odps.length} ODP)
                      </h4>
                      <div className="space-y-2">
                        {odcDetail.odps.map(odp => {
                          const pp = pct(odp.used_ports, odp.total_ports);
                          return (
                            <div key={odp.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 gap-4">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{odp.name}</p>
                                <p className="text-[11px] font-mono text-emerald-700">{odp.code}</p>
                                {odp.address && <p className="text-[10px] text-slate-400 truncate mt-0.5">{odp.address}</p>}
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{odp.used_ports}/{odp.total_ports} Port</p>
                                <div className="w-20 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-1">
                                  <div className={`h-full ${pctColor(pp)} rounded-full`} style={{ width: `${pp}%` }} />
                                </div>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${STATUS_META[odp.status]?.pill}`}>
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
                <div className="py-10 text-center text-red-400 text-xs">Gagal memuat detail ODC.</div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
              {canCrud ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => { onEditNode(selectedOdc); closeDetail(); }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all"
                  >
                    ️ Edit ODC
                  </button>
                  <button
                    onClick={() => { onDeleteNode(selectedOdc); closeDetail(); }}
                    className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-xl border border-red-200 transition-all"
                  >
                    ️ Hapus
                  </button>
                </div>
              ) : <div />}
              <button onClick={closeDetail} className="text-xs text-slate-400 hover:text-slate-600">Tutup</button>
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
      {viewFullOdcModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={closeFullOdcModal}>
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {!viewFullOdcModal ? null : (<>
            <div className="bg-slate-900 border-b border-slate-800 text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold">Spesifikasi &amp; Data Lengkap ODC</h3>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-indigo-500 text-white uppercase">
                    {viewFullOdcModal.odc_topology_type === 'induk' ? 'ODC INDUK' : viewFullOdcModal.odc_topology_type === 'anak' ? 'ODC ANAK' : 'TUNGGAL'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-mono mt-0.5">{viewFullOdcModal.name}</p>
              </div>
              <button onClick={closeFullOdcModal} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10 text-slate-300 font-bold">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider text-[11px]">1. Identitas Node &amp; Topologi</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Nama Node</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">{viewFullOdcModal.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Jenis Topologi</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 uppercase">{viewFullOdcModal.odc_topology_type || 'tunggal'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Status Operasional</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${STATUS_META[viewFullOdcModal.status]?.pill}`}>
                      {STATUS_META[viewFullOdcModal.status]?.label}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider text-[11px]">2. Koneksi OLT &amp; Parent Headend</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Perangkat OLT</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">{viewFullOdcModal.olt_device?.name || 'OLT Utama Solok'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Interface OLT PON</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{displayInterface(viewFullOdcModal.olt_port_ref)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">POP / ODC Induk</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{viewFullOdcModal.parent_node?.name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">ODP Anak Terhubung</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{viewFullOdcModal.odp_count} ODP</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider text-[11px]">3. Spesifikasi Teknis Optik &amp; Splitter</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Core Power Feeder</span>
                    <span className="font-mono font-bold text-amber-700 dark:text-amber-300">{viewFullOdcModal.core_power || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Informasi Tube Fiber</span>
                    <span className="font-medium text-blue-800 dark:text-blue-300">{viewFullOdcModal.tube_info || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Modul Splitter ODC</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      {viewFullOdcModal.splitter_count > 0 ? `${viewFullOdcModal.splitter_count} × ${viewFullOdcModal.splitter_config?.[0]}` : (viewFullOdcModal.splitter_config?.join(', ') || viewFullOdcModal.splitter_type?.ratio || '—')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Kapasitas &amp; Port Terisi</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      {viewFullOdcModal.used_ports}/{viewFullOdcModal.total_ports} Port ({pct(viewFullOdcModal.used_ports, viewFullOdcModal.total_ports)}%)
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider text-[11px]">4. Lokasi &amp; Koordinat Pemetaan</h4>
                <div className="space-y-2">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Alamat / Lokasi ODC</span>
                    <span className="font-medium text-slate-800 dark:text-slate-100">{viewFullOdcModal.address || '—'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-200 dark:border-slate-700/60">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Koordinat Desimal</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">{viewFullOdcModal.latitude && viewFullOdcModal.longitude ? `${viewFullOdcModal.latitude}, ${viewFullOdcModal.longitude}` : '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Koordinat DMS</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">{viewFullOdcModal.latitude && viewFullOdcModal.longitude ? decimalToDms(viewFullOdcModal.latitude, viewFullOdcModal.longitude).formattedDms : '—'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
              {canCrud ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => { onEditNode(viewFullOdcModal); closeFullOdcModal(); }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all"
                  >
                    Edit ODC
                  </button>
                </div>
              ) : <div />}
              <button onClick={closeFullOdcModal} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl">Tutup</button>
            </div>
            </>)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   TAB 3: ODP (OPTICAL DISTRIBUTION POINT)
══════════════════════════════════════════════════════════════════ */
function OdpTabContent({ odps, onAddNode, onEditNode, onDeleteNode, refreshKey, onRefreshGlobal }) {
  const { hasRole } = useAuth();
  const canCrud = hasRole('Super Administrator', 'Operator Jaringan', 'NOC Operator');

  const [selectedOdp, setSelectedOdp] = useState(null);
  const [odpDetailData, setOdpDetailData] = useState(null);
  const [portsData, setPortsData] = useState([]);
  const [loadingPorts, setLoadingPorts] = useState(false);
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

  const fetchOdpPorts = useCallback(async (odpId) => {
    setLoadingPorts(true);
    try {
      const r = await fetch(`/api/network-nodes/${odpId}/port-detail`);
      if (!r.ok) throw new Error('API error');
      const d = await r.json();
      setOdpDetailData(d);
      setPortsData(d.ports ?? []);

      if (d.node?.used_ports != null) {
        setSelectedOdp(prev => prev ? { ...prev, used_ports: d.node.used_ports } : null);
      }
    } catch {
      setOdpDetailData(null);
      setPortsData([]);
    } finally {
      setLoadingPorts(false);
    }
  }, []);

  const openOdpDetail = (odp) => {
    setSelectedOdp(odp);
    setOdpDetailData(null);
    setPortsData([]);
    setEditingOdpPort(null);
    fetchOdpPorts(odp.id);
  };

  const closeOdpDetail = () => {
    setSelectedOdp(null);
    setOdpDetailData(null);
    setPortsData([]);
    setEditingOdpPort(null);
  };

  const handleRefreshPorts = () => {
    if (selectedOdp) fetchOdpPorts(selectedOdp.id);
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

  const filteredOdps = odps.filter(odp => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || odp.name?.toLowerCase().includes(q) || odp.code?.toLowerCase().includes(q) || odp.address?.toLowerCase().includes(q);
    const matchStatus = !filterStatus || odp.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 6;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus]);

  const totalPages = Math.ceil(filteredOdps.length / perPage) || 1;
  const paginatedOdps = filteredOdps.slice((currentPage - 1) * perPage, currentPage * perPage);

  const getRxColor = (rx) => {
    if (rx === null || rx === undefined) return 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700/60 border-slate-200 dark:border-slate-600';
    if (rx >= -25.0) return 'text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 font-bold';
    if (rx >= -28.0) return 'text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-emerald-700 font-bold';
    return 'text-red-800 dark:text-red-300 bg-red-100 dark:bg-red-900/40 border-red-300 dark:border-red-700 font-bold animate-pulse';
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100">Daftar ODP (Optical Distribution Point)</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {filteredOdps.length} dari {odps.length} ODP · Titik terminal distribusi optik ke pelanggan
            </p>
          </div>
          {canCrud && (
            <button
              onClick={() => onAddNode('ODP')}
              className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
            >
              <span>+</span> Tambah ODP Baru
            </button>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder=" Cari nama, kode, atau alamat ODP..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Semua Status</option>
            <option value="active"> Aktif</option>
            <option value="inactive"> Tidak Aktif</option>
            <option value="maintenance"> Maintenance</option>
            <option value="damaged"> Rusak</option>
          </select>
        </div>
      </div>

      {odps.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 sm:p-12 text-center border border-dashed border-slate-300 dark:border-slate-600">
          <p className="text-4xl mb-2"></p>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Belum Ada ODP Terdaftar</p>
          <p className="text-xs text-slate-400 mt-1 mb-4">Tambahkan ODP baru untuk memulai manajemen distribusi optik</p>
          {canCrud && (
            <button onClick={() => onAddNode('ODP')} className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl">
              + Tambah ODP Pertama
            </button>
          )}
        </div>
      ) : filteredOdps.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center border border-dashed border-slate-200 dark:border-slate-700">
          <p className="text-3xl mb-2"></p>
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Tidak ada ODP yang cocok dengan filter</p>
          <button onClick={() => { setSearchQuery(''); setFilterStatus(''); }} className="mt-3 text-xs text-indigo-600 hover:underline">
            Reset filter
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[11px]">
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
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {paginatedOdps.map((odp, idx) => {
                    const globalIdx = (currentPage - 1) * perPage + idx + 1;
                    const p = pct(odp.used_ports, odp.total_ports);
                    return (
                      <tr key={odp.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-500">{globalIdx}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight block uppercase">{odp.name}</span>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">
                          {odp.parent_node?.name || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-800 dark:text-slate-100 block">
                            {odp.olt_device?.name || odp.parent_node?.olt_device?.name || 'Auto-Detect OLT'}
                          </span>
                          <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400 font-semibold">
                            {displayInterface(odp.olt_port_ref)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-800 dark:text-slate-100 block">{odp.tube_info || '—'}</span>
                          <span className="text-[11px] text-slate-500 block">Core {odp.core_color || '—'}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                            Rasio {odp.splitter_config || odp.splitter_type?.ratio || '1:8'}
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-100 block">
                            {odp.used_ports}/{odp.total_ports} Port ({p}%)
                          </span>
                          <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mt-1">
                            <div className={`h-full ${pctColor(p)} rounded-full`} style={{ width: `${p}%` }} />
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-[180px] truncate uppercase">
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
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors"
                            >
                              Port
                            </button>
                            <button
                              onClick={() => openOdpFullModal(odp)}
                              title="Lihat Seluruh Spesifikasi Data ODP"
                              className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold hover:bg-blue-100 transition-colors"
                            >
                              Detail
                            </button>
                            {canCrud && (
                              <>
                                <button
                                  onClick={() => onEditNode(odp)}
                                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => onDeleteNode(odp)}
                                  className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs font-semibold hover:bg-rose-100 transition-colors"
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
                <div key={odp.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                  <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center bg-slate-50/70 dark:bg-slate-800/40">
                      <span className="text-slate-400 font-semibold">#</span>
                      <span className="col-span-2 font-mono font-bold text-slate-700 dark:text-slate-200">{globalIdx}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-slate-400 font-semibold">Name</span>
                      <span className="col-span-2 font-bold text-slate-800 dark:text-slate-100 uppercase">{odp.name}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-slate-400 font-semibold">Address</span>
                      <span className="col-span-2 text-slate-700 dark:text-slate-300 leading-snug uppercase">{odp.address || '—'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-slate-400 font-semibold">OLT &amp; Interface</span>
                      <span className="col-span-2 text-slate-700 dark:text-slate-300">
                        <span className="font-bold block">{odp.olt_device?.name || odp.parent_node?.olt_device?.name || 'Auto-Detect OLT'}</span>
                        <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-semibold">{displayInterface(odp.olt_port_ref)}</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-slate-400 font-semibold">Tube &amp; Core</span>
                      <span className="col-span-2 text-slate-700 dark:text-slate-300">
                        <span className="font-semibold block">{odp.tube_info || '—'}</span>
                        <span className="text-[10px] text-slate-400 block">Core {odp.core_color || '—'}</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-slate-400 font-semibold">Port Terisi</span>
                      <span className="col-span-2 font-bold text-slate-800 dark:text-slate-100">
                        {odp.used_ports}/{odp.total_ports} Port ({p}%)
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-slate-400 font-semibold">Status</span>
                      <span className="col-span-2">
                        <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${STATUS_META[odp.status]?.pill}`}>
                          {STATUS_META[odp.status]?.label}
                        </span>
                      </span>
                    </div>
                    <div className="px-4 py-3 bg-slate-50/50 dark:bg-slate-800/20 flex items-center justify-end gap-2">
                      <button
                        onClick={() => openOdpDetail(odp)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-xs"
                      >
                        Port
                      </button>
                      <button
                        onClick={() => openOdpFullModal(odp)}
                        className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] font-bold hover:bg-blue-100"
                      >
                        Detail
                      </button>
                      {canCrud && (
                        <>
                          <button
                            onClick={() => onEditNode(odp)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => onDeleteNode(odp)}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-[11px] font-semibold"
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
            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between text-xs">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="font-bold text-slate-700 dark:text-slate-300">
                Halaman {currentPage} dari {totalPages} (Total {filteredOdps.length} ODP)
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal Detail Port & Monitoring Sinyal ODP */}
      {selectedOdp && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-4xl border border-slate-200 dark:border-slate-700 max-h-[92vh] flex flex-col overflow-hidden">

            <div className="bg-slate-900 dark:bg-slate-950 text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
              <div className="min-w-0">
                <h3 className="text-base font-bold flex items-center gap-2 truncate">
                  <span></span> Detail Port & Monitoring Sinyal — {selectedOdp.name}
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {selectedOdp.code} · 1:{selectedOdp.total_ports} Port ·
                  {selectedOdp.olt_port_ref
                    ? <span className="text-blue-400 ml-1">{displayInterface(selectedOdp.olt_port_ref)}</span>
                    : <span className="text-slate-500 ml-1">Interface Auto-Detect</span>
                  }
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleRefreshPorts}
                  disabled={loadingPorts}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-400 disabled:opacity-50"
                  title="Refresh Data"
                >
                  <svg className={`w-4 h-4 ${loadingPorts ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button
                  onClick={closeOdpDetail}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-400 font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {/* 1. OLT & Interface */}
                <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl p-3.5 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider"> OLT Terhubung</span>
                    <p className="text-xs font-bold text-blue-950 dark:text-blue-100 truncate mt-0.5">
                      {odpDetailData?.node?.olt_device?.name || odpDetailData?.node?.parent_node?.olt_device?.name || selectedOdp.olt_device?.name || selectedOdp.parent_node?.olt_device?.name || 'Auto-Detect OLT'}
                    </p>
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-blue-200/60 dark:border-blue-800/60">
                    <span className="text-[10px] text-blue-500 block">Interface OLT Otomatis:</span>
                    <span className="text-xs font-mono font-bold text-blue-700 dark:text-blue-300 truncate block">
                      {odpDetailData?.display_olt_ref || displayInterface(selectedOdp.olt_port_ref)}
                    </span>
                  </div>
                </div>

                {/* 2. Splitter & Kapasitas Port */}
                <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-3.5 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider"> Splitter &amp; Kapasitas</span>
                    <p className="text-xs font-bold text-indigo-950 dark:text-indigo-100 truncate mt-0.5">
                      {odpDetailData?.node?.splitter_count ?? selectedOdp.splitter_count ?? 1} Unit ({odpDetailData?.node?.splitter_config || selectedOdp.splitter_config || selectedOdp.splitter_type?.ratio || '1:8'})
                    </p>
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-between">
                    <span className="text-[10px] text-indigo-500">Port Total:</span>
                    <span className="text-xs font-bold text-indigo-800 dark:text-indigo-200 font-mono">
                      1:{selectedOdp.total_ports} Port
                    </span>
                  </div>
                </div>

                {/* 3. Fiber Tube & Core */}
                <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-3.5 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider"> Fiber Tube &amp; Core</span>
                    <p className="text-xs font-bold text-indigo-950 dark:text-indigo-100 truncate mt-0.5">
                      {odpDetailData?.node?.tube_info || selectedOdp.tube_info || 'Tube 1'}
                    </p>
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-between">
                    <span className="text-[10px] text-indigo-500">Warna Core:</span>
                    <span className="text-xs font-bold text-indigo-800 dark:text-indigo-200 font-mono">
                      Core {odpDetailData?.node?.core_color || selectedOdp.core_color || '—'}
                    </span>
                  </div>
                </div>

                {/* 4. Sinyal & Status Pelanggan */}
                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-3.5 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider"> Redaman &amp; Terisi</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-sm font-extrabold text-emerald-900 dark:text-emerald-200 font-mono">
                        {odpDetailData?.attenuation?.avg_rx_power != null
                          ? `${odpDetailData.attenuation.avg_rx_power} dBm`
                          : '—'}
                      </span>
                      {odpDetailData?.attenuation?.signal_status === 'good' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-300"> Normal</span>}
                      {odpDetailData?.attenuation?.signal_status === 'warning' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-bold border border-amber-300"> Tinggi</span>}
                      {odpDetailData?.attenuation?.signal_status === 'critical' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 font-bold border border-red-300"> Kritis</span>}
                    </div>
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-between">
                    <span className="text-[10px] text-emerald-600">Pelanggan:</span>
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-200 font-mono">
                      {odpDetailData?.attenuation?.connected_count ?? selectedOdp.used_ports} / {selectedOdp.total_ports} Port
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Detail Per-Port ({portsData.length} Port)
                  </h4>
                  {loadingPorts && (
                    <span className="text-[10px] text-indigo-500 animate-pulse"> Memuat...</span>
                  )}
                </div>

                {loadingPorts ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {Array.from({ length: selectedOdp.total_ports || 8 }).map((_, i) => (
                      <div key={i} className="h-28 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                    ))}
                  </div>
                ) : portsData.length === 0 ? (
                  <div className="py-10 text-center text-slate-400">
                    <p className="text-2xl mb-1"></p>
                    <p className="text-xs">Data port tidak ditemukan. Coba refresh.</p>
                    <button onClick={handleRefreshPorts} className="mt-2 text-xs text-indigo-500 hover:underline"> Coba Lagi</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {portsData.map(port => {
                      const isUsed = !!(port.customer_id || port.customer_service_id || port.status === 'used');
                      const rx = port.rx_power != null ? parseFloat(port.rx_power) : null;
                      const rxColor = getRxColor(rx);
                      const rxText = rx !== null ? `${rx.toFixed(1)} dBm` : '—';

                      return (
                        <div
                          key={port.id}
                          className={`relative rounded-2xl border flex flex-col justify-between transition-all ${isUsed
                            ? 'bg-white dark:bg-slate-800/80 border-emerald-300 dark:border-emerald-700 shadow-xs hover:shadow-md'
                            : 'bg-slate-50/80 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                            }`}
                        >
                          <div className="p-3.5 flex-1 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between gap-1 mb-2">
                                <span className={`px-2 py-0.5 rounded-lg text-xs font-bold font-mono ${isUsed ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}`}>
                                  Port {port.port_number}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {port.port_type || 'SC/APC'}
                                </span>
                              </div>

                              {isUsed ? (
                                <div className="space-y-1.5">
                                  {/* 1. Nama Client */}
                                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-1 flex items-center gap-1.5">
                                    <span className="text-indigo-500"></span> {port.customer_name || port.customer_name_cache || 'Pelanggan'}
                                  </p>

                                  {/* 2. SN ONT */}
                                  <p className="text-[10px] font-mono text-slate-600 dark:text-slate-300 flex items-center gap-1 truncate">
                                    <span className="text-slate-400">SN:</span> <span className="font-semibold text-slate-700 dark:text-slate-200">{port.onu_serial || '—'}</span>
                                  </p>

                                  {/* 3. Interface OLT Otomatis */}
                                  <p className="text-[10px] font-mono text-slate-600 dark:text-slate-300 flex items-center gap-1 truncate">
                                    <span className="text-slate-400">Interface:</span> <span className="font-semibold text-indigo-600 dark:text-indigo-400">{port.olt_port_name ? (port.olt_port_name.startsWith('gpon') ? port.olt_port_name : `gpon_olt_${port.olt_port_name}`) : (odpDetailData?.display_olt_ref && odpDetailData.display_olt_ref !== '—' ? odpDetailData.display_olt_ref : 'gpon_olt_1/1/1')}</span>
                                  </p>

                                  {/* 4. Redaman Otomatis */}
                                  <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                    <span className="text-[10px] text-slate-400">Redaman:</span>
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] border font-mono ${rxColor}`}>
                                      {rxText}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="py-3 text-center">
                                  <span className="text-2xl opacity-30">○</span>
                                  <p className="text-xs font-medium text-slate-400 mt-1">Port Tersedia</p>
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

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Redaman ODP ini synced real-time dari koneksi OLT &amp; ONT pelanggan.
              </span>
              <button onClick={closeOdpDetail} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Full Spesifikasi Data Lengkap ODP ─── */}
      {viewFullOdpModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={closeFullOdpModal}>
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] flex flex-col overflow-hidden"
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
                  <div className="bg-slate-900 border-b border-slate-800 text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold">Spesifikasi &amp; Data Lengkap ODP</h3>
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-600 text-white uppercase">
                          TERMINAL ODP
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 font-mono mt-0.5">{node.name}</p>
                    </div>
                    <button onClick={closeFullOdpModal} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10 text-slate-300 font-bold">✕</button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                    {loadingFullOdp ? (
                      <div className="py-12 text-center text-slate-400 font-medium space-y-2">
                        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                        <p>Memuat spesifikasi lengkap ODP...</p>
                      </div>
                    ) : (
                      <>
                        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
                          <h4 className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider text-[11px]">1. Identitas Node &amp; Status</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <span className="text-slate-400 block text-[10px]">Nama ODP</span>
                              <span className="font-bold text-slate-800 dark:text-slate-100 uppercase">{node.name}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">Tipe Node</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">ODP (Optical Distribution Point)</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">Status Operasional</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${STATUS_META[node.status]?.pill}`}>
                                {STATUS_META[node.status]?.label}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
                          <h4 className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider text-[11px]">2. Upstream ODC &amp; Perangkat OLT</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <span className="text-slate-400 block text-[10px]">ODC Induk (Upstream)</span>
                              <span className="font-bold text-slate-800 dark:text-slate-100">{node.parent_node?.name || '—'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">Perangkat OLT</span>
                              <span className="font-bold text-slate-800 dark:text-slate-100">{node.olt_device?.name || node.parent_node?.olt_device?.name || 'Auto-Detect OLT'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">Interface OLT PON</span>
                              <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{displayOltRef}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">Status Sinyal Rx Power</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border inline-block ${getRxColor(attenuation?.avg_rx_power ?? node.rx_power)}`}>
                                {attenuation?.avg_rx_power ? `${attenuation.avg_rx_power} dBm (Rata-rata)` : (node.rx_power != null ? `${node.rx_power} dBm` : 'Normal (-21.5 dBm)')}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
                          <h4 className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider text-[11px]">3. Spesifikasi Teknis Optik &amp; Splitter</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <span className="text-slate-400 block text-[10px]">Rasio Splitter ODP</span>
                              <span className="font-bold text-slate-800 dark:text-slate-100">Rasio {node.splitter_config || node.splitter_type?.ratio || '1:8'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">Informasi Tube &amp; Warna Core</span>
                              <span className="font-semibold text-slate-800 dark:text-slate-100">{node.tube_info || '—'} (Core {node.core_color || '—'})</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">Kapasitas Total Port</span>
                              <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{node.total_ports} Port</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">Port Terisi (Digunakan)</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                {node.used_ports}/{node.total_ports} Port ({pct(node.used_ports, node.total_ports)}%)
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider text-[11px]">4. Lokasi &amp; Pemetaan Koordinat</h4>
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
                              <span className="text-slate-400 block text-[10px]">Alamat Lengkap / Area</span>
                              <span className="font-medium text-slate-800 dark:text-slate-100 uppercase">{node.address || '—'}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-200 dark:border-slate-700/60">
                              <div>
                                <span className="text-slate-400 block text-[10px]">Koordinat Desimal</span>
                                <span className="font-mono text-slate-700 dark:text-slate-300">{hasCoords ? `${node.latitude}, ${node.longitude}` : '—'}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px]">Koordinat DMS</span>
                                <span className="font-mono text-slate-700 dark:text-slate-300">{hasCoords ? decimalToDms(node.latitude, node.longitude).formattedDms : '—'}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {ports.length > 0 && (
                          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
                            <h4 className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider text-[11px]">5. Daftar Port Pelanggan ({ports.length} Port)</h4>
                            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                              <table className="w-full text-left text-[11px]">
                                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold sticky top-0">
                                  <tr>
                                    <th className="py-2 px-3">Port</th>
                                    <th className="py-2 px-3">Pelanggan / Label</th>
                                    <th className="py-2 px-3">Status</th>
                                    <th className="py-2 px-3">Rx Sinyal</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                                  {ports.map((p) => (
                                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                      <td className="py-1.5 px-3 font-mono font-bold text-slate-600 dark:text-slate-300">P-{p.port_number}</td>
                                      <td className="py-1.5 px-3 font-medium text-slate-800 dark:text-slate-100">
                                        {p.customer_name_cache || p.customer_name || p.notes || '—'}
                                      </td>
                                      <td className="py-1.5 px-3">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.status === 'used' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                                          {p.status === 'used' ? 'Terisi' : 'Kosong'}
                                        </span>
                                      </td>
                                      <td className="py-1.5 px-3 font-mono text-[10px]">
                                        {p.rx_power != null ? `${p.rx_power} dBm` : '—'}
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

                  <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                    {canCrud ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => { onEditNode(node); closeFullOdpModal(); }}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all"
                        >
                          Edit ODP
                        </button>
                      </div>
                    ) : <div />}
                    <button onClick={closeFullOdpModal} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl">Tutup</button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN PAGE CONTROLLER
══════════════════════════════════════════════════════════════════ */
export default function NetworkInfrastructure() {
  const [searchParams] = useSearchParams();
  const scopedOltId = searchParams.get('olt_id');

  const [activeTab, setActiveTab] = useState('POP'); // 'POP' | 'ODC' | 'ODP'
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
    return (scopedOltId && scopedPops.length > 0)
      ? scopedPops
      : allNodes.filter(n => n.node_type === 'POP');
  }, [allNodes, scopedOltId]);

  const odcs = useMemo(() => filteredAllNodes.filter(n => n.node_type === 'ODC'), [filteredAllNodes]);
  const odps = useMemo(() => filteredAllNodes.filter(n => n.node_type === 'ODP'), [filteredAllNodes]);

  const [modalAddNode, setModalAddNode] = useState(null); // { type }
  const [showAddCableModal, setShowAddCableModal] = useState(false);
  const [editingCable, setEditingCable] = useState(null);

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
      const r = await fetch('/api/network-nodes?per_page=500');
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
        setNodeErr(err.errors ?? err.message ?? 'Gagal menyimpan node');
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
        setCableErr(err.errors ?? err.message ?? 'Gagal membuat kabel');
        return;
      }
      setShowAddCableModal(false);
      showToast(' Kabel & Core Matrix TIA-598-A berhasil dibuat!');
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
        setCableErr(err.errors ?? err.message ?? 'Gagal memperbarui kabel');
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

  const totalCores = popCables.reduce((a, c) => a + c.core_count_total, 0);
  const usedCores = popCables.reduce((a, c) => a + (c.cores ?? []).filter(cr => cr.status === 'used').length, 0);

  return (
    <div className="space-y-4 sm:space-y-6">

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-2xl shadow-2xl text-xs sm:text-sm font-semibold text-white transition-all ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Top Header Banner ──────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#3f3f46] p-5 rounded-lg shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-sans">
            Infrastruktur Jaringan Fiber Optik
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Dokumentasi hierarki POP, ODC, ODP, kapasitas core splitter, dan kabel backbone
          </p>
        </div>
        <RefreshButton
          isRefreshing={isRefreshing}
          onRefresh={triggerRefresh}
          lastUpdatedText={timeAgoText}
          label="Segarkan Infrastruktur"
        />
      </div>

      {/* Regional Scoped OLT Banner ("Data Wilayah") */}
      {scopedOltId && activeScopedOlt && (
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#3f3f46] rounded-lg p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 dark:bg-neutral-900 text-blue-700 dark:text-blue-400">
                Data Wilayah OLT
              </span>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                {activeScopedOlt.code || 'OLT REGION'}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold mt-1 text-slate-900 dark:text-white">
              Data Wilayah: {activeScopedOlt.name}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Vendor: {activeScopedOlt.vendor || 'ZTE/Huawei'} · Lokasi Headend: {activeScopedOlt.location || 'Utama'}
            </p>
          </div>
          <Link
            to="/network"
            className="px-3.5 py-2 bg-slate-100 dark:bg-neutral-900 hover:bg-slate-200 dark:hover:bg-neutral-800 border border-slate-200 dark:border-[#3f3f46] rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all shrink-0"
          >
            Tampilkan Semua Wilayah (Global)
          </Link>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="POP Central" value={pops.length} sub="Point of Presence Sentral" badgeText="POP" />
        <StatCard label="Kabinet ODC" value={odcs.length} sub="Optical Distribution Cabinet" badgeText="ODC" />
        <StatCard label="Titik ODP" value={odps.length} sub="Optical Distribution Point" badgeText="ODP" />
        <StatCard label="Core Terpakai" value={`${pct(usedCores, totalCores)}%`} sub={`${usedCores} / ${totalCores} Core Aktif`} badgeText="CORE" />
      </div>

      {/* TAB NAVIGATION BAR (Sleek & Segmented) */}
      <div className="bg-white dark:bg-black p-1.5 rounded-lg border border-slate-200 dark:border-[#3f3f46] shadow-2xs flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('POP')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-md text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${activeTab === 'POP'
            ? 'bg-blue-50 dark:bg-neutral-900 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60 shadow-2xs'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-neutral-950'
            }`}
        >
          <span>POP</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${activeTab === 'POP' ? 'bg-blue-100 dark:bg-neutral-800 text-blue-700 dark:text-blue-300' : 'bg-slate-100 dark:bg-neutral-900 text-slate-600 dark:text-slate-400'}`}>{pops.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('ODC')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-md text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${activeTab === 'ODC'
            ? 'bg-blue-50 dark:bg-neutral-900 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60 shadow-2xs'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-neutral-950'
            }`}
        >
          <span>ODC</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${activeTab === 'ODC' ? 'bg-blue-100 dark:bg-neutral-800 text-blue-700 dark:text-blue-300' : 'bg-slate-100 dark:bg-neutral-900 text-slate-600 dark:text-slate-400'}`}>{odcs.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('ODP')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-md text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${activeTab === 'ODP'
            ? 'bg-blue-50 dark:bg-neutral-900 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60 shadow-2xs'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-neutral-950'
            }`}
        >
          <span>ODP</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${activeTab === 'ODP' ? 'bg-blue-100 dark:bg-neutral-800 text-blue-700 dark:text-blue-300' : 'bg-slate-100 dark:bg-neutral-900 text-slate-600 dark:text-slate-400'}`}>{odps.length}</span>
        </button>
      </div>

      {/* TAB CONTENTS */}
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

      {activeTab === 'ODC' && (
        <OdcTabContent
          onAddNode={t => setModalAddNode({ type: t })}
          onEditNode={node => setModalAddNode({ type: 'ODC', editNode: node })}
          onDeleteNode={handleDeleteNode}
          refreshKey={refreshKey}
          onRefreshGlobal={refreshAll}
          scopedOltId={scopedOltId}
        />
      )}

      {activeTab === 'ODP' && (
        <OdpTabContent
          odps={odps}
          onAddNode={t => setModalAddNode({ type: t })}
          onEditNode={node => setModalAddNode({ type: 'ODP', editNode: node })}
          onDeleteNode={handleDeleteNode}
          refreshKey={refreshKey}
          onRefreshGlobal={refreshAll}
        />
      )}

      {/* Modal Add/Edit Node */}
      {modalAddNode && (
        <AddNodeModal
          type={modalAddNode.type}
          editNode={modalAddNode.editNode}
          parentNode={null}
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
