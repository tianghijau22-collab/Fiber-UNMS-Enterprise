import test from 'node:test';
import assert from 'node:assert/strict';
import {inventoryTelemetry,onuPresentation,inventoryMatchesFilter,inventoryOpticalStats} from '../../resources/js/lib/onuTelemetry.js';
const now=Date.parse('2026-10-15T14:00:00Z');
const row={telemetry_sample_version:2,sample_observed_at:'2026-10-15T13:59:50Z',state_observed_at:'2026-10-15T13:59:50Z',rx_observed_at:'2026-10-15T13:59:50Z',identity_source:'snmp_serial_table_v2',identity_observed_at:'2026-10-15T13:59:50Z',port:'gpon-olt_1/1/16',onu_id:'1',is_online:true,rx_available:true,rx_power:-26.2};
test('inventory displays N/A as Offline and aligns row filters',()=>{
 const value={...row,rx_power:null,rx_available:false,rx_observed_at:null};
 const out=onuPresentation(inventoryTelemetry(value,now));assert.equal(out.label,'Offline');assert.equal(out.rxLabel,'N/A');
 assert.equal(inventoryMatchesFilter(value,'online',now),false);assert.equal(inventoryMatchesFilter(value,'los',now),true);
 assert.equal(inventoryMatchesFilter(value,'warning',now),false);assert.equal(inventoryMatchesFilter(value,'rx_missing',now),true);
});
test('raw inventory remains unknown while unavailable readings display Offline',()=>{
 for(const value of [{status:'Online',rx_power:-20,polled_at:'2026-10-15T14:00:00Z'}, {...row,is_online:null}, {...row,sample_observed_at:'2026-10-15T13:50:00Z'}]) {
  assert.equal(inventoryTelemetry(value,now).is_online,null);assert.equal(inventoryMatchesFilter(value,'los',now),true);assert.equal(inventoryMatchesFilter(value,'unknown',now),false);
 }
});
test('weak measured signal remains online and measured zero is retained',()=>{
 assert.equal(onuPresentation(inventoryTelemetry({...row,rx_power:-39},now)).rxLabel,'-39.00 dBm');
 assert.equal(inventoryMatchesFilter({...row,rx_power:-39},'online',now),true);
 assert.equal(inventoryTelemetry({...row,rx_power:0},now).rx_power,0);
});
test('old state and Rx observations have their own validity boundaries',()=>{
 assert.equal(inventoryTelemetry({...row,rx_observed_at:'2026-10-15T13:50:00Z'},now).rx_power,null);
 assert.equal(inventoryTelemetry({...row,state_observed_at:'2026-10-15T13:50:00Z'},now).is_online,null);
 assert.equal(inventoryTelemetry({...row,identity_observed_at:'2026-10-15T13:40:00Z'},now).is_online,null);
});
test('optical summary accounts for unknown and missing Rx separately from verified loss',()=>{
 const out=inventoryOpticalStats([row,{...row,is_online:false},{...row,is_online:null},{...row,rx_power:null,rx_available:false}],now);
 assert.equal(out.total,4);assert.equal(out.warning,1);assert.equal(out.los,3);assert.equal(out.unknown,0);assert.equal(out.rxMissing,0);assert.equal(out.offlineByRx,2);
 assert.equal(out.losPct,75);assert.equal(out.unknownPct,0);
});
