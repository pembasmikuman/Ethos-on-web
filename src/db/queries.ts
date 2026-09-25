import { getDb, type Exercise, type Load, type Progression } from './index';

/** Exercise columns with brand folded into name for display. Use exerciseById for the raw parts. */
const EX = (a: string) => `${a}.id, ${a}.name AS base, CASE WHEN ${a}.brand <> '' THEN ${a}.name || ' · ' || ${a}.brand ELSE ${a}.name END AS name, ${a}.brand, ${a}.movement, ${a}.primary_muscle, ${a}.secondary_muscles, ${a}.equipment, ${a}.default_rest_seconds, ${a}.target_rep_min, ${a}.target_rep_max, ${a}.increment_kg, ${a}.library_id, ${a}.progression, ${a}.load, ${a}.per_side, ${a}.notes`;

export type Routine = { id: string; name: string; plan: string; plan_order: number; exercises: number; last_done: string | null };
export type LoggedSet = {
  id: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  set_type: 'warmup' | 'working';
  weight: number;
  reps: number;
  rir: number | null;
  completed_at: string;
};

export async function listRoutines(): Promise<Routine[]> {
  const db = await getDb();
  return db.getAllAsync<Routine>(`SELECT r.id, r.name, r.plan, r.plan_order,
       (SELECT COUNT(*) FROM routine_exercises re WHERE re.routine_id = r.id) AS exercises,
       (SELECT MAX(end_time) FROM workout_sessions ws WHERE ws.routine_id = r.id AND ws.end_time IS NOT NULL) AS last_done
     FROM routines r ORDER BY r.plan, r.plan_order, r.name`);
}

export async function routineExercises(routineId: string): Promise<(Exercise & { target_sets: number })[]> {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT ${EX('e')}, re.target_sets FROM routine_exercises re
     JOIN exercises e ON e.id = re.exercise_id
     WHERE re.routine_id = ? ORDER BY re.order_index`,
    [routineId],
  );
}

/** Working sets from the last session that contained this exercise, ordered by set number. */
export async function prevSets(exerciseId: string): Promise<LoggedSet[]> {
  const db = await getDb();
  const last = await db.getFirstAsync<{ session_id: string }>(
    `SELECT session_id FROM logged_sets WHERE exercise_id = ? AND set_type = 'working'
     ORDER BY completed_at DESC LIMIT 1`,
    [exerciseId],
  );
  if (!last) return [];
  return db.getAllAsync<LoggedSet>(
    `SELECT * FROM logged_sets WHERE session_id = ? AND exercise_id = ? AND set_type = 'working' ORDER BY set_number`,
    [last.session_id, exerciseId],
  );
}

export async function startSession(routine: Routine): Promise<string> {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.runAsync(
    'INSERT INTO workout_sessions (id, routine_id, title, start_time) VALUES (?, ?, ?, ?)',
    [id, routine.id, routine.name, new Date().toISOString()],
  );
  return id;
}

export async function insertSet(s: Omit<LoggedSet, 'id' | 'completed_at'>): Promise<string> {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.runAsync(
    `INSERT INTO logged_sets (id, session_id, exercise_id, set_number, set_type, weight, reps, rir, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, s.session_id, s.exercise_id, s.set_number, s.set_type, s.weight, s.reps, s.rir, new Date().toISOString()],
  );
  return id;
}

export async function finishSession(sessionId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE workout_sessions SET end_time = ? WHERE id = ?', [new Date().toISOString(), sessionId]);
}

export async function recentSessions(limit = 3) {
  const db = await getDb();
  return db.getAllAsync<{ id: string; title: string; start_time: string; end_time: string | null; sets: number }>(
    `SELECT s.id, s.title, s.start_time, s.end_time,
       (SELECT COUNT(*) FROM logged_sets l WHERE l.session_id = s.id AND l.set_type = 'working') AS sets
     FROM workout_sessions s WHERE s.end_time IS NOT NULL ORDER BY s.start_time DESC LIMIT ?`,
    [limit],
  );
}

