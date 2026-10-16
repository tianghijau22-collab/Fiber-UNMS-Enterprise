import React, {useState, useEffect, useRef, useCallback} from 'react';
import {createPortal} from 'react-dom';
import {opticalDiagnostic, opticalResponseMatches} from '../lib/opticalDiagnostic.js';
const IconX = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const IconNetwork = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);
const formatShortPort = value => value || '—';

export default function OpticalPowerModal({onu, activeOlt, onClose}) {
  const [loading, setLoading] = useState(true);
  const [opticalData, setOpticalData] = useState(null);
  const [error, setError] = useState(null);
  const [copiedSn, setCopiedSn] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const pending = useRef(null);
  const fetchOptical = useCallback(async () => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true); setOpticalData(null); setError(null);
    if (!activeOlt?.id || !onu.serial_number) {
      setError('OLT dan serial ONU harus dipilih terlebih dahulu.'); setLoading(false); return;
    }
    const query = new URLSearchParams({device_id:String(activeOlt.id)});
    const port = onu.port || onu.detected_port;
    if (port && onu.onu_id) { query.set('port',port); query.set('onu_id',String(onu.onu_id)); }
    try {
      const response = await fetch('/api/olt/optical-power/'+encodeURIComponent(onu.serial_number)+'?'+query,
        {signal:controller.signal,headers:{Accept:'application/json'}});
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Pembacaan diagnostik gagal.');
      if (!opticalResponseMatches(data,activeOlt.id,onu.serial_number)) throw new Error('Respons tidak sesuai dengan OLT dan ONU yang dipilih.');
      if (!controller.signal.aborted) {setOpticalData(data); setClock(Date.now());}
    } catch (err) {
      if (!controller.signal.aborted) setError(err.message || 'Koneksi ke server gagal.');
    } finally {if (!controller.signal.aborted) setLoading(false);}
  },[activeOlt?.id,onu.serial_number,onu.port,onu.detected_port,onu.onu_id]);
  useEffect(() => {fetchOptical(); return () => pending.current?.abort();},[fetchOptical]);
  useEffect(() => {const timer=setInterval(()=>setClock(Date.now()),1000);return ()=>clearInterval(timer);},[]);
  const handleCopySn = () => {
    if (onu.serial_number) {navigator.clipboard.writeText(onu.serial_number);setCopiedSn(true);}
  };
  const currentData=opticalResponseMatches(opticalData,activeOlt?.id,onu.serial_number) ? opticalData:null;
  return createPortal(<OpticalPowerContent {...{onu,activeOlt,onClose,loading,error,copiedSn,handleCopySn,fetchOptical,clock}} opticalData={currentData} />,document.body);
}

