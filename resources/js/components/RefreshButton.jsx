import React from 'react';

const IconRefresh = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

export default function RefreshButton({ isRefreshing, onRefresh, lastUpdatedText = null, label = "Segarkan Data" }) {
  return (
    <button
      type="button"
      onClick={() => onRefresh && onRefresh(true)}
      disabled={isRefreshing}
      title="Perbarui data dari server secara instan"
      className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs transition-all flex items-center gap-2 disabled:opacity-60"
    >
      <span className={`text-indigo-600 dark:text-indigo-400 ${isRefreshing ? 'animate-spin' : ''}`}>
        <IconRefresh />
      </span>
      <span>{isRefreshing ? 'Memperbarui...' : label}</span>
      {lastUpdatedText && (
        <span className="hidden sm:inline text-[10px] text-slate-400 dark:text-slate-500 font-normal">
          • {lastUpdatedText}
        </span>
      )}
    </button>
  );
}
