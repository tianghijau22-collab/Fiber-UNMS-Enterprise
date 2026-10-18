// Keep occupied ports even when their customer record has not been linked yet.
export function odpCustomerPorts(ports = []) {
  return ports.filter(port => port.customer_id || port.customer_service_id || port.customer_name_cache || port.status === 'used')
    .slice().sort((a, b) => String(a.port_number ?? '').localeCompare(String(b.port_number ?? ''), 'id', { numeric: true }));
}

// A retained response must not keep presenting an expired optical sample as current.
export function currentOdpCustomerTelemetry(port, now = Date.now()) {
  const at = Date.parse(port.sampled_at);
  if (port.telemetry_contract !== 1 || (Number.isFinite(at) && at >= now - 180000 && at <= now + 5000)) return port;
  return { ...port, is_online: null, rx_power: null, rx_available: false, telemetry_freshness: 'stale' };
}
