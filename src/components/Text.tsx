import type { CSSProperties, HTMLAttributes } from 'react';
import { fonts, useTheme } from '../lib/theme';
import { sx, type Style } from '../rn';

type Props = Omit<HTMLAttributes<HTMLSpanElement>, 'style' | 'color'> & { color?: string; size?: number; style?: Style | CSSProperties; numberOfLines?: number; onPress?: () => void; adjustsFontSizeToFit?: boolean; minimumFontScale?: number };

/** RN Text props that have no web meaning are dropped; onPress becomes a click. */
const web = ({ onPress, adjustsFontSizeToFit, minimumFontScale, ...rest }: Omit<Props, 'style' | 'color' | 'size' | 'numberOfLines'>) => ({ ...rest, onClick: onPress, role: onPress ? 'button' : undefined });

const clamp = (n?: number) => (n ? { display: '-webkit-box', WebkitLineClamp: n, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : null);

/** Dot-matrix numerals and titles. */
export function Doto({ style, color, size = 26, numberOfLines, ...rest }: Props) {
  const t = useTheme();
  return <span {...web(rest)} style={sx({ cursor: rest.onPress ? 'pointer' : undefined, fontFamily: fonts.doto, fontSize: size, lineHeight: '1.2', color: color ?? t.text, fontVariant: ['tabular-nums'] }, clamp(numberOfLines), style as Style)} />;
}

/** Small uppercase mono label. */
export function Label({ style, color, size = 11, numberOfLines, ...rest }: Props) {
  const t = useTheme();
  return <span {...web(rest)} style={sx({ cursor: rest.onPress ? 'pointer' : undefined, fontFamily: fonts.mono, fontSize: size, letterSpacing: size * 0.08, textTransform: 'uppercase', color: color ?? t.mute }, clamp(numberOfLines), style as Style)} />;
}
