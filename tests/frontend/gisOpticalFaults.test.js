import test from 'node:test';
import assert from 'node:assert/strict';
import {gisOpticalState, gisOdpDisplayState, gisOpticalPower, gisOpticalLabel, currentGisFaults, faultCoordinates} from '../../resources/js/lib/gisOpticalFaults.js';

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

const odp451 = () => ({id:517,node_type:'ODP',total_clients:7,best_rx_power:null,worst_rx_power:null,optical_power_dbm:null,
  rx_power_range:'N/A (1 belum terverifikasi)',optical_evidence:{version:1,state:'unknown',total:7,signal_clients:0,no_rx_clients:6,unverified_clients:1,valid_until:new Date(now+30000).toISOString()}});

test('ODP 451 displays all Rx N/A with an unresolved ONU without claiming verified downstream outage evidence',()=>{
  const n=odp451();assert.equal(gisOdpDisplayState(n,now),'no_rx_unverified');assert.equal(gisOpticalState(n,now),'unknown');
  assert.equal(gisOpticalLabel(n,true,now),'N/A');assert.equal(gisOpticalPower(n,now),null);
  assert.deepEqual(currentGisFaults({faults:[{...fault,affected_node_ids:[517]}]},[node(1,'signal'),n],now),[]);
});

test('unverified counts, offline descriptions, port numbers and arbitrary range text never become optical power',()=>{
  for(const text of ['N/A (1 belum terverifikasi)','N/A (12 belum terverifikasi)','7 pelanggan Offline','ODP 451: 1/5/5','—','-23 s/d -25 dBm']){
    const n=odp451();n.rx_power_range=text;assert.equal(gisOpticalLabel(n,true,now),'N/A');assert.equal(gisOpticalLabel(n,false,now),'N/A');
  }
});

test('no recent no-Rx evidence, expired evidence, invalid counts and contradictory measurements cannot activate red missing-Rx display',()=>{
  for(const changes of [{no_rx_clients:0,unverified_clients:7},{valid_until:new Date(now-1).toISOString()},{no_rx_clients:5},{unverified_clients:-1},{valid_until:null}]){
    const n=odp451();Object.assign(n.optical_evidence,changes);assert.equal(gisOdpDisplayState(n,now),'unknown');
  }
  const n=odp451();n.best_rx_power=-24;assert.equal(gisOdpDisplayState(n,now),'unknown');
});

test('numeric aggregate measurements alone supply GIS power labels, including measured zero and very weak signal',()=>{
  const n={...node(1,'signal'),total_clients:2,best_rx_power:-23.6,worst_rx_power:-35.5,rx_power_range:'1 belum terverifikasi'};
  assert.equal(gisOpticalLabel(n,true,now),'-23.6 s/d -35.5 dBm');assert.equal(gisOpticalPower(n,now),-23.6);
  n.best_rx_power=0;n.worst_rx_power=0;assert.equal(gisOpticalLabel(n,true,now),'0.0 dBm');
  for(const value of [null,'',' ',false,-40,65535,'1 belum terverifikasi',Infinity]){n.best_rx_power=value;n.optical_power_dbm=null;assert.equal(gisOpticalLabel(n,true,now),'N/A');}
});

test('a new valid Rx clears the all-NA display while expiry hides even a formerly valid numeric value',()=>{
  const n=odp451();Object.assign(n.optical_evidence,{state:'signal',signal_clients:1,no_rx_clients:5});n.best_rx_power=-24.1;n.worst_rx_power=-24.1;
  assert.equal(gisOdpDisplayState(n,now),'signal');assert.equal(gisOpticalLabel(n,true,now),'-24.1 dBm');
  assert.equal(gisOdpDisplayState(n,now+31000),'unknown');assert.equal(gisOpticalLabel(n,true,now+31000),'N/A');
});
