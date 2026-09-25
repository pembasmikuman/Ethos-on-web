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
