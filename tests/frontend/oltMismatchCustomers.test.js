import test from 'node:test';
import assert from 'node:assert/strict';
import { duplicateCustomerTarget, deleteDuplicateCustomer } from '../../resources/js/lib/oltMismatchCustomers.js';

const row = { id: 9001, customer_id: 42, customer_name: 'Pelanggan lama', customer_number: 'CMN 42', onu_serial: 'TEST00000001', issue_code: 'duplicate_customer_serial' };
test('duplicate action targets customer ID, never registration or serial identity', async () => {
  let captured;
  const target = await deleteDuplicateCustomer(row, 'csrf-fixture', async (url, options) => {
    captured = { url, ...options }; return { ok: true, json: async () => ({ status: 'success' }) };
  });
  assert.equal(target.id, 42);
  assert.equal(captured.url, '/api/customers/42');
  assert.equal(captured.method, 'DELETE');
  assert.equal(captured.credentials, 'same-origin');
  assert.equal(captured.headers['X-CSRF-TOKEN'], 'csrf-fixture');
});
test('only valid customer duplicate rows permit the action', async () => {
  for (const changed of [{ customer_id: null }, { customer_id: -1 }, { customer_id: '42/other' }, { customer_id: 2.5 }, { issue_code: 'missing_in_inventory' }, { issue_code: 'ambiguous_identity' }]) {
    const invalid = { ...row, ...changed };
    assert.equal(duplicateCustomerTarget(invalid), null);
    await assert.rejects(deleteDuplicateCustomer(invalid, '', () => { throw new Error('Must not send'); }), /tidak valid/);
  }
});
test('permission rejection and unsuccessful responses cannot report deletion success', async () => {
  await assert.rejects(deleteDuplicateCustomer(row, '', async () => ({ ok: false, json: async () => ({ message: 'Akses ditolak' }) })), /Akses ditolak/);
  await assert.rejects(deleteDuplicateCustomer(row, '', async () => ({ ok: true, json: async () => ({ status: 'error' }) })), /belum berhasil/);
  await assert.rejects(deleteDuplicateCustomer(row, '', async () => ({ ok: false, json: async () => { throw new Error('not JSON'); } })), /belum berhasil/);
});
