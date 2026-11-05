import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View, type ScrollViewHandle } from '../rn';
import { router } from '../lib/nav';
import { useSafeAreaInsets } from '../lib/insets';
import { useTheme, useTopInset } from '../lib/theme';
import { applyKey, fmtClock, fmtKg } from '../lib/format';
import { useWorkout } from '../store/workout';
import { Doto, Label } from '../components/Text';
import { Numpad } from '../components/Numpad';
import { SetHeader, SetRow } from '../components/SetRow';
import { DOCK_HEIGHT } from '../components/Dock';
import type { ExerciseBlock, Field } from '../store/workout';
import { Swipe } from '../components/Swipe';
import { HoldRing } from '../components/HoldRing';
import { EndMenu } from '../components/EndMenu';
import { TrendSheet } from '../components/TrendSheet';

/** One clock for the whole screen: rest countdown while resting, session elapsed otherwise.
 *  Lives up here so the tick never re-renders the exercise pages. */
function HeaderClock({ onFinish }: { onFinish: () => void }) {
  const t = useTheme();
  const startedAt = useWorkout((st) => st.startedAt);
  const rest = useWorkout((st) => st.rest);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [rest]);

  const left = rest ? Math.round((rest.endsAt - now) / 1000) : 0;
  const resting = rest != null && left > 0;
  // Ring counts down the rest, or sweeps each minute of the session.
  const idle = resting ? left / rest.total : (((now - startedAt) / 1000) % 60) / 60;
  return (
    <HoldRing size={84} idle={idle} idleColor={resting ? t.accent : t.mute} onHold={onFinish} onPress={resting ? () => router.navigate('/rest') : undefined} label="Hold to end workout">
      <Label color={resting ? t.accent : t.mute} size={10}>{resting ? 'Resting' : 'Elapsed'}</Label>
      <Doto size={18} color={resting ? t.accent : t.mute}>{fmtClock(resting ? left : (now - startedAt) / 1000)}</Doto>
    </HoldRing>
  );
}

type PageProps = { block: ExerciseBlock; focus: { setIdx: number; field: Field } | null; onEdit: () => void; hasNext: boolean };

const ExercisePage = memo(function ExercisePage({ block, focus, onEdit, hasNext }: PageProps) {
  const t = useTheme();
  const { addSet, removeSet, setFocus, setNotes, setSetNote, toggleUnit } = useWorkout.getState();
  let working = 0;
  return (
    <View style={{ flex: 1, gap: 12 }}>
      {block.overload && (
        <View style={[s.banner, { backgroundColor: t.warnBg, borderColor: t.warnLine }]}>
          <View style={[s.dot, { backgroundColor: t.accent }]} />
          <Label color={t.accent} style={{ flex: 1 }}>{block.why}</Label>
          <Doto size={18} color={t.accent}>{block.exercise.load === 'bodyweight' ? '+1 REP' : `+${fmtKg(block.exercise.increment_kg)} kg`}</Doto>
        </View>
      )}
      {block.deload && (
        <View style={[s.banner, { backgroundColor: t.card, borderColor: t.line }]}>
          <View style={[s.dot, { backgroundColor: t.mute }]} />
          <Label style={{ flex: 1 }}>{block.why}</Label>
        </View>
      )}
      <Pressable
        onPress={() => Alert.prompt('Note · ' + block.exercise.name, 'Seat, pin, grip. Shows every time.', (v) => setNotes(block.exercise.id, v.trim()), 'plain-text', block.exercise.notes)}
        style={[s.banner, { backgroundColor: 'transparent', borderColor: t.line, borderStyle: block.exercise.notes ? 'solid' : 'dashed' }]}
      >
        <Label color={block.exercise.notes ? t.text : t.dim} style={{ flex: 1 }}>{block.exercise.notes || 'Add a note for this exercise'}</Label>
      </Pressable>
      {block.stalled && !block.overload && !block.deload && (
        <View style={[s.banner, { backgroundColor: t.card, borderColor: t.line }]}>
          <View style={[s.dot, { backgroundColor: t.mute }]} />
          <Label style={{ flex: 1 }}>Stalled 3 sessions · try −10%</Label>
        </View>
      )}
      <ScrollView style={{ flex: 1 }}>
        <View style={{ paddingBottom: hasNext ? 10 : 0 }}>
        {/* The next exercise, tucked behind this one: the stack says there's more below. */}
        {hasNext && <View style={[s.peek, { backgroundColor: t.card, borderColor: t.line }]} />}
        <View style={[s.card, { backgroundColor: t.card, borderColor: t.line }]}>
        <SetHeader load={block.exercise.load} unit={block.unit} onUnit={toggleUnit} />
        {block.sets.map((set, i) => {
          if (set.type === 'working') working += 1;
          const n = working;
          return (
            <Swipe key={set.id} onRemove={() => removeSet(i)}>
            <SetRow
              index={i}
              workingNumber={n}
              set={set}
              prev={set.type === 'working' ? block.prev[n - 1] : undefined}
              targetMax={block.exercise.target_rep_max}
              load={block.exercise.load}
              unit={block.unit}
              perSide={block.exercise.per_side === 1}
              active={focus != null && i === focus.setIdx}
              focusField={focus != null && i === focus.setIdx ? focus.field : null}
              onFocus={(f) => { setFocus(i, f); onEdit(); }}
              onNotes={(v) => setSetNote(set.id, v)}
            />
            </Swipe>
          );
        })}
        </View>
        </View>
        <View style={s.actions}>
          <Pressable onPress={() => addSet('warmup')} hitSlop={8}><Label color={t.warm}>+ Warmups</Label></Pressable>
          <Pressable onPress={() => addSet()} hitSlop={8}><Label>+ Set</Label></Pressable>
        </View>
      </ScrollView>
    </View>
  );
});

