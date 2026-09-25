import { create } from 'zustand';
import type { Exercise } from '../db';
import { deleteSession, finishSession, insertSet, recentExerciseSessions, routineExercises, startSession, type LoggedSet, type Routine, setExerciseNotes } from '../db/queries';
import { nextWeight, stalled, warmupRamp } from '../lib/progression';
import { cancelRestDone, scheduleRestDone } from '../lib/rest';
import { fmtKg } from '../lib/format';

export type Field = 'weight' | 'reps' | 'rir';
export type SetDraft = { id: number; type: 'warmup' | 'working'; weight: string; reps: string; rir: string; done: boolean };
export type ExerciseBlock = { exercise: Exercise; sets: SetDraft[]; prev: LoggedSet[]; overload: boolean; deload: boolean; why: string; stalled: boolean };

type State = {
  sessionId: string | null;
  routine: Routine | null;
  title: string;
  startedAt: number;
  blocks: ExerciseBlock[];
  exIdx: number;
  focus: { setIdx: number; field: Field };
  rest: { endsAt: number; total: number; notifId: string | null } | null;

  /** Load routine into a preview. No DB session, no clock. */
  preview: (routine: Routine) => Promise<void>;
  /** Start the DB session and clock for the previewed routine. */
  begin: () => Promise<void>;
  /** Insert exercise after current, or swap current (drops its unlogged sets). */
  addExercise: (ex: Exercise, swap?: boolean) => Promise<void>;
  removeExercise: (i: number) => void;
  reorderExercises: (from: number, to: number) => void;
  setExercise: (i: number) => void;
  setFocus: (setIdx: number, field: Field) => void;
  input: (value: string) => void;
  addSet: (type?: 'warmup' | 'working') => void;
  removeSet: (setIdx: number) => void;
  completeSet: () => Promise<void>;
  adjustRest: (deltaSeconds: number) => Promise<void>;
  skipRest: () => Promise<void>;
  /** Rest ran out on its own. Clears the timer but leaves the scheduled alert alone,
   *  so the bell still rings instead of being cancelled a moment before it fires. */
  restDone: () => void;
  finish: () => Promise<string | null>;
  setNotes: (exerciseId: string, notes: string) => Promise<void>;
  cancel: () => Promise<void>;
};

async function buildBlock(ex: Exercise, targetSets: number): Promise<ExerciseBlock> {
  const history = await recentExerciseSessions(ex.id, 3);
  const prev = history[0] ?? [];
  const next = nextWeight(prev, ex);
  const weight = next ? fmtKg(next.weight) : ex.load === 'bodyweight' ? '0' : '';
  return {
    exercise: ex,
    prev,
    overload: next?.overload ?? false,
    deload: next?.deload ?? false,
    why: next?.why ?? '',
    stalled: stalled(history, ex),
    sets: Array.from({ length: targetSets }, () => emptySet(weight)),
  };
}

let seq = 0;
const emptySet = (weight: string, type: 'warmup' | 'working' = 'working'): SetDraft => ({ id: ++seq, type, weight, reps: '', rir: '', done: false });

