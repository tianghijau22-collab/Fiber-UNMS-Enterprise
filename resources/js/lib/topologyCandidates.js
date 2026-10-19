import { coordinate } from './cableRoutes.js';

const EARTH = 6371000;
const RAD = Math.PI / 180;
const wrap = degrees => ((degrees + 540) % 360) - 180;
export const REVIEW_LABELS = { pending: 'Belum diperiksa', accepted: 'Sesuai lapangan', rejected: 'Tidak tersambung', inspect: 'Perlu cek lapangan' };
export const CANDIDATE_LABELS = { endpoint_node: 'Ujung kabel–node', node_route: 'Node di sepanjang rute', cable_endpoint: 'Ujung antarkabel', cable_branch: 'Calon percabangan kabel' };

export function point(value) {
  if (!value || typeof value !== 'object') return null;
  const lat = coordinate(Array.isArray(value) ? value[0] : value.lat ?? value.latitude, 90);
  const lng = coordinate(Array.isArray(value) ? value[1] : value.lng ?? value.longitude, 180);
  return lat === null || lng === null ? null : { lat, lng };
}

export function meters(a, b) {
  const h = Math.sin((b.lat - a.lat) * RAD / 2) ** 2
    + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(wrap(b.lng - a.lng) * RAD / 2) ** 2;
  return EARTH * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

export function parseRoute(value) {
  if (typeof value === 'string') { try { value = JSON.parse(value); } catch { return null; } }
  if (!Array.isArray(value) || value.length < 2) return null;
  const points = value.map(point);
  // Never bridge an invalid vertex or silently truncate a recorded line.
  return points.every(Boolean) ? points : null;
}

export function nearestOnRoute(target, points) {
  let nearest = null, along = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const cos = Math.max(1e-8, Math.cos(target.lat * RAD));
    const ax = wrap(a.lng - target.lng) * RAD * EARTH * cos, ay = (a.lat - target.lat) * RAD * EARTH;
    const dx = wrap(b.lng - a.lng) * RAD * EARTH * cos, dy = (b.lat - a.lat) * RAD * EARTH;
    const squared = dx * dx + dy * dy;
    const fraction = squared ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / squared)) : 0;
    const projected = { lat: a.lat + (b.lat - a.lat) * fraction, lng: wrap(a.lng + wrap(b.lng - a.lng) * fraction) };
    const distance = meters(target, projected), segmentLength = meters(a, b);
    if (!nearest || distance < nearest.distance) nearest = { point: projected, distance, along: along + segmentLength * fraction, segment: i - 1 };
    along += segmentLength;
  }
  return nearest;
}

const cableLabel = cable => [cable.code, cable.name].filter(Boolean).join(' · ') || `Kabel ${cable.id}`;
const nodeLabel = node => [node.code, node.name].filter(Boolean).join(' · ') || `Node ${node.id}`;
const sameId = (a, b) => a !== null && a !== undefined && b !== null && b !== undefined && String(a) === String(b);