/** Working sets grouped by session for the last `n` sessions containing this exercise, newest first. */
export async function recentExerciseSessions(exerciseId: string, n = 3): Promise<LoggedSet[][]> {
  const db = await getDb();
  const ids = await db.getAllAsync<{ session_id: string }>(
    `SELECT session_id FROM logged_sets WHERE exercise_id = ? AND set_type = 'working'
     GROUP BY session_id ORDER BY MAX(completed_at) DESC LIMIT ?`,
    [exerciseId, n],
  );
  const out: LoggedSet[][] = [];
  for (const { session_id } of ids) {
    out.push(
      await db.getAllAsync<LoggedSet>(
        `SELECT * FROM logged_sets WHERE session_id = ? AND exercise_id = ? AND set_type = 'working' ORDER BY set_number`,
        [session_id, exerciseId],
      ),
    );
  }
  return out;
}

/** Working sets since `sinceIso` with muscle info, for weekly volume. */
export async function setsSince(sinceIso: string) {
  const db = await getDb();
  return db.getAllAsync<LoggedSet & { primary_muscle: string; secondary_muscles: string }>(
    `SELECT l.*, e.primary_muscle, e.secondary_muscles FROM logged_sets l
     JOIN exercises e ON e.id = l.exercise_id
     WHERE l.completed_at >= ? AND l.set_type = 'working'`,
    [sinceIso],
  );
}

/** Delete a session and its sets. */
export async function deleteSession(sessionId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM logged_sets WHERE session_id = ?', [sessionId]);
  await db.runAsync('DELETE FROM workout_sessions WHERE id = ?', [sessionId]);
}

export type SessionRow = { id: string; title: string; start_time: string; end_time: string | null; notes?: string | null; photos?: number; sets: number; volume_kg: number };

export async function allSessions(): Promise<SessionRow[]> {
  const db = await getDb();
  return db.getAllAsync<SessionRow>(
    `SELECT s.id, s.title, s.start_time, s.end_time, s.notes,
       (SELECT COUNT(*) FROM logged_sets l WHERE l.session_id = s.id AND l.set_type = 'working') AS sets,
       (SELECT COALESCE(SUM(weight * reps), 0) FROM logged_sets l WHERE l.session_id = s.id AND l.set_type = 'working') AS volume_kg,
       (SELECT COUNT(*) FROM session_photos p WHERE p.session_id = s.id) AS photos
     FROM workout_sessions s WHERE s.end_time IS NOT NULL ORDER BY s.start_time DESC`,
  );
}

export async function sessionById(id: string): Promise<SessionRow | null> {
  const db = await getDb();
  return db.getFirstAsync<SessionRow>(
    `SELECT s.id, s.title, s.start_time, s.end_time, s.notes,
       (SELECT COUNT(*) FROM logged_sets l WHERE l.session_id = s.id AND l.set_type = 'working') AS sets,
       (SELECT COALESCE(SUM(weight * reps), 0) FROM logged_sets l WHERE l.session_id = s.id AND l.set_type = 'working') AS volume_kg
     FROM workout_sessions s WHERE s.id = ?`,
    [id],
  );
}

/** Sets of a session with exercise names, in logged order. */
export async function sessionSets(sessionId: string) {
  const db = await getDb();
  return db.getAllAsync<LoggedSet & { name: string; target_rep_max: number; primary_muscle: string; secondary_muscles: string; notes: string }>(
    `SELECT l.*, CASE WHEN e.brand <> '' THEN e.name || ' · ' || e.brand ELSE e.name END AS name, e.target_rep_max, e.primary_muscle, e.secondary_muscles, e.notes FROM logged_sets l JOIN exercises e ON e.id = l.exercise_id
     WHERE l.session_id = ? ORDER BY l.completed_at`,
    [sessionId],
  );
}

