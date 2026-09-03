import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import ConfirmDialog from '../components/ConfirmDialog';

/* ══════════════════════════════════════════════════════════════════
   FIBER OPTIC COLOR STANDARDS (TIA/EIA-598)
══════════════════════════════════════════════════════════════════ */
const FIBER_COLORS = [
  { no: 1, name: 'Biru (Blue)', bg: 'bg-blue-600', dot: '#2563eb' },
  { no: 2, name: 'Orange', bg: 'bg-orange-500', dot: '#f97316' },
  { no: 3, name: 'Hijau (Green)', bg: 'bg-emerald-600', dot: '#10b981' },
  { no: 4, name: 'Coklat (Brown)', bg: 'bg-amber-900', dot: '#78350f' },
  { no: 5, name: 'Abu-abu (Slate)', bg: 'bg-slate-500', dot: '#64748b' },
  { no: 6, name: 'Putih (White)', bg: 'bg-slate-200', dot: '#e2e8f0' },
  { no: 7, name: 'Merah (Red)', bg: 'bg-rose-600', dot: '#e11d48' },
  { no: 8, name: 'Hitam (Black)', bg: 'bg-slate-950', dot: '#020617' },
  { no: 9, name: 'Kuning (Yellow)', bg: 'bg-yellow-400', dot: '#facc15' },
  { no: 10, name: 'Ungu (Violet)', bg: 'bg-purple-600', dot: '#9333ea' },
  { no: 11, name: 'Pink (Rose)', bg: 'bg-pink-500', dot: '#ec4899' },
  { no: 12, name: 'Toska (Aqua)', bg: 'bg-cyan-500', dot: '#06b6d4' },
];

const SFP_VENDORS = [
  'WTD',
  'HISENSE',
  'MIKROBITS',
  'TARMOC',
  'HUAWEI',
  'MIKROTIK',
  'ZTE',
  'CISCO',
  'FINISAR',
  'OEM DDM',
];

const SM_LINK_LENGTHS = ['10Km', '20Km', '40Km', '80Km', '120Km'];

