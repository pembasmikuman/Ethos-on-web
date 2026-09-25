import { test, expect } from 'bun:test';
import { fmtClock, fmtKg, applyKey } from '../lib/format';

test('fmtClock', () => {
  expect(fmtClock(107)).toBe('1:47');
  expect(fmtClock(0)).toBe('0:00');
  expect(fmtClock(-3)).toBe('0:00');
});

test('fmtKg', () => {
  expect(fmtKg(80)).toBe('80');
  expect(fmtKg(82.5)).toBe('82.5');
});

test('applyKey', () => {
  expect(applyKey('', '8')).toBe('8');
  expect(applyKey('8', '2')).toBe('82');
  expect(applyKey('82', '.')).toBe('82.');
  expect(applyKey('82.', '5')).toBe('82.5');
  expect(applyKey('82.5', '.')).toBe('82.5');
  expect(applyKey('82.5', 'del')).toBe('82.');
  expect(applyKey('80', '+')).toBe('82.5');
  expect(applyKey('1', '-')).toBe('0');
  expect(applyKey('0', '5')).toBe('5');
  expect(applyKey('', '.')).toBe('0.');
});
