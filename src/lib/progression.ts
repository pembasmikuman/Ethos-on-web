export type SetLike = { weight: number; reps: number; rir: number | null; set_type?: string };
export type ExerciseLike = {
  target_rep_min: number;
  target_rep_max: number;
  increment_kg: number;
  primary_muscle: string;
  secondary_muscles: string;
  /** Rule that picks next weight. Default double progression. */
  progression?: 'double' | 'linear' | 'greyskull';
  /** bodyweight: progress reps, not load. time: reps are seconds. */
  load?: 'weight' | 'bodyweight' | 'time';
};

const working = <T extends SetLike>(sets: T[]): T[] => sets.filter((s) => (s.set_type ?? 'working') === 'working');

/** Double progression: every working set hit the rep ceiling with at least 1 RIR. */
export function readyToOverload(lastSets: SetLike[], ex: ExerciseLike): boolean {
  const w = working(lastSets);
  return w.length > 0 && w.every((s) => s.reps >= ex.target_rep_max && (s.rir ?? 0) >= 1);
}

/**
 * Stall: the last `n` sessions all used the same top weight and none hit
 * `target_rep_min` on every set. Sessions ordered newest first.
 */
export function stalled(sessions: SetLike[][], ex: ExerciseLike, n = 3): boolean {
  const recent = sessions.slice(0, n).map(working).filter((s) => s.length > 0);
  if (recent.length < n) return false;
  const top = Math.max(...recent[0].map((s) => s.weight));
  return recent.every((sets) => Math.max(...sets.map((s) => s.weight)) === top && sets.some((s) => s.reps < ex.target_rep_min));
}

export type Next = { weight: number; overload: boolean; deload: boolean; /** Why this number, one line. */ why: string };

/**
 * Weight to prefill next session, by the exercise's rule.
 * double:    all sets at rep max with RIR >= 1 -> + increment.
 * linear:    all sets at rep min -> + increment; any set under min -> same.
 * greyskull: last set is AMRAP. >= 2x rep min -> + 2 increments; all sets at min -> + increment;
 *            any set under min -> -10 %.
 * bodyweight load: weight stays (added load only), overload flag means "add a rep".
 */
export function nextWeight(lastSets: SetLike[], ex: ExerciseLike): Next | null {
  const w = working(lastSets);
  if (w.length === 0) return null;
  const last = w[0].weight;
  const inc = ex.increment_kg;
  const allMin = w.every((s) => s.reps >= ex.target_rep_min);
  if (ex.load === 'bodyweight') {
    const up = readyToOverload(lastSets, ex);
    return { weight: last, overload: up, deload: false, why: up ? `all sets at ${ex.target_rep_max}, add a rep` : `same load, chase ${ex.target_rep_max} reps` };
  }
  switch (ex.progression ?? 'double') {
    case 'linear':
      return allMin
        ? { weight: last + inc, overload: true, deload: false, why: `all sets at ${ex.target_rep_min}+, +${inc} kg` }
        : { weight: last, overload: false, deload: false, why: `missed ${ex.target_rep_min}, same weight` };
    case 'greyskull': {
      const amrap = w[w.length - 1].reps;
      if (amrap >= ex.target_rep_min * 2) return { weight: last + inc * 2, overload: true, deload: false, why: `AMRAP ${amrap}, double jump +${inc * 2} kg` };
      if (allMin) return { weight: last + inc, overload: true, deload: false, why: `all sets at ${ex.target_rep_min}+, +${inc} kg` };
      return { weight: roundTo(last * 0.9), overload: false, deload: true, why: `missed ${ex.target_rep_min}, reset -10 %` };
    }
    default:
      return readyToOverload(lastSets, ex)
        ? { weight: last + inc, overload: true, deload: false, why: `all sets at ${ex.target_rep_max} with RIR, +${inc} kg` }
        : { weight: last, overload: false, deload: false, why: `same weight, chase ${ex.target_rep_max} reps` };
  }
}

export function roundTo(x: number, step = 2.5): number {
  return Math.round(x / step) * step;
}

/** Epley adjusted for reps in reserve. */
export function epley1RM(weight: number, reps: number, rir: number | null): number {
  return weight * (1 + (reps + (rir ?? 0)) / 30);
}

/** 40/60/80% ramp, rounded to 2.5 kg. */
export function warmupRamp(workingWeight: number): { weight: number; reps: number }[] {
  return [
    { weight: roundTo(workingWeight * 0.4), reps: 8 },
    { weight: roundTo(workingWeight * 0.6), reps: 5 },
    { weight: roundTo(workingWeight * 0.8), reps: 3 },
  ].filter((s) => s.weight > 0);
}

