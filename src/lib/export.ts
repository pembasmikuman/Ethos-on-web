import { allSessions, exportSets, type ExportSet, type SessionRow } from '../db/queries';
import { fmtClock, fmtKg } from './format';

const cell = (v: string) => v.replace(/\|/g, '/').replace(/\n/g, ' ');
/** Local weekday and date, both from local time so a late session keeps its own day. */
const day = (iso: string) => { const d = new Date(iso); return `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${d.toLocaleDateString('en-CA')}`; };

/** Sessions as Markdown an LLM can read: a key for the units first, then per session, per exercise, a table of sets.
 *  Pure, so it is tested without a DB. `sessions` newest first, `sets` in logged order. */
export function sessionsMarkdown(sessions: SessionRow[], sets: ExportSet[], exportedAt = new Date()): string {
  const out = [
    '# Ethos training log',
    `Exported ${exportedAt.toISOString().slice(0, 10)} · ${sessions.length} session${sessions.length === 1 ? '' : 's'}`,
    '',
    'Key: weights in kg. RIR = reps in reserve, how many more reps were left (0 = failure, blank = not logged).',
    'Rest = time since the previous set in the session was logged, so it includes doing this set. W = warmup set.',
    'Bodyweight moves: kg is load added to bodyweight. Timed moves: Reps is seconds held.',
  ];
  for (const ss of [...sessions].reverse()) {
    const mine = sets.filter((x) => x.session_id === ss.id);
    const mins = ss.end_time ? Math.round((Date.parse(ss.end_time) - Date.parse(ss.start_time)) / 60000) : null;
    out.push('', `## ${day(ss.start_time)} · ${ss.title}`, `${mins != null ? `${mins} min · ` : ''}${ss.sets} working set${ss.sets === 1 ? '' : 's'} · ${fmtKg(Math.round(ss.volume_kg))} kg volume`);
    if (ss.notes?.trim()) out.push(`Session note: ${ss.notes.trim().replace(/\n/g, ' ')}`);
    // Exercises in the order first done; rest is measured against the session's previous set, whatever the exercise.
    const restOf = new Map(mine.map((x, i) => [x.id, i === 0 ? '' : fmtClock((Date.parse(x.completed_at) - Date.parse(mine[i - 1].completed_at)) / 1000)]));
    for (const name of [...new Set(mine.map((x) => x.exercise))]) {
      const rows = mine.filter((x) => x.exercise === name);
      const e = rows[0];
      const extra = e.secondary_muscles.split(',').map((m) => m.trim()).filter(Boolean);
      const kind = e.load === 'bodyweight' ? ' · bodyweight' : e.load === 'time' ? ' · timed' : '';
      out.push(
        '',
        `### ${name}`,
        `${e.primary_muscle}${extra.length ? ` (+ ${extra.join(', ')})` : ''}${kind}${e.per_side ? ' · reps count both sides' : ''}`,
        `Plan: ${e.target_rep_min}-${e.target_rep_max} ${e.load === 'time' ? 'sec' : 'reps'} · rest ${e.default_rest_seconds}s · +${fmtKg(e.increment_kg)} kg jumps · ${e.progression ?? 'double'} progression`,
      );
      if (e.exercise_notes?.trim()) out.push(`Exercise note: ${cell(e.exercise_notes.trim())}`);
      out.push('', `| Set | kg | ${e.load === 'time' ? 'Sec' : 'Reps'} | RIR | Rest | Note |`, '|---|---|---|---|---|---|');
      for (const x of rows) {
        out.push(`| ${x.set_type === 'warmup' ? 'W' : x.set_number} | ${fmtKg(x.weight)} | ${x.reps} | ${x.rir ?? ''} | ${restOf.get(x.id)} | ${cell(x.notes ?? '')} |`);
      }
    }
  }
  return out.join('\n') + '\n';
}

/** The picked sessions as a ready-to-share .md file. Built ahead of the tap, like the backup, so share() still works on iOS. */
export async function exportFile(sessionIds: string[]): Promise<File> {
  const picked = new Set(sessionIds);
  const [sessions, sets] = await Promise.all([allSessions().then((r) => r.filter((x) => picked.has(x.id))), exportSets(sessionIds)]);
  const now = new Date();
  const text = sessionsMarkdown(sessions, sets, now);
  return new File([text], `ethos_sessions_${now.toISOString().slice(0, 10)}.md`, { type: 'text/markdown' });
}
