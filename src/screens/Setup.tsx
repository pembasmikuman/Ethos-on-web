import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from '../rn';
import { router, useLocalSearchParams } from '../lib/nav';
import { useSafeAreaInsets } from '../lib/insets';
import { useTheme, useTopInset } from '../lib/theme';
import { fmtKg } from '../lib/format';
import { getSetup, type Setup as SetupValues } from '../lib/setup';
import { applySetup, setupReach } from '../db/queries';
import { useUi } from '../store/ui';
import { DOCK_HEIGHT } from '../components/Dock';
import { RulePicker, Stepper } from '../components/Stepper';
import { Doto, Label } from '../components/Text';

/** What the rep range means under each rule, said as the moment weight goes up. */
function trigger(s: SetupValues): string {
  if (s.rule === 'double') return `Every set at ${s.repMax} reps, then add ${fmtKg(s.increment)} kg`;
  if (s.rule === 'linear') return `Every set at ${s.repMin}+ reps, then add ${fmtKg(s.increment)} kg`;
  return `Every set at ${s.repMin}+ adds ${fmtKg(s.increment)} kg. Last set at ${s.repMin * 2}+ adds ${fmtKg(s.increment * 2)} kg`;
}

/** App-wide rule, rep range, rest and weight jump. Shown once at first run (`?first=1`), and from Settings. */
export default function Setup() {
  const { first } = useLocalSearchParams<{ first?: string }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const top = useTopInset();
  const [v, setV] = useState(getSetup);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<SetupValues>) => setV({ ...v, ...p });

  const save = async () => {
    if (busy) return;
    if (first) {
      setBusy(true);
      await applySetup(v);
      useUi.getState().setOnboarded();
      router.dismissTo('/'); // not replace: Welcome would stay underneath, one swipe back
      return;
    }
    const { total, tuned } = await setupReach();
    Alert.alert('Apply to your exercises?', tuned ? `Updates ${total} exercises. ${tuned} keep the settings you changed on them.` : `Updates all ${total} exercises.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Apply', onPress: async () => { setBusy(true); await applySetup(v); router.back(); } },
    ]);
  };

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={[s.page, { paddingTop: top + 12, paddingBottom: insets.bottom + (first ? 24 : DOCK_HEIGHT + 12) }]}>
      {!first && <Pressable onPress={() => router.back()} hitSlop={12} style={{ alignSelf: 'flex-start', paddingHorizontal: 4, paddingBottom: 12 }}><Label color={t.accent}>‹ Settings</Label></Pressable>}
      <Doto size={40}>SETUP</Doto>
      <Label size={12} color={t.mute} style={s.lede}>How every exercise progresses. Change one exercise on its own page and it keeps your numbers.</Label>

      <Label style={s.section}>Progression rule</Label>
      <RulePicker value={v.rule} onChange={(rule) => set({ rule })} />

      <Label style={s.section}>Reps</Label>
      <Stepper label="Low" value={`${v.repMin}`} onChange={(d) => set({ repMin: Math.max(1, Math.min(v.repMax - 1, v.repMin + d)) })} />
      <Stepper label="High" value={`${v.repMax}`} onChange={(d) => set({ repMax: Math.min(50, Math.max(v.repMin + 1, v.repMax + d)) })} />
      <View style={[s.trigger, { backgroundColor: t.card, borderColor: t.line }]}>
        <Doto size={16} color={t.accent}>{`${v.repMin}–${v.repMax}`}</Doto>
        <Label size={11} color={t.text} style={{ flex: 1, textTransform: 'none', letterSpacing: 0.3, lineHeight: 16 }}>{trigger(v)}</Label>
      </View>

      <Label style={s.section}>Between sets</Label>
      <Stepper label="Rest" value={`${v.rest}s`} onChange={(d) => set({ rest: Math.min(600, Math.max(30, v.rest + d * 15)) })} />
      <Stepper label="Weight jump" value={`${fmtKg(v.increment)} kg`} onChange={(d) => set({ increment: Math.min(20, Math.max(0.5, v.increment + d * 0.5)) })} />
      <Label color={t.dim} style={{ paddingHorizontal: 4, paddingTop: 10 }}>Bodyweight moves always progress in reps</Label>

      <View style={{ flex: 1, minHeight: 24 }} />
      <Pressable onPress={save} disabled={busy} style={({ pressed }) => [s.primary, { backgroundColor: t.accent, opacity: busy ? 0.6 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
        <Doto size={24} color={t.bg}>{first ? 'START' : 'APPLY'}</Doto>
        <Label color={t.bg}>{first ? 'Change anytime in Settings' : 'To every exercise'}</Label>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: 16 },
  lede: { paddingHorizontal: 4, paddingTop: 6, textTransform: 'none', letterSpacing: 0, lineHeight: 18 },
  section: { paddingHorizontal: 4, paddingTop: 22, paddingBottom: 6 },
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  primary: { height: 68, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, marginTop: 24 },
});
