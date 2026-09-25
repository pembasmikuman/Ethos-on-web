import { afterAll, beforeAll, expect, test } from 'bun:test';
import { bunDb } from '../db/bun';
import { initDb } from '../db';
import { loadKv } from '../db/kv';

// A phone whose notification prompt is never answered, so anything that waits on the push server waits forever.
// Only browser stand-ins, removed afterwards (a module mock here leaked into other test files on CI).
const FAKES = ['window', 'PushManager', 'Notification'] as const;
beforeAll(() => {
  Object.assign(globalThis, { window: globalThis, PushManager: class {}, Notification: { permission: 'default', requestPermission: () => new Promise(() => {}) } });
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: {} });
});
afterAll(() => {
  for (const k of FAKES) delete (globalThis as Record<string, unknown>)[k];
  delete (navigator as { serviceWorker?: unknown }).serviceWorker;
});

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