export async function updateSet(id: string, weight: number, reps: number, rir: number | null): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE logged_sets SET weight = ?, reps = ?, rir = ? WHERE id = ?', [weight, reps, rir, id]);
}

export async function deleteSet(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM logged_sets WHERE id = ?', [id]);
}

// ---- Routine editing ----

export async function allExercises(): Promise<Exercise[]> {
  const db = await getDb();
  return db.getAllAsync<Exercise>(`SELECT ${EX('e')} FROM exercises e ORDER BY e.primary_muscle, name`);
}

/** A "day" inside a plan (plan = what the UI calls a routine). */
export async function createRoutine(name: string, plan = ''): Promise<string> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const n = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM routines WHERE plan = ?', [plan]);
  await db.runAsync('INSERT INTO routines (id, name, plan, plan_order) VALUES (?, ?, ?, ?)', [id, name, plan, n?.n ?? 0]);
  return id;
}

export async function renamePlan(from: string, to: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE routines SET plan = ? WHERE plan = ?', [to, from]);
}

export async function deletePlan(plan: string): Promise<void> {
  const db = await getDb();
  const ids = await db.getAllAsync<{ id: string }>('SELECT id FROM routines WHERE plan = ?', [plan]);
  for (const { id } of ids) await deleteRoutine(id);
}

export async function renameRoutine(id: string, name: string, plan: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE routines SET name = ?, plan = ? WHERE id = ?', [name, plan, id]);
}

export async function deleteRoutine(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM routine_exercises WHERE routine_id = ?', [id]);
  await db.runAsync('UPDATE workout_sessions SET routine_id = NULL WHERE routine_id = ?', [id]);
  await db.runAsync('DELETE FROM routines WHERE id = ?', [id]);
}

export type RoutineExercise = Exercise & { re_id: string; order_index: number; target_sets: number };

export async function routineExerciseRows(routineId: string): Promise<RoutineExercise[]> {
  const db = await getDb();
  return db.getAllAsync<RoutineExercise>(
    `SELECT ${EX('e')}, re.id AS re_id, re.order_index, re.target_sets FROM routine_exercises re
     JOIN exercises e ON e.id = re.exercise_id WHERE re.routine_id = ? ORDER BY re.order_index`,
    [routineId],
  );
}

export async function addRoutineExercise(routineId: string, exerciseId: string): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COALESCE(MAX(order_index), -1) + 1 AS n FROM routine_exercises WHERE routine_id = ?', [routineId]);
  await db.runAsync(
    'INSERT INTO routine_exercises (id, routine_id, exercise_id, order_index, target_sets) VALUES (?, ?, ?, ?, 3)',
    [crypto.randomUUID(), routineId, exerciseId, row?.n ?? 0],
  );
}

export async function removeRoutineExercise(reId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM routine_exercises WHERE id = ?', [reId]);
}

export async function setTargetSets(reId: string, n: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE routine_exercises SET target_sets = ? WHERE id = ?', [Math.max(1, Math.min(10, n)), reId]);
}

/** Rewrite order_index for the given ordered list of routine_exercises ids. */
export async function reorderRoutine(reIds: string[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < reIds.length; i++) await db.runAsync('UPDATE routine_exercises SET order_index = ? WHERE id = ?', [i, reIds[i]]);
  });
}

export async function replaceRoutineExercise(reId: string, exerciseId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE routine_exercises SET exercise_id = ? WHERE id = ?', [exerciseId, reId]);
}

// ---- Exercise detail ----

export async function exerciseById(id: string): Promise<Exercise | null> {
  const db = await getDb();
  return db.getFirstAsync<Exercise>('SELECT * FROM exercises WHERE id = ?', [id]);
}

export type ExerciseSettings = Pick<Exercise, 'default_rest_seconds' | 'target_rep_min' | 'target_rep_max' | 'increment_kg' | 'progression'>;

