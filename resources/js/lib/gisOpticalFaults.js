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
