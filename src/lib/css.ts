import type { CSSProperties } from 'react';

type RN = Record<string, unknown>;
const PAIRS: Record<string, [string, string]> = {
  paddingVertical: ['paddingTop', 'paddingBottom'],
  paddingHorizontal: ['paddingLeft', 'paddingRight'],
  marginVertical: ['marginTop', 'marginBottom'],
  marginHorizontal: ['marginLeft', 'marginRight'],
};
const px = (v: unknown) => (typeof v === 'number' ? `${v}px` : String(v));

/** Merge React Native style objects into one CSS style: RN shorthands, border widths (which need a style on web),
 *  transform and fontVariant arrays. Falsy entries are skipped, later ones win. */
export function css(...styles: (RN | false | null | undefined)[]): CSSProperties {
  const out: RN = {};
  for (const st of styles) {
    if (!st) continue;
    for (const [k, v] of Object.entries(st)) {
      if (PAIRS[k]) { out[PAIRS[k][0]] = v; out[PAIRS[k][1]] = v; }
      else if (k === 'borderWidth') { out.borderWidth = v; out.borderStyle = 'solid'; }
      else if (/^border(Top|Bottom|Left|Right)Width$/.test(k)) { out[k] = v; out[k.replace('Width', 'Style')] = 'solid'; }
      else if (k === 'transform' && Array.isArray(v)) {
        out.transform = v.map((t: RN) => Object.entries(t).map(([f, a]) => `${f}(${f.startsWith('translate') ? px(a) : a})`).join(' ')).join(' ');
      } else if (k === 'fontVariant' && Array.isArray(v)) out.fontVariantNumeric = v.join(' ');
      else out[k] = v;
    }
  }
  return out as CSSProperties;
}
