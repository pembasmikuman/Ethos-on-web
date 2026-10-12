import { Pressable, StyleSheet, View } from '../rn';
import { useTheme } from '../lib/theme';
import type { Progression } from '../db';
import { Doto, Label } from './Text';

/** One setting row: label, minus, value, plus. `note` sits under the label, e.g. "your own". */
export function Stepper({ label, value, onChange, note }: { label: string; value: string; onChange: (d: -1 | 1) => void; note?: string }) {
  const t = useTheme();
  return (
    <View style={[s.setting, { borderBottomColor: t.line }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Label>{label}</Label>
        {note && <Label size={9} color={t.accent}>{note}</Label>}
      </View>
      <Pressable onPress={() => onChange(-1)} hitSlop={8} style={s.key}><Doto size={20} color={t.mute}>−</Doto></Pressable>
      <Doto size={22} style={{ minWidth: 64, textAlign: 'center' }}>{value}</Doto>
      <Pressable onPress={() => onChange(1)} hitSlop={8} style={s.key}><Doto size={20} color={t.mute}>+</Doto></Pressable>
    </View>
  );
}

const RULES: Progression[] = ['double', 'linear', 'greyskull'];
export const RULE_HINT: Record<Progression, string> = {
  double: 'Add reps until every set hits the top of the range, then add weight.',
  linear: 'Every set reaches the bottom of the range, add weight next session.',
  greyskull: 'Last set all out. Double the low number for two jumps, miss and drop 10 %.',
};

/** Progression rule chips with a plain line on what the picked one does. `label` names the row when it sits among other settings. */
export function RulePicker({ value, onChange, label, note }: { value: Progression; onChange: (r: Progression) => void; label?: string; note?: string }) {
  const t = useTheme();
  return (
    <View style={[s.rule, { borderBottomColor: t.line }]}>
      {label && (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Label>{label}</Label>
          {note && <Label size={9} color={t.accent}>{note}</Label>}
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {RULES.map((r) => (
          <Pressable key={r} onPress={() => onChange(r)} style={[s.chip, { borderColor: value === r ? t.accent : t.line, backgroundColor: value === r ? t.accent : 'transparent' }]}>
            <Label color={value === r ? t.bg : t.mute}>{r}</Label>
          </Pressable>
        ))}
      </View>
      <Label color={t.mute} size={10} style={{ textTransform: 'none', letterSpacing: 0.4, lineHeight: 15 }}>{RULE_HINT[value]}</Label>
    </View>
  );
}

const s = StyleSheet.create({
  setting: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, borderBottomWidth: 1, height: 56 },
  rule: { gap: 10, paddingHorizontal: 4, paddingVertical: 12, borderBottomWidth: 1 },
  chip: { flex: 1, alignItems: 'center', borderWidth: 1, borderRadius: 999, paddingVertical: 9 },
  key: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
