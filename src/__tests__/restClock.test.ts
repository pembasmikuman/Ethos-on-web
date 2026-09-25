import { expect, test } from 'bun:test';
import { restOutcome, LATE_MS } from '../lib/restClock';

test('rings on time, stays quiet when very late (page was asleep or reloaded long after)', () => {
  expect(restOutcome(10_000, 9_000)).toBe('wait');
  expect(restOutcome(10_000, 10_000)).toBe('ring');
  expect(restOutcome(10_000, 10_000 + LATE_MS)).toBe('ring');
  expect(restOutcome(10_000, 10_001 + LATE_MS)).toBe('silent');
});
