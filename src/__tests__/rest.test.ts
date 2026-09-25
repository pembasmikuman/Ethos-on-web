import { expect, test } from 'bun:test';
import { alertStatus } from '../lib/rest';

test('alert status covers tab, denied, granted and not yet asked', () => {
  expect(alertStatus({ hasPush: false, permission: 'default', subscribed: false })).toBe('unsupported');
  expect(alertStatus({ hasPush: true, permission: 'denied', subscribed: false })).toBe('blocked');
  expect(alertStatus({ hasPush: true, permission: 'granted', subscribed: true })).toBe('on');
  expect(alertStatus({ hasPush: true, permission: 'default', subscribed: false })).toBe('off');
});
