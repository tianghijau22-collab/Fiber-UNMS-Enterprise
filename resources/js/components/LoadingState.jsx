import React from 'react';
import FonaBrandLogo from './FonaBrandLogo.jsx';

/**
 * Standardized Modern Enterprise FONA Loading Component
 * Minimalist, High-Tech, High-Contrast Monochrome with Laser Optical Pulse
 * Fully compliant with DESIGN_SYSTEM_STANDARDS.md
 */
export default function LoadingState({
  title = 'Memuat Data...',
  description = 'Menyinkronkan data jaringan fiber optik...',
  type = 'card', // 'card' | 'table' | 'full' | 'inline'
  rows = 5,
  className = '',
}) {
  // ── 1. Inline Loader (Compact for buttons/modals) ─────────────────────────
  if (type === 'inline') {
    return (
      <div className={`flex items-center justify-center gap-2.5 py-3 text-xs font-semibold text-black dark:text-white select-none ${className}`}>
        <div className="relative w-4 h-4 shrink-0">
          <div className="w-4 h-4 rounded-full border-2 border-black/15 dark:border-white/20"></div>
          <div className="absolute inset-0 w-4 h-4 rounded-full border-2 border-transparent border-t-cyan-500 animate-spin"></div>
        </div>
        <span className="font-mono text-xs text-black/80 dark:text-white/80">{title}</span>
      </div>
    );
  }

  // ── 2. Table / List Skeleton Loader (High-Fidelity Shimmer Wave) ──────────
  if (type === 'table') {
    return (
      <div className={`w-full bg-white dark:bg-black rounded-lg border border-black/70 dark:border-white/70 overflow-hidden shadow-xs animate-in fade-in duration-200 ${className}`}>
        {/* Laser conduit top bar */}
        <div className="h-0.5 w-full bg-black/10 dark:bg-white/10 relative overflow-hidden">
          <div className="absolute inset-y-0 w-2/5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent animate-laser-sweep"></div>
        </div>

        {/* Table Header Bar */}
        <div className="px-4 sm:px-5 py-3 border-b border-black/10 dark:border-white/10 flex items-center justify-between bg-black/[0.02] dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="relative w-4 h-4 flex items-center justify-center shrink-0">
              <div className="w-4 h-4 rounded-full border-2 border-black/15 dark:border-white/20"></div>
              <div className="absolute inset-0 w-4 h-4 rounded-full border-2 border-transparent border-t-cyan-500 animate-spin"></div>
            </div>
            <div>
              <h4 className="text-xs font-bold text-black dark:text-white tracking-tight flex items-center gap-2">
                <span>{title}</span>
              </h4>
              {description && (
                <p className="text-[11px] text-black/60 dark:text-white/60">{description}</p>
              )}
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-[10px] font-mono font-semibold text-black/60 dark:text-white/60">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
            <span>TELEMETRY SYNC</span>
          </div>
        </div>

        {/* High-Fidelity Skeleton Rows with Shimmer Wave */}
        <div className="divide-y divide-black/10 dark:divide-white/10">
          {Array.from({ length: rows }).map((_, idx) => (
            <div key={idx} className="p-3.5 sm:p-4 flex items-center justify-between gap-4 skeleton-shimmer">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-md bg-black/10 dark:bg-white/10 shrink-0"></div>
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div
                    className="h-3 bg-black/15 dark:bg-white/15 rounded"
                    style={{ width: `${Math.max(25, 45 - (idx * 5) % 20)}%` }}
                  ></div>
                  <div
                    className="h-2 bg-black/10 dark:bg-white/10 rounded"
                    style={{ width: `${Math.max(35, 60 - (idx * 7) % 30)}%` }}
                  ></div>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-4 shrink-0">
                <div className="h-3 bg-black/10 dark:bg-white/10 rounded w-20"></div>
                <div className="h-3 bg-black/10 dark:bg-white/10 rounded w-16"></div>
              </div>
              <div className="w-14 sm:w-20 h-6 bg-black/10 dark:bg-white/10 rounded-md shrink-0"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── 3. Full Page Loader (Page Transitions & Route Suspense) ───────────────
  if (type === 'full') {
    return (
      <div className={`min-h-[65vh] w-full flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-300 ${className}`}>
        {/* Modern Floating Brand Emblem */}
        <div className="relative flex items-center justify-center mb-6">
          {/* Ambient Soft Optical Glow */}
          <div className="absolute w-28 h-28 rounded-full bg-cyan-500/10 dark:bg-cyan-400/10 blur-xl pointer-events-none"></div>

          {/* Central Emblem Box with Precision Orbit */}
          <div className="relative w-16 h-16 rounded-2xl bg-white dark:bg-black border border-black/70 dark:border-white/70 p-3 shadow-xs flex items-center justify-center">
            {/* Spinning Laser Halo Track */}
            <div className="absolute -inset-2.5 rounded-[22px] border border-black/10 dark:border-white/10 pointer-events-none"></div>
            <div
              className="absolute -inset-2.5 rounded-[22px] border-2 border-transparent border-t-cyan-500 border-r-cyan-500/40 animate-spin pointer-events-none"
              style={{ animationDuration: '2s' }}
            ></div>

            {/* FONA Icon */}
            <FonaBrandLogo variant="icon" className="w-full h-full object-contain" />
          </div>
        </div>

        {/* Typographic Status */}
        <div className="space-y-1.5 max-w-sm mb-5">
          <h3 className="text-sm font-bold text-black dark:text-white tracking-tight">
            {title}
          </h3>
          {description && (
            <p className="text-xs text-black/60 dark:text-white/60 leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {/* Ultra-Sleek Laser Progress Beam */}
        <div className="w-52 sm:w-60 h-1 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden relative mb-4">
          <div className="absolute inset-y-0 w-2/5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent animate-laser-sweep rounded-full"></div>
        </div>

        {/* Telemetry Micro-Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-[10px] font-mono font-semibold text-black/70 dark:text-white/70">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
          </span>
          <span className="tracking-wider">FONA OPTICAL ENGINE</span>
        </div>
      </div>
    );
  }

  // ── 4. Card Loader (Default for modules, widgets, dashboard) ──────────────
  return (
    <div className={`bg-white dark:bg-black rounded-lg border border-black/70 dark:border-white/70 p-8 sm:p-10 text-center flex flex-col items-center justify-center space-y-4 shadow-xs animate-in fade-in duration-200 select-none ${className}`}>
      {/* Precision Orbital Ring Spinner */}
      <div className="relative flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-black/10 dark:border-white/10"></div>
        <div
          className="absolute inset-0 w-10 h-10 rounded-full border-2 border-transparent border-t-cyan-500 border-r-cyan-500/50 animate-spin"
          style={{ animationDuration: '0.9s' }}
        ></div>
        <div className="absolute w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></div>
      </div>

      <div className="space-y-1 max-w-sm">
        <h4 className="text-xs sm:text-sm font-bold text-black dark:text-white tracking-tight">
          {title}
        </h4>
        {description && (
          <p className="text-[11px] sm:text-xs text-black/60 dark:text-white/60 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {/* Micro progress laser line */}
      <div className="w-36 h-0.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden relative">
        <div className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-cyan-500 to-transparent animate-laser-sweep rounded-full"></div>
      </div>
    </div>
  );
}
