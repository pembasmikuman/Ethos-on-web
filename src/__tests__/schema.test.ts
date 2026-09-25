import { test, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { readFileSync } from 'fs';

// Extract the SQL strings without importing expo-sqlite types at runtime.
const src = readFileSync(new URL('../db/migrations.ts', import.meta.url), 'utf8');
const sqls = [...src.matchAll(/`([\s\S]*?)`/g)].map((m) => m[1]).filter((s) => /CREATE|ALTER/.test(s));

test('migrations apply cleanly on a fresh db', () => {
  const db = new Database(':memory:');
  for (const sql of sqls) db.exec(sql);
  const tables = db.query("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name);
  expect(tables).toEqual(expect.arrayContaining(['exercises', 'routines', 'routine_exercises', 'workout_sessions', 'logged_sets', 'kv', 'photo_files']));
});

test('brand folds into display name', () => {
  const db = new Database(':memory:');
  for (const sql of sqls) db.exec(sql);
  db.exec("INSERT INTO exercises (id, name, brand, primary_muscle) VALUES ('a', 'Chest Press', 'Technogym', 'chest'), ('b', 'Chest Press', '', 'chest')");
  const rows = db.query("SELECT CASE WHEN brand <> '' THEN name || ' · ' || brand ELSE name END AS name FROM exercises ORDER BY id").all() as { name: string }[];
  expect(rows.map((r) => r.name)).toEqual(['Chest Press · Technogym', 'Chest Press']);
});

test('new exercises default to weight load and double progression', () => {
  const db = new Database(':memory:');
  for (const sql of sqls) db.exec(sql);
  db.exec("INSERT INTO exercises (id, name, primary_muscle) VALUES ('a', 'Row', 'back')");
  const row = db.query('SELECT load, progression, per_side, library_id FROM exercises').get() as any;
  expect(row).toEqual({ load: 'weight', progression: 'double', per_side: 0, library_id: '' });
});
