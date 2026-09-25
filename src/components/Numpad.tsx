import { Pressable, StyleSheet, View, type ViewStyle } from '../rn';
import { useTheme } from '../lib/theme';
import { Doto, Label } from './Text';

type Props = {
  onKey: (key: string) => void;
  onDone: () => void;
  doneLabel?: string;
};

const ROWS: [string, string][][] = [
  [['7', '7'], ['8', '8'], ['9', '9'], ['+2.5', '+']],
  [['4', '4'], ['5', '5'], ['6', '6'], ['−2.5', '-']],
  [['1', '1'], ['2', '2'], ['3', '3'], ['⌫', 'del']],
];

export function Numpad({ onKey, onDone, doneLabel = 'Done · Start rest' }: Props) {
  const t = useTheme();
  const key = (label: string, value: string, sub = false, style?: ViewStyle) => (
    <Pressable
      key={value}
      onPress={() => onKey(value)}
      style={({ pressed }) => [
        s.key,
        { backgroundColor: sub ? 'transparent' : t.card, borderColor: t.line, transform: [{ scale: pressed ? 0.97 : 1 }] },
        style,
      ]}
    >
      <Doto size={26} color={sub ? t.mute : t.text}>{label}</Doto>
    </Pressable>
  );
  return (
    <View style={s.grid}>
      {ROWS.map((row, i) => (
        <View key={i} style={s.row}>{row.map(([l, v]) => key(l, v, v.length > 1 || v === '.'))}</View>
      ))}
      <View style={s.row}>
        {key('0', '0')}
        {key('.', '.', true)}
        <Pressable
          onPress={onDone}
          style={({ pressed }) => [s.key, s.done, { backgroundColor: t.accent, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
        >
          <Label color={t.bg} size={13} style={{ fontWeight: '600' }}>{doneLabel}</Label>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  grid: { gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  key: { flex: 1, height: 56, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  done: { flex: 2, borderWidth: 0 },
});
