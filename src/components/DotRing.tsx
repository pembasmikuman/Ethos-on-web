import { Svg, Circle } from '../rn';

type Props = { size: number; count: number; fraction: number; on: string; off: string };

/** Ring of dots, `fraction` of them lit clockwise from 12 o'clock. */
export function DotRing({ size, count, fraction, on, off }: Props) {
  const c = size / 2;
  const r = c - 8;
  const lit = Math.round(count * Math.min(1, Math.max(0, fraction)));
  return (
    <Svg width={size} height={size}>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 - Math.PI / 2;
        const isOn = i < lit;
        return <Circle key={i} cx={c + Math.cos(a) * r} cy={c + Math.sin(a) * r} r={isOn ? 4 : 2.4} fill={isOn ? on : off} />;
      })}
    </Svg>
  );
}
