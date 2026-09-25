import { useRef } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewHandle } from '../rn';
import type { HeatCell } from '../lib/progression';
import { useTheme } from '../lib/theme';
import { Label } from './Text';

const CELL = 11, GAP = 3, STEP = CELL + GAP;
const MIX = [0, 0.3, 0.55, 0.78, 1];

function mix(a: string, b: string, k: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((c, i) => Math.round(c + (y[i] - c) * k).toString(16).padStart(2, '0')).join('');
}

/** GitHub-style year of training days. Scrolls horizontally, opens at the current week. */
export function Heatmap({ cols, months }: { cols: HeatCell[][]; months: string[] }) {
  const t = useTheme();
  const ref = useRef<ScrollViewHandle>(null);
  const shade = MIX.map((k) => mix(t.dim, t.accent, k));
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 28, gap: GAP, paddingTop: 16 }}>
          {['M', '', 'W', '', 'F', '', ''].map((d, i) => <Label key={i} size={9} color={t.dim} style={{ height: CELL, lineHeight: CELL }}>{d}</Label>)}
        </View>
        <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} onContentSizeChange={() => ref.current?.scrollToEnd({ animated: false })} style={{ flex: 1 }}>
          <View>
            <View style={{ height: 16 }}>
              {months.map((m, i) => m ? <Label key={i} size={9} numberOfLines={1} color={t.dim} style={{ position: 'absolute', left: i * STEP }}>{m}</Label> : null)}
            </View>
            <View style={{ flexDirection: 'row', gap: GAP }}>
              {cols.map((col, ci) => (
                <View key={ci} style={{ gap: GAP }}>
                  {col.map((c) => (
                    <View key={c.key} style={[s.cell, { backgroundColor: shade[c.level], opacity: c.future ? 0.3 : 1, borderWidth: c.today ? 1.5 : 0, borderColor: t.accent }]} />
                  ))}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: GAP }}>
        <Label size={9} color={t.dim} style={{ marginRight: 4 }}>less</Label>
        {shade.map((c, i) => <View key={i} style={[s.cell, { width: 9, height: 9, backgroundColor: c }]} />)}
        <Label size={9} color={t.dim} style={{ marginLeft: 4 }}>more</Label>
      </View>
    </View>
  );
}

const s = StyleSheet.create({ cell: { width: CELL, height: CELL, borderRadius: 3 } });
