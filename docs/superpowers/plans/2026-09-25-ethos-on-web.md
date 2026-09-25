# Ethos on Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Expo app `Ethos` as a home-screen web app (PWA) with the same features and look, on-device SQLite, and a rest bell that also reaches the phone through Web Push.

**Architecture:** Vite + React SPA. The SQL layer from the native app is kept by putting the official SQLite WASM build (opfs-sahpool VFS) in a Web Worker behind a small driver with the same method names as `expo-sqlite`. The native app's React Native screens are ported file by file with a few shims (`css()`, `Alert`, `router`, `useSafeAreaInsets`) that keep their call sites unchanged. One Cloudflare Worker serves the built app plus `/api/rest`, which schedules a Durable Object alarm that sends a payload-less Web Push.

**Tech Stack:** bun, Vite, React 19, TypeScript, Zustand 5, `@sqlite.org/sqlite-wasm`, `vite-plugin-pwa` (injectManifest) + `workbox-precaching` / `workbox-routing`, Cloudflare Workers (static assets, Durable Objects, Rate Limiting), wrangler, `@playwright/test` (WebKit).

**Spec:** `docs/spec.md` (read it first).

**Source app:** `/home/shzwn/Projects/Ethos` (`OLD/` below means that path). Ported files keep their names and logic. Read the old file before porting it.

## Global Constraints

- iOS 17+ Safari, installed to the home screen. Must not crash in a plain Safari tab or a desktop browser.
- `bun` only (`bun install`, `bun run`, `bun test`, `bunx`). Never npm/npx/node/yarn/pnpm.
- Secrets live in `.env` (gitignored) and in Worker secrets / GitHub secrets. Never commit keys.
- No exercise GIFs, no session photos UI, no haptics. Photos in an imported backup are stored and re-exported untouched.
- Backup JSON format unchanged: `{ app: 'ethos', version: 1, exported_at, photo_files?, exercises, routines, routine_exercises, workout_sessions, logged_sets, session_photos }`.
- No gesture library, no router library, no animation library. CSS transitions and pointer events only.
- The new service worker must never take over mid-session: no `skipWaiting()`, no `virtual:pwa-register` import.
- Host: `ethos.pembasmikuman.my`. VAPID `sub`: `https://ethos.pembasmikuman.my`.
- Push server: endpoint host must be Apple/Google/Mozilla/Microsoft push, `1 ≤ seconds ≤ 600`, one alarm per endpoint, rate limit per IP.
- Look and copy are 1:1 with the old app (colors in `OLD/src/lib/theme.ts`, fonts in `OLD/assets/fonts`).
- Plain words in user-facing copy, and no em dashes in docs or commit messages.

### RN → DOM port rules (every screen/component task uses these)

| Old (React Native) | New (web) |
|---|---|
| `View` | `div` (global CSS makes every `div` behave like an RN view: flex column, `flex-shrink:0`, `position:relative`, `box-sizing:border-box`) |
| `Text` / `Doto` / `Label` | `Doto` / `Label` from `src/components/Text.tsx` (render `span`) |
| `Pressable onPress` | `button type="button" onClick` (global CSS resets `button` to an RN-view look) |
| `style={({ pressed }) => [.., { opacity: pressed ? 0.7 : 1 }]}` | `className="pr-fade"` plus the static part via `css()` |
| `transform: [{ scale: pressed ? 0.97 : 1 }]` | `className="pr-scale"` |
| `onLongPress` | `{...useLongPress(fn)}` from `src/lib/press.ts` |
| `onPressIn={tapHaptic}`, `doneHaptic()`, `tapHaptic()` | delete |
| `hitSlop` | delete (buttons are already ≥44px) |
| `StyleSheet.create({...})` | plain object `const s = {...}` |
| `style={[a, b && c, {..}]}` | `style={css(a, b && c, {..})}` from `src/lib/css.ts` |
| `ScrollView` | `div className="scroll"` (overflow-y auto, flex 1); `contentContainerStyle` goes on an inner `div` |
| `ScrollView horizontal` | `div className="hscroll"` |
| `pagingEnabled` + `onMomentumScrollEnd` | `className="snap-x"` / `"snap-y"` + `onScroll` debounced 120 ms, page = `Math.round(scrollLeft / pageW)` |
| `TextInput` | `input` (`multiline` → `textarea`), `onChangeText={f}` → `onChange={(e) => f(e.target.value)}`, `keyboardType="numeric"` → `inputMode="decimal"` |
| `react-native-svg` `Svg/Path/Circle/Rect/G` | `svg/path/circle/rect/g` |
| `Alert.alert`, `Alert.prompt` | same call, imported from `src/lib/alert.ts` |
| `router`, `useLocalSearchParams`, `useFocusEffect`, `usePathname`, `Redirect` from `expo-router` | same names from `src/lib/nav.ts` |
| `useSafeAreaInsets` from `react-native-safe-area-context` | same name from `src/lib/insets.ts` |
| `useTopInset()` | same, from `src/lib/theme.ts` (returns `insets.top`) |
| `Platform.*` branches | keep the iOS branch only |
| `Image` of a GIF | delete |
| `BlurView` | `div` with `backdropFilter: 'blur(24px) saturate(1.6)'`, `WebkitBackdropFilter` too |

## Review Focus

1. **Cold launch with no signal** (gym basement): the installed app must open, show data and log sets from cache. Covered by the airplane-mode check in Task 5 and the `.wasm` in the precache glob.
2. **Reload mid-rest** (iOS evicted the page while you were in Spotify): the app comes back on the same exercise and set, the countdown continues, the bell never rings twice or late, and new sets never reuse an old draft id. Covered by `restOutcome` tests and the persistence test in Task 12.
3. **Native backup with photos → import → export** must give the same data, `photo_files` included. Covered by the bun round-trip test (Task 3) and the Playwright test (Task 13).
4. **Plain Safari tab or desktop browser** (no `PushManager`, no `Notification`, no `wakeLock`): no crash, the bell and countdown still work, Settings says alerts are unsupported. Covered by `alertStatus` tests in Task 6 and a manual check in Task 12.
5. **Weak or no signal when logging a set**: the set is marked done and the countdown starts instantly. The push request runs in the background with a 4 s timeout, and a slow permission prompt or a missing service worker never holds up logging. Covered by the `workoutRest` test in Task 11.

(The second tab or window holding the database, and a quick reload racing the old page for the storage lock, are covered by the boot retry and the manual checks in Task 4.)

---

### Task 1: Scaffold and port the pure logic

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `src/main.tsx`, `README.md`
- Copy verbatim: `OLD/src/lib/{format,progression,variants,library}.ts` → `src/lib/`, `OLD/src/data/{library,body}.json` → `src/data/`, `OLD/src/__tests__/{format,progression,variants,library}.test.ts` → `src/__tests__/`, `OLD/LICENSE`, `OLD/docs/NOTICE.md` → `docs/NOTICE.md`

**Interfaces:**
- Produces: `fmtClock`, `fmtKg`, `applyKey` (`src/lib/format.ts`); everything exported from `progression.ts`, `variants.ts`, `library.ts` unchanged.

- [ ] **Step 1: Write the project files**

`package.json`:
```json
{
  "name": "ethos-on-web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "check": "tsc --noEmit",
    "test": "bun test src worker",
    "deploy": "vite build && wrangler deploy"
  }
}
```

Then install:
```bash
bun add react react-dom zustand @sqlite.org/sqlite-wasm
bun add -d vite @vitejs/plugin-react typescript @types/react @types/react-dom @types/bun
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["bun", "vite/client"]
  },
  "include": ["src", "scripts"],
  "exclude": ["src/sw.ts"]
}
```

`vite.config.ts` (the PWA plugin is added in Task 5):
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
  worker: { format: 'es' },
});
```

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="theme-color" content="#0A0A0B" />
    <title>Ethos</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`.gitignore`:
```
node_modules
dist
.env
.wrangler
test-results
```

`src/main.tsx` (placeholder, replaced in Task 4):
```tsx
document.getElementById('root')!.textContent = 'Ethos';
```

- [ ] **Step 2: Copy the pure logic, data and tests**

```bash
O=/home/shzwn/Projects/Ethos
mkdir -p src/lib src/data src/__tests__ docs
cp $O/src/lib/{format,progression,variants,library}.ts src/lib/
cp $O/src/data/{library,body}.json src/data/
cp $O/src/__tests__/{format,progression,variants,library}.test.ts src/__tests__/
cp $O/LICENSE . && cp $O/docs/NOTICE.md docs/
grep -n "from '" src/lib/*.ts
```
Expected: the grep shows only relative imports, `../data/*.json`, and `import type` from `../db`. `progression.ts` and `variants.ts` import types from `../db`. Create `src/db/types.ts` now by copying the `Exercise`, `Progression`, `Load` types from `OLD/src/db/index.ts:21-44`, and add `src/db/index.ts` with `export * from './types';` so those type imports resolve (Task 2 grows this file).

- [ ] **Step 3: Run tests and typecheck**

Run: `bun test src && bun run check`
Expected: all ported tests PASS, and tsc reports no errors.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Scaffold Vite app and carry over progression, format, variants and library logic with their tests"
```

---

### Task 2: Database driver, migrations, queries, seed and kv

**Files:**
- Create: `src/db/driver.ts`, `src/db/bun.ts`, `src/db/kv.ts`, `src/__tests__/queries.test.ts`
- Modify: `src/db/index.ts`
- Port: `OLD/src/db/{migrations,queries,seed}.ts` → `src/db/`, `OLD/src/__tests__/schema.test.ts` → `src/__tests__/`

**Interfaces:**
- Produces:
  - `type Db = { getAllAsync<T>(sql: string, bind?: unknown[]): Promise<T[]>; getFirstAsync<T>(sql, bind?): Promise<T | null>; runAsync(sql, bind?): Promise<void>; execAsync(sql): Promise<void>; withTransactionAsync(fn: () => Promise<void>): Promise<void> }`
  - `initDb(raw: Db): Promise<void>` runs migrate, seed and seedRoutines, and makes `getDb()` resolve to `raw`.
  - `getDb(): Promise<Db>`
  - `bunDb(): Db` (tests only, `src/db/bun.ts`)
  - `loadKv(): Promise<void>`, `kv.get(key): string | null`, `kv.set(key, value): void`, `kv.del(key): void`
  - Every export of `OLD/src/db/queries.ts` with the same signature, plus `setSessionNotes(sessionId, notes)` moved in from `OLD/src/lib/photos.ts`.

- [ ] **Step 1: Write the driver and the bun test driver**

`src/db/driver.ts`:
```ts
/** The slice of expo-sqlite's API the queries use. Both the worker driver and the bun test driver implement it. */
export type Db = {
  getAllAsync<T = any>(sql: string, bind?: unknown[]): Promise<T[]>;
  getFirstAsync<T = any>(sql: string, bind?: unknown[]): Promise<T | null>;
  runAsync(sql: string, bind?: unknown[]): Promise<void>;
  execAsync(sql: string): Promise<void>;
  withTransactionAsync(fn: () => Promise<void>): Promise<void>;
};

/** BEGIN/COMMIT around fn, ROLLBACK on throw. */
// ponytail: no lock, a query fired from another screen mid-transaction joins it; add a queue if restore ever races UI writes
export async function tx(db: Db, fn: () => Promise<void>): Promise<void> {
  await db.execAsync('BEGIN');
  try {
    await fn();
    await db.execAsync('COMMIT');
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }
}
```

`src/db/bun.ts`:
```ts
import { Database } from 'bun:sqlite';
import { tx, type Db } from './driver';

/** Fresh in-memory database behind the Db interface. Tests only. */
export function bunDb(): Db {
  const d = new Database(':memory:');
  const db: Db = {
    getAllAsync: async (sql, bind = []) => d.query(sql).all(...(bind as never[])) as never,
    getFirstAsync: async (sql, bind = []) => (d.query(sql).get(...(bind as never[])) ?? null) as never,
    runAsync: async (sql, bind = []) => { d.query(sql).run(...(bind as never[])); },
    execAsync: async (sql) => { d.exec(sql); },
    withTransactionAsync: (fn) => tx(db, fn),
  };
  return db;
}
```

`src/db/index.ts`:
```ts
import type { Db } from './driver';
import { migrate } from './migrations';
import { seed, seedRoutines } from './seed';
export * from './types';
export type { Db } from './driver';

