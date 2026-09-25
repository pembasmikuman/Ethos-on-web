import { View } from '../rn';
import { Svg, Circle } from '../rn';
import { useTheme } from '../lib/theme';
import { Label } from './Text';

/** Dot grid with one lit dot per value. Oldest left. */
export function DotTrend({ values, unit }: { values: number[]; unit: string }) {
  const t = useTheme();
  const rows = 8, dot = 3.5, step = 12, colW = 18;
  const w = Math.max(values.length, 1) * colW, h = rows * step;
  const lo = Math.min(...values), hi = Math.max(...values);
  const rowOf = (v: number) => (hi === lo ? rows - 1 : Math.round(((v - lo) / (hi - lo)) * (rows - 1)));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Svg width={w} height={h}>
        {values.map((v, c) => {
          const lit = rowOf(v);
          return Array.from({ length: rows }, (_, r) => (
            <Circle key={`${c}-${r}`} cx={c * colW + colW / 2} cy={h - step / 2 - r * step} r={r === lit ? dot : dot / 2.5} fill={r === lit ? (c === values.length - 1 ? t.accent : t.text) : t.dim} />
          ));
        })}
      </Svg>
      <View style={{ height: h, justifyContent: 'space-between' }}>
        <Label>{hi} {unit}</Label>
        <Label color={t.dim}>{lo} {unit}</Label>
      </View>
    </View>
  );
}
