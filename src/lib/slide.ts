import { useEffect, useLayoutEffect, type RefObject } from 'react';
import { navState, router, type Move } from './nav';

// iPhone stack motion: a new screen slides in from the right while the one under it drifts a third as far
// to the left; going back is the reverse, by tap or by dragging from the left edge.
const EASE = 'cubic-bezier(0.2, 0.9, 0.3, 1)';
const MS = 380;
const UNDER = -0.3;
const EDGE = 24;
const tx = (f: number) => `translateX(${f * 100}%)`;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const screen = (box: RefObject<HTMLElement | null>, k: number) => box.current?.querySelector<HTMLElement>(`[data-k="${k}"]`) ?? null;

// Set by a finished edge swipe just before it goes back, so that back doesn't slide a second time.
let swiped = false;

/** Slide the screens of the latest push or pop, then settle it so the screen underneath is hidden again. */
export function useSlides(box: RefObject<HTMLElement | null>, move: Move | null, topK: number): void {
  useLayoutEffect(() => {
    if (!move) return;
    const top = screen(box, topK), from = screen(box, move.from.k);
    if (swiped || reduced() || !top || !from) { swiped = false; router.settle(move); return; }
    const o = { duration: MS, easing: EASE, fill: 'forwards' } as const;
    const [moving, under] = move.kind === 'push'
      ? [top.animate([{ transform: tx(1) }, { transform: tx(0) }], o), from.animate([{ transform: tx(0) }, { transform: tx(UNDER) }], o)]
      : [from.animate([{ transform: tx(0) }, { transform: tx(1) }], o), top.animate([{ transform: tx(UNDER) }, { transform: tx(0) }], o)];
    moving.onfinish = () => router.settle(move);
    return () => { moving.cancel(); under.cancel(); };
  }, [move]);
}

/** Drag from the left edge to go back, following the finger. Past 40% of the width, or flicked, it goes back;
 *  otherwise it springs back. Touch events rather than pointer events: iOS cancels pointers once it starts a scroll. */
export function useEdgeSwipe(box: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const b = box.current;
    if (!b) return;
    let g: { x0: number; y0: number; lock: boolean; dx: number; v: number; t: number; w: number; top: HTMLElement; under: HTMLElement } | null = null;
    const underAt = (dx: number, w: number) => `translateX(${UNDER * (w - dx)}px)`;

    const start = (e: TouchEvent) => {
      const n = navState(), st = n.stacks[n.tab], p = e.touches[0];
      if (e.touches.length !== 1 || p.clientX > EDGE || st.length < 2 || n.move) return;
      const top = screen(box, st.at(-1)!.k), under = screen(box, st.at(-2)!.k);
      if (top && under) g = { x0: p.clientX, y0: p.clientY, lock: false, dx: 0, v: 0, t: e.timeStamp, w: b.clientWidth, top, under };
    };
    const move = (e: TouchEvent) => {
      if (!g) return;
      const p = e.touches[0], dx = p.clientX - g.x0, dy = p.clientY - g.y0;
      if (!g.lock) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > dx) { g = null; return; } // a scroll, not a swipe
        if (dx < 10) return;
        g.lock = true;
        g.under.style.visibility = 'visible';
      }
      e.preventDefault();
      const d = Math.max(0, dx);
      g.v = (d - g.dx) / Math.max(1, e.timeStamp - g.t);
      g.dx = d;
      g.t = e.timeStamp;
      g.top.style.transform = `translateX(${d}px)`;
      g.under.style.transform = underAt(d, g.w);
    };
    const end = (e: TouchEvent) => {
      const s = g;
      g = null;
      if (!s?.lock) return;
      // Speed only counts if the finger was still moving when it lifted; held still first, it is a slow release.
      const v = e.timeStamp - s.t > 80 ? 0 : s.v;
      const back = e.type === 'touchend' && (s.dx > s.w * 0.4 || (v > 0.35 && s.dx > 30));
      const o = { duration: MS * 0.7, easing: EASE, fill: 'forwards' } as const;
      const a = s.top.animate([{ transform: `translateX(${s.dx}px)` }, { transform: tx(back ? 1 : 0) }], o);
      const u = s.under.animate([{ transform: underAt(s.dx, s.w) }, { transform: back ? tx(0) : tx(UNDER) }], o);
      s.top.style.transform = s.under.style.transform = '';
      a.onfinish = () => {
        if (back) { swiped = true; router.back(); } // the swiped screen leaves still parked off to the right
        else { s.under.style.visibility = 'hidden'; a.cancel(); }
        u.cancel();
      };
    };
    b.addEventListener('touchstart', start, { passive: true });
    b.addEventListener('touchmove', move, { passive: false });
    b.addEventListener('touchend', end);
    b.addEventListener('touchcancel', end);
    return () => {
      b.removeEventListener('touchstart', start);
      b.removeEventListener('touchmove', move);
      b.removeEventListener('touchend', end);
      b.removeEventListener('touchcancel', end);
    };
  }, [box]);
}
