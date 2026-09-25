import { useEffect, type ComponentType } from 'react';
import './styles.css';
import { ROUTES } from './routes';
import { matchRoute, router, setRouteParams, usePathname } from './lib/nav';
import { useScheme, useTheme } from './lib/theme';
import { Dock } from './components/Dock';
import { useWorkout } from './store/workout';
import { useWakeLock } from './lib/wakeLock';
import { useRestAlarm } from './lib/restAlarm';
import { unlockAudio } from './lib/bell';

export function App() {
  const path = usePathname();
  const t = useTheme();
  const scheme = useScheme();
  useEffect(() => {
    for (const [k, v] of Object.entries(t)) document.documentElement.style.setProperty(`--${k}`, v);
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', t.bg);
    document.documentElement.style.colorScheme = scheme;
  }, [t, scheme]);
  // iOS may relaunch an evicted home-screen app at start_url, so send an unfinished workout back to its screen.
  useEffect(() => { if (useWorkout.getState().sessionId && location.pathname === '/') router.replace('/workout'); }, []);
  const active = useWorkout((s) => s.sessionId !== null);
  useWakeLock(active);
  useRestAlarm();
  useEffect(() => {
    // click, not pointerdown: on iPhone only a finished tap counts as a user gesture for audio.
    addEventListener('click', unlockAudio, { capture: true });
    return () => removeEventListener('click', unlockAudio, { capture: true });
  }, []);
  let Screen: ComponentType | null = null;
  for (const [pattern, C] of ROUTES) {
    const p = matchRoute(pattern, path);
    if (p) { setRouteParams(p); Screen = C; break; }
  }
  return (
    <div style={{ height: 'var(--app-h, 100dvh)', background: t.bg }}>
      {Screen ? <Screen key={path + location.search} /> : <p style={{ color: t.mute, padding: 24 }}>Not found</p>}
      <Dock />
    </div>
  );
}
