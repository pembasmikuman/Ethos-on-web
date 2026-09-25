import { useEffect, useRef, useState } from 'react';
import { router, usePathname } from '../lib/nav';
import { useSafeAreaInsets } from '../lib/insets';
import { css } from '../lib/css';
import { useScheme, useTheme } from '../lib/theme';
import { fmtClock } from '../lib/format';
import { useWorkout } from '../store/workout';
import { useUi } from '../store/ui';
import { Doto, Label } from './Text';

const ICONS: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  log: 'M2 10h2v4H2zM20 10h2v4h-2zM5 8h2v8H5zM17 8h2v8h-2zM7 12h10',
  history: 'M12 8v4l3 2M21 12a9 9 0 1 1-3-6.7M21 4v4h-4',
  exercises: 'M4 5h16M4 12h10M4 19h13M18 10l3 2-3 2',
  settings: 'M4 6h16M4 12h16M4 18h16M9 4v4M15 10v4M7 16v4',
};

const ALL_ITEMS: { key: string; label: string; href: string }[] = [
  { key: 'home', label: 'Home', href: '/' },
  { key: 'history', label: 'History', href: '/history' },
  { key: 'log', label: 'Log', href: '/session' },
  { key: 'exercises', label: 'Moves', href: '/exercises' },
  { key: 'settings', label: 'Settings', href: '/settings' },
];

const ITEM_W = 72;
const PAD = 6;
export const DOCK_HEIGHT = 76;

/** Where a flick would carry the highlight if left to coast. */
function project(velocity: number, rate = 0.99): number {
  return ((velocity / 1000) * rate) / (1 - rate);
}

function rubberband(over: number, dim: number, c = 0.55): number {
  return (over * dim * c) / (dim + c * Math.abs(over));
}

export function Dock() {
  const t = useTheme();
  const scheme = useScheme();
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const active = useWorkout((s) => s.sessionId !== null);
  const rest = useWorkout((s) => s.rest);
  const startedAt = useWorkout((s) => s.startedAt);
  const hidden = useUi((s) => s.dockHidden);
  const [now, setNow] = useState(Date.now());

  const ITEMS = active ? ALL_ITEMS : ALL_ITEMS.filter((i) => i.key !== 'log');
  const selected = Math.max(0, ITEMS.findIndex((i) => i.href === path || (i.href === '/session' && (path === '/workout' || path === '/rest')) || (i.href === '/history' && path.startsWith('/history')) || (i.href === '/exercises' && path.startsWith('/exercise'))));
  const maxX = (ITEMS.length - 1) * ITEM_W;
  const [x, setX] = useState(selected * ITEM_W);
  const [drag, setDrag] = useState(false);
  const g = useRef<{ x0: number; start: number; t: number; lastX: number; moved: boolean } | null>(null);

  useEffect(() => setX(selected * ITEM_W), [selected]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  const go = (i: number) => {
    if (i === selected) return;
    const href = ITEMS[i].href;
    if (href === '/') router.dismissTo('/');
    else router.navigate(href);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    g.current = { x0: e.clientX, start: x, t: e.timeStamp, lastX: e.clientX, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = g.current;
    if (!s) return;
    const dx = e.clientX - s.x0;
    if (!s.moved && Math.abs(dx) < 6) return;
    if (!s.moved) { s.moved = true; setDrag(true); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }
    const raw = s.start + dx;
    setX(raw < 0 ? rubberband(raw, ITEM_W) : raw > maxX ? maxX + rubberband(raw - maxX, ITEM_W) : raw);
    s.lastX = e.clientX;
    s.t = e.timeStamp;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = g.current;
    g.current = null;
    if (!s?.moved) return;
    setDrag(false);
    const v = ((e.clientX - s.lastX) / Math.max(1, e.timeStamp - s.t)) * 1000;
    const i = Math.round(Math.min(maxX, Math.max(0, x + project(v))) / ITEM_W);
    setX(i * ITEM_W);
    go(i);
  };

  const glass = scheme === 'light' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.10)';
  const logIdx = ITEMS.findIndex((i) => i.key === 'log');
  const onLog = logIdx >= 0 && Math.round(x / ITEM_W) === logIdx;

  const restLeft = rest ? Math.round((rest.endsAt - now) / 1000) : 0;
  const status = !active ? null : restLeft > 0 ? fmtClock(restLeft) : fmtClock((now - startedAt) / 1000);

  if (path === '/welcome') return null;
  return (
    <div
      style={css(s.wrap, {
        bottom: insets.bottom + 10,
        transform: `translateY(${hidden ? 140 : 0}px)`,
        opacity: hidden ? 0 : 1,
        transition: 'transform 300ms cubic-bezier(.2,.9,.3,1), opacity 300ms',
        pointerEvents: 'none',
      })}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { g.current = null; setDrag(false); setX(selected * ITEM_W); }}
        style={css(s.pill, {
          borderColor: t.line,
          pointerEvents: hidden ? 'none' : 'auto',
          touchAction: 'none',
          backgroundColor: scheme === 'light' ? 'rgba(247,245,241,0.72)' : 'rgba(20,20,22,0.72)',
          backdropFilter: 'blur(24px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
        })}
      >
        <div
          style={css(s.highlight, {
            borderColor: t.line,
            transform: `translateX(${x}px) scale(${drag ? 1.08 : 1})`,
            opacity: drag ? 0.9 : 1,
            backgroundColor: onLog ? t.accent : glass,
            transition: drag ? 'background-color 200ms' : 'transform 320ms cubic-bezier(.2,.9,.3,1.15), background-color 200ms, opacity 200ms',
          })}
        />
        {ITEMS.map((it, i) => {
          const on = i === selected;
          const live = it.key === 'log';
          const ink = live ? (on ? t.bg : t.accent) : on ? t.accent : t.text;
          return (
            <button type="button" key={it.key} disabled={on} onClick={() => go(i)} style={css(s.item)}>
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <path d={ICONS[it.key]} stroke={ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {it.key === 'log' && status ? <Doto size={12} color={ink}>{status}</Doto> : <Label size={9} color={ink}>{it.label}</Label>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const s = {
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 50 },
  pill: { flexDirection: 'row', borderRadius: 28, borderWidth: 1, overflow: 'hidden', paddingHorizontal: PAD },
  highlight: { position: 'absolute', left: PAD, top: 4, width: ITEM_W, height: 48, borderRadius: 24, borderWidth: 1 },
  item: { width: ITEM_W, height: 56, alignItems: 'center', justifyContent: 'center', gap: 3 },
};
