import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createWorkspace } from '../core/catalog.mjs';

export function createStore(directory) {
  mkdirSync(resolve(directory), { recursive: true });
  const db = new DatabaseSync(resolve(directory, 'workspace.db'));
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, version INTEGER NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL);');
  const get = db.prepare('SELECT payload FROM workspaces WHERE id = ?');
  const insert = db.prepare('INSERT INTO workspaces (id, version, payload, updated_at) VALUES (?, ?, ?, ?)');
  const update = db.prepare('UPDATE workspaces SET version = ?, payload = ?, updated_at = ? WHERE id = ? AND version = ?');
  return {
    load(id) {
      const row = get.get(id);
      if (row) return JSON.parse(row.payload);
      const state = createWorkspace();
      insert.run(id, state.version, JSON.stringify(state), new Date().toISOString());
      return state;
    },
    save(id, state, previousVersion) {
      const result = update.run(state.version, JSON.stringify(state), new Date().toISOString(), id, previousVersion);
      return result.changes === 1;
    },
    close() { db.close(); },
  };
}
