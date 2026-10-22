import test from 'node:test';
import assert from 'node:assert/strict';
import { aiInlineTokens, aiEnginePresentation } from '../../resources/js/lib/aiAssistant.js';

test('AI markdown handles supported inline formatting as text tokens', () => {
  const out = aiInlineTokens('Rx **N/A** dan `SN` *contoh* [dokumen](https://example.test/a)');
  assert.equal(out.find(t => t.type === 'strong').text, 'N/A');
  assert.equal(out.find(t => t.type === 'code').text, 'SN');
  assert.equal(out.find(t => t.type === 'link').href, 'https://example.test/a');
});
test('AI links cannot inject event attributes, scripts, credentials, or HTML', () => {
  for (const text of ['[uji](https://example.test/" onpointerenter="this.dataset.audit=1" data-x=")', '[uji](javascript:alert(1))', '[uji](data:text/html,<script>)', '[uji](https://user:secret@example.test)', '<img src=x onerror=alert(1)>', '[uji](https://example.test/\' onclick=\'x)']) {
    const tokens = aiInlineTokens(text);
    assert.equal(tokens.some(t => t.type === 'link'), false, text);
    assert.equal(tokens.map(t => t.text).join(''), text);
  }
});
test('AI configuration never implies healthy cloud connectivity', () => {
  assert.equal(aiEnginePresentation({state:'unverified'}, true, 'groq').tone, 'neutral');
  assert.equal(aiEnginePresentation({state:'degraded',mode:'local_fallback'}, true, 'groq').tone, 'warning');
  assert.match(aiEnginePresentation({state:'degraded',mode:'local_fallback'}, true, 'groq').label, /lokal/);
  assert.equal(aiEnginePresentation({state:'available',mode:'cloud'}, true, 'groq').tone, 'healthy');
});
