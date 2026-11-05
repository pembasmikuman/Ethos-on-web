import { epley1RM } from './progression';

type Set = { weight: number; reps: number; rir: number | null };
export type Hist = { date: string; sets: Set[] }[];

const DAY = 86_400_000;
const best = (sets: Set[]) => sets.reduce((a, b) => (epley1RM(b.weight, b.reps, b.rir) > epley1RM(a.weight, a.reps, a.rir) ? b : a));

/** Trend numbers from `exerciseHistory` (newest first). Series come back oldest first, ready for DotTrend.
 *  Bodyweight moves track reps, since their weight is 0. */
export function trend(hist: Hist, bodyweight = false) {
  const e1rm = hist.map((h) => (bodyweight ? Math.max(...h.sets.map((x) => x.reps)) : Math.round(epley1RM(best(h.sets).weight, best(h.sets).reps, best(h.sets).rir))));
  const top = hist.map((h) => Math.max(...h.sets.map((x) => (bodyweight ? x.reps : x.weight))));
  const volume = hist.map((h) => Math.round(h.sets.reduce((n, x) => n + (bodyweight ? x.reps : x.weight * x.reps), 0)));
  // Change across the last 8 weeks: newest against the oldest session still inside that window.
  const cutoff = hist.length ? new Date(hist[0].date).getTime() - 56 * DAY : 0;
  const oldest = hist.reduce((i, h, j) => (new Date(h.date).getTime() >= cutoff ? j : i), 0);
  return {
    series: { e1rm: [...e1rm].reverse(), top: [...top].reverse(), volume: [...volume].reverse() },
    change: oldest > 0 ? e1rm[0] - e1rm[oldest] : null,
    lastBest: hist.length ? best(hist[0].sets) : null,
    /** Each session against the one before it, by the headline number. */
    dir: e1rm.map((v, i) => (i + 1 >= e1rm.length ? 0 : Math.sign(Math.round(v - e1rm[i + 1])))),
  };
}
