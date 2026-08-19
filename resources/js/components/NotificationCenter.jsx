import React, { useState, useEffect, useRef } from 'react';

const IconBell = ({ count }) => (
  <div className="relative">
    <svg className="w-5 h-5 text-slate-700 dark:text-slate-200 hover:text-indigo-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
    {count > 0 && (
      <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-extrabold text-white ring-2 ring-white dark:ring-slate-900 animate-pulse">
        {count > 99 ? '99+' : count}
      </span>
    )}
  </div>
);

const IconCheckCheck = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7m-12 6l4 4L19 7" />
  </svg>
);

const IconDeviceMobile = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
);

// Web Audio API Synthesizer (Custom High-Tech UNMS Alert Chime)
const playUNMSAlertSound = (type = 'NOC') => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === 'NOC') {
      // Futuristic NOC Alert Chime (880Hz -> 1174.66Hz)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(880, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.15);

      osc2.frequency.setValueAtTime(440, ctx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(587.33, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(ctx.currentTime);
      osc2.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.4);
      osc2.stop(ctx.currentTime + 0.4);
    } else {
      // Gentle Bell Chime (523.25Hz -> 659.25Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch (e) {
    // Silent catch if audio context blocked before gesture
  }
};

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [permissionState, setPermissionState] = useState('default');
  const [testingPush, setTestingPush] = useState(false);
  const [isSecureCtx, setIsSecureCtx] = useState(true);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('unms_sound') !== 'false');

  const dropdownRef = useRef(null);

  // Cek status izin notifikasi browser & Secure Context (HTTPS/localhost vs HTTP IP LAN)
  useEffect(() => {
    const isSecure = window.isSecureContext ?? (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1');
    setIsSecureCtx(isSecure);

    if ('Notification' in window) {
      setPermissionState(Notification.permission);
    } else {
      setPermissionState('unsupported');
    }
  }, []);

  // Fetch data notifikasi dari API
  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) {
        setNotifications([]);
        setUnreadCount(0);
        return;
      }
      const data = await res.json();
      setUnreadCount(typeof data?.unread_count === 'number' ? data.unread_count : 0);
      setNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
    } catch (e) {
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000); // Auto-refresh 15 detik
    return () => clearInterval(interval);
  }, []);

  // Handle klik di luar dropdown untuk menutup
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Minta izin push notification perangkat Windows/Mobile
  const requestDevicePermission = async () => {
    if (!isSecureCtx || !('Notification' in window)) {
      setShowGuideModal(true);
      return;
    }

    try {
      const perm = await Notification.requestPermission();
      setPermissionState(perm);

      if (perm === 'granted') {
        // Register Service Worker & send subscription to backend
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            // standard public key string
            applicationServerKey: null,
          }).catch(() => null);

          if (sub) {
            const subJson = sub.toJSON();
            await fetch('/api/notifications/push-subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                endpoint: subJson.endpoint,
                p256dh_key: subJson.keys?.p256dh,
                auth_token: subJson.keys?.auth,
                device_name: navigator.userAgent.includes('Windows') ? 'Windows Desktop' : 'Mobile Smartphone',
              }),
            });
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Tandai 1 notifikasi telah dibaca
  const markAsRead = async (id, url) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      fetchNotifications();
      if (url) window.location.href = url;
    } catch (e) {
      // Silent
    }
  };

  // Tandai semua dibaca
  const markAllRead = async () => {
    try {
      setLoading(true);
      await fetch('/api/notifications/mark-all-read', { method: 'POST' });
      await fetchNotifications();
      setLoading(false);
    } catch (e) {
      setLoading(false);
    }
  };

  const toggleSound = () => {
    const nextState = !soundEnabled;
    setSoundEnabled(nextState);
    localStorage.setItem('unms_sound', nextState ? 'true' : 'false');
    if (nextState) {
      playUNMSAlertSound('NOC');
    }
  };

  // Uji kirim push notification instan ke perangkat
  const handleTestPush = async () => {
    setTestingPush(true);
    if (soundEnabled) {
      playUNMSAlertSound('NOC');
    }
    try {
      const res = await fetch('/api/notifications/test-push', { method: 'POST' });
      const data = await res.json();
      await fetchNotifications();

      // Jika permission granted, tampilkan juga notifikasi native browser
      if (Notification.permission === 'granted') {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification(data.notification.title, {
            body: data.notification.body,
            icon: '/favicon.ico',
            vibrate: [200, 100, 200],
            data: { url: '/dashboard' },
          });
        } else {
          new Notification(data.notification.title, {
            body: data.notification.body,
            icon: '/favicon.ico',
          });
        }
      }
    } catch (e) {
      // Silent
    } finally {
      setTestingPush(false);
    }
  };

  const getTypeStyle = (type) => {
    switch (type) {
      case 'NOC':
        return { bg: 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800', label: 'ALERT' };
      case 'SECURITY':
        return { bg: 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800', label: 'Keamanan' };
      case 'BILLING':
        return { bg: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800', label: 'Billing' };
      case 'PROVISIONING':
      default:
        return { bg: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800', label: 'Provisioning' };
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Button Bell Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer focus:outline-none"
        title="Pusat Notifikasi Real-Time"
      >
        <IconBell count={unreadCount} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="fixed sm:absolute top-16 sm:top-full left-3 right-3 sm:left-auto sm:right-0 sm:mt-2 w-auto sm:w-96 max-w-sm sm:max-w-none mx-auto sm:mx-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-800/40">
            <div>
              <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-1.5">
                <span>Pusat Notifikasi</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] bg-rose-600 text-white font-extrabold px-1.5 py-0.5 rounded-full">
                    {unreadCount} Baru
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">Event &amp; Peringatan Sistem Real-Time</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSound}
                className={`p-1.5 rounded-lg border text-[10px] font-bold transition-all flex items-center gap-1.5 ${
                  soundEnabled
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                }`}
                title={soundEnabled ? 'Suara Notifikasi Aktif' : 'Suara Notifikasi Dimatikan'}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {soundEnabled ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  )}
                </svg>
                <span>{soundEnabled ? 'Suara Aktif' : 'Suara Mute'}</span>
              </button>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={loading}
                  className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 shrink-0"
                >
                  <IconCheckCheck />
                  <span>Dibaca</span>
                </button>
              )}
            </div>
          </div>

          {/* Banner Status Notifikasi Perangkat */}
          <div className="px-4 py-2.5 bg-indigo-50/80 dark:bg-indigo-950/60 border-b border-indigo-100 dark:border-indigo-900/60 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 min-w-0">
              <IconDeviceMobile />
              {permissionState === 'granted' ? (
                <span className="text-[11px] font-semibold truncate">Notifikasi Perangkat <strong className="text-emerald-600 dark:text-emerald-400">Aktif</strong></span>
              ) : !isSecureCtx ? (
                <span className="text-[11px] font-semibold truncate text-amber-700 dark:text-amber-400">Koneksi HTTP LAN (Butuh Izin/SSL)</span>
              ) : (
                <span className="text-[11px] font-semibold truncate">Notifikasi Perangkat Belum Aktif</span>
              )}
            </div>
            {permissionState !== 'granted' ? (
              <button
                type="button"
                onClick={requestDevicePermission}
                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] rounded-lg shadow-2xs transition-all shrink-0"
              >
                {!isSecureCtx ? 'Petunjuk HP' : 'Aktifkan'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleTestPush}
                disabled={testingPush}
                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] rounded-lg shadow-2xs transition-all disabled:opacity-50 shrink-0"
              >
                {testingPush ? 'Mengirim...' : 'Tes Push'}
              </button>
            )}
          </div>

          {/* List Notifikasi */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs space-y-1">
                <p className="font-bold">Belum Ada Notifikasi</p>
                <p className="text-[11px]">Seluruh event dan insiden sistem akan muncul di sini.</p>
              </div>
            ) : (
              notifications.map((n) => {
                if (!n) return null;
                const style = getTypeStyle(n.type);
                let timeStr = 'Baru saja';
                if (n.created_at) {
                  try {
                    timeStr = new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  } catch (e) {
                    timeStr = 'Baru saja';
                  }
                }
                return (
                  <div
                    key={n.id || Math.random()}
                    onClick={() => markAsRead(n.id, n.url)}
                    className={`p-3.5 transition-all cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 flex gap-3 ${
                      !n.is_read ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''
                    }`}
                  >
                    <div className="shrink-0 mt-0.5">
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase border ${style.bg}`}>
                        {style.label}
                      </span>
                    </div>
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className={`text-xs font-bold truncate ${!n.is_read ? 'text-slate-900 dark:text-slate-100 font-extrabold' : 'text-slate-700 dark:text-slate-300'}`}>
                          {n.title || 'Notifikasi'}
                        </p>
                        {!n.is_read && (
                          <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-snug">
                        {n.body || ''}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 pt-0.5">
                        {timeStr}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 text-center bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
              Fiber UNMS Real-Time Push Engine
            </span>
          </div>
        </div>
      )}

      {/* Modal Petunjuk Notifikasi HP (Mobile HTTP LAN) */}
      <MobileNotificationGuideModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
      />
    </div>
  );
}

/**
 * Custom Glassmorphism Modal Petunjuk Pengaktifan Notifikasi Chrome Mobile LAN
 */
function MobileNotificationGuideModal({ isOpen, onClose }) {
  const [copiedKey, setCopiedKey] = useState(null);

  if (!isOpen) return null;

  const currentHost = typeof window !== 'undefined' ? `http://${window.location.host}` : 'http://192.168.0.103:8000';
  const flagUrl = 'chrome://flags/#unsafely-treat-insecure-origin-as-secure';

  const copyToClipboard = (text, key) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (e) {
      // Fallback if clipboard API unavailable
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden text-slate-800 dark:text-slate-100">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/50 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-md shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100 leading-tight">
                Aktifkan Notifikasi HP (HTTP LAN)
              </h3>
              <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">Panduan Pengujian di Browser Chrome HP</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-3.5 max-h-[75vh] overflow-y-auto text-xs">
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
            Browser HP secara default memblokir Notifikasi Push pada koneksi <strong>HTTP LAN</strong> (tanpa SSL). Ikuti 3 langkah mudah berikut di Chrome HP Anda:
          </p>

          {/* Langkah 1 */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-indigo-600 dark:text-indigo-400 text-xs flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-[10px] font-black">1</span>
                Buka Chrome Flags di HP
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(flagUrl, 'flag')}
                className="px-2.5 py-1 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 text-[10px] font-bold rounded-lg text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1 cursor-pointer"
              >
                {copiedKey === 'flag' ? 'Tersalin' : 'Salin URL Flag'}
              </button>
            </div>
            <p className="font-mono text-[10px] bg-slate-200/80 dark:bg-slate-950 p-2 rounded-xl text-slate-800 dark:text-slate-200 break-all select-all font-semibold">
              {flagUrl}
            </p>
          </div>

          {/* Langkah 2 */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-indigo-600 dark:text-indigo-400 text-xs flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-[10px] font-black">2</span>
                Isi IP Komputer Anda
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(currentHost, 'host')}
                className="px-2.5 py-1 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 text-[10px] font-bold rounded-lg text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1 cursor-pointer"
              >
                {copiedKey === 'host' ? 'Tersalin' : 'Salin IP:Port'}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Pada kolom <em className="text-slate-700 dark:text-slate-200 font-semibold">Insecure origins treated as secure</em>, tempelkan URL ini:
            </p>
            <p className="font-mono text-[10px] bg-slate-200/80 dark:bg-slate-950 p-2 rounded-xl text-emerald-600 dark:text-emerald-400 font-extrabold break-all select-all">
              {currentHost}
            </p>
          </div>

          {/* Langkah 3 */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-1">
            <span className="font-extrabold text-indigo-600 dark:text-indigo-400 text-xs flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-[10px] font-black">3</span>
              Ubah ke Enabled &amp; Restart Chrome HP
            </span>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
              Ubah dropdown opsi ke <strong className="text-emerald-600 dark:text-emerald-400 font-bold">Enabled</strong>, lalu klik tombol <strong className="text-indigo-600 dark:text-indigo-400 font-bold">Relaunch / Restart</strong> di bawah layar HP.
            </p>
          </div>

          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl text-[10px] text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 shrink-0">Catatan:</span>
            <span>
              Pada domain server ber-SSL/HTTPS (misal: <code>https://unms.perusahaan.net</code>), notifikasi HP akan aktif otomatis secara <em>native</em> tanpa perlu pengaturan di atas.
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-right">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer"
          >
            Mengerti &amp; Tutup Panduan
          </button>
        </div>
      </div>
    </div>
  );
}