let dbPromise: Promise<Db> | null = null;

/** Migrate and seed `raw`, then hand it out from getDb(). Called once at boot, and per test. */
export function initDb(raw: Db): Promise<void> {
  dbPromise = (async () => {
    await migrate(raw);
    await seed(raw);
    await seedRoutines(raw);
    return raw;
  })();
  return dbPromise.then(() => {});
}

export function getDb(): Promise<Db> {
  if (!dbPromise) throw new Error('initDb was not called');
  return dbPromise;
}
```

- [ ] **Step 2: Port migrations, seed, queries**

```bash
O=/home/shzwn/Projects/Ethos
cp $O/src/db/{migrations,seed,queries}.ts src/db/
cp $O/src/__tests__/schema.test.ts src/__tests__/
```
Edits:
- In `migrations.ts` and `seed.ts`, replace `import type { SQLiteDatabase } from 'expo-sqlite';` with `import type { Db as SQLiteDatabase } from './driver';`.
- In `migrations.ts` `migrate()`, change the first line to `await db.execAsync('PRAGMA foreign_keys = ON;');`. WAL needs shared memory, which opfs-sahpool doesn't have.
- Append one entry to the end of `MIGRATIONS`:
```ts
  // Web only. kv: small app state (appearance, panel order, the in-progress workout).
  // photo_files: photos from a native backup, kept as base64 so a re-export loses nothing.
  `
  CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE photo_files (name TEXT PRIMARY KEY, b64 TEXT NOT NULL);
  `,
```
- In `queries.ts`, delete `import * as Crypto from 'expo-crypto';` and replace every `Crypto.randomUUID()` with `crypto.randomUUID()`. Append the following, copied from `OLD/src/lib/photos.ts`:
```ts
export async function setSessionNotes(sessionId: string, notes: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE workout_sessions SET notes = ? WHERE id = ?', [notes, sessionId]);
}
```
- `schema.test.ts`: extend the expected table list with `'kv', 'photo_files'`.

- [ ] **Step 3: Write kv**

`src/db/kv.ts`:
```ts
import { getDb } from '.';

const cache = new Map<string, string>();

