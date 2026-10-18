export function gisOpticalState(node = {}, now = Date.now()) {
  const e = node.optical_evidence;
  if (e?.version !== 1 || node.node_type !== 'ODP') return null;
  if (e.state === 'empty' && Number(e.total) === 0) return 'empty';
  const expires = Date.parse(e.valid_until);
  if (!Number.isFinite(expires) || expires < now) return 'unknown';
  if (e.state === 'no_rx' && Number(e.total) > 0 && e.no_rx_clients === e.total && e.unverified_clients === 0 && e.signal_clients === 0) return 'no_rx';
  if (e.state === 'signal' && Number(e.signal_clients) > 0) return 'signal';
  return 'unknown';
}

const measuredPower = value => value !== null && value !== undefined && value !== ''
  && (typeof value === 'number' || (typeof value === 'string' && value.trim() !== ''))
  && Number.isFinite(Number(value)) && Number(value) > -40 && Number(value) <= 10 ? Number(value) : null;

// Display the all-N/A condition without promoting unresolved identities to confirmed outage evidence.
export function gisOdpDisplayState(node = {}, now = Date.now()) {
  const state = gisOpticalState(node, now), e = node.optical_evidence;
  if (state !== 'unknown' || e?.version !== 1 || Date.parse(e.valid_until) < now || !Number.isFinite(Date.parse(e.valid_until))) return state;
  const counts = [e.total, e.signal_clients, e.no_rx_clients, e.unverified_clients];
  if (counts.every(n => Number.isInteger(n) && n >= 0) && e.total > 0 && e.signal_clients === 0 && e.no_rx_clients > 0
    && e.unverified_clients > 0 && e.no_rx_clients + e.unverified_clients === e.total
    && [node.best_rx_power, node.worst_rx_power, node.optical_power_dbm].every(v => measuredPower(v) === null)) return 'no_rx_unverified';
  return state;
}

export function gisOpticalPower(node = {}, now = Date.now()) {
  if (node.optical_evidence?.version === 1 && gisOpticalState(node, now) !== 'signal') return null;
  return measuredPower(node.best_rx_power) ?? measuredPower(node.optical_power_dbm);
}

export function gisOpticalLabel(node = {}, compact = false, now = Date.now()) {
  if (gisOpticalState(node, now) === 'empty' || (node.node_type === 'ODP' && Number(node.total_clients) === 0)) return 'Belum ada pelanggan';
  const best = gisOpticalPower(node, now);
  if (best === null) return 'N/A';
  const worst = measuredPower(node.worst_rx_power) ?? best, digits = compact ? 1 : 2;
  // Explanatory counts in rx_power_range are never optical measurements.
  return best === worst ? `${best.toFixed(digits)} dBm` : `${best.toFixed(digits)} s/d ${worst.toFixed(digits)} dBm`;
}

export function currentGisFaults(diagnostics = {}, nodes = [], now = Date.now()) {
  const byId = new Map(nodes.map(n => [String(n.id), n]));
  return (Array.isArray(diagnostics.faults) ? diagnostics.faults : []).filter(f => {
    const expiry = Date.parse(f.valid_until);
    return Number.isFinite(expiry) && expiry >= now && gisOpticalState(byId.get(String(f.last_signal_node?.id)), now) === 'signal'
      && Array.isArray(f.affected_node_ids) && f.affected_node_ids.length > 0
      && f.affected_node_ids.every(id => gisOpticalState(byId.get(String(id)), now) === 'no_rx');
  });
}

export function faultCoordinates(fault = {}) {
  const point = p => Array.isArray(p) && p.length === 2 && p.every(v => typeof v === 'number' && Number.isFinite(v))
    && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180;
  const route = Array.isArray(fault.route_coordinates) && fault.route_coordinates.length >= 2
    && fault.route_coordinates.every(point) ? fault.route_coordinates : [];
  return {route, pin: point(fault.inspection_point) ? fault.inspection_point : null};
}
