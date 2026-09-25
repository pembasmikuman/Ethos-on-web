import { createContext, useContext, useEffect, useSyncExternalStore, type EffectCallback } from 'react';

// Navigation like an iPhone tab bar app: each tab has its own stack of screens, and every screen in every
// stack stays mounted, so switching tabs or going back finds a screen exactly as it was (scroll, search,
// carousel). Only the top screen of the current tab is shown. The address bar just mirrors that screen.

export type Tab = 'home' | 'history' | 'log' | 'exercises' | 'settings';
export type Entry = { k: number; href: string };
/** The last screen change, for the slide: 'push' slides the new screen in over `from`, 'pop' slides `from` away. */
export type Move = { kind: 'push' | 'pop'; from: Entry; fromTab: Tab };
type Nav = { tab: Tab; stacks: Record<Tab, Entry[]>; move: Move | null };

export const TAB_ROOT: Record<Tab, string> = { home: '/', history: '/history', log: '/session', exercises: '/exercises', settings: '/settings' };
const TABS = Object.keys(TAB_ROOT) as Tab[];
// The workout screens always live in the Log tab, wherever they are opened from.
const LOG_ONLY = ['/session', '/workout', '/rest'];

const pathOf = (href: string) => href.split('?')[0];
const rootTab = (path: string) => TABS.find((t) => TAB_ROOT[t] === path);
const owner = (path: string): Tab | undefined => rootTab(path) ?? (LOG_ONLY.includes(path) ? 'log' : undefined);

let seq = 0;
const entry = (href: string): Entry => ({ k: ++seq, href });
const empty = (): Record<Tab, Entry[]> => ({ home: [], history: [], log: [], exercises: [], settings: [] });
let nav: Nav = { tab: 'home', stacks: { ...empty(), home: [entry('/')] }, move: null };

const listeners = new Set<() => void>();
const topOf = (n: Pick<Nav, 'tab' | 'stacks'>) => n.stacks[n.tab].at(-1)!;
const emit = () => { for (const l of listeners) l(); };
/** Apply a change. `kind` says how it slides; none for tab switches, replaces and resets. */
function commit(next: Pick<Nav, 'tab' | 'stacks'>, kind: Move['kind'] | null = null) {
  const from = topOf(nav);
  nav = { ...next, move: kind && topOf(next).k !== from.k ? { kind, from, fromTab: nav.tab } : null };
  const top = next.stacks[next.tab].at(-1)!.href;
  if (typeof history !== 'undefined' && location.pathname + location.search !== top) history.replaceState(null, '', top);
  emit();
}
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };

export const navState = (): Nav => nav;

/** The stack a tab starts with: its first screen, plus `href` on top when that is somewhere deeper. */
function seed(tab: Tab, href?: string): Entry[] {
  const root = entry(TAB_ROOT[tab]);
  return href && pathOf(href) !== TAB_ROOT[tab] ? [root, entry(href)] : [href ? entry(href) : root];
}

/** Start from an address, as on launch or reload. Deeper screens get their tab's first screen under them. */
export function resetNav(href: string): void {
  const path = pathOf(href);
  const tab = owner(path) ?? (path.startsWith('/history') ? 'history' : path.startsWith('/exercise') ? 'exercises' : 'home');
  commit({ tab, stacks: { ...empty(), [tab]: seed(tab, href) } });
}

/** Put `href` on top of `tab`'s stack. A workout screen already in the stack is gone back to, anything else is pushed. */
function open(n: Pick<Nav, 'tab' | 'stacks'>, tab: Tab, href: string): Pick<Nav, 'tab' | 'stacks'> {
  let st = n.stacks[tab].length ? n.stacks[tab] : seed(tab);
  const at = st.findIndex((e) => pathOf(e.href) === pathOf(href));
  if (at >= 0 && LOG_ONLY.includes(pathOf(href))) st = st.slice(0, at + 1);
  else if (st.at(-1)!.href !== href) st = [...st, entry(href)];
  return { tab, stacks: { ...n.stacks, [tab]: st } };
}

