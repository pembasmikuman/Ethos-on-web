import { useEffect, useRef, useState } from 'react';
import { router, useNav, usePathname, type Tab } from '../lib/nav';
import { useSafeAreaInsets } from '../lib/insets';
import { useScheme, useTheme } from '../lib/theme';
import { fmtClock } from '../lib/format';
import { kv } from '../db/kv';
import { useWorkout } from '../store/workout';
import { useUi } from '../store/ui';
import { fanAngles, pickAt, type Side } from '../lib/fan';
import { DotRing } from './DotRing';
import { Doto, Label } from './Text';
import { calm, EASE, ICONS, scrollToTop, SKIN, SPRING, TabBar } from './TabBar';

const ALL_ITEMS: { key: Tab; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'history', label: 'History' },
  { key: 'log', label: 'Log' },
  { key: 'exercises', label: 'Moves' },
  { key: 'settings', label: 'Settings' },
];

/** Room screens keep clear at the bottom: the bar with its raised Log button, and the FAB's default spot. */
export const DOCK_HEIGHT = 100;

const SIZE = 60;
const ITEM = 46;
const R = 128;
const EDGE = 10;
const HOLD_MS = 450;
const TAB_W = 18;
const TAB_H = 60;
type Spot = { side: Side; y: number };

const SPOT_KEY = 'fabSpot';
const TUCK_KEY = 'fabTucked';
const savedSpot = (): Spot => { try { const s = JSON.parse(kv.get(SPOT_KEY) ?? '') as Spot; if (s.side && s.y >= 0 && s.y <= 1) return s; } catch { /* first run */ } return { side: 'right', y: 1 }; };

/** The tabs as a floating button that lives on either side edge, anywhere from top to bottom.
 *  Tap: during a workout, jump to it; otherwise open the tabs. Hold: the tabs fan out, slide onto one and let go.
 *  Drag: move it along the edges. Fling it past an edge: it tucks into a slim tab; tap or pull the tab to bring it back. */
/** The tab navigation, as the bottom bar or the floating button, whichever Settings picks. */
export function Dock() {
  return useUi((s) => s.nav) === 'fab' ? <Fab /> : <TabBar />;
}

function Fab() {
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

  const wrap = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: innerWidth, h: innerHeight });
  const [spot, setSpot] = useState(savedSpot);
  const [tucked, setTucked] = useState(() => kv.get(TUCK_KEY) === '1');
  const [open, setOpen] = useState<null | 'hold' | 'tap'>(null);
  const [pressed, setPressed] = useState(false);
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
    setPressed(true);
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
    setPressed(false);
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
  const onCancel = () => { const s = g.current; g.current = null; setPressed(false); if (s) clearTimeout(s.timer); setDrag(null); picked.current = null; setPick(null); if (open === 'hold') setOpen(null); };

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
  const bounce = calm.matches ? EASE : SPRING;
  return (
    <div ref={wrap} style={{ position: 'absolute', inset: 0, zIndex: 50, pointerEvents: 'none' }}>
      {open && (
        <div
          onClick={() => setOpen(null)}
          className="fab-veil"
          style={{ position: 'absolute', inset: 0, background: skin.veil, pointerEvents: 'auto' }}
        />
      )}
      {open && items.map((it, i) => {
        const a = (angles[i] * Math.PI) / 180;
        const dx = Math.cos(a) * R, dy = Math.sin(a) * R;
        const on = pick === i;
        const here = it.key === tab;
        const ux = Math.cos(a), uy = Math.sin(a);
        return [
          <button
            type="button"
            key={it.key}
            aria-label={it.label}
            onClick={() => go(i)}
            className="fab-item"
            style={{
              position: 'absolute', left: cx + dx - ITEM / 2, top: cy + dy - ITEM / 2, width: ITEM, height: ITEM, borderRadius: ITEM / 2,
              alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto', cursor: 'pointer',
              background: on ? t.accent : skin.item, border: `1px solid ${on ? t.accent : skin.edge}`, boxShadow: skin.itemShadow,
              transform: `scale(${on ? 1.18 : 1})`, transition: `transform 260ms ${bounce}, background-color 160ms`,
              ['--dx' as string]: `${-dx}px`, ['--dy' as string]: `${-dy}px`, animationDelay: `${i * 30}ms`,
            }}
          >
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <path d={ICONS[it.key]} stroke={on ? t.bg : here ? t.accent : t.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>,
          // Its name shows only while the finger is on it, just past the bubble on the far side from the FAB.
          on && <div
            key={`${it.key}-label`}
            aria-hidden
            className="fab-label"
            style={{
              position: 'absolute', left: cx + dx + ux * (ITEM / 2 + 8), top: cy + dy + uy * (ITEM / 2 + 8), pointerEvents: 'none',
              transform: `translate(${(ux - 1) * 50}%, ${(uy - 1) * 50}%)`, padding: '3px 7px', borderRadius: 8, whiteSpace: 'nowrap',
              background: skin.labelBg, border: `1px solid ${t.accent}`,
              ['--lx' as string]: `${-ux * 12}px`, ['--ly' as string]: `${-uy * 12}px`,
            }}
          >
            <Label color={t.accent}>{it.label}</Label>
          </div>,
        ];
      })}

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
          background: skin.fab, border: `1px solid ${skin.edge}`, boxShadow: skin.shadow,
          opacity: hidden ? 0 : 1,
          // Scale apart from the move: it squishes in fast on press and springs back past full size on release.
          transform: `translate3d(${x}px, ${y}px, 0)`, scale: String(drag ? 1.06 : pressed || open === 'hold' ? 0.86 : 1),
          transition: `${drag ? '' : `transform 460ms ${bounce}, `}scale ${pressed ? `140ms ease-out` : `520ms ${bounce}`}, opacity 200ms`,
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
          transition: `transform 420ms ${bounce}`,
        }}
      >
        <div style={{
          width: TAB_W, height: TAB_H, alignItems: 'center', justifyContent: 'center', background: skin.fab,
          border: `1px solid ${skin.edge}`, boxShadow: skin.itemShadow, [spot.side === 'right' ? 'borderRight' : 'borderLeft']: 'none',
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
