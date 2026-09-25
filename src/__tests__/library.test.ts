import { test, expect } from 'bun:test';
import { LIBRARY, libraryEntry, searchLibrary } from '../lib/library';

const MUSCLES = ['chest', 'back', 'quads', 'hamstrings', 'glutes', 'delts', 'biceps', 'triceps', 'calves', 'abs'];
const EQUIPMENT = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'];

test('library uses app vocabulary only', () => {
  expect(LIBRARY.length).toBeGreaterThan(1000);
  for (const e of LIBRARY) {
    expect(MUSCLES).toContain(e.muscle);
    expect(EQUIPMENT).toContain(e.equipment);
    for (const m of e.secondary.split(',').filter(Boolean)) expect(MUSCLES).toContain(m);
  }
});

test('search matches every word, any field', () => {
  const r = searchLibrary('dumbbell curl');
  expect(r.length).toBeGreaterThan(0);
  expect(r.every((e) => e.equipment === 'dumbbell' || e.name.toLowerCase().includes('dumbbell'))).toBe(true);
  expect(searchLibrary('')).toEqual([]);
  expect(libraryEntry(r[0].id)).toBe(r[0]);
});
