import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

const getStatusBadge = (status) => {
  switch (status) {
    case 'Open':
      return <span className="px-3 py-1 bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold rounded-xl flex items-center gap-1.5 w-fit"><span>🟡</span> Belum Diproses (Open)</span>;
    case 'In Progress':
      return <span className="px-3 py-1 bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold rounded-xl flex items-center gap-1.5 w-fit"><span>🔵</span> Sedang Dikerjakan (In Progress)</span>;
    case 'Resolved':
      return <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold rounded-xl flex items-center gap-1.5 w-fit"><span>🟢</span> Selesai Diperbaiki (Resolved)</span>;
    case 'Closed':
      return <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 w-fit"><span>⚪</span> Ditutup (Closed)</span>;
    default:
      return <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl">{status}</span>;
  }
};

const getCategoryBadge = (cat) => {
  switch (cat) {
    case 'Gangguan ODP':
      return <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60 text-xs font-bold rounded-lg">🟡 Gangguan ODP</span>;
    case 'Pemasangan ODP Baru':
      return <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60 text-xs font-bold rounded-lg">📦 Pemasangan ODP Baru</span>;
    case 'Gangguan INTERFACE':
      return <span className="px-2.5 py-1 bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/60 text-xs font-bold rounded-lg">⚡ Gangguan INTERFACE</span>;
    case 'Gangguan BTS / CORPORATE':
      return <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/60 text-xs font-bold rounded-lg">🏢 BTS / CORPORATE</span>;
    case 'Fiber Cut':
      return <span className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 text-xs font-bold rounded-lg">🔴 Fiber Cut (Putus)</span>;
    default:
      return <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-lg">{cat}</span>;
  }
};

