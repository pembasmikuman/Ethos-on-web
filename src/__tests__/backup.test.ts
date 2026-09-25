import { beforeEach, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { bunDb } from '../db/bun';
import { initDb } from '../db';
import { dumpBackup, parseBackup, restoreBackup } from '../lib/backup';

const text = readFileSync(new URL('./fixtures/backup.json', import.meta.url), 'utf8');
const strip = ({ exported_at, ...rest }: Record<string, unknown>) => rest;

beforeEach(() => initDb(bunDb()));

test('restore then dump gives back the same backup, photos included', async () => {
  const b = parseBackup(text);
  await restoreBackup(b);
  expect(strip(await dumpBackup())).toEqual(strip(JSON.parse(text)));
});

test('restoring twice does not duplicate photo files', async () => {
  await restoreBackup(parseBackup(text));
  await restoreBackup(parseBackup(text));
  expect(Object.keys((await dumpBackup()).photo_files ?? {})).toEqual(['p1.jpg']);
});

test('rejects files that are not Ethos backups', () => {
  expect(() => parseBackup('{"app":"other"}')).toThrow('Not an Ethos backup');
  expect(() => parseBackup('not json')).toThrow();
});

test('restoring mid-workout drops the workout, whose session the restore just wiped', async () => {
  const { useWorkout } = await import('../store/workout');
  const { listRoutines } = await import('../db/queries');
  await restoreBackup(parseBackup(text));
  await useWorkout.getState().preview((await listRoutines())[0]);
  await useWorkout.getState().begin();
  await restoreBackup(parseBackup(text));
  const s = useWorkout.getState();
  expect([s.sessionId, s.routine, s.blocks.length, s.rest]).toEqual([null, null, 0, null]);
});
