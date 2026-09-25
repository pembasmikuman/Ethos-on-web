import { expect, test } from 'bun:test';

// Fake audio that stays suspended, like iOS after the app was in the background.
let made = 0;
class FakeCtx {
  state = 'suspended';
  currentTime = 0;
  destination = {};
  resume = async () => {};
  createOscillator() { made++; return { frequency: {}, connect: (n: unknown) => n, start() {}, stop() {} }; }
  createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (n: unknown) => n }; }
}

test('a suspended audio context rings nothing, instead of queueing a bell for the next tap', async () => {
  Object.assign(globalThis, { AudioContext: FakeCtx });
  const { unlockAudio, ringBell } = await import('../lib/bell');
  unlockAudio();
  ringBell();
  expect(made).toBe(0);
});
