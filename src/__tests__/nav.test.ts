import { expect, test } from 'bun:test';
import { matchRoute } from '../lib/nav';

test('static and param routes', () => {
  expect(matchRoute('/', '/')).toEqual({});
  expect(matchRoute('/exercise/:id', '/exercise/bench')).toEqual({ id: 'bench' });
  expect(matchRoute('/exercise/:id', '/exercise')).toBeNull();
  expect(matchRoute('/history', '/history/1')).toBeNull();
  expect(matchRoute('/history/:id', '/history/a%20b')).toEqual({ id: 'a b' });
});
