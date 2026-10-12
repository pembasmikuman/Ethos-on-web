import { expect, test } from 'bun:test';
import { routineChanges, type BlockLite, type PlanRow } from '../lib/routineChanges';

const plan: PlanRow[] = [
  { reId: 'r1', exerciseId: 'bench', name: 'Bench', sets: 3 },
  { reId: 'r2', exerciseId: 'row', name: 'Row', sets: 3 },
  { reId: 'r3', exerciseId: 'curl', name: 'Curl', sets: 2 },
];
const sets = (n: number, warm = 0) => [
  ...Array.from({ length: warm }, () => ({ type: 'warmup' as const, done: true })),
  ...Array.from({ length: n }, () => ({ type: 'working' as const, done: true })),
];
const asPlanned = (): BlockLite[] => plan.map((r) => ({ reId: r.reId, exerciseId: r.exerciseId, name: r.name, sets: sets(r.sets) }));
const kinds = (b: BlockLite[]) => routineChanges(plan, b).map((c) => c.kind);

test('a workout done as planned changes nothing, warmups included', () => {
  expect(kinds(asPlanned())).toEqual([]);
  expect(kinds(asPlanned().map((b) => ({ ...b, sets: sets(b.sets.length, 2) })))).toEqual([]);
});

test('an extra set, an added exercise, a dropped one and a new order are each one change', () => {
  const [bench, row] = asPlanned();
  const b: BlockLite[] = [row, { ...bench, sets: sets(4) }, { exerciseId: 'dip', name: 'Dip', sets: sets(3) }];
  expect(kinds(b).sort()).toEqual(['add', 'order', 'remove', 'sets']);
});

test('only logged sets count, and an exercise skipped today is left alone', () => {
  const [bench, row, curl] = asPlanned();
  const half = { ...bench, sets: [...sets(2), { type: 'working' as const, done: false }] };
  const skipped = { ...row, sets: sets(3).map((x) => ({ ...x, done: false })) };
  expect(routineChanges(plan, [half, skipped, curl]).map((c) => c.label)).toEqual(['Bench · 3 → 2 sets']);
});

test('a swap after logging shows as a swap, not an add plus the old one staying', () => {
  const [bench, row, curl] = asPlanned();
  const b: BlockLite[] = [bench, { ...row, replaced: true }, { reId: 'r2', exerciseId: 'pulldown', name: 'Pulldown', sets: sets(3) }, curl];
  expect(routineChanges(plan, b)).toEqual([{ kind: 'swap', reId: 'r2', exerciseId: 'pulldown', label: 'Swap Row for Pulldown' }]);
});
