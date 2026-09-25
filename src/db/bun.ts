import { Database } from 'bun:sqlite';
import { tx, type Db } from './driver';

/** Fresh in-memory database behind the Db interface. Tests only. */
export function bunDb(): Db {
  const d = new Database(':memory:');
  const db: Db = {
    getAllAsync: async (sql, bind = []) => d.query(sql).all(...(bind as never[])) as never,
    getFirstAsync: async (sql, bind = []) => (d.query(sql).get(...(bind as never[])) ?? null) as never,
    runAsync: async (sql, bind = []) => { d.query(sql).run(...(bind as never[])); },
    execAsync: async (sql) => { d.exec(sql); },
    withTransactionAsync: (fn) => tx(db, fn),
  };
  return db;
}
