import { meters, point } from './topologyCandidates.js';

// Distances describe proximity to either candidate point, not a physical connection.
export function nearbyNodes(nodes, candidate, radius = 250) {
  const a = point(candidate?.a), b = point(candidate?.b);
  if (!a || !b || !Number.isFinite(radius) || radius < 0) return [];
  return (Array.isArray(nodes) ? nodes : []).flatMap(node => {
    const location = point(node?.point);
    if (!location) return [];
    const distance = Math.min(meters(location, a), meters(location, b));
    const selected = candidate.node_id !== null && candidate.node_id !== undefined && String(node.id) === String(candidate.node_id);
    return distance <= radius || selected ? [{ node, distance, selected }] : [];
  }).sort((a, b) => a.distance - b.distance || String(a.node.id).localeCompare(String(b.node.id), undefined, { numeric: true }));
}
