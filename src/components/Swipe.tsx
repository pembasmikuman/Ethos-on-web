import { useRef, useState, type ReactNode } from 'react';
import { useTheme } from '../lib/theme';
import { Label } from './Text';

const OPEN = 64;

/** Drag the row left past 64px and let go to remove it. A vertical move hands control back to the scroll. */
export function Swipe({ onRemove, children }: { onRemove: () => void; children: ReactNode }) {
  const t = useTheme();
  const [x, setX] = useState(0);
  const g = useRef<{ x0: number; y0: number; on: boolean | null } | null>(null);
  return (
    <div style={{ overflow: 'hidden' }}>
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 96, alignItems: 'center', justifyContent: 'center' }}>
        <Label color={t.accent}>Remove</Label>
      </div>
      <div
        style={{ transform: `translateX(${x}px)`, transition: g.current?.on ? 'none' : 'transform 200ms', touchAction: 'pan-y' }}
        onPointerDown={(e) => { g.current = { x0: e.clientX, y0: e.clientY, on: null }; }}
        onPointerMove={(e) => {
          const s = g.current; if (!s) return;
          const dx = e.clientX - s.x0, dy = e.clientY - s.y0;
          if (s.on === null && Math.hypot(dx, dy) > 8) s.on = Math.abs(dx) > Math.abs(dy) && dx < 0;
          if (s.on) setX(Math.min(0, dx / 2));
        }}
        onPointerUp={() => { const s = g.current; g.current = null; if (s?.on && x < -OPEN / 2) onRemove(); setX(0); }}
        onPointerCancel={() => { g.current = null; setX(0); }}
      >
        {children}
      </div>
    </div>
  );
}
