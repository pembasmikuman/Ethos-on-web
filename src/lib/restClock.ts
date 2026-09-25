/** How late the bell may still ring. Past this the phone was asleep or the app reloaded long after, and a bell would confuse. */
export const LATE_MS = 5000;

export function restOutcome(endsAt: number, now: number): 'wait' | 'ring' | 'silent' {
  if (now < endsAt) return 'wait';
  return now - endsAt <= LATE_MS ? 'ring' : 'silent';
}
