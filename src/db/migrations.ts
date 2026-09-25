import type { Db as SQLiteDatabase } from './driver';

/** Ordered list. Never edit a shipped entry; append a new one. */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE exercises (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    primary_muscle TEXT NOT NULL,
    secondary_muscles TEXT DEFAULT '',
    equipment TEXT,
    default_rest_seconds INTEGER DEFAULT 120,
    target_rep_min INTEGER DEFAULT 8,
    target_rep_max INTEGER DEFAULT 12,
    increment_kg REAL DEFAULT 2.5
  );
  CREATE TABLE routines (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE routine_exercises (
    id TEXT PRIMARY KEY,
    routine_id TEXT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL REFERENCES exercises(id),
    order_index INTEGER NOT NULL,
    target_sets INTEGER DEFAULT 3
  );
  CREATE TABLE workout_sessions (
    id TEXT PRIMARY KEY,
    routine_id TEXT REFERENCES routines(id),
    title TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT,
    notes TEXT
  );
  CREATE TABLE logged_sets (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL REFERENCES exercises(id),
    set_number INTEGER NOT NULL,
    set_type TEXT NOT NULL DEFAULT 'working',
    weight REAL NOT NULL,
    reps INTEGER NOT NULL,
    rir INTEGER,
    completed_at TEXT NOT NULL,
    overload_recommended INTEGER DEFAULT 0
  );
  CREATE INDEX idx_sets_exercise ON logged_sets(exercise_id, completed_at);
  `,
  // Machine brand / variant. Shown as "Name · Brand"; same movement on two machines = two exercises.
  `ALTER TABLE exercises ADD COLUMN brand TEXT NOT NULL DEFAULT '';`,
  // Movement group: "Chest Press" collects barbell / dumbbell / machine variants under one Moves row.
  `
  ALTER TABLE exercises ADD COLUMN movement TEXT NOT NULL DEFAULT '';
  UPDATE exercises SET movement = 'Chest Press' WHERE id IN ('bench', 'incline-db', 'machine-press') AND movement = '';
  UPDATE exercises SET movement = 'Vertical Pull' WHERE id IN ('pullup', 'lat-pulldown') AND movement = '';
  UPDATE exercises SET movement = 'Row' WHERE id IN ('bb-row', 'cable-row', 'db-row') AND movement = '';
  UPDATE exercises SET movement = 'Squat' WHERE id IN ('squat', 'hack-squat', 'split-squat') AND movement = '';
  UPDATE exercises SET movement = 'Leg Curl' WHERE id IN ('leg-curl', 'seated-curl') AND movement = '';
  UPDATE exercises SET movement = 'Shoulder Press' WHERE id IN ('ohp', 'db-shoulder') AND movement = '';
  UPDATE exercises SET movement = 'Lateral Raise' WHERE id IN ('lateral-raise', 'cable-lateral') AND movement = '';
  UPDATE exercises SET movement = 'Rear Delt' WHERE id IN ('rear-delt', 'face-pull') AND movement = '';
  UPDATE exercises SET movement = 'Curl' WHERE id IN ('bb-curl', 'db-curl', 'hammer-curl', 'preacher-curl') AND movement = '';
  UPDATE exercises SET movement = 'Triceps Extension' WHERE id IN ('pushdown', 'overhead-ext', 'skullcrusher') AND movement = '';
  UPDATE exercises SET movement = 'Calf Raise' WHERE id IN ('calf-raise', 'seated-calf') AND movement = '';
  `,
  // Plan (program) grouping for routines, e.g. "UL" holds Day A / Day B / FB.
  `
  ALTER TABLE routines ADD COLUMN plan TEXT NOT NULL DEFAULT '';
  ALTER TABLE routines ADD COLUMN plan_order INTEGER NOT NULL DEFAULT 0;
  `,
  // Library link (src/data/library.json id), progression rule, load type, reps counted per side.
  `
  ALTER TABLE exercises ADD COLUMN library_id TEXT NOT NULL DEFAULT '';
  ALTER TABLE exercises ADD COLUMN progression TEXT NOT NULL DEFAULT 'double';
  ALTER TABLE exercises ADD COLUMN load TEXT NOT NULL DEFAULT 'weight';
  ALTER TABLE exercises ADD COLUMN per_side INTEGER NOT NULL DEFAULT 0;
  UPDATE exercises SET load = 'bodyweight' WHERE id IN ('pullup', 'dips', 'leg-raise');
  UPDATE exercises SET per_side = 1 WHERE id IN ('split-squat', 'db-row');
  `,
  // Photos attached to a session. File lives in Paths.document/photos/<id>.jpg; row keeps the name.
  `
  CREATE TABLE session_photos (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    file TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  `,
  // Free note per exercise: seat height, pin, grip, whatever to remember next time.
  `ALTER TABLE exercises ADD COLUMN notes TEXT NOT NULL DEFAULT '';`,
  // Library names carry their gear ("Lever Leg Extension"), which split the Moves list into a
  // row per bit of kit. File each under the bare move so they nest as variants instead. Longest
  // qualifier first, and each pass skips rows an earlier one already filled.
  `
  UPDATE exercises SET movement = SUBSTR(name, 12) WHERE movement = '' AND library_id <> '' AND name LIKE 'Ez Barbell %' AND LENGTH(name) > 11;
  UPDATE exercises SET movement = SUBSTR(name, 17) WHERE movement = '' AND library_id <> '' AND name LIKE 'Resistance Band %' AND LENGTH(name) > 16;
  UPDATE exercises SET movement = SUBSTR(name, 15) WHERE movement = '' AND library_id <> '' AND name LIKE 'Medicine Ball %' AND LENGTH(name) > 14;
  UPDATE exercises SET movement = SUBSTR(name, 17) WHERE movement = '' AND library_id <> '' AND name LIKE 'Olympic Barbell %' AND LENGTH(name) > 16;
  UPDATE exercises SET movement = SUBSTR(name, 15) WHERE movement = '' AND library_id <> '' AND name LIKE 'Smith Machine %' AND LENGTH(name) > 14;
  UPDATE exercises SET movement = SUBSTR(name, 10) WHERE movement = '' AND library_id <> '' AND name LIKE 'Trap Bar %' AND LENGTH(name) > 9;
  UPDATE exercises SET movement = SUBSTR(name, 9) WHERE movement = '' AND library_id <> '' AND name LIKE 'Barbell %' AND LENGTH(name) > 8;
  UPDATE exercises SET movement = SUBSTR(name, 10) WHERE movement = '' AND library_id <> '' AND name LIKE 'Dumbbell %' AND LENGTH(name) > 9;
  UPDATE exercises SET movement = SUBSTR(name, 12) WHERE movement = '' AND library_id <> '' AND name LIKE 'Kettlebell %' AND LENGTH(name) > 11;
  UPDATE exercises SET movement = SUBSTR(name, 12) WHERE movement = '' AND library_id <> '' AND name LIKE 'Bodyweight %' AND LENGTH(name) > 11;
  UPDATE exercises SET movement = SUBSTR(name, 9) WHERE movement = '' AND library_id <> '' AND name LIKE 'Machine %' AND LENGTH(name) > 8;
  UPDATE exercises SET movement = SUBSTR(name, 10) WHERE movement = '' AND library_id <> '' AND name LIKE 'Assisted %' AND LENGTH(name) > 9;
  UPDATE exercises SET movement = SUBSTR(name, 10) WHERE movement = '' AND library_id <> '' AND name LIKE 'Weighted %' AND LENGTH(name) > 9;
  UPDATE exercises SET movement = SUBSTR(name, 7) WHERE movement = '' AND library_id <> '' AND name LIKE 'Cable %' AND LENGTH(name) > 6;
  UPDATE exercises SET movement = SUBSTR(name, 7) WHERE movement = '' AND library_id <> '' AND name LIKE 'Lever %' AND LENGTH(name) > 6;
  UPDATE exercises SET movement = SUBSTR(name, 7) WHERE movement = '' AND library_id <> '' AND name LIKE 'Smith %' AND LENGTH(name) > 6;
  UPDATE exercises SET movement = SUBSTR(name, 6) WHERE movement = '' AND library_id <> '' AND name LIKE 'Sled %' AND LENGTH(name) > 5;
  UPDATE exercises SET movement = SUBSTR(name, 6) WHERE movement = '' AND library_id <> '' AND name LIKE 'Band %' AND LENGTH(name) > 5;
  UPDATE exercises SET movement = '' WHERE movement = name;
  `,
  // Web only. kv: small app state (appearance, panel order, the in-progress workout).
  // photo_files: photos from a native backup, kept as base64 so a re-export loses nothing.
  `
  CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE photo_files (name TEXT PRIMARY KEY, b64 TEXT NOT NULL);
  `,
];

export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  for (; version < MIGRATIONS.length; version++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}
