import { expect, test } from 'bun:test';
import { css } from '../lib/css';

test('RN shorthands become CSS', () => {
  expect(css({ paddingVertical: 4, marginHorizontal: 8 }, false, null)).toEqual({ paddingTop: 4, paddingBottom: 4, marginLeft: 8, marginRight: 8 });
});
test('border widths get a solid style', () => {
  expect(css({ borderWidth: 1 })).toEqual({ borderWidth: 1, borderStyle: 'solid' });
  expect(css({ borderBottomWidth: 1 })).toEqual({ borderBottomWidth: 1, borderBottomStyle: 'solid' });
});
test('transform arrays and fontVariant arrays become strings', () => {
  expect(css({ transform: [{ translateY: 10 }, { scale: 1.02 }] })).toEqual({ transform: 'translateY(10px) scale(1.02)' });
  expect(css({ fontVariant: ['tabular-nums'] })).toEqual({ fontVariantNumeric: 'tabular-nums' });
});
test('later styles win', () => {
  expect(css({ opacity: 1 }, { opacity: 0.5 })).toEqual({ opacity: 0.5 });
});

test('numeric lineHeight is pixels, like RN', () => {
  expect(css({ lineHeight: 11 }).lineHeight).toBe('11px');
  expect(css({ lineHeight: '1.2' }).lineHeight).toBe('1.2');
});
