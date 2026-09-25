import { useSyncExternalStore } from 'react';
import { useUi } from '../store/ui';
import { useSafeAreaInsets } from './insets';

const dark = {
  bg: '#0A0A0B',
  card: '#141416',
  line: '#232326',
  text: '#F2F2F0',
  mute: '#8A8A86',
  dim: '#3A3A3E',
  accent: '#FF4D1C',
  warnBg: '#1A1210',
  warnLine: '#3A2418',
  green: '#4ADE80',
  warm: '#7C8A99',
};
const light: typeof dark = {
  bg: '#EDEAE4',
  card: '#F7F5F1',
  line: '#D6D2CA',
  text: '#141416',
  mute: '#6B6B66',
  dim: '#B8B5AE',
  accent: '#FF4D1C',
  warnBg: '#FBE9E2',
  warnLine: '#F3C4B3',
  green: '#15803D',
  warm: '#7C8A99',
};

export type Theme = typeof dark;

const mq = matchMedia('(prefers-color-scheme: light)');
const sub = (cb: () => void) => { mq.addEventListener('change', cb); return () => mq.removeEventListener('change', cb); };
export function useScheme(): 'light' | 'dark' {
  const systemLight = useSyncExternalStore(sub, () => mq.matches);
  const pref = useUi((s) => s.appearance);
  if (pref === 'system') return systemLight ? 'light' : 'dark';
  return pref;
}

export function useTheme(): Theme {
  return useScheme() === 'light' ? light : dark;
}

export const fonts = {
  doto: 'Doto900',
  dotoBold: 'Doto700',
  mono: 'Mono500',
  monoBold: 'Mono600',
};

/** Top inset, from env(safe-area-inset-top). */
export function useTopInset(): number {
  return useSafeAreaInsets().top;
}