export default function Workout() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const top = useTopInset();
  const title = useWorkout((st) => st.title);
  const blocks = useWorkout((st) => st.blocks);
  const exIdx = useWorkout((st) => st.exIdx);
  const focus = useWorkout((st) => st.focus);
  const block = blocks[exIdx];
  const [pageH, setPageH] = useState(0);
  const [padOpen, setPadOpen] = useState(true);
  const [ending, setEnding] = useState(false);
  const [trends, setTrends] = useState(false);
  const pager = useRef<ScrollViewHandle>(null);
  const shown = useRef(exIdx);
  const openPad = useCallback(() => setPadOpen(true), []);
  const grab = useRef<number | null>(null);

  // Realign the visible page after every commit: exIdx changed elsewhere (overview,
  // prev/next), or pageH changed because the keypad opened or closed. Has to run as an
  // effect, not inside onLayout, so the pages have already taken their new height.
  useEffect(() => {
    if (!pageH) return;
    const animated = shown.current !== exIdx;
    shown.current = exIdx;
    pager.current?.scrollTo({ y: exIdx * pageH, animated });
  }, [exIdx, pageH]);

  if (!block) return null;

  const focusedSet = block.sets[focus.setIdx];
  const onKey = (k: string) => {
    if (!focusedSet) return;
    const max = focus.field === 'weight' ? 5 : 2;
    if ((k === '+' || k === '-' || k === '.') && focus.field !== 'weight') return;
    useWorkout.getState().input(applyKey(focusedSet[focus.field], k, max));
  };
  const nextField = (): 'reps' | 'rir' | null => {
    if (focus.field === 'weight') return 'reps';
    if (focus.field === 'reps' && focusedSet?.type === 'working') return 'rir';
    return null;
  };
  const onDone = async () => {
    const w = useWorkout.getState();
    const nf = nextField();
    if (nf) {
      w.setFocus(focus.setIdx, nf);
      return;
    }
    await w.completeSet();

    if (useWorkout.getState().rest) router.navigate('/rest');
  };
  const doneLabel = nextField() ? `Next · ${nextField()}` : 'Done · Rest';
  const onFinish = () => setEnding(true);
  const doneSets = blocks.reduce((n, b) => n + b.sets.filter((x) => x.done).length, 0);
  const totalSets = blocks.reduce((n, b) => n + b.sets.length, 0);

  const rest = (secs: number) => () => { useWorkout.getState().startRest(secs); router.navigate('/rest'); };
  const planned = block.exercise.default_rest_seconds;
  const onRest = () =>
    Alert.alert('Start a rest timer', undefined, [
      ...[...new Set([60, 120, 180, 300, planned])].sort((a, b) => a - b).map((secs) => ({ text: secs === planned ? `${fmtClock(secs)} · this exercise` : fmtClock(secs), onPress: rest(secs) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);

  return (
    <View style={[s.page, { backgroundColor: t.bg, paddingTop: top + 8, paddingBottom: insets.bottom + DOCK_HEIGHT }]}>
      <View style={s.head}>
        <View style={{ gap: 4, flex: 1 }}>
          <Pressable onPress={() => router.navigate('/session')} hitSlop={8}><Label color={t.accent}>‹ {title} · {exIdx + 1} / {blocks.length}</Label></Pressable>
          <Pressable onPress={() => setTrends(true)} hitSlop={8}>
            <Doto size={30} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>{block.exercise.name.toUpperCase()}</Doto>
          </Pressable>
        </View>
        <HeaderClock onFinish={onFinish} />
      </View>

      <ScrollView
        ref={pager}
        // Snap to our own page height; pagingEnabled snaps to the frame, which can drift from pageH.
        snapToInterval={pageH || undefined}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          setPageH(h);
        }}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.y / pageH);
          if (i !== shown.current) { shown.current = i; useWorkout.getState().setExercise(i); }
        }}
        style={{ flex: 1 }}
      >
        {blocks.map((b, bi) => (
          <View key={b.exercise.id + bi} style={{ height: pageH || undefined, paddingRight: 14, overflow: 'hidden' }}>
            <ExercisePage block={b} focus={bi === exIdx ? focus : null} onEdit={openPad} hasNext={bi < blocks.length - 1} />
          </View>
        ))}
      </ScrollView>
      <View pointerEvents="none" style={s.dots}>
        {blocks.map((b, i) => <View key={i} style={{ width: 6, height: i === exIdx ? 14 : 6, borderRadius: 3, backgroundColor: i === exIdx ? t.accent : b.sets.length > 0 && b.sets.every((x) => x.done) ? t.green : t.dim }} />)}
      </View>

      {/* The deck: everything you press between sets, raised off the page and running under the dock. */}
      <View style={[s.deck, { backgroundColor: t.card, borderColor: t.line, marginBottom: -(insets.bottom + DOCK_HEIGHT), paddingBottom: insets.bottom + DOCK_HEIGHT + 10 }]}>
        <div
          onPointerDown={(e) => { grab.current = e.clientY; }}
          // Tap the grip to toggle, or drag it: down hides, up shows. The Hide/Keypad label does the same for keyboards.
          onPointerUp={(e) => { const dy = e.clientY - (grab.current ?? e.clientY); grab.current = null; setPadOpen(Math.abs(dy) > 24 ? dy < 0 : !padOpen); }}
          aria-hidden
          style={{ alignSelf: 'stretch', alignItems: 'center', paddingTop: 10, paddingBottom: 14, marginTop: -10, marginBottom: -6, cursor: 'pointer', touchAction: 'none' }}
        >
          <View style={[s.grip, { backgroundColor: t.line }]} />
        </div>
        <View style={s.nav}>
          <Label color={t.mute} numberOfLines={1} style={{ flex: 1 }}>
            {blocks[exIdx + 1] ? `↓ Next · ${blocks[exIdx + 1].exercise.name}` : 'Last exercise'}
          </Label>
          <Pressable onPress={onRest} hitSlop={10} style={[s.chip, { borderColor: t.accent }]}>
            <Label color={t.accent}>◷ Rest</Label>
          </Pressable>
          <Pressable onPress={() => setPadOpen(!padOpen)} hitSlop={10}>
            <Label color={t.accent}>{padOpen ? 'Hide ⌄' : 'Keypad ⌃'}</Label>
          </Pressable>
        </View>
        {padOpen && <div className="deck-in"><Numpad onKey={onKey} onDone={onDone} doneLabel={doneLabel} surface="card" /></div>}
      </View>
      {trends && <TrendSheet block={block} onClose={() => setTrends(false)} onSwap={() => router.push('/routines/pick?session=swap')} onAdd={() => router.push('/routines/pick?session=add')} />}
      <EndMenu open={ending} onClose={() => setEnding(false)} done={doneSets} total={totalSets} />
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 16, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 4, gap: 12 },
  card: { padding: 12, borderRadius: 16, borderWidth: 1, gap: 4 },
  peek: { position: 'absolute', left: 14, right: 14, top: 12, bottom: 0, borderRadius: 16, borderWidth: 1, opacity: 0.8 },
  deck: { marginHorizontal: -16, paddingHorizontal: 16, paddingTop: 10, gap: 12, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  grip: { width: 36, height: 4, borderRadius: 2 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, minHeight: 44 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  actions: { flexDirection: 'row', gap: 24, paddingHorizontal: 12, paddingVertical: 10 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
  chip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  clockLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dots: { position: 'absolute', right: 16, top: '38%', gap: 6, alignItems: 'center' },
});
