import test from 'node:test';
import assert from 'node:assert/strict';
import { healthStatus, healthTime } from '../../resources/js/lib/monitoringHealth.js';

test('missing, stale and legacy states never become healthy',()=>{
  for(const status of [null, undefined, '', 'ACTIVE', 'OK', 'UNKNOWN', 'STALE', 'UNVERIFIED'])assert.notEqual(healthStatus(status).tone,'good');
});
test('process, transport, acquisition and freshness have different labels',()=>{
  assert.equal(new Set(['RUNNING','RESPONDING','SUCCESS','FRESH'].map(s=>healthStatus(s).label)).size,4);
  assert.equal(healthStatus('AVAILABLE').tone,'warning');
  assert.equal(healthStatus('PATH_UNAVAILABLE').tone,'bad');
});
test('partial read and unavailable power are never labeled complete',()=>{
  assert.notEqual(healthStatus('PARTIAL').label,healthStatus('SUCCESS').label);
  assert.equal(healthStatus('PARTIAL').tone,'warning');
});
test('unknown times never become now',()=>{
  assert.equal(healthTime(null),'Belum tercatat');assert.equal(healthTime('invalid'),'Belum tercatat');
  assert.match(healthTime('2026-10-15T13:00:00Z'),/20[.:]00/);
});
