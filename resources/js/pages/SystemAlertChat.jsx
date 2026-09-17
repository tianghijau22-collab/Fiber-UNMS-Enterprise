import React, { useState, useEffect, useRef, useMemo } from 'react';

// ─── Inline SVG Icons ──────────────────────────────────────────────────────────
const IconBot = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const IconTelegram = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.56 8.16l-2.02 9.52c-.15.68-.55.85-1.12.53l-3.08-2.27-1.49 1.43c-.16.16-.3.3-.61.3l.22-3.14 5.72-5.17c.25-.22-.05-.34-.39-.12l-7.07 4.45-3.04-.95c-.66-.21-.67-.66.14-.98l11.9-4.59c.55-.2.1.03 1.84.99z" />
  </svg>
);

const IconRefresh = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const IconTrash = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const IconSearch = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const IconVolume2 = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
  </svg>
);

const IconVolumeX = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
  </svg>
);

const IconCheck = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
  </svg>
);

const IconCheckCheck = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconCopy = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const IconExternalLink = ({ className = "w-3 h-3" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

const IconShieldAlert = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const IconCheckCircle = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconZap = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const IconArrowDown = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
  </svg>
);

const IconActivity = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

// ─── Main Component ──────────────────────────────────────────────────────────
export default function SystemAlertChat() {
  const [messages, setMessages] = useState([]);
  const [stats, setStats] = useState({
    total_all: 0,
    total_today: 0,
    outages_today: 0,
    recovery_today: 0,
    last_alert_at: null,
    last_alert_ago: 'Belum ada',
  });
  const [botInfo, setBotInfo] = useState({
    name: 'Fiber-UNMS NOC Alert Bot',
    username: '@FiberUNMS_NOC_bot',
    status: 'ONLINE',
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('unms_alert_sound') !== 'false';
  });
  const [autoScroll, setAutoScroll] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [isClearing, setIsClearing] = useState(false);

  const chatContainerRef = useRef(null);
  const audioRef = useRef(null);
  const lastKnownIdRef = useRef(null);

  // Play synthetic beep on new critical alert
  const playAlertSound = () => {
    if (!soundEnabled) return;
    try {
      if (!audioRef.current) {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch (e) {
      console.warn('Audio alert could not play:', e);
    }
  };

  const fetchAlerts = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (filterType !== 'ALL') params.append('type', filterType);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      params.append('limit', '100');

      const res = await fetch(`/api/system-alerts/feed?${params.toString()}`);
      if (!res.ok) throw new Error('Gagal mengambil data alert');
      const data = await res.json();

      if (data.status === 'success') {
        const newMessages = data.messages || [];
        
        // Cek alert baru masuk
        if (newMessages.length > 0 && lastKnownIdRef.current) {
          const newest = newMessages[0];
          if (newest.id !== lastKnownIdRef.current) {
            if (newest.is_outage) {
              playAlertSound();
            }
          }
        }
        if (newMessages.length > 0) {
          lastKnownIdRef.current = newMessages[0].id;
        }

        // Urutkan alami dari lama ke baru agar chat mengalir ke bawah
        setMessages([...newMessages].reverse());
        if (data.stats) setStats(data.stats);
        if (data.bot_info) setBotInfo(data.bot_info);
      }
    } catch (err) {
      console.error('Error fetching alert feed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial load & Polling interval tiap 4 detik
  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(() => {
      fetchAlerts(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [filterType, searchQuery]);

  // Auto scroll saat messages bertambah
  useEffect(() => {
    if (autoScroll && chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, autoScroll]);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('unms_alert_sound', next ? 'true' : 'false');
  };

  const handleCopyText = (text, id) => {
    const plainText = text.replace(/<[^>]+>/g, '');
    navigator.clipboard.writeText(plainText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Yakin ingin mengosongkan seluruh riwayat notifikasi alert sistem ini?')) {
      return;
    }
    setIsClearing(true);
    try {
      const res = await fetch('/api/system-alerts/clear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? ''
        }
      });
      if (res.ok) {
        setMessages([]);
        fetchAlerts();
      } else {
        alert('Gagal mengosongkan riwayat alert');
      }
    } catch (e) {
      console.error(e);
      alert('Terjadi kesalahan koneksi');
    } finally {
      setIsClearing(false);
    }
  };

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  // Kelompokkan pesan berdasarkan tanggal untuk divider hari
  const groupedMessages = useMemo(() => {
    const groups = [];
    let currentDate = null;

    messages.forEach((msg) => {
      const msgDate = msg.date_human || 'Hari Ini';
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ type: 'date-divider', date: msgDate });
      }
      groups.push({ type: 'message', data: msg });
    });

    return groups;
  }, [messages]);

  const statCards = [
    {
      label: 'Total Alert',
      value: stats.total_all,
      sub: 'Semua riwayat alarm',
      badge: 'NOC Log',
      badgeCls: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
    },
    {
      label: 'Hari Ini',
      value: stats.total_today,
      sub: 'Aktivitas 24 jam',
      badge: 'Live',
      badgeCls: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
    },
    {
      label: 'Gangguan Massal',
      value: stats.outages_today,
      sub: stats.outages_today > 0 ? 'Perlu penanganan teknisi' : 'Tidak ada gangguan baru',
      badge: '🚨 Outage',
      badgeCls: stats.outages_today > 0 
        ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 animate-pulse'
        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
    },
    {
      label: 'Pemulihan (UP)',
      value: stats.recovery_today,
      sub: 'Port / ODP pulih normal',
      badge: '✅ Restored',
      badgeCls: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
    }
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-w-7xl mx-auto space-y-4">
      
      {/* ── TOP HEADER: ENTERPRISE NOC PROFILE & ACTIONS ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors duration-300">
        
        {/* Profile Info */}
        <div className="flex items-center space-x-3.5">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20 ring-2 ring-sky-400/30">
              <IconTelegram className="w-6 h-6" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full animate-pulse" title="Bot Online & Aktif 24/7" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                {botInfo.name}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                OFFICIAL NOC
              </span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              <span className="font-mono font-semibold text-sky-600 dark:text-sky-400">{botInfo.username}</span>
              <span>•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                Sinkron Real-Time (Telegram & Web)
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleToggleSound}
            title={soundEnabled ? 'Matikan Notifikasi Suara' : 'Aktifkan Notifikasi Suara'}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
              soundEnabled 
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 shadow-2xs' 
                : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {soundEnabled ? <IconVolume2 className="w-4 h-4 text-amber-600 dark:text-amber-400" /> : <IconVolumeX className="w-4 h-4" />}
            <span>{soundEnabled ? 'Suara Aktif' : 'Suara Mati'}</span>
          </button>

          <button
            onClick={() => fetchAlerts()}
            disabled={refreshing}
            title="Perbarui Feed Notifikasi"
            className="px-3.5 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <IconRefresh className={`w-4 h-4 ${refreshing ? 'animate-spin text-sky-500' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleClearHistory}
            disabled={isClearing}
            title="Bersihkan Semua Pesan"
            className="px-3.5 py-2 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <IconTrash className="w-4 h-4" />
            <span>Bersihkan</span>
          </button>
        </div>
      </div>

      {/* ── KPI STAT CARDS (ENTERPRISE 4-GRID) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {statCards.map((c, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs p-4 transition-colors duration-300">
            <div className="flex justify-between items-start mb-1">
              <span className={`text-2xl font-black leading-none ${c.label.includes('Gangguan') && c.value > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                {c.value.toLocaleString()}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.badgeCls}`}>
                {c.badge}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">{c.label}</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* ── FILTER & SEARCH BAR ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 transition-colors duration-300">
        {/* Filter Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              filterType === 'ALL'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Semua ({stats.total_all})
          </button>
          <button
            onClick={() => setFilterType('OUTAGE')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
              filterType === 'OUTAGE'
                ? 'bg-rose-600 text-white shadow-md'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100'
            }`}
          >
            <IconShieldAlert className="w-3.5 h-3.5" /> Gangguan Massal
          </button>
          <button
            onClick={() => setFilterType('RECOVERY')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
              filterType === 'RECOVERY'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
            }`}
          >
            <IconCheckCircle className="w-3.5 h-3.5" /> Pemulihan (UP)
          </button>
          <button
            onClick={() => setFilterType('SYSTEM')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
              filterType === 'SYSTEM'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100'
            }`}
          >
            <IconActivity className="w-3.5 h-3.5" /> Sistem & Tiket
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <IconSearch className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari OLT, port, ODP, tiket..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── CHAT BOT STREAM CONTAINER (TELEGRAM STYLE) ── */}
      <div 
        ref={chatContainerRef}
        className="flex-1 bg-slate-50/70 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-6 overflow-y-auto space-y-4 relative scroll-smooth shadow-inner transition-colors duration-300"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full space-y-3 py-20 text-slate-400">
            <IconRefresh className="w-8 h-8 animate-spin text-blue-600" />
            <span className="text-xs font-semibold">Memuat riwayat chat alert...</span>
          </div>
        ) : groupedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400 space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <IconBot className="w-8 h-8" />
            </div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Belum Ada Riwayat Notifikasi Alert</p>
            <p className="text-xs text-slate-500 dark:text-slate-500 max-w-sm text-center">
              Seluruh sinyal gangguan massal, pemulihan port, ODP down, dan alarm SNMP Trap akan otomatis muncul di sini persis dengan format Telegram.
            </p>
          </div>
        ) : (
          groupedMessages.map((item, index) => {
            if (item.type === 'date-divider') {
              return (
                <div key={`divider-${index}`} className="flex items-center justify-center my-4">
                  <span className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold px-4 py-1 rounded-full shadow-2xs">
                    📅 {item.date}
                  </span>
                </div>
              );
            }

            const msg = item.data;
            const isOutage = msg.is_outage;
            const isRecovery = msg.is_recovery;

            let bubbleBorder = 'border-slate-200 dark:border-slate-800';
            let headerBg = 'bg-slate-100/70 dark:bg-slate-800/60';
            let titleColor = 'text-slate-900 dark:text-white';
            let badgeIcon = <IconBot className="w-4 h-4 text-sky-600 dark:text-sky-400" />;

            if (isOutage) {
              bubbleBorder = 'border-rose-300 dark:border-rose-900/60 shadow-sm';
              headerBg = 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-b border-rose-200 dark:border-rose-900/40';
              titleColor = 'text-rose-600 dark:text-rose-400 font-extrabold';
              badgeIcon = <IconShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
            } else if (isRecovery) {
              bubbleBorder = 'border-emerald-300 dark:border-emerald-900/60 shadow-sm';
              headerBg = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-900/40';
              titleColor = 'text-emerald-600 dark:text-emerald-400 font-extrabold';
              badgeIcon = <IconCheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
            }

            return (
              <div key={`msg-${msg.id}`} className="flex items-start space-x-3 max-w-3xl group">
                
                {/* Bot Small Avatar */}
                <div className="flex-shrink-0 mt-1">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-2xs ${
                    isOutage 
                      ? 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800' 
                      : isRecovery 
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800' 
                      : 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 border border-slate-200 dark:border-slate-700'
                  }`}>
                    {badgeIcon}
                  </div>
                </div>

                {/* Telegram Chat Bubble */}
                <div className={`flex-1 bg-white dark:bg-slate-900 border ${bubbleBorder} rounded-2xl rounded-tl-sm shadow-2xs overflow-hidden transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700`}>
                  
                  {/* Bubble Header */}
                  <div className={`px-4 py-2.5 ${headerBg} flex items-center justify-between`}>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-sky-700 dark:text-sky-400">
                        {botInfo.name}
                      </span>
                      <span className="text-[10px] px-2 py-0.2 rounded-full font-extrabold bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                        BOT
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400">
                        {msg.time_seconds || msg.time_human}
                      </span>
                      {/* Copy Formatted Text Button */}
                      <button
                        onClick={() => handleCopyText(msg.telegram_text, msg.id)}
                        title="Salin Teks Persis Telegram"
                        className="opacity-70 group-hover:opacity-100 hover:opacity-100 p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                      >
                        {copiedId === msg.id ? (
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <IconCheck className="w-3.5 h-3.5" /> Tersalin!
                          </span>
                        ) : (
                          <IconCopy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Bubble Content - Exact Telegram Output */}
                  <div className="p-4 space-y-3">
                    
                    {/* Title */}
                    <div className={`text-sm tracking-tight flex items-center gap-1.5 ${titleColor}`}>
                      {msg.title}
                    </div>

                    {/* Divider 1 */}
                    <div className="text-slate-200 dark:text-slate-800 font-mono select-none text-xs leading-none">
                      ────────────────────────────
                    </div>

                    {/* Body Text */}
                    <div className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 font-mono whitespace-pre-line bg-slate-50 dark:bg-slate-950/70 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800/80">
                      {msg.body}
                    </div>

                    {/* Divider 2 */}
                    <div className="text-slate-200 dark:text-slate-800 font-mono select-none text-xs leading-none">
                      ────────────────────────────
                    </div>

                    {/* Footer Info & Telegram Signature */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 gap-1">
                      <div>
                        <span className="font-semibold text-slate-400 dark:text-slate-500">Waktu: </span>
                        <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{msg.datetime_human}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-400 dark:text-slate-500">Sistem: </span>
                        <span className="text-sky-600 dark:text-sky-400 font-semibold">Fiber-UNMS Enterprise</span>
                        <IconCheckCheck className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" title="Terkirim & Tersinkronisasi" />
                      </div>
                    </div>

                    {/* Direct Action Link (if applicable) */}
                    {msg.url && (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                        <a
                          href={msg.url}
                          className="inline-flex items-center space-x-1.5 text-xs font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/60 px-3 py-1.5 rounded-xl border border-sky-200 dark:border-sky-800 transition shadow-2xs"
                        >
                          <span>Buka Detail Gangguan</span>
                          <IconExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Floating Scroll to Bottom Button */}
        {!autoScroll && (
          <button
            onClick={scrollToBottom}
            className="fixed bottom-16 right-12 z-30 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-2xl shadow-xl transition border border-blue-400/40 flex items-center space-x-2 cursor-pointer"
          >
            <IconArrowDown className="w-4 h-4 animate-bounce" />
            <span className="text-xs font-bold pr-1">Pesan Terbaru</span>
          </button>
        )}
      </div>

      {/* ── CHAT FOOTER: STATUS & REAL-TIME SYNC INDICATOR ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2 shadow-2xs transition-colors duration-300">
        <div className="flex items-center space-x-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-slate-800 dark:text-slate-200 font-bold">
            SNMP Trap & Poller Daemon Aktif
          </span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span>
            Alert terakhir: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{stats.last_alert_ago}</strong>
          </span>
        </div>

        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
            />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200">Auto-Scroll Pesan</span>
          </label>

          <span className="text-slate-300 dark:text-slate-700">|</span>

          <div className="flex items-center space-x-1.5 text-sky-600 dark:text-sky-400 font-mono text-[11px] font-bold">
            <span>Dual Sync</span>
            <IconCheckCheck className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

    </div>
  );
}
