import { createWorkspace, publicWorkspace } from '../core/catalog.mjs';
import { processCommand } from '../core/engine.mjs';

const KEY = 'shiguang-workspace-v1';
let accessCode = '';
export function setAccessCode(code) { accessCode = code; }

export async function createTransport() {
  const staticOnly = document.querySelector('meta[name="runtime"]')?.content === 'browser';
  if (!staticOnly) {
    let response;
    try { response = await fetch(new URL('../api/config', import.meta.url), { signal: AbortSignal.timeout(2500) }); } catch { /* A plain static host has no API. */ }
    if (response?.ok && response.headers.get('content-type')?.includes('application/json')) {
      const config = await response.json();
      if (config.runtime === 'server') {
        const url = new URL('../api/workspace', import.meta.url);
        async function parse(res) {
          const body = await res.json();
          if (!res.ok) { const error = new Error(body.error || '操作失败'); error.code = body.code; error.state = body.state; throw error; }
          return body;
        }
        return { config, async load() { return parse(await fetch(url)); }, async send(command) { return parse(await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Model-Access-Code': accessCode }, body: JSON.stringify(command) })); } };
      }
    } else if (response && response.status >= 500) throw new Error('服务端暂不可用，请稍后刷新。');
  }
  function read() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved?.schema === 1 && Array.isArray(saved.conversations) && saved.buyerId === 'demo-buyer') return saved;
    } catch { /* Recover malformed device-local demo data. */ }
    const state = createWorkspace();
    localStorage.setItem(KEY, JSON.stringify(state));
    return state;
  }
  return {
    config: { runtime: 'browser', mode: 'demo', storage: '浏览器本地', model: null },
    async load() { return { state: publicWorkspace(read()) }; },
    async send(command) {
      const current = read();
      if (command.version !== current.version) { const error = new Error('数据已在其他页面更新，请重试。'); error.state = publicWorkspace(current); throw error; }
      let outcome;
      if (command.type === 'reset') { const state = createWorkspace(); state.version = current.version + 1; outcome = { state }; }
      else outcome = await processCommand(current, command);
      // Browser storage is the demo persistence boundary; surface quota failures.
      localStorage.setItem(KEY, JSON.stringify(outcome.state));
      return { ...outcome, state: publicWorkspace(outcome.state) };
    },
  };
}
