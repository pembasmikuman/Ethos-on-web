import { useCallback, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from '../rn';
import { Redirect, router, useFocusEffect } from '../lib/nav';
import { useSafeAreaInsets } from '../lib/insets';
import { allSessions, listRoutines, recentSessions, setsSince, type Routine } from '../db/queries';
import { daysAgo, heatmap, upNext, weeklyVolume, weekStart } from '../lib/progression';
import { Heatmap } from '../components/Heatmap';
import { DotBars } from '../components/DotBars';
import { BodyMap } from '../components/BodyMap';
import { DOCK_HEIGHT } from '../components/Dock';
import { useTheme, useTopInset } from '../lib/theme';
import { useWorkout } from '../store/workout';
import { useUi, type Panel } from '../store/ui';
import { Doto, Label } from '../components/Text';

const MUSCLES: [string, string][] = [['CHEST', 'chest'], ['BACK', 'back'], ['QUAD', 'quads'], ['HAM', 'hamstrings'], ['GLUTE', 'glutes'], ['DELT', 'delts'], ['BI', 'biceps'], ['TRI', 'triceps'], ['CALF', 'calves'], ['ABS', 'abs']];
const FULL: Record<string, string> = { quads: 'quadriceps', hamstrings: 'hamstrings', delts: 'delts', biceps: 'biceps', triceps: 'triceps', calves: 'calves', glutes: 'glutes', chest: 'chest', back: 'back', abs: 'abs' };

type Recent = Awaited<ReturnType<typeof recentSessions>>[number];

export default function Home() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const top = useTopInset();
  const preview = useWorkout((s) => s.preview);
  const active = useWorkout((s) => s.sessionId !== null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [busy, setBusy] = useState(false);
  const [volume, setVolume] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState(false);
  const [missed, setMissed] = useState(false);
  const [heat, setHeat] = useState<ReturnType<typeof heatmap>>({ cols: [], months: [] });
  const [page, setPage] = useState(0);
  const [panelW, setPanelW] = useState(0);
  const shown = useUi((s) => s.volumeMuscles);
  const panelOrder = useUi((s) => s.panelOrder);
  const movePanel = useUi((s) => s.movePanel);
  const onboarded = useUi((s) => s.onboarded);
  const toggle = useUi((s) => s.toggleVolumeMuscle);

  useFocusEffect(
    useCallback(() => {
      listRoutines().then(setRoutines);
      recentSessions().then(setRecent);
      setsSince(weekStart()).then((rows) => setVolume(weeklyVolume(rows)));
      allSessions().then((rows) => setHeat(heatmap(rows)));
    }, []),
  );

  const go = async (r: Routine) => {
    if (busy) return;
    if (active) {
      router.push('/session');
      return;
    }
    setBusy(true);
    try {
      await preview(r);
      router.push('/session');
    } finally {
      setBusy(false);
    }
  };

  if (!onboarded) return <Redirect href="/welcome" />;
  const nextIds = upNext(routines);
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });

  const movePanelMenu = (key: Panel) => {
    const i = panelOrder.indexOf(key);
    Alert.alert('Move panel', undefined, [
      { text: 'Cancel', style: 'cancel' },
      ...(i > 0 ? [{ text: 'Move left', onPress: () => movePanel(key, -1 as const) }] : []),
      ...(i < panelOrder.length - 1 ? [{ text: 'Move right', onPress: () => movePanel(key, 1 as const) }] : []),
    ]);
  };

  const panels: Record<Panel, ReactNode> = {
    volume: (
      <>
            <View style={s.panelHead}>
              <Label>This week · hard sets</Label>
              <Pressable onPress={() => setEditing((v) => !v)} hitSlop={12}><Label color={editing ? t.accent : t.green}>{editing ? 'Done' : '10–20 band'}</Label></Pressable>
            </View>
            <DotBars items={MUSCLES.filter(([, key]) => shown.includes(key)).map(([label, key]) => ({ label, full: FULL[key], value: volume[key] ?? 0 }))} />
            {editing && (
              <View style={s.chips}>
                {MUSCLES.map(([label, key]) => {
                  const on = shown.includes(key);
                  return (
                    <Pressable key={key} onPress={() => toggle(key)} style={[s.chip, { borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accent : 'transparent' }]}>
                      <Label color={on ? t.bg : t.mute}>{FULL[key]}</Label>
                    </Pressable>
                  );
                })}
              </View>
            )}
          
      </>
    ),
    days: (
      <>
            <Label>Training days · year</Label>
            <Heatmap cols={heat.cols} months={heat.months} />
            <View style={{ flex: 1 }} />
            <View style={s.stats}>
              {([[heat.cols[heat.cols.length - 1]?.filter((c) => c.level > 0).length ?? 0, 'This week'], [heat.cols.flat().filter((c) => c.level > 0).length, 'Days this year']] as const).map(([n, l]) => (
                <View key={l} style={{ gap: 2 }}>
                  <Doto size={32}>{n}</Doto>
                  <Label>{l}</Label>
                </View>
              ))}
            </View>
          
      </>
    ),
    map: (
      <>
            <View style={s.panelHead}>
              <Label>This week · muscle map</Label>
              <Pressable onPress={() => setMissed((v) => !v)} hitSlop={12} style={{ flexDirection: 'row' }}>
                <Label color={missed ? t.dim : t.accent}>Hit</Label>
                <Label color={t.dim}> · </Label>
                <Label color={missed ? t.accent : t.dim}>Missed</Label>
              </Pressable>
            </View>
            <BodyMap load={missed ? Object.fromEntries(MUSCLES.map(([, k]) => [k, volume[k] ? 0 : 1])) : volume} height={190} />
          
      </>
    ),
  };

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={[s.page, { paddingTop: top + 12, paddingBottom: insets.bottom + DOCK_HEIGHT + 12 }]}>
      <View style={s.head}>
        <Doto size={40}>ETHOS</Doto>
        <Label>{today}</Label>
      </View>

      <View onLayout={(e) => setPanelW(e.nativeEvent.layout.width)}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / (panelW + 32)))}
          style={{ marginHorizontal: -16 }}
          contentContainerStyle={{ alignItems: 'stretch' }}
        >
          {panelOrder.map((key) => (
            <View key={key} style={{ width: panelW + 32, paddingHorizontal: 16 }}>
              <Pressable onLongPress={() => movePanelMenu(key)} delayLongPress={350} style={[s.panel, { flex: 1, backgroundColor: t.card, borderColor: t.line }]}>
                {panels[key]}
              </Pressable>
            </View>
          ))}
        </ScrollView>
        <View style={s.pageDots}>
          {panelOrder.map((_, i) => i).map((i) => <View key={i} style={{ width: i === page ? 14 : 6, height: 6, borderRadius: 3, backgroundColor: i === page ? t.accent : t.dim }} />)}
        </View>
      </View>

      <View style={[s.section, { flexDirection: 'row', justifyContent: 'space-between' }]}>
        <Label>Routines</Label>
        <Pressable onPress={() => router.push('/routines')} hitSlop={12}><Label color={t.accent}>Edit</Label></Pressable>
      </View>
      {routines.length === 0 && <Label color={t.dim} style={{ paddingHorizontal: 4 }}>No routines. Tap Edit to build one.</Label>}
      {[...new Set(routines.map((r) => r.plan))].map((plan) => (
        <View key={plan || '~'} style={[s.card, { backgroundColor: t.card, borderColor: t.line }]}>
          {plan !== '' && <Doto size={28} style={{ paddingBottom: 6 }}>{plan.toUpperCase()}</Doto>}
          {routines.filter((r) => r.plan === plan).map((r) => {
            const ago = daysAgo(r.last_done);
            const next = nextIds.has(r.id);
            return (
              <Pressable key={r.id} onPress={() => go(r)} style={({ pressed }) => [s.day, { borderColor: next ? t.accent : t.line, opacity: pressed ? 0.8 : 1 }]}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Doto size={plan ? 20 : 26}>{r.name.toUpperCase()}</Doto>
                  <Label color={next ? t.accent : t.dim}>{next ? 'Up next · ' : ''}{ago === null ? 'never done' : ago === 0 ? 'today' : `${ago}d ago`}</Label>
                </View>
                <Label color={t.accent}>{active ? 'Resume' : 'Preview'}</Label>
              </Pressable>
            );
          })}
        </View>
      ))}

      {recent.length > 0 && <Label style={s.section}>Recent</Label>}
      {recent.map((r) => {
        const mins = r.end_time ? Math.round((new Date(r.end_time).getTime() - new Date(r.start_time).getTime()) / 60000) : 0;
        const day = new Date(r.start_time).toLocaleDateString('en-GB', { weekday: 'short' });
        return (
          <Pressable key={r.id} onPress={() => router.push(`/history/${r.id}`)} style={({ pressed }) => [s.row, { borderBottomColor: t.line, opacity: pressed ? 0.7 : 1 }]}>
            <Doto size={20} style={{ flex: 1 }}>{r.title.toUpperCase()}</Doto>
            <Label color={t.dim}>{day}</Label>
            <Label>{mins} min</Label>
            <Label>{r.sets} sets</Label>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 16, gap: 8 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 4, paddingBottom: 12 },
  section: { paddingHorizontal: 4, paddingTop: 12, paddingBottom: 4 },
  card: { padding: 14, borderRadius: 16, borderWidth: 1, gap: 8 },
  day: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, minHeight: 56 },
  panel: { padding: 16, borderRadius: 16, borderWidth: 1, gap: 12 },
  panelHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  stats: { flexDirection: 'row', gap: 32 },
  pageDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, minHeight: 44 },
});