export function OpticalPowerContent({onu, activeOlt, onClose, opticalData, loading=false, error=null, copiedSn=false, handleCopySn=()=>{}, fetchOptical=()=>{}, clock=Date.now()}) {
  // Only the selected serial is shown before the API confirms optical observations.
  const d = opticalData || {};
  const presentation = opticalDiagnostic(opticalData, clock);
  const serialNumber = d.serial_number || onu.serial_number || '—';
  const macAddress = d.mac_address || null;
  const portName = presentation.interfaceLabel;
  const onuId = presentation.identityValid ? d.onu_id : null;
  const vendorModel = d.vendor_model || 'Belum tersedia';

  const isOnline = presentation.online === true;
  const isOffline = presentation.online === false;
  const isUnknown = presentation.quality === 'unknown';
  const rx = presentation.rx;
  const {tx, oltRx, voltage, bias} = presentation;
  const temp = presentation.temperature;
  const isLoss = presentation.quality === 'critical';
  const isWarning = presentation.quality === 'warning';
  const isGood = presentation.quality === 'good';
  const rxVal = rx;
  const clampedRx = rxVal !== null ? Math.max(-35, Math.min(-10, rxVal)) : null;
  const rxPercent = clampedRx === null ? null : ((clampedRx + 35) / 25) * 100;
  const needleRotation = rxPercent === null ? null : -90 + (rxPercent / 100) * 180;

  // Customer & Package info
  const customer = d.customer || {
    id: null,
    name: 'Belum terhubung',
    customer_number: '—',
    phone: '—',
    address: '—',
  };
  const packageInfo = d.package || null;
  const serviceInfo = d.service || {
    ip_address: '—',
    pppoe_username: '—',
    installed_date: null,
    activated_date: null,
    registered_date: null,
    last_online: null,
  };
  const distInfo = d.distribution || {
    odp_name: '—',
    odp_port: '—',
  };


  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-[99999] flex items-center justify-center p-3 sm:p-6 overflow-y-auto min-h-screen">
      <div className="relative bg-white dark:bg-black border border-black/20 dark:border-white/20 rounded-lg sm:rounded-lg w-full max-w-3xl shadow-2xl my-auto overflow-hidden animate-in fade-in zoom-in duration-150 flex flex-col max-h-[94vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-black/10 dark:border-white/20 px-6 py-4 bg-black/5 dark:bg-white/10">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${presentation.online === null ? 'bg-slate-100 text-slate-500' : isOffline ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'}`}>
              <IconNetwork />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-black dark:text-white">
                  Detail Perangkat ONU &amp; Telemetri
                </h3>
                <span className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-full border ${presentation.online === null ? 'bg-slate-100 text-slate-600 border-slate-300' : !isOffline ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'}`}>
                  {loading ? 'Memeriksa...' : presentation.label}
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-black/5 dark:bg-white/10 text-black/70 dark:text-white/90 border border-black/20 dark:border-white/20">
                  {presentation.sourceLabel}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-black/60 dark:text-white/70 font-mono mt-0.5">
                <span className="font-semibold text-black/80 dark:text-white/90 font-sans">{customer.name || 'Pelanggan'}</span>
                <span>·</span>
                <span>SN: <strong className="text-black dark:text-white font-mono">{serialNumber}</strong></span>
                <button
                  type="button"
                  onClick={handleCopySn}
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-black/5 dark:bg-white/10 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-white/20 text-black/70 dark:text-white/90 transition-colors"
                  title="Salin Serial Number"
                >
                  {copiedSn ? '✓ Tersalin' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-black/50 hover:text-black dark:text-white/60 dark:hover:text-white p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <IconX />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between">
              <span>{error}</span>
              <button onClick={fetchOptical} className="underline font-bold hover:text-amber-900 ml-2">Coba Lagi</button>
            </div>
          )}

          <div className="text-xs text-slate-600 dark:text-slate-300" role="status">
            <span>{presentation.stamp}</span>
            {presentation.message && <p className="mt-1">{presentation.message}</p>}
            {d.registration_status === 'ambiguous' && <p className="mt-1">Hubungan pelanggan ambigu; data layanan tidak ditampilkan.</p>}
            {d.registration_status === 'unlinked' && <p className="mt-1">ONU belum terkait pelanggan pada OLT ini.</p>}
          </div>

          {/* 1. SPEEDOMETER / OPTICAL GAUGE CARD */}
          <div className={`p-6 rounded-lg sm:rounded-lg border text-center relative overflow-hidden transition-all shadow-sm ${isUnknown ? 'bg-slate-50 dark:bg-slate-900/20 border-slate-300 dark:border-slate-700' : isOffline || isLoss
            ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
            : isWarning
              ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50'
              : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50'
            }`}>
            <div className="text-[11px] font-bold uppercase tracking-wider text-black/60 dark:text-white/70 mb-2 flex items-center justify-center gap-2">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                Optical Rx Power Level (Kekuatan Sinyal Terima)
              </span>
              {loading && <span className="text-indigo-600 dark:text-indigo-400 animate-pulse text-[10px]">● Polling OLT...</span>}
            </div>

            {/* High-Precision SVG Gauge */}
            <div className="relative w-64 h-32 mx-auto flex items-end justify-center">
              <svg className="w-64 h-32 overflow-visible" viewBox="0 0 240 125">
                <defs>
                  <filter id="gauge-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#6366f1" floodOpacity="0.3" />
                  </filter>
                </defs>

                {/* Track background */}
                <path
                  d="M 35 115 A 85 85 0 0 1 205 115"
                  fill="none"
                  stroke="currentColor"
                  className="text-black/20 dark:text-white/20 dark:text-white/60"
                  strokeWidth="11"
                  strokeLinecap="round"
                />

                {/* Red Zone: -35 to -27 dBm (32% arc) */}
                <path
                  d="M 35 115 A 85 85 0 0 1 74.5 43.2"
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="9"
                  strokeLinecap="round"
                />

                {/* Amber Zone: -27 to -24 dBm (12% arc) */}
                <path
                  d="M 74.5 43.2 A 85 85 0 0 1 104.1 31.5"
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="9"
                />

                {/* Green Zone: -24 to -10 dBm (56% arc) */}
                <path
                  d="M 104.1 31.5 A 85 85 0 0 1 205 115"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="9"
                  strokeLinecap="round"
                />

                {/* Scale tick markers and numbers */}
                <text x="25" y="123" className="text-[10px] fill-slate-400 dark:fill-slate-500 font-mono font-bold" textAnchor="middle">-35</text>
                <text x="68" y="36" className="text-[9px] fill-rose-500 font-mono font-bold" textAnchor="middle">-27</text>
                <text x="103" y="24" className="text-[9px] fill-amber-500 font-mono font-bold" textAnchor="middle">-24</text>
                <text x="215" y="123" className="text-[10px] fill-emerald-500 font-mono font-bold" textAnchor="middle">-10</text>

                {/* Needle Indicator with Smooth Transition */}
                {rxVal !== null && <g data-optical-needle="true"
                  transform={`rotate(${needleRotation} 120 115)`}
                  filter="url(#gauge-glow)"
                  className="transition-transform duration-700 ease-out"
                >
                  <line x1="120" y1="115" x2="120" y2="38" stroke="#4f46e5" strokeWidth="3.5" strokeLinecap="round" className="dark:stroke-indigo-400" />
                  <polygon points="116,52 124,52 120,33" fill="#4f46e5" className="dark:fill-indigo-400" />
                  <circle cx="120" cy="115" r="7" fill="#4f46e5" stroke="#ffffff" strokeWidth="2.5" className="dark:stroke-slate-900" />
                  <circle cx="120" cy="115" r="2.5" fill="#ffffff" />
                </g>}
              </svg>
            </div>

            {/* Main Rx Power Digital Readout */}
            <div className="mt-1 flex flex-col items-center">
              <div className="flex items-baseline gap-1.5">
                <span className={`text-4xl sm:text-5xl font-black font-mono tracking-tight ${
                  isOffline ? 'text-black/40 dark:text-white/50' :
                  isGood ? 'text-emerald-600 dark:text-emerald-400' :
                  isWarning ? 'text-amber-600 dark:text-amber-400' :
                  'text-rose-600 dark:text-rose-400'
                }`}>
                  {isOffline ? 'OFFLINE' : (rxVal !== null ? rxVal.toFixed(2) : 'N/A')}
                </span>
                {rxVal !== null && (
                  <span className="text-sm font-bold font-mono text-black/60 dark:text-white/70">dBm</span>
                )}
              </div>

              {/* Dynamic Status Pill */}
              <div className="mt-2 inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold bg-white dark:bg-white/10 shadow-sm border border-black/20 dark:border-white/20">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  isUnknown ? 'bg-slate-400' : isOffline ? 'bg-rose-500' :
                  isGood ? 'bg-emerald-500 animate-pulse' :
                  isWarning ? 'bg-amber-500 animate-pulse' :
                  'bg-rose-500 animate-pulse'
                }`}></span>
                <span className={
                  isUnknown ? 'text-slate-600 dark:text-slate-300' : isOffline ? 'text-rose-700 dark:text-rose-400' :
                  isGood ? 'text-emerald-700 dark:text-emerald-400' :
                  isWarning ? 'text-amber-700 dark:text-amber-400' :
                  'text-rose-700 dark:text-rose-400'
                }>
                  {isUnknown ? (isOnline ? 'Online · redaman N/A' : presentation.label) : isOffline
                    ? 'Offline terverifikasi; penyebab belum dipastikan'
                    : isGood
                      ? 'Kualitas Sinyal Sangat Baik (Optimal)'
                      : isWarning
                        ? 'Kualitas Sinyal Cukup (Perlu Waspada)'
                        : 'Kualitas Sinyal Kritis (Redaman Tinggi)'}
                </span>
              </div>
            </div>

            {/* Linear Spectrum Range Bar */}
            <div className="mt-4 max-w-md mx-auto w-full px-2">
              <div className="relative pt-3 pb-1">
                {!isOffline && rxVal !== null && (
                  <div
                    className="absolute top-0 -translate-x-1/2 transition-all duration-700 ease-out flex flex-col items-center z-10"
                    style={{ left: `${rxPercent}%` }}
                  >
                    <div className="w-2.5 h-2.5 bg-indigo-600 dark:bg-indigo-400 rotate-45 transform shadow-xs"></div>
                  </div>
                )}
                <div className="h-2 w-full rounded-full overflow-hidden flex bg-black/10 dark:bg-white/20 shadow-inner">
                  <div style={{ width: '32%' }} className="bg-rose-500" title="Kritis (< -27 dBm)"></div>
                  <div style={{ width: '12%' }} className="bg-amber-400" title="Waspada (-27 s/d -24 dBm)"></div>
                  <div style={{ width: '56%' }} className="bg-emerald-500" title="Optimal (-24 s/d -10 dBm)"></div>
                </div>
              </div>
              <div className="flex justify-between text-[10px] font-semibold text-black/40 dark:text-white/50 font-mono mt-1">
                <span>Kritis (&lt; -27)</span>
                <span>Waspada (-27..-24)</span>
                <span>Optimal (-24..-10 dBm)</span>
              </div>
            </div>
          </div>

          {/* 2. TRANSCEIVER SENSORS TELEMETRY GRID (6 METRICS) */}
          <div className="space-y-2.5">
            <div className="text-xs font-bold text-black/60 dark:text-white/70 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span>Telemetri SFP &amp; Sensor Fisik Optik</span>
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* 1. Tx Power (Modem) */}
              <div className="bg-black/5 dark:bg-white/10 p-3.5 rounded-lg border border-black/20 dark:border-white/20 flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-bold text-black/50 dark:text-white/60 uppercase tracking-wider">Tx Power (Modem)</div>
                  <div className="text-base font-extrabold font-mono text-black dark:text-white mt-1">
                    {!isOffline && tx !== null ? `${parseFloat(tx).toFixed(2)} dBm` : '—'}
                  </div>
                </div>
                <div className="text-[10px] text-black/60 dark:text-white/70 mt-1">Laser Output ONT</div>
              </div>

              {/* 2. OLT Rx Power */}
              <div className="bg-black/5 dark:bg-white/10 p-3.5 rounded-lg border border-black/20 dark:border-white/20 flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-bold text-black/50 dark:text-white/60 uppercase tracking-wider">OLT Rx Power</div>
                  <div className="text-base font-extrabold font-mono text-black dark:text-white mt-1">
                    {!isOffline && oltRx !== null ? `${parseFloat(oltRx).toFixed(2)} dBm` : '—'}
                  </div>
                </div>
                <div className="text-[10px] text-black/60 dark:text-white/70 mt-1">Diterima Port OLT</div>
              </div>

              {/* 3. Port PON OLT */}
              <div className="bg-black/5 dark:bg-white/10 p-3.5 rounded-lg border border-black/20 dark:border-white/20 flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-bold text-black/50 dark:text-white/60 uppercase tracking-wider">Port PON OLT</div>
                  <div className="text-sm font-extrabold font-mono text-indigo-600 dark:text-indigo-400 mt-1 break-all" title={portName}>
                    {formatShortPort(portName)}
                    {onuId ? ` (ID ${onuId})` : ''}
                  </div>
                </div>
                <div className="text-[10px] text-black/60 dark:text-white/70 mt-1">Interface PON Card</div>
              </div>

              {/* 4. Tegangan Optik */}
              <div className="bg-black/5 dark:bg-white/10 p-3.5 rounded-lg border border-black/20 dark:border-white/20 flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-bold text-black/50 dark:text-white/60 uppercase tracking-wider">Tegangan Optik</div>
                  <div className="text-base font-extrabold font-mono text-black dark:text-white mt-1">
                    {!isOffline && voltage !== null ? `${parseFloat(voltage).toFixed(2)} V` : '—'}
                  </div>
                </div>
                <div className="text-[10px] text-black/60 dark:text-white/70 mt-1">Normal: 3.1 - 3.4 V</div>
              </div>

              {/* 5. Bias Current */}
              <div className="bg-black/5 dark:bg-white/10 p-3.5 rounded-lg border border-black/20 dark:border-white/20 flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-bold text-black/50 dark:text-white/60 uppercase tracking-wider">Bias Current</div>
                  <div className="text-base font-extrabold font-mono text-black dark:text-white mt-1">
                    {!isOffline && bias !== null ? `${parseFloat(bias).toFixed(1)} mA` : '—'}
                  </div>
                </div>
                <div className="text-[10px] text-black/60 dark:text-white/70 mt-1">Arus Laser ONT</div>
              </div>

              {/* 6. Suhu Transceiver */}
              <div className="bg-black/5 dark:bg-white/10 p-3.5 rounded-lg border border-black/20 dark:border-white/20 flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-bold text-black/50 dark:text-white/60 uppercase tracking-wider">Suhu Transceiver</div>
                  <div className="text-base font-extrabold font-mono text-black dark:text-white mt-1">
                    {!isOffline && temp !== null ? `${parseFloat(temp).toFixed(1)} °C` : '—'}
                  </div>
                </div>
                <div className="text-[10px] text-black/60 dark:text-white/70 mt-1">Sensor Thermal</div>
              </div>
            </div>
          </div>

          {/* 3. CUSTOMER & SERVICE SUBSCRIPTION CARD */}
          <div className="p-4 rounded-lg bg-black/5 dark:bg-white/5 border border-black/20 dark:border-white/20 space-y-3">
            <div className="text-xs font-bold text-black dark:text-white flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span>Informasi Pelanggan</span>
              </span>
              {customer.id && (
                <a
                  href={`/customers?id=${customer.id}`}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline text-[11px] font-semibold"
                >
                  Buka Profil Pelanggan →
                </a>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-black/50 dark:text-white/60 block text-[10px] uppercase font-bold">Nama Pelanggan</span>
                <strong className="text-black dark:text-white font-semibold">{customer.name || '—'}</strong>
              </div>
              <div>
                <span className="text-black/50 dark:text-white/60 block text-[10px] uppercase font-bold">ID / No. Pelanggan</span>
                <strong className="text-black dark:text-white font-mono">{customer.customer_number || '—'}</strong>
              </div>
              <div className="sm:col-span-2">
                <span className="text-black/50 dark:text-white/60 block text-[10px] uppercase font-bold">Alamat Pemasangan</span>
                <span className="text-black/80 dark:text-white/90">{customer.address || '—'}</span>
              </div>
            </div>
          </div>

          {/* 4. NETWORK TOPOLOGY & DISTRIBUTION CARD */}
          <div className="p-4 rounded-lg bg-black/5 dark:bg-white/5 border border-black/20 dark:border-white/20 space-y-3">
            <div className="text-xs font-bold text-black dark:text-white flex items-center justify-between">
              <span>Jalur Topologi Jaringan &amp; Titik Distribusi</span>
              <span className="text-[11px] text-black/50 dark:text-white/60 font-mono">
                OLT: {activeOlt?.name || 'OLT Induk'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-black/50 dark:text-white/60 block text-[10px] uppercase font-bold">Titik ODP</span>
                <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{distInfo.odp_name || '—'}</strong>
              </div>
              <div>
                <span className="text-black/50 dark:text-white/60 block text-[10px] uppercase font-bold">OLT Induk</span>
                <strong className="text-black dark:text-white font-semibold">
                  {activeOlt?.name || 'OLT Induk'}
                </strong>
              </div>
              <div>
                <span className="text-black/50 dark:text-white/60 block text-[10px] uppercase font-bold">Terakhir Online</span>
                <span className="text-black/80 dark:text-white/90 font-mono">{serviceInfo.last_online || 'Belum tersedia'}</span>
              </div>
            </div>
          </div>

          {/* 5. DIAGNOSTIC RECOMMENDATION */}
          <div className="p-4 rounded-lg bg-black/5 dark:bg-white/5 border border-black/20 dark:border-white/20 text-xs space-y-1">
            <div className="font-bold text-black dark:text-white flex items-center gap-1.5">
              <span>Rekomendasi &amp; Analisa Teknis:</span>
            </div>
            <p className="text-black/70 dark:text-white/70 leading-relaxed">
              {isUnknown
                ? 'Status atau redaman belum terverifikasi. Ulangi pembacaan dan periksa koneksi OLT sebelum menyimpulkan gangguan pelanggan.'
                : isOffline
                  ? 'Status hardware menunjukkan ONU Offline. Penyebab belum dipastikan; periksa daya dan jalur optik pelanggan.'
                  : isGood
                    ? 'Redaman terukur berada pada kisaran baik. Pengukuran ini tidak membuktikan kualitas trafik atau packet loss.'
                    : isWarning
                      ? 'Redaman terukur berada pada kisaran waspada. Periksa konektor dan jalur optik bila ada keluhan.'
                      : 'Redaman terukur lemah, tetapi status ONU tetap Online. Periksa konektor dan jalur optik pelanggan.'}
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-black/10 dark:border-white/20 flex flex-wrap items-center justify-between gap-2 bg-black/5 dark:bg-black/60">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchOptical}
              disabled={loading}
              className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-xs cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Memindai SNMP...</span>
                </>
              ) : (
                <span>Polling Ulang SNMP</span>
              )}
            </button>

            <a
              href="/gis-topology-map"
              className="px-3 py-2.5 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-black/80 dark:text-white/90 font-bold text-xs transition-colors flex items-center gap-1 border border-black/20 dark:border-white/20"
            >
              <span>Peta Topologi GIS</span>
            </a>

            {customer.id && (
              <a
                href={`/customers?id=${customer.id}`}
                className="px-3 py-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs transition-colors flex items-center gap-1 border border-indigo-200 dark:border-indigo-800"
              >
                <span>Buka Profil Pelanggan →</span>
              </a>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg bg-black/10 dark:bg-white/10 text-black dark:text-white font-bold text-xs hover:bg-black/20 dark:hover:bg-white/20 transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
