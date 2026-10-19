import test from 'node:test';
import assert from 'node:assert/strict';
import { nearbyNodes } from '../../resources/js/lib/topologyNeighborhood.js';

const node = (id, lat, lng) => ({ id, name:`Node ${id}`, point:{lat,lng} });
const candidate = { a:{lat:0,lng:100}, b:{lat:0,lng:100.01} };

test('includes neighbors of both candidate endpoints without treating the intervening route as connected', () => {
  const nodes=[node(1,0,100.0001),node(2,0,100.0101),node(3,0,100.005)];
  const before=structuredClone(nodes), result=nearbyNodes(nodes,candidate,100);
  assert.deepEqual(result.map(r=>r.node.id).sort(),[1,2]);
  assert.ok(result.every(r=>r.distance>10 && r.distance<12 && !r.selected));
  assert.deepEqual(nodes,before);
});

test('radius changes admit more neighbors and ties use deterministic numeric IDs', () => {
  const nodes=[node(10,0,100),node(2,0,100),node(3,0.002,100)];
  assert.deepEqual(nearbyNodes(nodes,candidate,100).map(r=>r.node.id),[2,10]);
  assert.deepEqual(nearbyNodes(nodes,candidate,250).map(r=>r.node.id),[2,10,3]);
});

test('keeps the actual candidate node visible outside the selected surrounding radius', () => {
  const rows=nearbyNodes([node(1,0.003,100),node(2,0.003,100)],{...candidate,node_id:'1'},100);
  assert.equal(rows.length,1);assert.equal(rows[0].node.id,1);assert.equal(rows[0].selected,true);assert.ok(rows[0].distance>100);
});

test('invalid GPS is excluded while zero coordinates remain valid', () => {
  const rows=nearbyNodes([node(1,0,0),node(2,null,0),node(3,91,0),node(4,'',0),null],{a:{lat:0,lng:0},b:{lat:0,lng:0}},100);
  assert.deepEqual(rows.map(r=>r.node.id),[1]);assert.equal(rows[0].distance,0);
});

test('empty input, malformed candidate, and invalid radii have no neighborhood', () => {
  assert.deepEqual(nearbyNodes(null,candidate),[]);
  assert.deepEqual(nearbyNodes([node(1,0,100)],null),[]);
  for(const radius of [-1,Infinity,NaN])assert.deepEqual(nearbyNodes([node(1,0,100)],candidate,radius),[]);
});
