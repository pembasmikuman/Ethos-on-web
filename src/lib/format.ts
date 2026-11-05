/** Seconds to m:ss. */
export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 82.5 -> "82.5", 80 -> "80". */
export function fmtKg(kg: number): string {
  return Number.isInteger(kg) ? String(kg) : kg.toFixed(1).replace(/\.0$/, '');
}

const LB = 0.45359237;
const convert = (s: string, factor: number) => (s === '' ? s : fmtKg(Math.round((parseFloat(s) || 0) * factor * 10) / 10));
/** Typed lb to kg, to 0.1. Empty stays empty. */
export const lbToKg = (s: string) => convert(s, LB);
/** Typed kg to lb, to 0.1. Empty stays empty. */
export const kgToLb = (s: string) => convert(s, 1 / LB);

/** Apply a numpad key to a numeric string. Returns new string. */
export function applyKey(current: string, key: string, maxLen = 5): string {
  if (key === 'del') return current.slice(0, -1);
  if (key === '.') return current.includes('.') || current.length >= maxLen ? current : current === '' ? '0.' : current + '.';
  // Weight read off a lb machine: turn what was typed into kg, to 0.1.
  if (key === 'lb') return lbToKg(current);
  if (key === '+' || key === '-') {
    const n = parseFloat(current) || 0;
    const next = Math.max(0, n + (key === '+' ? 2.5 : -2.5));
    return fmtKg(next);
  }
  if (current.length >= maxLen) return current;
  if (current === '0' && key !== '.') return key;
  return current + key;
}
