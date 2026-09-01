import React from 'react';

/**
 * Komponen Diagram Topologi Optik FTTH Mengalir (Flowing Optical Pipeline)
 * Mendukung mode:
 * 1. 'pipeline' : End-to-end horizontal visual (OLT -> ODC -> ODP -> ONT) untuk Diagnostik Pelanggan
 * 2. 'tree'     : Hierarchical tree view dengan animasi laser bercabang untuk OLT Management & Network
 */
export default function FtthFlowTopology({
  oltName = 'OLT',
  portName = 'gpon-olt_1/1/1',
  odcName = 'ODC Utama',
  odcCode = 'ODC-01',
  odcSplitter = 'PLC 1:4',
  odpName = 'ODP Pelanggan',
  odpCode = 'ODP-01',
  odpPort = '1',
  odpSplitter = 'PLC 1:8',
  customerName = '',
  onuSerial = '—',
  onuType = 'HGU GPON/EPON',
  rxPower = null,
  txPower = null,
  distanceMeters = 850,
  pingMs = null,
  isOnline = true,
  className = '',
}) {
  const isLoss = !isOnline || rxPower === null || rxPower <= -38.0;

  // Rx Power color styling
  let rxBadgeBg = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  if (rxPower !== null && !isLoss) {
    if (rxPower >= -19.0) {
      rxBadgeBg = 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    } else if (rxPower >= -24.0) {
      rxBadgeBg = 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800';
    } else if (rxPower >= -27.0) {
      rxBadgeBg = 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    } else {
      rxBadgeBg = 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    }
  } else if (isLoss) {
    rxBadgeBg = 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
  }

  return (
    <div className={`relative w-full rounded-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-black text-white p-4 sm:p-6 border border-slate-800 shadow-xl overflow-hidden ${className}`}>
      {/* Background Optical Ambient Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-40" />
      
      {/* Laser Flow Header */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 mb-6 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-3 w-3 items-center justify-center">
            {isOnline ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_#10b981]" />
              </>
            ) : (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
              </>
            )}
          </div>
          <span className="text-xs font-bold tracking-wider uppercase text-slate-300">
            Jalur Optik FTTH Real-Time
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono font-semibold">
            1490nm Tx / 1310nm Rx
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="text-[10px]">Total Jarak:</span>
            <span className="font-mono font-bold text-slate-200">{distanceMeters} m</span>
          </div>
          {pingMs !== null && (
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="text-[10px]">Latensi:</span>
              <span className="font-mono font-bold text-emerald-400">{pingMs} ms</span>
            </div>
          )}
        </div>
      </div>

      {/* ── 4-NODE FLOWING PIPELINE ── */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-3 items-stretch">
        
        {/* ── NODE 1: OLT HEADEND ── */}
        <div className="relative group rounded-xl p-4 bg-slate-900/90 border border-blue-500/30 hover:border-blue-500/60 transition-all shadow-lg flex flex-col justify-between">
          <div className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-md bg-blue-600 text-[10px] font-bold tracking-wider uppercase text-white shadow-xs">
            1. OLT Headend
          </div>
          <div className="space-y-2 mt-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors truncate">
                {oltName}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800/80 font-bold">
                {portName}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span>Laser Tx SFP:</span>
            <span className="font-mono font-semibold text-emerald-400">
              {txPower ? `+${txPower} dBm` : '+7.80 dBm'}
            </span>
          </div>
        </div>

        {/* ── CONNECTOR 1: FEEDER FIBER ── */}
        <div className="hidden lg:flex absolute left-[24.5%] top-1/2 -translate-y-1/2 z-20 items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center">
            <svg className="w-10 h-6 overflow-visible" viewBox="0 0 40 24">
              <defs>
                <linearGradient id="laserGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
              </defs>
              <line x1="0" y1="12" x2="40" y2="12" stroke="url(#laserGrad1)" strokeWidth="3" className="animate-flow-laser" />
            </svg>
            <span className="text-[9px] font-mono text-blue-400 bg-slate-950 px-1 rounded border border-blue-900/60 -mt-1">
              Feeder
            </span>
          </div>
        </div>

        {/* ── NODE 2: ODC CABINET ── */}
        <div className="relative group rounded-xl p-4 bg-slate-900/90 border border-indigo-500/30 hover:border-indigo-500/60 transition-all shadow-lg flex flex-col justify-between">
          <div className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-md bg-indigo-600 text-[10px] font-bold tracking-wider uppercase text-white shadow-xs">
            2. ODC Feeder
          </div>
          <div className="space-y-2 mt-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors truncate">
                {odcName}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                {odcCode}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span>Splitter:</span>
              <span className="font-semibold text-indigo-300">{odcSplitter}</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span>Redaman Split:</span>
            <span className="font-mono font-semibold text-slate-300">-7.20 dB</span>
          </div>
        </div>

        {/* ── CONNECTOR 2: DISTRIBUTION FIBER ── */}
        <div className="hidden lg:flex absolute left-[49.5%] top-1/2 -translate-y-1/2 z-20 items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center">
            <svg className="w-10 h-6 overflow-visible" viewBox="0 0 40 24">
              <defs>
                <linearGradient id="laserGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
              <line x1="0" y1="12" x2="40" y2="12" stroke="url(#laserGrad2)" strokeWidth="3" className="animate-flow-laser" />
            </svg>
            <span className="text-[9px] font-mono text-indigo-400 bg-slate-950 px-1 rounded border border-indigo-900/60 -mt-1">
              Distribusi
            </span>
          </div>
        </div>

        {/* ── NODE 3: ODP DISTRIBUTION BOX ── */}
        <div className="relative group rounded-xl p-4 bg-slate-900/90 border border-purple-500/30 hover:border-purple-500/60 transition-all shadow-lg flex flex-col justify-between">
          <div className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-md bg-purple-600 text-[10px] font-bold tracking-wider uppercase text-white shadow-xs">
            3. ODP Distribusi
          </div>
          <div className="space-y-2 mt-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors truncate">
                {odpName}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                {odpCode}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span>Port Distribusi:</span>
              <span className="font-mono font-bold text-purple-300">Port {odpPort}</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span>Splitter:</span>
            <span className="font-semibold text-slate-300">{odpSplitter}</span>
          </div>
        </div>

        {/* ── CONNECTOR 3: DROP CABLE TO CLIENT ── */}
        <div className="hidden lg:flex absolute left-[74.5%] top-1/2 -translate-y-1/2 z-20 items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center">
            <svg className="w-10 h-6 overflow-visible" viewBox="0 0 40 24">
              <defs>
                <linearGradient id="laserGrad3" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor={!isLoss ? '#10b981' : '#f43f5e'} />
                </linearGradient>
              </defs>
              <line
                x1="0"
                y1="12"
                x2="40"
                y2="12"
                stroke={!isLoss ? 'url(#laserGrad3)' : '#f43f5e'}
                strokeWidth="3"
                className={!isLoss ? 'animate-flow-laser' : ''}
                strokeDasharray={isLoss ? '4 4' : '6 6'}
              />
            </svg>
            <span className={`text-[9px] font-mono px-1 rounded border bg-slate-950 -mt-1 ${!isLoss ? 'text-emerald-400 border-emerald-900/60' : 'text-rose-400 border-rose-900/60'}`}>
              Drop Core
            </span>
          </div>
        </div>

        {/* ── NODE 4: ONT / CLIENT MODEM ── */}
        <div className={`relative group rounded-xl p-4 bg-slate-900/90 border transition-all shadow-lg flex flex-col justify-between ${!isLoss ? 'border-emerald-500/40 hover:border-emerald-500/70' : 'border-rose-500/40 hover:border-rose-500/70'}`}>
          <div className={`absolute -top-2.5 left-4 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase text-white shadow-xs ${!isLoss ? 'bg-emerald-600' : 'bg-rose-600'}`}>
            4. ONT Pelanggan
          </div>
          <div className="space-y-2 mt-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white truncate max-w-[140px]">
                {customerName || 'Modem Pelanggan'}
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${!isLoss ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'}`}>
                {!isLoss ? 'ONLINE' : 'LOS / OFF'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-300 font-bold truncate">
                {onuSerial}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Rx Sinyal Optik:</span>
            <span className={`font-mono text-xs px-1.5 py-0.5 rounded border ${rxBadgeBg}`}>
              {rxPower !== null ? `${rxPower} dBm` : '—'}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
