import React from 'react';
import FonaBrandLogo from './FonaBrandLogo.jsx';

/**
 * Standardized High-Tech FONA Fiber-Optic Loading Component
 * Fully compliant with DESIGN_SYSTEM_STANDARDS.md
 * Features:
 * - Optical waveguide pulse loader
 * - Laser fiber beam shimmer
 * - Real-time optical telemetry indicators
 * - 100% Monochrome Baseline (Pure White #ffffff / Pitch Black #000000)
 */
export default function LoadingState({
  title = 'Memuat Data...',
  description = 'Menyinkronkan data jaringan fiber optik...',
  type = 'card', // 'card' | 'table' | 'full' | 'inline'
  rows = 5,
  className = '',
}) {
  if (type === 'inline') {
    return (
      <div className={`flex items-center justify-center gap-2.5 py-4 text-xs font-semibold text-black dark:text-white ${className}`}>
        <div className="relative w-4 h-4">
          <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20"></div>
          <div className="absolute inset-0 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin"></div>
          <div className="absolute inset-1 rounded-full bg-cyan-400 animate-ping opacity-75"></div>
        </div>
        <span className="font-mono">{title}</span>
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className={`w-full bg-white dark:bg-black rounded-lg border border-black/70 dark:border-white/70 overflow-hidden shadow-xs animate-in fade-in duration-200 ${className}`}>
        {/* Loading Header Indicator with Laser Waveguide */}
        <div className="px-5 py-3.5 border-b border-black/20 dark:border-white/20 flex items-center justify-between bg-black/5 dark:bg-white/5 relative overflow-hidden">
          {/* Laser conduit top bar */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent animate-pulse"></div>

          <div className="flex items-center gap-3">
            <div className="relative w-5 h-5 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-cyan-500/30"></div>
              <div className="absolute inset-0 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin"></div>
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
            </div>
            <div>
              <h4 className="text-xs font-bold text-black dark:text-white uppercase tracking-wider flex items-center gap-2">
                <span>{title}</span>
              </h4>
              <p className="text-[11px] text-black/60 dark:text-white/60">{description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping"></span>
            <span className="text-[10px] font-mono font-bold text-cyan-700 dark:text-cyan-300 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30">
              TELEMETRY SYNC
            </span>
          </div>
        </div>

        {/* Skeleton Rows */}
        <div className="divide-y divide-black/10 dark:divide-white/10">
          {Array.from({ length: rows }).map((_, idx) => (
            <div key={idx} className="p-4 flex items-center justify-between gap-4 animate-pulse">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-md bg-black/10 dark:bg-white/10 shrink-0"></div>
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="h-3 bg-black/15 dark:bg-white/15 rounded w-1/3"></div>
                  <div className="h-2 bg-black/10 dark:bg-white/10 rounded w-1/2"></div>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-3">
                <div className="h-3.5 bg-black/10 dark:bg-white/10 rounded w-20"></div>
                <div className="h-3.5 bg-black/10 dark:bg-white/10 rounded w-16"></div>
              </div>
              <div className="w-16 h-5 bg-black/10 dark:bg-white/10 rounded-md shrink-0"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'full') {
    return (
      <div className={`min-h-[60vh] flex flex-col items-center justify-center p-8 text-center space-y-6 animate-in fade-in duration-300 ${className}`}>
        {/* Futuristic Fiber Optic Core Pulse Animation */}
        <div className="relative flex items-center justify-center">
          {/* Outer Pulsing Waveguide Rings */}
          <div className="absolute w-28 h-28 rounded-full border border-cyan-500/20 dark:border-cyan-400/20 animate-ping opacity-40"></div>
          <div className="absolute w-24 h-24 rounded-full border border-cyan-500/30 dark:border-cyan-400/30 animate-spin" style={{ animationDuration: '6s' }}></div>
          <div className="absolute w-20 h-20 rounded-full border border-dashed border-blue-500/40 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '4s' }}></div>
          
          {/* Center Brand Orb with Glowing Backlight */}
          <div className="relative w-16 h-16 rounded-2xl bg-white dark:bg-black border border-black/70 dark:border-white/70 flex items-center justify-center p-2.5 shadow-2xl shadow-cyan-500/20">
            <FonaBrandLogo variant="icon" className="w-full h-full" />
          </div>
        </div>

        {/* Brand Text & Status */}
        <div className="space-y-2 max-w-sm">
          <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-0.5 rounded text-[10px] font-mono font-bold text-cyan-700 dark:text-cyan-300">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
            <span>OPTICAL CORE LINK</span>
          </div>

          <h4 className="text-sm font-bold text-black dark:text-white uppercase tracking-wider">{title}</h4>
          <p className="text-xs text-black/60 dark:text-white/60 leading-relaxed">{description}</p>
        </div>

        {/* Laser Conduit Progress Bar */}
        <div className="w-48 h-1 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden relative">
          <div className="h-full bg-gradient-to-r from-transparent via-cyan-500 to-transparent w-full animate-pulse"></div>
        </div>
      </div>
    );
  }

  // Default 'card' view
  return (
    <div className={`bg-white dark:bg-black rounded-lg border border-black/70 dark:border-white/70 p-8 text-center flex flex-col items-center justify-center space-y-4 shadow-xs animate-in fade-in duration-200 ${className}`}>
      {/* Fiber Core Pulse */}
      <div className="relative flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-cyan-500/20 dark:border-cyan-400/20 animate-ping opacity-50"></div>
        <div className="absolute w-10 h-10 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin"></div>
        <div className="absolute w-6 h-6 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-center p-1 border border-cyan-500/30">
          <FonaBrandLogo variant="icon" className="w-full h-full" />
        </div>
      </div>

      <div className="space-y-1">
        <h4 className="text-xs sm:text-sm font-bold text-black dark:text-white uppercase tracking-wider">{title}</h4>
        <p className="text-[11px] sm:text-xs text-black/60 dark:text-white/60">{description}</p>
      </div>
    </div>
  );
}
