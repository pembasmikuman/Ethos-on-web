import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from '../rn';
import { router, useLocalSearchParams } from '../lib/nav';
import { useSafeAreaInsets } from '../lib/insets';
import { deleteSession, deleteSet, exerciseById, insertSet, sessionById, sessionSets, setSessionNotes, updateSet, type SessionRow } from '../db/queries';
import { useTheme, useTopInset } from '../lib/theme';
import { applyKey, fmtKg } from '../lib/format';
import { epley1RM, weeklyVolume } from '../lib/progression';
import { BodyMap } from '../components/BodyMap';
import { fonts } from '../lib/theme';
import { Doto, Label } from '../components/Text';
import { Numpad } from '../components/Numpad';
import { DOCK_HEIGHT } from '../components/Dock';
import { sessionMeta } from './History';
import { useUi } from '../store/ui';

type SetRow = Awaited<ReturnType<typeof sessionSets>>[number];
type Field = 'weight' | 'reps' | 'rir';
/** A set being edited, or, when `id` is null, a new set being typed in. */
type Edit = { id: string | null; exercise_id: string; name: string; warmup: boolean; field: Field; weight: string; reps: string; rir: string };
type Group = { name: string; exercise_id: string; target: number; notes: string; sets: SetRow[] };

export default function SessionDetail() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const top = useTopInset();
  const { id, done } = useLocalSearchParams<{ id: string; done?: string }>();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [sets, setSets] = useState<SetRow[]>([]);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [notes, setNotes] = useState('');

  const load = () => {
    sessionById(id).then((x) => { setSession(x); setNotes(x?.notes ?? ''); });
    sessionSets(id).then(setSets);
  };
  useEffect(load, [id]);

  const pending = useUi((s) => s.pendingExercise);
  const clearPending = useUi((s) => s.clearPendingExercise);
  const setDockHidden = useUi((s) => s.setDockHidden);
  useEffect(() => {
    setDockHidden(edit !== null);
    return () => setDockHidden(false);
  }, [edit !== null]);

  /** Type a brand new set for an exercise, weight prefilled from its last set here. */
  const beginNew = (exercise_id: string, name: string, weight = '') =>
    setEdit({ id: null, exercise_id, name, warmup: false, field: 'weight', weight, reps: '', rir: '' });

  // The picker hands the exercise back through the store, so pop back here and the
  // numpad is already open on set 1 of it.
  useEffect(() => {
    if (!pending) return;
    clearPending();
    exerciseById(pending).then((ex) => ex && beginNew(ex.id, ex.brand ? `${ex.name} · ${ex.brand}` : ex.name));
  }, [pending]);

  if (!session) return null;
  const { date, mins } = sessionMeta(session);

  const groups: Group[] = [];
  for (const s of sets) {
    let g = groups.find((x) => x.name === s.name);
    if (!g) groups.push((g = { name: s.name, exercise_id: s.exercise_id, target: s.target_rep_max, notes: s.notes, sets: [] }));
    g.sets.push(s);
  }
  // A brand new exercise has no sets yet, so give it a card of its own to be typed into.
  if (edit && edit.id === null && !groups.some((g) => g.exercise_id === edit.exercise_id)) {
    groups.push({ name: edit.name, exercise_id: edit.exercise_id, target: 0, notes: '', sets: [] });
  }

  const beginEdit = (x: SetRow, field: Field) =>
    setEdit({ id: x.id, exercise_id: x.exercise_id, name: x.name, warmup: x.set_type === 'warmup', field, weight: fmtKg(x.weight), reps: String(x.reps), rir: x.rir == null ? '' : String(x.rir) });

  const onKey = (k: string) => {
    if (!edit) return;
    if ((k === '+' || k === '-' || k === '.') && edit.field !== 'weight') return;
    setEdit({ ...edit, [edit.field]: applyKey(edit[edit.field], k, edit.field === 'weight' ? 5 : 2) });
  };

  const nextField = (): Field | null => {
    if (!edit) return null;
    if (edit.field === 'weight') return 'reps';
    if (edit.field === 'reps' && !edit.warmup) return 'rir';
    return null;
  };

  const onDone = async () => {
    if (!edit) return;
    if (edit.field === 'weight' && edit.weight === '') return;
    const nf = nextField();
    if (nf) return setEdit({ ...edit, field: nf });
    const weight = parseFloat(edit.weight);
    const reps = parseInt(edit.reps, 10);
    if (Number.isNaN(weight) || Number.isNaN(reps)) return;
    const rir = edit.rir === '' ? null : parseInt(edit.rir, 10);
    if (edit.id) await updateSet(edit.id, weight, reps, rir);
    else {
      const n = sets.filter((x) => x.exercise_id === edit.exercise_id && x.set_type === 'working').length;
      await insertSet({ session_id: id, exercise_id: edit.exercise_id, set_number: n + 1, set_type: 'working', weight, reps, rir });
    }

    setEdit(null);
    load();
  };

  const confirmDeleteSet = (x: SetRow) =>
    Alert.alert('Delete set?', `${x.name} · ${fmtKg(x.weight)} kg × ${x.reps}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteSet(x.id); setEdit(null); load(); } },
    ]);

  const confirmDeleteSession = () =>
    Alert.alert('Delete session?', `Removes all ${session.sets} sets.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteSession(session.id); router.back(); } },
    ]);

  const cell = (x: SetRow, field: Field, value: string, unit: string, color: string) => {
    const on = edit?.id === x.id && edit.field === field;
    const shown = edit?.id === x.id ? edit[field] || '–' : value;
    return (
      <Pressable onPress={() => (edit?.id === x.id ? setEdit({ ...edit, field }) : beginEdit(x, field))} style={st.cell} hitSlop={6}>
        <Doto size={22} color={on ? t.accent : color}>{shown}</Doto><Label color={t.dim}>{unit}</Label>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={[st.page, { paddingTop: top + 12, paddingBottom: (edit ? 12 : insets.bottom + DOCK_HEIGHT + 12) }]}>
        <Pressable onPress={() => edit && setEdit(null)} style={StyleSheet.absoluteFill} />
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ paddingHorizontal: 4, minHeight: 44, justifyContent: 'center' }}>
          <Label color={t.text}>{done ? '‹ Done' : '‹ History'}</Label>
        </Pressable>
        <View style={st.head}>
          <Doto size={34}>{session.title.toUpperCase()}</Doto>
          <Label>{date} · {mins} min · {session.sets} sets · {fmtKg(Math.round(session.volume_kg))} kg</Label>
          <Label color={t.dim}>Tap a number to edit · hold a set to delete</Label>
        </View>
        <View style={[st.card, { backgroundColor: t.card, borderColor: t.line }]}>
          <BodyMap load={weeklyVolume(sets)} height={150} />
        </View>

        <TextInput
          value={notes}
          onChangeText={setNotes}
          onBlur={() => setSessionNotes(id, notes.trim())}
          placeholder="How did it go? Notes stay with this session."
          placeholderTextColor={t.dim}
          multiline
          style={[st.notes, { color: t.text, borderColor: t.line, backgroundColor: t.card }]}
        />

        {groups.map((g) => {
          const best = Math.max(...g.sets.filter((x) => x.set_type === 'working').map((x) => epley1RM(x.weight, x.reps, x.rir)), 0);
          let n = 0;
          return (
            <View key={g.name} style={[st.card, { backgroundColor: t.card, borderColor: t.line }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Pressable onPress={() => router.push(`/exercise/${g.exercise_id}`)} hitSlop={8} style={{ flex: 1 }}><Doto size={20}>{g.name.toUpperCase()}</Doto></Pressable>
                {best > 0 && <Label color={t.dim}>e1RM {fmtKg(Math.round(best * 2) / 2)}</Label>}
              </View>
              {g.notes !== '' && <Label color={t.mute} style={{ paddingHorizontal: 6, paddingBottom: 4 }}>{g.notes}</Label>}
              {g.sets.map((x) => {
                const warm = x.set_type === 'warmup';
                if (!warm) n += 1;
                const hit = !warm && x.reps >= g.target && (x.rir ?? 0) >= 1;
                const editing = edit?.id === x.id;
                return (
                  <Pressable key={x.id} onLongPress={() => confirmDeleteSet(x)} style={[st.set, { borderColor: editing ? t.accent : 'transparent' }]}>
                    <Label color={warm ? t.warm : t.mute} style={{ width: 26 }}>{warm ? 'W' : String(n)}</Label>
                    {cell(x, 'weight', fmtKg(x.weight), 'kg', warm ? t.mute : t.text)}
                    {cell(x, 'reps', String(x.reps), 'reps', warm ? t.mute : hit ? t.green : t.text)}
                    {!warm && cell(x, 'rir', x.rir == null ? '–' : String(x.rir), 'rir', t.mute)}
                  </Pressable>
                );
              })}
              {edit && edit.id === null && edit.exercise_id === g.exercise_id && (
                <View style={[st.set, { borderColor: t.accent }]}>
                  <Label color={t.accent} style={{ width: 26 }}>{String(g.sets.filter((x) => x.set_type === 'working').length + 1)}</Label>
                  {(['weight', 'reps', 'rir'] as Field[]).map((f) => (
                    <Pressable key={f} onPress={() => setEdit({ ...edit, field: f })} style={st.cell} hitSlop={6}>
                      <Doto size={22} color={edit.field === f ? t.accent : t.text}>{edit[f] || '–'}</Doto>
                      <Label color={t.dim}>{f === 'weight' ? 'kg' : f}</Label>
                    </Pressable>
                  ))}
                </View>
              )}
              <Pressable
                onPress={() => beginNew(g.exercise_id, g.name, fmtKg(g.sets[g.sets.length - 1]?.weight ?? 0))}
                style={({ pressed }) => [st.addSet, { borderColor: t.line, opacity: pressed ? 0.6 : 1 }]}
              >
                <Label color={t.accent}>+ SET</Label>
              </Pressable>
            </View>
          );
        })}

        <Pressable
          onPress={() => router.push(`/routines/pick?log=${id}`)}
          style={({ pressed }) => [st.addExercise, { borderColor: t.line, opacity: pressed ? 0.7 : 1 }]}
        >
          <Label color={t.accent}>+ ADD EXERCISE</Label>
        </Pressable>

        <Pressable onPress={confirmDeleteSession} style={[st.danger, { borderColor: t.line }]}>
          <Label color={t.accent}>Delete session</Label>
        </Pressable>
      </ScrollView>

      {edit && (
        <View style={[st.pad, { backgroundColor: t.bg, borderTopColor: t.line, paddingBottom: insets.bottom + 8 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 8 }}>
            <Label>Editing</Label>
            <Pressable onPress={() => setEdit(null)} hitSlop={10}><Label color={t.text}>Cancel</Label></Pressable>
          </View>
          <Numpad onKey={onKey} onDone={onDone} doneLabel={nextField() ? `Next · ${nextField()}` : 'Save'} />
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  page: { paddingHorizontal: 16, gap: 10 },
  head: { gap: 6, paddingHorizontal: 4, paddingBottom: 6 },
  card: { padding: 14, borderRadius: 16, borderWidth: 1, gap: 4 },
  set: { flexDirection: 'row', alignItems: 'baseline', gap: 10, minHeight: 44, paddingHorizontal: 6, borderRadius: 10, borderWidth: 1 },
  cell: { flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingVertical: 8 },
  addSet: { alignItems: 'center', justifyContent: 'center', minHeight: 40, marginTop: 4, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed' },
  addExercise: { alignItems: 'center', justifyContent: 'center', minHeight: 56, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed' },
  danger: { alignItems: 'center', justifyContent: 'center', minHeight: 56, borderRadius: 14, borderWidth: 1, marginTop: 8 },
  pad: { paddingHorizontal: 16, paddingTop: 8, borderTopWidth: 1 },
  notes: { fontFamily: fonts.mono, fontSize: 14, lineHeight: 20, minHeight: 72, padding: 12, borderRadius: 12, borderWidth: 1, textAlignVertical: 'top' },
});
