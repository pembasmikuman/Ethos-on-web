import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from '../rn';
import { router, useFocusEffect, useLocalSearchParams } from '../lib/nav';
import { useSafeAreaInsets } from '../lib/insets';
import type { Exercise } from '../db';
import { deleteExercise, duplicateExercise, exerciseById, exerciseHistory, setExerciseNotes, updateExercise, type ExerciseSettings } from '../db/queries';
import { epley1RM } from '../lib/progression';
import { fmtKg } from '../lib/format';
import { fonts, useTheme, useTopInset } from '../lib/theme';
import { Doto, Label } from '../components/Text';
import { DotTrend } from '../components/DotTrend';
import { DOCK_HEIGHT } from '../components/Dock';
import { libraryEntry } from '../lib/library';
import type { Progression } from '../db';

const RULES: [Progression, string][] = [['double', 'double'], ['linear', 'linear'], ['greyskull', 'greyskull']];
const RULE_HINT: Record<Progression, string> = {
  double: 'All sets at rep max with RIR, then add weight',
  linear: 'All sets at rep min, then add weight every session',
  greyskull: 'Last set AMRAP. 2x min = double jump. Miss = -10 %',
};

type Hist = Awaited<ReturnType<typeof exerciseHistory>>;

function Stepper({ label, value, onChange }: { label: string; value: string; onChange: (d: -1 | 1) => void }) {
  const t = useTheme();
  const tap = (d: -1 | 1) => onChange(d);
  return (
    <View style={[s.setting, { borderBottomColor: t.line }]}>
      <Label style={{ flex: 1 }}>{label}</Label>
      <Pressable onPress={() => tap(-1)} hitSlop={8} style={s.key}><Doto size={20} color={t.mute}>−</Doto></Pressable>
      <Doto size={22} style={{ minWidth: 64, textAlign: 'center' }}>{value}</Doto>
      <Pressable onPress={() => tap(1)} hitSlop={8} style={s.key}><Doto size={20} color={t.mute}>+</Doto></Pressable>
    </View>
  );
}

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const top = useTopInset();
  const [ex, setEx] = useState<Exercise | null>(null);
  const [hist, setHist] = useState<Hist>([]);

  useFocusEffect(useCallback(() => {
    exerciseById(id).then(setEx);
    exerciseHistory(id).then(setHist);
  }, [id]));

  if (!ex) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  const patch = (p: Partial<ExerciseSettings>) => {
    const next = { ...ex, ...p };
    setEx(next);
    updateExercise(id, next);
  };

  const onMenu = () =>
    Alert.alert(ex.name, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Edit name · brand · muscle', onPress: () => router.push(`/exercise/new?edit=${id}`) },
      { text: 'Duplicate as variant', onPress: async () => { const nid = await duplicateExercise(id); router.push(`/exercise/new?edit=${nid}`); } },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (await deleteExercise(id)) router.back();
          else Alert.alert('Has history', 'Exercises with logged sets stay. Remove it from routines instead.');
        },
      },
    ]);

  const steps = libraryEntry(ex.library_id)?.steps ?? [];
  const best = hist.map((h) => Math.round(Math.max(...h.sets.map((x) => epley1RM(x.weight, x.reps, x.rir ?? 0))))).reverse();

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={[s.page, { paddingTop: top + 12, paddingBottom: insets.bottom + DOCK_HEIGHT + 12 }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 12 }}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Label color={t.accent}>‹ Back</Label></Pressable>
        <Pressable onPress={onMenu} hitSlop={12}><Label color={t.accent}>Edit</Label></Pressable>
      </View>
      <Doto size={32}>{ex.name.toUpperCase()}</Doto>
      {ex.brand !== '' && <Label color={t.accent} style={{ paddingTop: 4 }}>{ex.brand}</Label>}
      <Label style={{ paddingTop: 4 }}>{ex.primary_muscle}{ex.secondary_muscles ? ` · ${ex.secondary_muscles}` : ''} · {ex.equipment}</Label>
      <TextInput
        value={ex.notes}
        onChangeText={(notes) => setEx({ ...ex, notes })}
        onBlur={() => setExerciseNotes(id, ex.notes.trim())}
        placeholder="Note: seat 4, pin 7, wide grip. Shows during the workout."
        placeholderTextColor={t.dim}
        multiline
        style={[s.notes, { color: t.text, borderColor: t.line, backgroundColor: t.card }]}
      />

      <View style={[s.panel, { backgroundColor: t.card, borderColor: t.line }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Label>Est. 1RM · last {best.length}</Label>
          {best.length > 0 && <Doto size={22} color={t.accent}>{best[best.length - 1]} KG</Doto>}
        </View>
        {best.length > 0 ? <DotTrend values={best} unit="kg" /> : <Label color={t.dim}>No sessions yet.</Label>}
      </View>

      <Label style={s.section}>Settings</Label>
      <Stepper label="Rest" value={`${ex.default_rest_seconds}s`} onChange={(d) => patch({ default_rest_seconds: Math.max(30, ex.default_rest_seconds + d * 15) })} />
      <Stepper label="Increment" value={`${fmtKg(ex.increment_kg)} kg`} onChange={(d) => patch({ increment_kg: Math.max(0.5, ex.increment_kg + d * 0.5) })} />
      <Stepper label="Reps min" value={`${ex.target_rep_min}`} onChange={(d) => patch({ target_rep_min: Math.max(1, Math.min(ex.target_rep_max - 1, ex.target_rep_min + d)) })} />
      <Stepper label="Reps max" value={`${ex.target_rep_max}`} onChange={(d) => patch({ target_rep_max: Math.max(ex.target_rep_min + 1, ex.target_rep_max + d) })} />
      {ex.load !== 'bodyweight' && (
        <View style={[s.setting, { borderBottomColor: t.line, height: undefined, paddingVertical: 12, flexWrap: 'wrap' }]}>
          <Label style={{ flex: 1, minWidth: 90 }}>Rule</Label>
          {RULES.map(([r, label]) => (
            <Pressable key={r} onPress={() => patch({ progression: r })} style={[s.chip, { borderColor: ex.progression === r ? t.accent : t.line, backgroundColor: ex.progression === r ? t.accent : 'transparent' }]}>
              <Label color={ex.progression === r ? t.bg : t.mute}>{label}</Label>
            </Pressable>
          ))}
          <Label color={t.dim} size={10} style={{ width: '100%', paddingTop: 8 }}>{RULE_HINT[ex.progression]}</Label>
        </View>
      )}
      {(ex.load !== 'weight' || ex.per_side === 1) && <Label color={t.dim} style={{ paddingHorizontal: 4, paddingTop: 10 }}>{[ex.load === 'bodyweight' ? 'bodyweight, progress in reps' : ex.load === 'time' ? 'timed, seconds instead of reps' : '', ex.per_side === 1 ? 'reps per side' : ''].filter(Boolean).join(' · ')}</Label>}

      {steps.length > 0 && <Label style={s.section}>How</Label>}
      {steps.map((st, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 4, paddingVertical: 6 }}>
          <Doto size={14} color={t.accent}>{String(i + 1).padStart(2, '0')}</Doto>
          <Label color={t.mute} style={{ flex: 1 }}>{st}</Label>
        </View>
      ))}

      {hist.length > 0 && <Label style={s.section}>History</Label>}
      {hist.map((h) => (
        <Pressable key={h.session_id} onPress={() => router.push(`/history/${h.session_id}`)} style={({ pressed }) => [s.row, { borderBottomColor: t.line, opacity: pressed ? 0.7 : 1 }]}>
          <Label color={t.dim} style={{ width: 90 }}>{new Date(h.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</Label>
          <Doto size={18} style={{ flex: 1 }}>{h.sets.map((x) => `${fmtKg(x.weight)}×${x.reps}`).join('  ')}</Doto>
          <Label color={t.dim}>›</Label>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 16 },
  notes: { fontFamily: fonts.mono, fontSize: 14, lineHeight: 20, minHeight: 56, marginTop: 14, padding: 12, borderRadius: 12, borderWidth: 1, textAlignVertical: 'top' },
  panel: { marginTop: 18, borderWidth: 1, borderRadius: 14, padding: 16, gap: 14 },
  section: { paddingHorizontal: 4, paddingTop: 22, paddingBottom: 6 },
  setting: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, borderBottomWidth: 1, height: 56 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  key: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, paddingVertical: 12, borderBottomWidth: 1 },
});
