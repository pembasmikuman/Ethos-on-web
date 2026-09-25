import { memo, useEffect, useMemo, useRef } from 'react';
import './styles.css';
import { ROUTES } from './routes';
import { matchRoute, router, ScreenContext, TAB_ROOT, useNav, type Tab } from './lib/nav';
import { useScheme, useTheme } from './lib/theme';
import { Dock } from './components/Dock';
import { useWorkout } from './store/workout';
import { useWakeLock } from './lib/wakeLock';
import { useRestAlarm } from './lib/restAlarm';
import { unlockAudio } from './lib/bell';
import { useEdgeSwipe, useSlides } from './lib/slide';

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

  const box = useRef<HTMLDivElement>(null);
  const m = nav.move;
  const topK = nav.stacks[nav.tab].at(-1)!.k;
  useSlides(box, m, topK);
  useEdgeSwipe(box);
  // A screen that was just popped stays on the page, in its old place, while it slides away.
  const tabs = Object.keys(TAB_ROOT) as Tab[];
  const ghost = m?.kind === 'pop' && !tabs.some((tab) => nav.stacks[tab].some((e) => e.k === m.from.k)) ? m.from : null;
  return (
    <div ref={box} style={{ height: 'var(--app-h, 100dvh)', background: t.bg, overflow: 'hidden' }}>
      {tabs.flatMap((tab) =>
        [...nav.stacks[tab], ...(ghost && m!.fromTab === tab ? [ghost] : [])].map((e) => {
          const top = e.k === topK, from = e.k === m?.from.k;
          return <ScreenHost key={e.k} k={e.k} href={e.href} shown={top || from} focused={top} layer={from && m!.kind === 'pop' ? 2 : top ? 1 : 0} />;
        }),
      )}
      <Dock />
    </div>
  );
}

/** One mounted screen. Hidden ones keep their layout (so their scroll position) but can't be seen, tapped or focused.
 *  During a slide the screen underneath is shown too, but only the top one is focused. */
const ScreenHost = memo(function ScreenHost({ k, href, shown, focused, layer }: { k: number; href: string; shown: boolean; focused: boolean; layer: number }) {
  const [path, search = ''] = href.split('?');
  const found = useMemo(() => {
    for (const [pattern, C] of ROUTES) {
      const p = matchRoute(pattern, path);
      if (p) return { C, params: { ...Object.fromEntries(new URLSearchParams(search)), ...p } };
    }
    return null;
  }, [path, search]);
  const ctx = useMemo(() => ({ params: found?.params ?? {}, focused }), [found, focused]);
  return (
    <div
      data-k={k}
      data-screen={focused ? 'top' : undefined}
      inert={!focused}
      style={{
        position: 'absolute', inset: 0, zIndex: layer, background: 'var(--bg)',
        // Off screen while at rest; shows along the left edge while sliding.
        boxShadow: '-12px 0 32px rgba(0,0,0,0.14)',
        visibility: shown ? 'visible' : 'hidden', pointerEvents: focused ? undefined : 'none',
      }}
    >
      <ScreenContext value={ctx}>{found ? <found.C /> : <p style={{ color: 'var(--mute)', padding: 24 }}>Not found</p>}</ScreenContext>
    </div>
  );
});
