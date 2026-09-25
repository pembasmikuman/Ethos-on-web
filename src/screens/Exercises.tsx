import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from '../rn';
import { router, useFocusEffect } from '../lib/nav';
import { useSafeAreaInsets } from '../lib/insets';
import { allExercises } from '../db/queries';
import type { Exercise } from '../db';
import { fonts, useTheme, useTopInset } from '../lib/theme';
import { groupVariants } from '../lib/variants';
import { Doto, Label } from '../components/Text';
import { DOCK_HEIGHT } from '../components/Dock';

const MUSCLES = ['chest', 'back', 'quads', 'hamstrings', 'glutes', 'delts', 'biceps', 'triceps', 'calves', 'abs'];
const EQUIPMENT = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'];

export default function Exercises() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const top = useTopInset();
  const [all, setAll] = useState<Exercise[]>([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [muscle, setMuscle] = useState('');
  const [gear, setGear] = useState('');

  useFocusEffect(useCallback(() => { allExercises().then(setAll); }, []));

  const needle = q.trim().toLowerCase();
  const list = all.filter((e) => (!muscle || e.primary_muscle === muscle) && (!gear || e.equipment === gear) && (!needle || e.name.toLowerCase().includes(needle)));
  const chips = (options: string[], value: string, set: (v: string) => void) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.chips}>
      {['all', ...options].map((o) => {
        const on = (o === 'all' ? '' : o) === value;
        return (
          <Pressable key={o} onPress={() => set(o === 'all' ? '' : o)} style={[s.chip, { borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accent : t.card }]}>
            <Label color={on ? t.bg : t.mute}>{o}</Label>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  const goTo = (e: Exercise) => router.push(`/exercise/${e.id}`);
  let lastMuscle = '';
  return (
    <ScrollView style={{ backgroundColor: t.bg }} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.page, { paddingTop: top + 12, paddingBottom: insets.bottom + DOCK_HEIGHT + 12 }]}>
      <View style={s.head}>
        <Doto size={40}>MOVES</Doto>
        <Pressable onPress={() => router.push('/exercise/new')} hitSlop={12} style={[s.newBtn, { backgroundColor: t.accent }]}><Label color={t.bg}>+ New</Label></Pressable>
      </View>
      <TextInput value={q} onChangeText={setQ} placeholder="search" placeholderTextColor={t.dim} autoCorrect={false} style={[s.search, { color: t.text, borderColor: t.line, backgroundColor: t.card }]} />
      {chips(MUSCLES, muscle, setMuscle)}
      {chips(EQUIPMENT, gear, setGear)}
      {list.length === 0 && <Label color={t.dim} style={{ paddingHorizontal: 4, paddingTop: 18 }}>Nothing matches.</Label>}
      {groupVariants(list).map((g) => {
        const header = g.muscle !== lastMuscle ? g.muscle : null;
        lastMuscle = g.muscle;
        const many = g.items.length > 1;
        const expanded = open === g.key;
        return (
          <View key={g.key}>
            {header && <Label style={s.section}>{header}</Label>}
            <Pressable onPress={() => (many ? setOpen(expanded ? null : g.key) : goTo(g.items[0]))} style={({ pressed }) => [s.row, { borderBottomColor: t.line, opacity: pressed ? 0.7 : 1 }]}>
              <Doto size={20} style={{ flex: 1 }}>{g.base.toUpperCase()}</Doto>
              <Label color={many ? t.accent : t.dim}>{many ? `${g.items.length} variants` : g.items[0].equipment}</Label>
              <Label color={t.dim}>{many ? (expanded ? '▾' : '▸') : '›'}</Label>
            </Pressable>
            {expanded && g.items.map((e) => (
              <Pressable key={e.id} onPress={() => goTo(e)} style={({ pressed }) => [s.row, s.sub, { borderBottomColor: t.line, opacity: pressed ? 0.7 : 1 }]}>
                <Doto size={16} style={{ flex: 1 }}>{e.name.toUpperCase()}</Doto>
                <Label color={t.dim}>{e.equipment}</Label>
                <Label color={t.dim}>›</Label>
              </Pressable>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 16 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 4, paddingBottom: 12 },
  newBtn: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 4 },
  search: { fontFamily: fonts.mono, fontSize: 14, padding: 12, borderWidth: 1, borderRadius: 10 },
  chips: { flexDirection: 'row', gap: 8, paddingTop: 10, paddingHorizontal: 2 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  section: { paddingHorizontal: 4, paddingTop: 18, paddingBottom: 4 },
  sub: { paddingLeft: 24, minHeight: 44 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, minHeight: 52 },
});
