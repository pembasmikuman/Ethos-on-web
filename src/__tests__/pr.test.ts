import { beforeEach, expect, test } from 'bun:test';
import { findPR, prCountSince } from '../lib/progression';
import { bunDb } from '../db/bun';
import { initDb } from '../db';
import { createExercise, insertSet, prSets, startSession } from '../db/queries';

const s = (weight: number, reps: number) => ({ weight, reps });

test('first try at an exercise is never a PR', () => {
  expect(findPR(s(100, 10), [])).toBeNull();
});

test('heavier than ever is a weight PR', () => {
  expect(findPR(s(65, 7), [s(60, 10), s(55, 12)])).toEqual({ kind: 'weight', from: 60, to: 65 });
});

test('more reps than ever at this weight is a rep PR', () => {
  expect(findPR(s(60, 10), [s(60, 8), s(60, 9), s(50, 15)])).toEqual({ kind: 'reps', from: 9, to: 10, at: 60 });
});

test('reps already matched at a heavier weight are not a PR', () => {
  expect(findPR(s(60, 10), [s(60, 8), s(65, 10)])).toBeNull();
});

test('tying the best is not a PR', () => {
  expect(findPR(s(60, 9), [s(60, 9)])).toBeNull();
  expect(findPR(s(60, 5), [s(60, 9)])).toBeNull();
});

test('bodyweight sets (weight 0) get rep PRs', () => {
  expect(findPR(s(0, 12), [s(0, 10)])).toEqual({ kind: 'reps', from: 10, to: 12, at: 0 });
});

test('monthly count only counts PRs logged since the cutoff, per exercise', () => {
  const row = (exercise_id: string, weight: number, reps: number, completed_at: string) => ({ exercise_id, weight, reps, completed_at });
  const sets = [
    row('bench', 60, 8, '2026-09-20'),
    row('bench', 62.5, 8, '2026-09-27'), // PR, but last month
    row('row', 50, 10, '2026-10-01'), // first try
    row('bench', 62.5, 9, '2026-10-03'), // rep PR
    row('row', 50, 10, '2026-10-05'), // tie
    row('bench', 65, 6, '2026-10-10'), // weight PR
  ];
  expect(prCountSince(sets, '2026-10-01')).toBe(2);
});

test('prSets leaves out warmups and timed exercises', async () => {
  initDb(bunDb());
  const sid = await startSession(null, 'T');
  await insertSet({ session_id: sid, exercise_id: 'bench', set_number: 0, set_type: 'warmup', weight: 40, reps: 8, rir: null });
  await insertSet({ session_id: sid, exercise_id: 'bench', set_number: 1, set_type: 'working', weight: 80, reps: 8, rir: 2 });
  const plank = await createExercise({ name: 'Plank', brand: '', movement: '', primary_muscle: 'abs', equipment: '', load: 'time' });
  await insertSet({ session_id: sid, exercise_id: plank, set_number: 1, set_type: 'working', weight: 0, reps: 60, rir: null });
  expect((await prSets()).map((x) => [x.exercise_id, x.weight])).toEqual([['bench', 80]]);
});
