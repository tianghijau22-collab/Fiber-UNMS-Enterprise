import test from 'node:test';
import assert from 'node:assert/strict';
import { odpCustomerPorts, currentOdpCustomerTelemetry } from '../../resources/js/lib/gisOdpCustomers.js';
import { onuPresentation } from '../../resources/js/lib/onuTelemetry.js';

test('ODP customer list keeps occupied unlinked ports, omits empty ports, and sorts port numbers numerically', () => {
  const ports = [{id:1,port_number:'10',customer_id:12},{id:2,port_number:'2',customer_service_id:21},
    {id:3,port_number:'3',customer_name_cache:'Legacy customer'},{id:4,port_number:'4',status:'used'},
    {id:5,port_number:'5',status:'available'}];
  assert.deepEqual(odpCustomerPorts(ports).map(p => p.id), [2,3,4,1]);
  assert.equal(ports[0].id, 1);
});

test('different customers with the same SN remain separate entries', () => {
  assert.equal(odpCustomerPorts([{id:1,customer_id:1,onu_serial:'ZTEG12345678'}, {id:2,customer_id:2,onu_serial:'ZTEG12345678'}]).length,2);
});

const now=Date.parse('2026-10-18T10:00:00Z');
const value={telemetry_contract:1,is_online:true,rx_available:true,rx_power:-22.148,sampled_at:new Date(now).toISOString()};
test('fresh stored Rx uses shared display precision and N/A retains Offline policy', () => {
  assert.equal(onuPresentation(currentOdpCustomerTelemetry(value,now)).rxLabel,'-22.15 dBm');
  const missing=currentOdpCustomerTelemetry({...value,rx_available:false,rx_power:null},now);
  assert.equal(onuPresentation(missing).rxLabel,'N/A');
  assert.equal(onuPresentation(missing).label,'Offline');
});

test('expired, invalid, absent and future sample timestamps cannot keep displaying old Rx', () => {
  for(const sampled_at of [new Date(now-180001).toISOString(),'bad',null,new Date(now+5001).toISOString()]) {
    const row=currentOdpCustomerTelemetry({...value,sampled_at},now);
    assert.equal(row.rx_available,false);
    assert.equal(onuPresentation(row).rxLabel,'N/A');
    assert.equal(row.telemetry_freshness,'stale');
  }
  assert.equal(value.rx_power,-22.148);
});
