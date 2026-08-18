import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook untuk Auto-Refresh Data di seluruh halaman UNMS
 * 1. Otomatis re-fetch HANYA saat ada aksi CRUD di sistem (event 'unms:data-mutated')
 * 2. Tidak melakukan polling interval agresif agar tidak merusak posisi scroll / pencarian user
 * 3. Pembaruan data terjadi secara 'silent' (in-place) tanpa memunculkan layar loading berkedip
 * 4. Menyediakan tombol manual 'triggerRefresh' jika pengguna ingin sinkronisasi manual
 */
export function useAutoRefresh(refreshFn, { enablePolling = false, intervalMs = 0, scope = null } = {}) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const refreshFnRef = useRef(refreshFn);

  useEffect(() => {
    refreshFnRef.current = refreshFn;
  }, [refreshFn]);

  const triggerRefresh = useCallback(async (showLoading = false) => {
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
      if (showLoading) {
        setTimeout(() => setIsRefreshing(false), 300);
      }
    }
  }, []);

  useEffect(() => {
    // 1. Dengarkan event mutasi global (HANYA berjalan saat ada aksi CRUD POST/PUT/DELETE)
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
