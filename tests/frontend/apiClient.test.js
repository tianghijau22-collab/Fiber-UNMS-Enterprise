import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { isSameOriginApi, prepareApiRequest, installApiClient } from '../../resources/js/lib/apiClient.js';

const origin = 'https://fona.example.test/dashboard';

test('only the same origin API receives session handling', () => {
  assert.equal(isSameOriginApi('/api/customers', origin), true);
  assert.equal(isSameOriginApi(new URL('https://fona.example.test/api/auth/me'), origin), true);
  assert.equal(isSameOriginApi(new Request('https://fona.example.test/api/customers'), origin), true);
  assert.equal(isSameOriginApi('https://thirdparty.example.test/api/data', origin), false);
  assert.equal(isSameOriginApi('/api-docs', origin), false);
  assert.equal(isSameOriginApi('/assets/logo.png', origin), false);
});

test('writes use the latest encrypted CSRF cookie and remove legacy identity claims', () => {
  const options = prepareApiRequest('/api/auth/profile', {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-User-Id': '1', 'X-User-Name': 'Admin', 'X-User-Role': 'Super Administrator', 'X-CSRF-TOKEN': 'stale-meta' },
    body: '{"name":"Changed"}',
  }, origin, 'other=value; XSRF-TOKEN=encrypted%2Bcookie%3D; more=test');
  assert.equal(options.headers.get('X-XSRF-TOKEN'), 'encrypted+cookie=');
  for (const name of ['X-User-Id', 'X-User-Name', 'X-User-Role', 'X-CSRF-TOKEN']) assert.equal(options.headers.has(name), false);
  assert.equal(options.headers.get('Content-Type'), 'application/json');
  assert.equal(options.headers.get('Accept'), 'application/json');
  assert.equal(options.credentials, 'same-origin');
  assert.equal(options.body, '{"name":"Changed"}');
});

test('Request objects retain their headers and method when adding CSRF', () => {
  const request = new Request('https://fona.example.test/api/network-nodes', { method: 'POST', headers: { 'X-Test': 'kept', 'X-User-Id': '1' } });
  const options = prepareApiRequest(request, {}, origin, 'XSRF-TOKEN=fresh');
  assert.equal(options.headers.get('X-Test'), 'kept');
  assert.equal(options.headers.get('X-XSRF-TOKEN'), 'fresh');
  assert.equal(options.headers.has('X-User-Id'), false);
  const read = prepareApiRequest('/api/network-nodes', {}, origin, 'XSRF-TOKEN=fresh');
  assert.equal(read.headers.has('X-XSRF-TOKEN'), false);
});

test('external requests receive no credentials or CSRF injected by the wrapper', () => {
  const original = { method: 'POST', headers: { 'X-Example': 'value' } };
  assert.equal(prepareApiRequest('https://thirdparty.example.test/api/data', original, origin, 'XSRF-TOKEN=secret'), original);
});

test('fetch and Axios enforce session expiry and preserve mutation notifications', async () => {
  const events = [];
  const calls = [];
  let status = 200;
  let body = '{}';
  globalThis.window = {
    location: { href: origin },
    dispatchEvent: event => events.push(event),
    fetch: async (input, init) => { calls.push({ input, init }); return new Response(body, { status }); },
  };
  globalThis.document = { cookie: 'XSRF-TOKEN=fresh-cookie' };
  installApiClient();
  await window.fetch('/api/tickets', { method: 'POST' });
  assert.equal(calls[0].init.headers.get('X-XSRF-TOKEN'), 'fresh-cookie');
  assert.equal(events[0].type, 'unms:data-mutated');
  assert.equal(events[0].detail.method, 'POST');
  status = 401;
  await window.fetch('/api/auth/me');
  assert.equal(events.at(-1).type, 'fona:session-expired');
  status = 403;
  const beforeForbidden = events.length;
  await window.fetch('/api/users');
  assert.equal(events.length, beforeForbidden);
  body = '{"code":"ACCOUNT_INACTIVE"}';
  const inactive = await window.fetch('/api/auth/me');
  assert.equal(events.length, beforeForbidden + 1);
  assert.equal((await inactive.json()).code, 'ACCOUNT_INACTIVE');
  const count = events.length;
  await window.fetch('/api/auth/login', { method: 'POST' });
  await window.fetch('https://thirdparty.example.test/api/me');
  assert.equal(events.length, count);
  status = 419;
  await window.fetch('/api/tickets', { method: 'POST' });
  assert.equal(events.at(-1).type, 'fona:session-expired');
  const requestInterceptor = axios.interceptors.request.handlers.at(-1).fulfilled;
  const config = requestInterceptor({ url: '/api/tickets', headers: { 'X-User-Id': '1', 'X-CSRF-TOKEN': 'stale' } });
  assert.equal(config.headers.has('X-User-Id'), false);
  assert.equal(config.headers.has('X-CSRF-TOKEN'), false);
  assert.equal(config.withXSRFToken, true);
  const foreign = { url: 'https://thirdparty.example.test/api/me', headers: {} };
  assert.equal(requestInterceptor(foreign), foreign);
  const errorInterceptor = axios.interceptors.response.handlers.at(-1).rejected;
  const error = { config: { url: '/api/tickets' }, response: { status: 401 } };
  await assert.rejects(errorInterceptor(error), caught => caught === error);
  assert.equal(events.at(-1).type, 'fona:session-expired');
});
