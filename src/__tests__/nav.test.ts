import { expect, test } from 'bun:test';
import { matchRoute, navState, resetNav, router } from '../lib/nav';

test('static and param routes', () => {
  expect(matchRoute('/', '/')).toEqual({});
  expect(matchRoute('/exercise/:id', '/exercise/bench')).toEqual({ id: 'bench' });
  expect(matchRoute('/exercise/:id', '/exercise')).toBeNull();
  expect(matchRoute('/history', '/history/1')).toBeNull();
  expect(matchRoute('/history/:id', '/history/a%20b')).toEqual({ id: 'a b' });
});

const show = () => { const s = navState(); return { tab: s.tab, stack: s.stacks[s.tab].map((e) => e.href) }; };
const topKey = () => { const s = navState(); return s.stacks[s.tab].at(-1)!.k; };

test('each tab keeps its own screens: leaving History for Moves and coming back finds the same screen', () => {
  resetNav('/');
  router.tab('history');
  router.push('/history/1');
  const k = topKey();
  router.tab('exercises');
  router.push('/exercise/bench');
  router.tab('history');
  expect(show()).toEqual({ tab: 'history', stack: ['/history', '/history/1'] });
  expect(topKey()).toBe(k);
  router.tab('exercises');
  expect(show().stack).toEqual(['/exercises', '/exercise/bench']);
});

test('tapping the current tab pops to its first screen', () => {
  resetNav('/');
  router.tab('history');
  router.push('/history/1');
  router.push('/exercise/x');
  expect(router.tab('history')).toBe('popped');
  expect(show().stack).toEqual(['/history']);
  expect(router.tab('history')).toBe('at-root');
});

test('the workout lives in the Log tab, and rest opens and closes on top of it', () => {
  resetNav('/');
  router.push('/session');
  expect(show()).toEqual({ tab: 'log', stack: ['/session'] });
  router.push('/workout');
  router.navigate('/rest');
  expect(show().stack).toEqual(['/session', '/workout', '/rest']);
  router.back();
  router.navigate('/session');
  expect(show().stack).toEqual(['/session']);
});

test('going Home during a workout and back to it keeps the workout screen', () => {
  resetNav('/');
  router.push('/session');
  router.push('/workout');
  const k = topKey();
  router.tab('home');
  router.push('/session'); // tapping a routine on Home while a workout is on
  expect(show()).toEqual({ tab: 'log', stack: ['/session', '/workout'] });
  expect(topKey()).toBe(k);
});

test('finishing clears the workout and lands on its review above Home', () => {
  resetNav('/');
  router.tab('history');
  router.push('/session');
  router.push('/workout');
  router.dismissTo('/', '/history/9?done=1');
  expect(show()).toEqual({ tab: 'home', stack: ['/', '/history/9?done=1'] });
  expect(navState().stacks.log).toEqual([]);
  expect(navState().stacks.history.map((e) => e.href)).toEqual(['/history']);
});

test('relaunching into a workout opens the Log tab with the overview under it', () => {
  resetNav('/');
  router.replace('/workout');
  expect(show()).toEqual({ tab: 'log', stack: ['/session', '/workout'] });
});

test('a reload on a deeper screen still has a way back', () => {
  resetNav('/history/5');
  expect(show()).toEqual({ tab: 'history', stack: ['/history', '/history/5'] });
  resetNav('/exercise/new?routine=r1');
  expect(show()).toEqual({ tab: 'exercises', stack: ['/exercises', '/exercise/new?routine=r1'] });
});

test('back on the first screen of a tab goes Home; replace swaps only the top screen', () => {
  resetNav('/');
  router.tab('settings');
  router.back();
  expect(show()).toEqual({ tab: 'home', stack: ['/'] });
  router.push('/exercise/new');
  router.replace('/exercise/abc');
  router.push('/routines/pick');
  router.dismiss(2);
  expect(show().stack).toEqual(['/']);
});

test('navigate to the screen already on top does nothing', () => {
  resetNav('/');
  router.push('/history/1');
  const k = topKey();
  router.navigate('/history/1');
  expect(topKey()).toBe(k);
  expect(show().stack).toEqual(['/', '/history/1']);
});

const move = () => { const m = navState().move; return m && { kind: m.kind, from: m.from.href }; };

test('opening a screen slides in, going back slides out, switching tabs does not slide', () => {
  resetNav('/');
  expect(move()).toBeNull();
  router.push('/history/1');
  expect(move()).toEqual({ kind: 'push', from: '/' });
  router.back();
  expect(move()).toEqual({ kind: 'pop', from: '/history/1' });
  router.tab('history');
  expect(move()).toBeNull();
  router.push('/history/2');
  router.replace('/history/3');
  expect(move()).toBeNull();
});

test('the workout screens slide like the native stack, and finishing slides its review in', () => {
  resetNav('/');
  router.push('/session');
  expect(move()).toEqual({ kind: 'push', from: '/' });
  router.push('/workout');
  router.navigate('/session');
  expect(move()).toEqual({ kind: 'pop', from: '/workout' });
  router.push('/workout');
  router.dismissTo('/', '/history/9?done=1');
  expect(move()).toEqual({ kind: 'push', from: '/workout' });
  router.dismissTo('/');
  expect(move()).toEqual({ kind: 'pop', from: '/history/9?done=1' });
});

test('a slide that finished is settled only once, and a newer one is left alone', () => {
  resetNav('/');
  router.push('/history/1');
  const first = navState().move!;
  router.push('/history/2');
  router.settle(first);
  expect(move()).toEqual({ kind: 'push', from: '/history/1' });
  router.settle(navState().move!);
  expect(move()).toBeNull();
});
