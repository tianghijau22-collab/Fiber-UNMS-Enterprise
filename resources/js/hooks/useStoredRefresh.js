import { useEffect, useRef } from 'react';
import { startStoredPolling } from '../lib/storedPolling.js';

export function useStoredRefresh(read, { enabled = true, intervalMs = 10000, target = '', immediate = false } = {}) {
  const latest = useRef(read);
  latest.current = read;
  useEffect(() => {
    if (!enabled) return;
    return startStoredPolling(signal => latest.current(signal), { intervalMs, immediate });
  }, [enabled, intervalMs, target, immediate]);
}
