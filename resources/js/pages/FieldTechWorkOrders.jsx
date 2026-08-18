import React, { useState } from 'react';

export default function FieldTechWorkOrders() {
  const [activeTab, setActiveTab] = useState('active');
  const [selectedTask, setSelectedTask] = useState(null);
  const [opmValue, setOpmValue] = useState('-21.5');
  const [otdrDistance, setOtdrDistance] = useState('1250');
  const [notes, setNotes] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);

  const tasks = [
    {
      id: 'WO-2026-0891',
      title: 'Perbaikan Kabel Fiber Putus (OTDR Breakpoint)',
      location: 'Joint Closure JC-03 - Tiang 05 Jl. Kenanga',
      coordinates: '-6.2132, 106.8531',
      priority: 'CRITICAL',
      status: 'In Progress',
      type: 'Fiber Cut Repair',
      reported_at: '14:20 WIB',
      distance_meters: 1250,
      impacted_customers: 3,
    },
    {
      id: 'WO-2026-0892',
      title: 'Pemasangan Baru (PSB) ONU Home Pass',
      location: 'ODP-A01 Tiang 03 Jl. Mawar No. 8',
      coordinates: '-6.2125, 106.8520',
      priority: 'NORMAL',
      status: 'Pending Tech',
      type: 'New Install',
      reported_at: '11:00 WIB',
      distance_meters: 420,
      impacted_customers: 1,
    }
  ];

  const handleCompleteTask = (e) => {
    e.preventDefault();
    setIsCompleted(true);
    setTimeout(() => {
      setSelectedTask(null);
      setIsCompleted(false);
    }, 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto transition-colors duration-300">
      {/* Header Banner */}
      <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] p-5 rounded-lg shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-sans">
            Teknisi Lapangan (Work Orders &amp; Splicing)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manajemen penugasan lapangan jointer, checklist material perbaikan, &amp; verifikasi redaman
          </p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-800 dark:text-slate-200 font-bold text-lg self-start md:self-auto shadow-xs">
          J2
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl p-1 shadow-xs border">
        <button
          onClick={() => { setActiveTab('active'); setSelectedTask(null); }}
          className={`flex-1 py-2.5 text-center text-sm font-bold rounded-xl transition-all ${
            activeTab === 'active' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Tugas Aktif ({tasks.length})
        </button>
        <button
          onClick={() => { setActiveTab('completed'); setSelectedTask(null); }}
          className={`flex-1 py-2.5 text-center text-sm font-bold rounded-xl transition-all ${
            activeTab === 'completed' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Selesai (14)
        </button>
      </div>

      {/* Task Selection View / Detail Form */}
      {selectedTask ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <button
              onClick={() => setSelectedTask(null)}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center space-x-1"
            >
              <span>&larr; Kembali ke daftar tugas</span>
            </button>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
              {selectedTask.priority}
            </span>
          </div>

          <div>
            <div className="text-xs text-indigo-600 dark:text-indigo-400 font-mono font-bold">{selectedTask.id}</div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">{selectedTask.title}</h2>
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-2 flex items-center space-x-1.5 font-medium">
              <svg className="w-4 h-4 text-rose-600 dark:text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{selectedTask.location}</span>
            </div>
          </div>

          {/* Quick Action: Open GPS Maps */}
          <a
            href={`https://maps.google.com/?q=${selectedTask.coordinates}`}
            target="_blank"
            rel="noreferrer"
            className="w-full py-3.5 px-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 font-bold text-xs flex items-center justify-center space-x-2 transition-colors shadow-xs"
          >
            <span>Navigasi GPS ke Lokasi ({selectedTask.coordinates})</span>
          </a>

          {/* Technician Execution Checklist */}
          <form onSubmit={handleCompleteTask} className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider">Input Hasil Lapangan</h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Hasil Ukur OTDR (Jarak Aktual Metrik)</label>
              <input
                type="number"
                value={otdrDistance}
                onChange={(e) => setOtdrDistance(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-100 font-mono text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:bg-white dark:focus:bg-slate-900 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Hasil Cek OPM (Optical Power Meter dBm)</label>
              <input
                type="text"
                value={opmValue}
                onChange={(e) => setOpmValue(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-emerald-700 dark:text-emerald-400 font-mono text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:bg-white dark:focus:bg-slate-900 transition-all"
                placeholder="Contoh: -21.5"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Foto Hasil Splicing &amp; Closure (Upload Proof)</label>
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center bg-slate-50 dark:bg-slate-800 cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors">
                <svg className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h0.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Ketuk untuk mengambil/upload foto bukti penyambungan</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Catatan Pekerjaan</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Splicing core 1-4 selesai, redaman stabil..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:bg-white dark:focus:bg-slate-900 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isCompleted}
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
            >
              {isCompleted ? 'Pekerjaan Disimpan & Selesai!' : 'Konfirmasi Pekerjaan Selesai'}
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map(task => (
            <div
              key={task.id}
              onClick={() => setSelectedTask(task)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-3 hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors shadow-xs cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">{task.id}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  task.priority === 'CRITICAL' 
                    ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800' 
                    : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
                }`}>
                  {task.priority}
                </span>
              </div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">{task.title}</h3>
              <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">{task.location}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-500 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span>Dilaporkan: {task.reported_at}</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-bold">Buka Detail &rarr;</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
