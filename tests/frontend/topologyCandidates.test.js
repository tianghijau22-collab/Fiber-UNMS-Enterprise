import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCandidates, parseRoute, nearestOnRoute, meters, reviewExport } from '../../resources/js/lib/topologyCandidates.js';

const node = (id, lat, lng, extra={}) => ({id,name:`Node ${id}`,node_type:'ODP',latitude:lat,longitude:lng,status:'active',...extra});
const cable = (id, route, extra={}) => ({id,name:`Kabel ${id}`,status:'active',route_coordinates:route,...extra});

test('normalizes both KML pairs and editor objects without mutating stored coordinates', () => {
  const input={nodes:[node(1,0,100)],cables:[cable(1,[[0,100],[0,100.001]]),cable(2,[{lat:0,lng:100.001},{lat:0,lng:100.002}])]};
  const before=structuredClone(input), out=generateCandidates(input,5);
  assert.equal(out.cables.length,2);assert.deepEqual(input,before);
  assert.ok(out.candidates.some(c=>c.kind==='endpoint_node' && c.node_id===1));
  assert.ok(out.candidates.some(c=>c.kind==='cable_endpoint'));
});
test('rejects invalid GPS, malformed JSON and broken route vertices rather than bridging gaps', () => {
  for(const route of ['bad','{}',[[0,100],null,[0,101]],[[91,100],[0,100]],[[0,''],[0,100]]])assert.equal(parseRoute(route),null);
  const out=generateCandidates({nodes:[node(1,null,100),node(2,0,0)],cables:[cable(1,[[0,100],null,[0,101]])]});
  assert.equal(out.coverage.invalid_node_gps,1);assert.equal(out.skipped.length,1);assert.equal(out.candidates.length,0);
});
test('uses bounded meter tolerance including valid zero coordinates', () => {
  const input={nodes:[node(1,0.00005,100)],cables:[cable(1,[[0,100],[0,100.01]])]};
  assert.equal(generateCandidates(input,5).candidates.length,0);
  const candidate=generateCandidates(input,10).candidates[0];assert.ok(candidate.distance_meters>5 && candidate.distance_meters<6);
  for(const tolerance of [0,101,'bad',Infinity])assert.throws(()=>generateCandidates(input,tolerance));
});
test('node near route middle gets a projection and along-route distance, not an endpoint assignment', () => {
  const out=generateCandidates({nodes:[node(1,0.00001,100.005)],cables:[cable(1,[[0,100],[0,100.01]])]},5);
  assert.equal(out.candidates.length,1);assert.equal(out.candidates[0].kind,'node_route');
  assert.ok(Math.abs(out.candidates[0].position_meters-556)<2);assert.equal(out.candidates[0].b.lat,0);
});
test('pure interior crossings do not connect cables; endpoint near midspan remains only a branch candidate', () => {
  const input={nodes:[],cables:[cable(1,[[0,100],[0,100.01]]),cable(2,[[-0.005,100.005],[0.005,100.005]])]};
  assert.equal(generateCandidates(input,5).candidates.length,0);
  input.cables[1].route_coordinates=[[0,100.005],[0.005,100.005]];
  const out=generateCandidates(input,5);assert.equal(out.candidates.length,1);assert.equal(out.candidates[0].kind,'cable_branch');assert.equal(out.candidates[0].existing,false);
});
test('ambiguous nodes are all offered with warnings, never nearest-only automatic selection', () => {
  const out=generateCandidates({nodes:[node(1,0,100),node(2,0.00001,100)],cables:[cable(1,[[0,100],[0,100.01]])]},5);
  const matches=out.candidates.filter(c=>c.kind==='endpoint_node');assert.equal(matches.length,2);
  assert.ok(matches.every(c=>c.warnings.some(w=>w.includes('Lebih dari satu'))));
});
test('existing node links are recognized and cannot be included as new manual review exports', () => {
  const out=generateCandidates({nodes:[node(1,0,100)],cables:[cable(1,[[0,100],[0,100.01]],{from_node_id:1})]},5);
  assert.equal(out.candidates[0].existing,true);
  assert.equal(reviewExport(out,{[out.candidates[0].id]:{decision:'accepted'}},'time').reviews.length,0);
});
test('known shared endpoint is already recorded; parallel geometry alone is not', () => {
  const input={nodes:[node(1,0,100.001)],cables:[cable(1,[[0,100],[0,100.001]],{to_node_id:1}),cable(2,[[0,100.001],[0,100.002]],{from_node_id:1})]};
  assert.equal(generateCandidates(input,5).candidates.find(c=>c.kind==='cable_endpoint').existing,true);
  input.cables[1].from_node_id=null;
  assert.equal(generateCandidates(input,5).candidates.find(c=>c.kind==='cable_endpoint').existing,false);
});
test('does not create measurements or silently invent a missing route', () => {
  const input={nodes:[node(1,0,100),node(2,0,100.01)],cables:[cable(1,[],{from_node_id:1,to_node_id:2}),cable(2,[])]};
  const out=generateCandidates(input,5);assert.equal(out.cables.length,1);assert.equal(out.skipped.length,1);
  assert.ok(out.candidates.every(c=>c.warnings.some(w=>w.includes('Bentuk rute'))));
  assert.equal(out.cables[0].route_source,'endpoints_only');
});
test('different PON or OLT references and maintenance are flagged for physical core verification', () => {
  const input={nodes:[node(1,0,100,{olt_device_id:1,stored_olt_port_ref:'1/1/1'}),node(2,0,100.01,{olt_device_id:2,stored_olt_port_ref:'1/1/2'})],cables:[cable(1,[[0,100],[0,100.01]],{from_node_id:1,to_node_id:2,status:'maintenance'})]};
  const candidate=generateCandidates(input,5).candidates[0];assert.ok(candidate.warnings.some(w=>w.includes('OLT/PON berbeda')));assert.ok(candidate.warnings.some(w=>w.includes('perawatan')));
});
test('candidate IDs remain deterministic under different input ordering and unchanged source data', () => {
  const input={nodes:[node(1,0,100)],cables:[cable(10,[[0,100],[0,100.001]]),cable(2,[[0,100.001],[0,100.002]])]};
  assert.deepEqual(generateCandidates(input,5).candidates.map(c=>c.id),generateCandidates({...input,cables:[...input.cables].reverse()},5).candidates.map(c=>c.id));
});
test('review exports contain decisions and pending notes with explicit non-applied state', () => {
  const out=generateCandidates({nodes:[node(1,0,100)],cables:[cable(1,[[0,100],[0,100.001]])]},5), candidate=out.candidates[0];
  const exported=reviewExport(out,{[candidate.id]:{decision:'pending',note:'Cek core biru'},stale:{decision:'accepted'}},'2026-10-19T00:00:00Z');
  assert.equal(exported.topology_applied,false);assert.equal(exported.reviews.length,1);assert.equal(exported.reviews[0].note,'Cek core biru');assert.equal(exported.source_loaded_at,'2026-10-19T00:00:00Z');
});
test('metric geometry handles repeated points and an antimeridian segment', () => {
  assert.ok(meters({lat:0,lng:179.999},{lat:0,lng:-179.999})<230);
  const hit=nearestOnRoute({lat:0.00001,lng:180},[{lat:0,lng:179.999},{lat:0,lng:179.999},{lat:0,lng:-179.999}]);
  assert.ok(hit.distance<2);assert.ok(hit.along>100 && hit.along<120);
});
