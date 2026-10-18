import test from 'node:test';
import assert from 'node:assert/strict';
import {gisOpticalState, currentGisFaults, faultCoordinates} from '../../resources/js/lib/gisOpticalFaults.js';

const now=1800000000000;
const node=(id,state='no_rx')=>({id,node_type:'ODP',optical_evidence:{version:1,state,total:2,signal_clients:state==='signal'?1:0,no_rx_clients:state==='signal'?1:2,unverified_clients:0,valid_until:new Date(now+30000).toISOString()}});
const fault={id:'cable-1',last_signal_node:{id:1},first_no_rx_node:{id:2},affected_node_ids:[2,3],valid_until:new Date(now+30000).toISOString()};

test('all-NA red evidence requires every customer to have a current verified sample',()=>{
  assert.equal(gisOpticalState(node(1),now),'no_rx');
  assert.equal(gisOpticalState(node(1,'signal'),now),'signal');
  for(const replacement of [{unverified_clients:1},{total:3},{signal_clients:1},{valid_until:new Date(now-1).toISOString()},{valid_until:null}]) {
    const n=node(1);Object.assign(n.optical_evidence,replacement);assert.equal(gisOpticalState(n,now),'unknown');
  }
  assert.equal(gisOpticalState({node_type:'ODP'},now),null);
  assert.equal(gisOpticalState({node_type:'ODP',optical_evidence:{version:1,state:'empty',total:0}},now),'empty');
});

test('expired evidence removes both the red optical status and fault even when fetches stop',()=>{
  const rows=[node(1,'signal'),node(2),node(3)];
  assert.equal(currentGisFaults({faults:[fault]},rows,now).length,1);
  assert.equal(currentGisFaults({faults:[fault]},rows,now+31000).length,0);
  assert.equal(gisOpticalState(rows[1],now+31000),'unknown');
});

test('missing downstream evidence or a recovered ONU removes an old boundary estimate',()=>{
  assert.equal(currentGisFaults({faults:[fault]},[node(1,'signal'),node(2),node(3,'signal')],now).length,0);
  assert.equal(currentGisFaults({faults:[fault]},[node(1,'signal'),node(2)],now).length,0);
  assert.equal(currentGisFaults({faults:[fault]},[node(1),node(2),node(3)],now).length,0);
  assert.deepEqual(currentGisFaults({},[],now),[]);
});

test('geometry accepts real coordinates including zero but rejects malformed and out-of-range pins',()=>{
  assert.deepEqual(faultCoordinates({route_coordinates:[[0,100],[1,101]],inspection_point:[0,100]}),{route:[[0,100],[1,101]],pin:[0,100]});
  for(const p of [[999,100],[0,999],['0',100],[NaN,100],null])assert.equal(faultCoordinates({inspection_point:p}).pin,null);
  assert.deepEqual(faultCoordinates({route_coordinates:[[0,100],[999,100]]}).route,[]);
});
