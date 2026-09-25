import { useRef } from 'react';

/** Pointer props that call `fn` after holding `ms` without moving more than 8px. Suppresses the click that follows. */
export function useLongPress(fn?: () => void, ms = 450) {
  const timer = useRef<number>(0);
  const start = useRef({ x: 0, y: 0 });
  const fired = useRef(false);
  const clear = () => clearTimeout(timer.current);
  if (!fn) return {};
  return {
    onPointerDown: (e: React.PointerEvent) => {
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => { fired.current = true; fn(); }, ms);
    },
    onPointerMove: (e: React.PointerEvent) => { if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) clear(); },
    onPointerUp: clear,
    onPointerCancel: clear,
    onClickCapture: (e: React.MouseEvent) => { if (fired.current) { e.stopPropagation(); e.preventDefault(); } },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}
