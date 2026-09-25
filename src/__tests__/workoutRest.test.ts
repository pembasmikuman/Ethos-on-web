import { beforeAll, expect, mock, test } from 'bun:test';
import { bunDb } from '../db/bun';
import { initDb } from '../db';
import { loadKv } from '../db/kv';

const real = await import('../lib/rest');
const never = () => new Promise<never>(() => {});
mock.module('../lib/rest', () => ({ ...real, scheduleRestDone: never, cancelRestDone: never }));

beforeAll(async () => { await initDb(bunDb()); await loadKv(); });

test('a set is done and rest starts even when the push server never answers', async () => {
  const { useWorkout } = await import('../store/workout');
  const { listRoutines } = await import('../db/queries');
  const w = useWorkout.getState();
  await w.preview((await listRoutines())[0]);
  await useWorkout.getState().begin();
  for (const [f, v] of [['weight', '60'], ['reps', '8']] as const) { useWorkout.getState().setFocus(0, f); useWorkout.getState().input(v); }
  await useWorkout.getState().completeSet();
  expect(useWorkout.getState().blocks[0].sets[0].done).toBe(true);
  expect(useWorkout.getState().rest?.endsAt).toBeGreaterThan(Date.now());
  await useWorkout.getState().adjustRest(30);
  await useWorkout.getState().skipRest();
  expect(useWorkout.getState().rest).toBeNull();
});
