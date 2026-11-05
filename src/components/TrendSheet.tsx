import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pressable, StyleSheet, View } from '../rn';
import { exerciseHistory } from '../db/queries';
import { fmtKg } from '../lib/format';
import { useTheme } from '../lib/theme';
import { trend, type Hist } from '../lib/trend';
import type { ExerciseBlock } from '../store/workout';
import { DotTrend } from './DotTrend';
import { Doto, Label } from './Text';

const DRAWER = 'cubic-bezier(0.32, 0.72, 0, 1)';
const TABS = [['e1rm', '1RM'], ['top', 'Top'], ['volume', 'Volume']] as const;

type Props = { block: ExerciseBlock; onClose: () => void; onSwap: () => void; onAdd: () => void };

/** Past sessions of the current exercise, over the workout so logging never leaves the screen. */
export function TrendSheet({ block, onClose, onSwap, onAdd }: Props) {
  const t = useTheme();
  const ex = block.exercise;
  const [hist, setHist] = useState<Hist | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('e1rm');
  const sheet = useRef<HTMLDivElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  const closing = useRef(false);

  useEffect(() => { exerciseHistory(ex.id).then(setHist); }, [ex.id]);
  useEffect(() => {
    sheet.current?.animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 420, easing: DRAWER });
    veil.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' });
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close();
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Slide out (faster than in), then unmount. `then` runs after, for Swap and Add which navigate. */
  const close = (then?: () => void) => {
    if (closing.current) return;
    closing.current = true;
    veil.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' });
    const a = sheet.current?.animate([{ transform: 'none' }, { transform: 'translateY(100%)' }], { duration: 240, easing: 'ease-in', fill: 'forwards' });
    const done = () => { onClose(); then?.(); };
    a ? a.finished.then(done, done) : done();
  };

  const bw = ex.load === 'bodyweight';
  const unit = bw ? 'reps' : 'kg';
  const r = hist && trend(hist, bw);
  const now = r?.series.e1rm.at(-1);
  const done = block.sets.filter((x) => x.done).length;
  const card = [s.stat, { backgroundColor: t.bg }];

  // Into #root, not the screen: each screen is its own layer under the dock, and #root keeps the app's layout rules.
  return createPortal(
    <View style={{ position: 'fixed', inset: 0, zIndex: 60, justifyContent: 'flex-end' }}>
      <div ref={veil} onClick={() => close()} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
      <div ref={sheet} role="dialog" aria-label={`${ex.name} trends`} style={{ maxHeight: '86%', overflowY: 'auto', background: t.card, borderTop: `1px solid ${t.line}`, borderRadius: '22px 22px 0 0', padding: '10px 16px calc(env(safe-area-inset-bottom) + 16px)', gap: 14 }}>
        <View style={[s.grip, { backgroundColor: t.line }]} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Doto size={22} numberOfLines={2}>{ex.name.toUpperCase()}</Doto>
            <Label>{ex.primary_muscle} · {hist ? `${hist.length} session${hist.length === 1 ? '' : 's'}` : '…'}</Label>
          </View>
          <Pressable onPress={() => close()} hitSlop={12}><Label color={t.accent}>Close</Label></Pressable>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={card}>
            <Label>{bw ? 'Best reps' : 'Est 1RM'}</Label>
            <Doto size={20} color={t.accent}>{now != null ? fmtKg(now) : '–'}</Doto>
            <Label color={r?.change ? (r.change > 0 ? t.green : t.mute) : t.dim}>{r?.change == null ? 'Need 2 sessions' : `${r.change > 0 ? '▲' : r.change < 0 ? '▼' : '='} ${fmtKg(Math.abs(r.change))} / 8 wk`}</Label>
          </View>
          <View style={card}>
            <Label>Best set</Label>
            <Doto size={20}>{r?.lastBest ? (bw ? `${r.lastBest.reps}` : `${fmtKg(r.lastBest.weight)}×${r.lastBest.reps}`) : '–'}</Doto>
            <Label color={t.dim}>Last time</Label>
          </View>
          <View style={card}>
            <Label>Today</Label>
            <Doto size={20}>{done}/{block.sets.length}</Doto>
            <Label color={t.dim}>Sets done</Label>
          </View>
        </View>

        {r && r.series.e1rm.length > 0 ? (
          <>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {TABS.map(([k, label]) => (
                <Pressable key={k} onPress={() => setTab(k)} style={[s.tab, { backgroundColor: tab === k ? t.line : 'transparent' }]}>
                  <Label color={tab === k ? t.text : t.mute}>{bw && k === 'e1rm' ? 'Reps' : label}</Label>
                </Pressable>
              ))}
            </View>
            <DotTrend values={r.series[tab]} unit={unit} />
            <View>
              {hist!.slice(0, 3).map((h, i) => (
                <View key={h.date} style={[s.row, { borderTopColor: t.line }]}>
                  <Label color={t.dim} style={{ width: 56 }}>{new Date(h.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</Label>
                  <Doto size={14} style={{ flex: 1 }}>{h.sets.map((x) => (bw ? `${x.reps}` : `${fmtKg(x.weight)}×${x.reps}`)).join('  ')}</Doto>
                  <Label color={r.dir[i] > 0 ? t.green : r.dir[i] < 0 ? t.accent : t.dim}>{r.dir[i] > 0 ? '▲' : r.dir[i] < 0 ? '▼' : '–'}</Label>
                </View>
              ))}
            </View>
          </>
        ) : hist && <Label color={t.dim}>No past sessions yet. Trends fill in as you log.</Label>}

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => close(onSwap)} style={[s.btn, { borderColor: t.line }]}><Label color={t.text}>Swap</Label></Pressable>
          <Pressable onPress={() => close(onAdd)} style={[s.btn, { borderColor: t.line }]}><Label color={t.text}>Add after</Label></Pressable>
        </View>
      </div>
    </View>,
    document.getElementById('root')!,
  );
}

const s = StyleSheet.create({
  grip: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center' },
  stat: { flex: 1, borderRadius: 10, padding: 9, gap: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: 1 },
  btn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
});
