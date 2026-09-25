import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from '../rn';
import { router, useFocusEffect, useLocalSearchParams } from '../lib/nav';
import { useSafeAreaInsets } from '../lib/insets';
import { listRoutines, removeRoutineExercise, renameRoutine, reorderRoutine, routineExerciseRows, setTargetSets, type RoutineExercise } from '../db/queries';
import { fonts, useTheme, useTopInset } from '../lib/theme';
import { Doto, Label } from '../components/Text';
import { DOCK_HEIGHT } from '../components/Dock';
import { DragRow, ROW_H, useDragList } from '../components/DragRow';

export default function RoutineEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const top = useTopInset();
  const [name, setName] = useState('');
  const [plan, setPlan] = useState('');
  const [rows, setRows] = useState<RoutineExercise[]>([]);
  const [dragging, setDragging] = useState(false);
  const drag = useDragList();

  const load = async () => {
    setRows(await routineExerciseRows(id));
    const r = (await listRoutines()).find((x) => x.id === id);
    setName(r?.name ?? '');
    setPlan(r?.plan ?? '');
  };
  useFocusEffect(useCallback(() => { load(); }, [id]));

  const grab = () => { setDragging(true); };
  const drop = async (from: number, to: number) => {
    setDragging(false);
    if (from === to) return;
    const next = [...rows];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setRows(next);

    await reorderRoutine(next.map((r) => r.re_id));
  };

  const sets = async (r: RoutineExercise, d: -1 | 1) => {
    const n = Math.max(1, Math.min(10, r.target_sets + d));
    if (n === r.target_sets) return;
    setRows(rows.map((x) => (x.re_id === r.re_id ? { ...x, target_sets: n } : x)));

    await setTargetSets(r.re_id, n);
  };

  const confirmRemove = (r: RoutineExercise) =>
    Alert.alert(r.name, 'Replace keeps its slot and set count.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Replace', onPress: () => router.push(`/routines/pick?routine=${id}&replace=${r.re_id}`) },
      { text: 'Remove', style: 'destructive', onPress: async () => { await removeRoutineExercise(r.re_id); load(); } },
    ]);

  return (
    <ScrollView style={{ backgroundColor: t.bg }} scrollEnabled={!dragging} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.page, { paddingTop: top + 12, paddingBottom: insets.bottom + DOCK_HEIGHT + 12 }]}>
      <View style={s.head}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Label color={t.accent}>‹ {plan || 'Routines'}</Label></Pressable>
        <Label>{rows.length} exercises</Label>
      </View>

      <Label style={s.section}>Day name</Label>
      <TextInput
        value={name}
        onChangeText={setName}
        onEndEditing={() => renameRoutine(id, name.trim() || 'Untitled', plan.trim())}
        selectTextOnFocus
        returnKeyType="done"
        style={[s.name, { color: t.text, borderBottomColor: t.line }]}
      />

      <Label style={s.section}>Exercises</Label>
      {rows.length === 0 && <Label color={t.dim} style={{ paddingHorizontal: 4 }}>Empty. Add one below.</Label>}
      {rows.map((r, i) => (
        <DragRow key={r.re_id} index={i} count={rows.length} drag={drag} onDrop={drop} onGrab={grab}>
        <Pressable onPress={() => router.push(`/exercise/${r.id}`)} onLongPress={() => confirmRemove(r)} style={[s.row, { borderBottomColor: t.line, backgroundColor: t.bg }]}>
          <View style={{ flex: 1, gap: 4 }}>
            <Doto size={20} numberOfLines={1}>{r.name.toUpperCase()}</Doto>
            <Label color={t.dim}>{r.primary_muscle} · {r.target_rep_min}–{r.target_rep_max} reps</Label>
          </View>
          <View style={s.stepper}>
            <Pressable onPress={() => sets(r, -1)} hitSlop={8} style={s.key}><Doto size={20} color={t.mute}>−</Doto></Pressable>
            <Doto size={22}>{r.target_sets}</Doto>
            <Pressable onPress={() => sets(r, 1)} hitSlop={8} style={s.key}><Doto size={20} color={t.mute}>+</Doto></Pressable>
          </View>
          <View style={{ width: 32 }} />
        </Pressable>
        </DragRow>
      ))}
      <Label color={t.dim} style={{ paddingHorizontal: 4, paddingTop: 8 }}>Tap for detail · drag ≡ · hold to replace or remove</Label>

      <Pressable onPress={() => router.push(`/routines/pick?routine=${id}`)} style={({ pressed }) => [s.add, { borderColor: t.line, opacity: pressed ? 0.7 : 1 }]}>
        <Label color={t.accent}>+ Add exercise</Label>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 16 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, paddingBottom: 12 },
  section: { paddingHorizontal: 4, paddingTop: 18, paddingBottom: 8 },
  name: { fontFamily: fonts.doto, fontSize: 32, paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 4, borderBottomWidth: 1, height: ROW_H },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  key: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  add: { marginTop: 16, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: 18, alignItems: 'center' },
});
