import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const types = { '.mjs': 'text/javascript', '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml' };
createServer(async (req, res) => {
  const path = resolve(root, '.' + (decodeURIComponent(new URL(req.url, 'http://localhost').pathname) === '/' ? '/index.html' : decodeURIComponent(new URL(req.url, 'http://localhost').pathname)));
  if (!path.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
  try { if (!(await stat(path)).isFile()) throw new Error(); res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' }); res.end(await readFile(path)); }
  catch { res.writeHead(404); res.end('Not found'); }
}).listen(3189, '127.0.0.1', () => console.log('GitHub Pages demo preview: http://127.0.0.1:3189'));
