import React, { useState, useMemo } from 'react';

/**
 * Komponen Topologi Tree ODC & ODP
 * Gaya garis putus-putus aliran kabel fiber optik bergerak
 */
export default function FlowingOltTopology({
  oltName = 'OLT',
  selectedPortFilter = null,
  oltTopology = [],
  onClearPortFilter = null,
}) {
  const [isSectionCollapsed, setIsSectionCollapsed] = useState(false);
  const [expandedOdcs, setExpandedOdcs] = useState({});
  const [activePortTab, setActivePortTab] = useState('all');

  // Filter ODC berdasarkan selectedPortFilter atau activePortTab
  const effectiveFilter = selectedPortFilter || (activePortTab !== 'all' ? activePortTab : null);

  const portOdcs = useMemo(() => {
    return oltTopology.filter(o => {
      if (!effectiveFilter) return true;
      const oPort = o.olt_port_ref || o.auto_detected_port_ref;
      if (!oPort) return false;
      const targetClean = effectiveFilter.replace(/^gpon[-_]olt_|^epon[-_]olt_|^epon_/i, '');
      const refs = oPort.split(',').map(r => r.trim().replace(/^gpon[-_]olt_|^epon[-_]olt_|^epon_/i, ''));
      return refs.some(r => r === targetClean || r === effectiveFilter || `gpon-olt_${r}` === effectiveFilter || `epon-olt_${r}` === effectiveFilter || `epon_${r}` === effectiveFilter);
    });
  }, [oltTopology, effectiveFilter]);

  // Daftar unik port OLT dari data topologi untuk tab filter cepat
  const availablePorts = useMemo(() => {
    const portSet = new Set();
    oltTopology.forEach(o => {
      const p = o.olt_port_ref || o.auto_detected_port_ref;
      if (p) {
        p.split(',').forEach(sub => {
          const clean = sub.trim();
          if (clean) portSet.add(clean);
        });
      }
    });
    return Array.from(portSet);
  }, [oltTopology]);

  const toggleOdc = (id) => {
    setExpandedOdcs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const totalOdcs = portOdcs.length;
  const totalOdps = portOdcs.reduce((acc, o) => acc + (o.odps?.length || 0), 0);

  return (
    <div className="bg-slate-950 text-white border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5 relative overflow-hidden">
      {/* Background Ambient Optical Grid & Glow */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b14_1px,transparent_1px),linear-gradient(to_bottom,#1e293b14_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none opacity-60" />
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 bg-blue-600/10 blur-3xl pointer-events-none rounded-full" />
      
      {/* ── HEADER & COLLAPSE BUTTON ── */}
      <div className="relative z-10 flex items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-500 shadow-[0_0_12px_#3b82f6]" />
          </span>
          <h3 className="font-extrabold text-white text-lg tracking-tight">
            ODC &amp; ODP
          </h3>
        </div>

        {/* Header Right: KPI + Button Lipat/Tutup */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Quick Metrics KPI: ODC & ODP count */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-300 shadow-inner">
            <span className="text-slate-500 text-[11px]">ODC:</span>
            <span className="font-bold text-blue-400">{totalOdcs}</span>
            <span className="text-slate-700">|</span>
            <span className="text-slate-500 text-[11px]">ODP:</span>
            <span className="font-bold text-indigo-400">{totalOdps}</span>
          </div>

          {/* Button Lipat/Tutup Kontainer */}
          <button
            type="button"
            onClick={() => setIsSectionCollapsed(!isSectionCollapsed)}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <span>{isSectionCollapsed ? 'Buka' : 'Tutup'}</span>
            <span className="text-[10px]">{isSectionCollapsed ? '▼' : '▲'}</span>
          </button>
        </div>
      </div>

      {/* ── KONTEN TOPOLOGI (BISA DILIPAT) ── */}
      {!isSectionCollapsed && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* ── FILTER TABS ── */}
          {availablePorts.length > 0 && (
            <div className="relative z-10 flex items-center gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => {
                  setActivePortTab('all');
                  if (onClearPortFilter) onClearPortFilter();
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  effectiveFilter === null || activePortTab === 'all'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Semua ({oltTopology.length} ODC)
              </button>
              {availablePorts.map(p => {
                const isSelected = effectiveFilter === p || activePortTab === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setActivePortTab(p)}
                    className={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs border border-indigo-500'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── EMPTY STATE ── */}
          {portOdcs.length === 0 ? (
            <div className="relative z-10 p-10 text-center text-slate-400 text-xs bg-slate-900/50 rounded-2xl border border-dashed border-slate-800 space-y-2">
              <p className="font-bold text-slate-200 text-sm">
                Belum ada ODC/ODP yang terhubung.
              </p>
            </div>
          ) : (
            /* ══════════════════════════════════════════════════════════════════════
               TOPOLOGI TREE DENGAN GARIS PUTUS-PUTUS TEGAS SEPERTI KABEL GIS
            ══════════════════════════════════════════════════════════════════════ */
            <div className="relative z-10 overflow-x-auto pb-6 pt-2">
              <div className="min-w-[750px] flex flex-col items-center">

                {/* ── LEVEL 1: ROOT NODE (OLT) ── */}
                <div className="relative flex flex-col items-center">
                  <div className="group relative rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-blue-500/50 p-4 sm:p-5 shadow-[0_0_30px_rgba(59,130,246,0.25)] hover:border-blue-400 transition-all text-center min-w-[260px] max-w-[320px]">
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-base text-white tracking-tight truncate">
                        {oltName}
                      </h4>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-800">
                          ONLINE
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Central Optical Feeder Trunk Line (Animasi Garis Putus-Putus Hijau/Biru Mengalir) */}
                  <div className="flex flex-col items-center h-16 sm:h-20 w-full">
                    <svg className="w-12 h-full overflow-visible" viewBox="0 0 48 80">
                      <defs>
                        <linearGradient id="feederDottedGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#10b981" />
                          <stop offset="100%" stopColor="#06b6d4" />
                        </linearGradient>
                      </defs>
                      {/* Glow background line */}
                      <line x1="24" y1="0" x2="24" y2="80" stroke="#10b981" strokeWidth="4" strokeOpacity="0.15" strokeLinecap="round" />
                      {/* Flowing crisp dashed line */}
                      <line
                        x1="24"
                        y1="0"
                        x2="24"
                        y2="80"
                        stroke="url(#feederDottedGrad)"
                        strokeWidth="3.5"
                        strokeDasharray="10 6"
                        strokeLinecap="round"
                        className="animate-flow-laser"
                      />
                      <circle cx="24" cy="40" r="3.5" fill="#10b981" className="animate-ping opacity-75" />
                    </svg>
                  </div>
                </div>

                {/* ── LEVEL 2: ODC NODES (FEEDER SPLITTERS) ── */}
                <div className="w-full">
                  {/* ODC Cards Grid / Tree Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full items-start">
                    {portOdcs.map((odc) => {
                      const isOdcExpanded = expandedOdcs[odc.id] !== false;
                      const childOdps = odc.odps || [];

                      return (
                        <div key={odc.id} className="flex flex-col items-center space-y-3">
                          
                          {/* ODC Node Card */}
                          <div className="relative group rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-indigo-500/40 hover:border-indigo-400 p-4 sm:p-5 shadow-xl transition-all w-full max-w-[340px]">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h5 className="font-extrabold text-base text-white group-hover:text-indigo-300 transition-colors truncate">
                                  {odc.name}
                                </h5>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-800">
                                  ONLINE
                                </span>
                              </div>

                              {odc.parent_node && (
                                <p className="text-[11px] text-slate-400 truncate">
                                  POP Induk: <strong className="text-slate-200">{odc.parent_node.name}</strong>
                                </p>
                              )}
                            </div>

                            <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                              <span>Splitter: <strong className="text-indigo-300 font-semibold">{odc.splitter || 'PLC 1:4'}</strong></span>
                              <button
                                type="button"
                                onClick={() => toggleOdc(odc.id)}
                                className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                              >
                                {isOdcExpanded ? `Tutup (${childOdps.length} ODP) ▲` : `Buka (${childOdps.length} ODP) ▼`}
                              </button>
                            </div>
                          </div>

                          {/* ── LEVEL 3: ODP DISTRIBUTION BOXES (DENGAN GARIS PUTUS-PUTUS MENGALIR) ── */}
                          {isOdcExpanded && childOdps.length > 0 && (
                            <div className="w-full flex flex-col items-center">
                              {/* Laser Branching Line to ODPs (Garis Putus-Putus Mengalir Hijau/Biru) */}
                              <div className="h-8 flex flex-col items-center">
                                <svg className="w-8 h-full overflow-visible" viewBox="0 0 32 32">
                                  <defs>
                                    <linearGradient id={`distDotted_${odc.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                      <stop offset="0%" stopColor="#10b981" />
                                      <stop offset="100%" stopColor="#3b82f6" />
                                    </linearGradient>
                                  </defs>
                                  <line x1="16" y1="0" x2="16" y2="32" stroke="#10b981" strokeWidth="3.5" strokeOpacity="0.15" strokeLinecap="round" />
                                  <line
                                    x1="16"
                                    y1="0"
                                    x2="16"
                                    y2="32"
                                    stroke={`url(#distDotted_${odc.id})`}
                                    strokeWidth="3"
                                    strokeDasharray="8 5"
                                    strokeLinecap="round"
                                    className="animate-flow-laser-fast"
                                  />
                                </svg>
                              </div>

                              {/* ODP Children Cards */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                                {childOdps.map((odp) => {
                                  const isOdpOnline = odp.status === 'ONLINE';
                                  const hasCust = odp.has_customers;

                                  return (
                                    <div
                                      key={odp.id}
                                      className={`group relative rounded-xl p-3.5 bg-slate-900/90 border transition-all shadow-md flex flex-col justify-between space-y-2 ${
                                        isOdpOnline
                                          ? 'border-emerald-500/30 hover:border-emerald-500/60'
                                          : 'border-rose-500/30 hover:border-rose-500/60'
                                      }`}
                                    >
                                      {/* ODP Header & Dynamic Status */}
                                      <div className="flex items-start justify-between gap-1.5">
                                        <div>
                                          <div className="flex items-center gap-1.5">
                                            <span className={`h-2 w-2 rounded-full ${isOdpOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                                            <span className="font-bold text-xs text-white group-hover:text-purple-300 transition-colors truncate max-w-[120px]">
                                              {odp.name}
                                            </span>
                                          </div>
                                          <span className="text-[10px] text-slate-400 block mt-0.5">
                                            Splitter {odp.splitter || '1:8'}
                                          </span>
                                        </div>

                                        {/* Status Badge ONLINE / OFFLINE */}
                                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md border ${
                                          isOdpOnline
                                            ? 'bg-emerald-950/90 text-emerald-400 border-emerald-800'
                                            : 'bg-rose-950/90 text-rose-400 border-rose-800'
                                        }`}>
                                          {isOdpOnline ? 'ONLINE' : 'OFFLINE'}
                                        </span>
                                      </div>

                                      {/* Dynamic Customer & Optical Details */}
                                      <div className="pt-1.5 border-t border-slate-800">
                                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                                          <span>
                                            {hasCust
                                              ? `${odp.online_customer_count}/${odp.customer_count} Online`
                                              : 'Belum Ada Pelanggan'}
                                          </span>
                                          {odp.avg_rx_power !== null && (
                                            <span className="font-bold text-emerald-400">
                                              {odp.avg_rx_power} dBm
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
