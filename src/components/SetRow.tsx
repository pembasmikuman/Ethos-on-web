import { Pressable, StyleSheet, View } from '../rn';
import { useTheme } from '../lib/theme';
import { fmtKg } from '../lib/format';
import type { Field, SetDraft } from '../store/workout';
import type { LoggedSet } from '../db/queries';
import type { Load } from '../db';
import { Doto, Label } from './Text';
import { Check } from './Check';

type Props = {
  index: number;
  workingNumber: number;
  set: SetDraft;
  prev?: LoggedSet;
  targetMax: number;
  load?: Load;
  perSide?: boolean;
  active: boolean;
  focusField: Field | null;
  onFocus: (field: Field) => void;
  onLongPress?: () => void;
};

export function SetRow({ index, workingNumber, set, prev, targetMax, load = 'weight', perSide = false, active, focusField, onFocus, onLongPress }: Props) {
  const t = useTheme();
  const warm = set.type === 'warmup';
  const ink = set.done || active ? t.text : t.dim;
  const prevText = prev ? `prev ${fmtKg(prev.weight)} × ${prev.reps}${prev.rir != null ? ` @ ${prev.rir}` : ''}` : '';
  const side = perSide && set.reps !== '' ? `${Number(set.reps) / 2} per side` : '';
  const hint = [prevText, active && !warm ? `target ${targetMax}${load === 'time' ? 's' : ''}` : '', side].filter(Boolean).join(' · ');

  const cell = (field: Field, unit: string) => {
    const v = set[field];
    const focused = active && focusField === field;
    return (
      <Pressable onPress={() => onFocus(field)} style={s.cell} hitSlop={6}>
        <Doto size={26} color={focused ? t.accent : v === '' ? t.dim : ink}>{v === '' ? '–' : v}</Doto>
        <Label color={t.dim} size={10}>{unit}</Label>
      </Pressable>
    );
  };

  return (
    <Pressable
      onLongPress={onLongPress}
      style={[s.row, { backgroundColor: active ? t.card : 'transparent', borderColor: active ? t.accent : 'transparent' }]}
    >
      <Label color={warm ? t.warm : t.mute} style={s.num}>{warm ? 'W' : String(workingNumber)}</Label>
      <View style={s.body}>
        <View style={s.cells}>
          {cell('weight', load === 'bodyweight' ? '+kg' : 'kg')}
          {cell('reps', load === 'time' ? 'sec' : 'reps')}
          {!warm && cell('rir', 'rir')}
        </View>
        {hint !== '' && <Label color={active ? t.mute : t.dim} size={10}>{hint}</Label>}
      </View>
      <View style={[s.check, { backgroundColor: set.done ? t.accent : 'transparent', borderColor: set.done ? t.accent : t.line }]}>
        {set.done && <Check color={t.bg} />}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1 },
  num: { width: 26 },
  body: { flex: 1, gap: 2 },
  cells: { flexDirection: 'row', gap: 14, alignItems: 'baseline' },
  cell: { flexDirection: 'row', alignItems: 'baseline', gap: 6, minHeight: 44, paddingTop: 6 },
  check: { width: 44, height: 44, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
