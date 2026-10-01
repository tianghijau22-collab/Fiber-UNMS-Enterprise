import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from './AuthContext.jsx';

/**
 * UserPopupAnnouncementModal — Pop-up Alert & Pengumuman Interaktif untuk Seluruh Pengguna.
 * Menampilkan pengumuman resmi yang disetel oleh Super Administrator.
 * Dilengkapi fitur multi-alert pager, tombol aksi eksternal/internal, dan opsi "Jangan tampilkan lagi".
 */
export default function UserPopupAnnouncementModal() {
  const { currentUser } = useAuth();
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // Fetch active alerts when logged in
  const fetchActiveAlerts = useCallback(async () => {
    if (!currentUser) {
      setIsOpen(false);
      return;
    }

    try {
      const res = await fetch(`/api/popup-alerts/active?role=${encodeURIComponent(currentUser.role || 'all')}`, {
        headers: {
          'Accept': 'application/json',
          'X-User-Id': currentUser.id || '',
        }
      });
      const json = await res.json();

      if (res.ok && json.status === 'success' && Array.isArray(json.data)) {
        // Filter out alerts that user already dismissed if show_once_per_user is enabled or user marked it
        const unreadAlerts = json.data.filter((alert) => {
          const dismissedKey = `fiber_popup_dismissed_${alert.id}`;
          const isDismissed = localStorage.getItem(dismissedKey);
          return !isDismissed;
        });

        if (unreadAlerts.length > 0) {
          setActiveAlerts(unreadAlerts);
          setCurrentIndex(0);
          setIsOpen(true);
        } else {
          setActiveAlerts([]);
          setIsOpen(false);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch active popup alerts:', err);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchActiveAlerts();
  }, [fetchActiveAlerts]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const currentAlert = activeAlerts[currentIndex];

  const handleClose = () => {
    if (currentAlert && dontShowAgain) {
      try {
        localStorage.setItem(`fiber_popup_dismissed_${currentAlert.id}`, '1');
      } catch (e) {
        // Ignore storage error
      }
    } else if (currentAlert && currentAlert.show_once_per_user) {
      try {
        localStorage.setItem(`fiber_popup_dismissed_${currentAlert.id}`, '1');
      } catch (e) {
        // Ignore storage error
      }
    }

    // If there are more alerts in queue, show next
    if (currentIndex < activeAlerts.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setDontShowAgain(false);
    } else {
      setIsOpen(false);
    }
  };

  if (!isOpen || !currentAlert) return null;

  // Type configuration (Color, Badge & Icon)
  const getTypeConfig = (type) => {
    switch (type) {
      case 'maintenance':
        return {
          badge: currentAlert.badge_text || 'Pemeliharaan Jaringan',
          badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-700/60',
          iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
        };
      case 'warning':
        return {
          badge: currentAlert.badge_text || 'Peringatan Operasional',
          badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-700/60',
          iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ),
        };
      case 'critical':
        return {
          badge: currentAlert.badge_text || 'Pemberitahuan Darurat',
          badgeClass: 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-700/60',
          iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        };
      case 'update':
        return {
          badge: currentAlert.badge_text || 'Pembaruan Sistem',
          badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-700/60',
          iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ),
        };
      case 'info':
      default:
        return {
          badge: currentAlert.badge_text || 'Pengumuman Resmi',
          badgeClass: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-700/60',
          iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        };
    }
  };

  const typeConfig = getTypeConfig(currentAlert.type);

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] overflow-y-auto bg-black/70 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-black dark:text-white my-auto">

        {/* Top Header Accent */}
        <div className="p-5 sm:p-6 border-b border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className={`p-2.5 rounded-lg border shrink-0 ${typeConfig.iconBg}`}>
                {typeConfig.icon}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase border ${typeConfig.badgeClass}`}>
                    {typeConfig.badge}
                  </span>
                  {activeAlerts.length > 1 && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-black/5 dark:bg-white/10 text-black dark:text-white border border-black/10 dark:border-white/10">
                      {currentIndex + 1} dari {activeAlerts.length}
                    </span>
                  )}
                </div>
                <h3 className="text-base sm:text-lg font-bold text-black dark:text-white leading-tight">
                  {currentAlert.title}
                </h3>
              </div>
            </div>

            {/* Close 'X' Button */}
            <button
              type="button"
              onClick={handleClose}
              title="Tutup Modal (Esc)"
              className="text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Modal Body / Message Content */}
        <div className="p-5 sm:p-6 max-h-[65vh] overflow-y-auto space-y-4 text-xs sm:text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed font-normal">
          
          {/* Banner Image (if available) */}
          {currentAlert.image_url && (
            <div className="relative rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 shadow-2xs">
              <img
                src={currentAlert.image_url}
                alt={currentAlert.title}
                className="w-full h-auto max-h-72 object-contain mx-auto bg-black/5 dark:bg-white/5"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
          )}

          <div className="whitespace-pre-line bg-black/[0.02] dark:bg-white/[0.02] p-4 rounded-lg border border-black/10 dark:border-white/10 font-sans">
            {currentAlert.message}
          </div>

          {/* Action Button Link if specified */}
          {currentAlert.action_button_url && (
            <div className="pt-1">
              <a
                href={currentAlert.action_button_url}
                target={currentAlert.action_button_url.startsWith('http') ? '_blank' : '_self'}
                rel="noopener noreferrer"
                onClick={handleClose}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
              >
                <span>{currentAlert.action_button_text || 'Buka Tautan Terkait'}</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Don't show again checkbox */}
          <label className="flex items-center gap-2 text-[11px] text-neutral-600 dark:text-neutral-400 cursor-pointer select-none order-2 sm:order-1">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-black/30 dark:border-white/30 text-black dark:text-white focus:ring-0 cursor-pointer"
            />
            <span>Jangan tampilkan pesan ini lagi</span>
          </label>

          {/* Action Close / Next Button */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end order-1 sm:order-2">
            <button
              type="button"
              onClick={handleClose}
              className="w-full sm:w-auto px-5 py-2 rounded-md bg-black text-white dark:bg-white dark:text-black font-bold text-xs hover:bg-black/90 dark:hover:bg-white/90 transition-all shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>{currentIndex < activeAlerts.length - 1 ? 'Lanjut ke Pemberitahuan Berikutnya' : 'Saya Mengerti'}</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
