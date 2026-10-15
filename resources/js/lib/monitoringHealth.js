const labels = {
  RUNNING: ['Layanan berjalan', 'good'], STOPPED: ['Layanan berhenti', 'bad'], PAUSED: ['Pengambilan dijeda', 'warning'],
  AVAILABLE: ['Interface tersedia', 'warning'], DISCONNECTED: ['VPN terputus', 'bad'],
  RESPONDING: ['OLT merespons', 'good'], NO_RESPONSE: ['SNMP tidak merespons', 'bad'],
  PATH_UNAVAILABLE: ['Jalur tidak tersedia', 'bad'], NOT_LIVE: ['Mode non-live', 'warning'],
  SUCCESS: ['Pembacaan lengkap', 'good'], PARTIAL: ['Sebagian data tersedia', 'warning'],
  FAILED: ['Pembacaan gagal', 'bad'], IN_PROGRESS: ['Sedang membaca', 'warning'],
  FRESH: ['Sampel terkini', 'good'], STALE: ['Data kedaluwarsa', 'warning'], UNAVAILABLE: ['Data belum tersedia', 'warning'],
  RECENT_PACKET: ['Paket pernah diterima', 'warning'], UNVERIFIED: ['Belum terverifikasi', 'warning'],
  UNKNOWN: ['Belum terverifikasi', 'warning'],
};
export function healthStatus(status) { const [label, tone] = labels[status] || labels.UNKNOWN; return {label, tone}; }
export function healthTime(value) {
  if (!value) return 'Belum tercatat';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('id-ID', {timeZone:'Asia/Jakarta'}) : 'Belum tercatat';
}
