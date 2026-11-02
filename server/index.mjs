import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, extname, sep } from 'node:path';
import { createStore } from './store.mjs';
import { createModel } from './model.mjs';
import { createWorkspace, publicWorkspace } from '../core/catalog.mjs';
import { processCommand } from '../core/engine.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8' };

export function createApp({ dataDir = resolve(ROOT, 'data'), env = process.env } = {}) {
  const store = createStore(dataDir);
  const model = createModel(env);
  const limits = new Map();
  function json(res, code, body, headers = {}) {
    res.writeHead(code, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store', ...headers });
    res.end(JSON.stringify(body));
  }
  function session(req, res) {
    const raw = (req.headers.cookie || '').match(/(?:^|;\s*)sg_session=([a-f0-9]{64})(?:;|$)/)?.[1];
    if (raw) return raw;
    const id = randomBytes(32).toString('hex');
    const secure = req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https';
    res.setHeader('Set-Cookie', `sg_session=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${secure ? '; Secure' : ''}`);
    return id;
  }
  async function body(req) {
    const chunks = [];
    let length = 0;
    for await (const chunk of req) { length += chunk.length; if (length > 16000) throw new Error('BODY_TOO_LARGE'); chunks.push(chunk); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  function accessAllowed(req) {
    const configured = env.MODEL_ACCESS_CODE || '';
    if (!model || !configured) return !model || ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    const value = String(req.headers['x-model-access-code'] || '');
    const a = Buffer.from(value), b = Buffer.from(configured);
    return a.length === b.length && timingSafeEqual(a, b);
  }
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'self'");
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/config') return json(res, 200, { runtime: 'server', mode: model ? 'model' : 'demo', model: model?.name || null, storage: 'SQLite', accessRequired: Boolean(model && env.MODEL_ACCESS_CODE) });
      if (url.pathname === '/api/workspace') {
        const id = session(req, res);
        const current = store.load(id);
        if (req.method === 'GET') return json(res, 200, { state: publicWorkspace(current) });
        if (req.method !== 'POST') return json(res, 405, { error: '不支持的请求方法' });
        const origin = req.headers.origin;
        if (origin && new URL(origin).host !== req.headers.host || req.headers['sec-fetch-site'] === 'cross-site') return json(res, 403, { error: '请求来源不匹配' });
        const input = await body(req);
        if (!['message', 'confirm', 'abort', 'new_conversation', 'select_conversation', 'reset'].includes(input.type)) return json(res, 400, { error: '无效操作' });
        if (input.version !== current.version) return json(res, 409, { error: '会话已在其他页面更新，请重试。', state: publicWorkspace(current) });
        const budget = limits.get(id) || { start: Date.now(), count: 0 };
        if (Date.now() - budget.start > 60000) { budget.start = Date.now(); budget.count = 0; }
        budget.count++; limits.set(id, budget);
        if (limits.size > 2000) for (const [key, value] of limits) if (Date.now() - value.start > 60000) limits.delete(key);
        if (budget.count > 20) return json(res, 429, { error: '操作较频繁，请一分钟后再试。' });
        if (input.type === 'message' && (typeof input.message !== 'string' || !input.message.trim() || input.message.length > 2000)) return json(res, 400, { error: '请输入1至2000字的咨询内容' });
        if (input.type === 'reset') {
          const state = createWorkspace(); state.version = current.version + 1;
          if (!store.save(id, state, current.version)) return json(res, 409, { error: '并发更新，请刷新后重试' });
          return json(res, 200, { state: publicWorkspace(state) });
        }
        if (model && !accessAllowed(req)) return json(res, 401, { error: '请输入模型访问口令。口令在服务端配置，不是模型API Key。', code: 'ACCESS_REQUIRED' });
        const outcome = await processCommand(current, input, { model });
        if (!store.save(id, outcome.state, current.version)) return json(res, 409, { error: '同时发起了其他操作，本次未写入，请刷新后重试。' });
        return json(res, 200, { state: publicWorkspace(outcome.state), response: outcome.response });
      }
      if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { error: '不支持的请求方法' });
      const pathname = decodeURIComponent(url.pathname);
      if (pathname !== '/' && pathname !== '/index.html' && pathname !== '/favicon.svg' && !pathname.startsWith('/web/') && !pathname.startsWith('/core/')) return json(res, 404, { error: '页面不存在' });
      const file = resolve(ROOT, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(ROOT + sep)) return json(res, 403, { error: '路径无效' });
      const info = await stat(file).catch(() => null);
      if (!info?.isFile()) return json(res, 404, { error: '资源不存在' });
      const content = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      if (error instanceof SyntaxError) return json(res, 400, { error: '请求格式错误' });
      if (error.message === 'BODY_TOO_LARGE') return json(res, 413, { error: '请求内容过长' });
      console.error('[request_failed]', error.message);
      return json(res, 500, { error: '服务暂时无法完成操作，请稍后重试。' });
    }
  });
  server.on('close', () => store.close());
  return server;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const port = Number(process.env.PORT) || 3188;
  const host = process.env.HOST || '127.0.0.1';
  const server = createApp({ dataDir: resolve(process.env.DATA_DIR || resolve(ROOT, 'data')) });
  server.listen(port, host, () => console.log(`拾光客服已启动：http://${host}:${port}\n模式：${process.env.MODEL_ENABLED === 'true' && process.env.MODEL_API_KEY ? '服务端模型' : '规则演示'} · 数据保存到本机SQLite`));
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
