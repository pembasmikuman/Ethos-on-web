import { useLayoutEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { fonts, useTheme } from '../lib/theme';
import { sx, type Style } from '../rn';

type Props = Omit<HTMLAttributes<HTMLSpanElement>, 'style' | 'color'> & { color?: string; size?: number; style?: Style | CSSProperties; numberOfLines?: number; onPress?: () => void; adjustsFontSizeToFit?: boolean; minimumFontScale?: number };

/** RN Text props that have no web meaning are dropped; onPress becomes a click. */
const web = ({ onPress, adjustsFontSizeToFit, minimumFontScale, ...rest }: Omit<Props, 'style' | 'color' | 'size' | 'numberOfLines'>) => ({ ...rest, onClick: onPress, role: onPress ? 'button' : undefined });

const clamp = (n?: number) => (n ? { display: '-webkit-box', WebkitLineClamp: n, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : null);

/** RN's adjustsFontSizeToFit on the web: shrink a pixel at a time until the text fits its `lines`, down to
 *  `size * min`. Still cut off at the smallest size? Allow one more line, so the whole text always shows. */
function useFit(on: boolean, size: number, lines: number | undefined, min: number, text: ReactNode) {
  const ref = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState({ size, lines });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!on || !el) return;
    const run = () => {
      const over = () => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
      let s = size, n = lines;
      const apply = () => { el.style.fontSize = `${s}px`; if (n) el.style.webkitLineClamp = String(n); };
      apply();
      while (over() && s > size * min) { s -= 1; apply(); }
      if (over() && n) { n += 1; apply(); }
      setFit({ size: s, lines: n });
    };
    run();
    // Watch the parent: watching the text itself would loop, since fitting changes its size.
    const ro = new ResizeObserver(run);
    if (el.parentElement) ro.observe(el.parentElement);
    document.fonts?.ready.then(run);
    return () => ro.disconnect();
  }, [on, size, lines, min, text]);
  return on ? { ref, ...fit } : { ref, size, lines };
}

/** Dot-matrix numerals and titles. */
export function Doto({ style, color, size = 26, numberOfLines, ...rest }: Props) {
  const t = useTheme();
  const fit = useFit(!!rest.adjustsFontSizeToFit, size, numberOfLines, rest.minimumFontScale ?? 0.5, rest.children);
  return <span ref={fit.ref} {...web(rest)} style={sx({ cursor: rest.onPress ? 'pointer' : undefined, fontFamily: fonts.doto, fontSize: fit.size, lineHeight: '1.2', color: color ?? t.text, fontVariant: ['tabular-nums'] }, clamp(fit.lines), style as Style)} />;
}

/** Small uppercase mono label. */
export function Label({ style, color, size = 11, numberOfLines, ...rest }: Props) {
  const t = useTheme();
  return <span {...web(rest)} style={sx({ cursor: rest.onPress ? 'pointer' : undefined, fontFamily: fonts.mono, fontSize: size, letterSpacing: size * 0.08, textTransform: 'uppercase', color: color ?? t.mute }, clamp(numberOfLines), style as Style)} />;
}
