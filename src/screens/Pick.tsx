import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from '../rn';
import { router, useLocalSearchParams } from '../lib/nav';
import { useSafeAreaInsets } from '../lib/insets';
import { addRoutineExercise, allExercises, createExercise, exerciseById, replaceRoutineExercise, routineExerciseRows } from '../db/queries';
import { searchLibrary, type LibraryEntry } from '../lib/library';
import type { Exercise } from '../db';
import { fonts, useTheme, useTopInset } from '../lib/theme';
import { groupVariants, movementFor } from '../lib/variants';
import { Doto, Label } from '../components/Text';
import { DOCK_HEIGHT } from '../components/Dock';
import { useWorkout } from '../store/workout';
import { useUi } from '../store/ui';

export default function PickExercise() {
  const { routine, replace, session, log } = useLocalSearchParams<{ routine?: string; replace?: string; session?: 'add' | 'swap'; log?: string }>();
  const addToSession = useWorkout((s) => s.addExercise);
  const blocks = useWorkout((s) => s.blocks);
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const top = useTopInset();
  const [all, setAll] = useState<Exercise[]>([]);
  const [have, setHave] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    allExercises().then(setAll);
    if (routine) routineExerciseRows(routine).then((rows) => setHave(new Set(rows.map((r) => r.id))));
    else setHave(new Set(blocks.map((b) => b.exercise.id)));
  }, [routine]);

  const pick = async (e: Exercise) => {
    // `log` means we came from a finished session's review screen, which opens the
    // numpad for the chosen exercise once we pop back to it.
    if (log) useUi.getState().setPendingExercise(e.id);
    else if (session) await addToSession(e, session === 'swap');
    else if (replace) await replaceRoutineExercise(replace, e.id);
    else if (routine) await addRoutineExercise(routine, e.id);
    router.back();
  };

  const fromLibrary = async (e: LibraryEntry) => {
    const id = await createExercise({ name: e.name, brand: '', movement: movementFor(e.name, e.muscle, all), primary_muscle: e.muscle, equipment: e.equipment, secondary_muscles: e.secondary, library_id: e.id, load: e.equipment === 'bodyweight' ? 'bodyweight' : 'weight' });
    const ex = await exerciseById(id);
    if (ex) await pick(ex);
  };

  const needle = q.trim().toLowerCase();
  const haveLib = new Set(all.map((e) => e.library_id));
  const fromLib = searchLibrary(needle, 12).filter((e) => !haveLib.has(e.id));
  const list = all.filter((e) => !have.has(e.id) && (!needle || e.name.toLowerCase().includes(needle) || e.primary_muscle.includes(needle)));

  let lastMuscle = '';
  return (
    <ScrollView style={{ backgroundColor: t.bg }} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.page, { paddingTop: top + 12, paddingBottom: insets.bottom + DOCK_HEIGHT + 12 }]}>
      <View style={s.head}>
        <Doto size={32}>{replace || session === 'swap' ? 'SWAP WITH' : 'ADD EXERCISE'}</Doto>
        <Pressable onPress={() => router.back()} hitSlop={12}><Label color={t.accent}>Cancel</Label></Pressable>
      </View>
      <TextInput value={q} onChangeText={setQ} placeholder="search" placeholderTextColor={t.dim} autoCorrect={false} style={[s.search, { color: t.text, borderColor: t.line, backgroundColor: t.card }]} />
      {groupVariants(list).map((g) => {
        const header = g.muscle !== lastMuscle ? g.muscle : null;
        lastMuscle = g.muscle;
        const many = g.items.length > 1;
        const expanded = open === g.key;
        return (
          <View key={g.key}>
            {header && <Label style={s.section}>{header}</Label>}
            <Pressable onPress={() => (many ? setOpen(expanded ? null : g.key) : pick(g.items[0]))} style={({ pressed }) => [s.row, { borderBottomColor: t.line, opacity: pressed ? 0.7 : 1 }]}>
              <Doto size={20} style={{ flex: 1 }}>{g.base.toUpperCase()}</Doto>
              <Label color={many ? t.accent : t.dim}>{many ? `${g.items.length} variants` : g.items[0].equipment}</Label>
              <Label color={t.dim}>{many ? (expanded ? '▾' : '▸') : '›'}</Label>
            </Pressable>
            {expanded && g.items.map((e) => (
              <Pressable key={e.id} onPress={() => pick(e)} style={({ pressed }) => [s.row, s.sub, { borderBottomColor: t.line, opacity: pressed ? 0.7 : 1 }]}>
                <Doto size={16} style={{ flex: 1 }}>{e.name.toUpperCase()}</Doto>
                <Label color={t.dim}>{e.equipment}</Label>
                <Label color={t.dim}>›</Label>
              </Pressable>
            ))}
          </View>
        );
      })}
      {fromLib.length > 0 && <Label style={s.section}>library</Label>}
      {fromLib.map((e) => (
        <Pressable key={e.id} onPress={() => fromLibrary(e)} style={({ pressed }) => [s.row, { borderBottomColor: t.line, opacity: pressed ? 0.7 : 1 }]}>
          <Label color={t.text} style={{ flex: 1 }}>{e.name}</Label>
          <Label color={t.dim}>{e.muscle} · {e.equipment}</Label>
          <Label color={t.accent}>+</Label>
        </Pressable>
      ))}
      {routine && <Pressable onPress={() => router.push(`/exercise/new?routine=${routine}`)} style={({ pressed }) => [s.add, { borderColor: t.line, opacity: pressed ? 0.7 : 1 }]}>
        <Label color={t.accent}>+ New exercise</Label>
      </Pressable>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 16 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 4, paddingBottom: 12 },
  search: { fontFamily: fonts.mono, fontSize: 14, padding: 12, borderWidth: 1, borderRadius: 10 },
  section: { paddingHorizontal: 4, paddingTop: 18, paddingBottom: 4 },
  add: { marginTop: 16, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: 18, alignItems: 'center' },
  sub: { paddingLeft: 24, minHeight: 44 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, minHeight: 52 },
});
