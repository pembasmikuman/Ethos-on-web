import { useEffect, useRef, useState } from 'react';
import { router, useNav, usePathname, type Tab } from '../lib/nav';
import { useSafeAreaInsets } from '../lib/insets';
import { useTheme } from '../lib/theme';
import { fmtClock } from '../lib/format';
import { kv } from '../db/kv';
import { useWorkout } from '../store/workout';
import { useUi } from '../store/ui';
import { fanAngles, pickAt, type Side } from '../lib/fan';
import { DotRing } from './DotRing';
import { Doto, Label } from './Text';

const ICONS: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  log: 'M2 10h2v4H2zM20 10h2v4h-2zM5 8h2v8H5zM17 8h2v8h-2zM7 12h10',
  history: 'M12 8v4l3 2M21 12a9 9 0 1 1-3-6.7M21 4v4h-4',
  exercises: 'M4 5h16M4 12h10M4 19h13M18 10l3 2-3 2',
  settings: 'M4 6h16M4 12h16M4 18h16M9 4v4M15 10v4M7 16v4',
};

const ALL_ITEMS: { key: Tab; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'history', label: 'History' },
  { key: 'log', label: 'Log' },
  { key: 'exercises', label: 'Moves' },
  { key: 'settings', label: 'Settings' },
];

/** Room screens keep clear at the bottom: the FAB's default spot, so fixed buttons there never sit under it. */
export const DOCK_HEIGHT = 76;

const SIZE = 60;
const ITEM = 46;
const R = 128;
const EDGE = 10;
const HOLD_MS = 450;
const TAB_W = 18;
const TAB_H = 60;
const EASE = 'cubic-bezier(0.2, 0.9, 0.3, 1)';

type Spot = { side: Side; y: number };

const SPOT_KEY = 'fabSpot';
const TUCK_KEY = 'fabTucked';
const savedSpot = (): Spot => { try { const s = JSON.parse(kv.get(SPOT_KEY) ?? '') as Spot; if (s.side && s.y >= 0 && s.y <= 1) return s; } catch { /* first run */ } return { side: 'right', y: 1 }; };

/** Scroll everything in the showing screen back to the top, as a second tap on an iPhone tab does. */
function scrollToTop() {
  for (const el of document.querySelectorAll<HTMLElement>('[data-screen=top] div')) if (el.scrollTop > 0) el.scrollTo({ top: 0, behavior: 'smooth' });
}

/** The dock as a floating button that lives on either side edge, anywhere from top to bottom.
 *  Tap: during a workout, jump to it; otherwise open the tabs. Hold: the tabs fan out, slide onto one and let go.
 *  Drag: move it along the edges. Fling it past an edge: it tucks into a slim tab; tap or pull the tab to bring it back. */
