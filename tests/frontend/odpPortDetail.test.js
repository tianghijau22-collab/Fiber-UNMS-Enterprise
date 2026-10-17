import test from 'node:test';
import assert from 'node:assert/strict';
import { loadOdpPortDetail } from '../../resources/js/lib/odpPortDetail.js';

test('busy optional telemetry still returns all eight physical ports and original samples', async () => {
  const data = { node: { id: 12 }, ports: Array.from({ length: 8 }, (_, i) => ({ id: i + 1, sampled_at: '2026-10-17T07:00:00Z' })), live_probe: { success: false, reason_code: 'olt_busy' } };
  let request;
  const result = await loadOdpPortDetail(12, true, async (...args) => {
    request = args;
    return { ok: true, json: async () => data };
  });
  assert.equal(result, data);
  assert.equal(result.ports.length, 8);
  assert.equal(result.ports[0].sampled_at, '2026-10-17T07:00:00Z');
  assert.equal(request[0], '/api/network-nodes/12/port-detail?live=1');
  assert.equal(request[1].headers.Accept, 'application/json');
});

test('failed HTTP requests cannot be mistaken for a successful empty port list', async () => {
  for (const status of [401, 403, 423, 500, 503]) {
    await assert.rejects(loadOdpPortDetail(12, false, async () => ({ ok: false, status })), /ditolak|gagal/);
  }
});

test('invalid JSON, mismatched ODP and absent port arrays are errors, while genuine empty lists remain valid', async () => {
  for (const data of [null, {}, { node: { id: 99 }, ports: [] }, { node: { id: 12 }, ports: null }]) {
    await assert.rejects(loadOdpPortDetail(12, false, async () => ({ ok: true, json: async () => data })), /tidak valid/);
  }
  await assert.rejects(loadOdpPortDetail(12, false, async () => ({ ok: true, json: async () => { throw new SyntaxError('Invalid JSON'); } })));
  const empty = { node: { id: 12 }, ports: [] };
  assert.equal(await loadOdpPortDetail(12, false, async () => ({ ok: true, json: async () => empty })), empty);
});
