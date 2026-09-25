import { tx, type Db } from './driver';

/** Start the SQLite worker. On a quick reload the old page's worker can still hold the file lock for a moment,
 *  so try a few times before giving up (a real second tab keeps failing). */
export async function openWorkerDb(): Promise<Db> {
  for (let i = 0; ; i++) {
    try {
      return await openOnce();
    } catch (e) {
      if (i >= 5) throw e;
      await new Promise((r) => setTimeout(r, 300));
    }
  }
}

function openOnce(): Promise<Db> {
  const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  const pending = new Map<number, { res: (v: any) => void; rej: (e: Error) => void }>();
  let n = 0;
  const call = (op: 'all' | 'run', sql: string, bind?: unknown[]) =>
    new Promise<any>((res, rej) => {
      pending.set(++n, { res, rej });
      w.postMessage({ id: n, op, sql, bind });
    });
  const db: Db = {
    getAllAsync: (sql, bind) => call('all', sql, bind),
    getFirstAsync: async (sql, bind) => (await call('all', sql, bind))[0] ?? null,
    runAsync: async (sql, bind) => { await call('run', sql, bind); },
    execAsync: async (sql) => { await call('run', sql); },
    withTransactionAsync: (fn) => tx(db, fn),
  };
  return new Promise((resolve, reject) => {
    w.onmessage = ({ data }) => {
      if (data.id === 0) {
        if (!data.error) return resolve(db);
        w.terminate(); // a fresh worker per try, so a cached failure inside the library can't stick
        return reject(new Error(data.error));
      }
      const p = pending.get(data.id)!;
      pending.delete(data.id);
      if (data.error) p.rej(new Error(data.error));
      else p.res(data.rows);
    };
  });
}
