/** Seconds to m:ss. */
export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 82.5 -> "82.5", 80 -> "80". */
export function fmtKg(kg: number): string {
  return Number.isInteger(kg) ? String(kg) : kg.toFixed(1).replace(/\.0$/, '');
}

/** Apply a numpad key to a numeric string. Returns new string. */
export function applyKey(current: string, key: string, maxLen = 5): string {
  if (key === 'del') return current.slice(0, -1);
  if (key === '.') return current.includes('.') || current.length >= maxLen ? current : current === '' ? '0.' : current + '.';
  if (key === '+' || key === '-') {
    const n = parseFloat(current) || 0;
    const next = Math.max(0, n + (key === '+' ? 2.5 : -2.5));
    return fmtKg(next);
  }
  if (current.length >= maxLen) return current;
  if (current === '0' && key !== '.') return key;
  return current + key;
}
