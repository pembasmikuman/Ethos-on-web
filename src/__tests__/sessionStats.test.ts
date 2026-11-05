import { expect, test } from 'bun:test';
import { sessionStats, type ExerciseBlock } from '../store/workout';

const set = (type: 'warmup' | 'working', weight: string, reps: string, done = true) => ({ id: 0, type, weight, reps, rir: '', done });
const block = (sets: ReturnType<typeof set>[], unit?: 'lb') => ({ sets, unit }) as unknown as ExerciseBlock;

test('counts done working sets only, and adds lb sets up in kg', () => {
  const blocks = [
    block([set('warmup', '40', '10'), set('working', '100', '5'), set('working', '100', '5', false)]),
    block([set('working', '100', '10')], 'lb'), // 100 lb = 45.4 kg
  ];
  expect(sessionStats(blocks, 0, 42 * 60000)).toEqual({ mins: 42, sets: 2, kg: 500 + 454 });
});
