import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook untuk Auto-Refresh Data di seluruh halaman UNMS
 * 1. Otomatis re-fetch HANYA saat ada aksi CRUD di sistem (event 'unms:data-mutated')
 * 2. Tidak melakukan polling interval agresif agar tidak merusak posisi scroll / pencarian user
 * 3. Pembaruan data terjadi secara 'silent' (in-place) tanpa memunculkan layar loading berkedip
 * 4. Menyediakan tombol manual 'triggerRefresh' jika pengguna ingin sinkronisasi manual
 */
export function useAutoRefresh(refreshFn, {
  enablePolling = false,
  intervalMs = 5000,
  scope = null,
  shouldPause = false,
} = {}) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const refreshFnRef = useRef(refreshFn);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    refreshFnRef.current = refreshFn;
  }, [refreshFn]);

  const triggerRefresh = useCallback(async (showLoading = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (showLoading) setIsRefreshing(true);

    try {
      if (refreshFnRef.current) {
        // Panggil fungsi refresh dengan parameter silent = true agar tidak mereset state loading tabel
        await refreshFnRef.current(true);
      }
      setLastUpdated(new Date());
    } catch (e) {
      console.warn('AutoRefresh error:', e);
    } finally {
      isFetchingRef.current = false;
      if (showLoading) {
        setTimeout(() => setIsRefreshing(false), 300);
      }
    }
  }, []);

  // 1. Dengarkan event mutasi global (HANYA berjalan saat ada aksi CRUD POST/PUT/DELETE)
  useEffect(() => {
    let debounceTimer = null;
    const handleMutation = (e) => {
      const detail = e?.detail;
      // Jika ada filter scope URL
      if (scope && detail?.url && !detail.url.includes(scope)) {
        return;
      }
      // Debounce sedikit agar tidak multiple re-fetch jika terjadi batch mutation
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        triggerRefresh(false);
      }, 200);
    };

    window.addEventListener('unms:data-mutated', handleMutation);

    return () => {
      window.removeEventListener('unms:data-mutated', handleMutation);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [triggerRefresh, scope]);

  // 2. Continuous Silent Polling (Default 5 detik jika enablePolling: true)
  useEffect(() => {
    if (!enablePolling || intervalMs <= 0) return;

    let timer = null;

    const runPoll = () => {
      // Jangan poll jika tab browser tidak terlihat atau sedang dijeda (misal modal form terbuka)
      if (document.hidden || shouldPause) return;
      triggerRefresh(false);
    };

    timer = setInterval(runPoll, intervalMs);

    // Langsung refresh saat user kembali membuka tab browser aktif
    const handleVisibilityChange = () => {
      if (!document.hidden && !shouldPause) {
        triggerRefresh(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enablePolling, intervalMs, shouldPause, triggerRefresh]);

  return {
    isRefreshing,
    lastUpdated,
    triggerRefresh,
    timeAgoText: formatTimeAgo(lastUpdated),
  };
}

function formatTimeAgo(date) {
  if (!date) return 'Baru saja';
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 5) return 'Baru saja';
  if (diffSec < 60) return `${diffSec} detik lalu`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} mnt lalu`;
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
