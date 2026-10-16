import test from 'node:test';
import assert from 'node:assert/strict';
import {opticalDiagnostic,opticalResponseMatches} from '../../resources/js/lib/opticalDiagnostic.js';
const now=Date.parse('2026-10-16T13:00:00Z');
const data={telemetry_contract:1,identity_status:'resolved',identity_observed_at:'2026-10-16T12:59:50Z',sampled_at:'2026-10-16T12:59:50Z',
  gpon_interface:'gpon-olt_1/1/16',is_online:true,rx_available:true,rx_power:-26,telemetry_source:'snmp_point',telemetry_freshness:'fresh'};
test('working without Rx remains Online and never shows critical or offline',()=>{
 const d=opticalDiagnostic({...data,rx_power:null,rx_available:false,probe_reason:'rx_unavailable'},now);
 assert.equal(d.label,'Online');assert.equal(d.rx,null);assert.equal(d.quality,'unknown');assert.match(d.message,/redaman N\/A/);
});
test('weak signal is critical quality but still Online',()=>{
 const d=opticalDiagnostic({...data,rx_power:-36},now);
 assert.equal(d.online,true);assert.equal(d.label,'Online');assert.equal(d.quality,'critical');assert.equal(d.rx,-36);
});
test('unknown and failed legacy data never imply Offline or fictitious sensor values',()=>{
 for(const value of [null,{status:'Online',rx_power_dbm:-20,temperature_c:41.5},{...data,is_online:null}]) {
  const d=opticalDiagnostic(value,now);assert.equal(d.online,null);assert.equal(d.rx,null);
  for(const key of ['tx','oltRx','voltage','bias','temperature'])assert.equal(d[key],null);
 }
});
test('missing sensors are not inferred from Rx',()=>{
 const d=opticalDiagnostic(data,now);assert.equal(d.rx,-26);
 for(const key of ['tx','oltRx','voltage','bias','temperature'])assert.equal(d[key],null);
});
test('data age advances while modal is open and stale sample becomes unknown',()=>{
 const d=opticalDiagnostic(data,now+180000);assert.equal(d.online,null);assert.equal(d.rx,null);assert.equal(d.label,'Data lama');
 const oldIdentity=opticalDiagnostic({...data,identity_observed_at:'2026-10-16T12:40:00Z'},now);
 assert.equal(oldIdentity.online,null);assert.equal(oldIdentity.interfaceLabel,'Belum terverifikasi');
});
test('stored fallback remains labeled stored and does not expose untimed sensors',()=>{
 const d=opticalDiagnostic({...data,telemetry_source:'snapshot',temperature_c:41.5},now);
 assert.equal(d.sourceLabel,'Data tersimpan');assert.equal(d.temperature,null);assert.match(d.stamp,/tersimpan/);
});
test('verified Offline is distinct and never uses a negative forty reading',()=>{
 const d=opticalDiagnostic({...data,is_online:false,rx_power:-40},now);
 assert.equal(d.label,'Offline');assert.equal(d.quality,'offline');assert.equal(d.rx,null);
});
test('late responses for another OLT or ONU cannot populate the current modal',()=>{
 const value={olt:{id:2},serial_number:'TEST00000001'};
 assert.equal(opticalResponseMatches(value,2,'test00000001'),true);
 assert.equal(opticalResponseMatches(value,1,'TEST00000001'),false);
 assert.equal(opticalResponseMatches(value,2,'TEST00000002'),false);
 assert.equal(opticalResponseMatches(null,2,'TEST00000001'),false);
});
