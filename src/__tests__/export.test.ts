import { expect, test } from 'bun:test';
import { sessionsMarkdown } from '../lib/export';
import type { ExportSet, SessionRow } from '../db/queries';

const ex = { exercise: 'Bench Press', primary_muscle: 'chest', secondary_muscles: 'triceps, front delts', target_rep_min: 8, target_rep_max: 12, default_rest_seconds: 120, increment_kg: 2.5, progression: 'double', load: 'weight', per_side: 0, exercise_notes: 'bench 4' } as const;
const set = (id: string, type: 'warmup' | 'working', n: number, weight: number, reps: number, rir: number | null, at: string, notes = ''): ExportSet =>
  ({ ...ex, id, session_id: 's1', exercise_id: 'e1', set_number: n, set_type: type, weight, reps, rir, notes, completed_at: `2026-11-03T10:${at}.000Z` });

test('sessionsMarkdown: key, session header, exercise plan and a set table with rest', () => {
  const session: SessionRow = { id: 's1', title: 'PPL · Push A', start_time: '2026-11-03T10:00:00.000Z', end_time: '2026-11-03T11:02:00.000Z', notes: 'slept badly', sets: 2, volume_kg: 1320, photos: 0 };
  const md = sessionsMarkdown([session], [
    set('a', 'warmup', 0, 40, 8, null, '00:00'),
    set('b', 'working', 1, 60, 12, 2, '02:05'),
    set('c', 'working', 2, 60, 10, 0, '04:25', 'failed | rep'),
  ], new Date('2026-11-05T00:00:00Z'));
  expect(md).toContain('Exported 2026-11-05 · 1 session\n');
  expect(md).toContain('## Tue 2026-11-03 · PPL · Push A\n62 min · 2 working sets · 1320 kg volume\nSession note: slept badly');
  expect(md).toContain('chest (+ triceps, front delts)\nPlan: 8-12 reps · rest 120s · +2.5 kg jumps · double progression\nExercise note: bench 4');
  expect(md).toContain('| W | 40 | 8 |  |  |  |\n| 1 | 60 | 12 | 2 | 2:05 |  |\n| 2 | 60 | 10 | 0 | 2:20 | failed / rep |');
});

test('sessionsMarkdown: oldest session first', () => {
  const s = (id: string, day: string): SessionRow => ({ id, title: id, start_time: `2026-11-0${day}T10:00:00.000Z`, end_time: null, sets: 0, volume_kg: 0 });
  const md = sessionsMarkdown([s('newer', '3'), s('older', '1')], []);
  expect(md.indexOf('older')).toBeLessThan(md.indexOf('newer'));
});
