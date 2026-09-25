import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from '../rn';
import { router, useLocalSearchParams } from '../lib/nav';
import { useSafeAreaInsets } from '../lib/insets';
import { addRoutineExercise, allExercises, createExercise, duplicateExercise, exerciseById, renameExercise } from '../db/queries';
import { fonts, useTheme, useTopInset } from '../lib/theme';
import { Doto, Label } from '../components/Text';
import { DOCK_HEIGHT } from '../components/Dock';
import { searchLibrary, type LibraryEntry } from '../lib/library';
import type { Exercise, Load } from '../db';
import { movementFor } from '../lib/variants';

const MUSCLES = ['chest', 'back', 'quads', 'hamstrings', 'glutes', 'delts', 'biceps', 'triceps', 'calves', 'abs'];
const EQUIPMENT = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'];
const LOADS: Load[] = ['weight', 'bodyweight', 'time'];

function Chips({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  const t = useTheme();
  return (
    <View style={s.chips}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable key={o} onPress={() => onChange(o)} style={[s.chip, { borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accent : t.card }]}>
            <Label color={on ? t.bg : t.mute}>{o}</Label>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function NewExercise() {
  const { routine, edit } = useLocalSearchParams<{ routine?: string; edit?: string }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const top = useTopInset();
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [movement, setMovement] = useState('');
  const [muscle, setMuscle] = useState('chest');
  const [equipment, setEquipment] = useState('barbell');
  const [load, setLoad] = useState<Load>('weight');
  const [perSide, setPerSide] = useState(false);
  const [lib, setLib] = useState<LibraryEntry | null>(null);
  const [all, setAll] = useState<Exercise[]>([]);
  const ok = name.trim().length > 0;
  const suggestions = !edit && !lib ? searchLibrary(name, 6) : [];

  const fromLibrary = (e: LibraryEntry) => {
    setLib(e);
    setName(e.name);
    // Library names carry their gear, so file it under the bare move and next to anything
    // already there, keeping the Moves list one row per move.
    setMovement(movementFor(e.name, e.muscle, all));
    setMuscle(e.muscle);
    setEquipment(e.equipment);
    setLoad(e.equipment === 'bodyweight' ? 'bodyweight' : 'weight');
  };

  useEffect(() => {
    allExercises().then(setAll);
  }, []);

  useEffect(() => {
    if (!edit) return;
    exerciseById(edit).then((e) => { if (e) { setName(e.name); setBrand(e.brand); setMovement(e.movement); setMuscle(e.primary_muscle); setEquipment(e.equipment ?? 'barbell'); setLoad(e.load); setPerSide(e.per_side === 1); } });
  }, [edit]);

  const save = async () => {
    if (!ok) return;
    const identity = { name: name.trim(), brand: brand.trim(), movement: movement.trim(), primary_muscle: muscle, equipment, load, per_side: perSide ? 1 : 0, library_id: lib?.id ?? '', secondary_muscles: lib?.secondary ?? '' };
    if (edit) {
      await renameExercise(edit, identity);
      router.back();
      return;
    }
    const id = await createExercise(identity);
    if (routine) {
      await addRoutineExercise(routine, id);
      router.dismiss(2);
    } else router.replace(`/exercise/${id}`);
  };

  return (
    <ScrollView style={{ backgroundColor: t.bg }} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.page, { paddingTop: top + 12, paddingBottom: insets.bottom + DOCK_HEIGHT + 12 }]}>
      <View style={s.head}>
        <Doto size={32}>{edit ? 'EDIT' : 'NEW EXERCISE'}</Doto>
        <Pressable onPress={() => router.back()} hitSlop={12}><Label color={t.accent}>Cancel</Label></Pressable>
      </View>
      <Label style={s.section}>Name</Label>
      <TextInput value={name} onChangeText={(v) => { setName(v); setLib(null); }} autoFocus placeholder="e.g. Pendlay row" placeholderTextColor={t.dim} style={[s.name, { color: t.text, borderBottomColor: t.line }]} />
      {suggestions.map((e) => (
        <Pressable key={e.id} onPress={() => fromLibrary(e)} style={({ pressed }) => [s.suggest, { borderBottomColor: t.line, opacity: pressed ? 0.7 : 1 }]}>
          <Label color={t.text} style={{ flex: 1 }}>{e.name}</Label>
          <Label color={t.dim}>{e.muscle} · {e.equipment}</Label>
        </Pressable>
      ))}
      {lib && <Label color={t.accent} style={{ paddingHorizontal: 4, paddingTop: 6 }}>From library · instructions included</Label>}
      <Label style={s.section}>Movement group · optional</Label>
      <TextInput value={movement} onChangeText={setMovement} placeholder="e.g. Chest Press" placeholderTextColor={t.dim} autoCapitalize="words" style={[s.brand, { color: t.text, borderBottomColor: t.line }]} />
      <Label style={s.section}>Brand · optional</Label>
      <TextInput value={brand} onChangeText={setBrand} placeholder="e.g. Technogym, Hammer" placeholderTextColor={t.dim} autoCapitalize="words" style={[s.brand, { color: t.text, borderBottomColor: t.line }]} />
      <Label style={s.section}>Primary muscle</Label>
      <Chips options={MUSCLES} value={muscle} onChange={setMuscle} />
      <Label style={s.section}>Equipment</Label>
      <Chips options={EQUIPMENT} value={equipment} onChange={setEquipment} />
      <Label style={s.section}>Logged as</Label>
      <Chips options={LOADS} value={load} onChange={(v) => setLoad(v as Load)} />
      <Pressable onPress={() => setPerSide((v) => !v)} style={[s.toggle, { borderBottomColor: t.line }]}>
        <Label style={{ flex: 1 }}>Reps per side</Label>
        <Label color={perSide ? t.accent : t.dim}>{perSide ? 'on' : 'off'}</Label>
      </Pressable>
      <Pressable onPress={save} disabled={!ok} style={({ pressed }) => [s.save, { backgroundColor: ok ? t.accent : t.card, borderColor: ok ? t.accent : t.line, opacity: pressed ? 0.85 : 1 }]}>
        <Label color={ok ? t.bg : t.dim}>{edit ? 'Save' : 'Save · defaults 120s · 8–12 · 2.5 kg'}</Label>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 16 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 4, paddingBottom: 4 },
  section: { paddingHorizontal: 4, paddingTop: 18, paddingBottom: 8 },
  name: { fontFamily: fonts.doto, fontSize: 28, paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1 },
  brand: { fontFamily: fonts.mono, fontSize: 16, paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggest: { flexDirection: 'row', gap: 8, paddingHorizontal: 4, paddingVertical: 10, borderBottomWidth: 1 },
  toggle: { flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingHorizontal: 4, paddingVertical: 12, borderBottomWidth: 1 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  save: { marginTop: 28, borderWidth: 1, borderRadius: 12, padding: 18, alignItems: 'center' },
});
