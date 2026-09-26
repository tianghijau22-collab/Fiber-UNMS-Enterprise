import React, { useState, useEffect, useRef, useMemo } from 'react';
import { toPng } from 'html-to-image';

// ─── Inline SVG Icons (Design System Compliant) ──────────────────────────────
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

const IconX = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const IconCopy = ({ className = "w-3 h-3" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const IconCamera = ({ className = "w-3 h-3" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
    <circle cx="12" cy="13" r="3" strokeWidth="2" />
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

const IconCalendar = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="2" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);

const IconEyeOff = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
  </svg>
);

const IconServer = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="2" y="2" width="20" height="8" rx="2" strokeWidth="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" strokeWidth="2" />
    <line x1="6" y1="6" x2="6.01" y2="6" strokeWidth="3" strokeLinecap="round" />
    <line x1="6" y1="18" x2="6.01" y2="18" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const IconBox = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

const IconChevronLeft = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
  </svg>
);

const IconChevronRight = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
  </svg>
);

// ─── Main Component ──────────────────────────────────────────────────────────
export default function SystemAlertChat() {
  const [messages, setMessages] = useState([]);
  const [stats, setStats] = useState({
    total_all: 0,
    total_today: 0,
    outage_interface_today: 0,
    outage_odp_today: 0,
    recovery_interface_today: 0,
    recovery_odp_today: 0,
    dying_gasp_today: 0,
    trap_individual_today: 0,
    mass_outages_today: 0,
    recovery_today: 0,
    polling_today: 0,
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
  const [hideTime, setHideTime] = useState(() => {
    return localStorage.getItem('unms_alert_hide_time') === 'true';
  });
  const [autoScroll, setAutoScroll] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [capturingId, setCapturingId] = useState(null);
  const [isClearing, setIsClearing] = useState(false);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const chatContainerRef = useRef(null);
  const filterContainerRef = useRef(null);
  const audioRef = useRef(null);
  const lastKnownIdRef = useRef(null);

  // Mouse drag-to-scroll refs
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasMovedRef = useRef(false);

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

  // Initial load & Polling interval tiap 2.5 detik (Real-Time Push/Pull)
  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(() => {
      fetchAlerts(true);
    }, 2500);
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

  // ─── Horizontal Filter Scroll & Drag-to-Scroll Mechanics ──────────────────
  const checkFilterScroll = () => {
    const el = filterContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 6);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 6);
  };

  const scrollFilters = (dir) => {
    const el = filterContainerRef.current;
    if (!el) return;
    const offset = 260;
    el.scrollBy({ left: dir === 'left' ? -offset : offset, behavior: 'smooth' });
    setTimeout(checkFilterScroll, 320);
  };

  // Convert mouse wheel on filter bar to horizontal scroll
  useEffect(() => {
    const el = filterContainerRef.current;
    if (!el) return;

    const onWheel = (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
        checkFilterScroll();
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    checkFilterScroll();
    el.addEventListener('scroll', checkFilterScroll);
    window.addEventListener('resize', checkFilterScroll);

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('scroll', checkFilterScroll);
      window.removeEventListener('resize', checkFilterScroll);
    };
  }, [stats]);

  // Mouse drag-to-scroll handlers
  const handleMouseDown = (e) => {
    const el = filterContainerRef.current;
    if (!el) return;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startXRef.current = e.pageX - el.offsetLeft;
    scrollLeftRef.current = el.scrollLeft;
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    const el = filterContainerRef.current;
    if (!el) return;
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startXRef.current) * 1.3;
    if (Math.abs(walk) > 4) {
      hasMovedRef.current = true;
    }
    el.scrollLeft = scrollLeftRef.current - walk;
    checkFilterScroll();
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('unms_alert_sound', next ? 'true' : 'false');
  };

  const handleToggleHideTime = () => {
    const next = !hideTime;
    setHideTime(next);
    localStorage.setItem('unms_alert_hide_time', next ? 'true' : 'false');
  };

  const handleCopyText = (text, id) => {
    const plainText = text ? text.replace(/<[^>]+>/g, '') : '';
    navigator.clipboard.writeText(plainText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleScreenshotCard = async (msgId) => {
    const cardElement = document.getElementById(`alert-card-${msgId}`);
    if (!cardElement) return;
    setCapturingId(msgId);
    try {
      const isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
      
      const dataUrl = await toPng(cardElement, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: isDark ? '#000000' : '#ffffff',
        filter: (node) => {
          if (node?.classList && node.classList.contains('no-screenshot')) {
            return false;
          }
          return true;
        }
      });

      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      link.download = `alert-${msgId}-${timestamp}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Gagal mengambil screenshot:', err);
      alert('Gagal mengambil screenshot card alert: ' + (err?.message || 'Pastikan browser mendukung canvas'));
    } finally {
      setCapturingId(null);
    }
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
    { 
      id: 'ALL', 
      label: 'Semua', 
      count: stats.total_all || 0,
      icon: null, 
      activeCls: 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white shadow-2xs' 
    },
    { 
      id: 'OUTAGE_INTERFACE', 
      label: 'Gangguan Interface', 
      count: stats.outage_interface_today || 0,
      icon: <IconServer className="w-3.5 h-3.5 text-rose-500" />, 
      activeCls: 'bg-rose-600 text-white border-rose-600 shadow-2xs' 
    },
    { 
      id: 'OUTAGE_ODP', 
      label: 'Gangguan ODP', 
      count: stats.outage_odp_today || 0,
      icon: <IconBox className="w-3.5 h-3.5 text-amber-500" />, 
      activeCls: 'bg-amber-600 text-white border-amber-600 shadow-2xs' 
    },
    { 
      id: 'RECOVERY_INTERFACE', 
      label: 'Pemulihan Interface', 
      count: stats.recovery_interface_today || 0,
      icon: <IconCheckCircle className="w-3.5 h-3.5 text-emerald-500" />, 
      activeCls: 'bg-emerald-600 text-white border-emerald-600 shadow-2xs' 
    },
    { 
      id: 'RECOVERY_ODP', 
      label: 'Pemulihan ODP', 
      count: stats.recovery_odp_today || 0,
      icon: <IconCheckCircle className="w-3.5 h-3.5 text-teal-500" />, 
      activeCls: 'bg-teal-600 text-white border-teal-600 shadow-2xs' 
    },
    { 
      id: 'DYING_GASP', 
      label: 'Mati Listrik (Dying Gasp)', 
      count: stats.dying_gasp_today || 0,
      icon: <IconZap className="w-3.5 h-3.5 text-purple-500" />, 
      activeCls: 'bg-purple-600 text-white border-purple-600 shadow-2xs' 
    },
    { 
      id: 'TRAP_INDIVIDUAL', 
      label: 'Alert Perorangan', 
      count: stats.trap_individual_today || 0,
      icon: <IconActivity className="w-3.5 h-3.5 text-sky-500" />, 
      activeCls: 'bg-sky-600 text-white border-sky-600 shadow-2xs' 
    },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)] w-full space-y-3 font-sans transition-colors duration-200 text-black dark:text-white">

      {/* ── FILTER, SEARCH & ACTION TOOLBAR (DESIGN SYSTEM COMPLIANT) ── */}
      <div className="bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg p-3 sm:p-3.5 shadow-xs space-y-3 transition-colors duration-200">
        
        {/* ROW 1: Search Bar (Left) & Utility Actions (Right) */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-2.5">
          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <IconSearch className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-black/50 dark:text-white/50" />
            <input
              type="text"
              placeholder="Cari OLT, port, ODP, tiket, nama..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/5 dark:bg-white/5 border border-black/20 dark:border-white/20 rounded-md pl-8.5 pr-7 py-1.5 text-xs font-medium text-black dark:text-white placeholder-black/40 dark:placeholder-white/40 focus:outline-none focus:border-black dark:focus:border-white transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white cursor-pointer p-0.5"
              >
                <IconX className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Right Controls: Hide Time, Sound, Refresh, Clear */}
          <div className="flex items-center gap-1.5 w-full md:w-auto justify-end overflow-x-auto pb-0.5 md:pb-0">
            {/* Hide/Show Time Toggle Button */}
            <button
              onClick={handleToggleHideTime}
              title={hideTime ? 'Tampilkan Waktu Notifikasi' : 'Sembunyikan Waktu Notifikasi'}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold border transition-all duration-150 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                hideTime 
                  ? 'bg-black/10 dark:bg-white/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/40' 
                  : 'bg-white dark:bg-black text-black/70 dark:text-white/70 border-black/20 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/10'
              }`}
            >
              {hideTime ? <IconEyeOff className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> : <IconClock className="w-3.5 h-3.5 text-black/60 dark:text-white/60" />}
              <span className="text-[11px]">{hideTime ? 'Waktu Tersembunyi' : 'Sembunyikan Waktu'}</span>
            </button>

            {/* Sound Toggle Button */}
            <button
              onClick={handleToggleSound}
              title={soundEnabled ? 'Matikan Notifikasi Suara' : 'Aktifkan Notifikasi Suara'}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold border transition-all duration-150 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                soundEnabled 
                  ? 'bg-black/10 dark:bg-white/10 text-amber-600 dark:text-amber-400 border-amber-500/40' 
                  : 'bg-white dark:bg-black text-black/70 dark:text-white/70 border-black/20 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/10'
              }`}
            >
              {soundEnabled ? <IconVolume2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> : <IconVolumeX className="w-3.5 h-3.5 text-black/60 dark:text-white/60" />}
              <span className="text-[11px]">{soundEnabled ? 'Suara Aktif' : 'Suara Mati'}</span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={() => fetchAlerts()}
              disabled={refreshing}
              title="Perbarui Feed Notifikasi"
              className="px-2.5 py-1.5 bg-white dark:bg-black hover:bg-black/5 dark:hover:bg-white/10 text-black dark:text-white border border-black/20 dark:border-white/20 rounded-md text-xs font-semibold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <IconRefresh className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-600 dark:text-indigo-400' : ''}`} />
              <span className="text-[11px]">Refresh</span>
            </button>

            {/* Clear History Button */}
            <button
              onClick={handleClearHistory}
              disabled={isClearing}
              title="Bersihkan Semua Pesan"
              className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 dark:border-rose-500/30 rounded-md text-xs font-semibold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <IconTrash className="w-3.5 h-3.5" />
              <span className="text-[11px]">Bersihkan</span>
            </button>
          </div>
        </div>

        {/* Separator Line */}
        <div className="border-t border-black/10 dark:border-white/10" />

        {/* ROW 2: Horizontal Scrollable Category Filter Pills with Navigation Controls */}
        <div className="relative flex items-center w-full">
          
          {/* Scroll Left Chevron Button */}
          {canScrollLeft && (
            <button
              onClick={() => scrollFilters('left')}
              title="Geser ke kiri"
              className="absolute -left-1 sm:-left-2 z-10 p-1.5 rounded-md bg-white/95 dark:bg-black/95 text-black dark:text-white shadow-md border border-black/20 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer flex items-center justify-center backdrop-blur-xs"
            >
              <IconChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Filter Pills Container */}
          <div
            ref={filterContainerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            className="flex items-center space-x-2 overflow-x-auto w-full py-1 px-1 scroll-smooth select-none cursor-grab active:cursor-grabbing [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-black/5 dark:[&::-webkit-scrollbar-track]:bg-white/5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-black/20 dark:[&::-webkit-scrollbar-thumb]:bg-white/20 hover:[&::-webkit-scrollbar-thumb]:bg-black/40 dark:hover:[&::-webkit-scrollbar-thumb]:bg-white/40"
            style={{ scrollbarWidth: 'thin' }}
          >
            {filterButtons.map(btn => {
              const isActive = filterType === btn.id;
              return (
                <button
                  key={btn.id}
                  onClick={() => {
                    if (hasMovedRef.current) return;
                    setFilterType(btn.id);
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all duration-150 flex items-center gap-2 cursor-pointer shrink-0 border ${
                    isActive
                      ? btn.activeCls
                      : 'bg-white dark:bg-black text-black/80 dark:text-white/80 hover:bg-black/5 dark:hover:bg-white/10 border-black/20 dark:border-white/20'
                  }`}
                >
                  {btn.icon}
                  <span>{btn.label}</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                    isActive 
                      ? 'bg-black/20 text-white dark:bg-white/25 dark:text-black' 
                      : 'bg-black/10 dark:bg-white/10 text-black dark:text-white'
                  }`}>
                    {btn.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Scroll Right Chevron Button */}
          {canScrollRight && (
            <button
              onClick={() => scrollFilters('right')}
              title="Geser ke kanan"
              className="absolute -right-1 sm:-right-2 z-10 p-1.5 rounded-md bg-white/95 dark:bg-black/95 text-black dark:text-white shadow-md border border-black/20 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer flex items-center justify-center backdrop-blur-xs"
            >
              <IconChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

        </div>

      </div>

      {/* ── CHAT BOT STREAM CONTAINER (ENTERPRISE NOC FEED) ── */}
      <div 
        ref={chatContainerRef}
        className="flex-1 bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg p-3 sm:p-4 overflow-y-auto space-y-3 relative scroll-smooth shadow-xs transition-colors duration-200"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full space-y-2.5 py-20 text-black/50 dark:text-white/50">
            <div className="w-8 h-8 rounded-full border-2 border-black/20 dark:border-white/20 border-t-indigo-600 dark:border-t-indigo-400 animate-spin" />
            <span className="text-xs font-medium">Memuat log alert realtime...</span>
          </div>
        ) : groupedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-20 text-black/50 dark:text-white/50 space-y-2.5">
            <div className="w-12 h-12 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-center text-black/50 dark:text-white/50 border border-black/20 dark:border-white/20 shadow-2xs">
              <IconBot className="w-6 h-6" />
            </div>
            <p className="text-xs font-bold text-black dark:text-white">
              {filterType === 'OUTAGE_INTERFACE' && 'Tidak Ada Gangguan Interface'}
              {filterType === 'OUTAGE_ODP' && 'Tidak Ada Gangguan ODP'}
              {filterType === 'RECOVERY_INTERFACE' && 'Tidak Ada Pemulihan Interface'}
              {filterType === 'RECOVERY_ODP' && 'Tidak Ada Pemulihan ODP'}
              {filterType === 'DYING_GASP' && 'Tidak Ada Alert Mati Listrik (Dying Gasp)'}
              {filterType === 'TRAP_INDIVIDUAL' && 'Tidak Ada Alert Perorangan'}
              {filterType === 'ALL' && 'Belum Ada Riwayat Notifikasi Alert'}
            </p>
            <p className="text-[11px] text-black/60 dark:text-white/60 max-w-sm text-center">
              {filterType === 'OUTAGE_INTERFACE' && 'Seluruh interface / port PON terpantau normal dan tidak ada insiden putus jalur.'}
              {filterType === 'OUTAGE_ODP' && 'Seluruh splitter dan ODP jaringan beroperasi normal tanpa indikasi loss massal.'}
              {filterType === 'RECOVERY_INTERFACE' && 'Belum ada catatan pemulihan interface port PON untuk periode ini.'}
              {filterType === 'RECOVERY_ODP' && 'Belum ada catatan pemulihan splitter ODP untuk periode ini.'}
              {filterType === 'DYING_GASP' && 'Tidak ada sinyal padam listrik / power cut dari perangkat modem pelanggan.'}
              {filterType === 'TRAP_INDIVIDUAL' && 'Tidak ada notifikasi trap modem perorangan yang tercatat.'}
              {filterType === 'ALL' && 'Seluruh sinyal gangguan massal, pemulihan port, ODP down, dan alarm SNMP Trap akan otomatis muncul di sini.'}
            </p>
          </div>
        ) : (
          groupedMessages.map((item, index) => {
            if (item.type === 'date-divider') {
              return (
                <div key={`divider-${index}`} className="flex items-center justify-center my-3 relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-black/10 dark:border-white/10" />
                  </div>
                  <span className="relative bg-white dark:bg-black border border-black/30 dark:border-white/30 text-black dark:text-white text-[10px] font-mono font-bold px-3 py-0.5 rounded shadow-2xs tracking-wider flex items-center gap-1.5">
                    <IconCalendar className="w-3 h-3 text-black/70 dark:text-white/70" />
                    <span>{item.date}</span>
                  </span>
                </div>
              );
            }

            const msg = item.data;
            const isDyingGasp = msg.is_dying_gasp || msg.category === 'DYING_GASP' || /DYING GASP|MATI LISTRIK|POWER CUT|PADAM LISTRIK/i.test(msg.title) || /DYING GASP|MATI LISTRIK|POWER CUT|PADAM LISTRIK/i.test(msg.body);
            const isOutageInterface = msg.is_outage_interface || msg.category === 'OUTAGE_INTERFACE';
            const isOutageOdp = msg.is_outage_odp || msg.category === 'OUTAGE_ODP';
            const isRecoveryInterface = msg.is_recovery_interface || msg.category === 'RECOVERY_INTERFACE';
            const isRecoveryOdp = msg.is_recovery_odp || msg.category === 'RECOVERY_ODP';
            const isRecovery = msg.is_recovery || /PEMULIHAN|PULIH|RECOVERY|RESTORED|RESOLVED|NORMAL/i.test(msg.title);
            const isMassOutage = !isRecovery && (msg.type === 'MASS_OUTAGE' || /GANGGUAN MASSAL/i.test(msg.title));
            const isTrapIndividual = !isRecovery && !isMassOutage && !isDyingGasp && (msg.type === 'TRAP_INDIVIDUAL' || msg.source === 'SNMP_TRAP');
            const isPoll = !isRecovery && !isMassOutage && !isTrapIndividual && !isDyingGasp && (msg.source === 'POLL_TELEMETRY');

            // High Contrast Sharp Border Accent & Semantic Color
            let cardAccentBorder = 'border-l-2 border-l-black/40 dark:border-l-white/40 border border-black/20 dark:border-white/20 bg-white dark:bg-black';
            let headerBg = 'bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-white/10';
            let titleColor = 'text-black dark:text-white font-bold';
            let bodyBg = 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10';
            let avatarCls = 'bg-black/5 dark:bg-white/5 text-black dark:text-white border-black/20 dark:border-white/20';
            let badgeIcon = <IconBot className="w-3.5 h-3.5 text-black/60 dark:text-white/60" />;

            if (isDyingGasp) {
              cardAccentBorder = 'border-l-2 border-l-purple-500 border border-black/20 dark:border-white/20 bg-white dark:bg-black shadow-xs';
              headerBg = 'bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-white/10';
              titleColor = 'text-purple-600 dark:text-purple-400 font-bold';
              bodyBg = 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10';
              avatarCls = 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30';
              badgeIcon = <IconZap className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 animate-pulse" />;
            } else if (isOutageInterface) {
              cardAccentBorder = 'border-l-2 border-l-rose-500 border border-black/20 dark:border-white/20 bg-white dark:bg-black shadow-xs';
              headerBg = 'bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-white/10';
              titleColor = 'text-rose-600 dark:text-rose-400 font-bold tracking-tight';
              bodyBg = 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10';
              avatarCls = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 animate-pulse';
              badgeIcon = <IconServer className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />;
            } else if (isOutageOdp) {
              cardAccentBorder = 'border-l-2 border-l-amber-500 border border-black/20 dark:border-white/20 bg-white dark:bg-black shadow-xs';
              headerBg = 'bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-white/10';
              titleColor = 'text-amber-600 dark:text-amber-400 font-bold tracking-tight';
              bodyBg = 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10';
              avatarCls = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 animate-pulse';
              badgeIcon = <IconBox className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
            } else if (isRecoveryInterface) {
              cardAccentBorder = 'border-l-2 border-l-emerald-500 border border-black/20 dark:border-white/20 bg-white dark:bg-black shadow-xs';
              headerBg = 'bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-white/10';
              titleColor = 'text-emerald-600 dark:text-emerald-400 font-bold';
              bodyBg = 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10';
              avatarCls = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
              badgeIcon = <IconCheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
            } else if (isRecoveryOdp) {
              cardAccentBorder = 'border-l-2 border-l-teal-500 border border-black/20 dark:border-white/20 bg-white dark:bg-black shadow-xs';
              headerBg = 'bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-white/10';
              titleColor = 'text-teal-600 dark:text-teal-400 font-bold';
              bodyBg = 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10';
              avatarCls = 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30';
              badgeIcon = <IconCheckCircle className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />;
            } else if (isRecovery) {
              cardAccentBorder = 'border-l-2 border-l-emerald-500 border border-black/20 dark:border-white/20 bg-white dark:bg-black shadow-xs';
              headerBg = 'bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-white/10';
              titleColor = 'text-emerald-600 dark:text-emerald-400 font-bold';
              bodyBg = 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10';
              avatarCls = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
              badgeIcon = <IconCheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
            } else if (isMassOutage) {
              cardAccentBorder = 'border-l-2 border-l-rose-600 border border-black/20 dark:border-white/20 bg-white dark:bg-black shadow-xs';
              headerBg = 'bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-white/10';
              titleColor = 'text-rose-600 dark:text-rose-400 font-bold tracking-tight';
              bodyBg = 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10';
              avatarCls = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 animate-pulse';
              badgeIcon = <IconShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />;
            } else if (isTrapIndividual) {
              cardAccentBorder = 'border-l-2 border-l-sky-500 border border-black/20 dark:border-white/20 bg-white dark:bg-black shadow-xs';
              headerBg = 'bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-white/10';
              titleColor = 'text-sky-600 dark:text-sky-400 font-bold';
              bodyBg = 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10';
              avatarCls = 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30';
              badgeIcon = <IconActivity className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />;
            } else if (isPoll) {
              cardAccentBorder = 'border-l-2 border-l-amber-500 border border-black/20 dark:border-white/20 bg-white dark:bg-black shadow-xs';
              headerBg = 'bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-white/10';
              titleColor = 'text-amber-600 dark:text-amber-400 font-bold';
              bodyBg = 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10';
              avatarCls = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
              badgeIcon = <IconRefresh className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
            }

            return (
              <div key={`msg-${msg.id}`} className="flex items-start space-x-2.5 w-full group">
                
                {/* Bot Small Avatar */}
                <div className="shrink-0 mt-0.5">
                  <div className={`w-8 h-8 rounded-md flex items-center justify-center border shadow-2xs ${avatarCls}`}>
                    {badgeIcon}
                  </div>
                </div>

                {/* NOC Alert Card */}
                <div 
                  id={`alert-card-${msg.id}`} 
                  className={`flex-1 rounded-lg overflow-hidden shadow-2xs transition-all duration-150 hover:border-black/50 dark:hover:border-white/50 ${cardAccentBorder}`}
                >
                  
                  {/* Card Header */}
                  <div className={`px-3.5 py-2 ${headerBg} flex items-center justify-between`}>
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] sm:text-[11.5px] font-bold tracking-wider uppercase font-mono text-black dark:text-white">
                        {msg.source_short_badge || 'ALERT MONITORING SISTEM'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* Timestamp (hidden if hideTime is active) */}
                      {!hideTime && (
                        <span className="text-xs sm:text-[12px] font-mono font-medium text-black/60 dark:text-white/60 mr-1">
                          {msg.time_seconds || msg.time_human}
                        </span>
                      )}

                      <div className="flex items-center space-x-1 no-screenshot">
                        {/* Screenshot Card Button */}
                        <button
                          onClick={() => handleScreenshotCard(msg.id)}
                          disabled={capturingId === msg.id}
                          title="Ambil Screenshot Card Alert"
                          className="opacity-60 group-hover:opacity-100 hover:opacity-100 p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 text-black dark:text-white transition cursor-pointer"
                        >
                          {capturingId === msg.id ? (
                            <IconRefresh className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
                          ) : (
                            <IconCamera className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* Copy Formatted Text Button */}
                        <button
                          onClick={() => handleCopyText(msg.telegram_text, msg.id)}
                          title="Salin Teks Pesan"
                          className="opacity-60 group-hover:opacity-100 hover:opacity-100 p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 text-black dark:text-white transition cursor-pointer"
                        >
                          {copiedId === msg.id ? (
                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                              <IconCheck className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <IconCopy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-3.5 sm:p-4 space-y-2.5">
                    
                    {/* Title */}
                    <div 
                      className={`text-xs sm:text-sm font-bold tracking-tight flex items-center gap-1.5 ${titleColor}`}
                      dangerouslySetInnerHTML={{ __html: msg.title }}
                    />

                    {/* Body Text with Clean Monospace Text */}
                    <div 
                      className={`text-xs sm:text-[13px] leading-relaxed text-black dark:text-white font-mono whitespace-pre-wrap ${bodyBg} p-3 sm:p-3.5 rounded-md border [&_b]:font-bold [&_b]:text-black dark:[&_b]:text-white [&_code]:font-mono [&_code]:font-medium [&_code]:text-inherit [&_code]:bg-transparent [&_code]:border-0 [&_code]:p-0 [&_i]:italic [&_i]:text-black/70 dark:[&_i]:text-white/70`}
                      dangerouslySetInnerHTML={{ __html: msg.body }}
                    />

                    {/* Footer Info (Hidden if hideTime is active) */}
                    {!hideTime && (
                      <div className="flex items-center justify-between text-[10.5px] sm:text-[11px] text-black/50 dark:text-white/50 pt-0.5 font-mono">
                        <div className="flex items-center space-x-1.5">
                          <IconClock className="w-3 h-3 text-black/40 dark:text-white/40" />
                          <span>Waktu:</span>
                          <span className="font-semibold text-black/70 dark:text-white/70">{msg.datetime_human}</span>
                        </div>
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
            title="Scroll ke Pesan Terbaru"
            className="fixed bottom-14 right-8 z-30 bg-black/90 hover:bg-black dark:bg-white/90 dark:hover:bg-white text-white dark:text-black backdrop-blur-xs px-3 py-1.5 rounded-md shadow-md hover:shadow-lg transition-all border border-black/30 dark:border-white/30 flex items-center space-x-1.5 cursor-pointer text-xs font-bold"
          >
            <IconArrowDown className="w-3 h-3" />
            <span>Terbaru</span>
          </button>
        )}
      </div>

      {/* ── CHAT FOOTER: STATUS & REAL-TIME SYNC INDICATOR ── */}
      <div className="bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg px-3.5 py-2 flex flex-col sm:flex-row items-center justify-between text-xs text-black/70 dark:text-white/70 gap-2 shadow-xs transition-colors duration-200">
        <div className="flex items-center space-x-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-black dark:text-white font-bold">
            SNMP Trap & Poller Daemon Aktif
          </span>
          <span className="text-black/20 dark:text-white/20">|</span>
          <span className="font-mono text-[11px]">
            Alert terakhir: <strong className="text-black dark:text-white font-semibold">{stats.last_alert_ago}</strong>
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <label className="flex items-center space-x-1.5 cursor-pointer select-none text-xs">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded bg-black/5 dark:bg-white/10 border-black/30 dark:border-white/30 text-indigo-600 focus:ring-0 cursor-pointer w-3.5 h-3.5"
            />
            <span className="font-medium text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white">Auto-Scroll Pesan</span>
          </label>

          <span className="text-black/20 dark:text-white/20">|</span>

          <div className="flex items-center space-x-1 text-indigo-600 dark:text-indigo-400 font-mono text-[10px] font-bold">
            <span>Dual Sync</span>
            <IconCheckCheck className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

    </div>
  );
}