/** Read the whole kv table into memory. Call once after initDb, before any store is created. */
export async function loadKv(): Promise<void> {
  const db = await getDb();
  cache.clear();
  for (const r of await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM kv')) cache.set(r.key, r.value);
}

/** Sync reads from memory, writes go through to SQLite in the background (the worker keeps them in order). */
export const kv = {
  get: (key: string): string | null => cache.get(key) ?? null,
  set(key: string, value: string): void {
    cache.set(key, value);
    void getDb().then((db) => db.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', [key, value]));
  },
  del(key: string): void {
    cache.delete(key);
    void getDb().then((db) => db.runAsync('DELETE FROM kv WHERE key = ?', [key]));
  },
};
```

- [ ] **Step 4: Write the failing queries test**

`src/__tests__/queries.test.ts`:
```ts
import { beforeEach, expect, test } from 'bun:test';
import { bunDb } from '../db/bun';
import { initDb, getDb } from '../db';
import { listRoutines, startSession, insertSet, sessionSets, finishSession, setSessionNotes } from '../db/queries';
import { kv, loadKv } from '../db/kv';

beforeEach(() => initDb(bunDb()));

test('seed creates routines and a logged set round-trips', async () => {
  const routines = await listRoutines();
  expect(routines.length).toBeGreaterThan(0);
  const sid = await startSession(routines[0]);
  await insertSet({ session_id: sid, exercise_id: 'bench', set_number: 1, set_type: 'working', weight: 80, reps: 8, rir: 2 });
  await finishSession(sid);
  await setSessionNotes(sid, 'felt good');
  const sets = await sessionSets(sid);
  expect(sets.map((s) => [s.weight, s.reps, s.rir])).toEqual([[80, 8, 2]]);
  const db = await getDb();
  expect((await db.getFirstAsync<{ notes: string }>('SELECT notes FROM workout_sessions WHERE id = ?', [sid]))?.notes).toBe('felt good');
});

test('kv writes survive a reload from the table', async () => {
  kv.set('a', '1');
  kv.set('a', '2');
  kv.set('b', 'x');
  kv.del('b');
  await (await getDb()).getAllAsync('SELECT 1'); // let the background writes land
  await loadKv();
  expect([kv.get('a'), kv.get('b')]).toEqual(['2', null]);
});

test('transaction rolls back on throw', async () => {
  const db = await getDb();
  await expect(db.withTransactionAsync(async () => {
    await db.runAsync("INSERT INTO routines (id, name) VALUES ('x', 'X')");
    throw new Error('boom');
  })).rejects.toThrow('boom');
  expect(await db.getFirstAsync("SELECT id FROM routines WHERE id = 'x'")).toBeNull();
});
```
Before writing it, open `OLD/src/db/queries.ts` and confirm the names and argument shapes of `startSession`, `insertSet`, `sessionSets`, `finishSession`. Adjust the test to the real signatures and keep its assertions.

- [ ] **Step 5: Run the tests**

Run: `bun test src`
Expected: all PASS. If the kv test is flaky, the `SELECT 1` did not queue behind the writes. Make `kv.set` and `kv.del` return their promise and `await` them in the test.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Carry over the SQL layer behind a small driver, add kv and photo_files tables for web-only state"
```

---

### Task 3: Backup export and import

**Files:**
- Create: `src/lib/backup.ts`, `src/__tests__/backup.test.ts`, `src/__tests__/fixtures/backup.json`

**Interfaces:**
- Consumes: `getDb`, `Db` (Task 2).
- Produces: `type Backup`, `backupFile(): Promise<File>`, `shareFile(file: File): Promise<void>`, `dumpBackup(): Promise<Backup>`, `parseBackup(text: string): Backup` (throws `Error('Not an Ethos backup')`), `restoreBackup(b: Backup): Promise<void>`, `backupSummary(b): string`, `exportBackup(): Promise<void>`, `pickBackup(): Promise<Backup | null>`.

- [ ] **Step 1: Write the fixture**

`src/__tests__/fixtures/backup.json` is a small native-format backup with one routine, one session, two sets, one photo row and its `photo_files` entry:
```json
{
  "app": "ethos", "version": 1, "exported_at": "2026-09-01T10:00:00.000Z",
  "exercises": [{ "id": "bench", "name": "Barbell Bench Press", "primary_muscle": "chest", "secondary_muscles": "triceps,delts", "equipment": "barbell", "default_rest_seconds": 210, "target_rep_min": 5, "target_rep_max": 8, "increment_kg": 2.5, "brand": "", "movement": "Chest Press", "library_id": "", "progression": "double", "load": "weight", "per_side": 0, "notes": "" }],
  "routines": [{ "id": "r1", "name": "Day A", "notes": null, "created_at": "2026-08-01 00:00:00", "plan": "UL", "plan_order": 0 }],
  "routine_exercises": [{ "id": "re1", "routine_id": "r1", "exercise_id": "bench", "order_index": 0, "target_sets": 3 }],
  "workout_sessions": [{ "id": "s1", "routine_id": "r1", "title": "UL · Day A", "start_time": "2026-09-01T09:00:00.000Z", "end_time": "2026-09-01T10:00:00.000Z", "notes": "ok" }],
  "logged_sets": [
    { "id": "l1", "session_id": "s1", "exercise_id": "bench", "set_number": 1, "set_type": "working", "weight": 80, "reps": 8, "rir": 2, "completed_at": "2026-09-01T09:10:00.000Z", "overload_recommended": 0 },
    { "id": "l2", "session_id": "s1", "exercise_id": "bench", "set_number": 2, "set_type": "working", "weight": 80, "reps": 7, "rir": null, "completed_at": "2026-09-01T09:14:00.000Z", "overload_recommended": 0 }
  ],
  "session_photos": [{ "id": "p1", "session_id": "s1", "file": "p1.jpg", "created_at": "2026-09-01T09:30:00.000Z" }],
  "photo_files": { "p1.jpg": "/9j/4AAQSkZJRg==" }
}
```

- [ ] **Step 2: Write the failing test**

`src/__tests__/backup.test.ts`:
```ts
import { beforeEach, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { bunDb } from '../db/bun';
import { initDb } from '../db';
import { dumpBackup, parseBackup, restoreBackup } from '../lib/backup';

const text = readFileSync(new URL('./fixtures/backup.json', import.meta.url), 'utf8');
const strip = ({ exported_at, ...rest }: Record<string, unknown>) => rest;

beforeEach(() => initDb(bunDb()));

test('restore then dump gives back the same backup, photos included', async () => {
  const b = parseBackup(text);
  await restoreBackup(b);
  expect(strip(await dumpBackup())).toEqual(strip(JSON.parse(text)));
});

test('restoring twice does not duplicate photo files', async () => {
  await restoreBackup(parseBackup(text));
  await restoreBackup(parseBackup(text));
  expect(Object.keys((await dumpBackup()).photo_files ?? {})).toEqual(['p1.jpg']);
});

test('rejects files that are not Ethos backups', () => {
  expect(() => parseBackup('{"app":"other"}')).toThrow('Not an Ethos backup');
  expect(() => parseBackup('not json')).toThrow();
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `bun test src/__tests__/backup.test.ts`
Expected: FAIL, cannot find `../lib/backup`.

- [ ] **Step 4: Write `src/lib/backup.ts`**

```ts
import { getDb } from '../db';

const TABLES = ['exercises', 'routines', 'routine_exercises', 'workout_sessions', 'logged_sets', 'session_photos'] as const;

export type Backup = { app: 'ethos'; version: 1; exported_at: string; /** Photo file name -> base64 JPEG. */ photo_files?: Record<string, string> } & Record<(typeof TABLES)[number], Record<string, unknown>[]>;

export async function dumpBackup(): Promise<Backup> {
  const db = await getDb();
  const out: Record<string, unknown> = { app: 'ethos', version: 1, exported_at: new Date().toISOString() };
  for (const t of TABLES) out[t] = await db.getAllAsync(`SELECT * FROM ${t}`);
  const files = await db.getAllAsync<{ name: string; b64: string }>('SELECT name, b64 FROM photo_files');
  out.photo_files = Object.fromEntries(files.map((f) => [f.name, f.b64]));
  return out as Backup;
}

export function parseBackup(text: string): Backup {
  const parsed = JSON.parse(text) as Partial<Backup>;
  if (parsed.app !== 'ethos' || !Array.isArray(parsed.logged_sets)) throw new Error('Not an Ethos backup');
  return parsed as Backup;
}

/** Wipe all tables and insert backup rows. Caller must confirm first. */
export async function restoreBackup(b: Backup): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const t of [...TABLES].reverse()) await db.execAsync(`DELETE FROM ${t}`);
    await db.execAsync('DELETE FROM photo_files');
    for (const t of TABLES) {
      for (const row of b[t] ?? []) {
        const cols = Object.keys(row);
        await db.runAsync(`INSERT INTO ${t} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, cols.map((c) => row[c]));
      }
    }
    for (const [name, b64] of Object.entries(b.photo_files ?? {})) await db.runAsync('INSERT INTO photo_files (name, b64) VALUES (?, ?)', [name, b64]);
  });
}

export function backupSummary(b: Backup): string {
  return `${b.workout_sessions.length} sessions · ${b.logged_sets.length} sets · exported ${b.exported_at.slice(0, 10)}`;
}

/** The backup as a ready-to-share file. Settings builds it ahead of time so the tap can share with no await first. */
export async function backupFile(): Promise<File> {
  const data = await dumpBackup();
  const stamp = data.exported_at.slice(0, 19).replace(/[:T]/g, '-');
  return new File([JSON.stringify(data)], `ethos_backup_${stamp}.json`, { type: 'application/json' });
}

export async function exportBackup(): Promise<void> {
  await shareFile(await backupFile());
}

/** Share sheet on iPhone (Save to Files, AirDrop), plain download elsewhere. Call straight from the tap:
 *  Safari refuses share() if the tap is already "used up" by an earlier await. */
export async function shareFile(file: File): Promise<void> {
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

/** Open the Files picker. Resolves null if the user backs out. */
export function pickBackup(): Promise<Backup | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      try { resolve(parseBackup(await f.text())); } catch (e) { reject(e); }
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
```

- [ ] **Step 5: Run the tests**

Run: `bun test src`
Expected: all PASS. If the round-trip fails on key order or on `null` vs missing, fix `restoreBackup` or `dumpBackup`, never the test. The comparison is what protects the user's history.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Backup: same JSON format as the native app, photos kept as-is, share sheet export and Files import"
```

---

### Task 4: SQLite in a worker, and boot

**Files:**
- Create: `src/db/worker.ts`, `src/db/client.ts`, `src/boot.tsx`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `Db`, `tx`, `initDb`, `loadKv`.
- Produces: `openWorkerDb(): Promise<Db>`. `main.tsx` boots, then dynamically imports `./App` (Task 7 creates it; until then, boot renders a table count).

- [ ] **Step 1: Write the worker**

`src/db/worker.ts`:
```ts
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

type Req = { id: number; op: 'all' | 'run'; sql: string; bind?: unknown[] };

const ready = (async () => {
  const sqlite3 = await sqlite3InitModule();
  const pool = await sqlite3.installOpfsSAHPoolVfs({});
  return new pool.OpfsSAHPoolDb('/ethos.sqlite3');
})();

// id 0 reports whether the database opened. A second tab fails here because the pool holds a file lock.
ready.then(
  () => postMessage({ id: 0 }),
  (e) => postMessage({ id: 0, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) }),
);

self.onmessage = async ({ data: r }: MessageEvent<Req>) => {
  try {
    const db = await ready;
    const rows = r.op === 'all'
      ? db.exec({ sql: r.sql, bind: r.bind as never, rowMode: 'object', returnValue: 'resultRows' })
      : (db.exec({ sql: r.sql, bind: r.bind as never }), undefined);
    postMessage({ id: r.id, rows });
  } catch (e) {
    postMessage({ id: r.id, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) });
  }
};
```
Multi-statement SQL (migrations) is sent without `bind`, and `exec` runs every statement in it.

- [ ] **Step 2: Write the client**

`src/db/client.ts`:
```ts
import { tx, type Db } from './driver';

/** Start the SQLite worker. On a quick reload the old page's worker can still hold the file lock for a moment,
 *  so try a few times before giving up (a real second tab keeps failing). */
export async function openWorkerDb(): Promise<Db> {
  for (let i = 0; ; i++) {
    try {
      return await openOnce();
    } catch (e) {
      if (i >= 5) throw e;
      await new Promise((r) => setTimeout(r, 300));
    }
  }
}

function openOnce(): Promise<Db> {
  const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  const pending = new Map<number, { res: (v: any) => void; rej: (e: Error) => void }>();
  let n = 0;
  const call = (op: 'all' | 'run', sql: string, bind?: unknown[]) =>
    new Promise<any>((res, rej) => {
      pending.set(++n, { res, rej });
      w.postMessage({ id: n, op, sql, bind });
    });
  const db: Db = {
    getAllAsync: (sql, bind) => call('all', sql, bind),
    getFirstAsync: async (sql, bind) => (await call('all', sql, bind))[0] ?? null,
    runAsync: async (sql, bind) => { await call('run', sql, bind); },
    execAsync: async (sql) => { await call('run', sql); },
    withTransactionAsync: (fn) => tx(db, fn),
  };
  return new Promise((resolve, reject) => {
    w.onmessage = ({ data }) => {
      if (data.id === 0) {
        if (!data.error) return resolve(db);
        w.terminate(); // a fresh worker per try, so a cached failure inside the library can't stick
        return reject(new Error(data.error));
      }
      const p = pending.get(data.id)!;
      pending.delete(data.id);
      if (data.error) p.rej(new Error(data.error));
      else p.res(data.rows);
    };
  });
}
```

- [ ] **Step 3: Write boot**

`src/main.tsx`:
```tsx
import { createRoot } from 'react-dom/client';
import { openWorkerDb } from './db/client';
import { initDb } from './db';
import { loadKv } from './db/kv';

const root = createRoot(document.getElementById('root')!);

(async () => {
  try {
    await initDb(await openWorkerDb());
    await loadKv();
    navigator.storage?.persist?.().catch(() => {});
  } catch (e) {
    root.render(
      <div style={{ padding: 24, color: '#F2F2F0', background: '#0A0A0B', height: '100dvh', fontFamily: 'monospace' }}>
        <p>Ethos is open somewhere else. Close the other tab or window, then reload.</p>
        <p style={{ opacity: 0.5, fontSize: 12 }}>{String(e)}</p>
      </div>,
    );
    return;
  }
  // Stores read kv when their module loads, so the app is imported only after loadKv.
  const { App } = await import('./App');
  root.render(<App />);
})();
```
Until Task 7, create `src/App.tsx` as a stub:
```tsx
import { useEffect, useState } from 'react';
import { getDb } from './db';

export function App() {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => { getDb().then((db) => db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM exercises')).then((r) => setN(r?.n ?? 0)); }, []);
  return <p>exercises: {n ?? '…'}</p>;
}
```

- [ ] **Step 4: Check it in a real browser**

Run: `bun run dev`, then open `http://localhost:5173` with the Playwright MCP browser.
Expected: `exercises: <number > 1000>`. Reload and the count stays the same, because seed must not duplicate. Reload quickly 10 times in a row and never see the lock screen. Open a second tab to the same URL and expect the "open somewhere else" message after about 2 s. (Chromium locks OPFS access handles the same way Safari does.)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Open SQLite in a worker with OPFS storage, boot waits for it and explains a locked database"
```

---

### Task 5: PWA shell and first deploy

**Files:**
- Create: `src/sw.ts`, `wrangler.jsonc`, `worker/index.ts`, `worker/tsconfig.json`, `.github/workflows/deploy.yml`, `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`, `public/fonts/*`
- Modify: `vite.config.ts`, `index.html`, `package.json`

**Interfaces:**
- Produces: a deployed app at `https://ethos.pembasmikuman.my` with offline precache, and `worker/index.ts` exporting `default { fetch }` (Task 6 adds the Durable Object).

- [ ] **Step 1: Install**

```bash
bun add -d vite-plugin-pwa workbox-precaching workbox-routing wrangler @cloudflare/workers-types
```

- [ ] **Step 2: Icons and fonts**

```bash
O=/home/shzwn/Projects/Ethos
mkdir -p public/fonts
magick $O/assets/icon.png -resize 512x512 public/icon-512.png
magick $O/assets/icon.png -resize 192x192 public/icon-192.png
magick $O/assets/icon.png -resize 180x180 public/apple-touch-icon.png
cp $O/assets/fonts/*.ttf public/fonts/
```
Add `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />` to `index.html` `<head>`.

- [ ] **Step 3: Service worker and plugin config**

`src/sw.ts`:
```ts
/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare let self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }));

// Never skipWaiting: a new version waits until every Ethos window is closed, so it can't swap code mid-workout.

// Push carries no payload. iOS revokes permission if a push shows nothing, so always show one.
self.addEventListener('push', (e) => {
  e.waitUntil(self.registration.showNotification('Rest done', { body: 'Next set.', tag: 'rest' }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((cs) => (cs[0] ? cs[0].focus() : self.clients.openWindow('/workout'))),
  );
});
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: 'script-defer',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,wasm,ttf,png,webmanifest}'],
        maximumFileSizeToCacheInBytes: 6_000_000,
      },
      manifest: {
        name: 'Ethos',
        short_name: 'Ethos',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        background_color: '#0A0A0B',
        theme_color: '#0A0A0B',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
  worker: { format: 'es' },
});
```
`src/sw.ts` is excluded from the root `tsconfig.json` (its WebWorker lib clashes with DOM). Vite's build still compiles it.

- [ ] **Step 4: Worker and wrangler config**

`worker/index.ts`:
```ts
export interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/api/health') return new Response('ok');
    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
```

`worker/tsconfig.json`:
```json
{
  "compilerOptions": { "target": "ES2022", "module": "ESNext", "moduleResolution": "bundler", "strict": true, "noEmit": true, "types": ["@cloudflare/workers-types"], "lib": ["ES2022"] },
  "include": ["."],
  "exclude": ["*.test.ts"]
}
```

`wrangler.jsonc`:
```jsonc
{
  "name": "ethos",
  "main": "worker/index.ts",
  "compatibility_date": "2026-09-01",
  "assets": {
    "directory": "./dist/",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  },
  "routes": [{ "pattern": "ethos.pembasmikuman.my", "custom_domain": true }]
}
```
Update the `package.json` `check` script to `tsc --noEmit && tsc --noEmit -p worker`.

- [ ] **Step 5: Build locally**

Run: `bun run build && ls dist && grep -o '"[^"]*\.wasm"' dist/sw.js | head -1`
Expected: `dist/` contains `sw.js`, `manifest.webmanifest`, and a `.wasm` asset, and the grep prints the wasm file name (it's in the precache list).

- [ ] **Step 6: USER CHECKPOINT: outward-facing setup**

Stop and ask the user to do or approve each of these, one at a time:
1. `gh repo create pembasmikuman/Ethos-on-web --public --source . --push`
2. In Cloudflare, create an API token with the "Edit Cloudflare Workers" template scoped to their account, and note the account ID.
3. `gh secret set CLOUDFLARE_API_TOKEN` and `gh secret set CLOUDFLARE_ACCOUNT_ID` (the user pastes the values; never echo them).
4. First deploy from the laptop: `bunx wrangler login && bun run deploy`. This also creates the `ethos.pembasmikuman.my` custom domain record.

- [ ] **Step 7: GitHub Action**

`.github/workflows/deploy.yml`:
```yaml
name: Deploy
on:
  push:
    branches: [main]
  workflow_dispatch:
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run check
      - run: bun run test
      - run: bun run build
        env:
          VITE_VAPID_PUBLIC_KEY: ${{ vars.VAPID_PUBLIC_KEY }}
      - run: bunx wrangler deploy --var VAPID_PUBLIC_KEY:${{ vars.VAPID_PUBLIC_KEY }}
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

- [ ] **Step 8: Check on the iPhone (user does this, you guide)**

1. Open `https://ethos.pembasmikuman.my` in Safari, then Share → Add to Home Screen.
2. Open it from the home screen and expect the exercise count.
3. Close it from the app switcher, turn on Airplane Mode, and open it again. Expect the same count. If it's blank, the wasm or a chunk is missing from the precache. Fix `globPatterns` and redeploy.

- [ ] **Step 9: Commit and push**

```bash
git add -A && git commit -m "Installable offline shell on Cloudflare: service worker precache, manifest, deploy on push to main" && git push
```
Expected: the Deploy action goes green.

---

### Task 6: Rest push server and client

**Files:**
- Create: `worker/vapid.ts`, `worker/vapid.test.ts`, `scripts/vapid-keys.ts`, `src/lib/rest.ts`, `src/__tests__/rest.test.ts`
- Modify: `worker/index.ts`, `wrangler.jsonc`

**Interfaces:**
- Produces (client, `src/lib/rest.ts`):
  - `ensurePush(): void`. It must be called synchronously at the start of a tap handler, before any `await`.
  - `scheduleRestDone(seconds: number): Promise<string | null>` returns the push endpoint used as the id.
  - `cancelRestDone(id: string | null): Promise<void>`
  - `alertStatus(env?): 'on' | 'off' | 'blocked' | 'unsupported'`
- Produces (worker): `POST /api/rest {endpoint, seconds}` → 204, and `DELETE /api/rest {endpoint}` → 204.

- [ ] **Step 1: Write the failing VAPID test**

`worker/vapid.test.ts`:
```ts
import { expect, test } from 'bun:test';
import { allowedEndpoint, b64u, vapidAuth } from './vapid';

test('only real push services are allowed', () => {
  expect(allowedEndpoint('https://web.push.apple.com/abc')).toBe(true);
  expect(allowedEndpoint('https://fcm.googleapis.com/fcm/send/x')).toBe(true);
  expect(allowedEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true);
  expect(allowedEndpoint('https://evil.com/web.push.apple.com')).toBe(false);
  expect(allowedEndpoint('https://push.apple.com.evil.com/x')).toBe(false);
  expect(allowedEndpoint('http://web.push.apple.com/x')).toBe(false);
  expect(allowedEndpoint('not a url')).toBe(false);
});

test('vapid header carries a JWT that verifies with the public key', async () => {
  const k = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = b64u(await crypto.subtle.exportKey('raw', k.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', k.privateKey);
  const h = await vapidAuth('https://web.push.apple.com/abc', jwk, pub, 'https://ethos.pembasmikuman.my', 1_000_000_000_000);
  const [, t, kk] = h.match(/^vapid t=([^,]+), k=(.+)$/)!;
  expect(kk).toBe(pub);
  const [head, body, sig] = t.split('.');
  const dec = (s: string) => JSON.parse(atob(s.replace(/-/g, '+').replace(/_/g, '/')));
  expect(dec(head)).toEqual({ typ: 'JWT', alg: 'ES256' });
  expect(dec(body)).toEqual({ aud: 'https://web.push.apple.com', exp: 1_000_000_000 + 12 * 3600, sub: 'https://ethos.pembasmikuman.my' });
  const raw = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  expect(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k.publicKey, raw, new TextEncoder().encode(`${head}.${body}`))).toBe(true);
});
```
Run: `bun test worker`. Expected: FAIL, `./vapid` not found.

- [ ] **Step 2: Write `worker/vapid.ts`**

```ts
export const b64u = (buf: ArrayBuffer | Uint8Array): string =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const PUSH_HOSTS = /(^|\.)(push\.apple\.com|fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com)$/;

/** True only for https URLs on a known browser push service, so the server can't be used to hit anything else. */
export function allowedEndpoint(e: string): boolean {
  try {
    const u = new URL(e);
    return u.protocol === 'https:' && PUSH_HOSTS.test(u.hostname);
  } catch {
    return false;
  }
}

/** Authorization header for a payload-less Web Push (RFC 8292), signed with the VAPID private key. */
export async function vapidAuth(endpoint: string, privateJwk: JsonWebKey, publicKey: string, sub: string, now = Date.now()): Promise<string> {
  const key = await crypto.subtle.importKey('jwk', privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const enc = (o: object) => b64u(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = `${enc({ typ: 'JWT', alg: 'ES256' })}.${enc({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub })}`;
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned));
  return `vapid t=${unsigned}.${b64u(sig)}, k=${publicKey}`;
}
```
Run: `bun test worker`. Expected: PASS.

- [ ] **Step 3: Durable Object and route**

`worker/index.ts`:
```ts
import { DurableObject } from 'cloudflare:workers';
import { allowedEndpoint, vapidAuth } from './vapid';

export interface Env {
  ASSETS: Fetcher;
  REST: DurableObjectNamespace<RestAlarm>;
  LIMIT: RateLimit;
  VAPID_PRIVATE_JWK: string;
  VAPID_PUBLIC_KEY: string;
}

const MAX_SECONDS = 600;
const SUB = 'https://ethos.pembasmikuman.my';

/** One per push endpoint (per device). Holds at most one pending rest alarm; a new schedule replaces it. */
export class RestAlarm extends DurableObject<Env> {
  async schedule(endpoint: string, seconds: number): Promise<void> {
    await this.ctx.storage.put('endpoint', endpoint);
    await this.ctx.storage.setAlarm(Date.now() + seconds * 1000);
  }
  async cancel(): Promise<void> {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }
  async alarm(): Promise<void> {
    const endpoint = await this.ctx.storage.get<string>('endpoint');
    await this.ctx.storage.deleteAll();
    if (!endpoint) return;
    const auth = await vapidAuth(endpoint, JSON.parse(this.env.VAPID_PRIVATE_JWK), this.env.VAPID_PUBLIC_KEY, SUB);
    await fetch(endpoint, { method: 'POST', headers: { Authorization: auth, TTL: '60', Urgency: 'high' } });
  }
}

const res = (status: number, body?: string) => new Response(body ?? null, { status });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/api/health') return res(200, 'ok');
    if (url.pathname !== '/api/rest') return res(404, 'Not found');
    if (req.method !== 'POST' && req.method !== 'DELETE') return res(405);
    const { success } = await env.LIMIT.limit({ key: req.headers.get('cf-connecting-ip') ?? 'none' });
    if (!success) return res(429, 'Slow down');
    const body = (await req.json().catch(() => ({}))) as { endpoint?: unknown; seconds?: unknown };
    const endpoint = typeof body.endpoint === 'string' ? body.endpoint : '';
    if (!allowedEndpoint(endpoint)) return res(400, 'Bad endpoint');
    const stub = env.REST.get(env.REST.idFromName(endpoint));
    if (req.method === 'DELETE') {
      await stub.cancel();
      return res(204);
    }
    const seconds = Number(body.seconds);
    if (!Number.isFinite(seconds) || seconds < 1 || seconds > MAX_SECONDS) return res(400, 'Bad seconds');
    await stub.schedule(endpoint, Math.round(seconds));
    return res(204);
  },
} satisfies ExportedHandler<Env>;
```

Add to `wrangler.jsonc`:
```jsonc
  "durable_objects": { "bindings": [{ "name": "REST", "class_name": "RestAlarm" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["RestAlarm"] }],
  "ratelimits": [{ "name": "LIMIT", "namespace_id": "1001", "simple": { "limit": 30, "period": 60 } }]
```
If the deploy says the `ratelimits` binding isn't available on the free plan, remove it and the `LIMIT` lines. The endpoint allowlist, the 600 s cap and the one-alarm-per-device rule still hold. Leave `// ponytail: no per-IP limit on free plan, add when abuse shows up in the dashboard`.

- [ ] **Step 4: VAPID keys (USER CHECKPOINT for the secret)**

`scripts/vapid-keys.ts`:
```ts
import { b64u } from '../worker/vapid';

/** Prints a new VAPID key pair as .env lines. Run once. */
const k = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
console.log(`VITE_VAPID_PUBLIC_KEY=${b64u(await crypto.subtle.exportKey('raw', k.publicKey))}`);
console.log(`VAPID_PRIVATE_JWK='${JSON.stringify(await crypto.subtle.exportKey('jwk', k.privateKey))}'`);
```
Run: `bun scripts/vapid-keys.ts >> .env`. Then ask the user to open `.env` and run these, pasting values when asked (their shell is fish, so don't `source .env`):
```bash
bunx wrangler secret put VAPID_PRIVATE_JWK          # paste the JSON value
gh variable set VAPID_PUBLIC_KEY                     # paste the VITE_VAPID_PUBLIC_KEY value
```
For a local deploy, `package.json` `deploy` becomes `vite build && wrangler deploy --var VAPID_PUBLIC_KEY:$VITE_VAPID_PUBLIC_KEY` (bun loads `.env` into scripts).

- [ ] **Step 5: Write the failing client test**

`src/__tests__/rest.test.ts`:
```ts
import { expect, test } from 'bun:test';
import { alertStatus } from '../lib/rest';

test('alert status covers tab, denied, granted and not yet asked', () => {
  expect(alertStatus({ hasPush: false, permission: 'default', subscribed: false })).toBe('unsupported');
  expect(alertStatus({ hasPush: true, permission: 'denied', subscribed: false })).toBe('blocked');
  expect(alertStatus({ hasPush: true, permission: 'granted', subscribed: true })).toBe('on');
  expect(alertStatus({ hasPush: true, permission: 'default', subscribed: false })).toBe('off');
});
```

- [ ] **Step 6: Write `src/lib/rest.ts`**

```ts
type Env = { hasPush: boolean; permission: NotificationPermission; subscribed: boolean };

const hasPush = () => typeof window !== 'undefined' && 'PushManager' in window && 'Notification' in window && 'serviceWorker' in navigator;

function keyBytes(b64: string): Uint8Array {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

let sub: Promise<PushSubscription | null> = Promise.resolve(null);
let subscribed = false;

/** Ask for notification permission and subscribe. iOS only shows the prompt inside a tap, so call this
 *  first thing in the tap handler, before any await. Safe to call on every tap. */
export function ensurePush(): void {
  if (!hasPush() || Notification.permission === 'denied') return;
  const perm = Notification.permission === 'granted' ? Promise.resolve('granted' as const) : Notification.requestPermission();
  sub = perm
    .then(async (p) => {
      if (p !== 'granted') return null;
      // ready never resolves without a registered SW (e.g. `bun run dev`), so give up after 4 s.
      const reg = await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('no service worker')), 4000))]);
      const s = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(import.meta.env.VITE_VAPID_PUBLIC_KEY) }));
      subscribed = true;
      return s;
    })
    .catch(() => null);
}

// One request at a time, in order, so a cancel can never overtake the schedule it is cancelling.
let chain: Promise<unknown> = Promise.resolve();
function post(method: 'POST' | 'DELETE', body: object): Promise<Response> {
  const p = chain.then(() =>
    fetch('/api/rest', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(4000) }),
  );
  chain = p.catch(() => {});
  return p;
}

/** Ask the server to push "Rest done" in `seconds`, replacing any pending one for this device.
 *  Returns the endpoint as the id, or null (no permission, offline, timed out). Never await this in the logging path. */
export async function scheduleRestDone(seconds: number): Promise<string | null> {
  if (seconds < 1) return null;
  const s = await sub;
  if (!s) return null;
  try {
    return (await post('POST', { endpoint: s.endpoint, seconds })).ok ? s.endpoint : null;
  } catch {
    return null;
  }
}

export async function cancelRestDone(id: string | null): Promise<void> {
  if (id) await post('DELETE', { endpoint: id }).catch(() => {});
}

export function alertStatus(env: Env = { hasPush: hasPush(), permission: hasPush() ? Notification.permission : 'default', subscribed }): 'on' | 'off' | 'blocked' | 'unsupported' {
  if (!env.hasPush) return 'unsupported';
  if (env.permission === 'denied') return 'blocked';
  return env.permission === 'granted' ? 'on' : 'off';
}
```
Run: `bun test`. Expected: PASS.

- [ ] **Step 7: Deploy and check push on the iPhone**

Temporarily add a button to the stub `App.tsx`:
```tsx
<button onClick={() => { ensurePush(); setTimeout(() => scheduleRestDone(15).then((id) => alert(id ? 'scheduled' : 'no push')), 0); }}>push in 15s</button>
```
Push, wait for the deploy, then reopen the installed app (close it from the app switcher so the new SW takes over). Tap the button, allow notifications, and switch to another app. Expected: a "Rest done" banner within about 15 to 20 s. Also check the Worker logs (`bunx wrangler tail`) for the push response status (201 from Apple). Remove the test button after.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "Rest push: Durable Object alarm sends a payload-less Web Push, endpoint allowlist, 10 minute cap, per-IP limit" && git push
```

---

### Task 7: App shell (theme, shims, router, alert, Dock)

**Files:**
- Create: `src/styles.css`, `src/lib/css.ts`, `src/lib/nav.ts`, `src/lib/alert.ts`, `src/lib/insets.ts`, `src/lib/press.ts`, `src/lib/theme.ts`, `src/components/Text.tsx`, `src/components/Dock.tsx`, `src/store/ui.ts`, `src/routes.tsx`, `src/__tests__/css.test.ts`, `src/__tests__/nav.test.ts`
- Modify: `src/App.tsx` (replace stub)

**Interfaces:**
- Produces:
  - `css(...styles: (Record<string, unknown> | false | null | undefined)[]): React.CSSProperties`
  - `router.{push, navigate, replace, back, dismissTo}(href)`, `useLocalSearchParams<T>(): T`, `usePathname(): string`, `useFocusEffect(cb)`, `Redirect({ href })`, `matchRoute(pattern, path): Record<string,string> | null`
  - `Alert.alert(title, message?, buttons?)`, `Alert.prompt(title, message, cb, type?, defaultValue?)`
  - `useSafeAreaInsets(): { top, bottom, left, right }`
  - `useLongPress(fn, ms = 450)` → pointer handler props
  - `useTheme(): Theme`, `useScheme()`, `useTopInset()`, `fonts`
  - `Doto`, `Label`, `Dock`, `DOCK_HEIGHT`
  - `useUi` store with the same shape as `OLD/src/store/ui.ts`

- [ ] **Step 1: Failing tests for `css()` and `matchRoute()`**

`src/__tests__/css.test.ts`:
```ts
import { expect, test } from 'bun:test';
import { css } from '../lib/css';

test('RN shorthands become CSS', () => {
  expect(css({ paddingVertical: 4, marginHorizontal: 8 }, false, null)).toEqual({ paddingTop: 4, paddingBottom: 4, marginLeft: 8, marginRight: 8 });
});
test('border widths get a solid style', () => {
  expect(css({ borderWidth: 1 })).toEqual({ borderWidth: 1, borderStyle: 'solid' });
  expect(css({ borderBottomWidth: 1 })).toEqual({ borderBottomWidth: 1, borderBottomStyle: 'solid' });
});
test('transform arrays and fontVariant arrays become strings', () => {
  expect(css({ transform: [{ translateY: 10 }, { scale: 1.02 }] })).toEqual({ transform: 'translateY(10px) scale(1.02)' });
  expect(css({ fontVariant: ['tabular-nums'] })).toEqual({ fontVariantNumeric: 'tabular-nums' });
});
test('later styles win', () => {
  expect(css({ opacity: 1 }, { opacity: 0.5 })).toEqual({ opacity: 0.5 });
});
```

`src/__tests__/nav.test.ts`:
```ts
import { expect, test } from 'bun:test';
import { matchRoute } from '../lib/nav';

test('static and param routes', () => {
  expect(matchRoute('/', '/')).toEqual({});
  expect(matchRoute('/exercise/:id', '/exercise/bench')).toEqual({ id: 'bench' });
  expect(matchRoute('/exercise/:id', '/exercise')).toBeNull();
  expect(matchRoute('/history', '/history/1')).toBeNull();
  expect(matchRoute('/history/:id', '/history/a%20b')).toEqual({ id: 'a b' });
});
```
Run: `bun test src/__tests__/css.test.ts src/__tests__/nav.test.ts`. Expected: FAIL (modules missing).

- [ ] **Step 2: `src/lib/css.ts`**

```ts
import type { CSSProperties } from 'react';

type RN = Record<string, unknown>;
const PAIRS: Record<string, [string, string]> = {
  paddingVertical: ['paddingTop', 'paddingBottom'],
  paddingHorizontal: ['paddingLeft', 'paddingRight'],
  marginVertical: ['marginTop', 'marginBottom'],
  marginHorizontal: ['marginLeft', 'marginRight'],
};
const px = (v: unknown) => (typeof v === 'number' ? `${v}px` : String(v));

/** Merge React Native style objects into one CSS style: RN shorthands, border widths (which need a style on web),
 *  transform and fontVariant arrays. Falsy entries are skipped, later ones win. */
export function css(...styles: (RN | false | null | undefined)[]): CSSProperties {
  const out: RN = {};
  for (const st of styles) {
    if (!st) continue;
    for (const [k, v] of Object.entries(st)) {
      if (PAIRS[k]) { out[PAIRS[k][0]] = v; out[PAIRS[k][1]] = v; }
      else if (k === 'borderWidth') { out.borderWidth = v; out.borderStyle = 'solid'; }
      else if (/^border(Top|Bottom|Left|Right)Width$/.test(k)) { out[k] = v; out[k.replace('Width', 'Style')] = 'solid'; }
      else if (k === 'transform' && Array.isArray(v)) {
        out.transform = v.map((t: RN) => Object.entries(t).map(([f, a]) => `${f}(${f.startsWith('translate') ? px(a) : a})`).join(' ')).join(' ');
      } else if (k === 'fontVariant' && Array.isArray(v)) out.fontVariantNumeric = v.join(' ');
      else out[k] = v;
    }
  }
  return out as CSSProperties;
}
```

- [ ] **Step 3: `src/lib/nav.ts`**

```ts
import { useEffect, useSyncExternalStore, type EffectCallback } from 'react';

// Every entry we push records its depth, so back() and dismissTo() know if there is anywhere to go.
type St = { d: number } | null;
const depth = () => (history.state as St)?.d ?? 0;
const emit = () => dispatchEvent(new Event('nav'));

function subscribe(cb: () => void) {
  addEventListener('popstate', cb);
  addEventListener('nav', cb);
  return () => { removeEventListener('popstate', cb); removeEventListener('nav', cb); };
}

export const router = {
  push(href: string) { history.pushState({ d: depth() + 1 }, '', href); emit(); },
  navigate(href: string) { if (location.pathname + location.search !== href) router.push(href); },
  replace(href: string) { history.replaceState({ d: depth() }, '', href); emit(); },
  back() { if (depth() > 0) history.back(); else router.replace('/'); },
  /** Pop to the first entry and show `href` there, then optionally push `then` on top. */
  dismissTo(href: string, then?: string) {
    const d = depth();
    const land = () => { history.replaceState({ d: 0 }, '', href); if (then) history.pushState({ d: 1 }, '', then); emit(); };
    if (d === 0) return land();
    addEventListener('popstate', land, { once: true });
    history.go(-d);
  },
};

export function usePathname(): string {
  return useSyncExternalStore(subscribe, () => location.pathname);
}

export function useSearch(): string {
  return useSyncExternalStore(subscribe, () => location.search);
}

export function matchRoute(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/').filter(Boolean), b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const out: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) out[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return out;
}

let routeParams: Record<string, string> = {};
/** Set by App for the matched route. */
export const setRouteParams = (p: Record<string, string>) => { routeParams = p; };

/** Path params plus query string, like expo-router's hook. */
export function useLocalSearchParams<T extends Record<string, string | undefined> = Record<string, string>>(): T {
  const search = useSearch();
  return { ...Object.fromEntries(new URLSearchParams(search)), ...routeParams } as T;
}

/** Screens remount on every navigation, so "focus" is mount. */
export function useFocusEffect(cb: EffectCallback): void {
  useEffect(cb, [cb]);
}

export function Redirect({ href }: { href: string }) {
  useEffect(() => router.replace(href), [href]);
  return null;
}
```

- [ ] **Step 4: `alert.ts`, `insets.ts`, `press.ts`**

`src/lib/alert.ts`:
```ts
type Button = { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };

/** React Native's Alert on a <dialog>. With no buttons it shows a single OK. */
function alert(title: string, message?: string, buttons: Button[] = [{ text: 'OK' }]): void {
  const d = document.createElement('dialog');
  d.className = 'alert';
  const h = document.createElement('h2'); h.textContent = title; d.append(h);
  if (message) { const p = document.createElement('p'); p.textContent = message; d.append(p); }
  for (const b of buttons) {
    const el = document.createElement('button');
    el.type = 'button';
    el.textContent = b.text;
    el.dataset.style = b.style ?? 'default';
    el.onclick = () => { d.close(); b.onPress?.(); };
    d.append(el);
  }
  d.addEventListener('close', () => d.remove());
  d.addEventListener('cancel', () => buttons.find((b) => b.style === 'cancel')?.onPress?.());
  document.body.append(d);
  d.showModal();
}

/** React Native's Alert.prompt, on the browser's own prompt. */
function prompt(title: string, message: string | undefined, cb: (v: string) => void, _type?: string, defaultValue = ''): void {
  const v = window.prompt(message ? `${title}\n${message}` : title, defaultValue);
  if (v !== null) cb(v);
}

export const Alert = { alert, prompt };
```

`src/lib/insets.ts`:
```ts
type Insets = { top: number; bottom: number; left: number; right: number };
let cached: Insets | null = null;

/** Read env(safe-area-inset-*) once through a hidden probe. The notch doesn't move in portrait. */
export function useSafeAreaInsets(): Insets {
  if (cached) return cached;
  const p = document.createElement('div');
  p.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.append(p);
  const s = getComputedStyle(p);
  cached = { top: parseFloat(s.paddingTop), right: parseFloat(s.paddingRight), bottom: parseFloat(s.paddingBottom), left: parseFloat(s.paddingLeft) };
  p.remove();
  return cached;
}
```

`src/lib/press.ts`:
```ts
import { useRef } from 'react';

/** Pointer props that call `fn` after holding `ms` without moving more than 8px. Suppresses the click that follows. */
export function useLongPress(fn?: () => void, ms = 450) {
  const timer = useRef<number>(0);
  const start = useRef({ x: 0, y: 0 });
  const fired = useRef(false);
  const clear = () => clearTimeout(timer.current);
  if (!fn) return {};
  return {
    onPointerDown: (e: React.PointerEvent) => {
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => { fired.current = true; fn(); }, ms);
    },
    onPointerMove: (e: React.PointerEvent) => { if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) clear(); },
    onPointerUp: clear,
    onPointerCancel: clear,
    onClickCapture: (e: React.MouseEvent) => { if (fired.current) { e.stopPropagation(); e.preventDefault(); } },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}
```

- [ ] **Step 5: Theme, styles, Text, ui store**

`src/lib/theme.ts`: copy `OLD/src/lib/theme.ts` and change:
- the imports, to `import { useSyncExternalStore } from 'react'; import { useUi } from '../store/ui'; import { useSafeAreaInsets } from './insets';`
- `useScheme`:
```ts
const mq = matchMedia('(prefers-color-scheme: light)');
const sub = (cb: () => void) => { mq.addEventListener('change', cb); return () => mq.removeEventListener('change', cb); };
export function useScheme(): 'light' | 'dark' {
  const systemLight = useSyncExternalStore(sub, () => mq.matches);
  const pref = useUi((s) => s.appearance);
  if (pref === 'system') return systemLight ? 'light' : 'dark';
  return pref;
}
```
- `fonts` values become the CSS family names `'Doto900'`, `'Doto700'`, `'Mono500'`, `'Mono600'`.
- `useTopInset` becomes `return useSafeAreaInsets().top;`.

`src/styles.css`:
```css
@font-face { font-family: Doto900; src: url(/fonts/DotoRound-900.ttf); font-display: block; }
@font-face { font-family: Doto700; src: url(/fonts/DotoRound-700.ttf); font-display: block; }
@font-face { font-family: Mono500; src: url(/fonts/JetBrainsMono_500Medium.ttf); font-display: block; }
@font-face { font-family: Mono600; src: url(/fonts/JetBrainsMono_600SemiBold.ttf); font-display: block; }

html, body, #root { margin: 0; height: 100%; overflow: hidden; overscroll-behavior: none; -webkit-text-size-adjust: 100%; }
body { background: var(--bg); color: var(--text); -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none; }
input, textarea { -webkit-user-select: text; user-select: text; font: inherit; color: inherit; background: none; border: none; outline: none; padding: 0; }
input::placeholder, textarea::placeholder { color: var(--dim); }

/* Behave like React Native views so ported styles work unchanged. */
#root div, #root button { display: flex; flex-direction: column; flex-shrink: 0; position: relative; box-sizing: border-box; min-width: 0; }
#root button { all: unset; display: flex; flex-direction: column; flex-shrink: 0; position: relative; box-sizing: border-box; cursor: pointer; touch-action: manipulation; }
#root button:disabled { cursor: default; }
#root span { white-space: pre-wrap; }

.scroll { flex: 1; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; }
.hscroll { flex-direction: row !important; overflow-x: auto; scrollbar-width: none; }
.hscroll::-webkit-scrollbar, .scroll::-webkit-scrollbar { display: none; }
.snap-x { overflow-x: auto; scroll-snap-type: x mandatory; flex-direction: row !important; scrollbar-width: none; }
.snap-x > * { scroll-snap-align: start; }
.snap-y { overflow-y: auto; scroll-snap-type: y mandatory; }
.snap-y > * { scroll-snap-align: start; }
.pr-fade:active { opacity: 0.7; }
.pr-scale { transition: transform 120ms ease-out; }
.pr-scale:active { transform: scale(0.97); }

dialog.alert { border: 1px solid var(--line); border-radius: 18px; background: var(--card); color: var(--text); padding: 20px; width: min(320px, 86vw); font-family: Mono500, monospace; }
dialog.alert::backdrop { background: rgba(0, 0, 0, 0.5); }
dialog.alert h2 { font-family: Doto900, monospace; font-size: 22px; margin: 0 0 8px; }
dialog.alert p { color: var(--mute); font-size: 13px; margin: 0 0 16px; white-space: pre-wrap; }
dialog.alert button { all: unset; display: block; width: 100%; padding: 12px 0; text-align: center; text-transform: uppercase; letter-spacing: 1px; font-size: 12px; border-top: 1px solid var(--line); cursor: pointer; }
dialog.alert button[data-style='destructive'] { color: var(--accent); }
dialog.alert button[data-style='cancel'] { color: var(--mute); }
```

`src/components/Text.tsx`:
```tsx
import type { CSSProperties, HTMLAttributes } from 'react';
import { fonts, useTheme } from '../lib/theme';
import { css } from '../lib/css';

type Props = Omit<HTMLAttributes<HTMLSpanElement>, 'style' | 'color'> & { color?: string; size?: number; style?: Record<string, unknown> | CSSProperties; numberOfLines?: number };

const clamp = (n?: number): CSSProperties => (n ? { display: '-webkit-box', WebkitLineClamp: n, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {});

/** Dot-matrix numerals and titles. */
export function Doto({ style, color, size = 26, numberOfLines, ...rest }: Props) {
  const t = useTheme();
  return <span {...rest} style={css({ fontFamily: fonts.doto, fontSize: size, lineHeight: 1.2, color: color ?? t.text, fontVariant: ['tabular-nums'] }, clamp(numberOfLines), style as never)} />;
}

/** Small uppercase mono label. */
export function Label({ style, color, size = 11, numberOfLines, ...rest }: Props) {
  const t = useTheme();
  return <span {...rest} style={css({ fontFamily: fonts.mono, fontSize: size, letterSpacing: size * 0.08, textTransform: 'uppercase', color: color ?? t.mute }, clamp(numberOfLines), style as never)} />;
}
```
Grep the old code for other `Text` props (`grep -rn "numberOfLines\|adjustsFontSizeToFit\|onPress=" OLD/src --include=*.tsx | grep -E "<(Doto|Label)"`). If a `Doto` or `Label` has `onPress`, wrap it in a `button` in the ported screen.

`src/store/ui.ts`: copy `OLD/src/store/ui.ts`, replace the import with `import { kv } from '../db/kv';`, then `Storage.getItemSync` → `kv.get` and `Storage.setItemSync` → `kv.set`.

- [ ] **Step 6: Dock**

Port `OLD/src/components/Dock.tsx` to `src/components/Dock.tsx`:
- Keep `ICONS`, `ALL_ITEMS`, `ITEM_W`, `PAD`, `DOCK_HEIGHT`, `selected`, `go`, `status`, `restLeft`, and the timer effect unchanged.
- Replace shared values with `const [x, setX] = useState(selected * ITEM_W)` and `const [drag, setDrag] = useState(false)`. `useEffect(() => setX(selected * ITEM_W), [selected])`.
- The highlight `div` style: `transform: translateX(${x}px) scale(${drag ? 1.08 : 1})`, `transition: drag ? 'none' : 'transform 320ms cubic-bezier(.2,.9,.3,1.15), background-color 200ms'`, `backgroundColor: logIdx >= 0 && Math.round(x / ITEM_W) === logIdx ? t.accent : glass`.
- Pan on the pill `div` with pointer events:
```tsx
const g = useRef<{ x0: number; start: number; t: number; lastX: number; moved: boolean } | null>(null);
const onPointerDown = (e: React.PointerEvent) => { g.current = { x0: e.clientX, start: x, t: e.timeStamp, lastX: e.clientX, moved: false }; };
const onPointerMove = (e: React.PointerEvent) => {
  const s = g.current; if (!s) return;
  const dx = e.clientX - s.x0;
  if (!s.moved && Math.abs(dx) < 6) return;
  if (!s.moved) { s.moved = true; setDrag(true); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }
  const raw = s.start + dx;
  setX(raw < 0 ? rubberband(raw, ITEM_W) : raw > maxX ? maxX + rubberband(raw - maxX, ITEM_W) : raw);
  s.lastX = e.clientX; s.t = e.timeStamp;
};
const onPointerUp = (e: React.PointerEvent) => {
  const s = g.current; g.current = null; if (!s?.moved) return;
  setDrag(false);
  const v = ((e.clientX - s.lastX) / Math.max(1, e.timeStamp - s.t)) * 1000;
  const i = Math.round(Math.min(maxX, Math.max(0, x + project(v))) / ITEM_W);
  setX(i * ITEM_W);
  go(i);
};
```
Keep `project` and `rubberband` as plain functions (drop `'worklet'`). Set `touch-action: none` on the pill.
- Hidden state: wrapper style `transform: translateY(${hidden ? 140 : 0}px)`, `opacity: hidden ? 0 : 1`, `transition: 'transform 300ms, opacity 300ms'`, `pointerEvents: hidden ? 'none' : 'auto'`, `position: 'fixed'`, `bottom: insets.bottom + 10`.
- `BlurView` → `div` with `backgroundColor: scheme === 'light' ? 'rgba(247,245,241,0.72)' : 'rgba(20,20,22,0.72)'`, `backdropFilter` and `WebkitBackdropFilter: 'blur(24px) saturate(1.6)'`.
- Drop `FadeIn`/`FadeOut`, haptics, and the `blurTarget` prop (App renders `<Dock />`).

- [ ] **Step 7: Routes and App**

`src/routes.tsx` (screens are added by Tasks 9 to 11; start with the ones that exist and a fallback):
```tsx
import type { ComponentType } from 'react';

/** Order matters: static segments before params. */
export const ROUTES: [string, ComponentType][] = [
  // ['/', Home], ['/welcome', Welcome], ['/settings', Settings], ['/session', Session], ['/workout', Workout], ['/rest', Rest],
  // ['/exercises', Exercises], ['/exercise/new', NewExercise], ['/exercise/:id', ExerciseDetail],
  // ['/history', History], ['/history/:id', HistoryDetail],
  // ['/routines', Routines], ['/routines/pick', Pick], ['/routines/:id', RoutineDetail],
];
```

`src/App.tsx`:
```tsx
import { useEffect, type ComponentType } from 'react';
import './styles.css';
import { ROUTES } from './routes';
import { matchRoute, setRouteParams, usePathname } from './lib/nav';
import { useScheme, useTheme } from './lib/theme';
import { Dock } from './components/Dock';

export function App() {
  const path = usePathname();
  const t = useTheme();
  const scheme = useScheme();
  useEffect(() => {
    for (const [k, v] of Object.entries(t)) document.documentElement.style.setProperty(`--${k}`, v);
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', t.bg);
    document.documentElement.style.colorScheme = scheme;
  }, [t, scheme]);
  let Screen: ComponentType | null = null;
  for (const [pattern, C] of ROUTES) {
    const p = matchRoute(pattern, path);
    if (p) { setRouteParams(p); Screen = C; break; }
  }
  return (
    <div style={{ height: '100dvh', background: t.bg }}>
      {Screen ? <Screen key={path + location.search} /> : <p style={{ color: t.mute, padding: 24 }}>Not found</p>}
      <Dock />
    </div>
  );
}
```

- [ ] **Step 8: Run tests, then check in the browser**

Run: `bun test && bun run check`. Expected: PASS.
Run `bun run dev` and check with the Playwright MCP browser at 390×844. Expected: an empty page with the Dock at the bottom, dark by default. Dragging the dock highlight snaps to an item and changes the URL. `Alert.alert('Test', 'Hi', [{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive'}])` from the console shows the dialog.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "App shell: RN-style shims so ported screens keep their code, tiny history router, dialog alerts, the Dock"
```

---

### Task 8: Components

**Files:**
- Port: `OLD/src/components/{Check,DotRing,DotTrend,DotBars,Heatmap,BodyMap,Numpad,SetRow,DragRow}.tsx` → `src/components/`
- Create: `src/components/Swipe.tsx`

**Interfaces:**
- Produces: the same exported names and props as the old files, except:
  - `useDragList()` returns `{ active: number; dy: number; set: (a: number, dy: number) => void }` (React state instead of shared values). `DragRow` takes `drag` of that type.
  - `Swipe({ onRemove, children })` replaces `ReanimatedSwipeable` in the workout screen.

- [ ] **Step 1: Mechanical ports**

Port `Check`, `DotRing`, `DotTrend`, `DotBars`, `Heatmap`, `BodyMap`, `Numpad`, `SetRow` with the RN → DOM rules. Special cases:
- `Heatmap`: horizontal `ScrollView` + `scrollToEnd` becomes `<div className="hscroll" ref={ref}>` with `useEffect(() => { ref.current!.scrollLeft = ref.current!.scrollWidth; }, [cells])`.
- `Numpad`: buttons use `className="pr-scale"` and fire on `onClick`. The global `touch-action: manipulation` removes the tap delay. Don't switch to `onPointerDown`: on iPhone a finger going down doesn't count as a user tap, so the notification prompt and audio unlock in the done key would silently fail.
- `SetRow`: `onLongPress` → `{...useLongPress(onLongPress)}` on the row `div`.

- [ ] **Step 2: DragRow with pointer events**

```tsx
import { useRef, useState, type ReactNode } from 'react';
import { Label } from './Text';

export const ROW_H = 64;
type Drag = { active: number; dy: number; set: (active: number, dy: number) => void };

/** Shared drag state for one list. */
export function useDragList(): Drag {
  const [st, setSt] = useState({ active: -1, dy: 0 });
  return { ...st, set: (active, dy) => setSt({ active, dy }) };
}

type Props = { index: number; count: number; drag: Drag; onDrop: (from: number, to: number) => void; onGrab: () => void; children: ReactNode };

/** Fixed-height row with a ≡ handle. Hold the handle briefly, drag, siblings slide aside. */
export function DragRow({ index, count, drag, onDrop, onGrab, children }: Props) {
  const clamp = (n: number) => Math.max(0, Math.min(count - 1, n));
  const { active, dy } = drag;
  let y = 0;
  if (active === index) y = dy;
  else if (active !== -1) {
    const target = clamp(active + Math.round(dy / ROW_H));
    y = active < index && index <= target ? -ROW_H : target <= index && index < active ? ROW_H : 0;
  }
  const mine = active === index;
  const hold = useRef(0);
  const y0 = useRef(0);
  return (
    <div style={{ transform: `translateY(${y}px) scale(${mine ? 1.02 : 1})`, zIndex: mine ? 10 : 0, transition: mine ? 'none' : 'transform 220ms cubic-bezier(.2,.9,.3,1)' }}>
      {children}
      <div
        style={{ position: 'absolute', right: 0, top: 0, width: 44, height: ROW_H, alignItems: 'center', justifyContent: 'center', touchAction: 'none' }}
        onPointerDown={(e) => {
          const el = e.currentTarget; const id = e.pointerId; y0.current = e.clientY;
          hold.current = window.setTimeout(() => { el.setPointerCapture(id); drag.set(index, 0); onGrab(); }, 150);
        }}
        onPointerMove={(e) => { if (drag.active === index) drag.set(index, e.clientY - y0.current); }}
        onPointerUp={() => {
          clearTimeout(hold.current);
          if (drag.active !== index) return;
          const to = clamp(index + Math.round(drag.dy / ROW_H));
          drag.set(-1, 0);
          onDrop(index, to);
        }}
        onPointerCancel={() => { clearTimeout(hold.current); drag.set(-1, 0); }}
      >
        <Label size={16}>≡</Label>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Swipe to remove**

`src/components/Swipe.tsx`:
```tsx
import { useRef, useState, type ReactNode } from 'react';
import { useTheme } from '../lib/theme';
import { Label } from './Text';

const OPEN = 64;

/** Drag the row left past 64px and let go to remove it. A vertical move hands control back to the scroll. */
export function Swipe({ onRemove, children }: { onRemove: () => void; children: ReactNode }) {
  const t = useTheme();
  const [x, setX] = useState(0);
  const g = useRef<{ x0: number; y0: number; on: boolean | null } | null>(null);
  return (
    <div style={{ overflow: 'hidden' }}>
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 96, alignItems: 'center', justifyContent: 'center' }}>
        <Label color={t.accent}>Remove</Label>
      </div>
      <div
        style={{ transform: `translateX(${x}px)`, transition: g.current?.on ? 'none' : 'transform 200ms', touchAction: 'pan-y' }}
        onPointerDown={(e) => { g.current = { x0: e.clientX, y0: e.clientY, on: null }; }}
        onPointerMove={(e) => {
          const s = g.current; if (!s) return;
          const dx = e.clientX - s.x0, dy = e.clientY - s.y0;
          if (s.on === null && Math.hypot(dx, dy) > 8) s.on = Math.abs(dx) > Math.abs(dy) && dx < 0;
          if (s.on) setX(Math.min(0, dx / 2));
        }}
        onPointerUp={() => { const s = g.current; g.current = null; if (s?.on && x < -OPEN / 2) onRemove(); setX(0); }}
        onPointerCancel={() => { g.current = null; setX(0); }}
      >
        {children}
      </div>
    </div>
  );
}
```
(`friction={2}` becomes `dx / 2`, and the old `rightThreshold={64}` of travel is `x < -32` after friction.)

- [ ] **Step 4: Check**

Run: `bun run check`. Expected: no type errors.
Temporarily render each component with sample props on the stub route `/` and screenshot it with the Playwright MCP browser next to `OLD/docs/design/*.png`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Components: dot-matrix readouts, numpad, set rows, drag to reorder and swipe to remove on pointer events"
```

---

### Task 9: Screens: Home, Welcome, Settings

**Files:**
- Port: `OLD/src/app/{index,welcome,settings}.tsx` → `src/screens/{Home,Welcome,Settings}.tsx`
- Modify: `src/routes.tsx`

**Interfaces:**
- Consumes: shims (Task 7), components (Task 8), `backup.ts` (Task 3), `alertStatus` (Task 6).
- Note: `index.tsx` exports `sessionMeta`, which `history/index.tsx` imports. Keep that export in `Home.tsx`.

- [ ] **Step 1: Port the three screens** with the RN → DOM rules. Specifics:
- Home carousel (`OLD/src/app/index.tsx:143`): `className="snap-x"`, each panel `width: panelW + 32`, and page from a debounced `onScroll`:
```tsx
const tmr = useRef(0);
onScroll={(e) => { const el = e.currentTarget; clearTimeout(tmr.current); tmr.current = window.setTimeout(() => setPage(Math.round(el.scrollLeft / (panelW + 32))), 120); }}
```
- Welcome and Settings restore flow: `pickBackup()` now rejects on a bad file. Keep the old `try/catch` and `Alert.alert('Not an Ethos backup', String(e))`.
- Settings: add a row under Backup titled "REST ALERTS" whose subtitle comes from `alertStatus()`: `on` → "On. A banner shows when rest ends in another app.", `off` → "Asked the first time you rest.", `blocked` → "Blocked. Allow in iOS Settings → Notifications → Ethos.", `unsupported` → "Add Ethos to the Home Screen to get alerts in other apps." It's not tappable.
- Settings export: build the file ahead of time so the tap shares with no await before it. `const [file, setFile] = useState<File | null>(null); useEffect(() => { backupFile().then(setFile); }, []);` Export's press handler is `file ? shareFile(file) : exportBackup()`, and call `backupFile().then(setFile)` again after a restore.
- Settings: drop any row that only existed for sound choice or native-only features. Compare with `OLD/src/app/settings.tsx` and keep everything else.
- [ ] **Step 2: Register the routes** `['/', Home]`, `['/welcome', Welcome]`, `['/settings', Settings]`.
- [ ] **Step 3: Check in the browser** (Playwright MCP, 390×844). On a fresh profile, Home redirects to Welcome. Restore `src/__tests__/fixtures/backup.json` through Welcome, and Home then shows the volume, days and body-map panels with that session counted. Screenshot both themes (Settings → appearance) and compare with `OLD/docs/design/Home.png`. Export from Settings and expect a file download (desktop fallback).
- [ ] **Step 4: Check backup on the iPhone** (installed app, user runs it; Playwright can't cover the share sheet or the Files app). Settings → Export opens the share sheet → Save to Files. Then Settings → Restore, pick the user's real native backup from Files (AirDropped from the old app), and expect the summary dialog, then the history appears. If Export throws or nothing opens, report the error text. Don't fall back to a download in standalone mode.
- [ ] **Step 5: Commit** `git commit -am "Home, Welcome and Settings screens, with rest alert status"` (add new files first).

---

### Task 10: Screens: routines and exercises

**Files:**
- Port: `OLD/src/app/routines/{index,[id],pick}.tsx` → `src/screens/{Routines,RoutineDetail,Pick}.tsx`; `OLD/src/app/exercises/index.tsx` → `src/screens/Exercises.tsx`; `OLD/src/app/exercise/{[id],new}.tsx` → `src/screens/{ExerciseDetail,NewExercise}.tsx`
- Modify: `src/routes.tsx`

- [ ] **Step 1: Port** with the RN → DOM rules. Specifics:
- `ExerciseDetail`: delete the `MEDIA` import and the GIF `Image` block (`OLD/src/app/exercise/[id].tsx:126`). The step text list stays.
- `RoutineDetail` and `Routines`: `useDragList`/`DragRow` now use React state (Task 8). Call sites keep `drag={drag}`.
- `Pick`: it reads `session`, `routine`, `replace`, `log` from `useLocalSearchParams()`. Keep that.
- `Exercises`: horizontal chip row → `className="hscroll"`.
- [ ] **Step 2: Register the routes** in this order: `['/exercises', Exercises]`, `['/exercise/new', NewExercise]`, `['/exercise/:id', ExerciseDetail]`, `['/routines', Routines]`, `['/routines/pick', Pick]`, `['/routines/:id', RoutineDetail]`.
- [ ] **Step 3: Check in the browser.** Create a routine, add three exercises from the library search, and drag the third to the top. Reload, and the order persists. Open an exercise and confirm steps show with no image. Create a custom exercise and duplicate it as a variant. It then nests under its movement in Moves.
- [ ] **Step 4: Commit** `"Routines, exercise picker, Moves and exercise screens"`.

---

### Task 11: Screens: session, workout, rest, history

**Files:**
- Port: `OLD/src/app/{session,workout,rest}.tsx` → `src/screens/{Session,Workout,Rest}.tsx`; `OLD/src/app/history/{index,[id]}.tsx` → `src/screens/{History,HistoryDetail}.tsx`
- Port: `OLD/src/store/workout.ts` → `src/store/workout.ts`
- Create: `src/__tests__/workoutRest.test.ts`
- Modify: `src/routes.tsx`

**Interfaces:**
- Consumes: `ensurePush`, `scheduleRestDone(seconds)`, `cancelRestDone(id)` (Task 6).

- [ ] **Step 1: Failing test: logging never waits on the network**

`src/__tests__/workoutRest.test.ts`:
```ts
import { beforeAll, expect, mock, test } from 'bun:test';
import { bunDb } from '../db/bun';
import { initDb } from '../db';
import { loadKv } from '../db/kv';

const real = await import('../lib/rest');
const never = () => new Promise<never>(() => {});
mock.module('../lib/rest', () => ({ ...real, scheduleRestDone: never, cancelRestDone: never }));

beforeAll(async () => { await initDb(bunDb()); await loadKv(); });

test('a set is done and rest starts even when the push server never answers', async () => {
  const { useWorkout } = await import('../store/workout');
  const { listRoutines } = await import('../db/queries');
  const w = useWorkout.getState();
  await w.preview((await listRoutines())[0]);
  await useWorkout.getState().begin();
  for (const [f, v] of [['weight', '60'], ['reps', '8']] as const) { useWorkout.getState().setFocus(0, f); useWorkout.getState().input(v); }
  await useWorkout.getState().completeSet();
  expect(useWorkout.getState().blocks[0].sets[0].done).toBe(true);
  expect(useWorkout.getState().rest?.endsAt).toBeGreaterThan(Date.now());
  await useWorkout.getState().adjustRest(30);
  await useWorkout.getState().skipRest();
  expect(useWorkout.getState().rest).toBeNull();
});
```
Run: `bun test src/__tests__/workoutRest.test.ts`. Expected: FAIL (the store module isn't there yet, and once copied as-is, the test times out).

- [ ] **Step 2: Port the workout store.** Copy it, import `ensurePush, scheduleRestDone, cancelRestDone` from `../lib/rest`, then change the rest handling so nothing in the logging path awaits the network:
```ts
  async completeSet() {
    ensurePush(); // first, before any await: iOS only shows the permission prompt inside the tap
    const { blocks, exIdx, focus, sessionId } = get();
    // ...unchanged: validate, insertSet(...), compute sets and nextIdx...
    const total = b.exercise.default_rest_seconds;
    const endsAt = Date.now() + total * 1000;
    set({
      blocks: blocks.map((x, i) => (i === exIdx ? { ...x, sets } : x)),
      focus: { setIdx: nextIdx === -1 ? focus.setIdx : nextIdx, field: nextIdx === -1 ? focus.field : 'reps' },
      rest: { endsAt, total, notifId: null },
    });
    // A new schedule replaces the device's pending alarm on the server, so no cancel first.
    void scheduleRestDone(total).then((notifId) => attachNotif(endsAt, notifId));
  },

  async adjustRest(delta) {
    const { rest } = get();
    if (!rest) return;
    const endsAt = Math.max(Date.now(), rest.endsAt + delta * 1000);
    const secs = Math.round((endsAt - Date.now()) / 1000);
    set({ rest: { ...rest, endsAt, total: Math.max(rest.total + delta, secs) } });
    if (secs < 1) void cancelRestDone(rest.notifId);
    else void scheduleRestDone(secs).then((notifId) => attachNotif(endsAt, notifId));
  },
```
with, above the store:
```ts
/** Store the push id once the server answers, unless the rest it belongs to has already changed. */
function attachNotif(endsAt: number, notifId: string | null): void {
  const r = useWorkout.getState().rest;
  if (r && r.endsAt === endsAt) useWorkout.setState({ rest: { ...r, notifId } });
}
```
In `skipRest`, `cancel` and `finish`, change `await cancelRestDone(...)` to `void cancelRestDone(...)`.
Persistence and the `seq` change come in Task 12. Leave them alone here.
Run: `bun test`. Expected: PASS.
- [ ] **Step 3: Port the screens.** Specifics:
- `Workout`: `Swipeable` → `<Swipe key={set.id} onRemove={() => removeSet(i)}>`. The vertical exercise pager (`OLD/src/app/workout.tsx:197-215`) becomes `className="snap-y"` with each page `height: pageH`, and the `onMomentumScrollEnd` logic moves into a debounced `onScroll` (same pattern as Task 9) using `el.scrollTop / pageH`. `Alert.prompt` for notes keeps its call.
- `Workout` finish: `router.dismissTo('/'); router.push(\`/history/${id}?done=1\`)` becomes `router.dismissTo('/', \`/history/${id}?done=1\`)`. Cancel becomes `router.dismissTo('/')`.
- `Rest`: delete the `left <= 0` effect that called `doneHaptic(); restDone(); router.back();` and replace it with `useEffect(() => { if (!rest) router.back(); }, [rest]);`. Task 12 moves ringing and `restDone` to the app level so they fire on any screen.
- `HistoryDetail`: delete the photos strip, `pickPhoto`, and the `photos` import. Import `setSessionNotes` from `../db/queries`. Keep the review-and-add flow (`?done=1`, `/routines/pick?log=`).
- [ ] **Step 4: Register the routes** `['/session', Session]`, `['/workout', Workout]`, `['/rest', Rest]`, `['/history', History]`, `['/history/:id', HistoryDetail]`.
- [ ] **Step 5: Check in the browser.** Start a routine, log three sets with the numpad (kg → reps → RIR), swipe one away, swipe up to the next exercise, finish, land on the review screen, add a set there, then open History and edit a set. Compare Workout against `OLD/docs/design/Main.png`.
- [ ] **Step 6: Commit** `"Workout flow: session preview, logging, rest screen, history and review"`.

---

### Task 12: Rest bell, wake lock, workout survives reload

**Files:**
- Create: `src/lib/bell.ts`, `src/lib/restClock.ts`, `src/lib/wakeLock.ts`, `src/lib/restAlarm.ts`, `src/__tests__/restClock.test.ts`, `src/__tests__/workoutPersist.test.ts`
- Modify: `src/store/workout.ts`, `src/App.tsx`

**Interfaces:**
- Produces: `restOutcome(endsAt: number, now: number): 'wait' | 'ring' | 'silent'`, `ringBell(times?: number)`, `unlockAudio()`, `useWakeLock(on: boolean)`, `useRestAlarm()`.

- [ ] **Step 1: Failing tests**

`src/__tests__/restClock.test.ts`:
```ts
import { expect, test } from 'bun:test';
import { restOutcome, LATE_MS } from '../lib/restClock';

test('rings on time, stays quiet when very late (page was asleep or reloaded long after)', () => {
  expect(restOutcome(10_000, 9_000)).toBe('wait');
  expect(restOutcome(10_000, 10_000)).toBe('ring');
  expect(restOutcome(10_000, 10_000 + LATE_MS)).toBe('ring');
  expect(restOutcome(10_000, 10_001 + LATE_MS)).toBe('silent');
});
```

`src/__tests__/workoutPersist.test.ts`:
```ts
import { beforeAll, expect, test } from 'bun:test';
import { bunDb } from '../db/bun';
import { initDb, getDb } from '../db';
import { kv, loadKv } from '../db/kv';

beforeAll(async () => { await initDb(bunDb()); await loadKv(); });

test('in-progress workout is written to kv and new drafts never reuse old ids', async () => {
  const { useWorkout } = await import('../store/workout');
  const { listRoutines } = await import('../db/queries');
  const [r] = await listRoutines();
  await useWorkout.getState().preview(r);
  await useWorkout.getState().begin();
  useWorkout.getState().setFocus(0, 'reps');
  useWorkout.getState().input('8');
  const saved = JSON.parse(kv.get('workout')!).state;
  expect(saved.sessionId).toBe(useWorkout.getState().sessionId);
  expect(saved.blocks[0].sets[0].reps).toBe('8');
  const ids = new Set(saved.blocks.flatMap((b: any) => b.sets.map((s: any) => s.id)));
  useWorkout.getState().addSet();
  const added = useWorkout.getState().blocks[0].sets.at(-1)!.id;
  expect(ids.has(added)).toBe(false);
});
```
Run: `bun test src/__tests__/restClock.test.ts src/__tests__/workoutPersist.test.ts`. Expected: FAIL.

- [ ] **Step 2: `restClock.ts`**

```ts
/** How late the bell may still ring. Past this the phone was asleep or the app reloaded long after, and a bell would confuse. */
export const LATE_MS = 5000;

export function restOutcome(endsAt: number, now: number): 'wait' | 'ring' | 'silent' {
  if (now < endsAt) return 'wait';
  return now - endsAt <= LATE_MS ? 'ring' : 'silent';
}
```

- [ ] **Step 3: Persist the workout store**

In `src/store/workout.ts`:
- `let seq = 0;` → `let seq = Date.now();` (drafts restored after a reload keep their ids, and new ones start above them).
- Wrap the store:
```ts
import { persist, createJSONStorage } from 'zustand/middleware';
import { kv } from '../db/kv';

export const useWorkout = create<State>()(
  persist(
    (set, get) => ({ /* unchanged body */ }),
    {
      name: 'workout',
      storage: createJSONStorage(() => ({ getItem: kv.get, setItem: kv.set, removeItem: kv.del })),
      partialize: (s) => ({ sessionId: s.sessionId, routine: s.routine, title: s.title, startedAt: s.startedAt, blocks: s.blocks, exIdx: s.exIdx, focus: s.focus, rest: s.rest }),
    },
  ),
);
```
Run: `bun test`. Expected: PASS.

- [ ] **Step 4: Bell**

`src/lib/bell.ts`:
```ts
let ctx: AudioContext | null = null;

/** iOS only lets audio start inside a completed tap. Call on every click; cheap after the first. */
export function unlockAudio(): void {
  ctx ??= new AudioContext();
  if (ctx.state !== 'running') void ctx.resume();
}

// Boxing bell: a bright fundamental plus inharmonic partials, each fading at its own rate.
const PARTIALS: [ratio: number, gain: number, decay: number][] = [
  [1, 1, 1.8], [2.32, 0.55, 1.2], [4.25, 0.3, 0.8], [6.63, 0.18, 0.5], [9.1, 0.08, 0.3],
];
const F0 = 830;

function strike(at: number): void {
  for (const [ratio, gain, decay] of PARTIALS) {
    const o = ctx!.createOscillator();
    const g = ctx!.createGain();
    o.frequency.value = F0 * ratio;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain * 0.35, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    o.connect(g).connect(ctx!.destination);
    o.start(at);
    o.stop(at + decay);
  }
}

/** Ding-ding-ding, end of round. */
export function ringBell(times = 3): void {
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.03;
  for (let i = 0; i < times; i++) strike(t0 + i * 0.32);
}
```

- [ ] **Step 5: Wake lock and the app-level rest alarm**

`src/lib/wakeLock.ts`:
```ts
import { useEffect } from 'react';

/** Keep the screen on while `on`. iOS drops the lock when the app is hidden, so take it again on return. */
export function useWakeLock(on: boolean): void {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const take = () => { if (document.visibilityState === 'visible') navigator.wakeLock.request('screen').then((l) => { lock = l; }, () => {}); };
    take();
    document.addEventListener('visibilitychange', take);
    return () => { document.removeEventListener('visibilitychange', take); void lock?.release(); };
  }, [on]);
}
```

`src/lib/restAlarm.ts`:
```ts
import { useEffect } from 'react';
import { useWorkout } from '../store/workout';
import { restOutcome } from './restClock';
import { ringBell } from './bell';

/** Rings the bell when rest ends, on whatever screen is up, then clears the rest. Survives reloads because `rest.endsAt` is persisted. */
export function useRestAlarm(): void {
  const endsAt = useWorkout((s) => s.rest?.endsAt ?? null);
  useEffect(() => {
    if (endsAt === null) return;
    const fire = () => {
      if (restOutcome(endsAt, Date.now()) === 'ring') ringBell(3);
      useWorkout.getState().restDone();
    };
    const ms = endsAt - Date.now();
    if (ms <= 0) { fire(); return; }
    const id = setTimeout(fire, ms);
    return () => clearTimeout(id);
  }, [endsAt]);
}
```

In `src/App.tsx`:
```tsx
// iOS may relaunch an evicted home-screen app at start_url, so send an unfinished workout back to its screen.
useEffect(() => { if (useWorkout.getState().sessionId && location.pathname === '/') router.replace('/workout'); }, []);
const active = useWorkout((s) => s.sessionId !== null);
useWakeLock(active);
useRestAlarm();
useEffect(() => {
  // click, not pointerdown: on iPhone only a finished tap counts as a user gesture for audio.
  addEventListener('click', unlockAudio, { capture: true });
  return () => removeEventListener('click', unlockAudio, { capture: true });
}, []);
```

- [ ] **Step 6: Check in the browser, then on the iPhone**

Browser: start a workout, set an exercise's rest to 10 s, log a set, and hear ding-ding-ding at 0 on the Workout screen. Log a set, reload during rest, and expect the same exercise, set focus and countdown. It rings once at 0. Log a set, reload 20 s after rest ended, and expect no bell.
iPhone (installed, user runs it):
1. The bell rings with the app open.
2. The screen doesn't dim during a session.
3. Log a set and switch to Spotify: the "Rest done" banner arrives.
4. Mid-workout, close Ethos from the app switcher and open it again: it lands on the Workout screen at the same set.
5. Flip the silent switch on and log a set. Note whether the bell still rings. If it doesn't, tell the user in one line (iOS mutes web audio on silent) and don't work around it.
6. In plain Safari (not installed), log a set: no crash, the bell rings, and Settings says "Add Ethos to the Home Screen".
- [ ] **Step 7: Commit** `"Rest bell rings on any screen, screen stays awake during a session, the workout survives a reload"`.

---

### Task 13: Playwright WebKit backup test

**Files:**
- Create: `playwright.config.ts`, `e2e/backup.spec.ts`
- Modify: `package.json` (`"e2e": "playwright test"`)

- [ ] **Step 1: Install**

```bash
bun add -d @playwright/test && bunx playwright install webkit
```

- [ ] **Step 2: Config and test**

`playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:4173', ...devices['iPhone 15'] },
  projects: [{ name: 'webkit', use: { browserName: 'webkit' } }],
  webServer: { command: 'bun run build && bunx vite preview --port 4173', port: 4173, reuseExistingServer: true },
});
```

`e2e/backup.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import { readFileSync } from 'fs';

const FIXTURE = process.env.ETHOS_BACKUP ?? 'src/__tests__/fixtures/backup.json';

test('importing a backup and exporting it again gives back the same data', async ({ page }) => {
  await page.goto('/welcome');
  const chooser = page.waitForEvent('filechooser');
  await page.getByText('Restore from a backup file').click();
  await (await chooser).setFiles(FIXTURE);
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  // Tap the Dock instead of page.goto: a full reload would race the old page for the storage lock.
  await page.locator('button', { hasText: /^Settings$/ }).click();
  const download = page.waitForEvent('download');
  await page.getByText('EXPORT').click();
  const out = JSON.parse(readFileSync(await (await download).path(), 'utf8'));
  const inp = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  delete out.exported_at; delete inp.exported_at;
  expect(out).toEqual(inp);
});
```
Headless WebKit has no share sheet, so `navigator.canShare` is false and export falls back to a download.

- [ ] **Step 3: Run it**

Run: `bun run e2e`. Expected: PASS. Then ask the user for a real export from the native app (Settings → Export on the phone, AirDrop to the laptop) and run `ETHOS_BACKUP=/path/to/it.json bun run e2e`. Expected: PASS. Don't commit the real backup.

- [ ] **Step 4: Commit** `"Playwright WebKit check that a backup survives import and export unchanged"`.

---

### Task 14: README and the handover

**Files:**
- Modify: `README.md`

- [ ] **Step 1:** Write `README.md` in the tone of `OLD/README.md`: what it is, the features minus GIFs/photos/haptics, how to install on iPhone (Safari → Share → Add to Home Screen), the rest alert limits from the spec in plain words, how to move data from the native app (export there, restore here), and how to run it (`bun install`, `bun run dev`, `bun test`, `bun run e2e`, `.env` with the VAPID keys via `bun scripts/vapid-keys.ts`).
- [ ] **Step 2:** Final checks: `bun run check && bun run test && bun run e2e`. All green.
- [ ] **Step 3:** Commit and push: `"README: install, data move from the native app, rest alert limits, dev setup"`. The Deploy action goes green.
- [ ] **Step 4: USER CHECKPOINT.** The user restores their real backup on the installed app and uses it for a gym session. The old `Ethos` repo is left as is.
