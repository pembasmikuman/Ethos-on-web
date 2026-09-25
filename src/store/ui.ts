import { create } from 'zustand';
import { kv } from '../db/kv';

export type Appearance = 'system' | 'dark' | 'light';
export type Panel = 'volume' | 'days' | 'map';
const PANELS: Panel[] = ['volume', 'days', 'map'];

type Ui = {
  dockHidden: boolean;
  setDockHidden: (v: boolean) => void;
  appearance: Appearance;
  setAppearance: (a: Appearance) => void;
  /** Muscle keys shown on the Home volume panel. */
  volumeMuscles: string[];
  toggleVolumeMuscle: (key: string) => void;
  /** Home panel carousel order. */
  panelOrder: Panel[];
  movePanel: (key: Panel, dir: -1 | 1) => void;
  onboarded: boolean;
  setOnboarded: () => void;
  /** Exercise the picker chose while reviewing a finished session. Not persisted: it is
   *  a hand-off between the picker and the review screen, read once and cleared. */
  pendingExercise: string | null;
  setPendingExercise: (id: string) => void;
  clearPendingExercise: () => void;
};

const DEFAULT_MUSCLES = ['chest', 'back', 'quads', 'hamstrings', 'delts', 'biceps', 'triceps'];

const KEY = 'appearance';
const PKEY = 'panelOrder';
const initialPanels = (() => { try { const p = JSON.parse(kv.get(PKEY) ?? '') as Panel[]; return [...p.filter((k) => PANELS.includes(k)), ...PANELS.filter((k) => !p.includes(k))]; } catch { return PANELS; } })();
const initial = (kv.get(KEY) as Appearance | null) ?? 'system';
const MKEY = 'volumeMuscles';
const initialMuscles = (() => { try { return JSON.parse(kv.get(MKEY) ?? '') as string[]; } catch { return DEFAULT_MUSCLES; } })();

/** Screens set dockHidden while an overlay (edit numpad) needs the bottom edge. */
export const useUi = create<Ui>((set) => ({
  dockHidden: false,
  setDockHidden: (dockHidden) => set({ dockHidden }),
  appearance: initial,
  setAppearance: (appearance) => {
    kv.set(KEY, appearance);
    set({ appearance });
  },
  panelOrder: initialPanels,
  movePanel: (key, dir) =>
    set((st) => {
      const i = st.panelOrder.indexOf(key), j = i + dir;
      if (i < 0 || j < 0 || j >= st.panelOrder.length) return {};
      const panelOrder = [...st.panelOrder];
      [panelOrder[i], panelOrder[j]] = [panelOrder[j], panelOrder[i]];
      kv.set(PKEY, JSON.stringify(panelOrder));
      return { panelOrder };
    }),
  pendingExercise: null,
  setPendingExercise: (pendingExercise) => set({ pendingExercise }),
  clearPendingExercise: () => set({ pendingExercise: null }),
  onboarded: kv.get('onboarded') === '1',
  setOnboarded: () => { kv.set('onboarded', '1'); set({ onboarded: true }); },
  volumeMuscles: initialMuscles,
  toggleVolumeMuscle: (key) =>
    set((st) => {
      const volumeMuscles = st.volumeMuscles.includes(key) ? st.volumeMuscles.filter((k) => k !== key) : [...st.volumeMuscles, key];
      kv.set(MKEY, JSON.stringify(volumeMuscles));
      return { volumeMuscles };
    }),
}));
