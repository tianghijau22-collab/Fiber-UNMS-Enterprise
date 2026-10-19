export function coordinate(value, limit) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}

export function validPoint(point) {
  return point && coordinate(point.lat, 90) !== null && coordinate(point.lng, 180) !== null;
}

export function normalizeCable(cable) {
  const node = value => value ? {
    ...value,
    lat: coordinate(value.latitude ?? value.lat, 90),
    lng: coordinate(value.longitude ?? value.lng, 180),
  } : null;
  // KML imports store Leaflet pairs [lat, lng]; the route editor stores named objects.
  // Normalize in memory only. The persisted route is changed only by an explicit save.
  const points = Array.isArray(cable.route_coordinates) ? cable.route_coordinates : [];
  const route = points.map((point, index) => Array.isArray(point) ? {
    lat: coordinate(point[0], 90), lng: coordinate(point[1], 180),
    name: `Tiang #${String(index + 1).padStart(2, '0')}`,
  } : point);
  return { ...cable, from_node: node(cable.from_node), to_node: node(cable.to_node), route_coordinates: route };
}

export function routePoints(cable, waypoints) {
  return [cable?.from_node, ...waypoints, cable?.to_node].filter(validPoint);
}

export function routeDistance(cable, waypoints) {
  const points = routePoints(cable, waypoints);
  if (points.length < 2 || waypoints.some(point => !validPoint(point))) return null;
  let meters = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], rad = Math.PI / 180;
    const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2
      + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lng - a.lng) * rad / 2) ** 2;
    meters += 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
  }
  return Math.round(meters);
}

export function routePayload(cable, waypoints, useEstimate) {
  if (!cable || !Array.isArray(waypoints) || waypoints.some(point => !validPoint(point))) {
    throw new Error('Koordinat rute tidak valid. Periksa titik tiang sebelum menyimpan.');
  }
  const payload = {
    route_coordinates: waypoints.map(point => ({
      lat: Number(point.lat), lng: Number(point.lng), name: String(point.name ?? '').slice(0, 160),
    })),
    ...(cable.updated_at ? { expected_updated_at: cable.updated_at } : {}),
  };
  if (useEstimate) {
    const length = routeDistance(cable, waypoints);
    if (!validPoint(cable.from_node) || !validPoint(cable.to_node) || !length) {
      throw new Error('Estimasi panjang memerlukan koordinat pangkal, tujuan, dan jarak lebih dari nol.');
    }
    payload.length_meters = length;
  }
  return payload;
}

export function escapeMapLabel(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

export const formatMeters = value => value === null || value === undefined ? 'N/A'
  : `${Number(value).toLocaleString('id-ID', { maximumFractionDigits: 2 })} m`;
