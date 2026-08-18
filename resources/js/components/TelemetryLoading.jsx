import React from 'react';

/**
 * TelemetryLoading
 * Animasi loading pemindaian data telemetri fiber optik berkecepatan tinggi
 */
export default function TelemetryLoading({ message = 'Memuat Data Telemetri...', rows = 3 }) {
  return (
    <div className="w-full space-y-4 py-6 animate-in fade-in duration-200">
      {/* Header Loading Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {message}
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 animate-pulse">
          SYNCING NODE TELEMETRY...
        </span>
      </div>

      {/* Modern Shimmering Skeleton Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className="p-4 rounded-xl border border-slate-200 dark:border-[#52525b] bg-slate-50/70 dark:bg-neutral-950/70 shimmer-scanning space-y-2.5"
          >
            <div className="h-3 w-1/3 bg-slate-200 dark:bg-neutral-800 rounded" />
            <div className="h-7 w-2/3 bg-slate-300 dark:bg-neutral-700 rounded-lg" />
            <div className="h-2.5 w-1/2 bg-slate-200 dark:bg-neutral-800 rounded" />
          </div>
        ))}
      </div>

      {/* Shimmering Table / List Skeleton */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-[#52525b] bg-slate-50/50 dark:bg-neutral-950/50 shimmer-scanning space-y-3">
        <div className="h-4 w-1/4 bg-slate-300 dark:bg-neutral-700 rounded mb-4" />
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="flex items-center gap-4 py-2 border-b border-slate-100 dark:border-[#1f1f1f] last:border-0">
            <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-neutral-800 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-2/5 bg-slate-200 dark:bg-neutral-800 rounded" />
              <div className="h-2.5 w-1/3 bg-slate-100 dark:bg-neutral-900 rounded" />
            </div>
            <div className="h-6 w-20 bg-slate-200 dark:bg-neutral-800 rounded-lg shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
