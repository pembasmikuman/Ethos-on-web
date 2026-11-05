import { useEffect, useRef, useState } from 'react';
import { router, useNav, usePathname, type Tab } from '../lib/nav';
import { useSafeAreaInsets } from '../lib/insets';
import { useScheme, useTheme } from '../lib/theme';
import { fmtClock } from '../lib/format';
import { useWorkout } from '../store/workout';
import { useUi } from '../store/ui';
import { Doto } from './Text';
import { DotRing } from './DotRing';
import { EndMenu } from './EndMenu';
import { useHold } from './HoldRing';

export const ICONS: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  log: 'M2 10h2v4H2zM20 10h2v4h-2zM5 8h2v8H5zM17 8h2v8h-2zM7 12h10',
  history: 'M12 8v4l3 2M21 12a9 9 0 1 1-3-6.7M21 4v4h-4',
  exercises: 'M4 5h16M4 12h10M4 19h13M18 10l3 2-3 2',
  settings: 'M4 6h16M4 12h16M4 18h16M9 4v4M15 10v4M7 16v4',
};

export const EASE = 'cubic-bezier(0.2, 0.9, 0.3, 1)';
// Overshoots a little past the target and settles back: the bounce on press, show and hide.
export const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
export const calm = matchMedia('(prefers-reduced-motion: reduce)');

// Raised surfaces: in dark, a lighter body with a lit top rim and a deep shadow, so it doesn't sink into the page.
export const SKIN = {
  dark: {
    fab: '#232327', item: '#1C1C1F', edge: '#3A3A3E', labelBg: '#1C1C1F', veil: 'rgba(0,0,0,0.5)',
    shadow: '0 0 0 4px rgba(255,255,255,0.03), 0 10px 24px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.10)',
    itemShadow: '0 6px 14px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
  },
  light: {
    fab: '#FFFFFF', item: '#FFFFFF', edge: '#D6D2CA', labelBg: '#F7F5F1', veil: 'rgba(10,10,11,0.28)',
    shadow: '0 10px 24px rgba(0,0,0,0.14), 0 2px 4px rgba(0,0,0,0.08)',
    itemShadow: '0 6px 14px rgba(0,0,0,0.10)',
  },
};

/** Scroll everything in the showing screen back to the top, as a second tap on an iPhone tab does. */
export function scrollToTop() {
  for (const el of document.querySelectorAll<HTMLElement>('[data-screen=top] div')) if (el.scrollTop > 0) el.scrollTo({ top: 0, behavior: 'smooth' });
}

const LEFT: { key: Tab; label: string }[] = [{ key: 'home', label: 'Home' }, { key: 'history', label: 'History' }];
const RIGHT: { key: Tab; label: string }[] = [{ key: 'exercises', label: 'Moves' }, { key: 'settings', label: 'Settings' }];

const BAR = 68;
const BTN = 74;
const LIFT = 16; // how far the Log button rises, so its top clears the bar

/** The bottom bar: two tabs each side and a round Log button set in the middle. With no workout, the middle
 *  button goes Home to pick one. During a workout its dot ring sweeps each minute (or drains the rest) around
 *  the clock; tap to open the workout, hold to end it. Scrolling a screen down folds the bar to just that button;
 *  a tap anywhere, or a sideways swipe on the button, opens it again. */
