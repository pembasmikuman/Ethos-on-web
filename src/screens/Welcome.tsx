import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from '../rn';
import { router } from '../lib/nav';
import { useSafeAreaInsets } from '../lib/insets';
import { useTheme, useTopInset } from '../lib/theme';
import { backupSummary, pickBackup, restoreBackup } from '../lib/backup';
import { useUi } from '../store/ui';
import { Doto, Label } from '../components/Text';

const STEPS: [string, string][] = [
  ['01', 'Routines are plans. UL, PPL. Each holds days. A starter PPL is already in.'],
  ['02', 'Tap a day, preview, hit START. Numpad walks kg → reps → RIR. Check completes the set and starts rest.'],
  ['03', 'Hit the top of the rep range on every set at RIR 1 or more, next session pre-fills the next weight.'],
  ['04', 'A bell rings when rest ends. Allow notifications on your first rest to get a banner while you are in another app.'],
];

export default function Welcome() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const top = useTopInset();
  const done = useUi((s) => s.setOnboarded);
  const [busy, setBusy] = useState(false);

  const finish = () => {
    done();
    router.replace('/');
  };

  const restore = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const b = await pickBackup();
      if (!b) return;
      Alert.alert('Restore this backup?', backupSummary(b), [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restore', onPress: () => restoreBackup(b).then(finish, (e) => Alert.alert("Couldn't restore", e instanceof Error ? e.message : String(e))) },
      ]);
    } catch (e) {
      Alert.alert('Not an Ethos backup', String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={[s.page, { paddingTop: top + 40, paddingBottom: insets.bottom + 24 }]}>
      <Doto size={56}>ETHOS</Doto>
      <Label style={{ paddingTop: 6 }}>Character forged through habit</Label>

      <View style={{ gap: 18, paddingTop: 40 }}>
        {STEPS.map(([n, text]) => (
          <View key={n} style={{ flexDirection: 'row', gap: 14 }}>
            <Doto size={18} color={t.accent}>{n}</Doto>
            <Label size={12} style={{ flex: 1, lineHeight: 18, textTransform: 'none', letterSpacing: 0 }} color={t.text}>{text}</Label>
          </View>
        ))}
      </View>

      <View style={{ flex: 1 }} />

      <Pressable onPress={finish} style={({ pressed }) => [s.primary, { backgroundColor: t.accent, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
        <Doto size={24} color={t.bg}>START</Doto>
        <Label color={t.bg}>Starter PPL · edit anytime</Label>
      </Pressable>
      <Pressable onPress={restore} style={({ pressed }) => [s.secondary, { borderColor: t.line, opacity: pressed ? 0.7 : 1 }]}>
        <Label color={t.accent}>Restore from a backup file</Label>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: 24 },
  primary: { height: 68, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, marginTop: 24 },
  secondary: { marginTop: 10, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: 16, alignItems: 'center' },
});
