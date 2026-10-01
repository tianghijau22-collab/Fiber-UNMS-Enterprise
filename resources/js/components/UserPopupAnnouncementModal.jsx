import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from './AuthContext.jsx';

/**
 * UserPopupAnnouncementModal — Pop-up Pengumuman Bersih, Minimalis & Profesional.
 * Fokus pada tipografi elegan, keterbacaan tinggi, tanpa kotak bertumpuk yang berlebihan.
 */
export default function UserPopupAnnouncementModal() {
  const { currentUser } = useAuth();
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [imageLightbox, setImageLightbox] = useState(false);

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
        const unreadAlerts = json.data.filter((alert) => {
          const dismissedKey = `fiber_popup_dismissed_${alert.id}`;
          return !localStorage.getItem(dismissedKey);
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
        if (imageLightbox) {
          setImageLightbox(false);
        } else {
          handleClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, imageLightbox]);

  const currentAlert = activeAlerts[currentIndex];

  const handleClose = () => {
    if (currentAlert && (dontShowAgain || currentAlert.show_once_per_user)) {
      try {
        localStorage.setItem(`fiber_popup_dismissed_${currentAlert.id}`, '1');
      } catch (e) {
        // Ignore storage error
      }
    }

    if (currentIndex < activeAlerts.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setDontShowAgain(false);
    } else {
      setIsOpen(false);
    }
  };

  if (!isOpen || !currentAlert) return null;

  // Type configuration (Badge styling)
  const getTypeBadge = (type) => {
    switch (type) {
      case 'maintenance':
        return {
          label: currentAlert.badge_text || 'Pemeliharaan Jaringan',
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40',
          dotClass: 'bg-amber-500',
          buttonClass: 'bg-amber-600 hover:bg-amber-700 text-white',
        };
      case 'warning':
        return {
          label: currentAlert.badge_text || 'Peringatan Operasional',
          badgeClass: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/40',
          dotClass: 'bg-orange-500',
          buttonClass: 'bg-orange-600 hover:bg-orange-700 text-white',
        };
      case 'critical':
        return {
          label: currentAlert.badge_text || 'Pemberitahuan Darurat',
          badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40',
          dotClass: 'bg-rose-500',
          buttonClass: 'bg-rose-600 hover:bg-rose-700 text-white',
        };
      case 'update':
        return {
          label: currentAlert.badge_text || 'Pembaruan Sistem',
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40',
          dotClass: 'bg-emerald-500',
          buttonClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        };
      case 'info':
      default:
        return {
          label: currentAlert.badge_text || 'Pengumuman Resmi',
          badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40',
          dotClass: 'bg-blue-500',
          buttonClass: 'bg-blue-600 hover:bg-blue-700 text-white',
        };
    }
  };

  const badgeInfo = getTypeBadge(currentAlert.type);

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] overflow-y-auto bg-black/60 backdrop-blur-xs p-4 flex items-center justify-center min-h-screen animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-[#111317] border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150 text-neutral-900 dark:text-neutral-100 my-auto flex flex-col">

        {/* ── 1. Hero Image (Clean, no dark gradient covering it) ── */}
        {currentAlert.image_url ? (
          <div className="relative w-full bg-neutral-100 dark:bg-neutral-900 overflow-hidden border-b border-neutral-100 dark:border-neutral-800">
            <img
              src={currentAlert.image_url}
              alt={currentAlert.title}
              onClick={() => setImageLightbox(true)}
              className="w-full h-auto max-h-64 object-cover object-center cursor-pointer transition-transform duration-200 hover:scale-[1.01]"
              onError={(e) => { e.currentTarget.parentElement.style.display = 'none'; }}
            />
            {/* Minimal Close Button */}
            <button
              type="button"
              onClick={handleClose}
              title="Tutup (Esc)"
              className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/50 hover:bg-black/75 text-white flex items-center justify-center backdrop-blur-xs transition-all shadow-xs cursor-pointer z-10"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : null}

        {/* ── 2. Header (Clean & Refined) ── */}
        <div className="pt-6 px-6 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${badgeInfo.badgeClass}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${badgeInfo.dotClass}`}></span>
                  <span>{badgeInfo.label}</span>
                </span>
                {activeAlerts.length > 1 && (
                  <span className="text-[11px] font-medium text-neutral-400">
                    ({currentIndex + 1} dari {activeAlerts.length})
                  </span>
                )}
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-neutral-50 tracking-tight leading-snug">
                {currentAlert.title}
              </h3>
            </div>

            {/* Close button jika tanpa gambar */}
            {!currentAlert.image_url && (
              <button
                type="button"
                onClick={handleClose}
                title="Tutup (Esc)"
                className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-1 rounded-md transition-colors shrink-0 cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* ── 3. Message Content (Spacious, clean typography, NO nested border box) ── */}
        <div className="px-6 py-4 max-h-[50vh] overflow-y-auto space-y-4">
          <div className="whitespace-pre-line text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed font-sans font-normal">
            {currentAlert.message}
          </div>

          {/* Action Link Button if set */}
          {currentAlert.action_button_url && (
            <div className="pt-2">
              <a
                href={currentAlert.action_button_url}
                target={currentAlert.action_button_url.startsWith('http') ? '_blank' : '_self'}
                rel="noopener noreferrer"
                onClick={handleClose}
                className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg ${badgeInfo.buttonClass} font-medium text-xs sm:text-sm transition-colors shadow-xs cursor-pointer`}
              >
                <span>{currentAlert.action_button_text || 'Lihat Informasi Terkait'}</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </a>
            </div>
          )}
        </div>

        {/* ── 4. Clean Footer ── */}
        <div className="px-6 py-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 flex flex-col sm:flex-row items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 cursor-pointer select-none order-2 sm:order-1 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-700 text-neutral-900 focus:ring-0 cursor-pointer"
            />
            <span>Jangan tampilkan pesan ini lagi</span>
          </label>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end order-1 sm:order-2">
            <button
              type="button"
              onClick={handleClose}
              className="w-full sm:w-auto px-5 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 font-medium text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>{currentIndex < activeAlerts.length - 1 ? 'Pemberitahuan Berikutnya' : 'Saya Mengerti'}</span>
              {currentIndex >= activeAlerts.length - 1 && (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* Lightbox Zoom */}
      {imageLightbox && currentAlert.image_url && createPortal(
        <div
          className="fixed inset-0 z-[100000] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setImageLightbox(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <img
              src={currentAlert.image_url}
              alt="Banner Fullscreen"
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setImageLightbox(false)}
              className="mt-4 px-4 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-medium backdrop-blur-xs transition-colors cursor-pointer"
            >
              ✕ Tutup (Esc)
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>,
    document.body
  );
}
