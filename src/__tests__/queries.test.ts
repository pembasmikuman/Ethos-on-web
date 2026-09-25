import { beforeEach, expect, test } from 'bun:test';
import { bunDb } from '../db/bun';
import { initDb, getDb } from '../db';
import { listRoutines, startSession, insertSet, sessionSets, finishSession, setSessionNotes } from '../db/queries';
import { kv, loadKv } from '../db/kv';

beforeEach(() => initDb(bunDb()));

test('seed creates routines and a logged set round-trips', async () => {
  const routines = await listRoutines();
  expect(routines.length).toBeGreaterThan(0);
  const sid = await startSession(routines[0]);
  await insertSet({ session_id: sid, exercise_id: 'bench', set_number: 1, set_type: 'working', weight: 80, reps: 8, rir: 2 });
  await finishSession(sid);
  await setSessionNotes(sid, 'felt good');
  const sets = await sessionSets(sid);
  expect(sets.map((s) => [s.weight, s.reps, s.rir])).toEqual([[80, 8, 2]]);
  const db = await getDb();
  expect((await db.getFirstAsync<{ notes: string }>('SELECT notes FROM workout_sessions WHERE id = ?', [sid]))?.notes).toBe('felt good');
});

test('kv writes survive a reload from the table', async () => {
  kv.set('a', '1');
  kv.set('a', '2');
  kv.set('b', 'x');
  kv.del('b');
  await (await getDb()).getAllAsync('SELECT 1'); // let the background writes land
  await loadKv();
  expect([kv.get('a'), kv.get('b')]).toEqual(['2', null]);
});

test('transaction rolls back on throw', async () => {
  const db = await getDb();
  await expect(db.withTransactionAsync(async () => {
    await db.runAsync("INSERT INTO routines (id, name) VALUES ('x', 'X')");
    throw new Error('boom');
  })).rejects.toThrow('boom');
  expect(await db.getFirstAsync("SELECT id FROM routines WHERE id = 'x'")).toBeNull();
});
