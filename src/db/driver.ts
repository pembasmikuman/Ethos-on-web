/** The slice of expo-sqlite's API the queries use. Both the worker driver and the bun test driver implement it. */
export type Db = {
  getAllAsync<T = any>(sql: string, bind?: unknown[]): Promise<T[]>;
  getFirstAsync<T = any>(sql: string, bind?: unknown[]): Promise<T | null>;
  runAsync(sql: string, bind?: unknown[]): Promise<void>;
  execAsync(sql: string): Promise<void>;
  withTransactionAsync(fn: () => Promise<void>): Promise<void>;
};

/** BEGIN/COMMIT around fn, ROLLBACK on throw. */
// ponytail: no lock, a query fired from another screen mid-transaction joins it; add a queue if restore ever races UI writes
export async function tx(db: Db, fn: () => Promise<void>): Promise<void> {
  await db.execAsync('BEGIN');
  try {
    await fn();
    await db.execAsync('COMMIT');
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }
}
