import data from '../data/library.json';

export type LibraryEntry = { id: string; name: string; muscle: string; secondary: string; equipment: string; steps: string[]; gif: string };

export const LIBRARY = data as LibraryEntry[];

const byId = new Map(LIBRARY.map((e) => [e.id, e]));

export const libraryEntry = (id: string): LibraryEntry | undefined => byId.get(id);

/** Case-insensitive, every word must appear in name, muscle or equipment. Empty query = nothing. */
export function searchLibrary(q: string, limit = 20, list: LibraryEntry[] = LIBRARY): LibraryEntry[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const out: LibraryEntry[] = [];
  for (const e of list) {
    const hay = `${e.name} ${e.muscle} ${e.equipment}`.toLowerCase();
    if (words.every((w) => hay.includes(w))) {
      out.push(e);
      if (out.length >= limit) break;
    }
  }
  return out;
}
