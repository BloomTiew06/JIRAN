import { DatabaseSync } from 'node:sqlite';
import { TABLES, seedStore, type Collection, type Store, type TableName } from '@jiran/core';

/**
 * SQLite-backed store for the prototype (Node's built-in node:sqlite, no
 * native build step). Each collection is a table of JSON rows, cached in
 * memory and written through on every change. For production, swap this for
 * the PostgreSQL schema in apps/server/db/schema.postgres.sql.
 */
class SqliteCollection<T extends { id: string }> implements Collection<T> {
  private cache = new Map<string, T>();
  private ins;
  private upd;
  private del;

  constructor(private db: DatabaseSync, private table: string) {
    db.exec(`CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')))`);
    this.ins = db.prepare(`INSERT INTO ${table} (id, data) VALUES (?, ?)`);
    this.upd = db.prepare(`UPDATE ${table} SET data = ?, updated_at = datetime('now') WHERE id = ?`);
    this.del = db.prepare(`DELETE FROM ${table} WHERE id = ?`);
    for (const row of db.prepare(`SELECT data FROM ${table}`).all() as { data: string }[]) {
      const v = JSON.parse(row.data) as T;
      this.cache.set(v.id, v);
    }
  }

  get size() { return this.cache.size; }
  all(): T[] { return [...this.cache.values()]; }
  get(id: string): T | undefined { return this.cache.get(id); }

  insert(row: T): T {
    if (this.cache.has(row.id)) throw new Error(`duplicate id ${row.id} in ${this.table}`);
    this.ins.run(row.id, JSON.stringify(row));
    this.cache.set(row.id, row);
    return row;
  }

  update(id: string, patch: Partial<T>): T {
    const cur = this.cache.get(id);
    if (!cur) throw new Error(`missing id ${id} in ${this.table}`);
    const next = { ...cur, ...patch, id };
    this.upd.run(JSON.stringify(next), id);
    this.cache.set(id, next);
    return next;
  }

  remove(id: string): void {
    this.del.run(id);
    this.cache.delete(id);
  }
}

const tableName = (t: TableName) => t.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

export function openSqliteStore(file: string): Store {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  const store = {} as Record<TableName, SqliteCollection<{ id: string }>>;
  for (const t of TABLES) store[t] = new SqliteCollection(db, tableName(t));

  if (store.precincts.size === 0) {
    // First run: load the demo township inside one transaction.
    const seed = seedStore();
    db.exec('BEGIN');
    for (const t of TABLES) for (const row of seed[t].all()) store[t].insert(row);
    db.exec('COMMIT');
  }
  return store as unknown as Store;
}
