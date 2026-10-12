import { useEffect, useState, type CSSProperties } from 'react';
import { useTheme } from '../lib/theme';
import { fmtKg } from '../lib/format';
import { useWorkout } from '../store/workout';
import { Doto, Label } from './Text';

// 13 x 12 trophy, drawn on a dot-matrix grid like the rest of Ethos's readouts.
const TROPHY = [
  '..XXXXXXXXX..',
  'XXXXXXXXXXXXX',
  'X.XXXXXXXXX.X',
  'X.XXXXXXXXX.X',
  '.X.XXXXXXX.X.',
  '..XXXXXXXXX..',
  '....XXXXX....',
  '.....XXX.....',
  '......X......',
  '......X......',
  '....XXXXX....',
  '...XXXXXXX...',
];
const GAP = 8;
const SHOW_MS = 3200;

/** Eased count from `from` to `to`, starting after `delay`. Jumps straight to `to` when `still`. */
function useCount(from: number, to: number, still: boolean, delay = 320, ms = 900) {
  const [v, setV] = useState(still ? to : from);
  useEffect(() => {
    if (still) { setV(to); return; }
    setV(from);
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / ms));
      setV(from + (to - from) * (1 - Math.pow(2, -10 * p))); // ease-out expo
      if (p < 1) raf = requestAnimationFrame(tick);
      else setV(to);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, still, delay, ms]);
  return v;
}

const ordinal = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${s}`;
};

/** Dot burst: fixed spread so every PR looks the same, colours cycle through the palette. */
const BURST = Array.from({ length: 30 }, (_, i) => {
  const a = (i / 30) * Math.PI * 2 + (i % 3) * 0.17;
  const d = 90 + ((i * 37) % 70);
  return { dx: Math.cos(a) * d, dy: Math.sin(a) * d * 0.8 - 40, r: 3 + (i % 3), delay: (i % 5) * 18 };
});

/** Celebrates the PR the last logged set hit. Sits above every screen so it plays over Rest. */
export function PRCard() {
  const pr = useWorkout((s) => s.pr);
  const dismiss = useWorkout((s) => s.dismissPR);
  const t = useTheme();
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const value = useCount(pr?.from ?? 0, pr?.to ?? 0, still);

  useEffect(() => {
    if (!pr) return;
    const id = setTimeout(dismiss, SHOW_MS);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && dismiss();
    addEventListener('keydown', key);
    return () => { clearTimeout(id); removeEventListener('keydown', key); };
  }, [pr, dismiss]);

  if (!pr) return null;
  const weight = pr.kind === 'weight';
  const fmt = (n: number) => (weight ? fmtKg(Math.round(n * 4) / 4) : String(Math.round(n)));
  const unit = weight ? 'KG' : 'REPS';
  const colors = [t.accent, t.text, t.accent, t.green];
  const [width, height] = [TROPHY[0].length * GAP, TROPHY.length * GAP];

  return (
    <div className="prc-veil" onClick={dismiss} role="status" aria-live="polite" style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)' }}>
      <span className="prc-sr">{`New ${weight ? 'weight' : 'rep'} PR on ${pr.exercise}: ${fmt(pr.from)} to ${fmt(pr.to)} ${unit.toLowerCase()}. Your ${ordinal(pr.month)} PR this month.`}</span>
      <div className="prc-card" aria-hidden style={{ background: t.card, borderColor: t.line }}>
        <div className="prc-trophy" style={{ width, height }}>
          {!still && BURST.map((b, i) => (
            <i key={i} className="prc-bit" style={{ position: 'absolute', '--dx': `${b.dx}px`, '--dy': `${b.dy}px`, width: b.r * 2, height: b.r * 2, background: colors[i % colors.length], animationDelay: `${260 + b.delay}ms` } as CSSProperties} />
          ))}
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            {TROPHY.flatMap((row, y) => [...row].map((c, x) => c === 'X' && (
              <circle key={`${x}-${y}`} className="prc-dot" cx={x * GAP + GAP / 2} cy={y * GAP + GAP / 2} r={3} fill={t.accent} style={{ animationDelay: `${(TROPHY.length - 1 - y) * 22}ms` }} />
            )))}
          </svg>
        </div>

        <Doto size={24} style={{ paddingTop: 22 }}>{weight ? 'NEW WEIGHT PR' : 'NEW REP PR'}</Doto>
        <Label numberOfLines={1} style={{ paddingTop: 4, maxWidth: '100%' }}>{pr.exercise}</Label>

        <div style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingTop: 20 }}>
          <Doto size={22} color={t.mute}>{fmt(pr.from)}</Doto>
          <Doto size={18} color={t.dim}>→</Doto>
          <Doto size={44} color={t.accent} style={{ minWidth: `${fmt(pr.to).length}ch`, textAlign: 'right' }}>{fmt(value)}</Doto>
          <Label color={t.accent}>{unit}</Label>
        </div>
        {pr.kind === 'reps' && <Label style={{ paddingTop: 2 }}>{pr.at > 0 ? `at ${fmtKg(pr.at)} kg` : 'bodyweight'}</Label>}

        <div style={{ alignSelf: 'stretch', height: 1, background: t.line, marginTop: 20 }} />
        <Label color={t.text} style={{ paddingTop: 14 }}>{pr.month === 1 ? 'First PR this month' : `${ordinal(pr.month)} PR this month`}</Label>
      </div>
    </div>
  );
}
