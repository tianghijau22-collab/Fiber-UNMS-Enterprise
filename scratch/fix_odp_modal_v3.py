with open('resources/js/pages/NetworkInfrastructure.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = -1
for i, l in enumerate(lines):
    if '{selectedOdp && (' in l:
        start_idx = i
        break

end_idx = -1
for i, l in enumerate(lines):
    if 'export default function NetworkInfrastructure' in l:
        end_idx = i
        break

print(f"start_idx: {start_idx}, end_idx: {end_idx}")

odp_modal_jsx = '''      {selectedOdp && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-4xl border border-slate-200 dark:border-slate-700 max-h-[92vh] flex flex-col overflow-hidden">

            <div className="bg-slate-900 dark:bg-slate-950 text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
              <div className="min-w-0">
                <h3 className="text-base font-bold flex items-center gap-2 truncate">
                  <span>🔌</span> Detail Port & Monitoring Sinyal — {selectedOdp.name}
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
                  🔄
                </button>
                <button
                  onClick={closeOdpDetail}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-400"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl p-3.5 flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">🖥 Interface OLT</span>
                  <p className="text-xs font-mono font-bold text-blue-900 dark:text-blue-200 truncate">
                    {odpDetailData?.display_olt_ref || displayInterface(selectedOdp.olt_port_ref)}
                  </p>
                  <span className="text-[10px] text-blue-500 dark:text-blue-400">
                    {odpDetailData ? 'Auto-terdeteksi dari pelanggan' : 'Memuat...'}
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">👥 Pelanggan</span>
                  <p className="text-base font-bold text-slate-800 dark:text-slate-100">
                    {odpDetailData?.attenuation?.connected_count ?? selectedOdp.used_ports}
                    <span className="text-xs font-normal text-slate-400 ml-1">/ {selectedOdp.total_ports} Port</span>
                  </p>
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pctColor(pct(odpDetailData?.attenuation?.connected_count ?? selectedOdp.used_ports, selectedOdp.total_ports))}`}
                      style={{ width: `${pct(odpDetailData?.attenuation?.connected_count ?? selectedOdp.used_ports, selectedOdp.total_ports)}%` }}
                    />
                  </div>
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-3.5 flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">📡 Redaman Rata-Rata</span>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-extrabold text-emerald-900 dark:text-emerald-200 font-mono">
                      {odpDetailData?.attenuation?.avg_rx_power != null
                        ? `${odpDetailData.attenuation.avg_rx_power} dBm`
                        : '—'}
                    </span>
                    {odpDetailData?.attenuation?.signal_status === 'good' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">🟢 Normal</span>}
                    {odpDetailData?.attenuation?.signal_status === 'warning' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700">🟡 Tinggi</span>}
                    {odpDetailData?.attenuation?.signal_status === 'critical' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700">🔴 Kritis</span>}
                    {odpDetailData?.attenuation?.signal_status === 'no_customer' && <span className="text-[10px] text-slate-400">Belum ada sinyal</span>}
                    {odpDetailData?.attenuation?.signal_status === 'unknown' && <span className="text-[10px] text-slate-400">Sinyal tidak diketahui</span>}
                  </div>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    {odpDetailData?.attenuation?.min_rx_power != null
                      ? `Rentang: ${odpDetailData.attenuation.min_rx_power} ~ ${odpDetailData.attenuation.max_rx_power} dBm`
                      : 'Data acuan monitoring peta'}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    📋 Detail Per-Port ({portsData.length} Port)
                  </h4>
                  {loadingPorts && (
                    <span className="text-[10px] text-indigo-500 animate-pulse">🔄 Memuat...</span>
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
                    <p className="text-2xl mb-1">📭</p>
                    <p className="text-xs">Data port tidak ditemukan. Coba refresh.</p>
                    <button onClick={handleRefreshPorts} className="mt-2 text-xs text-indigo-500 hover:underline">🔄 Coba Lagi</button>
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
                          className={`relative rounded-2xl border flex flex-col justify-between transition-all ${
                            isUsed
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
                                    <span className="text-indigo-500">👤</span> {port.customer_name || port.customer_name_cache || 'Pelanggan'}
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
                                      📡 {rxText}
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
                💡 Redaman ODP ini synced real-time dari koneksi OLT &amp; ONT pelanggan.
              </span>
              <button onClick={() => { setSelectedOdp(null); setOdpDetailData(null); }} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
'''

new_lines = lines[:start_idx] + [odp_modal_jsx + '\n'] + lines[end_idx:]

with open('resources/js/pages/NetworkInfrastructure.jsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Updated v3 successfully!")
