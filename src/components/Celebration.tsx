import { useEffect, useMemo, useRef } from 'react';
import { useTheme } from '../lib/theme';
import { useWorkout } from '../store/workout';
import { useCount } from './PRCard';
import { Doto, Label } from './Text';

const WIPE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const LIFT = 'cubic-bezier(0.77, 0, 0.175, 1)';
const SHOW_MS = 2400;

/** Session finished: accent wipe out of the Finish tile, dot ripple, DONE and the numbers, then the panel lifts off the summary.
 *  Sits above every screen so the summary can load underneath. Tap to skip. */
export function Celebration() {
  const cheer = useWorkout((s) => s.cheer);
  const dismiss = useWorkout((s) => s.dismissCheer);
  const t = useTheme();
  const ref = useRef<HTMLDivElement>(null);
  const leaving = useRef(false);
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mins = useCount(0, cheer?.mins ?? 0, still, 460);
  const sets = useCount(0, cheer?.sets ?? 0, still, 520);
  const kg = useCount(0, cheer?.kg ?? 0, still, 580);

  // A dot every 30 x 40 px, each delayed by its distance from the tap so they ripple out from it.
  const dots = useMemo(() => {
    if (!cheer || still) return [];
    const out: { x: number; y: number; delay: number }[] = [];
    for (let y = 20; y < innerHeight; y += 40) for (let x = 15; x < innerWidth; x += 30) out.push({ x, y, delay: 120 + Math.hypot(x - cheer.x, y - cheer.y) * 1.1 });
    return out;
  }, [cheer, still]);

  const leave = () => {
    const el = ref.current;
    if (!el || leaving.current) return;
    leaving.current = true;
    const a = still
      ? el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-out', fill: 'forwards' })
      : el.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }], { duration: 420, easing: LIFT, fill: 'forwards' });
    a.finished.then(dismiss, dismiss);
  };

  useEffect(() => {
    const el = ref.current;
    if (!cheer || !el) return;
    leaving.current = false;
    const at = `at ${cheer.x}px ${cheer.y}px`;
    if (still) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
    else el.animate([{ clipPath: `circle(0px ${at})` }, { clipPath: `circle(150vmax ${at})` }], { duration: 620, easing: WIPE });
    const id = setTimeout(leave, SHOW_MS);
    const key = (e: KeyboardEvent) => (e.key === 'Escape' || e.key === 'Enter') && leave();
    addEventListener('keydown', key);
    return () => { clearTimeout(id); removeEventListener('keydown', key); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cheer]);

  if (!cheer) return null;
  const stats: [number, string][] = [[Math.round(mins), 'min'], [Math.round(sets), 'sets'], [Math.round(kg), 'kg moved']];
  return (
    <div ref={ref} className="cel" onClick={leave} role="status" aria-live="polite" style={{ position: 'fixed', inset: 0, zIndex: 101, background: t.accent }}>
      <span className="prc-sr">{`Session done. ${cheer.title}: ${cheer.mins} minutes, ${cheer.sets} sets, ${cheer.kg} kg moved.`}</span>
      {dots.map((d, i) => <i key={i} className="cel-dot" style={{ left: d.x - 3, top: d.y - 3, background: t.bg, animationDelay: `${d.delay}ms` }} />)}
      <div aria-hidden style={{ alignItems: 'center' }}>
        <Doto size={76} color={t.bg} className="cel-rise cel-big" style={{ animationDelay: '260ms' }}>DONE</Doto>
        <Label color={t.bg} className="cel-rise" style={{ animationDelay: '360ms', paddingTop: 8 }}>{cheer.title}</Label>
        <div style={{ flexDirection: 'row', gap: 22, paddingTop: 30 }}>
          {stats.map(([n, label], i) => (
            <div key={label} className="cel-rise" style={{ alignItems: 'center', animationDelay: `${460 + i * 60}ms` }}>
              <Doto size={26} color={t.bg}>{n.toLocaleString()}</Doto>
              <Label color={t.bg}>{label}</Label>
            </div>
          ))}
        </div>
      </div>
      <Label color={t.bg} className="cel-tap" style={{ position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom) + 28px)' }}>Tap to continue</Label>
    </div>
  );
}