/** Hard sets per muscle. Primary counts 1, each secondary 0.5. */
export function weeklyVolume(sets: (SetLike & { primary_muscle: string; secondary_muscles: string })[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of working(sets)) {
    out[s.primary_muscle] = (out[s.primary_muscle] ?? 0) + 1;
    for (const m of s.secondary_muscles.split(',').map((x) => x.trim()).filter(Boolean)) {
      out[m] = (out[m] ?? 0) + 0.5;
    }
  }
  return out;
}

/** ISO string for Monday 00:00 local of the week containing `d`. */
export function weekStart(d = new Date()): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x.toISOString();
}

/**
 * One "up next" routine per plan: the day after the most recently done one, in plan order, wrapping.
 * Nothing done yet in a plan: its first day. `routines` must already be sorted by plan order.
 */
export function upNext<T extends { id: string; plan: string; last_done: string | null }>(routines: T[]): Set<string> {
  const ids = new Set<string>();
  for (const plan of new Set(routines.map((r) => r.plan))) {
    const days = routines.filter((r) => r.plan === plan);
    const last = days.reduce((best, r, i) => ((r.last_done ?? '') > (days[best]?.last_done ?? '') ? i : best), -1);
    ids.add(days[(last + 1) % days.length].id);
  }
  return ids;
}

export function daysAgo(iso: string | null, now = Date.now()): number | null {
  return iso ? Math.floor((now - new Date(iso).getTime()) / 86400000) : null;
}

/** Day grid, `weeks` rows oldest first, 7 columns Mon..Sun. Cell = sessions that day. */
export function sessionGrid(startTimes: string[], weeks = 6, now = Date.now()): number[][] {
  const grid = Array.from({ length: weeks }, () => Array(7).fill(0) as number[]);
  const monday = new Date(weekStart(new Date(now))).getTime();
  const DAY = 86400000;
  for (const iso of startTimes) {
    const d = new Date(iso);
    d.setHours(0, 0, 0, 0);
    const dayOff = Math.round((d.getTime() - monday) / DAY); // 0 = this Monday, negative = past
    const w = weeks - 1 + Math.floor(dayOff / 7);
    if (w >= 0 && w < weeks) grid[w][((dayOff % 7) + 7) % 7] += 1;
  }
  return grid;
}

export type HeatCell = { key: string; level: 0 | 1 | 2 | 3 | 4; minutes: number; count: number; today: boolean; future: boolean };

/**
 * GitHub-style year heatmap. `weeks` columns ending in the current week, Mon..Sun rows.
 * Level 1..4 by minutes trained that day against quartiles of all trained days; 0 = rest.
 * Also returns a month label per column where a month starts.
 */
export function heatmap(sessions: { start_time: string; end_time: string | null }[], weeks = 53, now = Date.now()): { cols: HeatCell[][]; months: string[] } {
  const agg: Record<string, { minutes: number; count: number }> = {};
  const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  for (const s of sessions) {
    const start = new Date(s.start_time);
    const k = dayKey(start);
    const a = (agg[k] ??= { minutes: 0, count: 0 });
    a.count += 1;
    a.minutes += Math.max(0, Math.round((new Date(s.end_time ?? s.start_time).getTime() - start.getTime()) / 60000));
  }
  const mins = Object.values(agg).map((a) => a.minutes).filter((m) => m > 0).sort((a, b) => a - b);
  const q = (p: number) => (mins.length ? mins[Math.min(mins.length - 1, Math.floor(p * mins.length))] : 0);
  const [t1, t2, t3] = [q(0.25), q(0.5), q(0.75)];
  const level = (a?: { minutes: number }): HeatCell['level'] => (!a ? 0 : !a.minutes ? 1 : a.minutes >= t3 ? 4 : a.minutes >= t2 ? 3 : a.minutes >= t1 ? 2 : 1);

  const today = new Date(now);
  today.setHours(12, 0, 0, 0);
  const todayKey = dayKey(today);
  const start = new Date(today);
  start.setDate(today.getDate() - ((today.getDay() + 6) % 7) - (weeks - 1) * 7);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const cols: HeatCell[][] = [];
  const months: string[] = [];
  let lastMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const colStart = new Date(start);
    colStart.setDate(start.getDate() + w * 7);
    const mo = colStart.getMonth();
    months.push(mo !== lastMonth && colStart.getDate() <= 7 && w < weeks - 1 ? MONTHS[mo] : '');
    if (colStart.getDate() <= 7) lastMonth = mo;
    const cells: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(colStart);
      day.setDate(colStart.getDate() + d);
      const key = dayKey(day);
      const a = agg[key];
      cells.push({ key, level: level(a), minutes: a?.minutes ?? 0, count: a?.count ?? 0, today: key === todayKey, future: day > today });
    }
    cols.push(cells);
  }
  return { cols, months };
}
