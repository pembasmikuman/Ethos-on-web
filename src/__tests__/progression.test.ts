import { test, expect } from 'bun:test';
import { readyToOverload, stalled, nextWeight, epley1RM, warmupRamp, weeklyVolume, roundTo } from '../lib/progression';

const ex = { target_rep_min: 8, target_rep_max: 12, increment_kg: 2.5, primary_muscle: 'chest', secondary_muscles: 'triceps,delts' };
const set = (weight: number, reps: number, rir: number | null = 2, set_type = 'working') => ({ weight, reps, rir, set_type });

test('overload when all working sets hit ceiling with rir >= 1', () => {
  expect(readyToOverload([set(80, 12), set(80, 12), set(80, 12, 1)], ex)).toBe(true);
  expect(readyToOverload([set(80, 12), set(80, 11), set(80, 12)], ex)).toBe(false);
  expect(readyToOverload([set(80, 12, 0), set(80, 12), set(80, 12)], ex)).toBe(false);
  expect(readyToOverload([set(40, 12, null, 'warmup'), set(80, 12), set(80, 12)], ex)).toBe(true);
  expect(readyToOverload([], ex)).toBe(false);
});

test('nextWeight bumps by increment on overload', () => {
  expect(nextWeight([set(80, 12), set(80, 12)], ex)).toMatchObject({ weight: 82.5, overload: true, deload: false });
  expect(nextWeight([set(80, 10), set(80, 9)], ex)).toMatchObject({ weight: 80, overload: false, deload: false });
  expect(nextWeight([], ex)).toBeNull();
});

test('linear: every set at rep min adds increment', () => {
  const lin = { ...ex, progression: 'linear' as const, target_rep_min: 5, target_rep_max: 5 };
  expect(nextWeight([set(100, 5), set(100, 5), set(100, 5)], lin)).toMatchObject({ weight: 102.5, overload: true });
  expect(nextWeight([set(100, 5), set(100, 4)], lin)).toMatchObject({ weight: 100, overload: false });
});

test('greyskull: AMRAP double jump, miss resets 10 %', () => {
  const g = { ...ex, progression: 'greyskull' as const, target_rep_min: 5, target_rep_max: 5 };
  expect(nextWeight([set(100, 5), set(100, 5), set(100, 10)], g)).toMatchObject({ weight: 105, overload: true });
  expect(nextWeight([set(100, 5), set(100, 5), set(100, 7)], g)).toMatchObject({ weight: 102.5, overload: true });
  expect(nextWeight([set(100, 5), set(100, 5), set(100, 3)], g)).toMatchObject({ weight: 90, deload: true });
});

test('bodyweight: load stays, overload means add a rep', () => {
  const bw = { ...ex, load: 'bodyweight' as const };
  expect(nextWeight([set(0, 12), set(0, 12)], bw)).toMatchObject({ weight: 0, overload: true });
  expect(nextWeight([set(0, 12), set(0, 9)], bw)).toMatchObject({ weight: 0, overload: false });
});

test('stalled after 3 sessions same weight under rep floor', () => {
  const bad = [set(80, 7), set(80, 6)];
  expect(stalled([bad, bad, bad], ex)).toBe(true);
  expect(stalled([bad, bad], ex)).toBe(false);
  expect(stalled([bad, [set(77.5, 7)], bad], ex)).toBe(false);
  expect(stalled([[set(80, 8), set(80, 8)], bad, bad], ex)).toBe(false);
});

test('epley with rir', () => {
  expect(epley1RM(100, 5, 0)).toBeCloseTo(116.67, 1);
  expect(epley1RM(100, 5, 2)).toBeCloseTo(123.33, 1);
});

test('warmup ramp rounds to 2.5', () => {
  expect(warmupRamp(100)).toEqual([{ weight: 40, reps: 8 }, { weight: 60, reps: 5 }, { weight: 80, reps: 3 }]);
  expect(warmupRamp(82.5)).toEqual([{ weight: 32.5, reps: 8 }, { weight: 50, reps: 5 }, { weight: 65, reps: 3 }]);
  expect(roundTo(33.1)).toBe(32.5);
});

test('weekly volume credits secondary at half', () => {
  const v = weeklyVolume([
    { ...set(80, 10), primary_muscle: 'chest', secondary_muscles: 'triceps,delts' },
    { ...set(80, 10), primary_muscle: 'chest', secondary_muscles: 'triceps,delts' },
    { ...set(40, 10, null, 'warmup'), primary_muscle: 'chest', secondary_muscles: '' },
    { ...set(20, 12), primary_muscle: 'triceps', secondary_muscles: '' },
  ]);
  expect(v).toEqual({ chest: 2, triceps: 2, delts: 1 });
});

import { daysAgo, upNext } from '../lib/progression';

test('upNext: per plan, day after the latest done, wrapping; first day if none done', () => {
  const r = [
    { id: 'a', plan: 'UL', last_done: '2026-06-27' },
    { id: 'b', plan: 'UL', last_done: '2026-06-16' },
    { id: 'a2', plan: 'UL', last_done: null },
    { id: 'x', plan: 'FB', last_done: '2026-09-01' },
    { id: 'y', plan: 'FB', last_done: '2026-09-05' },
    { id: 'n', plan: 'New', last_done: null },
    { id: 'm', plan: 'New', last_done: null },
  ];
  expect([...upNext(r)]).toEqual(['b', 'x', 'n']);
});

test('daysAgo', () => {
  expect(daysAgo(null)).toBeNull();
  expect(daysAgo('2026-09-01T10:00:00Z', Date.parse('2026-09-04T09:00:00Z'))).toBe(2);
});

import { sessionGrid } from '../lib/progression';

test('sessionGrid places sessions by week row and weekday column', () => {
  const now = Date.parse('2026-09-06T12:00:00'); // Sunday; this week's Monday is Aug 31
  const g = sessionGrid(['2026-09-01T10:00:00', '2026-09-06T09:00:00', '2026-08-26T10:00:00'], 3, now);
  expect(g[2]).toEqual([0, 1, 0, 0, 0, 0, 1]); // Tue, Sun this week
  expect(g[1]).toEqual([0, 0, 1, 0, 0, 0, 0]); // Wed last week
  expect(g[0]).toEqual([0, 0, 0, 0, 0, 0, 0]);
});

test('heatmap: 53 columns, levels by minutes, today marked', () => {
  const { heatmap } = require('../lib/progression');
  const now = new Date('2026-09-10T15:00:00').getTime();
  const ses = (day: string, min: number) => ({ start_time: `${day}T10:00:00`, end_time: `${day}T10:${String(min).padStart(2, '0')}:00` });
  const { cols, months } = heatmap([ses('2026-09-10', 45), ses('2026-09-08', 20), ses('2026-09-07', 59)], 53, now);
  expect(cols.length).toBe(53);
  expect(months.filter(Boolean).length).toBeGreaterThan(10);
  const last = cols[52];
  expect(last[0].key).toBe('2026-09-07');
  expect(last[3].today).toBe(true);
  expect(last[3].level).toBeGreaterThan(last[1].level);
  expect(last[0].level).toBe(4);
  expect(last[6].future).toBe(true);
  expect(last[4].level).toBe(0);
});
