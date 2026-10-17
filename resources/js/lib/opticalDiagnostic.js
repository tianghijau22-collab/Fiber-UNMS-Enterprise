import {onuPresentation} from './onuTelemetry.js';
export function opticalResponseMatches(data, oltId, serial) {
  return Number(oltId)>0 && Number(data?.olt?.id)===Number(oltId)
    && typeof data?.serial_number==='string' && data.serial_number.trim().toUpperCase()===String(serial || '').trim().toUpperCase();
}
const messages = {
  stored_sample: 'Data tersimpan diperbarui otomatis. Waktu di bawah mengikuti sampel perangkat.',
  olt_busy: 'OLT sedang dibaca oleh proses lain. Data tersimpan mempertahankan waktu aslinya; coba lagi setelah pembacaan selesai.',
  read_coordination_unavailable: 'Antrean pembacaan OLT belum tersedia. Data tersimpan mempertahankan waktu aslinya.',
  unsupported_device: 'Diagnostik langsung belum tersedia untuk perangkat ini.',
  identity_conflict: 'Lokasi ONU bertentangan. Identitas perlu diperiksa.',
  invalid_tuple: 'Interface dan nomor ONU belum valid.',
  tuple_mismatch: 'Lokasi ONU berubah atau tidak sesuai. Muat ulang daftar perangkat.',
  identity_mismatch: 'Serial pada lokasi tersebut berbeda. Data perangkat tidak digunakan.',
  identity_unconfirmed: 'Identitas ONU belum berhasil dikonfirmasi.',
  identity_unresolved: 'Interface dan nomor ONU belum terverifikasi.',
  point_incomplete: 'Pembacaan langsung belum lengkap. Periksa sumber dan waktu data tersimpan.',
  state_unavailable: 'Identitas terkonfirmasi, tetapi status ONU belum tersedia.',
  rx_unavailable: 'Redaman N/A. Status tampilan Offline sesuai aturan monitoring.',
};
export function opticalDiagnostic(data, now = Date.now()) {
  const d = data || {}, at = Date.parse(d.sampled_at);
  const fresh = Number.isFinite(at) && at <= now + 5000 && at >= now - 180000;
  const identityAt = Date.parse(d.identity_observed_at);
  const valid = d.telemetry_contract === 1 && d.identity_status === 'resolved'
    && Number.isFinite(identityAt) && identityAt <= now + 5000 && identityAt >= now - 600000;
  const online = valid && fresh && typeof d.is_online === 'boolean' ? d.is_online : null;
  const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
  const raw = finite(d.rx_power);
  const rx = online === true && d.rx_available === true && raw !== null && raw > -40 && raw <= 10 ? raw : null;
  const value = {...d, telemetry_contract:d.telemetry_contract===1 ? 1:0, identity_status:valid ? 'resolved':'unresolved', is_online:online, rx_power:rx, rx_available:rx !== null,
    telemetry_freshness:!fresh && Number.isFinite(at) ? 'stale':d.telemetry_freshness};
  const presentation = onuPresentation(value);
  const quality = presentation.online === false ? 'offline':presentation.online === null || rx === null ? 'unknown':rx < -27 ? 'critical':rx < -24 ? 'warning':'good';
  const sensor = field => online === true && d.telemetry_source === 'snmp_point' ? finite(d[field]):null;
  return {...presentation, quality, identityValid:valid, sourceLabel:d.telemetry_source === 'snmp_point' ? 'Pembacaan langsung'
    :d.telemetry_source === 'snapshot' ? 'Data tersimpan':'Data belum tersedia',message:messages[d.probe_reason] || null,
    tx:sensor('tx_power_dbm'),oltRx:sensor('olt_rx_power_dbm'),voltage:sensor('voltage_v'),bias:sensor('bias_current_ma'),temperature:sensor('temperature_c')};
}
