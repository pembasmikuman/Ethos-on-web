import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from '../rn';
import { router, useFocusEffect } from '../lib/nav';
import { useSafeAreaInsets } from '../lib/insets';
import { allSessions, deleteSession, type SessionRow } from '../db/queries';
import { useTheme, useTopInset } from '../lib/theme';
import { shareFile } from '../lib/backup';
import { exportFile } from '../lib/export';
import { Doto, Label } from '../components/Text';
import { Check } from '../components/Check';
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
  /** Sessions ticked for export; null when not selecting. */
  const [picked, setPicked] = useState<Set<string> | null>(null);
  // Built ahead so the Export tap can open the share sheet before any await (Safari needs that).
  const [file, setFile] = useState<File | null>(null);

  const load = () => allSessions().then(setRows);
  useFocusEffect(useCallback(() => { load(); }, []));
  useEffect(() => {
    setFile(null);
    if (!picked?.size) return;
    let live = true;
    exportFile([...picked]).then((f) => { if (live) setFile(f); });
    return () => { live = false; };
  }, [picked]);

  const confirmDelete = (r: SessionRow) =>
    Alert.alert('Delete session?', `${r.title} · ${sessionMeta(r).date}. Removes its ${r.sets} sets.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteSession(r.id); load(); } },
    ]);
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (!n.delete(id)) n.add(id); return n; });
  const all = picked != null && rows.length > 0 && picked.size === rows.length;
  const onExport = () => {
    if (!file) return;
    shareFile(file).catch((e) => Alert.alert('Export failed', String(e instanceof Error ? e.message : e)));
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={[s.page, { paddingTop: top + 12, paddingBottom: insets.bottom + DOCK_HEIGHT + 12 + (picked ? 80 : 0) }]}>
      <View style={s.head}>
        <Doto size={40}>HISTORY</Doto>
        {rows.length > 0 ? (
          <Pressable onPress={() => setPicked(picked ? null : new Set())} hitSlop={10}>
            <Label color={t.accent}>{picked ? 'Done' : 'Select'}</Label>
          </Pressable>
        ) : <Label>0 sessions</Label>}
      </View>
      {rows.length === 0 ? <Label style={{ padding: 4 }}>No finished sessions yet.</Label> : picked ? (
        <View style={[s.sub, { paddingBottom: 6 }]}>
          <Label color={t.dim}>{picked.size} of {rows.length} picked</Label>
          <Pressable onPress={() => setPicked(all ? new Set() : new Set(rows.map((r) => r.id)))} hitSlop={10}>
            <Label color={t.accent}>{all ? 'Select none' : 'Select all'}</Label>
          </Pressable>
        </View>
      ) : <Label color={t.dim} style={{ paddingHorizontal: 4, paddingBottom: 6 }}>{rows.length} sessions · hold to delete</Label>}
      {rows.map((r) => {
        const { date, mins } = sessionMeta(r);
        const on = picked?.has(r.id) ?? false;
        return (
          <Pressable
            key={r.id}
            onPress={() => (picked ? toggle(r.id) : router.push(`/history/${r.id}`))}
            onLongPress={picked ? undefined : () => confirmDelete(r)}
            style={({ pressed }) => [s.row, { borderBottomColor: t.line, opacity: pressed ? 0.7 : 1 }]}
          >
            {picked && (
              <View style={[s.box, { borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accent : 'transparent' }]}>
                {on && <Check color={t.bg} size={14} />}
              </View>
            )}
            <View style={{ flex: 1, gap: 4 }}>
              <Doto size={22}>{r.title.toUpperCase()}</Doto>
              <Label color={t.dim}>{date}{r.photos ? ` · ${r.photos} photo${r.photos > 1 ? 's' : ''}` : ''}{r.notes ? ` · ${r.notes.split('\n')[0].slice(0, 40)}` : ''}</Label>
            </View>
            <Label>{mins} min</Label>
            <Label>{r.sets} sets</Label>
            {!picked && <Label color={t.dim}>›</Label>}
          </Pressable>
        );
      })}
    </ScrollView>
    {rows.length > 0 && (
      <Pressable
        onPress={onExport}
        disabled={!picked}
        style={({ pressed }) => [s.export, {
          bottom: insets.bottom + DOCK_HEIGHT + 8, backgroundColor: picked?.size ? t.accent : t.card,
          // Parked below the dock until Select, then slides up; transition so a quick Select/Done reverses mid-way.
          transform: [{ translateY: picked ? 0 : 140 }, { scale: pressed ? 0.97 : 1 }], opacity: picked ? 1 : 0, pointerEvents: picked ? 'auto' : 'none',
          transition: 'transform 240ms cubic-bezier(0.23, 1, 0.32, 1), opacity 200ms ease-out, background-color 200ms ease',
        }]}
      >
        <Label color={picked?.size ? t.bg : t.dim} size={13} style={{ fontWeight: '600' }}>
          {!picked?.size ? 'Pick sessions to export' : !file ? 'Preparing…' : `Export ${picked.size} session${picked.size > 1 ? 's' : ''}`}
        </Label>
      </Pressable>
    )}
    </View>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 16 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 4, paddingBottom: 12 },
  sub: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, minHeight: 56 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  export: { position: 'absolute', left: 16, right: 16, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
