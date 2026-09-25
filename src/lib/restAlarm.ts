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
