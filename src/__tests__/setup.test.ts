import { beforeEach, expect, test } from 'bun:test';
import { bunDb } from '../db/bun';
import { initDb } from '../db';
import { loadKv } from '../db/kv';
import { applySetup, createExercise, exerciseById, resetToSetup, setupReach, updateExercise } from '../db/queries';
import { getSetup, withTuned, SETUP_DEFAULT } from '../lib/setup';

beforeEach(async () => { initDb(bunDb()); await loadKv(); });

const SIX_EIGHT = { rule: 'linear' as const, repMin: 6, repMax: 8, rest: 150, increment: 1.25 };

test('withTuned adds a field once, as a comma list', () => {
  expect(withTuned('', 'reps')).toBe('reps');
  expect(withTuned('reps', 'rest')).toBe('reps,rest');
  expect(withTuned('reps,rest', 'reps')).toBe('reps,rest');
});

test('Setup reaches every untuned setting and leaves tuned ones alone', async () => {
  const bench = (await exerciseById('bench'))!;
  // Tuned rest only: reps, rule and increment still follow Setup.
  await updateExercise('bench', { ...bench, default_rest_seconds: 240, tuned: 'rest' });
  await applySetup(SIX_EIGHT);
  const after = (await exerciseById('bench'))!;
  expect([after.target_rep_min, after.target_rep_max, after.progression, after.increment_kg, after.default_rest_seconds]).toEqual([6, 8, 'linear', 1.25, 240]);
  const squat = (await exerciseById('squat'))!;
  expect([squat.target_rep_min, squat.target_rep_max, squat.default_rest_seconds]).toEqual([6, 8, 150]);
  expect(await setupReach()).toMatchObject({ tuned: 1 });
});

test('new exercises start on Setup, and reset puts a tuned one back', async () => {
  expect(getSetup()).toEqual(SETUP_DEFAULT);
  await applySetup(SIX_EIGHT);
  const id = await createExercise({ name: 'Cable Fly', brand: '', movement: '', primary_muscle: 'chest', equipment: 'cable' });
  const ex = (await exerciseById(id))!;
  expect([ex.progression, ex.target_rep_min, ex.target_rep_max, ex.default_rest_seconds, ex.increment_kg, ex.tuned]).toEqual(['linear', 6, 8, 150, 1.25, '']);
  await updateExercise(id, { ...ex, target_rep_max: 15, tuned: 'reps' });
  await resetToSetup(id);
  expect((await exerciseById(id))!).toMatchObject({ target_rep_max: 8, tuned: '' });
});

test('timed exercises keep their seconds when Setup changes reps', async () => {
  const plank = await createExercise({ name: 'Plank', brand: '', movement: '', primary_muscle: 'abs', equipment: '', load: 'time' });
  await applySetup(SIX_EIGHT);
  const ex = (await exerciseById(plank))!;
  expect([ex.target_rep_min, ex.target_rep_max, ex.default_rest_seconds]).toEqual([8, 12, 150]);
});

test('an old backup comes back with its tweaks marked, a new one as it was', async () => {
  const { restoreBackup, dumpBackup } = await import('../lib/backup');
  const b = await dumpBackup();
  const strip = (rows: Record<string, unknown>[]) => rows.map(({ tuned, ...r }) => r);
  const bench = b.exercises.find((r) => r.id === 'bench')!;
  // From before Setup: no tuned column. Bench rest changed from its 210s start, a library exercise at 6-8 against the old 8-12.
  const old = { ...b, exercises: [...strip(b.exercises).map((r) => (r.id === 'bench' ? { ...r, default_rest_seconds: 180 } : r)), { ...strip([bench])[0], id: 'lib-row', target_rep_min: 6, target_rep_max: 8, default_rest_seconds: 120, increment_kg: 2.5 }] };
  await restoreBackup(old);
  expect((await exerciseById('bench'))!.tuned).toBe('rest');
  expect((await exerciseById('lib-row'))!.tuned).toBe('reps');
  expect((await exerciseById('squat'))!.tuned).toBe('');
  // After Setup: untuned rows differ from their start but must stay untuned.
  await applySetup(SIX_EIGHT);
  await restoreBackup(await dumpBackup());
  expect((await exerciseById('squat'))!.tuned).toBe('');
});
