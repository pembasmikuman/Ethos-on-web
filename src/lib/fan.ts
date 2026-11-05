export type Side = 'left' | 'right';

/** How wide the tabs fan out of the FAB, in degrees. */
const SPREAD = 90;

/** Angles (degrees, y down) of the tabs fanned out of the FAB. They always open toward the middle of the screen:
 *  up and inward at the bottom, down and inward at the top, straight in halfway, inside a quarter turn so none leave the screen. */
export function fanAngles(side: Side, y: number, n: number): number[] {
  const mid = side === 'right' ? 180 + (y - 0.5) * SPREAD : -(y - 0.5) * SPREAD;
  const step = SPREAD / (n - 1);
  return Array.from({ length: n }, (_, i) => mid + (i - (n - 1) / 2) * step * (side === 'right' ? 1 : -1));
}

/** Which tab a finger at (dx, dy) from the FAB centre points at, or null near the FAB (let go there to cancel). */
export function pickAt(dx: number, dy: number, angles: number[], dead: number): number | null {
  if (Math.hypot(dx, dy) < dead) return null;
  const a = (Math.atan2(dy, dx) * 180) / Math.PI;
  const off = (b: number) => Math.abs(((a - b + 540) % 360) - 180);
  const best = angles.reduce((bi, b, i) => (off(b) < off(angles[bi]) ? i : bi), 0);
  return off(angles[best]) <= SPREAD / (angles.length - 1) ? best : null;
}
