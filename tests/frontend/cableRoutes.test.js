import test from 'node:test';
import assert from 'node:assert/strict';
import { coordinate, validPoint, normalizeCable, routeDistance, routePayload, escapeMapLabel } from '../../resources/js/lib/cableRoutes.js';

test('shared inventory coordinates preserve zero and reject absent or impossible GPS', () => {
  const cable = normalizeCable({ from_node: { latitude: '0', longitude: '100.25' }, to_node: { latitude: null, longitude: '' } });
  assert.equal(validPoint(cable.from_node), true);
  assert.equal(validPoint(cable.to_node), false);
  for (const value of [null, undefined, '', ' ', 'NaN', Infinity, 91]) assert.equal(coordinate(value, 90), null);
});
test('KML Leaflet pairs and named editor points share a canonical draft without mutating inventory', () => {
  const original = { route_coordinates: [[0,100],['-0.5','100.5'],{lat:-1,lng:101,name:'Tiang Lama'}] };
  const cable = normalizeCable(original);
  assert.deepEqual(cable.route_coordinates, [
    {lat:0,lng:100,name:'Tiang #01'}, {lat:-0.5,lng:100.5,name:'Tiang #02'}, {lat:-1,lng:101,name:'Tiang Lama'},
  ]);
  assert.deepEqual(original.route_coordinates[0],[0,100]);
  assert.ok(cable.route_coordinates.every(validPoint));
  assert.equal(routePayload(cable,cable.route_coordinates,false).route_coordinates.length,3);
  assert.equal(normalizeCable({route_coordinates:[[100,1]]}).route_coordinates[0].lat,null);
});
test('distance measures direct endpoints without waypoints and follows ordered waypoints', () => {
  const cable = { from_node: {lat:0,lng:0}, to_node: {lat:0,lng:1} };
  assert.equal(routeDistance(cable, []), 111195);
  assert.ok(routeDistance(cable, [{lat:1,lng:0.5}]) > 220000);
  assert.equal(routeDistance({}, []), null);
  assert.equal(routeDistance(cable, [{lat:'',lng:1}]), null);
});
test('normal save and clear retain recorded length and send concurrency token', () => {
  const cable = { id:1, length_meters:'500.00', updated_at:'2026-10-19T10:00:00.000000Z' };
  assert.deepEqual(routePayload(cable, [], false), {route_coordinates:[],expected_updated_at:cable.updated_at});
  const points = [{lat:'0',lng:'100',name:'Tiang'}];
  const payload = routePayload(cable, points, false);
  assert.deepEqual(payload.route_coordinates,[{lat:0,lng:100,name:'Tiang'}]);
  assert.equal('length_meters' in payload,false);
  assert.equal(typeof points[0].lat,'string');
});
test('replacing length requires an explicit complete nonzero map estimate', () => {
  const cable = {from_node:{lat:0,lng:0},to_node:{lat:0,lng:1}};
  assert.equal(routePayload(cable,[],true).length_meters,111195);
  assert.throws(()=>routePayload({from_node:cable.from_node},[{lat:0,lng:1}],true));
  assert.throws(()=>routePayload({from_node:cable.from_node,to_node:cable.from_node},[],true));
});
test('invalid points block saving instead of silently discarding stored data', () => {
  for (const point of [null,{lat:95,lng:10},{lat:10,lng:181},{lat:null,lng:10}]) assert.throws(()=>routePayload({id:1},[point],false));
});
test('map labels escape user supplied markup', () => {
  assert.equal(escapeMapLabel('<img src=x onerror="x"> & \'test\''),'&lt;img src=x onerror=&quot;x&quot;&gt; &amp; &#39;test&#39;');
});