export default function PublicTicketTracking() {
  const { ticketNumber: urlTicketNumber } = useParams();
  const navigate = useNavigate();

  const [inputNumber, setInputNumber] = useState(urlTicketNumber || '');
  const [ticketData, setTicketData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState(null);

  const fetchTicket = async (num) => {
    if (!num || !num.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/tickets/${encodeURIComponent(num.trim())}`);
      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setTicketData(json.data);
      } else {
        setTicketData(null);
        setError(json.message || 'Tiket tidak ditemukan. Periksa kembali nomor tiket Anda.');
      }
    } catch (err) {
      console.error(err);
      setError('Terjadi kendala saat memeriksa data tiket. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (urlTicketNumber) {
      setInputNumber(urlTicketNumber);
      fetchTicket(urlTicketNumber);
    }
  }, [urlTicketNumber]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!inputNumber.trim()) return;
    navigate(`/track-ticket/${encodeURIComponent(inputNumber.trim())}`);
    fetchTicket(inputNumber);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between font-sans">
      {/* Top Navbar */}
      <header className="bg-white dark:bg-black border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md shadow-indigo-600/30">
            F
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white leading-none">
              Fiber-UNMS Enterprise
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Portal Pelacakan Progres Tiket Jointer
            </p>
          </div>
        </div>

        <Link
          to="/login"
          className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all"
        >
          Masuk / Login Sistem →
        </Link>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex-1 space-y-6">
        
        {/* Search Header Banner */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-4">
          <div className="max-w-xl mx-auto space-y-1">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Lacak Progres Tiket Gangguan
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pantau status penanganan, teknisi yang bertugas, dan bukti foto pengerjaan di lapangan secara realtime.
            </p>
          </div>

          <form onSubmit={handleSearch} className="max-w-md mx-auto flex gap-2">
            <input
              type="text"
              required
              value={inputNumber}
              onChange={(e) => setInputNumber(e.target.value)}
              placeholder="Masukkan nomor tiket (misal: TICK-2026-0001)"
              className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-mono text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 transition-all disabled:opacity-60 flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <span>🔍 Lacak</span>
              )}
            </button>
          </form>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-2xl p-5 text-center text-xs text-red-700 dark:text-red-300 space-y-1 animate-in fade-in">
            <span className="text-xl">⚠️</span>
            <p className="font-bold">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400 text-xs animate-pulse">
            <span>⚡</span> Memeriksa data tiket &amp; riwayat progres tim teknis...
          </div>
        )}

        {/* Result Card */}
        {ticketData && !loading && (
          <div className="space-y-6 animate-in fade-in duration-200">
            
            {/* Overview Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400">
                      {ticketData.ticket_number}
                    </span>
                    {getCategoryBadge(ticketData.category)}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                    {ticketData.title}
                  </h3>
                </div>
                <div>{getStatusBadge(ticketData.status)}</div>
              </div>

              {/* Grid Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Teknisi Bertugas</span>
                  <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                    👷 {ticketData.technician_name}
                  </p>
                  <p className="text-[10px] text-slate-500">{ticketData.dispatch_team}</p>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Titik Lokasi / ODP</span>
                  <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                    📍 {ticketData.location?.name || 'Infrastruktur Jaringan'}
                  </p>
                  <p className="text-[10px] text-slate-500">{ticketData.location?.address || '—'}</p>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Waktu Diterbitkan</span>
                  <p className="font-bold text-slate-800 dark:text-slate-100 text-sm font-mono">
                    🕒 {ticketData.created_at}
                  </p>
                  <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">{ticketData.created_human}</p>
                </div>
              </div>

              {ticketData.description && (
                <div className="p-3.5 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 text-xs">
                  <span className="font-bold text-indigo-900 dark:text-indigo-200 block mb-0.5">Instruksi / Catatan Awal:</span>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{ticketData.description}</p>
                </div>
              )}
            </div>

            {/* Timeline Progress & Photos */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <span>🕒</span> Kronologi Tindakan &amp; Bukti Pengerjaan Lapangan
              </h4>

              {(!ticketData.timeline_logs || ticketData.timeline_logs.length === 0) ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Belum ada laporan tindakan dari tim teknisi.
                </div>
              ) : (
                <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                  {ticketData.timeline_logs.map((log, idx) => (
                    <div key={idx} className="relative space-y-2">
                      {/* Timeline Dot */}
                      <div className="absolute -left-6 top-1.5 w-4 h-4 rounded-full bg-indigo-600 border-4 border-white dark:border-slate-900 shadow-xs" />

                      <div className="bg-slate-50 dark:bg-slate-800/70 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                              👤 {log.user || 'Tim Lapangan'}
                            </span>
                            <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded text-[10px] font-bold">
                              {log.role || 'Teknisi'}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            🕒 {log.time}
                          </span>
                        </div>

                        {/* Action Title */}
                        <p className="font-semibold text-slate-800 dark:text-slate-200">
                          {log.action}
                        </p>

                        {/* Comment Note */}
                        {log.comment && (
                          <p className="text-slate-600 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-900/90 p-2.5 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                            "{log.comment}"
                          </p>
                        )}

                        {/* Evidence Photo */}
                        {log.photo_url && (
                          <div className="pt-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                              📸 Bukti Foto Lapangan:
                            </span>
                            <img
                              src={log.photo_url}
                              alt="Bukti Pengerjaan"
                              onClick={() => setPreviewPhoto(log.photo_url)}
                              className="max-h-52 rounded-xl border border-slate-200 dark:border-slate-700 object-cover cursor-pointer hover:opacity-90 transition-opacity shadow-xs"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </main>

      {/* Image Preview Lightbox */}
      {previewPhoto && (
        <div
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-[999999] bg-black/90 backdrop-blur-md p-4 flex items-center justify-center cursor-pointer animate-in fade-in"
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <img
              src={previewPhoto}
              alt="Preview Penuh"
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
            />
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute top-3 right-3 bg-black/60 hover:bg-black text-white px-3 py-1.5 rounded-xl text-xs font-bold"
            >
              ✕ Tutup
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white dark:bg-black border-t border-slate-200 dark:border-slate-800 px-4 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
        © {new Date().getFullYear()} Fiber-UNMS Enterprise · Sistem Manajemen Infrastruktur Serat Optik
      </footer>
    </div>
  );
}
