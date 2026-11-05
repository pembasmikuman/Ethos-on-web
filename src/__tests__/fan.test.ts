import { expect, test } from 'bun:test';
import { fanAngles, pickAt } from '../lib/fan';

test('the fan opens toward the middle of the screen and stays inside a quarter turn', () => {
  expect(fanAngles('right', 1, 5)).toEqual([180, 202.5, 225, 247.5, 270]); // bottom right: left to straight up
  expect(fanAngles('right', 0, 5)).toEqual([90, 112.5, 135, 157.5, 180]); // top right: down to left
  expect(fanAngles('left', 1, 5)).toEqual([0, -22.5, -45, -67.5, -90]); // bottom left: right to straight up
  expect(fanAngles('left', 0.5, 5)).toEqual([45, 22.5, -0, -22.5, -45]);
});

test('a finger picks the tab it points at, and nothing near the FAB', () => {
  const a = fanAngles('right', 1, 5);
  expect(pickAt(-100, 0, a, 40)).toBe(0); // straight left
  expect(pickAt(0, -100, a, 40)).toBe(4); // straight up
  expect(pickAt(-70, -70, a, 40)).toBe(2);
  expect(pickAt(-10, -10, a, 40)).toBeNull(); // still on the button: let go to cancel
  expect(pickAt(100, 0, a, 40)).toBeNull(); // pointing off screen
});
