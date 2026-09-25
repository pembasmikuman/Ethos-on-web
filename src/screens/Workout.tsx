import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View, type ScrollViewHandle } from '../rn';
import { router } from '../lib/nav';
import { useSafeAreaInsets } from '../lib/insets';
import { useTheme, useTopInset } from '../lib/theme';
import { applyKey, fmtClock, fmtKg } from '../lib/format';
import { useWorkout } from '../store/workout';
import { Doto, Label } from '../components/Text';
import { Numpad } from '../components/Numpad';
import { SetRow } from '../components/SetRow';
import { DOCK_HEIGHT } from '../components/Dock';
import type { ExerciseBlock, Field } from '../store/workout';
import { Swipe } from '../components/Swipe';

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
  return (
    <Pressable
      onPress={() => (resting ? router.navigate('/rest') : onFinish())}
      hitSlop={10}
      style={{ alignItems: 'flex-end', gap: 4 }}
    >
      <View style={s.clockLabel}>
        {resting && <View style={[s.dot, { backgroundColor: t.accent }]} />}
        <Label color={resting ? t.accent : t.mute}>{resting ? 'Resting' : 'Elapsed'}</Label>
      </View>
      <Doto size={22} color={resting ? t.accent : t.mute}>{fmtClock(resting ? left : (now - startedAt) / 1000)}</Doto>
    </Pressable>
  );
}

type PageProps = { block: ExerciseBlock; focus: { setIdx: number; field: Field } | null; onEdit: () => void };

const ExercisePage = memo(function ExercisePage({ block, focus, onEdit }: PageProps) {
  const t = useTheme();
  const { addSet, removeSet, setFocus, setNotes } = useWorkout.getState();
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
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 4 }}>
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
              perSide={block.exercise.per_side === 1}
              active={focus != null && i === focus.setIdx}
              focusField={focus != null && i === focus.setIdx ? focus.field : null}
              onFocus={(f) => { setFocus(i, f); onEdit(); }}
            />
            </Swipe>
          );
        })}
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
  const pager = useRef<ScrollViewHandle>(null);
  const shown = useRef(exIdx);
  const openPad = useCallback(() => setPadOpen(true), []);

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
  const doneLabel = nextField() ? `Next · ${nextField()}` : 'Done · Start rest';
  const onFinish = () =>
    Alert.alert('End workout?', 'Finish saves it. Cancel deletes every set logged this session.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Cancel session', style: 'destructive', onPress: async () => { await useWorkout.getState().cancel(); router.dismissTo('/'); } },
      { text: 'Finish', onPress: async () => { const id = await useWorkout.getState().finish(); if (id) router.dismissTo('/', `/history/${id}?done=1`); else router.dismissTo('/'); } },
    ]);

  const onExerciseMenu = () =>
    Alert.alert(block.exercise.name, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Add exercise after', onPress: () => router.push('/routines/pick?session=add') },
      { text: 'Swap this exercise', onPress: () => router.push('/routines/pick?session=swap') },
    ]);

  return (
    <View style={[s.page, { backgroundColor: t.bg, paddingTop: top + 8, paddingBottom: insets.bottom + DOCK_HEIGHT }]}>
      <View style={s.head}>
        <View style={{ gap: 4, flex: 1 }}>
          <Pressable onPress={() => router.navigate('/session')} hitSlop={8}><Label color={t.accent}>‹ {title} · {exIdx + 1} / {blocks.length}</Label></Pressable>
          <Pressable onPress={onExerciseMenu} hitSlop={8}>
            <Doto size={30} numberOfLines={1}>{block.exercise.name.toUpperCase()}</Doto>
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
            <ExercisePage block={b} focus={bi === exIdx ? focus : null} onEdit={openPad} />
          </View>
        ))}
      </ScrollView>
      <View pointerEvents="none" style={s.dots}>
        {blocks.map((b, i) => <View key={i} style={{ width: 6, height: i === exIdx ? 14 : 6, borderRadius: 3, backgroundColor: i === exIdx ? t.accent : b.sets.length > 0 && b.sets.every((x) => x.done) ? t.green : t.dim }} />)}
      </View>

      <View style={s.nav}>
        <Label color={t.dim} numberOfLines={1} style={{ flex: 1 }}>
          {blocks[exIdx + 1] ? `↓ Next · ${blocks[exIdx + 1].exercise.name}` : 'Last exercise'}
        </Label>
        <Pressable onPress={() => setPadOpen(!padOpen)} hitSlop={10}>
          <Label color={t.accent}>{padOpen ? 'Hide keypad ⌄' : 'Keypad ⌃'}</Label>
        </Pressable>
      </View>

      {padOpen && <Numpad onKey={onKey} onDone={onDone} doneLabel={doneLabel} />}
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 16, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 4, gap: 12 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, minHeight: 44 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  actions: { flexDirection: 'row', gap: 24, paddingHorizontal: 12, paddingVertical: 10 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
  clockLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dots: { position: 'absolute', right: 16, top: '38%', gap: 6, alignItems: 'center' },
});