export function Dock() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const tab = useNav().tab;
  const active = useWorkout((s) => s.sessionId !== null);
  const rest = useWorkout((s) => s.rest);
  const startedAt = useWorkout((s) => s.startedAt);
  const hidden = useUi((s) => s.dockHidden);
  const onboarded = useUi((s) => s.onboarded);

  const wrap = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: innerWidth, h: innerHeight });
  const [spot, setSpot] = useState(savedSpot);
  const [tucked, setTucked] = useState(() => kv.get(TUCK_KEY) === '1');
  const [open, setOpen] = useState<null | 'hold' | 'tap'>(null);
  const [pick, setPick] = useState<number | null>(null);
  // The release reads this, not `pick`: a last move and the release can land before a re-render.
  const picked = useRef<number | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const g = useRef<{ x0: number; y0: number; ox: number; oy: number; vx: number; lx: number; lt: number; timer: number; mode: 'press' | 'hold' | 'drag' } | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [onboarded]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [open]);

  const items = active ? ALL_ITEMS : ALL_ITEMS.filter((i) => i.key !== 'log');
  const top = insets.top + 16;
  const bottom = box.h - insets.bottom - EDGE - SIZE;
  const fy = top + spot.y * Math.max(0, bottom - top);
  const fx = spot.side === 'left' ? EDGE : box.w - EDGE - SIZE;
  const cx = fx + SIZE / 2, cy = fy + SIZE / 2;
  const angles = fanAngles(spot.side, spot.y, items.length);

  const save = (s: Spot) => { setSpot(s); kv.set(SPOT_KEY, JSON.stringify(s)); };
  const tuck = (v: boolean) => { setTucked(v); kv.set(TUCK_KEY, v ? '1' : '0'); };
  const go = (i: number) => { setOpen(null); setPick(null); if (router.tab(items[i].key) === 'at-root') scrollToTop(); };
  const tap = () => {
    if (active && tab !== 'log') { router.tab('log'); if (rest && rest.endsAt > Date.now()) router.navigate('/rest'); }
    else setOpen(open ? null : 'tap');
  };

  const onDown = (e: React.PointerEvent) => {
    if (open === 'tap') return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const timer = window.setTimeout(() => {
      if (g.current?.mode !== 'press') return;
      g.current.mode = 'hold';
      setOpen('hold');
      navigator.vibrate?.(8);
    }, HOLD_MS);
    g.current = { x0: e.clientX, y0: e.clientY, ox: e.clientX - fx, oy: e.clientY - fy, vx: 0, lx: e.clientX, lt: e.timeStamp, timer, mode: 'press' };
  };
  const onMove = (e: React.PointerEvent) => {
    const s = g.current;
    if (!s) return;
    if (s.mode === 'hold') { picked.current = pickAt(e.clientX - cx, e.clientY - cy, angles, SIZE / 2 + 12); setPick(picked.current); return; }
    if (s.mode === 'press' && Math.hypot(e.clientX - s.x0, e.clientY - s.y0) < 8) return;
    if (s.mode === 'press') { clearTimeout(s.timer); s.mode = 'drag'; }
    s.vx = (e.clientX - s.lx) / Math.max(1, e.timeStamp - s.lt);
    s.lx = e.clientX;
    s.lt = e.timeStamp;
    setDrag({ x: e.clientX - s.ox, y: e.clientY - s.oy });
  };
  const onUp = (e: React.PointerEvent) => {
    const s = g.current;
    g.current = null;
    if (!s) return;
    clearTimeout(s.timer);
    if (s.mode === 'press') return tap();
    if (s.mode === 'hold') { const p = picked.current; picked.current = null; setPick(null); if (p != null) go(p); else setOpen(null); return; }
    setDrag(null);
    const x = e.clientX - s.ox, y = e.clientY - s.oy;
    const side: Side = x + SIZE / 2 < box.w / 2 ? 'left' : 'right';
    const yf = Math.min(1, Math.max(0, (y - top) / Math.max(1, bottom - top)));
    // Past the edge by half the button, or flung toward it, tucks it away on that side.
    const flung = side === 'right' ? s.vx > 0.8 : s.vx < -0.8;
    const past = side === 'right' ? x + SIZE / 2 > box.w - 4 : x + SIZE / 2 < 4;
    save({ side, y: yf });
    if (flung || past) tuck(true);
  };
  const onCancel = () => { const s = g.current; g.current = null; if (s) clearTimeout(s.timer); setDrag(null); picked.current = null; setPick(null); if (open === 'hold') setOpen(null); };

  // The tucked tab: tap it, or pull it inward, to bring the FAB back.
  const tabG = useRef<number | null>(null);
  const onTabUp = (e: React.PointerEvent) => {
    const dx = e.clientX - (tabG.current ?? e.clientX);
    tabG.current = null;
    if (Math.abs(dx) < 8 || (spot.side === 'right' ? dx < 0 : dx > 0)) tuck(false);
  };

  const restLeft = rest ? Math.round((rest.endsAt - now) / 1000) : 0;
  const resting = active && restLeft > 0;
  const showClock = active && tab !== 'log';
  const fraction = resting ? restLeft / rest!.total : (((now - startedAt) / 1000) % 60) / 60;
  const ink = tab === 'log' ? t.accent : t.text;

  if (!onboarded || path === '/welcome') return null;
  const offX = spot.side === 'right' ? box.w + 12 : -SIZE - 12;
  const x = drag ? drag.x : tucked ? offX : fx;
  const y = drag ? drag.y : fy;
  return (
    <div ref={wrap} style={{ position: 'absolute', inset: 0, zIndex: 50, pointerEvents: 'none' }}>
      {open && (
        <div
          onClick={() => setOpen(null)}
          className="fab-veil"
          style={{ position: 'absolute', inset: 0, background: 'rgba(10,10,11,0.28)', pointerEvents: 'auto' }}
        />
      )}
      {open && items.map((it, i) => {
        const a = (angles[i] * Math.PI) / 180;
        const dx = Math.cos(a) * R, dy = Math.sin(a) * R;
        const on = pick === i;
        const here = it.key === tab;
        return (
          <button
            type="button"
            key={it.key}
            aria-label={it.label}
            onClick={() => go(i)}
            className="fab-item"
            style={{
              position: 'absolute', left: cx + dx - ITEM / 2, top: cy + dy - ITEM / 2, width: ITEM, height: ITEM, borderRadius: ITEM / 2,
              alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto', cursor: 'pointer',
              background: on ? t.accent : t.card, border: `1px solid ${on ? t.accent : t.line}`,
              transform: `scale(${on ? 1.18 : 1})`, transition: 'transform 160ms ease-out, background-color 160ms',
              ['--dx' as string]: `${-dx}px`, ['--dy' as string]: `${-dy}px`, animationDelay: `${i * 18}ms`,
            }}
          >
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <path d={ICONS[it.key]} stroke={on ? t.bg : here ? t.accent : t.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        );
      })}
      {open === 'hold' && pick != null && (
        <div style={{ position: 'absolute', top: cy - 10, [spot.side]: SIZE + EDGE + 10, pointerEvents: 'none' }}>
          <Label color={t.text}>{items[pick].label}</Label>
        </div>
      )}

      <button
        type="button"
        aria-label={showClock ? `${resting ? 'Resting' : 'Workout'} ${fmtClock(resting ? restLeft : (now - startedAt) / 1000)}. Open workout` : 'Tabs. Hold and slide to switch, drag to move'}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(); } }}
        style={{
          position: 'absolute', left: 0, top: 0, width: SIZE, height: SIZE, borderRadius: SIZE / 2,
          alignItems: 'center', justifyContent: 'center', cursor: 'pointer', touchAction: 'none',
          pointerEvents: hidden || tucked ? 'none' : 'auto',
          background: t.card, border: `1px solid ${t.line}`, boxShadow: '0 6px 18px rgba(0,0,0,0.14), 0 1px 3px rgba(0,0,0,0.10)',
          opacity: hidden ? 0 : 1,
          transform: `translate3d(${x}px, ${y}px, 0) scale(${open === 'hold' ? 0.9 : drag ? 1.06 : 1})`,
          transition: drag ? 'none' : `transform 380ms ${EASE}, opacity 200ms`,
        }}
      >
        {showClock ? (
          <>
            <div style={{ position: 'absolute', inset: -1 }}><DotRing size={SIZE} count={20} fraction={fraction} on={resting ? t.accent : t.mute} off={t.dim} /></div>
            <Doto size={10} color={resting ? t.accent : t.text}>{fmtClock(resting ? restLeft : (now - startedAt) / 1000)}</Doto>
          </>
        ) : (
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <path d={ICONS[tab]} stroke={ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Tucked: a slim tab on the edge, its touch area wider than it looks. During a workout its bar drains with the rest or sweeps the minute. */}
      <div
        role="button"
        aria-label="Show tabs"
        tabIndex={tucked ? 0 : -1}
        onPointerDown={(e) => { tabG.current = e.clientX; }}
        onPointerUp={onTabUp}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tuck(false); } }}
        style={{
          position: 'absolute', top: fy + (SIZE - TAB_H) / 2, [spot.side]: 0, width: TAB_W + 16, height: TAB_H,
          alignItems: spot.side === 'right' ? 'flex-end' : 'flex-start', justifyContent: 'center', cursor: 'pointer', touchAction: 'none',
          pointerEvents: tucked && !hidden ? 'auto' : 'none',
          transform: `translateX(${tucked && !hidden ? 0 : spot.side === 'right' ? TAB_W + 20 : -(TAB_W + 20)}px)`,
          transition: `transform 320ms ${EASE}`,
        }}
      >
        <div style={{
          width: TAB_W, height: TAB_H, alignItems: 'center', justifyContent: 'center', background: t.card,
          border: `1px solid ${t.line}`, [spot.side === 'right' ? 'borderRight' : 'borderLeft']: 'none',
          borderRadius: spot.side === 'right' ? '12px 0 0 12px' : '0 12px 12px 0',
        }}>
          <div style={{ width: 3, height: 26, borderRadius: 2, background: t.line, justifyContent: 'flex-end', overflow: 'hidden' }}>
            {active && <div style={{ height: `${Math.round(fraction * 100)}%`, background: resting ? t.accent : t.mute }} />}
          </div>
        </div>
      </div>
    </div>
  );
}
