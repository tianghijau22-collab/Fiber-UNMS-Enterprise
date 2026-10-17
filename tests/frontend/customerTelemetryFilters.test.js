import test from 'node:test';
import assert from 'node:assert/strict';
import {customerSerialKey, duplicateCustomerSerials, customerMatchesTelemetryFilters as matches, customerPages} from '../../resources/js/lib/customerTelemetryFilters.js';
import {onuPresentation} from '../../resources/js/lib/onuTelemetry.js';

const online = {telemetry_contract:1, identity_status:'resolved', telemetry_freshness:'fresh', is_online:true, rx_available:true, rx_power:-24};
const missing = {...online, rx_available:false, rx_power:null};

test('duplicate serials are normalized across customers and OLTs before other filters', () => {
  const rows = [{id:1, onu_serial:' zteg00000001 ', olt_id:1}, {id:2, onu_serial:'ZTEG00000001', olt_id:2}, {id:3, onu_serial:'ZTEG00000002'}];
  const duplicates=duplicateCustomerSerials(rows);
  assert.deepEqual([...duplicates],['ZTEG00000001']);
  assert.equal(matches(rows[0],{duplicateSn:true},duplicates),true);
  assert.equal(matches(rows[1],{duplicateSn:true},duplicates),true);
  assert.equal(matches(rows[2],{duplicateSn:true},duplicates),false);
  // The matching second customer need not be on the current page or match the current search.
  assert.equal(rows.filter(row=>row.id===1).filter(row=>matches(row,{duplicateSn:true},duplicates)).length,1);
});

test('repeated rows for one customer and empty placeholder serials are not duplicate customers', () => {
  const rows=[{id:1,onu_serial:'TEST00000001'},{id:'1',onu_serial:'TEST00000001'}];
  for(const sn of [null,'','  ','N/A','unknown','—','000000000000'])rows.push({id:2,onu_serial:sn},{id:3,onu_serial:sn});
  assert.deepEqual([...duplicateCustomerSerials(rows)],[]);
  assert.equal(customerSerialKey({onu_serial:'  test00000001 '}),'TEST00000001');
});

test('hardware duplicate evidence qualifies even when only one customer uses the serial', () => {
  assert.equal(matches({id:1,onu_serial:'TEST00000001',serial_duplicate:true},{duplicateSn:true}),true);
  assert.equal(matches({serial_duplicate:'true'},{duplicateSn:true}),false);
});

test('online without Rx uses hardware state while the display policy still says Offline', () => {
  assert.equal(onuPresentation(missing).online,false);
  assert.equal(matches(missing,{onlineNoRx:true}),true);
  assert.equal(matches(online,{onlineNoRx:true}),false);
  for(const is_online of [false,null,undefined])assert.equal(matches({...missing,is_online},{onlineNoRx:true}),false);
});

test('unknown, stale or legacy telemetry is not a current Online/Rx missing sample', () => {
  for(const replacement of [{identity_status:'unresolved'},{telemetry_freshness:'stale'},{telemetry_freshness:'unavailable'},{telemetry_contract:undefined}]) {
    assert.equal(matches({...missing,...replacement},{onlineNoRx:true}),false);
  }
});

test('valid measured zero is available; invalid optical values do not masquerade as readings', () => {
  assert.equal(matches({...online,rx_power:0},{onlineNoRx:true}),false);
  for(const rx_power of [null,'',-40,65535,NaN])assert.equal(matches({...online,rx_power},{onlineNoRx:true}),true);
});

test('two special filters intersect and clearing both preserves all rows without modifying source data', () => {
  const rows=[{id:1,onu_serial:'TEST00000001',...online},{id:2,onu_serial:'TEST00000001',...missing},{id:3,onu_serial:'TEST00000003',...missing}];
  const before=structuredClone(rows);const duplicates=duplicateCustomerSerials(rows);
  assert.deepEqual(rows.filter(r=>matches(r,{duplicateSn:true,onlineNoRx:true},duplicates)).map(r=>r.id),[2]);
  assert.equal(rows.filter(r=>matches(r,{},duplicates)).length,3);
  assert.deepEqual(rows,before);
});

test('duplicate membership and optical availability follow replacement stored data', () => {
  const a={id:1,onu_serial:'TEST00000001',...missing};const b={id:2,onu_serial:'TEST00000001',...online};
  assert.equal(matches(a,{duplicateSn:true,onlineNoRx:true},duplicateCustomerSerials([a,b])),true);
  assert.equal(matches(a,{duplicateSn:true},duplicateCustomerSerials([a])),false);
  assert.equal(matches({...a,...online},{onlineNoRx:true}),false);
});

test('duplicate serial customers stay adjacent in serial order with their original intra-group order', () => {
  const rows=[{id:6,onu_serial:'TEST00000002'},{id:5,onu_serial:' test00000001 '},{id:4,onu_serial:'TEST00000002'},{id:3,onu_serial:'TEST00000001'}];
  const before=structuredClone(rows);
  assert.deepEqual(customerPages(rows,8,true).flat().map(c=>c.id),[5,3,6,4]);
  assert.deepEqual(rows,before);
});

test('a duplicate group crosses the nominal page boundary together rather than splitting', () => {
  const rows=Array.from({length:9},(_,id)=>({id,onu_serial:'TEST0000000'+(id%3+1)}));
  const pages=customerPages(rows,8,true);
  assert.deepEqual(pages.map(p=>p.length),[6,3]);
  for(const serial of duplicateCustomerSerials(rows))assert.equal(pages.filter(p=>p.some(c=>customerSerialKey(c)===serial)).length,1);
  assert.equal(pages.flat().length,rows.length);
});

test('a serial with more than eight customers remains on one page without empty pages', () => {
  const rows=[...Array.from({length:10},(_,id)=>({id,onu_serial:'TEST00000001'})),{id:11,onu_serial:'TEST00000002'},{id:12,onu_serial:'TEST00000002'}];
  assert.deepEqual(customerPages(rows,8,true).map(p=>p.length),[10,2]);
});

test('normal pagination retains source order when the duplicate filter is disabled', () => {
  const rows=Array.from({length:10},(_,id)=>({id,onu_serial:id%2?'TEST00000001':'TEST00000002'}));
  assert.deepEqual(customerPages(rows,8,false).map(p=>p.map(c=>c.id)),[[0,1,2,3,4,5,6,7],[8,9]]);
  assert.deepEqual(customerPages([],8,true),[[]]);
  assert.deepEqual(customerPages([],8,false),[[]]);
});

test('grouped pages retain only already filtered customers and preserve every unnumbered row', () => {
  const rows=[{id:1,...missing,onu_serial:'TEST00000001'},{id:2,...online,onu_serial:'TEST00000001'},{id:3,...missing,onu_serial:'TEST00000002'}];
  const selected=rows.filter(c=>matches(c,{onlineNoRx:true}));
  assert.deepEqual(customerPages(selected,8,true).flat().map(c=>c.id),[1,3]);
  const emptySerials=[{id:4},{id:5,onu_serial:'N/A'}];
  assert.equal(customerPages(emptySerials,1,true).length,2);
});
