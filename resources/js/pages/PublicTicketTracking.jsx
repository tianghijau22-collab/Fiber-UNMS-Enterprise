import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

/* ── Clean SVG Icons (No Emojis) ── */
const IconSearch = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const IconCopy = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const IconCheck = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const IconRefresh = ({ spinning }) => (
  <svg className={`w-3.5 h-3.5 ${spinning ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const IconMapPin = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const IconUser = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const IconClock = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconPrint = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
  </svg>
);

const IconExternal = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

const IconImage = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

/* ── Badges & Status Formatters (Black/White Friendly) ── */
const getStatusBadge = (status) => {
  switch (status) {
    case 'Open':
      return (
        <span className="px-3 py-1 bg-slate-100 dark:bg-neutral-900 text-black dark:text-white border border-slate-300 dark:border-neutral-700 text-xs font-bold rounded-xl inline-flex items-center gap-2 w-fit">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span>Belum Diproses (Open)</span>
        </span>
      );
    case 'In Progress':
      return (
        <span className="px-3 py-1 bg-slate-100 dark:bg-neutral-900 text-black dark:text-white border border-slate-300 dark:border-neutral-700 text-xs font-bold rounded-xl inline-flex items-center gap-2 w-fit">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span>Sedang Dikerjakan (In Progress)</span>
        </span>
      );
    case 'Resolved':
      return (
        <span className="px-3 py-1 bg-slate-100 dark:bg-neutral-900 text-black dark:text-white border border-slate-300 dark:border-neutral-700 text-xs font-bold rounded-xl inline-flex items-center gap-2 w-fit">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Selesai Diperbaiki (Resolved)</span>
        </span>
      );
    case 'Closed':
      return (
        <span className="px-3 py-1 bg-slate-100 dark:bg-neutral-900 text-black dark:text-white border border-slate-300 dark:border-neutral-700 text-xs font-bold rounded-xl inline-flex items-center gap-2 w-fit">
          <span className="w-2 h-2 rounded-full bg-neutral-400" />
          <span>Ditutup (Closed)</span>
        </span>
      );
    default:
      return <span className="px-3 py-1 bg-slate-100 dark:bg-neutral-900 text-black dark:text-white border border-slate-300 dark:border-neutral-700 text-xs font-bold rounded-xl">{status}</span>;
  }
};

const getCategoryBadge = (cat) => {
  return (
    <span className="px-2.5 py-1 bg-slate-100 dark:bg-neutral-900 text-black dark:text-white border border-slate-300 dark:border-neutral-700 text-xs font-bold rounded-lg">
      {cat}
    </span>
  );
};

/* ── Solid Stepper Pipeline ── */
const StatusStepper = ({ status, hasTechnician }) => {
  const steps = [
    { key: 'created', label: 'Tiket Diterbitkan', desc: 'Laporan tercatat di sistem' },
    { key: 'assigned', label: 'Penugasan Tim', desc: hasTechnician ? 'Jointer ditugaskan' : 'Menunggu penugasan' },
    { key: 'progress', label: 'Pengerjaan Lapangan', desc: 'Tindakan fisik di lokasi' },
    { key: 'done', label: 'Penyelesaian', desc: status === 'Closed' ? 'Tiket diverifikasi & ditutup' : 'Perbaikan tuntas' },
  ];

  let currentStep = 1;
  if (status === 'Closed') currentStep = 4;
  else if (status === 'Resolved') currentStep = 4;
  else if (status === 'In Progress') currentStep = 3;
  else if (hasTechnician) currentStep = 2;
  else currentStep = 1;

  return (
    <div className="bg-white dark:bg-black rounded-2xl border border-slate-200 dark:border-neutral-800 p-4 sm:p-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative">
        {steps.map((s, idx) => {
          const stepNum = idx + 1;
          const isDone = stepNum < currentStep || (stepNum === 4 && (status === 'Resolved' || status === 'Closed'));
          const isActive = stepNum === currentStep && !(stepNum === 4 && (status === 'Resolved' || status === 'Closed'));

          let nodeBg = 'bg-slate-100 dark:bg-neutral-900 text-black dark:text-white border border-slate-300 dark:border-neutral-700';
          if (isDone) {
            nodeBg = 'bg-black text-white dark:bg-white dark:text-black border border-black dark:border-white font-bold';
          } else if (isActive) {
            nodeBg = 'bg-black text-white dark:bg-white dark:text-black border border-black dark:border-white font-black ring-2 ring-slate-400 dark:ring-neutral-600';
          }

          return (
            <div key={s.key} className="flex flex-col items-start">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${nodeBg}`}>
                  {isDone ? <IconCheck /> : stepNum}
                </div>
                <span className={`text-xs font-bold ${isActive ? 'text-black dark:text-white' : isDone ? 'text-black dark:text-white' : 'text-neutral-500 dark:text-neutral-400'}`}>
                  {s.label}
                </span>
              </div>
              <p className="text-[11px] text-neutral-600 dark:text-neutral-300 pl-8 leading-tight">
                {s.desc}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function PublicTicketTracking() {
  const { ticketNumber: urlTicketNumber } = useParams();
  const navigate = useNavigate();

  const [inputNumber, setInputNumber] = useState(urlTicketNumber || '');
  const [ticketData, setTicketData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [recentSearches, setRecentSearches] = useState([]);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('unms_recent_ticket_searches');
      if (saved) {
        setRecentSearches(JSON.parse(saved));
      }
    } catch (e) {
      // Ignore
    }
  }, []);

  const saveRecentSearch = (num) => {
    if (!num) return;
    try {
      const clean = num.trim().toUpperCase();
      const updated = [clean, ...recentSearches.filter(item => item !== clean)].slice(0, 5);
      setRecentSearches(updated);
      localStorage.setItem('unms_recent_ticket_searches', JSON.stringify(updated));
    } catch (e) {
      // Ignore
    }
  };

  const fetchTicket = useCallback(async (num) => {
    if (!num || !num.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/tickets/${encodeURIComponent(num.trim())}`);
      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setTicketData(json.data);
        saveRecentSearch(num);
      } else {
        setTicketData(null);
        setError(json.message || 'Tiket tidak ditemukan. Periksa kembali nomor tiket Anda.');
      }
    } catch (err) {
      console.error(err);
      setError('Terjadi kendala saat memeriksa data tiket. Pastikan server aktif dan coba lagi.');
    } finally {
      setLoading(false);
    }
  }, [recentSearches]);

  useEffect(() => {
    if (urlTicketNumber) {
      setInputNumber(urlTicketNumber);
      fetchTicket(urlTicketNumber);
    }
  }, [urlTicketNumber]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!inputNumber.trim()) return;
    const cleanNum = inputNumber.trim();
    navigate(`/track-ticket/${encodeURIComponent(cleanNum)}`);
    fetchTicket(cleanNum);
  };

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCopyNumber = (num) => {
    navigator.clipboard.writeText(num);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white flex flex-col justify-between font-sans selection:bg-neutral-800 selection:text-white">
      
      {/* Top Navbar - Clean (Only Button Masuk ke Sistem) */}
      <header className="bg-white dark:bg-black border-b border-slate-200 dark:border-neutral-800 px-4 sm:px-8 py-3.5 flex items-center justify-end sticky top-0 z-50">
        <Link
          to="/login"
          className="px-4 py-2 rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-slate-100 dark:hover:bg-neutral-800 text-xs font-bold text-black dark:text-white transition-all flex items-center gap-2"
        >
          <span>Masuk ke Sistem</span>
          <IconExternal />
        </Link>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex-1 space-y-6">
        
        {/* Search Card - Solid Colors */}
        <div className="bg-white dark:bg-black p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-neutral-800 text-center space-y-5">
          <div className="max-w-xl mx-auto space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-black text-black dark:text-white tracking-tight">
              Lacak Status Tiket &amp; Progres Penanganan
            </h2>
            <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
              Pantau status penanganan, teknisi yang bertugas, dan bukti foto pengerjaan di lapangan secara realtime.
            </p>
          </div>

          <form onSubmit={handleSearch} className="max-w-lg mx-auto flex gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500 dark:text-neutral-400">
                <IconSearch />
              </div>
              <input
                type="text"
                required
                value={inputNumber}
                onChange={(e) => setInputNumber(e.target.value)}
                placeholder="Masukkan nomor tiket (misal: TICK-2026-0001)"
                className="w-full pl-10 pr-9 py-2.5 bg-slate-50 dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 rounded-xl text-xs sm:text-sm font-mono text-black dark:text-white placeholder-neutral-500 dark:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white font-bold transition-all"
              />
              {inputNumber && (
                <button
                  type="button"
                  onClick={() => setInputNumber('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-black dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-black text-xs font-bold rounded-xl transition-all disabled:opacity-60 flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-slate-400 border-t-white dark:border-t-black rounded-full animate-spin" />
              ) : (
                <span>Lacak</span>
              )}
            </button>
          </form>

          {/* Recent Searches Pills */}
          {recentSearches.length > 0 && (
            <div className="max-w-lg mx-auto flex items-center gap-1.5 flex-wrap justify-center text-[11px] text-neutral-600 dark:text-neutral-300">
              <span>Pencarian Terakhir:</span>
              {recentSearches.map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    setInputNumber(num);
                    navigate(`/track-ticket/${encodeURIComponent(num)}`);
                    fetchTicket(num);
                  }}
                  className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-neutral-900 hover:bg-slate-200 dark:hover:bg-neutral-800 font-mono font-bold text-black dark:text-white border border-slate-300 dark:border-neutral-700 transition-all cursor-pointer"
                >
                  {num}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-white dark:bg-black border border-red-400 dark:border-red-800 rounded-2xl p-5 text-center text-xs text-red-600 dark:text-red-400 space-y-1 animate-in fade-in">
            <p className="font-bold">{error}</p>
            <p className="text-[11px] text-neutral-600 dark:text-neutral-300">
              Pastikan format nomor tiket sesuai (misal: TICK-2026-0001) atau periksa kembali database Anda.
            </p>
          </div>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="bg-white dark:bg-black rounded-3xl border border-slate-200 dark:border-neutral-800 p-12 text-center text-black dark:text-white text-xs animate-pulse space-y-2">
            <div className="w-8 h-8 border-2 border-slate-300 dark:border-neutral-700 border-t-black dark:border-t-white rounded-full animate-spin mx-auto" />
            <p className="font-bold text-black dark:text-white">Memeriksa status tiket...</p>
          </div>
        )}

        {/* Result Container */}
        {ticketData && !loading && (
          <div className="space-y-6 animate-in fade-in duration-200">
            
            {/* Stepper Pipeline */}
            <StatusStepper
              status={ticketData.status}
              hasTechnician={!!ticketData.technician_name && ticketData.technician_name !== 'Belum Ditugaskan'}
            />

            {/* Overview Detail Card */}
            <div className="bg-white dark:bg-black rounded-3xl border border-slate-200 dark:border-neutral-800 p-6 sm:p-7 space-y-6">
              
              {/* Header Title & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-200 dark:border-neutral-800">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      onClick={() => handleCopyNumber(ticketData.ticket_number)}
                      title="Klik untuk menyalin nomor tiket"
                      className="font-mono text-sm font-bold text-black dark:text-white bg-slate-100 dark:bg-neutral-900 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-neutral-700 inline-flex items-center gap-1.5 cursor-pointer hover:bg-slate-200 dark:hover:bg-neutral-800 transition-all"
                    >
                      <span>#{ticketData.ticket_number}</span>
                      <IconCopy />
                    </span>
                    {getCategoryBadge(ticketData.category)}
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-black dark:text-white leading-tight">
                    {ticketData.title}
                  </h3>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {getStatusBadge(ticketData.status)}
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-slate-100 dark:hover:bg-neutral-800 font-bold text-black dark:text-white transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {copied ? <IconCheck /> : <IconCopy />}
                    <span>{copied ? 'Tautan Tersalin' : 'Salin Tautan'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fetchTicket(ticketData.ticket_number)}
                    className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-slate-100 dark:hover:bg-neutral-800 font-bold text-black dark:text-white transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <IconRefresh spinning={loading} />
                    <span>Perbarui Status</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-slate-100 dark:hover:bg-neutral-800 font-bold text-black dark:text-white transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <IconPrint />
                  <span>Cetak Ringkasan</span>
                </button>
              </div>

              {/* Grid 3-Columns Spec */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                
                {/* Teknisi */}
                <div className="p-4 bg-slate-50 dark:bg-neutral-950 rounded-2xl border border-slate-200 dark:border-neutral-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-neutral-600 dark:text-neutral-400 font-bold uppercase tracking-wider">
                    <IconUser />
                    <span>Tim Teknis Bertugas</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {ticketData.technician_name ? (
                      ticketData.technician_name.split(',').map((name, idx) => (
                        <span key={idx} className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white dark:bg-neutral-900 text-black dark:text-white font-bold text-xs border border-slate-300 dark:border-neutral-700">
                          {name.trim()}
                        </span>
                      ))
                    ) : (
                      <span className="text-black dark:text-white text-xs italic font-semibold">Dalam Antrean Penugasan</span>
                    )}
                  </div>
                </div>

                {/* Titik Lokasi / Node */}
                <div className="p-4 bg-slate-50 dark:bg-neutral-950 rounded-2xl border border-slate-200 dark:border-neutral-800 space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-neutral-600 dark:text-neutral-400 font-bold uppercase tracking-wider">
                    <IconMapPin />
                    <span>Titik Lokasi / Node</span>
                  </div>
                  <p className="font-bold text-black dark:text-white text-sm">
                    {ticketData.location?.name || 'Infrastruktur Jaringan'}
                  </p>
                  <p className="text-[11px] text-neutral-600 dark:text-neutral-300 line-clamp-1">
                    {ticketData.location?.address || '—'}
                  </p>
                  {ticketData.location?.latitude && ticketData.location?.longitude && (
                    <a
                      href={`https://maps.google.com/?q=${ticketData.location.latitude},${ticketData.location.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-black dark:text-white underline pt-0.5"
                    >
                      <span>Buka di Google Maps</span>
                      <IconExternal />
                    </a>
                  )}
                </div>

                {/* Waktu & SLA */}
                <div className="p-4 bg-slate-50 dark:bg-neutral-950 rounded-2xl border border-slate-200 dark:border-neutral-800 space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-neutral-600 dark:text-neutral-400 font-bold uppercase tracking-wider">
                    <IconClock />
                    <span>Waktu Diterbitkan</span>
                  </div>
                  <p className="font-bold text-black dark:text-white text-sm font-mono">
                    {ticketData.created_at}
                  </p>
                  <p className="text-[11px] text-neutral-600 dark:text-neutral-300 font-bold">
                    {ticketData.created_human}
                  </p>
                </div>

              </div>

              {/* Kendala Callout */}
              {ticketData.description && (
                <div className="p-4 bg-slate-50 dark:bg-neutral-950 rounded-2xl border border-slate-200 dark:border-neutral-800 text-xs space-y-1">
                  <span className="font-bold text-black dark:text-white block uppercase text-[10px] tracking-wider">
                    Kendala atau Permasalahan Awal:
                  </span>
                  <p className="text-neutral-800 dark:text-neutral-200 leading-relaxed font-medium">
                    {ticketData.description}
                  </p>
                </div>
              )}
            </div>

            {/* Timeline Progress & Photos */}
            <div className="bg-white dark:bg-black rounded-3xl border border-slate-200 dark:border-neutral-800 p-6 sm:p-7 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-neutral-800 pb-4">
                <h4 className="text-sm font-bold text-black dark:text-white uppercase tracking-wider">
                  Kronologi Tindakan &amp; Bukti Pengerjaan Lapangan
                </h4>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-neutral-900 text-black dark:text-white text-xs font-bold font-mono border border-slate-300 dark:border-neutral-700">
                  {ticketData.timeline_logs?.length || 0} Laporan
                </span>
              </div>

              {(!ticketData.timeline_logs || ticketData.timeline_logs.length === 0) ? (
                <div className="text-center py-10 text-neutral-600 dark:text-neutral-400 text-xs border border-dashed border-slate-200 dark:border-neutral-800 rounded-2xl">
                  Belum ada laporan tindakan dari tim teknisi.
                </div>
              ) : (
                <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-neutral-800">
                  {ticketData.timeline_logs.map((log, idx) => (
                    <div key={idx} className="relative space-y-2">
                      {/* Timeline Dot */}
                      <div className="absolute -left-6 top-1.5 w-4 h-4 rounded-full bg-black dark:bg-white border-4 border-white dark:border-black" />

                      <div className="bg-slate-50 dark:bg-neutral-950 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-neutral-800 space-y-2.5 text-xs">
                        
                        {/* Log Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200 dark:border-neutral-800 pb-2">
                          <span className="font-bold text-black dark:text-white text-xs">
                            {log.user || 'Tim Lapangan'}
                          </span>
                          <span className="font-mono text-[11px] text-neutral-600 dark:text-neutral-300">
                            {log.time}
                          </span>
                        </div>

                        {/* Action Title */}
                        <p className="font-bold text-black dark:text-white text-xs">
                          {log.action}
                        </p>

                        {/* Comment */}
                        {log.comment && (
                          <div className="p-3.5 bg-white dark:bg-black rounded-xl border border-slate-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 leading-relaxed text-xs">
                            "{log.comment}"
                          </div>
                        )}

                        {/* Photo Attachment */}
                        {log.photo_url && (
                          <div className="pt-2">
                            <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1 mb-2">
                              <IconImage />
                              <span>Lampiran Foto Bukti Lapangan:</span>
                            </span>
                            <div className="inline-block relative group">
                              <img
                                src={log.photo_url}
                                alt="Bukti Pengerjaan"
                                onClick={() => setPreviewPhoto(log.photo_url)}
                                className="max-h-60 rounded-2xl border border-slate-300 dark:border-neutral-800 object-cover cursor-pointer hover:opacity-90 transition-all"
                              />
                            </div>
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

      {/* Photo Fullscreen Lightbox */}
      {previewPhoto && (
        <div
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-[999999] bg-black/95 p-4 flex items-center justify-center cursor-pointer animate-in fade-in"
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={previewPhoto}
              alt="Foto Pengerjaan"
              className="max-h-[85vh] max-w-full rounded-2xl object-contain"
            />
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute top-4 right-4 bg-white dark:bg-neutral-800 text-black dark:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border border-neutral-700"
            >
              ✕ Tutup
            </button>
          </div>
        </div>
      )}

      {/* Clean Footer */}
      <footer className="bg-white dark:bg-black border-t border-slate-200 dark:border-neutral-800 py-6 px-4 text-center text-xs text-black dark:text-white font-medium">
        <p>© 2026 Fiber-UNMS Enterprise — Sistem Manajemen Jaringan Fiber Optik &amp; Tiket Lapangan</p>
      </footer>
    </div>
  );
}
