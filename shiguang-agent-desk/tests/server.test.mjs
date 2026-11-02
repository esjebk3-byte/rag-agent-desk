import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, basename, dirname } from 'node:path';
import { createApp } from '../server/index.mjs';

async function fixture(fn) {
  const directory = await mkdtemp(join(tmpdir(), 'shiguang-test-'));
  const server = createApp({ dataDir: directory, env: {} });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try { await fn(url); }
  finally {
    await new Promise(resolve => server.close(resolve));
    const absolute = resolve(directory);
    if (dirname(absolute) !== resolve(tmpdir()) || !basename(absolute).startsWith('shiguang-test-')) throw new Error('Unexpected cleanup target');
    await rm(absolute, { recursive: true, force: true });
  }
}

test('HTTP API persists independent sessions, filters orders and checks versions', () => fixture(async url => {
  const first = await fetch(url + '/api/workspace');
  const cookie = first.headers.get('set-cookie').split(';')[0];
  const initial = (await first.json()).state;
  assert.equal(initial.orders.length, 3);
  const response = await fetch(url + '/api/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ type: 'message', message: '我要退货', version: initial.version }) });
  assert.equal(response.status, 200); const next = (await response.json()).state;
  const reloaded = (await (await fetch(url + '/api/workspace', { headers: { Cookie: cookie } })).json()).state;
  assert.equal(reloaded.version, next.version); assert.equal(reloaded.conversations[0].task.intent, 'return');
  const stranger = (await (await fetch(url + '/api/workspace')).json()).state;
  assert.equal(stranger.conversations[0].messages.length, 0);
  const stale = await fetch(url + '/api/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ type: 'message', message: 'SG10002', version: initial.version }) });
  assert.equal(stale.status, 409);
}));

test('server does not serve environment, database, server code or cross-origin writes', () => fixture(async url => {
  for (const path of ['/.env', '/server/model.mjs', '/data/workspace.db', '/package.json']) assert.equal((await fetch(url + path)).status, 404);
  const res = await fetch(url + '/api/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://other.invalid' }, body: '{}' });
  assert.equal(res.status, 403);
  assert.equal((await fetch(url + '/')).status, 200);
}));

test('full HTTP confirmation flow creates one application and can be reloaded', () => fixture(async url => {
  const first = await fetch(url + '/api/workspace');
  const cookie = first.headers.get('set-cookie').split(';')[0];
  let state = (await first.json()).state;
  const send = async input => {
    const response = await fetch(url + '/api/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ ...input, version: state.version }) });
    assert.equal(response.status, 200); const outcome = await response.json(); state = outcome.state; return outcome;
  };
  await send({ type: 'message', message: '我要退货' });
  await send({ type: 'message', message: 'SG10002' });
  await send({ type: 'message', message: '杯子漏水' });
  assert.equal(state.applications.length, 0);
  const id = state.conversations[0].pending.id;
  await send({ type: 'confirm', actionId: id });
  await send({ type: 'confirm', actionId: id });
  assert.equal(state.applications.length, 1);
  assert.equal(state.applications[0].status, 'requested');
}));
