import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config, ROOT } from './config.js';

let db = null;

export function getDb() {
  if (db) return db;
  fs.mkdirSync(path.dirname(config.databaseFile), { recursive: true });
  db = new Database(config.databaseFile);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const schema = fs.readFileSync(path.join(ROOT, 'server', 'schema.sql'), 'utf8');
  db.exec(schema);
  return db;
}

/** Keep the FTS index in step with the simulations table. */
export function reindexSimulation(id) {
  const d = getDb();
  const row = d.prepare('SELECT * FROM simulations WHERE id = ?').get(id);
  d.prepare('DELETE FROM simulations_fts WHERE slug = ?').run(row ? row.slug : '');
  if (!row) return;
  d.prepare(
    `INSERT INTO simulations_fts (slug, title, title_en, short_description, description, physics_topics)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(row.slug, row.title, row.title_en, row.short_description, row.description, row.physics_topics);
}

export function rebuildIndex() {
  const d = getDb();
  d.exec('DELETE FROM simulations_fts');
  for (const { id } of d.prepare('SELECT id FROM simulations').all()) reindexSimulation(id);
}

export function closeDb() {
  if (db) { db.close(); db = null; }
}
