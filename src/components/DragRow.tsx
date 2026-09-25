import { useRef, useState, type ReactNode } from 'react';
import { Label } from './Text';

export const ROW_H = 64;
type Drag = { active: number; dy: number; set: (active: number, dy: number) => void };

/** Shared drag state for one list. */
export function useDragList(): Drag {
  const [st, setSt] = useState({ active: -1, dy: 0 });
  return { ...st, set: (active, dy) => setSt({ active, dy }) };
}

type Props = { index: number; count: number; drag: Drag; onDrop: (from: number, to: number) => void; onGrab: () => void; children: ReactNode };

/** Fixed-height row with a ≡ handle. Hold the handle briefly, drag, siblings slide aside. */
export function DragRow({ index, count, drag, onDrop, onGrab, children }: Props) {
  const clamp = (n: number) => Math.max(0, Math.min(count - 1, n));
  const { active, dy } = drag;
  let y = 0;
  if (active === index) y = dy;
  else if (active !== -1) {
    const target = clamp(active + Math.round(dy / ROW_H));
    y = active < index && index <= target ? -ROW_H : target <= index && index < active ? ROW_H : 0;
  }
  const mine = active === index;
  const hold = useRef(0);
  const y0 = useRef(0);
  return (
    <div style={{ transform: `translateY(${y}px) scale(${mine ? 1.02 : 1})`, zIndex: mine ? 10 : 0, transition: mine ? 'none' : 'transform 220ms cubic-bezier(.2,.9,.3,1)' }}>
      {children}
      <div
        style={{ position: 'absolute', right: 0, top: 0, width: 44, height: ROW_H, alignItems: 'center', justifyContent: 'center', touchAction: 'none' }}
        onPointerDown={(e) => {
          const el = e.currentTarget; const id = e.pointerId; y0.current = e.clientY;
          hold.current = window.setTimeout(() => { el.setPointerCapture(id); drag.set(index, 0); onGrab(); }, 150);
        }}
        onPointerMove={(e) => { if (drag.active === index) drag.set(index, e.clientY - y0.current); }}
        onPointerUp={() => {
          clearTimeout(hold.current);
          if (drag.active !== index) return;
          const to = clamp(index + Math.round(drag.dy / ROW_H));
          drag.set(-1, 0);
          onDrop(index, to);
        }}
        onPointerCancel={() => { clearTimeout(hold.current); drag.set(-1, 0); }}
      >
        <Label size={16}>≡</Label>
      </div>
    </div>
  );
}
