/** Group exercises by movement (or base name when no movement set). Keeps input order. */
export function groupVariants<T extends { base?: string; name: string; movement?: string; primary_muscle: string }>(list: T[]): { key: string; base: string; muscle: string; items: T[] }[] {
  const out: { key: string; base: string; muscle: string; items: T[] }[] = [];
  for (const e of list) {
    const base = e.movement || e.base || e.name;
    const key = `${e.primary_muscle}|${base}`;
    const g = out.find((x) => x.key === key);
    if (g) g.items.push(e);
    else out.push({ key, base, muscle: e.primary_muscle, items: [e] });
  }
  return out;
}

// The exercise library names everything by its gear, so "Leg Extension" arrives as
// "Lever Leg Extension" and would sit apart from the one already in the list. Longest
// qualifier first, so "Ez Barbell Curl" loses both words.
const QUALIFIERS = ['Ez Barbell', 'Resistance Band', 'Medicine Ball', 'Olympic Barbell', 'Smith Machine', 'Trap Bar', 'Barbell', 'Dumbbell', 'Kettlebell', 'Bodyweight', 'Machine', 'Assisted', 'Weighted', 'Cable', 'Lever', 'Smith', 'Sled', 'Band'];

/** Drop the gear off the front of a name: "Lever Leg Extension" -> "Leg Extension". */
export function baseMove(name: string): string {
  for (const q of QUALIFIERS) {
    if (name.length > q.length + 1 && name.slice(0, q.length + 1).toLowerCase() === `${q.toLowerCase()} `) return name.slice(q.length + 1);
  }
  return name;
}

/** Movement group for a name coming out of the library. Strips the gear, then joins the
 *  group of an exercise already filed under that move rather than starting a second one. */
export function movementFor(name: string, muscle: string, existing: { name: string; base?: string; movement?: string; primary_muscle: string }[]): string {
  const base = baseMove(name);
  const hit = existing.find((e) => e.primary_muscle === muscle && (e.movement === base || baseMove(e.base ?? e.name) === base));
  return hit?.movement || base;
}
