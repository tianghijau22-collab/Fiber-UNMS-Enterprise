import test from 'node:test';
import assert from 'node:assert/strict';
import {vpnPingSeries} from '../../resources/js/lib/monitoringHealth.js';

test('repeated cached ping values keep one point at the measurement time',()=>{
  const point={vpn_sampled_at:'2026-10-15T13:00:00Z',vpn_ping_status:'RESPONDING',vpn_latency_ms:27.5};
  const data=vpnPingSeries([point,{...point,time:'20:00:05'}]);assert.equal(data.values.length,1);assert.equal(data.values[0],27.5);
});
test('failed ping is a gap, legacy undated data is omitted and measured zero remains valid',()=>{
  const data=vpnPingSeries([{vpn_latency_ms:10},{vpn_sampled_at:'invalid',vpn_latency_ms:20},
    {vpn_sampled_at:'2026-10-15T13:00:00Z',vpn_ping_status:'RESPONDING',vpn_latency_ms:0},
    {vpn_sampled_at:'2026-10-15T13:00:12Z',vpn_ping_status:'NO_RESPONSE',vpn_latency_ms:null}]);
  assert.deepEqual(data.values,[0,null]);
});
