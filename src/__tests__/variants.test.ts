import { test, expect } from 'bun:test';
import { baseMove, groupVariants, movementFor } from '../lib/variants';

test('groupVariants merges same base under one row', () => {
  const g = groupVariants([
    { base: 'Chest Press', name: 'Chest Press · A', primary_muscle: 'chest' },
    { base: 'Chest Press', name: 'Chest Press · B', primary_muscle: 'chest' },
    { base: 'Row', name: 'Row', primary_muscle: 'back' },
    { base: 'Barbell Bench Press', name: 'Barbell Bench Press', movement: 'Chest Press', primary_muscle: 'chest' },
  ]);
  expect(g.map((x) => [x.base, x.items.length])).toEqual([['Chest Press', 3], ['Row', 1]]);
});

test('baseMove drops the gear off library names', () => {
  expect(baseMove('Lever Leg Extension')).toBe('Leg Extension');
  expect(baseMove('Ez Barbell Curl')).toBe('Curl');
  expect(baseMove('Resistance Band Leg Extension')).toBe('Leg Extension');
  expect(baseMove('Leg Extension')).toBe('Leg Extension');
  expect(baseMove('Cable')).toBe('Cable');
});

test('movementFor joins an existing move instead of starting a new one', () => {
  const have = [
    { base: 'Leg Extension', name: 'Leg Extension', movement: '', primary_muscle: 'quads' },
    { base: 'Barbell Bench Press', name: 'Barbell Bench Press', movement: 'Chest Press', primary_muscle: 'chest' },
  ];
  // Same name once the gear is off, and that one has no movement, so both fall back to it.
  expect(movementFor('Lever Leg Extension', 'quads', have)).toBe('Leg Extension');
  // Already grouped under a movement of its own, so adopt it.
  expect(movementFor('Dumbbell Bench Press', 'chest', have)).toBe('Chest Press');
  // Nothing like it yet.
  expect(movementFor('Cable Crossover', 'chest', have)).toBe('Crossover');
  // Muscle has to match too.
  expect(movementFor('Lever Leg Extension', 'chest', have)).toBe('Leg Extension');
});
