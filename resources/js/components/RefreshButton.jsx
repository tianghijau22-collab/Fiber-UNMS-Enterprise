import React from 'react';

const IconRefresh = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

export default function RefreshButton({ isRefreshing, onRefresh, lastUpdatedText = null, label = "Segarkan Data", className = "" }) {
  return (
    <button
      type="button"
      onClick={() => onRefresh && onRefresh(true)}
      disabled={isRefreshing}
      title="Perbarui data dari server secara instan"
      className={`px-3.5 py-2.5 bg-white dark:bg-black hover:bg-black/5 dark:hover:bg-white/10 text-black dark:text-white text-xs font-semibold rounded-md border border-black/70 dark:border-white/70 hover:border-black dark:hover:border-white shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 ${className}`}
    >
      <span className={`text-indigo-600 dark:text-indigo-400 ${isRefreshing ? 'animate-spin' : ''}`}>
        <IconRefresh />
      </span>
      <span className="truncate">{isRefreshing ? 'Memperbarui...' : label}</span>
      {lastUpdatedText && (
        <span className="hidden lg:inline text-[10px] text-black/60 dark:text-white/60 font-normal">
          • {lastUpdatedText}
        </span>
      )}
    </button>
  );
}
