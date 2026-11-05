import { expect, test } from 'bun:test';
import { trend } from '../lib/trend';

const s = (weight: number, reps: number) => ({ weight, reps, rir: 0 });

test('series run oldest first, change spans 8 weeks, arrows compare to the session before', () => {
  const hist = [
    { date: '2026-10-29', sets: [s(82.5, 6), s(80, 8)] }, // 1RM 99
    { date: '2026-10-25', sets: [s(80, 8)] }, // 101
    { date: '2026-10-21', sets: [s(80, 8)] }, // 101
    { date: '2026-08-01', sets: [s(60, 5)] }, // outside the 8 weeks
  ];
  const r = trend(hist);
  expect(r.series.e1rm).toEqual([70, 101, 101, 101]);
  expect(r.series.top).toEqual([60, 80, 80, 82.5]);
  expect(r.series.volume[3]).toBe(82.5 * 6 + 640);
  expect(r.change).toBe(0); // 101 now vs 101 on 21 Oct
  expect(r.lastBest).toEqual(s(80, 8));
  expect(r.dir).toEqual([0, 0, 1, 0]);
});

test('bodyweight tracks reps, and one session has no change', () => {
  const r = trend([{ date: '2026-11-01', sets: [s(0, 12), s(0, 10)] }], true);
  expect(r.series).toEqual({ e1rm: [12], top: [12], volume: [22] });
  expect(r.change).toBeNull();
});
