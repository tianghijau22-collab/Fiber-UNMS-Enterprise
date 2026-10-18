export async function loadOdpPortDetail(odpId, live = false, fetcher = fetch, signal) {
  const response = await fetcher(`/api/network-nodes/${encodeURIComponent(odpId)}/port-detail${live ? '?live=1' : '?skip_live=1'}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Akses detail port ditolak. Periksa sesi login dan hak akses Anda.');
    }
    throw new Error('Detail port gagal dimuat. Coba lagi beberapa saat.');
  }
  const data = await response.json();
  if (!data || !Array.isArray(data.ports) || String(data.node?.id) !== String(odpId)) {
    throw new Error('Respons detail port tidak valid. Coba lagi beberapa saat.');
  }
  return data;
}

export function waitForOdpRetry(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    const aborted = () => { clearTimeout(timer); signal?.removeEventListener('abort', aborted); reject(signal?.reason || new DOMException('Dibatalkan', 'AbortError')); };
    if (signal?.aborted) { reject(signal.reason || new DOMException('Dibatalkan', 'AbortError')); return; }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', aborted); resolve(); }, milliseconds);
    signal?.addEventListener('abort', aborted, {once:true});
  });
}

// Only an explicit manual refresh retries contention. Stored refreshes never use this path.
export async function refreshOdpPortDetail(odpId, {
  fetcher = fetch, signal, onStored = () => {}, onWaiting = () => {},
  wait = waitForOdpRetry, now = Date.now, random = Math.random,
} = {}) {
  const deadline = now() + 30000;
  // Short, jittered gaps can catch the brief free window between background reads.
  const delays = Array(14).fill(2000);
  for (let attempt = 0; ; attempt++) {
    if (signal?.aborted) throw signal.reason || new DOMException('Dibatalkan', 'AbortError');
    const data = await loadOdpPortDetail(odpId, true, fetcher, signal);
    if (signal?.aborted) throw signal.reason || new DOMException('Dibatalkan', 'AbortError');
    if (data.live_probe?.success !== false || data.live_probe?.reason_code !== 'olt_busy') return data;
    onStored(data);
    const delay = attempt < delays.length ? delays[attempt] + Math.floor(random() * 250) : 0;
    if (attempt >= delays.length || now() + delay >= deadline) {
      return {...data, live_probe:{...data.live_probe, retry_exhausted:true,
        reason:'OLT masih digunakan proses lain. Batas menunggu refresh selesai; data tersimpan tetap ditampilkan. Coba lagi beberapa saat.'}};
    }
    onWaiting({attempt:attempt + 2, maxAttempts:delays.length + 1, waitMs:delay});
    await wait(delay, signal);
  }
}
