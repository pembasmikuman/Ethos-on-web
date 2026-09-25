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
