import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * ConfirmDialog — Modal Konfirmasi Tengah Layar dengan Animasi Pegas Modern.
 */
export default function ConfirmDialog({
  isOpen,
  title = 'Konfirmasi Tindakan',
  message = 'Apakah Anda yakin ingin melanjutkan tindakan ini?',
  confirmText = 'Ya, Lanjutkan',
  cancelText = 'Batal',
  type = 'danger',
  loading = false,
  onConfirm,
  onClose,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape' && onClose) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const styleMap = {
    danger: {
      bgIcon: 'bg-rose-500/10 text-rose-500 border-rose-500/30',
      ringColor: 'ring-8 ring-rose-500/15',
      glow: 'shadow-[0_25px_60px_-15px_rgba(244,63,94,0.35)]',
      border: 'border-rose-500/30 dark:border-rose-500/20',
      btnConfirm: 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white shadow-rose-600/25',
      icon: (
        <svg className="w-10 h-10 animate-alert-icon-bounce text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      ),
    },
    warning: {
      bgIcon: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
      ringColor: 'ring-8 ring-amber-500/15',
      glow: 'shadow-[0_25px_60px_-15px_rgba(245,158,11,0.35)]',
      border: 'border-amber-500/30 dark:border-amber-500/20',
      btnConfirm: 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-amber-500/25',
      icon: (
        <svg className="w-10 h-10 animate-alert-icon-bounce text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
    },
    info: {
      bgIcon: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
      ringColor: 'ring-8 ring-blue-500/15',
      glow: 'shadow-[0_25px_60px_-15px_rgba(59,130,246,0.35)]',
      border: 'border-blue-500/30 dark:border-blue-500/20',
      btnConfirm: 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/25',
      icon: (
        <svg className="w-10 h-10 animate-alert-icon-bounce text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      ),
    },
    success: {
      bgIcon: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
      ringColor: 'ring-8 ring-emerald-500/15',
      glow: 'shadow-[0_25px_60px_-15px_rgba(16,185,129,0.35)]',
      border: 'border-emerald-500/30 dark:border-emerald-500/20',
      btnConfirm: 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-500/25',
      icon: (
        <svg className="w-10 h-10 animate-alert-icon-bounce text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ),
    },
  };

  const st = styleMap[type] || styleMap.danger;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/75 dark:bg-black/85 backdrop-blur-sm z-[999999] flex items-center justify-center p-4 transition-opacity duration-300"
      onClick={onClose}
    >
      <div
        className={`bg-white dark:bg-[#0c0c0e] border ${st.border} rounded-3xl w-full max-w-sm sm:max-w-md p-6 sm:p-7 shadow-2xl ${st.glow} animate-alert-modal-in flex flex-col items-center text-center relative overflow-hidden`}
        onClick={e => e.stopPropagation()}
      >
        {/* Animated Circular Icon Badge */}
        <div className={`w-20 h-20 rounded-full flex items-center justify-center border ${st.bgIcon} ${st.ringColor} mb-4.5 transition-transform`}>
          {st.icon}
        </div>

        {/* Title */}
        <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight leading-snug">
          {title}
        </h3>

        {/* Message */}
        {message && (
          <div className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed max-w-xs sm:max-w-sm">
            {message}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-center gap-2.5 w-full">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-neutral-700 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
          >
            {cancelText}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`flex-1 py-2.5 px-4 rounded-xl font-black text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95 ${st.btnConfirm}`}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>{confirmText}</span>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
