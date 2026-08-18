import React from 'react';
import { createPortal } from 'react-dom';

/**
 * ConfirmDialog — UI Modal Konfirmasi pengganti window.confirm browser.
 *
 * Props:
 * - isOpen: boolean
 * - title: string (Judul dialog)
 * - message: string / ReactNode (Pesan penjelas)
 * - confirmText: string (Label tombol eksekusi, default: 'Ya, Lanjutkan')
 * - cancelText: string (Label tombol batal, default: 'Batal')
 * - type: 'danger' | 'warning' | 'info' (Tipe warna & ikon)
 * - loading: boolean (State loading saat mengeksekusi)
 * - onConfirm: () => void
 * - onClose: () => void
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
  if (!isOpen) return null;

  const styleMap = {
    danger: {
      bgIcon: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800',
      btnConfirm: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20',
      glow: 'shadow-rose-500/10',
      icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      ),
    },
    warning: {
      bgIcon: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
      btnConfirm: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20',
      glow: 'shadow-amber-500/10',
      icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    info: {
      bgIcon: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
      btnConfirm: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20',
      glow: 'shadow-indigo-500/10',
      icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  };

  const st = styleMap[type] || styleMap.danger;

  return createPortal(
    <div className="fixed inset-0 bg-slate-950/75 dark:bg-slate-950/85 backdrop-blur-xs z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl ${st.glow} transform transition-all animate-in zoom-in-95 duration-200 space-y-5`}
        onClick={e => e.stopPropagation()}>
        
        {/* Icon & Title */}
        <div className="flex items-start space-x-4">
          <div className={`p-3 rounded-2xl border flex-shrink-0 ${st.bgIcon}`}>
            {st.icon}
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 leading-snug">
              {title}
            </h3>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              {message}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50">
            {cancelText}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center space-x-2 disabled:opacity-50 ${st.btnConfirm}`}>
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Memproses...</span>
              </>
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
