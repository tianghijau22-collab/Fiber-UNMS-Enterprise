import React, { useState, useEffect, useRef, useMemo } from 'react';

// ─── Inline SVG Icons ──────────────────────────────────────────────────────────
const IconBot = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const IconRefresh = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const IconTrash = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const IconSearch = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const IconVolume2 = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
  </svg>
);

const IconVolumeX = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
  </svg>
);

const IconCheck = ({ className = "w-3 h-3" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
  </svg>
);

const IconCheckCheck = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconCopy = ({ className = "w-3 h-3" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const IconShieldAlert = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const IconCheckCircle = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconZap = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const IconArrowDown = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
  </svg>
);

const IconActivity = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const IconClock = ({ className = "w-3 h-3" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" strokeWidth="2" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2" />
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
    const plainText = text ? text.replace(/<[^>]+>/g, '') : '';
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

  const filterButtons = [
    { id: 'ALL', label: `Semua (${stats.total_all})`, icon: null, activeCls: 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm' },
    { id: 'TRAP', label: 'SNMP Trap', icon: <IconZap className="w-3 h-3 text-purple-500" />, activeCls: 'bg-purple-600 text-white shadow-sm' },
    { id: 'POLL', label: 'Polling Telemetri', icon: <IconRefresh className="w-3 h-3 text-amber-500" />, activeCls: 'bg-amber-600 text-white shadow-sm' },
    { id: 'OUTAGE', label: 'Gangguan Massal', icon: <IconShieldAlert className="w-3 h-3 text-rose-500" />, activeCls: 'bg-rose-600 text-white shadow-sm' },
    { id: 'RECOVERY', label: 'Pemulihan (UP)', icon: <IconCheckCircle className="w-3 h-3 text-emerald-500" />, activeCls: 'bg-emerald-600 text-white shadow-sm' },
    { id: 'SYSTEM', label: 'Sistem & Tiket', icon: <IconActivity className="w-3 h-3 text-indigo-500" />, activeCls: 'bg-indigo-600 text-white shadow-sm' },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)] w-full space-y-2.5">

      {/* ── FILTER, SEARCH & ACTION TOOLBAR ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 sm:p-3 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 transition-colors duration-200">
        
        {/* Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0 scrollbar-none">
          {filterButtons.map(btn => {
            const isActive = filterType === btn.id;
            return (
              <button
                key={btn.id}
                onClick={() => setFilterType(btn.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? btn.activeCls
                    : 'bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60'
                }`}
              >
                {btn.icon}
                <span>{btn.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Controls: Search Input + Action Buttons */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full lg:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-60">
            <IconSearch className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari OLT, port, ODP, tiket..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-7 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1.5 focus:ring-sky-500/30 focus:border-sky-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sound Toggle Button */}
          <button
            onClick={handleToggleSound}
            title={soundEnabled ? 'Matikan Notifikasi Suara' : 'Aktifkan Notifikasi Suara'}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              soundEnabled 
                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 dark:border-amber-500/30' 
                : 'bg-slate-50 dark:bg-slate-800/80 text-slate-500 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {soundEnabled ? <IconVolume2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> : <IconVolumeX className="w-3.5 h-3.5" />}
            <span className="text-[11px]">{soundEnabled ? 'Suara Aktif' : 'Suara Mati'}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => fetchAlerts()}
            disabled={refreshing}
            title="Perbarui Feed Notifikasi"
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 rounded-lg text-xs font-semibold transition-all duration-150 shadow-2xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <IconRefresh className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-sky-500' : ''}`} />
            <span className="text-[11px]">Refresh</span>
          </button>

          {/* Clear History Button */}
          <button
            onClick={handleClearHistory}
            disabled={isClearing}
            title="Bersihkan Semua Pesan"
            className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/20 dark:border-rose-500/30 rounded-lg text-xs font-semibold transition-all duration-150 shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <IconTrash className="w-3.5 h-3.5" />
            <span className="text-[11px]">Bersihkan</span>
          </button>
        </div>
      </div>

      {/* ── CHAT BOT STREAM CONTAINER (ENTERPRISE NOC FEED) ── */}
      <div 
        ref={chatContainerRef}
        className="flex-1 bg-slate-50/60 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/90 rounded-xl p-3 md:p-3.5 overflow-y-auto space-y-2.5 relative scroll-smooth shadow-inner transition-colors duration-200"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full space-y-2.5 py-20 text-slate-400">
            <div className="w-8 h-8 rounded-full border-2 border-slate-200 dark:border-slate-800 border-t-sky-500 animate-spin" />
            <span className="text-xs font-medium">Memuat log alert realtime...</span>
          </div>
        ) : groupedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400 space-y-2.5">
            <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <IconBot className="w-6 h-6" />
            </div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Belum Ada Riwayat Notifikasi Alert</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-500 max-w-sm text-center">
              Seluruh sinyal gangguan massal, pemulihan port, ODP down, dan alarm SNMP Trap akan otomatis muncul di sini.
            </p>
          </div>
        ) : (
          groupedMessages.map((item, index) => {
            if (item.type === 'date-divider') {
              return (
                <div key={`divider-${index}`} className="flex items-center justify-center my-3 relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200/80 dark:border-slate-800/80" />
                  </div>
                  <span className="relative bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold px-3 py-0.5 rounded-full shadow-2xs tracking-wide">
                    📅 {item.date}
                  </span>
                </div>
              );
            }

            const msg = item.data;
            const isOutage = msg.is_outage;
            const isRecovery = msg.is_recovery;
            const isTrap = msg.source === 'SNMP_TRAP';
            const isPoll = msg.source === 'POLL_TELEMETRY';

            // Distinctive Enterprise Card Styling with Left Border Accent
            let cardAccentBorder = 'border-l-4 border-l-slate-400 border border-slate-200 dark:border-slate-800';
            let headerBg = 'bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200/60 dark:border-slate-800/60';
            let titleColor = 'text-slate-900 dark:text-white';
            let avatarCls = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
            let badgeIcon = <IconBot className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />;

            if (isOutage) {
              cardAccentBorder = 'border-l-4 border-l-rose-500 border border-rose-200/80 dark:border-rose-900/40 bg-white dark:bg-slate-900 shadow-2xs';
              headerBg = 'bg-rose-500/[0.06] dark:bg-rose-500/[0.08] text-rose-700 dark:text-rose-300 border-b border-rose-200/60 dark:border-rose-900/40';
              titleColor = 'text-rose-600 dark:text-rose-400 font-extrabold';
              avatarCls = 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800';
              badgeIcon = <IconShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />;
            } else if (isRecovery) {
              cardAccentBorder = 'border-l-4 border-l-emerald-500 border border-emerald-200/80 dark:border-emerald-900/40 bg-white dark:bg-slate-900 shadow-2xs';
              headerBg = 'bg-emerald-500/[0.06] dark:bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-300 border-b border-emerald-200/60 dark:border-emerald-900/40';
              titleColor = 'text-emerald-600 dark:text-emerald-400 font-extrabold';
              avatarCls = 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
              badgeIcon = <IconCheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
            } else if (isTrap) {
              cardAccentBorder = 'border-l-4 border-l-purple-500 border border-purple-200/80 dark:border-purple-900/40 bg-white dark:bg-slate-900 shadow-2xs';
              headerBg = 'bg-purple-500/[0.06] dark:bg-purple-500/[0.08] text-purple-700 dark:text-purple-300 border-b border-purple-200/60 dark:border-purple-900/40';
              titleColor = 'text-purple-600 dark:text-purple-400 font-bold';
              avatarCls = 'bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800';
              badgeIcon = <IconZap className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />;
            } else if (isPoll) {
              cardAccentBorder = 'border-l-4 border-l-amber-500 border border-amber-200/80 dark:border-amber-900/40 bg-white dark:bg-slate-900 shadow-2xs';
              headerBg = 'bg-amber-500/[0.06] dark:bg-amber-500/[0.08] text-amber-700 dark:text-amber-300 border-b border-amber-200/60 dark:border-amber-900/40';
              titleColor = 'text-amber-600 dark:text-amber-400 font-bold';
              avatarCls = 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800';
              badgeIcon = <IconRefresh className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
            }

            return (
              <div key={`msg-${msg.id}`} className="flex items-start space-x-2.5 w-full group">
                
                {/* Bot Small Avatar */}
                <div className="flex-shrink-0 mt-0.5">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center border shadow-2xs ${avatarCls}`}>
                    {badgeIcon}
                  </div>
                </div>

                {/* NOC Alert Card */}
                <div className={`flex-1 rounded-xl overflow-hidden shadow-2xs transition-all duration-150 hover:shadow-sm ${cardAccentBorder}`}>
                  
                  {/* Card Header */}
                  <div className={`px-3 py-1.5 ${headerBg} flex items-center justify-between`}>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 capitalize tracking-tight">
                        alert monitoring realtime
                      </span>

                      {/* Source Identifier Badge */}
                      {msg.source === 'SNMP_TRAP' ? (
                        <span className="text-[8px] px-1.5 py-0.2 rounded font-extrabold bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 tracking-wider flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
                          SNMP TRAP
                        </span>
                      ) : msg.source === 'POLL_TELEMETRY' ? (
                        <span className="text-[8px] px-1.5 py-0.2 rounded font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 tracking-wider flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          POLLING TELEMETRI
                        </span>
                      ) : (
                        <span className="text-[8px] px-1.5 py-0.2 rounded font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 tracking-wider">
                          SISTEM
                        </span>
                      )}

                      <span className="text-[8px] px-1.5 py-0.2 rounded font-bold bg-sky-50 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 tracking-wider">
                        REALTIME
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-[9.5px] font-mono font-medium text-slate-500 dark:text-slate-400">
                        {msg.time_seconds || msg.time_human}
                      </span>
                      {/* Copy Formatted Text Button */}
                      <button
                        onClick={() => handleCopyText(msg.telegram_text, msg.id)}
                        title="Salin Teks Pesan"
                        className="opacity-60 group-hover:opacity-100 hover:opacity-100 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                      >
                        {copiedId === msg.id ? (
                          <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <IconCheck className="w-3 h-3" /> Tersalin!
                          </span>
                        ) : (
                          <IconCopy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-2.5 space-y-2">
                    
                    {/* Title */}
                    <div 
                      className={`text-[11px] sm:text-xs font-bold tracking-tight flex items-center gap-1.5 ${titleColor}`}
                      dangerouslySetInnerHTML={{ __html: msg.title }}
                    />

                    {/* Body Text with Clean HTML Elements */}
                    <div 
                      className="text-[10px] sm:text-[10.5px] leading-snug text-slate-800 dark:text-slate-200 font-mono whitespace-pre-wrap bg-slate-50/70 dark:bg-slate-950/50 p-2.5 rounded-lg border border-slate-200/70 dark:border-slate-800/70 [&_b]:font-bold [&_b]:text-slate-900 dark:[&_b]:text-white [&_code]:px-1.5 [&_code]:py-0.2 [&_code]:rounded [&_code]:bg-slate-200/70 dark:[&_code]:bg-slate-800 [&_code]:text-sky-700 dark:[&_code]:text-sky-300 [&_code]:border [&_code]:border-slate-300/80 dark:[&_code]:border-slate-700/60 [&_code]:font-mono [&_code]:text-[10px] [&_i]:italic [&_i]:text-slate-600 dark:[&_i]:text-slate-400"
                      dangerouslySetInnerHTML={{ __html: msg.body }}
                    />

                    {/* Footer Info */}
                    <div className="flex items-center justify-between text-[9px] text-slate-400 dark:text-slate-500 pt-0.5">
                      <div className="flex items-center space-x-1">
                        <IconClock className="w-2.5 h-2.5 text-slate-400" />
                        <span className="font-semibold text-slate-400 dark:text-slate-500">Waktu:</span>
                        <span className="font-mono font-medium text-slate-600 dark:text-slate-400">{msg.datetime_human}</span>
                      </div>
                    </div>

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
            className="fixed bottom-16 right-12 z-30 bg-sky-600 hover:bg-sky-700 text-white px-3 py-2 rounded-xl shadow-lg transition border border-sky-400/30 flex items-center space-x-1.5 cursor-pointer"
          >
            <IconArrowDown className="w-3.5 h-3.5 animate-bounce" />
            <span className="text-[11px] font-bold pr-0.5">Pesan Terbaru</span>
          </button>
        )}
      </div>

      {/* ── CHAT FOOTER: STATUS & REAL-TIME SYNC INDICATOR ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 gap-2 shadow-2xs transition-colors duration-200">
        <div className="flex items-center space-x-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-slate-800 dark:text-slate-200 font-bold">
            SNMP Trap & Poller Daemon Aktif
          </span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span>
            Alert terakhir: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{stats.last_alert_ago}</strong>
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <label className="flex items-center space-x-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-sky-600 focus:ring-0 cursor-pointer w-3.5 h-3.5"
            />
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200">Auto-Scroll Pesan</span>
          </label>

          <span className="text-slate-300 dark:text-slate-700">|</span>

          <div className="flex items-center space-x-1 text-sky-600 dark:text-sky-400 font-mono text-[10px] font-bold">
            <span>Dual Sync</span>
            <IconCheckCheck className="w-3 h-3" />
          </div>
        </div>
      </div>

    </div>
  );
}
