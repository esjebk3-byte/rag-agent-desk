import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = [];
function scan(path) { for (const item of readdirSync(path, { withFileTypes: true })) { if (item.name.startsWith('.') || ['data', 'dist', 'node_modules', 'outputs'].includes(item.name)) continue; const target = resolve(path, item.name); if (item.isDirectory()) scan(target); else if (item.name.endsWith('.mjs')) files.push(target); } }
scan(root);
for (const file of files) { const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' }); if (result.status) { process.stderr.write(result.stderr); process.exit(1); } }
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
if (!html.includes('lang="zh-CN"') || !html.includes('viewport')) throw new Error('HTML metadata missing');
console.log(`Syntax verified: ${files.length} JavaScript modules.`);
