with open('resources/js/pages/NetworkInfrastructure.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace ODP list item details section
old_card_details = '''                  <div className="mt-3 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Kapasitas:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">1:{odp.total_ports} Port</span>
                    </div>
                    {odp.parent_node && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Upstream ODC:</span>
                        <span className="font-medium text-indigo-600 dark:text-indigo-400 truncate max-w-[150px]">{odp.parent_node?.name || '—'}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-400">Lokasi:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-200 truncate max-w-[180px]">{odp.address || '—'}</span>
                    </div>
                  </div>'''

new_card_details = '''                  <div className="mt-3 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">OLT Terhubung:</span>
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400 truncate max-w-[160px]">
                        {odp.olt_device?.name || odp.parent_node?.olt_device?.name || 'Auto-Detect OLT'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Interface OLT:</span>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400 truncate max-w-[160px]">
                        {displayInterface(odp.olt_port_ref)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Splitter &amp; Kapasitas:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {odp.splitter_count || 1}x ({odp.splitter_config || odp.splitter_type?.ratio || '1:8'}) · {odp.total_ports} Port
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Tube &amp; Core:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {odp.tube_info || '—'} / Core {odp.core_color || '—'}
                      </span>
                    </div>
                    {odp.parent_node && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Upstream ODC:</span>
                        <span className="font-medium text-slate-600 dark:text-slate-300 truncate max-w-[160px]">{odp.parent_node?.name || '—'}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-400">Lokasi:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-200 truncate max-w-[180px]">{odp.address || '—'}</span>
                    </div>
                  </div>'''

content = content.replace(old_card_details, new_card_details)

# 2. Replace modal header summary grid
old_modal_grid = '''              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
              </div>'''

new_modal_grid = '''              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {/* 1. OLT & Interface */}
                <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl p-3.5 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">🖥 OLT Terhubung</span>
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
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">🔀 Splitter &amp; Kapasitas</span>
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
                <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-2xl p-3.5 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">🧵 Fiber Tube &amp; Core</span>
                    <p className="text-xs font-bold text-purple-950 dark:text-purple-100 truncate mt-0.5">
                      {odpDetailData?.node?.tube_info || selectedOdp.tube_info || 'Tube 1'}
                    </p>
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-purple-200/60 dark:border-purple-800/60 flex items-center justify-between">
                    <span className="text-[10px] text-purple-500">Warna Core:</span>
                    <span className="text-xs font-bold text-purple-800 dark:text-purple-200 font-mono">
                      Core {odpDetailData?.node?.core_color || selectedOdp.core_color || '—'}
                    </span>
                  </div>
                </div>

                {/* 4. Sinyal & Status Pelanggan */}
                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-3.5 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">📡 Redaman &amp; Terisi</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-sm font-extrabold text-emerald-900 dark:text-emerald-200 font-mono">
                        {odpDetailData?.attenuation?.avg_rx_power != null
                          ? `${odpDetailData.attenuation.avg_rx_power} dBm`
                          : '—'}
                      </span>
                      {odpDetailData?.attenuation?.signal_status === 'good' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-300">🟢 Normal</span>}
                      {odpDetailData?.attenuation?.signal_status === 'warning' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-bold border border-amber-300">🟡 Tinggi</span>}
                      {odpDetailData?.attenuation?.signal_status === 'critical' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 font-bold border border-red-300">🔴 Kritis</span>}
                    </div>
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-between">
                    <span className="text-[10px] text-emerald-600">Pelanggan:</span>
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-200 font-mono">
                      {odpDetailData?.attenuation?.connected_count ?? selectedOdp.used_ports} / {selectedOdp.total_ports} Port
                    </span>
                  </div>
                </div>
              </div>'''

content = content.replace(old_modal_grid, new_modal_grid)

with open('resources/js/pages/NetworkInfrastructure.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated ODP UI successfully!')