export function generateCandidates(data, tolerance = 10) {
  if (!Number.isFinite(Number(tolerance)) || tolerance < 1 || tolerance > 100) throw Error('Toleransi harus 1–100 meter.');
  tolerance = Number(tolerance);
  const rawNodes = Array.isArray(data?.nodes) ? data.nodes : [];
  const rawCables = Array.isArray(data?.cables) ? data.cables : [];
  const nodes = rawNodes.filter(n => n && n.id !== undefined).map(n => ({ ...n, point: point(n) })).filter(n => n.point);
  const byId = new Map(nodes.map(n => [String(n.id), n]));
  const cables = [], skipped = [];
  for (const cable of rawCables) {
    if (!cable || cable.id === undefined) continue;
    const stored = cable.route_coordinates;
    const hasStored = stored !== null && stored !== undefined && !(Array.isArray(stored) && stored.length === 0) && stored !== '[]';
    let route = hasStored ? parseRoute(stored) : null;
    let routeSource = 'recorded';
    if (!hasStored) {
      const a = byId.get(String(cable.from_node_id))?.point, b = byId.get(String(cable.to_node_id))?.point;
      if (a && b) { route = [a, b]; routeSource = 'endpoints_only'; }
    }
    if (!route || !route.some(p => meters(p, route[0]) > 0.01)) {
      skipped.push({ id: cable.id, label: cableLabel(cable), reason: hasStored ? 'Rute tidak valid atau tidak memiliki panjang.' : 'Rute dan koordinat kedua endpoint belum tersedia.' });
      continue;
    }
    cables.push({ ...cable, route, label: cableLabel(cable), route_source: routeSource,
      min_lat: Math.min(...route.map(p => p.lat)), max_lat: Math.max(...route.map(p => p.lat)) });
  }
  cables.sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
  const candidates = [];
  const warningsFor = (routes, node = null) => {
    const warnings = [];
    if (routes.some(c => !['active', 'damaged'].includes(c.status))) warnings.push('Ada kabel nonaktif/perawatan atau status belum diketahui.');
    if (node && ['inactive', 'maintenance'].includes(node.status)) warnings.push('Node nonaktif atau dalam perawatan.');
    if (routes.some(c => c.route_source === 'endpoints_only')) warnings.push('Bentuk rute belum tersedia; memakai garis antar-endpoint tersimpan.');
    const refs = routes.flatMap(c => [byId.get(String(c.from_node_id)), byId.get(String(c.to_node_id))]).filter(Boolean);
    if (node) refs.push(node);
    const oltIds = new Set(refs.map(n => n.olt_device_id).filter(Boolean).map(String));
    const pons = new Set(refs.map(n => n.stored_olt_port_ref).filter(Boolean));
    if (oltIds.size > 1 || pons.size > 1) warnings.push('Referensi OLT/PON berbeda; periksa sambungan core dan percabangan.');
    return warnings;
  };
  const add = candidate => candidates.push({ ...candidate, distance_meters: candidate.distance_meters,
    warnings: candidate.warnings || [], existing: !!candidate.existing });

  for (const cable of cables) {
    for (const node of nodes) {
      const endDistances = [meters(cable.route[0], node.point), meters(cable.route.at(-1), node.point)];
      const existing = sameId(node.id, cable.from_node_id) || sameId(node.id, cable.to_node_id);
      let atEnd = false;
      endDistances.forEach((distance, end) => {
        if (distance > tolerance) return;
        atEnd = true;
        add({ id: `endpoint-node:${cable.id}:${end}:${node.id}`, kind: 'endpoint_node', cable_ids: [cable.id], node_id: node.id,
          title: `${cable.label} · Ujung ${end + 1} → ${nodeLabel(node)}`,
          reason: 'Ujung rute berada dalam toleransi koordinat node. Arah pangkal/tujuan belum ditentukan.',
          a: cable.route[end ? cable.route.length - 1 : 0], b: node.point, distance_meters: distance, end,
          existing, warnings: warningsFor([cable], node) });
      });
      if (atEnd) continue;
      // Latitude bounding box avoids most far-away node/segment calculations.
      const pad = tolerance / EARTH / RAD;
      if (node.point.lat < cable.min_lat - pad || node.point.lat > cable.max_lat + pad) continue;
      const hit = nearestOnRoute(node.point, cable.route);
      if (hit && hit.distance <= tolerance) add({ id: `node-route:${cable.id}:${node.id}`, kind: 'node_route', cable_ids: [cable.id], node_id: node.id,
        title: `${nodeLabel(node)} → ${cable.label}`, reason: 'Node dekat bagian tengah jalur. Kedekatan ini belum membuktikan adanya sambungan atau splitter.',
        a: node.point, b: hit.point, distance_meters: hit.distance, position_meters: hit.along,
        existing, warnings: warningsFor([cable], node) });
    }
  }
  for (let i = 0; i < cables.length; i++) {
    const a = cables[i];
    for (let j = i + 1; j < cables.length; j++) {
      const b = cables[j];
      [0, 1].forEach(endA => [0, 1].forEach(endB => {
        const p = a.route[endA ? a.route.length - 1 : 0], q = b.route[endB ? b.route.length - 1 : 0], distance = meters(p, q);
        if (distance > tolerance) return;
        const shared = [a.from_node_id, a.to_node_id].find(id => [b.from_node_id, b.to_node_id].some(other => sameId(id, other))
          && byId.has(String(id)) && meters(p, byId.get(String(id)).point) <= tolerance && meters(q, byId.get(String(id)).point) <= tolerance);
        add({ id: `cable-end:${a.id}:${endA}:${b.id}:${endB}`, kind: 'cable_endpoint', cable_ids: [a.id, b.id],
          title: `${a.label} · Ujung ${endA + 1} ↔ ${b.label} · Ujung ${endB + 1}`,
          reason: 'Dua ujung kabel berdekatan. Konfirmasi node sambung serta core yang benar.',
          a: p, b: q, distance_meters: distance, existing: shared !== undefined && shared !== null, warnings: warningsFor([a, b]) });
      }));
      // An endpoint near another line can be a T branch. Pure crossings never create candidates.
      [[a, b], [b, a]].forEach(([source, target]) => [0, 1].forEach(end => {
        const p = source.route[end ? source.route.length - 1 : 0];
        if (meters(p, target.route[0]) <= tolerance || meters(p, target.route.at(-1)) <= tolerance) return;
        const hit = nearestOnRoute(p, target.route);
        if (hit && hit.distance <= tolerance) add({ id: `cable-branch:${source.id}:${end}:${target.id}`, kind: 'cable_branch', cable_ids: [source.id, target.id],
          title: `${source.label} · Ujung ${end + 1} → jalur ${target.label}`,
          reason: 'Ujung kabel dekat bagian tengah rute lain. Perlu konfirmasi titik sambung/core; belum menjadi percabangan aktif.',
          a: p, b: hit.point, distance_meters: hit.distance, position_meters: hit.along, warnings: warningsFor([source, target]) });
      }));
    }
  }
  const groups = new Map();
  for (const candidate of candidates) {
    if (candidate.kind !== 'endpoint_node') continue;
    const key = `${candidate.cable_ids[0]}:${candidate.end}`;
    groups.set(key, (groups.get(key) || 0) + 1);
  }
  for (const candidate of candidates) {
    if (candidate.kind === 'endpoint_node' && groups.get(`${candidate.cable_ids[0]}:${candidate.end}`) > 1) candidate.warnings.push('Lebih dari satu node dekat ujung ini; pilih berdasarkan sambungan nyata.');
  }
  candidates.sort((a, b) => Number(a.existing) - Number(b.existing) || a.distance_meters - b.distance_meters || a.id.localeCompare(b.id));
  return { candidates, nodes, cables, skipped, coverage: { total_nodes: rawNodes.length, valid_nodes: nodes.length,
    total_cables: rawCables.length, valid_cables: cables.length, skipped_cables: skipped.length, invalid_node_gps: rawNodes.length - nodes.length }, tolerance };
}

export function reviewExport(result, reviews, loadedAt) {
  return { format: 'fona-topology-preview', version: 1, exported_at: new Date().toISOString(), source_loaded_at: loadedAt,
    tolerance_meters: result.tolerance, topology_applied: false,
    description: 'Penilaian manual pratinjau. Tidak mengubah hubungan node/kabel/core atau mengaktifkan diagnosis.',
    reviews: result.candidates.filter(c => reviews[c.id] && !c.existing && (reviews[c.id].decision !== 'pending' || reviews[c.id].note)).map(c => ({
      candidate_id: c.id, kind: c.kind, title: c.title, cable_ids: c.cable_ids, node_id: c.node_id ?? null,
      coordinates: { a: c.a, b: c.b }, distance_meters: c.distance_meters,
      decision: reviews[c.id].decision, note: String(reviews[c.id].note || '').slice(0, 1000), warnings: c.warnings,
    })) };
}
