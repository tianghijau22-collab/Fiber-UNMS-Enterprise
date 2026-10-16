import test from 'node:test';
import assert from 'node:assert/strict';
import { onuPresentation, nodeTelemetryState, opticalDisplaySummary } from '../../resources/js/lib/onuTelemetry.js';

const known = { telemetry_contract: 1, identity_status: 'resolved', gpon_interface: 'gpon-olt_1/1/16', is_online: true, rx_available: true, rx_power: -26.2 };
test('zero/null/old API values do not imply an operational status', () => {
  for (const rx of [0, null, -20, -40]) assert.equal(onuPresentation({ rx_power: rx, status: 'Online' }).online, null);
  assert.equal(onuPresentation({ ...known, is_online: false }).rxLabel, 'N/A');
  assert.equal(onuPresentation({ ...known, is_online: null, telemetry_freshness: 'stale' }).label, 'Offline');
});
test('working without optical data displays Offline without changing hardware state', () => {
  for (const rx of [null, '', NaN]) {
    const out = onuPresentation({ ...known, rx_power: rx, rx_available: false });
    assert.equal(out.label, 'Offline'); assert.equal(out.hardwareOnline,true); assert.equal(out.rxLabel, 'N/A');
  }
  assert.equal(onuPresentation({ ...known, rx_power: -36 }).online, true);
  assert.equal(onuPresentation(known).rxLabel, '-26.20 dBm');
});
test('an ODP uplink can never replace an unresolved customer interface', () => {
  const out = onuPresentation({ ...known, identity_status: 'unresolved', olt_port_ref: '1/1/15' });
  assert.equal(out.interfaceLabel, 'Belum terverifikasi');
  assert.equal(onuPresentation(known).interfaceLabel, 'gpon-olt_1/1/16');
});
test('unknown GIS clients are not all-offline even with zero known online clients', () => {
  const node = { telemetry_contract: 1, node_type: 'ODP', total_clients: 8, online_clients: 0, unknown_clients: 8, is_loss_total: false };
  assert.equal(nodeTelemetryState(node), 'unknown');
  assert.equal(nodeTelemetryState({ ...node, unknown_clients: 0, is_loss_total: true }), 'offline');
  assert.equal(nodeTelemetryState({ ...node, total_clients: 0 }), 'empty');
});
test('N/A display policy never mutates the original hardware observation',()=>{
  const input=Object.freeze({...known,rx_available:false,rx_power:null});
  const d=onuPresentation(input);
  assert.equal(d.label,'Offline');assert.equal(d.online,false);assert.equal(d.hardwareOnline,true);assert.equal(d.offlineByRx,true);
  assert.equal(input.is_online,true);assert.equal(input.rx_available,false);assert.equal(input.rx_power,null);
});
test('probe display totals match Offline rows while unreturned targets remain unread',()=>{
  const rows=[known,{...known,rx_power:null,rx_available:false},{...known,is_online:false}];
  assert.deepEqual(opticalDisplaySummary(rows,4),{online_count:1,down_count:2,unknown_count:1});
  assert.equal(rows[1].is_online,true);
});
