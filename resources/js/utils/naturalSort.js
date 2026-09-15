/**
 * Natural sort helper for network nodes (ODP, ODC, POP, etc.)
 */
export const normalizeNodeSortName = (val) => {
  if (!val) return '';
  let str = typeof val === 'object' ? String(val.name || val.code || '') : String(val);
  str = str.trim().replace(/\s+/g, ' ');

  // Standardize OD 460 to ODP 460
  if (/^OD\s+\d+/i.test(str)) {
    str = str.replace(/^OD\s+/i, 'ODP ');
  }
  // Standardize ODP I46 / ODP l46 to ODP 146
  if (/^ODP\s*[I|l](\d+)/i.test(str)) {
    str = str.replace(/^ODP\s*[I|l](\d+)/i, 'ODP 1');
  }
  // Standardize ODP752 or ODP-752 to ODP 752
  str = str.replace(/^(ODP|ODC|POP)[-_]?(\d+)/i, ' ');

  return str;
};

/**
 * Natural comparison between two nodes or node name strings.
 * Ensures:
 *  'ODP 1' < 'ODP 1 -02' < 'ODP 2' < 'ODP 10' < 'ODP 64' < 'ODP 100' < 'ODP 460'
 */
export const naturalNodeCompare = (a, b) => {
  const normA = normalizeNodeSortName(a);
  const normB = normalizeNodeSortName(b);
  return normA.localeCompare(normB, undefined, { numeric: true, sensitivity: 'base' });
};
