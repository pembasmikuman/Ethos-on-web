import { beforeAll, expect, test } from 'bun:test';
import { bunDb } from '../db/bun';
import { initDb, getDb } from '../db';
import { kv, loadKv } from '../db/kv';

beforeAll(async () => { await initDb(bunDb()); await loadKv(); });

test('in-progress workout is written to kv and new drafts never reuse old ids', async () => {
  const { useWorkout } = await import('../store/workout');
  const { listRoutines } = await import('../db/queries');
  const [r] = await listRoutines();
  await useWorkout.getState().preview(r);
  await useWorkout.getState().begin();
  useWorkout.getState().setFocus(0, 'reps');
  useWorkout.getState().input('8');
  const saved = JSON.parse(kv.get('workout')!).state;
  expect(saved.sessionId).toBe(useWorkout.getState().sessionId);
  expect(saved.blocks[0].sets[0].reps).toBe('8');
  const ids = new Set(saved.blocks.flatMap((b: any) => b.sets.map((s: any) => s.id)));
  useWorkout.getState().addSet();
  const added = useWorkout.getState().blocks[0].sets.at(-1)!.id;
  expect(ids.has(added)).toBe(false);
});