/* ══════════════════════════════════════════════════════════════════
   MODAL FORM BTS (Teleported via createPortal to document.body)
══════════════════════════════════════════════════════════════════ */
function BtsFormModal({ site, onSave, onClose, loading, error }) {
  const [form, setForm] = useState({
    name: site?.name ?? '',
    link_segment: site?.link_segment ?? '',
    code: site?.code ?? '',
    measurement_date: site?.measurement_date ? site.measurement_date.split('T')[0] : new Date().toISOString().split('T')[0],
    sfp_sm_link_length: site?.sfp_sm_link_length ?? '20Km',
    sfp_vendor: site?.sfp_vendor ?? 'HISENSE',
    tx_power: site?.tx_power !== null && site?.tx_power !== undefined ? String(site.tx_power) : '-3.000',
    rx_power: site?.rx_power !== null && site?.rx_power !== undefined ? String(site.rx_power) : '-10.000',
    cable_length_km: site?.cable_length_km !== null && site?.cable_length_km !== undefined ? String(site.cable_length_km) : '5.00',
    tube_number: site?.tube_number ?? 1,
    tube_color: site?.tube_color ?? 'Biru (Blue)',
    core_number: site?.core_number ?? 1,
    core_color: site?.core_color ?? 'Biru (Blue)',
    latitude: site?.latitude ?? '',
    longitude: site?.longitude ?? '',
    address: site?.address ?? '',
    mikrotik_ip: site?.mikrotik_ip ?? '10.20.10.1',
    sfp_port_name: site?.sfp_port_name ?? 'sfp-sfpplus1',
    notes: site?.notes ?? '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleTubeChange = (no) => {
    const fc = FIBER_COLORS.find(c => c.no === no);
    setForm(prev => ({
      ...prev,
      tube_number: no,
      tube_color: fc ? fc.name : `Tube ${no}`,
    }));
  };

  const handleCoreChange = (no) => {
    const colorIndex = ((no - 1) % 12);
    const fc = FIBER_COLORS[colorIndex];
    setForm(prev => ({
      ...prev,
      core_number: no,
      core_color: fc ? fc.name : `Core ${no}`,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  const fc = 'w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all font-medium';
  const lc = 'block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1';

  return createPortal(
    <div className="fixed inset-0 z-[99999] overflow-y-auto bg-black/75 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col my-auto max-h-[88vh] overflow-hidden animate-in fade-in zoom-in duration-150">
        
        {/* Modal Header - Always Pinned At Top */}
        <div className="bg-slate-900 dark:bg-slate-950 text-white px-5 py-4 flex items-center justify-between flex-shrink-0 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold">{site ? `Edit Site BTS — ${site.name}` : 'Tambah Site BTS Baru'}</h3>
            <p className="text-xs text-slate-300">Pengukuran Redaman FO &amp; Parameter SFP Realtime</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white font-bold cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Form Wrapper */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          
          {/* Scrollable Form Content */}
          <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
            {error && (
              <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl p-3 text-xs text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <div>
              <label className={lc}>Nama Site BTS / Titik Lokasi *</label>
              <input
                required
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="misal: BTS SMK 3, BTS PRUMNAS KOBAR"
                className={fc}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lc}>Link / Sub-Segmen Feeder</label>
                <input
                  value={form.link_segment}
                  onChange={e => set('link_segment', e.target.value)}
                  placeholder="misal: LINK -VIA KP JAWA(SMK3)"
                  className={fc}
                />
              </div>
              <div>
                <label className={lc}>Tanggal Pengukuran</label>
                <input
                  type="date"
                  value={form.measurement_date}
                  onChange={e => set('measurement_date', e.target.value)}
                  className={fc}
                />
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-3">
              <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Parameter Optik SFP (Transceiver)
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={lc}>Vendor Nama (Merek SFP) *</label>
                  <input
                    required
                    list="sfp-vendor-opt"
                    value={form.sfp_vendor}
                    onChange={e => set('sfp_vendor', e.target.value.toUpperCase())}
                    placeholder="HISENSE, WTD, MIKROBITS"
                    className={`${fc} uppercase font-bold`}
                  />
                  <datalist id="sfp-vendor-opt">
                    {SFP_VENDORS.map(v => <option key={v} value={v} />)}
                  </datalist>
                </div>

                <div>
                  <label className={lc}>SM Link Length (Jarak SFP) *</label>
                  <select
                    value={form.sfp_sm_link_length}
                    onChange={e => set('sfp_sm_link_length', e.target.value)}
                    className={`${fc} font-semibold`}
                  >
                    {SM_LINK_LENGTHS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={lc}>Tx Power (dBm)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={form.tx_power}
                    onChange={e => set('tx_power', e.target.value)}
                    placeholder="-2.264"
                    className={`${fc} font-mono font-bold`}
                  />
                </div>
                <div>
                  <label className={lc}>Rx Power (dBm) *</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={form.rx_power}
                    onChange={e => set('rx_power', e.target.value)}
                    placeholder="-9.570"
                    className={`${fc} font-mono font-bold text-indigo-600 dark:text-indigo-400`}
                  />
                </div>
                <div>
                  <label className={lc}>Jarak Kabel (Km)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.cable_length_km}
                    onChange={e => set('cable_length_km', e.target.value)}
                    placeholder="5.17"
                    className={`${fc} font-mono`}
                  />
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 rounded-xl space-y-2.5">
              <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Alokasi Tube &amp; Core Serat Optik (TIA-598)
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Tube: <strong>Tube {form.tube_number} ({form.tube_color})</strong>
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {FIBER_COLORS.slice(0, 6).map(c => (
                      <button
                        key={c.no}
                        type="button"
                        onClick={() => handleTubeChange(c.no)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                          form.tube_number === c.no
                            ? `${c.bg} text-white border-transparent ring-2 ring-indigo-500`
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        T{c.no}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Core: <strong>Core {form.core_number} ({form.core_color})</strong>
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {FIBER_COLORS.map(c => (
                      <button
                        key={c.no}
                        type="button"
                        onClick={() => handleCoreChange(c.no)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                          form.core_number === c.no
                            ? `${c.bg} text-white border-transparent ring-2 ring-indigo-500`
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        C{c.no}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lc}>Latitude</label>
                <input
                  type="number"
                  step="0.0000001"
                  value={form.latitude}
                  onChange={e => set('latitude', e.target.value)}
                  placeholder="-0.792514"
                  className={`${fc} font-mono`}
                />
              </div>
              <div>
                <label className={lc}>Longitude</label>
                <input
                  type="number"
                  step="0.0000001"
                  value={form.longitude}
                  onChange={e => set('longitude', e.target.value)}
                  placeholder="100.658231"
                  className={`${fc} font-mono`}
                />
              </div>
            </div>


          </div>

          {/* Modal Footer - Always Pinned At Bottom */}
          <div className="px-5 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-60 cursor-pointer"
            >
              {loading ? 'Menyimpan...' : (site ? 'Simpan Perubahan' : 'Buat Site BTS')}
            </button>
          </div>
        </form>

      </div>
    </div>,
    document.body
  );
}

/* ══════════════════════════════════════════════════════════════════
   MODAL DETAIL SITE BTS (Teleported via createPortal to document.body)
══════════════════════════════════════════════════════════════════ */
function BtsDetailModal({ site, onClose, onReadLive }) {
  if (!site) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] overflow-y-auto bg-black/75 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col my-auto max-h-[88vh] overflow-hidden animate-in fade-in zoom-in duration-150">
        
        {/* Pinned Header */}
        <div className="bg-slate-900 dark:bg-slate-950 text-white px-5 py-4 flex items-center justify-between flex-shrink-0 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <span>Detail Site: {site.name}</span>
            </h3>
            <p className="text-xs text-slate-300">Link: {site.link_segment || 'Feeder Fiber Optic BTS'}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Highlight Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Rx Power</div>
              <div className="text-sm font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
                {site.rx_power !== null ? `${parseFloat(site.rx_power).toFixed(2)} dBm` : '—'}
              </div>
            </div>
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Tx Power</div>
              <div className="text-sm font-bold font-mono text-slate-800 dark:text-slate-200 mt-0.5">
                {site.tx_power !== null ? `${parseFloat(site.tx_power).toFixed(2)} dBm` : '—'}
              </div>
            </div>
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Jarak FO</div>
              <div className="text-sm font-bold font-mono text-slate-800 dark:text-slate-200 mt-0.5">
                {site.cable_length_km !== null ? `${site.cable_length_km} Km` : '—'}
              </div>
            </div>
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Jarak SFP</div>
              <div className="text-sm font-bold font-mono text-slate-800 dark:text-slate-200 mt-0.5">
                {site.sfp_sm_link_length || '20Km'}
              </div>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700">
            <div className="grid grid-cols-3 p-3 items-center">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Vendor SFP</span>
              <span className="col-span-2 font-bold uppercase text-slate-800 dark:text-slate-100">{site.sfp_vendor || '—'}</span>
            </div>
            <div className="grid grid-cols-3 p-3 items-center">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Link Feeder</span>
              <span className="col-span-2 font-medium text-slate-800 dark:text-slate-100">{site.link_segment || '—'}</span>
            </div>
            <div className="grid grid-cols-3 p-3 items-center">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Tgl Pengukuran</span>
              <span className="col-span-2 font-mono text-slate-800 dark:text-slate-100">{site.formatted_date || site.measurement_date}</span>
            </div>
            <div className="grid grid-cols-3 p-3 items-center">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Tube &amp; Core</span>
              <div className="col-span-2 flex flex-wrap gap-2 items-center">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-2xs">
                  <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0 shadow-2xs border border-black/10" style={{ backgroundColor: FIBER_COLORS[((site.tube_number - 1) % 12)]?.dot || '#2563eb' }} />
                  <span>Tube #{site.tube_number} ({site.tube_color || FIBER_COLORS[((site.tube_number - 1) % 12)]?.name || 'Biru'})</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-2xs">
                  <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0 shadow-2xs border border-black/10" style={{ backgroundColor: FIBER_COLORS[((site.core_number - 1) % 12)]?.dot || '#2563eb' }} />
                  <span>Core #{site.core_number} ({site.core_color || FIBER_COLORS[((site.core_number - 1) % 12)]?.name || 'Biru'})</span>
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 p-3 items-center">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Koordinat GPS</span>
              <span className="col-span-2 font-mono text-slate-800 dark:text-slate-100">
                {site.latitude && site.longitude ? `${site.latitude}, ${site.longitude}` : '—'}
              </span>
            </div>

          </div>
        </div>

        {/* Pinned Footer */}
        <div className="px-5 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            {site.google_maps_url && (
              <a
                href={site.google_maps_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 text-xs font-semibold"
              >
                Google Maps
              </a>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}

/* ══════════════════════════════════════════════════════════════════
   MODAL DIAGNOSTIK SFP REALTIME (Teleported via createPortal)
══════════════════════════════════════════════════════════════════ */
function BtsLiveDiagModal({ modal, reading, onClose, onRefresh }) {
  if (!modal) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] overflow-y-auto bg-black/75 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col my-auto max-h-[88vh] overflow-hidden animate-in fade-in zoom-in duration-150 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 flex-shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>⚡ Diagnostik Optik SFP Realtime</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{modal.name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-white font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {reading ? (
          <div className="py-10 text-center space-y-3">
            <svg className="animate-spin h-6 w-6 text-indigo-600 mx-auto" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Menghubungi MikroTik Router ({modal.mikrotik_ip || '10.20.10.1'})...
            </div>
            <div className="text-[10px] text-slate-400 font-mono">Query DDM SFP monitor port: {modal.sfp_port_name || 'sfp-sfpplus1'}</div>
          </div>
        ) : (
          <div className="space-y-3 text-xs flex-1 overflow-y-auto">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-2 border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">Rx Optical Power:</span>
                <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                  {modal.rx_power !== null ? `${parseFloat(modal.rx_power).toFixed(2)} dBm` : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">Tx Optical Power:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {modal.tx_power !== null ? `${parseFloat(modal.tx_power).toFixed(2)} dBm` : '—'}
                </span>
              </div>
              {modal.diagResult && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-400">SFP Temperature:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {modal.diagResult.temperature_c} °C
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-400">Supply Voltage:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {modal.diagResult.voltage_v} V
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-2 flex-shrink-0">
              <button
                onClick={() => onRefresh(modal)}
                className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-semibold rounded-xl text-xs cursor-pointer"
              >
                Baca Ulang
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN BTS MANAGEMENT PAGE
══════════════════════════════════════════════════════════════════ */
export default function BtsManagement() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total_bts: 0, good_count: 0, warning_count: 0, critical_count: 0, avg_rx_power: 0 });

  // Filters & Pagination State
  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('ALL');
  const [lengthFilter, setLengthFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;

  // Modals & Action States
  const [showModal, setShowModal] = useState(false);
  const [editingSite, setEditingSite] = useState(null);
  const [detailSite, setDetailSite] = useState(null);
  const [liveDiagModal, setLiveDiagModal] = useState(null);
  const [readingLive, setReadingLive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, vendorFilter, lengthFilter, statusFilter]);

  const fetchSites = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (vendorFilter !== 'ALL') params.append('vendor', vendorFilter);
    if (lengthFilter !== 'ALL') params.append('sm_length', lengthFilter);
    if (statusFilter !== 'ALL') params.append('status', statusFilter);

    Promise.all([
      fetch(`/api/bts-sites?${params.toString()}`).then(r => r.json()),
      fetch('/api/bts-sites-stats').then(r => r.json()),
    ])
      .then(([sitesRes, statsRes]) => {
        setSites(sitesRes.data || []);
        if (statsRes) setStats(statsRes);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch BTS sites:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchSites();
  }, [search, vendorFilter, lengthFilter, statusFilter]);

  const showToast = (msg, type = 'success') => {
    if (typeof window !== 'undefined' && window.showAppAlert) {
      window.showAppAlert({
        type: type === 'error' ? 'error' : 'success',
        title: type === 'error' ? 'Pemberitahuan Gagal' : 'Berhasil!',
        message: msg,
        duration: 2600,
      });
    }
  };

  const handleOpenAdd = () => {
    setEditingSite(null);
    setFormErr(null);
    setShowModal(true);
  };

  const handleOpenEdit = (site) => {
    setEditingSite(site);
    setFormErr(null);
    setShowModal(true);
  };

  const handleSave = async (formData) => {
    if (!formData.name.trim()) {
      setFormErr('Harap isi Nama Site BTS terlebih dahulu!');
      return;
    }

    setSaving(true);
    setFormErr(null);
    const url = editingSite ? `/api/bts-sites/${editingSite.id}` : '/api/bts-sites';
    const method = editingSite ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Data BTS berhasil disimpan.');
        setShowModal(false);
        setEditingSite(null);
        fetchSites();
      } else {
        setFormErr(data.message || 'Gagal menyimpan data.');
      }
    } catch (err) {
      console.error(err);
      setFormErr('Terjadi kesalahan koneksi server.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!deleteConfirm) return;
    fetch(`/api/bts-sites/${deleteConfirm.id}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(data => {
        showToast(data.message || 'Data BTS berhasil dihapus.');
        setDeleteConfirm(null);
        if (detailSite && detailSite.id === deleteConfirm.id) setDetailSite(null);
        fetchSites();
      })
      .catch(err => console.error(err));
  };

  const handleReadLivePower = (site) => {
    setLiveDiagModal(site);
    setReadingLive(true);

    fetch(`/api/bts-sites/${site.id}/read-live-power`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mikrotik_ip: site.mikrotik_ip,
        sfp_port_name: site.sfp_port_name,
      }),
    })
      .then(res => res.json())
      .then(data => {
        setReadingLive(false);
        if (data.success) {
          setLiveDiagModal({ ...site, ...data.data, diagResult: data.diag });
          showToast('Diagnostik optik SFP berhasil diperbarui secara realtime!');
          fetchSites();
          if (detailSite && detailSite.id === site.id) {
            setDetailSite({ ...site, ...data.data });
          }
        }
      })
      .catch(err => {
        setReadingLive(false);
        console.error(err);
      });
  };

  const filtered = useMemo(() => {
    return sites;
  }, [sites]);

  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const paginated = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  return (
    <div className="space-y-6">


      {/* Header Banner - Exact /customers Structure */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-black p-5 rounded-lg border border-slate-200 dark:border-[#222222] shadow-2xs">
        <div>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-sans">
            Manajemen Redaman FO BTS
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Pencatatan &amp; pemantauan redaman serat optik link BTS dari Core Server / MikroTik Router secara realtime
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={fetchSites}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>🔄</span>
            <span>Refresh</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>+ Tambah Site BTS</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar - Exact /customers Structure */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto flex-1">
          <input
            type="text"
            placeholder=" Cari nama BTS, vendor SFP, atau link segment..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-80 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Semua Status Redaman</option>
            <option value="good">Bagus (≥ -22 dBm)</option>
            <option value="warning">Waspada (-23 s/d -26 dBm)</option>
            <option value="critical">Kritis (&lt; -26 dBm)</option>
          </select>

          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Semua Vendor SFP</option>
            {SFP_VENDORS.map(v => <option key={v} value={v}>{v}</option>)}
          </select>

          <select
            value={lengthFilter}
            onChange={(e) => setLengthFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Semua Jarak SFP</option>
            {SM_LINK_LENGTHS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
          Total Site BTS: <span className="text-indigo-600 dark:text-indigo-400 font-bold">{filtered.length}</span> dari {sites.length}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 py-16 text-center text-slate-400 text-xs animate-pulse">
          <span>⚡</span> Memuat data site BTS &amp; redaman serat optik...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 py-16 text-center text-slate-400 text-xs">
          <p className="font-bold text-slate-600 dark:text-slate-300">Belum Ada Site BTS Ditemukan</p>
          <p className="mt-1">Klik "+ Tambah Site BTS" untuk mendaftarkan pengukuran baru.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View (hidden on mobile md:block) */}
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Nama Site BTS &amp; Link</th>
                    <th className="px-5 py-3.5">Tgl Ukur</th>
                    <th className="px-5 py-3.5">Vendor &amp; Jarak SFP</th>
                    <th className="px-5 py-3.5">Tx Power</th>
                    <th className="px-5 py-3.5">Rx Power (Redaman)</th>
                    <th className="px-5 py-3.5">Jarak Kabel Lurus</th>
                    <th className="px-5 py-3.5">Tube &amp; Core</th>
                    <th className="px-5 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginated.map(site => {
                    const rxVal = site.rx_power !== null ? parseFloat(site.rx_power) : null;
                    let rxBadge = 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200';
                    let rxLabel = '—';
                    if (rxVal !== null) {
                      rxLabel = `${rxVal.toFixed(2)} dBm`;
                      if (rxVal >= -22.0) {
                        rxBadge = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-bold';
                      } else if (rxVal >= -26.0) {
                        rxBadge = 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 font-bold';
                      } else {
                        rxBadge = 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 font-bold animate-pulse';
                      }
                    }

                    const tubeDot = FIBER_COLORS[((site.tube_number - 1) % 12)]?.dot || '#2563eb';
                    const tubeColorName = site.tube_color || FIBER_COLORS[((site.tube_number - 1) % 12)]?.name || 'Biru';
                    const coreDot = FIBER_COLORS[((site.core_number - 1) % 12)]?.dot || '#2563eb';
                    const coreColorName = site.core_color || FIBER_COLORS[((site.core_number - 1) % 12)]?.name || 'Biru';

                    return (
                      <tr key={site.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        {/* Nama BTS & Link */}
                        <td className="px-5 py-3.5">
                          <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{site.name}</p>
                          {site.link_segment && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium line-clamp-1 mt-0.5">{site.link_segment}</p>
                          )}
                        </td>

                        {/* Tanggal Ukur */}
                        <td className="px-5 py-3.5 whitespace-nowrap font-mono text-xs text-slate-700 dark:text-slate-300">
                          {site.formatted_date || site.measurement_date}
                        </td>

                        {/* Vendor & Jarak SFP */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{site.sfp_vendor || '—'}</span>
                          <span className="ml-1.5 text-xs font-mono text-slate-500 dark:text-slate-400">({site.sfp_sm_link_length})</span>
                        </td>

                        {/* Tx Power */}
                        <td className="px-5 py-3.5 whitespace-nowrap font-mono text-xs text-slate-700 dark:text-slate-300">
                          {site.tx_power !== null ? `${site.tx_power} dBm` : '—'}
                        </td>

                        {/* Rx Power (Redaman) */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-mono border ${rxBadge}`}>
                            {rxLabel}
                          </span>
                        </td>

                        {/* Jarak Tarikan Kabel */}
                        <td className="px-5 py-3.5 whitespace-nowrap font-mono text-xs text-slate-700 dark:text-slate-300">
                          {site.cable_length_km !== null ? `${site.cable_length_km} Km` : '—'}
                        </td>

                        {/* Tube & Core dengan Warna Lengkap */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex flex-col gap-1 text-xs">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-medium">
                              <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0 shadow-2xs border border-black/10" style={{ backgroundColor: tubeDot }} />
                              <span>Tube #{site.tube_number} ({tubeColorName})</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-medium">
                              <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0 shadow-2xs border border-black/10" style={{ backgroundColor: coreDot }} />
                              <span>Core #{site.core_number} ({coreColorName})</span>
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setDetailSite(site)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-1 cursor-pointer"
                              title="Lihat Detail Lengkap Site BTS"
                            >
                              <span>Detail</span>
                            </button>



                            {site.google_maps_url && (
                              <a
                                href={site.google_maps_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:underline"
                              >
                                Maps
                              </a>
                            )}

                            <button
                              onClick={() => handleOpenEdit(site)}
                              className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:underline cursor-pointer"
                            >
                              Edit
                            </button>

                            <button
                              onClick={() => setDeleteConfirm(site)}
                              className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                            >
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Desktop Pagination Bar - Exact /customers Structure */}
            <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">
                Menampilkan data <span className="font-bold text-slate-800 dark:text-slate-200">{(currentPage - 1) * perPage + 1}</span> - <span className="font-bold text-slate-800 dark:text-slate-200">{Math.min(currentPage * perPage, filtered.length)}</span> dari total <span className="font-bold text-indigo-600 dark:text-indigo-400">{filtered.length}</span> site BTS
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
                >
                  ← Sebelumnya
                </button>
                <span className="px-2 font-bold text-slate-700 dark:text-slate-200">
                  Halaman {currentPage} dari {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
                >
                  Berikutnya →
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Cards View (block on mobile md:hidden - Exact /customers Structure) */}
          <div className="block md:hidden space-y-4">
            {paginated.map((site, idx) => {
              const globalIndex = (currentPage - 1) * perPage + idx + 1;
              const rxVal = site.rx_power !== null ? parseFloat(site.rx_power) : null;
              let rxBadge = 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200';
              let rxLabel = '—';
              if (rxVal !== null) {
                rxLabel = `${rxVal.toFixed(2)} dBm`;
                if (rxVal >= -22.0) {
                  rxBadge = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
                } else if (rxVal >= -26.0) {
                  rxBadge = 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
                } else {
                  rxBadge = 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 font-bold animate-pulse';
                }
              }

              const coreDot = FIBER_COLORS[((site.core_number - 1) % 12)]?.dot || '#2563eb';

              return (
                <div key={site.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                  {/* Bordered Key-Value Table Grid */}
                  <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                    {/* Row 1: # Index */}
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center bg-slate-50/70 dark:bg-slate-800/40">
                      <span className="text-slate-400 font-semibold">#</span>
                      <span className="col-span-2 font-mono font-bold text-slate-700 dark:text-slate-200">{globalIndex}</span>
                    </div>



                    {/* Row 3: Name */}
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-slate-400 font-semibold">Nama BTS</span>
                      <span className="col-span-2 font-bold text-slate-800 dark:text-slate-100 uppercase">
                        {site.name}
                      </span>
                    </div>

                    {/* Row 4: Link / Sub-Segmen */}
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-slate-400 font-semibold">Link Feeder</span>
                      <span className="col-span-2 text-slate-700 dark:text-slate-300 leading-snug">
                        {site.link_segment || '—'}
                      </span>
                    </div>

                    {/* Row 5: Vendor & Jarak SFP */}
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-slate-400 font-semibold">Vendor SFP</span>
                      <span className="col-span-2 font-bold text-slate-800 dark:text-slate-200 uppercase">
                        {site.sfp_vendor || '—'} <span className="font-normal font-mono text-slate-500">({site.sfp_sm_link_length})</span>
                      </span>
                    </div>

                    {/* Row 6: Rx Power (Redaman) */}
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-slate-400 font-semibold">Rx Power</span>
                      <span className="col-span-2">
                        <span className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold border ${rxBadge}`}>
                          {rxLabel}
                        </span>
                      </span>
                    </div>

                    {/* Row 7: Tx Power & Jarak Kabel */}
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-slate-400 font-semibold">Tx / Jarak FO</span>
                      <span className="col-span-2 font-mono text-slate-700 dark:text-slate-300">
                        {site.tx_power !== null ? `${site.tx_power} dBm` : '—'} · {site.cable_length_km !== null ? `${site.cable_length_km} Km` : '—'}
                      </span>
                    </div>

                    {/* Row 8: Tube & Core */}
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-slate-400 font-semibold">Tube &amp; Core</span>
                      <span className="col-span-2 flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                          T{site.tube_number} ({site.tube_color})
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: coreDot }} />
                          C{site.core_number}
                        </span>
                      </span>
                    </div>

                    {/* Row 9: Actions */}
                    <div className="px-4 py-3 bg-slate-50/50 dark:bg-slate-800/20 flex flex-wrap items-center justify-end gap-2">
                      <button
                        onClick={() => setDetailSite(site)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold hover:bg-slate-200 cursor-pointer"
                      >
                        Detail
                      </button>

                      <button
                        onClick={() => handleReadLivePower(site)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold hover:bg-indigo-100 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <span>⚡ Live</span>
                      </button>

                      {site.google_maps_url && (
                        <a
                          href={site.google_maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold hover:bg-slate-200"
                        >
                          Maps
                        </a>
                      )}

                      <button
                        onClick={() => handleOpenEdit(site)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold hover:bg-slate-200 cursor-pointer"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => setDeleteConfirm(site)}
                        className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-[11px] font-semibold hover:bg-rose-100 cursor-pointer"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Mobile Pagination Control */}
            {totalPages > 1 && (
              <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between text-xs">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold disabled:opacity-40 cursor-pointer"
                >
                  ← Prev
                </button>
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {currentPage} / {totalPages} (Total {filtered.length})
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold disabled:opacity-40 cursor-pointer"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── Modal Form Tambah / Edit BTS ─── */}
      {showModal && (
        <BtsFormModal
          site={editingSite}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingSite(null); setFormErr(null); }}
          loading={saving}
          error={formErr}
        />
      )}

      {/* ─── Modal Detail Site BTS ─── */}
      {detailSite && (
        <BtsDetailModal
          site={detailSite}
          onClose={() => setDetailSite(null)}
          onReadLive={handleReadLivePower}
        />
      )}

      {/* ─── Modal Live Diagnostic ─── */}
      {liveDiagModal && (
        <BtsLiveDiagModal
          modal={liveDiagModal}
          reading={readingLive}
          onClose={() => setLiveDiagModal(null)}
          onRefresh={handleReadLivePower}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <ConfirmDialog
          isOpen={true}
          title="Hapus Data Site BTS"
          message={`Apakah Anda yakin ingin menghapus data site BTS "${deleteConfirm.name}" (${deleteConfirm.code})? Data ini akan dihapus dari sistem.`}
          confirmLabel="Hapus BTS"
          cancelLabel="Batal"
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
