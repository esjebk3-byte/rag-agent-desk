import test from 'node:test';
import assert from 'node:assert/strict';
import { createModel } from '../server/model.mjs';

test('model adapter defaults off without an explicit enable flag and key', () => {
  assert.equal(createModel({}), null);
  assert.equal(createModel({ MODEL_ENABLED: 'true' }), null);
});

test('model adapter builds server-side chat requests and reports provider usage', async () => {
  const originalFetch = globalThis.fetch;
  let observed;
  globalThis.fetch = async (url, options) => {
    observed = { url, options };
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"intent":"policy"}' } }], usage: { total_tokens: 9 } }), { headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const model = createModel({ MODEL_ENABLED: 'true', MODEL_API_KEY: 'dummy-test-value', MODEL_BASE_URL: 'https://example.invalid/v1', MODEL_NAME: 'test-model' });
    const result = await model.complete('supervisor', 'test system', 'test user', { json: true });
    assert.equal(observed.url, 'https://example.invalid/v1/chat/completions');
    assert.equal(observed.options.headers.Authorization, 'Bearer dummy-test-value');
    const body = JSON.parse(observed.options.body);
    assert.equal(body.model, 'test-model'); assert.equal(body.response_format.type, 'json_object');
    assert.deepEqual(body.messages.map(m => m.role), ['system', 'user']);
    assert.equal(result.usage.total_tokens, 9);
    assert.ok(!JSON.stringify(result).includes('dummy-test-value'));
  } finally { globalThis.fetch = originalFetch; }
});

test('provider failures surface to agent fallback without exposing provider response content', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('private provider details', { status: 503 });
  try {
    const model = createModel({ MODEL_ENABLED: 'true', MODEL_API_KEY: 'dummy-test-value' });
    await assert.rejects(() => model.complete('knowledge', 'system', 'user'), /HTTP 503/);
  } finally { globalThis.fetch = originalFetch; }
});