function go(href: string, replace: boolean): void {
  const path = pathOf(href);
  const to = owner(path);
  if (to && to !== nav.tab) {
    // Another tab's first screen switches to that tab as it was left; a workout screen is opened inside Log.
    const n = { ...nav, tab: to, stacks: { ...nav.stacks, [to]: nav.stacks[to].length ? nav.stacks[to] : seed(to) } };
    return commit(rootTab(path) ? n : open(n, to, href), 'push');
  }
  const cur = nav.stacks[nav.tab];
  if (replace) return commit({ ...nav, stacks: { ...nav.stacks, [nav.tab]: [...cur.slice(0, -1), entry(href)] } });
  const next = open(nav, nav.tab, href);
  commit(next, next.stacks[nav.tab].length < cur.length ? 'pop' : 'push');
}

function pop(n: number): void {
  const cur = nav.stacks[nav.tab];
  if (cur.length > 1) return commit({ ...nav, stacks: { ...nav.stacks, [nav.tab]: cur.slice(0, Math.max(1, cur.length - n)) } }, 'pop');
  if (nav.tab !== 'home') commit({ ...nav, tab: 'home' }, 'pop');
}

export const router = {
  push: (href: string) => go(href, false),
  navigate: (href: string) => go(href, false),
  replace: (href: string) => go(href, true),
  back: () => pop(1),
  /** Pop `n` screens off the current tab. */
  dismiss: (n: number) => pop(n),
  /** Leave the workout: its tab is cleared, `href`'s tab starts over at `href`, with `then` on top. */
  dismissTo(href: string, then?: string) {
    const tab = owner(pathOf(href)) ?? 'home';
    commit({ tab, stacks: { ...nav.stacks, log: [], [tab]: [entry(href), ...(then ? [entry(then)] : [])] } }, then ? 'push' : 'pop');
  },
  /** Dock tap. Another tab: switch to it as it was left. The current tab: pop to its first screen,
   *  or report 'at-root' so the caller can scroll to the top. */
  tab(t: Tab): 'switched' | 'popped' | 'at-root' {
    if (t !== nav.tab) {
      commit({ ...nav, tab: t, stacks: { ...nav.stacks, [t]: nav.stacks[t].length ? nav.stacks[t] : seed(t) } });
      return 'switched';
    }
    const cur = nav.stacks[t];
    if (cur.length === 1) return 'at-root';
    commit({ ...nav, stacks: { ...nav.stacks, [t]: cur.slice(0, 1) } }, 'pop');
    return 'popped';
  },
  /** A slide finished: forget it, unless a newer change has already replaced it. */
  settle(m: Move) {
    if (nav.move !== m) return;
    nav = { ...nav, move: null };
    emit();
  },
  /** The workout ended somewhere other than its own screens (e.g. a restore): drop its tab. */
  clearLog() {
    if (!nav.stacks.log.length) return;
    commit({ tab: nav.tab === 'log' ? 'home' : nav.tab, stacks: { ...nav.stacks, log: [] } });
  },
};

export function useNav(): Nav {
  return useSyncExternalStore(subscribe, navState);
}

export function usePathname(): string {
  const n = useNav();
  return pathOf(n.stacks[n.tab].at(-1)!.href);
}

export function matchRoute(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/').filter(Boolean), b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const out: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) out[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return out;
}

/** What each mounted screen knows about itself: its own params, and whether it is the one showing. */
export const ScreenContext = createContext<{ params: Record<string, string>; focused: boolean }>({ params: {}, focused: true });

/** Path params plus query string of this screen, like expo-router's hook. */
export function useLocalSearchParams<T extends Record<string, string | undefined> = Record<string, string>>(): T {
  return useContext(ScreenContext).params as T;
}

export const useIsFocused = () => useContext(ScreenContext).focused;

/** Runs each time this screen comes into view (and cleans up when it leaves), like react-navigation's. */
export function useFocusEffect(cb: EffectCallback): void {
  const focused = useIsFocused();
  useEffect(() => (focused ? cb() : undefined), [cb, focused]);
}

export function Redirect({ href }: { href: string }) {
  useEffect(() => router.replace(href), [href]);
  return null;
}
