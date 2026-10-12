import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from '../rn';
import { useTheme } from '../lib/theme';
import { applyRoutineChanges } from '../db/queries';
import { useUi, type PendingChanges } from '../store/ui';
import { Check } from './Check';
import { Doto, Label } from './Text';

/** On a just-finished workout's summary: asks whether to keep what changed against the routine,
 *  then lists each change to tick before saving it into the routine. */
export function KeepChanges({ sessionId, focused }: { sessionId: string; focused: boolean }) {
  const t = useTheme();
  const pendingChanges = useUi((s) => s.pendingChanges);
  const [offer, setOffer] = useState<PendingChanges | null>(null);
  const [picked, setPicked] = useState<boolean[]>([]);

  // Take the offer once, only on the summary of the workout it belongs to.
  useEffect(() => {
    if (!focused || pendingChanges?.sessionId !== sessionId) return;
    const p = pendingChanges;
    useUi.getState().setPendingChanges(null);
    Alert.alert('Keep changes?', `This workout changed ${p.routineName}. Use them next time?`, [
      { text: 'No', style: 'cancel' },
      { text: 'Pick changes', onPress: () => { setOffer(p); setPicked(p.changes.map(() => true)); } },
    ]);
  }, [focused, pendingChanges, sessionId]);

  if (!offer) return null;
  const save = async () => {
    await applyRoutineChanges(offer.routineId, offer.changes.filter((_, i) => picked[i]), offer.order);
    setOffer(null);
  };
  return (
    <View style={[s.card, { backgroundColor: t.card, borderColor: t.accent }]}>
      <Doto size={20}>{`UPDATE ${offer.routineName.toUpperCase()}`}</Doto>
      {offer.changes.map((c, i) => (
        <Pressable key={i} onPress={() => setPicked(picked.map((v, k) => (k === i ? !v : v)))} style={[s.row, { borderColor: t.line }]}>
          <View style={[s.box, { borderColor: picked[i] ? t.accent : t.line, backgroundColor: picked[i] ? t.accent : 'transparent' }]}>
            {picked[i] && <Check color={t.bg} size={14} />}
          </View>
          <Label color={picked[i] ? t.text : t.dim} style={{ flex: 1 }}>{c.label}</Label>
        </Pressable>
      ))}
      <View style={s.actions}>
        <Pressable onPress={() => setOffer(null)} style={[s.btn, { borderColor: t.line }]}><Label>Not now</Label></Pressable>
        <Pressable onPress={save} style={[s.btn, { borderColor: t.accent, backgroundColor: t.accent, opacity: picked.some(Boolean) ? 1 : 0.4 }]} disabled={!picked.some(Boolean)}>
          <Label color={t.bg}>Save to routine</Label>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { padding: 14, borderRadius: 16, borderWidth: 1, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, borderBottomWidth: 1 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 10, paddingTop: 10 },
  btn: { flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
