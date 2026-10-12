import { kv } from '../db/kv';
import type { Progression } from '../db/types';

/** App-wide defaults every exercise follows, except the settings the user tuned on it. */
export type Setup = { rule: Progression; repMin: number; repMax: number; rest: number; increment: number };
/** One switch per group of exercise settings. Reps covers both ends of the range. */
export type SetupField = 'rule' | 'reps' | 'rest' | 'increment';

export const SETUP_DEFAULT: Setup = { rule: 'double', repMin: 8, repMax: 12, rest: 120, increment: 2.5 };
const KEY = 'setup';

export function getSetup(): Setup {
  try { return { ...SETUP_DEFAULT, ...JSON.parse(kv.get(KEY) ?? '{}') }; } catch { return SETUP_DEFAULT; }
}

export function storeSetup(s: Setup): void {
  kv.set(KEY, JSON.stringify(s));
}

/** `tuned` with `field` added, kept as a comma list like the column stores it. */
export function withTuned(tuned: string, field: SetupField): string {
  const list = tuned.split(',').filter(Boolean);
  return list.includes(field) ? tuned : [...list, field].join(',');
}
