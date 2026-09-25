import { getDb } from '.';

const cache = new Map<string, string>();

/** Read the whole kv table into memory. Call once after initDb, before any store is created. */
export async function loadKv(): Promise<void> {
  const db = await getDb();
  cache.clear();
  for (const r of await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM kv')) cache.set(r.key, r.value);
}

/** Sync reads from memory, writes go through to SQLite in the background (the worker keeps them in order). */
export const kv = {
  get: (key: string): string | null => cache.get(key) ?? null,
  set(key: string, value: string): void {
    cache.set(key, value);
    void getDb().then((db) => db.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', [key, value]));
  },
  del(key: string): void {
    cache.delete(key);
    void getDb().then((db) => db.runAsync('DELETE FROM kv WHERE key = ?', [key]));
  },
};