export function TabBar() {
  const t = useTheme();
  const skin = SKIN[useScheme()];
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const tab = useNav().tab;
  const active = useWorkout((s) => s.sessionId !== null);
  const rest = useWorkout((s) => s.rest);
  const startedAt = useWorkout((s) => s.startedAt);
  const hidden = useUi((s) => s.dockHidden);
  const onboarded = useUi((s) => s.onboarded);
  const [now, setNow] = useState(Date.now());
  const [pressed, setPressed] = useState(false);
  const [ending, setEnding] = useState(false);
  const blocks = useWorkout((s) => s.blocks);
  const hold = useHold(() => { setPressed(false); setEnding(true); });
  const [folded, setFolded] = useState(false);
  const swipe = useRef<{ x: number; moved: boolean } | null>(null);

  useEffect(() => {
    const last = new WeakMap<EventTarget, number>();
    const onScroll = (e: Event) => {
      const y = (e.target as HTMLElement).scrollTop ?? 0;
      const was = last.get(e.target!) ?? y;
      last.set(e.target!, y);
      if (y > was && y > 24) setFolded(true); // only going down, and past the very top
    };
    const onTap = () => setFolded(false);
    document.addEventListener('scroll', onScroll, true);
    document.addEventListener('click', onTap, true);
    return () => { document.removeEventListener('scroll', onScroll, true); document.removeEventListener('click', onTap, true); };
  }, []);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  // Like the iPhone tab bar: another tab opens as it was left; the current one pops to its first screen, then scrolls to the top.
  const go = (k: Tab) => { if (router.tab(k) === 'at-root') scrollToTop(); };
  const center = () => {
    if (swipe.current?.moved) { swipe.current = null; return; }
    if (!active) return go('home');
    go('log');
    if (rest && rest.endsAt > Date.now()) router.navigate('/rest');
  };

  const restLeft = rest ? Math.round((rest.endsAt - now) / 1000) : 0;
  const resting = restLeft > 0;
  const clock = resting ? fmtClock(restLeft) : fmtClock((now - startedAt) / 1000);
  const fraction = resting ? restLeft / rest!.total : (((now - startedAt) / 1000) % 60) / 60;
  const done = blocks.reduce((n, b) => n + b.sets.filter((x) => x.done).length, 0);
  const total = blocks.reduce((n, b) => n + b.sets.length, 0);
  const bounce = calm.matches ? EASE : SPRING;

  if (!onboarded || path === '/welcome') return null;
  const side = (items: typeof LEFT) => items.map((it) => {
    const on = it.key === tab;
    const ink = on ? t.accent : t.text;
    return (
      <button
        type="button" key={it.key} onClick={() => go(it.key)} aria-label={it.label} aria-current={on ? 'page' : undefined} aria-hidden={folded || undefined} tabIndex={folded ? -1 : undefined} className="dock-tab"
        style={{ flex: 1, height: BAR, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', opacity: folded ? 0 : 1, pointerEvents: folded ? 'none' : undefined, transition: 'opacity 180ms ease-out' }}
      >
        <svg className={on ? 'dock-on' : undefined} width={24} height={24} viewBox="0 0 24 24" fill="none">
          <path d={ICONS[it.key]} stroke={ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    );
  });

  return (
    <div
      style={{
        position: 'absolute', left: '50%', bottom: insets.bottom + 10, width: folded ? BTN : 'min(440px, calc(100% - 20px))', height: BAR, zIndex: 50,
        flexDirection: 'row', alignItems: 'center', padding: folded ? 0 : '0 4px', borderRadius: BAR / 2,
        background: folded ? 'transparent' : skin.item, border: `1px solid ${folded ? 'transparent' : skin.edge}`, boxShadow: folded ? 'none' : skin.shadow,
        pointerEvents: hidden ? 'none' : 'auto', opacity: hidden ? 0 : 1,
        transform: `translateX(-50%) translateY(${hidden ? BAR + BTN + 40 : 0}px)`,
        transition: `transform 480ms ${hidden ? EASE : bounce}, width 480ms ${bounce}, opacity 240ms, background-color 200ms, border-color 200ms, box-shadow 200ms`,
      }}
    >
      {side(LEFT)}
      <button
        type="button"
        key={active ? 'live' : 'idle'}
        aria-label={active ? `${resting ? 'Resting' : 'Workout'} ${clock}. Tap to open, hold to end` : 'Start a workout'}
        {...(active ? hold.props : {})}
        onClick={center}
        onPointerDown={(e) => { swipe.current = { x: e.clientX, moved: false }; setPressed(true); if (active) hold.props.onPointerDown(); }}
        onPointerMove={(e) => {
          const sw = swipe.current;
          if (!sw || sw.moved || Math.abs(e.clientX - sw.x) < 24) return;
          sw.moved = true; // a sideways swipe opens the bar; it is neither a tap nor a hold
          setPressed(false); hold.props.onPointerUp(); setFolded(false);
        }}
        onPointerUp={() => { setPressed(false); hold.props.onPointerUp(); }}
        onPointerLeave={() => { setPressed(false); hold.props.onPointerLeave(); }}
        className="dock-center"
        style={{
          width: BTN, height: BTN, margin: folded ? 0 : '0 6px', borderRadius: BTN / 2, flexShrink: 0, translate: `0 ${folded ? 0 : -LIFT}px`,
          alignItems: 'center', justifyContent: 'center', cursor: 'pointer', touchAction: 'none',
          background: active ? t.accent : t.text, boxShadow: skin.itemShadow,
          scale: pressed ? '0.9' : '1', transition: `scale ${pressed ? '140ms ease-out' : `520ms ${bounce}`}, translate 480ms ${bounce}, margin 480ms ${bounce}`,
        }}
      >
        {active ? (
          <>
            {/* Held, the ring fills to end the workout; at rest it sweeps the minute or drains the rest. */}
            <div style={{ position: 'absolute', inset: 0 }}>
              <DotRing size={BTN} count={20} fraction={hold.progress || fraction} on={t.bg} off={`${t.bg}55`} />
            </div>
            <Doto size={13} color={t.bg}>{clock}</Doto>
          </>
        ) : (
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke={t.bg} strokeWidth={2.2} strokeLinecap="round" />
          </svg>
        )}
      </button>
      {side(RIGHT)}
      <EndMenu open={ending} onClose={() => setEnding(false)} done={done} total={total} />
    </div>
  );
}
