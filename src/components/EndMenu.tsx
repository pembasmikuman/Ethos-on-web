import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { shut } from '../lib/alert';
import { router } from '../lib/nav';
import { useTheme } from '../lib/theme';
import { useWorkout } from '../store/workout';
import { DotRing } from './DotRing';
import { useHold } from './HoldRing';

const ICONS = {
  play: 'M7 4v16l13-8z',
  flag: 'M5 21V4h12l-3 4 3 4H5M9 8l2 2 3-3',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
};

function Icon({ d, color }: { d: string; color: string }) {
  return <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}

/** End-of-session grid: Keep going, Finish, and Discard (held 500 ms, since it deletes every set). */
export function EndMenu({ open, onClose, done, total }: { open: boolean; onClose: () => void; done: number; total: number }) {
  const t = useTheme();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (open && !d?.open) d?.showModal();
    if (!open && d?.open) shut(d);
  }, [open]);

  const finish = async (e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    onClose();
    // The celebration's wipe grows out of the tile that was tapped.
    const id = await useWorkout.getState().finish({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    router.dismissTo('/', id ? `/history/${id}?done=1` : undefined);
  };
  const discard = async () => { onClose(); await useWorkout.getState().cancel(); router.dismissTo('/'); };
  const hold = useHold(discard);

  // On <body> like Alert's dialogs, out of reach of the #root button reset.
  return createPortal(
    <dialog ref={ref} className="alert end" onClose={onClose} onCancel={(e) => { e.preventDefault(); onClose(); }}>
      <p>End session · {done} of {total} sets</p>
      <div className="grid">
        <button type="button" onClick={onClose}><Icon d={ICONS.play} color={t.text} />Keep going</button>
        <button type="button" data-style="accent" onClick={finish}><Icon d={ICONS.flag} color={t.bg} />Finish</button>
        <button type="button" data-style="destructive" {...hold.props}>
          <span className="ring">
            {hold.progress > 0 && <span style={{ position: 'absolute', inset: -11 }}><DotRing size={48} count={20} fraction={hold.progress} on={t.accent} off="transparent" /></span>}
            <Icon d={ICONS.trash} color={t.accent} />
          </span>
          Discard
        </button>
      </div>
      <p className="foot">Hold Discard to confirm (500 ms)</p>
    </dialog>,
    document.body,
  );
}