export const useWorkout = create<State>((set, get) => ({
  sessionId: null,
  routine: null,
  title: '',
  startedAt: 0,
  blocks: [],
  exIdx: 0,
  focus: { setIdx: 0, field: 'weight' },
  rest: null,

  async preview(routine) {
    const exs = await routineExercises(routine.id);
    const blocks: ExerciseBlock[] = [];
    for (const ex of exs) blocks.push(await buildBlock(ex, ex.target_sets));
    set({ sessionId: null, routine, title: routine.plan ? `${routine.plan} · ${routine.name}` : routine.name, startedAt: 0, blocks, exIdx: 0, focus: { setIdx: 0, field: 'weight' }, rest: null });
  },

  async begin() {
    const { routine, sessionId } = get();
    if (!routine || sessionId) return;
    set({ sessionId: await startSession(routine), startedAt: Date.now() });
  },

  async addExercise(ex, swap = false) {
    const { blocks, exIdx } = get();
    const cur = blocks[exIdx];
    const block = await buildBlock(ex, swap && cur ? Math.max(1, cur.sets.filter((x) => x.type === 'working').length) : 3);
    // Swap with logged sets keeps the old block so its sets stay visible.
    const replace = swap && cur && !cur.sets.some((x) => x.done);
    const idx = replace ? exIdx : exIdx + 1;
    const next = [...blocks];
    next.splice(idx, replace ? 1 : 0, block);
    set({ blocks: next, exIdx: idx, focus: { setIdx: 0, field: 'weight' } });
  },

  removeExercise(i) {
    const { blocks, exIdx } = get();
    const next = blocks.filter((_, k) => k !== i);
    set({ blocks: next, exIdx: Math.min(exIdx > i ? exIdx - 1 : exIdx, Math.max(0, next.length - 1)), focus: { setIdx: 0, field: 'weight' } });
  },

  reorderExercises(from, to) {
    const { blocks, exIdx } = get();
    const next = [...blocks];
    next.splice(to, 0, next.splice(from, 1)[0]);
    set({ blocks: next, exIdx: next.indexOf(blocks[exIdx]) });
  },

  setExercise(i) {
    set({ exIdx: i, focus: { setIdx: 0, field: 'weight' } });
  },

  setFocus(setIdx, field) {
    set({ focus: { setIdx, field } });
  },

  input(value) {
    const { blocks, exIdx, focus } = get();
    const next = blocks.map((b, bi) =>
      bi !== exIdx ? b : { ...b, sets: b.sets.map((s, si) => (si !== focus.setIdx ? s : { ...s, [focus.field]: value })) },
    );
    set({ blocks: next });
  },

  addSet(type = 'working') {
    const { blocks, exIdx } = get();
    const b = blocks[exIdx];
    const last = b.sets[b.sets.length - 1];
    let sets: SetDraft[];
    if (type === 'warmup') {
      const top = parseFloat(b.sets.find((x) => x.type === 'working')?.weight ?? '');
      const ramp = Number.isNaN(top) ? [] : warmupRamp(top);
      const warm = ramp.length ? ramp.map((r) => ({ ...emptySet(fmtKg(r.weight), 'warmup'), reps: String(r.reps) })) : [emptySet('', 'warmup')];
      sets = [...warm, ...b.sets.filter((x) => x.type !== 'warmup' || x.done)];
    } else {
      sets = [...b.sets, emptySet(last?.weight ?? '')];
    }
    set({ blocks: blocks.map((x, i) => (i === exIdx ? { ...x, sets } : x)) });
  },

  removeSet(setIdx) {
    const { blocks, exIdx, focus } = get();
    const sets = blocks[exIdx].sets.filter((_, i) => i !== setIdx);
    set({
      blocks: blocks.map((x, i) => (i === exIdx ? { ...x, sets } : x)),
      focus: { setIdx: Math.min(focus.setIdx, Math.max(0, sets.length - 1)), field: focus.field },
    });
  },

  async completeSet() {
    const { blocks, exIdx, focus, sessionId, rest } = get();
    if (!sessionId) return;
    const b = blocks[exIdx];
    const s = b.sets[focus.setIdx];
    const weight = parseFloat(s.weight);
    const reps = parseInt(s.reps, 10);
    if (Number.isNaN(weight) || Number.isNaN(reps)) return;
    const workingBefore = b.sets.slice(0, focus.setIdx).filter((x) => x.type === 'working').length;
    await insertSet({
      session_id: sessionId,
      exercise_id: b.exercise.id,
      set_number: s.type === 'warmup' ? 0 : workingBefore + 1,
      set_type: s.type,
      weight,
      reps,
      rir: s.rir === '' ? null : parseInt(s.rir, 10),
    });
    const sets = b.sets.map((x, i) => (i === focus.setIdx ? { ...x, done: true } : x));
    const nextIdx = sets.findIndex((x, i) => i > focus.setIdx && !x.done);
    await cancelRestDone(rest?.notifId ?? null);
    const total = b.exercise.default_rest_seconds;
    const notifId = await scheduleRestDone(total);
    set({
      blocks: blocks.map((x, i) => (i === exIdx ? { ...x, sets } : x)),
      focus: { setIdx: nextIdx === -1 ? focus.setIdx : nextIdx, field: nextIdx === -1 ? focus.field : 'reps' },
      rest: { endsAt: Date.now() + total * 1000, total, notifId },
    });
  },

  async adjustRest(delta) {
    const { rest, blocks, exIdx } = get();
    if (!rest) return;
    await cancelRestDone(rest.notifId);
    const endsAt = Math.max(Date.now(), rest.endsAt + delta * 1000);
    const secs = Math.round((endsAt - Date.now()) / 1000);
    const notifId = await scheduleRestDone(secs);
    set({ rest: { ...rest, endsAt, total: Math.max(rest.total + delta, secs), notifId } });
  },

  restDone() {
    set({ rest: null });
  },

  async skipRest() {
    const { rest } = get();
    await cancelRestDone(rest?.notifId ?? null);
    set({ rest: null });
  },

  async cancel() {
    const { sessionId, rest } = get();
    await cancelRestDone(rest?.notifId ?? null);
    if (sessionId) await deleteSession(sessionId);
    set({ sessionId: null, routine: null, blocks: [], rest: null });
  },

  async setNotes(exerciseId, notes) {
    await setExerciseNotes(exerciseId, notes);
    set({ blocks: get().blocks.map((b) => (b.exercise.id === exerciseId ? { ...b, exercise: { ...b.exercise, notes } } : b)) });
  },

  async finish() {
    const { sessionId, rest } = get();
    await cancelRestDone(rest?.notifId ?? null);
    if (sessionId) await finishSession(sessionId);
    set({ sessionId: null, routine: null, blocks: [], rest: null });
    return sessionId;
  },
}));
