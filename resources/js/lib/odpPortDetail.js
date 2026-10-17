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
