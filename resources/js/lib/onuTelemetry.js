export const neutralTelemetryColor = 'text-slate-500 dark:text-slate-400';

export function onuPresentation(value = {}) {
  const current = value.telemetry_contract === 1;
  const online = current && typeof value.is_online === 'boolean' ? value.is_online : null;
  const raw = value.rx_power;
  const rx = online === true && value.rx_available === true && raw !== null && raw !== ''
    && Number.isFinite(Number(raw)) ? Number(raw) : null;
  const color = online === false ? 'text-rose-600 dark:text-rose-400'
    : online === true ? 'text-emerald-600 dark:text-emerald-400' : neutralTelemetryColor;
  const label = online === true ? 'Online' : online === false ? 'Offline'
    : value.telemetry_freshness === 'stale' ? 'Data lama' : 'Belum terverifikasi';
  const rxLabel = online === false ? 'Offline' : rx === null ? 'Belum tersedia' : `${rx.toFixed(2)} dBm`;
  const rxColor = rx === null ? neutralTelemetryColor : rx >= -25
    ? 'text-emerald-600 dark:text-emerald-400' : rx >= -28
      ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';
  const interfaceLabel = current && value.identity_status === 'resolved' && value.gpon_interface
    ? value.gpon_interface : 'Belum terverifikasi';
  const date = value.sampled_at ? new Date(value.sampled_at) : null;
  const stamp = date && Number.isFinite(date.getTime())
    ? `Pembaruan ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}${value.telemetry_source === 'snapshot' ? ' (tersimpan)' : value.telemetry_source === 'snmp_point' ? ' (langsung)' : ''}`
    : 'Waktu data belum tersedia';
  return { online, rx, color, label, rxLabel, rxColor, interfaceLabel, stamp };
}

export function nodeTelemetryState(node = {}) {
  if (node.telemetry_contract !== 1 || node.node_type !== 'ODP') return null;
  if (Number(node.total_clients) === 0) return 'empty';
  if (Number(node.unknown_clients) > 0) return 'unknown';
  if (node.is_loss_total === true) return 'offline';
  if (Number(node.loss_clients) > 0) return 'partial';
  return 'online';
}
