import type { Db as SQLiteDatabase } from './driver';

// [id, name, primary, secondary, equipment, rest, repMin, repMax, incrementKg, movement?]
type Row = [string, string, string, string, string, number, number, number, number, string?];

const HEAVY = 210, HYPER = 150, ISO = 75;

export const EXERCISES: Row[] = [
  // Chest
  ['bench', 'Barbell Bench Press', 'chest', 'triceps,delts', 'barbell', HEAVY, 5, 8, 2.5, 'Chest Press'],
  ['incline-db', 'Incline Dumbbell Press', 'chest', 'triceps,delts', 'dumbbell', HYPER, 8, 12, 2, 'Chest Press'],
  ['machine-press', 'Machine Chest Press', 'chest', 'triceps', 'machine', HYPER, 8, 12, 5, 'Chest Press'],
  ['cable-fly', 'Cable Fly', 'chest', '', 'cable', ISO, 10, 15, 2.5],
  ['dips', 'Dips', 'chest', 'triceps', 'bodyweight', HYPER, 8, 12, 2.5],
  // Back
  ['deadlift', 'Deadlift', 'back', 'hamstrings,glutes', 'barbell', HEAVY, 3, 6, 5],
  ['pullup', 'Pull-up', 'back', 'biceps', 'bodyweight', HYPER, 6, 10, 2.5, 'Vertical Pull'],
  ['lat-pulldown', 'Lat Pulldown', 'back', 'biceps', 'cable', HYPER, 8, 12, 5, 'Vertical Pull'],
  ['bb-row', 'Barbell Row', 'back', 'biceps', 'barbell', HYPER, 6, 10, 2.5, 'Row'],
  ['cable-row', 'Seated Cable Row', 'back', 'biceps', 'cable', HYPER, 8, 12, 5, 'Row'],
  ['db-row', 'Dumbbell Row', 'back', 'biceps', 'dumbbell', HYPER, 8, 12, 2, 'Row'],
  // Quads
  ['squat', 'Barbell Back Squat', 'quads', 'glutes,hamstrings', 'barbell', HEAVY, 5, 8, 2.5, 'Squat'],
  ['leg-press', 'Leg Press', 'quads', 'glutes', 'machine', HYPER, 8, 12, 10],
  ['hack-squat', 'Hack Squat', 'quads', 'glutes', 'machine', HYPER, 8, 12, 5, 'Squat'],
  ['leg-ext', 'Leg Extension', 'quads', '', 'machine', ISO, 10, 15, 2.5],
  ['split-squat', 'Bulgarian Split Squat', 'quads', 'glutes', 'dumbbell', HYPER, 8, 12, 2, 'Squat'],
  // Hamstrings / Glutes
  ['rdl', 'Romanian Deadlift', 'hamstrings', 'glutes,back', 'barbell', HEAVY, 6, 10, 2.5],
  ['leg-curl', 'Lying Leg Curl', 'hamstrings', '', 'machine', ISO, 10, 15, 2.5, 'Leg Curl'],
  ['seated-curl', 'Seated Leg Curl', 'hamstrings', '', 'machine', ISO, 10, 15, 2.5, 'Leg Curl'],
  ['hip-thrust', 'Hip Thrust', 'glutes', 'hamstrings', 'barbell', HYPER, 8, 12, 5],
  // Delts
  ['ohp', 'Overhead Press', 'delts', 'triceps', 'barbell', HEAVY, 5, 8, 2.5, 'Shoulder Press'],
  ['db-shoulder', 'Dumbbell Shoulder Press', 'delts', 'triceps', 'dumbbell', HYPER, 8, 12, 2, 'Shoulder Press'],
  ['lateral-raise', 'Lateral Raise', 'delts', '', 'dumbbell', ISO, 12, 20, 1, 'Lateral Raise'],
  ['cable-lateral', 'Cable Lateral Raise', 'delts', '', 'cable', ISO, 12, 20, 1.25, 'Lateral Raise'],
  ['rear-delt', 'Reverse Pec Deck', 'delts', 'back', 'machine', ISO, 12, 20, 2.5, 'Rear Delt'],
  ['face-pull', 'Face Pull', 'delts', 'back', 'cable', ISO, 12, 20, 2.5, 'Rear Delt'],
  // Biceps
  ['bb-curl', 'Barbell Curl', 'biceps', '', 'barbell', ISO, 8, 12, 2.5, 'Curl'],
  ['db-curl', 'Dumbbell Curl', 'biceps', '', 'dumbbell', ISO, 8, 12, 1, 'Curl'],
  ['hammer-curl', 'Hammer Curl', 'biceps', '', 'dumbbell', ISO, 8, 12, 1, 'Curl'],
  ['preacher-curl', 'Preacher Curl', 'biceps', '', 'machine', ISO, 10, 15, 2.5, 'Curl'],
  // Triceps
  ['pushdown', 'Cable Pushdown', 'triceps', '', 'cable', ISO, 10, 15, 2.5, 'Triceps Extension'],
  ['overhead-ext', 'Overhead Cable Extension', 'triceps', '', 'cable', ISO, 10, 15, 2.5, 'Triceps Extension'],
  ['skullcrusher', 'Skull Crusher', 'triceps', '', 'barbell', ISO, 8, 12, 2.5, 'Triceps Extension'],
  // Calves / Abs
  ['calf-raise', 'Standing Calf Raise', 'calves', '', 'machine', ISO, 10, 15, 5, 'Calf Raise'],
  ['seated-calf', 'Seated Calf Raise', 'calves', '', 'machine', ISO, 12, 20, 5, 'Calf Raise'],
  ['cable-crunch', 'Cable Crunch', 'abs', '', 'cable', ISO, 10, 15, 2.5],
  ['leg-raise', 'Hanging Leg Raise', 'abs', '', 'bodyweight', ISO, 10, 15, 0],
];

export async function seed(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM exercises');
  if ((row?.n ?? 0) > 0) return;
  await db.withTransactionAsync(async () => {
    for (const r of EXERCISES) {
      await db.runAsync(
        `INSERT INTO exercises (id, name, primary_muscle, secondary_muscles, equipment,
          default_rest_seconds, target_rep_min, target_rep_max, increment_kg, movement)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9] ?? ''],
      );
    }
  });
}

const ROUTINES: [string, string, string[]][] = [
  ['push-a', 'Push A', ['bench', 'incline-db', 'machine-press', 'lateral-raise', 'pushdown']],
  ['pull-a', 'Pull A', ['deadlift', 'lat-pulldown', 'cable-row', 'face-pull', 'db-curl']],
  ['legs', 'Legs', ['squat', 'rdl', 'leg-press', 'leg-curl', 'calf-raise']],
];

export async function seedRoutines(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM routines');
  if ((row?.n ?? 0) > 0) return;
  await db.withTransactionAsync(async () => {
    for (const [i, [id, name, exs]] of ROUTINES.entries()) {
      await db.runAsync("INSERT INTO routines (id, name, plan, plan_order) VALUES (?, ?, 'PPL', ?)", [id, name, i]);
      for (let i = 0; i < exs.length; i++) {
        await db.runAsync(
          'INSERT INTO routine_exercises (id, routine_id, exercise_id, order_index, target_sets) VALUES (?, ?, ?, ?, 3)',
          [`${id}-${exs[i]}`, id, exs[i], i],
        );
      }
    }
  });
}
