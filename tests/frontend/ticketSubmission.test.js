import test from 'node:test';
import assert from 'node:assert/strict';
import { ticketSubmissionAttempt } from '../../resources/js/lib/ticketSubmission.js';

test('a retry after a missing response retains the exact key and request body', () => {
  const first = ticketSubmissionAttempt(null, '{"title":"Gangguan"}', () => 'request-1');
  assert.strictEqual(ticketSubmissionAttempt(first, first.body, () => { throw new Error('must not create another key'); }), first);
});
test('changing a request with an unknown outcome cannot silently create another ticket', () => {
  const first = ticketSubmissionAttempt(null, '{"title":"Gangguan"}', () => 'request-1');
  assert.throws(() => ticketSubmissionAttempt(first, '{"title":"Lain"}'), /Periksa daftar tiket/);
});
test('a new form after confirmed completion gets a distinct request identity', () => {
  assert.equal(ticketSubmissionAttempt(null, '{}', () => 'request-2').key, 'request-2');
});
