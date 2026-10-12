// Compares a finished workout with the routine it was started from, so the changes can be
// offered for next time. Pure: the store passes in what it has, the DB work lives in queries.

/** One routine row as it was when the workout was previewed. */
export type PlanRow = { reId: string; exerciseId: string; name: string; sets: number };
/** One exercise of the workout. `reId` is the routine row it stands in for (none = added this
 *  session). `replaced` marks a block that was swapped out after sets were logged on it: it stays
 *  on screen for those sets but is no longer part of the plan. */
export type BlockLite = { reId?: string; replaced?: boolean; exerciseId: string; name: string; sets: { type: 'warmup' | 'working'; done: boolean }[] };

export type Change =
  | { kind: 'swap'; reId: string; exerciseId: string; label: string }
  | { kind: 'sets'; reId: string; sets: number; label: string }
  | { kind: 'add'; exerciseId: string; sets: number; label: string }
  | { kind: 'remove'; reId: string; label: string }
  | { kind: 'order'; label: string };

/** How many sets this exercise should have next time: the working sets actually logged. Warmups never count. */
export function setCount(sets: BlockLite['sets']): number {
  return sets.filter((x) => x.type === 'working' && x.done).length;
}

export function routineChanges(plan: PlanRow[], blocks: BlockLite[]): Change[] {
  const live = blocks.filter((b) => !b.replaced);
  const out: Change[] = [];
  for (const b of live) {
    const row = plan.find((r) => r.reId === b.reId);
    const n = setCount(b.sets);
    if (!row) {
      // Added but not logged yet: offer it with the sets it was given.
      const k = n || Math.max(1, b.sets.filter((x) => x.type === 'working').length);
      out.push({ kind: 'add', exerciseId: b.exerciseId, sets: k, label: `Add ${b.name} · ${k} sets` });
      continue;
    }
    if (row.exerciseId !== b.exerciseId) out.push({ kind: 'swap', reId: row.reId, exerciseId: b.exerciseId, label: `Swap ${row.name} for ${b.name}` });
    // Nothing logged means skipped today, not "drop to zero", so no set change is offered.
    if (n > 0 && n !== row.sets) out.push({ kind: 'sets', reId: row.reId, sets: n, label: `${b.name} · ${row.sets} → ${n} sets` });
  }
  for (const r of plan) if (!live.some((b) => b.reId === r.reId)) out.push({ kind: 'remove', reId: r.reId, label: `Remove ${r.name}` });
  const kept = live.flatMap((b) => (b.reId ? [b.reId] : []));
  const before = plan.map((r) => r.reId).filter((id) => kept.includes(id));
  if (kept.join() !== before.join()) out.push({ kind: 'order', label: 'Use this exercise order' });
  return out;
}
