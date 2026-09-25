import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from '../rn';
import { router, useFocusEffect } from '../lib/nav';
import { useSafeAreaInsets } from '../lib/insets';
import { createRoutine, deletePlan, deleteRoutine, listRoutines, renamePlan, reorderPlan, type Routine } from '../db/queries';
import { useTheme, useTopInset } from '../lib/theme';
import { Doto, Label } from '../components/Text';
import { DOCK_HEIGHT } from '../components/Dock';
import { DragRow, ROW_H, useDragList } from '../components/DragRow';

/** Routine = plan (UL, PPL). Each holds days (Day A, Day B) which are the rows in the routines table. */
export default function Routines() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const top = useTopInset();
  const [rows, setRows] = useState<Routine[]>([]);
  const [dragging, setDragging] = useState(false);
  const drag = useDragList();

  const load = () => listRoutines().then(setRows);
  useFocusEffect(useCallback(() => { load(); }, []));

  const plans = [...new Set(rows.map((r) => r.plan))];

  const drop = async (plan: string, from: number, to: number) => {
    setDragging(false);
    if (from === to) return;
    const days = rows.filter((r) => r.plan === plan);
    days.splice(to, 0, days.splice(from, 1)[0]);
    setRows([...rows.filter((r) => r.plan !== plan), ...days].sort((a, b) => a.plan.localeCompare(b.plan)));

    await reorderPlan(days.map((r) => r.id));
    load();
  };

  const newPlan = () =>
    Alert.prompt('New routine', 'Name, e.g. UL or PPL', async (name) => {
      const p = (name ?? '').trim();
      if (!p) return;
      const id = await createRoutine('Day A', p);
      router.push(`/routines/${id}`);
    });

  const planMenu = (plan: string) =>
    Alert.alert(plan || 'Loose days', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Rename', onPress: () => Alert.prompt('Rename routine', undefined, async (n) => { if (n?.trim()) { await renamePlan(plan, n.trim()); load(); } }, 'plain-text', plan) },
      { text: 'Delete routine and its days', style: 'destructive', onPress: async () => { await deletePlan(plan); load(); } },
    ]);

  const dayMenu = (r: Routine) =>
    Alert.alert('Delete day?', `${r.name}. Past sessions stay in history.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteRoutine(r.id); load(); } },
    ]);

  return (
    <ScrollView style={{ backgroundColor: t.bg }} scrollEnabled={!dragging} contentContainerStyle={[s.page, { paddingTop: top + 12, paddingBottom: insets.bottom + DOCK_HEIGHT + 12 }]}>
      <View style={s.head}>
        <Doto size={40}>ROUTINES</Doto>
        <Pressable onPress={() => router.back()} hitSlop={12}><Label color={t.accent}>Done</Label></Pressable>
      </View>
      {rows.length === 0 && <Label color={t.dim} style={{ paddingHorizontal: 4 }}>No routines yet.</Label>}
      {plans.map((plan) => (
        <View key={plan || '~'} style={[s.plan, { backgroundColor: t.card, borderColor: t.line }]}>
          <Pressable onLongPress={() => planMenu(plan)} style={s.planHead}>
            <Doto size={26} style={{ flex: 1 }}>{(plan || 'LOOSE DAYS').toUpperCase()}</Doto>
            <Label color={t.dim}>hold to rename</Label>
          </Pressable>
          {rows.filter((r) => r.plan === plan).map((r, i, days) => (
            <DragRow key={r.id} index={i} count={days.length} drag={drag} onGrab={() => { setDragging(true); }} onDrop={(f, to) => drop(plan, f, to)}>
              <Pressable onPress={() => router.push(`/routines/${r.id}`)} onLongPress={() => dayMenu(r)} style={({ pressed }) => [s.row, { borderTopColor: t.line, backgroundColor: t.card, opacity: pressed ? 0.7 : 1 }]}>
                <Doto size={18} style={{ flex: 1 }}>{r.name.toUpperCase()}</Doto>
                <Label>{r.exercises} ex</Label>
                <View style={{ width: 36 }} />
              </Pressable>
            </DragRow>
          ))}
          <Pressable onPress={async () => { const n = rows.filter((r) => r.plan === plan).length; const id = await createRoutine(`Day ${String.fromCharCode(65 + n)}`, plan); router.push(`/routines/${id}`); }} style={[s.row, { borderTopColor: t.line }]}>
            <Label color={t.accent}>+ Day</Label>
          </Pressable>
        </View>
      ))}
      <Pressable onPress={newPlan} style={({ pressed }) => [s.add, { borderColor: t.line, opacity: pressed ? 0.7 : 1 }]}>
        <Label color={t.accent}>+ New routine</Label>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 16, gap: 12 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 4, paddingBottom: 4 },
  plan: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  planHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, borderTopWidth: 1, height: ROW_H },
  add: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: 18, alignItems: 'center' },
});
