import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from '../rn';
import { router } from '../lib/nav';
import { useSafeAreaInsets } from '../lib/insets';
import { useTheme, useTopInset } from '../lib/theme';
import { fmtClock } from '../lib/format';
import { useWorkout } from '../store/workout';
import { Doto, Label } from '../components/Text';
import { DOCK_HEIGHT } from '../components/Dock';
import { DragRow, ROW_H, useDragList } from '../components/DragRow';

/** Session overview: exercise order, progress, add/swap/remove. Tap a row to log it. */
export default function Session() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const top = useTopInset();
  const blocks = useWorkout((st) => st.blocks);
  const sessionId = useWorkout((st) => st.sessionId);
  const title = useWorkout((st) => st.title);
  const startedAt = useWorkout((st) => st.startedAt);
  const exIdx = useWorkout((st) => st.exIdx);
  const w = useWorkout.getState();
  const [dragging, setDragging] = useState(false);
  const drag = useDragList();
  const [now] = useState(Date.now());

  if (blocks.length === 0) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  const started = sessionId !== null;
  const open = async (i: number) => { if (!started) await w.begin(); w.setExercise(i); router.push('/workout'); };
  const menu = (i: number) => {
    const b = blocks[i];
    Alert.alert(b.exercise.name, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Swap', onPress: () => { w.setExercise(i); router.push('/routines/pick?session=swap'); } },
      { text: 'Remove', style: 'destructive', onPress: () => w.removeExercise(i) },
    ]);
  };
  const add = () => { w.setExercise(blocks.length - 1); router.push('/routines/pick?session=add'); };
  const finish = () => started ? Alert.alert('End session?', `${done} of ${total} sets logged.`, [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Cancel session', style: 'destructive', onPress: async () => { await w.cancel(); router.dismissTo('/'); } },
      { text: 'Finish', onPress: async () => { const id = await w.finish(); if (id) router.dismissTo('/', `/history/${id}?done=1`); else router.dismissTo('/'); } },
    ]) : (w.cancel(), router.dismissTo('/'));
  const done = blocks.reduce((n, b) => n + b.sets.filter((x) => x.done).length, 0);
  const total = blocks.reduce((n, b) => n + b.sets.length, 0);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
    <ScrollView scrollEnabled={!dragging} contentContainerStyle={[s.page, { paddingTop: top + 12, paddingBottom: insets.bottom + DOCK_HEIGHT + (started ? 12 : 104) }]}>
      <View style={s.head}>
        <View style={{ flex: 1, gap: 4 }}>
          <Label color={started ? t.mute : t.accent}>{started ? `${fmtClock((now - startedAt) / 1000)} elapsed` : 'Preview · not started'}</Label>
          <Doto size={36} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{title.toUpperCase()}</Doto>
        </View>
        <Pressable onPress={finish} hitSlop={10} style={{ alignItems: 'flex-end', gap: 4 }}>
          <Label color={t.accent}>{started ? 'Finish' : 'Discard'}</Label>
          <Doto size={22} color={t.mute}>{done}/{total}</Doto>
        </Pressable>
      </View>

      {blocks.map((b, i) => {
        const d = b.sets.filter((x) => x.done).length;
        const full = d === b.sets.length && b.sets.length > 0;
        const current = i === exIdx;
        return (
          <DragRow key={b.exercise.id} index={i} count={blocks.length} drag={drag} onGrab={() => { setDragging(true); }} onDrop={(f, to) => { setDragging(false); if (f !== to) w.reorderExercises(f, to); }}>
            <Pressable onPress={() => open(i)} onLongPress={() => menu(i)} style={({ pressed }) => [s.row, { borderBottomColor: t.line, backgroundColor: t.bg, opacity: pressed ? 0.7 : 1 }]}>
              <Label color={current ? t.accent : t.dim} style={{ width: 22 }}>{String(i + 1).padStart(2, '0')}</Label>
              <Doto size={17} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8} color={full ? t.mute : t.text} style={{ flex: 1 }}>{b.exercise.name.toUpperCase()}</Doto>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                <Doto size={18} color={full ? t.green : t.mute}>{d}/{b.sets.length}</Doto>
                <Label color={full ? t.green : t.dim}>{b.sets.map((x) => (x.done ? '●' : '○')).join(' ')}</Label>
              </View>
              <View style={{ width: 36 }} />
            </Pressable>
          </DragRow>
        );
      })}
      <Label color={t.dim} style={{ paddingHorizontal: 4, paddingTop: 8 }}>Tap to log · drag ≡ · hold to swap or remove</Label>

      <Pressable onPress={add} style={({ pressed }) => [s.add, { borderColor: t.line, opacity: pressed ? 0.7 : 1 }]}>
        <Label color={t.accent}>+ Add exercise</Label>
      </Pressable>
    </ScrollView>
    {!started && <View pointerEvents="none" style={[s.backing, { backgroundColor: t.bg, height: insets.bottom + DOCK_HEIGHT + 8 + 68 + 14 }]} />}
    {!started && (
      <Pressable
        onPress={async () => { await w.begin(); open(0); }}
        style={({ pressed }) => [s.start, { backgroundColor: t.accent, bottom: insets.bottom + DOCK_HEIGHT + 8, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
      >
        <Doto size={26} color={t.bg}>START</Doto>
        <Label color={t.bg}>{blocks.length} exercises · {total} sets</Label>
      </Pressable>
    )}
    </View>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 16 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 4, paddingBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, borderBottomWidth: 1, height: ROW_H },
  start: { position: 'absolute', left: 16, right: 16, height: 68, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22 },
  backing: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  add: { marginTop: 16, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: 18, alignItems: 'center' },
});
