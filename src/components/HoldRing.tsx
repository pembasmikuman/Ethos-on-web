import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTheme } from '../lib/theme';
import { DotRing } from './DotRing';

/** Hold for `ms` to fire `onDone`. Lifting or sliding off early cancels. `progress` runs 0 to 1 while held. */
export function useHold(onDone: () => void, ms = 500) {
  const [progress, setProgress] = useState(0);
  const raf = useRef(0);
  const fired = useRef(false);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const stop = () => { cancelAnimationFrame(raf.current); setProgress(0); };
  return {
    progress,
    props: {
      onPointerDown: () => {
        fired.current = false;
        const t0 = performance.now();
        const tick = (now: number) => {
          const f = (now - t0) / ms;
          if (f >= 1) { fired.current = true; setProgress(0); onDone(); return; }
          setProgress(f);
          raf.current = requestAnimationFrame(tick);
        };
        raf.current = requestAnimationFrame(tick);
      },
      onPointerUp: stop,
      onPointerLeave: stop,
      onPointerCancel: stop,
      // The click that ends a finished hold is not a tap.
      onClickCapture: (e: React.MouseEvent) => { if (fired.current) { fired.current = false; e.stopPropagation(); } },
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    },
  };
}

type Props = { size: number; idle: number; idleColor: string; onHold: () => void; onPress?: () => void; label: string; children: ReactNode };

/** Dot ring button. At rest the ring shows `idle` (a timer or progress); held, it fills in accent and fires `onHold`. */
export function HoldRing({ size, idle, idleColor, onHold, onPress, label, children }: Props) {
  const t = useTheme();
  const { progress, props } = useHold(onHold);
  const held = progress > 0;
  return (
    <div role="button" aria-label={label} tabIndex={0} {...props} onClick={onPress}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onHold(); } }}
      style={{ width: size, height: size, flexShrink: 0, cursor: 'pointer', touchAction: 'none' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <DotRing size={size} count={28} fraction={held ? progress : idle} on={held ? t.accent : idleColor} off={t.line} />
      </div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        {children}
      </div>
    </div>
  );
}
