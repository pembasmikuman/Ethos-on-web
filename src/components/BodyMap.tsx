import { View } from '../rn';
import { Svg, Path } from '../rn';
import body from '../data/body.json';
import { useTheme } from '../lib/theme';

type Side = { vb: string; sil: string[]; m: Record<string, string[]> };
const B = body as { front: Side; back: Side };

/** Shade 0..1 relative to hardest-worked muscle. */
function Figure({ side, load, max, height }: { side: Side; load: Record<string, number>; max: number; height: number }) {
  const t = useTheme();
  const [, , w, h] = side.vb.split(' ').map(Number);
  return (
    <Svg viewBox={side.vb} width={(height * w) / h} height={height}>
      {side.sil.map((d, i) => <Path key={`s${i}`} d={d} fill={t.dim} opacity={0.35} />)}
      {Object.entries(side.m).map(([muscle, paths]) => {
        const v = max > 0 ? (load[muscle] ?? 0) / max : 0;
        return paths.map((d, i) => <Path key={`${muscle}${i}`} d={d} fill={v > 0 ? t.accent : t.dim} opacity={v > 0 ? 0.3 + 0.7 * v : 0.6} />);
      })}
    </Svg>
  );
}

/** Front and back figure, muscles tinted by `load` (sets per muscle). */
export function BodyMap({ load, height = 200 }: { load: Record<string, number>; height?: number }) {
  const max = Math.max(0, ...Object.values(load));
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24 }}>
      <Figure side={B.front} load={load} max={max} height={height} />
      <Figure side={B.back} load={load} max={max} height={height} />
    </View>
  );
}
