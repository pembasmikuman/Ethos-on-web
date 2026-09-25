let ctx: AudioContext | null = null;

/** iOS only lets audio start inside a completed tap. Call on every click; cheap after the first. */
export function unlockAudio(): void {
  ctx ??= new AudioContext();
  if (ctx.state !== 'running') void ctx.resume();
}

// Boxing bell: a bright fundamental plus inharmonic partials, each fading at its own rate.
const PARTIALS: [ratio: number, gain: number, decay: number][] = [
  [1, 1, 1.8], [2.32, 0.55, 1.2], [4.25, 0.3, 0.8], [6.63, 0.18, 0.5], [9.1, 0.08, 0.3],
];
const F0 = 830;

function strike(at: number): void {
  for (const [ratio, gain, decay] of PARTIALS) {
    const o = ctx!.createOscillator();
    const g = ctx!.createGain();
    o.frequency.value = F0 * ratio;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain * 0.35, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    o.connect(g).connect(ctx!.destination);
    o.start(at);
    o.stop(at + decay);
  }
}

/** Ding-ding-ding, end of round. */
export function ringBell(times = 3): void {
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.03;
  for (let i = 0; i < times; i++) strike(t0 + i * 0.32);
}
