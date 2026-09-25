import type { Db } from './driver';
import { migrate } from './migrations';
import { seed, seedRoutines } from './seed';
export * from './types';
export type { Db } from './driver';

let dbPromise: Promise<Db> | null = null;

/** Migrate and seed `raw`, then hand it out from getDb(). Called once at boot, and per test. */
export function initDb(raw: Db): Promise<void> {
  dbPromise = (async () => {
    await migrate(raw);
    await seed(raw);
    await seedRoutines(raw);
    return raw;
  })();
  return dbPromise.then(() => {});
}

export function getDb(): Promise<Db> {
  if (!dbPromise) throw new Error('initDb was not called');
  return dbPromise;
}
