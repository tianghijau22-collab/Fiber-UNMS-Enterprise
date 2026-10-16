export const neutralTelemetryColor = 'text-slate-500 dark:text-slate-400';

// Inventory and customer pages share presentation, but inventory carries the original sample fields.
export function inventoryTelemetry(row = {}, now = Date.now()) {
  const at = row.telemetry_sample_version === 2 ? row.sample_observed_at : null;
  const fresh = value => value && Number.isFinite(Date.parse(value)) && Date.parse(value) <= now + 5000 && Date.parse(value) >= now - 180000;
  const sampleFresh = fresh(at);
  const online = sampleFresh && fresh(row.state_observed_at) && typeof row.is_online === 'boolean' ? row.is_online : null;
  const rx = online === true && fresh(row.rx_observed_at) && row.rx_available === true && row.rx_power !== null
    && row.rx_power !== '' && Number.isFinite(Number(row.rx_power)) && Number(row.rx_power) > -40 && Number(row.rx_power) <= 10 ? Number(row.rx_power) : null;
  const identityAt = Date.parse(row.identity_observed_at);
  const identity = row.identity_source === 'snmp_serial_table_v2' && row.onu_id != null && row.port
    && Number.isFinite(identityAt) && identityAt <= now + 5000 && identityAt >= now - 600000;
  return {telemetry_contract:1,identity_status:identity ? 'resolved':'unresolved',gpon_interface:identity ? row.port:null,
    is_online:identity ? online:null,rx_power:identity ? rx:null,rx_available:identity && rx !== null,
    sampled_at:at,telemetry_source:'snapshot',telemetry_freshness:sampleFresh ? 'fresh':at && Number.isFinite(Date.parse(at)) ? 'stale':'unavailable'};
}

export function inventoryMatchesFilter(row, filter, now) {
  const d=onuPresentation(inventoryTelemetry(row,now));
  if(filter==='online')return d.online===true;
  if(filter==='los')return d.online===false;
  if(filter==='unknown')return d.online===null;
  if(filter==='rx_missing')return d.offlineByRx;
  if(['excellent','good','warning','critical','high_loss'].includes(filter)) {
    if(d.rx===null)return false;
    return filter==='excellent' ? d.rx>=-19 : filter==='good' ? d.rx< -19 && d.rx>=-23
      : filter==='warning' ? d.rx< -23 && d.rx>=-27 : d.rx< -27;
  }
  return true;
}

export function inventoryOpticalStats(rows, now) {
  const result={total:rows.length,excellent:0,good:0,warning:0,critical:0,los:0,unknown:0,rxMissing:0,offlineByRx:0};
  for(const row of rows) {
    const d=onuPresentation(inventoryTelemetry(row,now));
    if(d.offlineByRx)result.offlineByRx++;
    const key=d.online===false ? 'los':d.online===null ? 'unknown':d.rx===null ? 'rxMissing'
      :d.rx>=-19 ? 'excellent':d.rx>=-23 ? 'good':d.rx>=-27 ? 'warning':'critical';
    result[key]++;
  }
  for(const key of ['excellent','good','warning','critical','los','unknown','rxMissing'])result[key+'Pct']=rows.length ? Math.round(result[key]/rows.length*100):0;
  return result;
}

export function onuPresentation(value = {}) {
  const current = value.telemetry_contract === 1;
  const hardwareOnline = current && typeof value.is_online === 'boolean' ? value.is_online : null;
  const raw = value.rx_power;
  const rx = hardwareOnline === true && value.rx_available === true && raw !== null && raw !== ''
    && Number.isFinite(Number(raw)) && Number(raw)>-40 && Number(raw)<=10 ? Number(raw) : null;
  // User-selected display policy only. Never replace or write the original OLT state.
  const offlineByRx = current && rx === null && hardwareOnline !== false;
  const online = current ? (hardwareOnline === false || rx === null ? false:true):null;
  const color = online === false ? 'text-rose-600 dark:text-rose-400'
    : online === true ? 'text-emerald-600 dark:text-emerald-400' : neutralTelemetryColor;
  const label = online === true ? 'Online' : online === false ? 'Offline'
    : value.telemetry_freshness === 'stale' ? 'Data lama' : 'Belum terverifikasi';
  const rxLabel = rx === null ? 'N/A' : `${rx.toFixed(2)} dBm`;
  const rxColor = rx === null ? neutralTelemetryColor : rx >= -25
    ? 'text-emerald-600 dark:text-emerald-400' : rx >= -28
      ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';
  const interfaceLabel = current && value.identity_status === 'resolved' && value.gpon_interface
    ? value.gpon_interface : 'Belum terverifikasi';
  const date = value.sampled_at ? new Date(value.sampled_at) : null;
  const stamp = date && Number.isFinite(date.getTime())
    ? `Pembaruan ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}${value.telemetry_source === 'snapshot' ? ' (tersimpan)' : value.telemetry_source === 'snmp_point' ? ' (langsung)' : ''}`
    : 'Waktu data belum tersedia';
  return { online, hardwareOnline, offlineByRx, rx, color, label, rxLabel, rxColor, interfaceLabel, stamp };
}

export function opticalDisplaySummary(rows = [], expectedTotal = rows.length) {
  const views=rows.map(row=>onuPresentation(row));
  const online=views.filter(row=>row.online===true).length;
  const down=views.filter(row=>row.online===false).length;
  return {online_count:online,down_count:down,unknown_count:Math.max(rows.length,expectedTotal)-online-down};
}

export function nodeTelemetryState(node = {}) {
  if (node.telemetry_contract !== 1 || node.node_type !== 'ODP') return null;
  if (Number(node.total_clients) === 0) return 'empty';
  if (Number(node.unknown_clients) > 0) return 'unknown';
  if (node.is_loss_total === true) return 'offline';
  if (Number(node.loss_clients) > 0) return 'partial';
  return 'online';
}
