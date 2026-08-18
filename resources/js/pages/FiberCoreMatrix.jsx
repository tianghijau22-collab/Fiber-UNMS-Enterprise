import React, { useState } from 'react';

const fiberColors = [
  { no: 1, name: 'Biru (Blue)', hex: '#2563eb', bg: 'bg-blue-600', text: 'text-white' },
  { no: 2, name: 'Orange', hex: '#f97316', bg: 'bg-orange-500', text: 'text-white' },
  { no: 3, name: 'Hijau (Green)', hex: '#16a34a', bg: 'bg-green-600', text: 'text-white' },
  { no: 4, name: 'Coklat (Brown)', hex: '#78350f', bg: 'bg-amber-900', text: 'text-white' },
  { no: 5, name: 'Abu-abu (Slate)', hex: '#64748b', bg: 'bg-slate-500', text: 'text-white' },
  { no: 6, name: 'Putih (White)', hex: '#f8fafc', bg: 'bg-slate-100', text: 'text-slate-800' },
  { no: 7, name: 'Merah (Red)', hex: '#dc2626', bg: 'bg-red-600', text: 'text-white' },
  { no: 8, name: 'Hitam (Black)', hex: '#09090b', bg: 'bg-slate-950', text: 'text-white' },
  { no: 9, name: 'Kuning (Yellow)', hex: '#eab308', bg: 'bg-yellow-400', text: 'text-slate-900' },
  { no: 10, name: 'Ungu (Violet)', hex: '#9333ea', bg: 'bg-purple-600', text: 'text-white' },
  { no: 11, name: 'Pink (Rose)', hex: '#ec4899', bg: 'bg-pink-500', text: 'text-white' },
  { no: 12, name: 'Toska (Aqua)', hex: '#06b6d4', bg: 'bg-cyan-500', text: 'text-white' }
];

export default function FiberCoreMatrix() {
  const [selectedTube, setSelectedTube] = useState(1);

  return (
    <div className="space-y-6 transition-colors duration-300">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-black p-5 rounded-lg border border-slate-200 dark:border-[#222222] shadow-2xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-sans">
            Visualizer Kode Warna Core &amp; Splicing Matrix
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Diagram alokasi warna core kabel optik (TIA/EIA-598 Standar FTTH) &amp; pemetaan tray jembatan penyambungan
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-semibold">
            Standard 12 Core / Tube
          </span>
        </div>
      </div>

      {/* Interactive Core Matrix Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tube Selection & Color Legend */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg border-b border-slate-100 dark:border-slate-800 pb-3">Pilih Loose Tube / Buffer</h3>
          
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map(tube => (
              <button
                key={tube}
                onClick={() => setSelectedTube(tube)}
                className={`p-3 rounded-xl border text-xs font-bold text-left transition-all ${
                  selectedTube === tube
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                Tube #{tube} (Core {(tube - 1) * 12 + 1} - {tube * 12})
              </button>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <h4 className="font-semibold text-slate-700 dark:text-slate-300 text-sm mb-3">12 Urutan Kode Warna Optik:</h4>
            <div className="space-y-1.5">
              {fiberColors.map(c => (
                <div key={c.no} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-4 h-4 rounded-full ${c.bg} border border-slate-300 dark:border-slate-600 shadow-2xs`}></span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{c.name}</span>
                  </div>
                  <span className="font-mono text-slate-400 dark:text-slate-500">Core #{c.no + (selectedTube - 1) * 12}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Visual Tray Splicing Display */}
        <div className="lg:col-span-2 bg-slate-900 dark:bg-slate-950 text-white p-6 rounded-2xl border border-slate-800 dark:border-slate-900 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 dark:border-slate-900 pb-4 mb-6">
              <div>
                <h3 className="font-bold text-lg text-white">Visualizer Tray Joint Closure - Tube #{selectedTube}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Kabel Feeder ODC-MGR-01 (24 Core Feeder Cable)</p>
              </div>
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-mono font-semibold">
                Splicer Ready
              </span>
            </div>

            {/* Core Cable Strand Visualizer */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {fiberColors.map(c => {
                const coreNum = c.no + (selectedTube - 1) * 12;
                const isOccupied = coreNum <= 10;
                return (
                  <div key={c.no} className="bg-slate-800/80 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-700 dark:border-slate-800 hover:border-indigo-500 transition-all flex flex-col justify-between h-32">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-400">#{coreNum}</span>
                      <span className={`w-3 h-3 rounded-full ${c.bg} border border-white/50 shadow-xs`}></span>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-white truncate">{c.name}</p>
                      <p className={`text-[11px] font-semibold mt-1 ${isOccupied ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {isOccupied ? '● Connected (Active)' : '○ Available (Idle)'}
                      </p>
                    </div>

                    <div className="text-[10px] font-mono text-slate-400 pt-2 border-t border-slate-700/60 dark:border-slate-800 truncate">
                      {isOccupied ? `Customer CUST-${coreNum}` : 'Unassigned'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 dark:border-slate-900 flex justify-between items-center text-xs text-slate-400">
            <span>Standar TIA/EIA-598 Optical Color Code</span>
            <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all shadow-md">
              Cetak Diagram Splicer (.PDF)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
