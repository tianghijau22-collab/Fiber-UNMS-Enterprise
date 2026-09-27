import React from 'react';

/**
 * Standardized High-Contrast Loading State Component
 * Conforms to docs/UI-UX/DESIGN_SYSTEM_STANDARDS.md (Pure Black / Pure White, Zero-Emoji)
 */
export default function LoadingState({
  title = 'Memuat Data...',
  description = 'Sedang menyinkronkan data dengan sistem...',
  type = 'card', // 'card' | 'table' | 'full' | 'inline'
  rows = 5,
  className = '',
}) {
  if (type === 'inline') {
    return (
      <div className={`flex items-center justify-center gap-2.5 py-4 text-xs font-semibold text-black dark:text-white ${className}`}>
        <div className="w-4 h-4 border-2 border-indigo-600 dark:border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
        <span>{title}</span>
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className={`w-full bg-white dark:bg-black rounded-lg border border-black/70 dark:border-white/70 overflow-hidden shadow-xs animate-in fade-in duration-200 ${className}`}>
        {/* Loading Header Indicator */}
        <div className="px-5 py-4 border-b border-black/20 dark:border-white/20 flex items-center justify-between bg-black/5 dark:bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-indigo-600 dark:border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
            <div>
              <h4 className="text-xs font-bold text-black dark:text-white uppercase tracking-wider">{title}</h4>
              <p className="text-[11px] text-black/60 dark:text-white/60">{description}</p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 animate-pulse">
            LOADING
          </span>
        </div>

        {/* Skeleton Rows */}
        <div className="divide-y divide-black/10 dark:divide-white/10">
          {Array.from({ length: rows }).map((_, idx) => (
            <div key={idx} className="p-4 flex items-center justify-between gap-4 animate-pulse">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-md bg-black/10 dark:bg-white/10 shrink-0"></div>
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="h-3.5 bg-black/15 dark:bg-white/15 rounded w-1/3"></div>
                  <div className="h-2.5 bg-black/10 dark:bg-white/10 rounded w-1/2"></div>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-3">
                <div className="h-4 bg-black/10 dark:bg-white/10 rounded w-20"></div>
                <div className="h-4 bg-black/10 dark:bg-white/10 rounded w-16"></div>
              </div>
              <div className="w-16 h-6 bg-black/10 dark:bg-white/10 rounded-md shrink-0"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'full') {
    return (
      <div className={`min-h-[50vh] flex flex-col items-center justify-center p-8 text-center space-y-4 animate-in fade-in duration-200 ${className}`}>
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-3 border-black/20 dark:border-white/20 border-t-indigo-600 dark:border-t-indigo-400 animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-ping"></span>
          </div>
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-black dark:text-white uppercase tracking-wider">{title}</h4>
          <p className="text-xs text-black/60 dark:text-white/60 max-w-sm">{description}</p>
        </div>
      </div>
    );
  }

  // Default 'card' view
  return (
    <div className={`bg-white dark:bg-black rounded-lg border border-black/70 dark:border-white/70 p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-3.5 shadow-xs animate-in fade-in duration-200 ${className}`}>
      <div className="relative">
        <div className="w-10 h-10 border-3 border-black/20 dark:border-white/20 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-ping"></span>
        </div>
      </div>
      <div className="space-y-1">
        <h4 className="text-xs sm:text-sm font-bold text-black dark:text-white uppercase tracking-wider">{title}</h4>
        <p className="text-[11px] sm:text-xs text-black/60 dark:text-white/60">{description}</p>
      </div>
    </div>
  );
}
