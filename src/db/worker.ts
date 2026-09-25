import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

type Req = { id: number; op: 'all' | 'run'; sql: string; bind?: unknown[] };

const ready = (async () => {
  const sqlite3 = await sqlite3InitModule();
  const pool = await sqlite3.installOpfsSAHPoolVfs({});
  return new pool.OpfsSAHPoolDb('/ethos.sqlite3');
})();

// id 0 reports whether the database opened. A second tab fails here because the pool holds a file lock.
ready.then(
  () => postMessage({ id: 0 }),
  (e) => postMessage({ id: 0, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) }),
);

self.onmessage = async ({ data: r }: MessageEvent<Req>) => {
  try {
    const db = await ready;
    const rows = r.op === 'all'
      ? db.exec({ sql: r.sql, bind: r.bind as never, rowMode: 'object', returnValue: 'resultRows' })
      : (db.exec({ sql: r.sql, bind: r.bind as never }), undefined);
    postMessage({ id: r.id, rows });
  } catch (e) {
    postMessage({ id: r.id, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) });
  }
};
