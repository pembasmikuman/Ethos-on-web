import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from '../rn';
import { router, useFocusEffect } from '../lib/nav';
import { useSafeAreaInsets } from '../lib/insets';
import { allSessions, deleteSession, type SessionRow } from '../db/queries';
import { useTheme, useTopInset } from '../lib/theme';
import { Doto, Label } from '../components/Text';
import { DOCK_HEIGHT } from '../components/Dock';

export function sessionMeta(r: SessionRow) {
  const start = new Date(r.start_time);
  const mins = r.end_time ? Math.round((new Date(r.end_time).getTime() - start.getTime()) / 60000) : 0;
  return { date: start.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }), mins };
}

export default function History() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const top = useTopInset();
  const [rows, setRows] = useState<SessionRow[]>([]);

  const load = () => allSessions().then(setRows);
  useFocusEffect(useCallback(() => { load(); }, []));

  const confirmDelete = (r: SessionRow) =>
    Alert.alert('Delete session?', `${r.title} · ${sessionMeta(r).date}. Removes its ${r.sets} sets.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteSession(r.id); load(); } },
    ]);

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={[s.page, { paddingTop: top + 12, paddingBottom: insets.bottom + DOCK_HEIGHT + 12 }]}>
      <View style={s.head}>
        <Doto size={40}>HISTORY</Doto>
        <Label>{rows.length} sessions</Label>
      </View>
      {rows.length === 0 ? <Label style={{ padding: 4 }}>No finished sessions yet.</Label> : <Label color={t.dim} style={{ paddingHorizontal: 4, paddingBottom: 6 }}>Hold to delete</Label>}
      {rows.map((r) => {
        const { date, mins } = sessionMeta(r);
        return (
          <Pressable key={r.id} onPress={() => router.push(`/history/${r.id}`)} onLongPress={() => confirmDelete(r)} style={({ pressed }) => [s.row, { borderBottomColor: t.line, opacity: pressed ? 0.7 : 1 }]}>
            <View style={{ flex: 1, gap: 4 }}>
              <Doto size={22}>{r.title.toUpperCase()}</Doto>
              <Label color={t.dim}>{date}{r.photos ? ` · ${r.photos} photo${r.photos > 1 ? 's' : ''}` : ''}{r.notes ? ` · ${r.notes.split('\n')[0].slice(0, 40)}` : ''}</Label>
            </View>
            <Label>{mins} min</Label>
            <Label>{r.sets} sets</Label>
            <Label color={t.dim}>›</Label>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 16 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 4, paddingBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, minHeight: 56 },
});
