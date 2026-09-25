import { useState } from 'react';
import { StyleSheet, View } from '../rn';
import { Svg, Circle } from '../rn';
import { useTheme } from '../lib/theme';
import { Label } from './Text';

type Props = { items: { label: string; full?: string; value: number }[]; max?: number; band?: [number, number] };

/** Dot columns. Rows in `band` tint green. */
export function DotBars({ items, max = 20, band = [10, 20] }: Props) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  // Wide layouts (iPad, few columns) get bigger dots and full names.
  const per = width / Math.max(items.length, 1);
  const wide = per >= 84;
  const rows = 10, dot = wide ? 5 : 4, gap = wide ? 3 : 2, colW = wide ? 28 : 22;
  const h = rows * (dot * 2 + gap);
  const perRow = max / rows;
  return (
    <View style={s.wrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {items.map((it) => {
        const lit = Math.round(it.value / perRow);
        return (
          <View key={it.label} style={s.col}>
            <Svg width={colW} height={h}>
              {Array.from({ length: rows }, (_, r) => {
                const on = r < lit;
                const inBand = (r + 1) * perRow > band[0] - 0.01 && (r + 1) * perRow <= band[1];
                const fill = on ? (inBand ? t.green : t.text) : inBand ? t.line : t.dim;
                return <Circle key={r} cx={colW / 2} cy={h - dot - r * (dot * 2 + gap)} r={on ? dot : dot / 2} fill={fill} />;
              })}
            </Svg>
            <Label size={wide ? 10 : 9}>{wide ? it.full ?? it.label : it.label}</Label>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'flex-end' },
  col: { alignItems: 'center', gap: 8 },
});