export async function updateExercise(id: string, s: ExerciseSettings): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE exercises SET default_rest_seconds = ?, target_rep_min = ?, target_rep_max = ?, increment_kg = ?, progression = ? WHERE id = ?',
    [s.default_rest_seconds, s.target_rep_min, s.target_rep_max, s.increment_kg, s.progression, id],
  );
}

export async function setExerciseNotes(id: string, notes: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE exercises SET notes = ? WHERE id = ?', [notes, id]);
}

export type ExerciseIdentity = { name: string; brand: string; movement: string; primary_muscle: string; equipment: string; secondary_muscles?: string; library_id?: string; load?: Load; per_side?: number };

export async function createExercise(e: ExerciseIdentity): Promise<string> {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.runAsync(
    'INSERT INTO exercises (id, name, brand, movement, primary_muscle, equipment, secondary_muscles, library_id, load, per_side) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, e.name, e.brand, e.movement, e.primary_muscle, e.equipment, e.secondary_muscles ?? '', e.library_id ?? '', e.load ?? 'weight', e.per_side ?? 0],
  );
  return id;
}

/** Copy an exercise (settings included) as a new variant. Returns the new id. */
export async function duplicateExercise(id: string): Promise<string> {
  const db = await getDb();
  const nid = crypto.randomUUID();
  await db.runAsync(
    `INSERT INTO exercises (id, name, brand, movement, primary_muscle, secondary_muscles, equipment, default_rest_seconds, target_rep_min, target_rep_max, increment_kg, library_id, progression, load, per_side)
     SELECT ?, name, brand, movement, primary_muscle, secondary_muscles, equipment, default_rest_seconds, target_rep_min, target_rep_max, increment_kg, library_id, progression, load, per_side FROM exercises WHERE id = ?`,
    [nid, id],
  );
  return nid;
}

/** Working sets for one exercise grouped per session, newest first, with session date. */
export async function exerciseHistory(exerciseId: string, n = 12): Promise<{ session_id: string; date: string; sets: LoggedSet[] }[]> {
  const db = await getDb();
  const heads = await db.getAllAsync<{ session_id: string; date: string }>(
    `SELECT s.session_id, ws.start_time AS date FROM logged_sets s JOIN workout_sessions ws ON ws.id = s.session_id
     WHERE s.exercise_id = ? AND s.set_type = 'working' AND ws.end_time IS NOT NULL
     GROUP BY s.session_id ORDER BY ws.start_time DESC LIMIT ?`,
    [exerciseId, n],
  );
  const out = [];
  for (const h of heads) {
    const sets = await db.getAllAsync<LoggedSet>(
      `SELECT * FROM logged_sets WHERE session_id = ? AND exercise_id = ? AND set_type = 'working' ORDER BY set_number`,
      [h.session_id, exerciseId],
    );
    out.push({ ...h, sets });
  }
  return out;
}

export async function renameExercise(id: string, e: ExerciseIdentity): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE exercises SET name = ?, brand = ?, movement = ?, primary_muscle = ?, equipment = ?, load = ?, per_side = ? WHERE id = ?', [e.name, e.brand, e.movement, e.primary_muscle, e.equipment, e.load ?? 'weight', e.per_side ?? 0, id]);
}

/** Refuses if the exercise has logged sets. Returns false in that case. */
export async function deleteExercise(id: string): Promise<boolean> {
  const db = await getDb();
  const used = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM logged_sets WHERE exercise_id = ?', [id]);
  if (used && used.n > 0) return false;
  await db.runAsync('DELETE FROM routine_exercises WHERE exercise_id = ?', [id]);
  await db.runAsync('DELETE FROM exercises WHERE id = ?', [id]);
  return true;
}

export async function reorderPlan(routineIds: string[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < routineIds.length; i++) await db.runAsync('UPDATE routines SET plan_order = ? WHERE id = ?', [i, routineIds[i]]);
  });
}

export async function setSessionNotes(sessionId: string, notes: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE workout_sessions SET notes = ? WHERE id = ?', [notes, sessionId]);
}
