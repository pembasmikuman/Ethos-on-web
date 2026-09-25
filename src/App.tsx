import { memo, useEffect, useMemo } from 'react';
import './styles.css';
import { ROUTES } from './routes';
import { matchRoute, router, ScreenContext, TAB_ROOT, useNav, type Tab } from './lib/nav';
import { useScheme, useTheme } from './lib/theme';
import { Dock } from './components/Dock';
import { useWorkout } from './store/workout';
import { useWakeLock } from './lib/wakeLock';
import { useRestAlarm } from './lib/restAlarm';
import { unlockAudio } from './lib/bell';

export function App() {
  const nav = useNav();
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
  // A workout that ended outside its own screens (restore, relaunch after finishing) takes its tab with it.
  const hasWorkout = useWorkout((s) => s.sessionId !== null || s.routine !== null);
  useEffect(() => { if (!hasWorkout) router.clearLog(); }, [hasWorkout]);
  return (
    <div style={{ height: 'var(--app-h, 100dvh)', background: t.bg }}>
      {(Object.keys(TAB_ROOT) as Tab[]).flatMap((tab) =>
        nav.stacks[tab].map((e, i, st) => <ScreenHost key={e.k} href={e.href} visible={tab === nav.tab && i === st.length - 1} />),
      )}
      <Dock />
    </div>
  );
}

/** One mounted screen. Hidden ones keep their layout (so their scroll position) but can't be seen, tapped or focused. */
const ScreenHost = memo(function ScreenHost({ href, visible }: { href: string; visible: boolean }) {
  const [path, search = ''] = href.split('?');
  const found = useMemo(() => {
    for (const [pattern, C] of ROUTES) {
      const p = matchRoute(pattern, path);
      if (p) return { C, params: { ...Object.fromEntries(new URLSearchParams(search)), ...p } };
    }
    return null;
  }, [path, search]);
  const ctx = useMemo(() => ({ params: found?.params ?? {}, focused: visible }), [found, visible]);
  return (
    <div
      data-screen={visible ? 'top' : undefined}
      inert={!visible}
      style={{ position: 'absolute', inset: 0, visibility: visible ? 'visible' : 'hidden', pointerEvents: visible ? undefined : 'none' }}
    >
      <ScreenContext value={ctx}>{found ? <found.C /> : <p style={{ color: 'var(--mute)', padding: 24 }}>Not found</p>}</ScreenContext>
    </div>
  );
});
