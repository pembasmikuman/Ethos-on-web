import { useEffect, useSyncExternalStore, type EffectCallback } from 'react';

// Every entry we push records its depth, so back() and dismissTo() know if there is anywhere to go.
type St = { d: number } | null;
const depth = () => (history.state as St)?.d ?? 0;
const emit = () => dispatchEvent(new Event('nav'));

function subscribe(cb: () => void) {
  addEventListener('popstate', cb);
  addEventListener('nav', cb);
  return () => { removeEventListener('popstate', cb); removeEventListener('nav', cb); };
}

export const router = {
  push(href: string) { history.pushState({ d: depth() + 1 }, '', href); emit(); },
  navigate(href: string) { if (location.pathname + location.search !== href) router.push(href); },
  replace(href: string) { history.replaceState({ d: depth() }, '', href); emit(); },
  /** Pop `n` screens, as far as this app's own history goes. */
  dismiss(n: number) { const d = Math.min(n, depth()); if (d > 0) history.go(-d); else router.replace('/'); },
  back() { if (depth() > 0) history.back(); else router.replace('/'); },
  /** Pop to the first entry and show `href` there, then optionally push `then` on top. */
  dismissTo(href: string, then?: string) {
    const d = depth();
    const land = () => { history.replaceState({ d: 0 }, '', href); if (then) history.pushState({ d: 1 }, '', then); emit(); };
    if (d === 0) return land();
    addEventListener('popstate', land, { once: true });
    history.go(-d);
  },
};

export function usePathname(): string {
  return useSyncExternalStore(subscribe, () => location.pathname);
}

export function useSearch(): string {
  return useSyncExternalStore(subscribe, () => location.search);
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

let routeParams: Record<string, string> = {};
/** Set by App for the matched route. */
export const setRouteParams = (p: Record<string, string>) => { routeParams = p; };

/** Path params plus query string, like expo-router's hook. */
export function useLocalSearchParams<T extends Record<string, string | undefined> = Record<string, string>>(): T {
  const search = useSearch();
  return { ...Object.fromEntries(new URLSearchParams(search)), ...routeParams } as T;
}

/** Screens remount on every navigation, so "focus" is mount. */
export function useFocusEffect(cb: EffectCallback): void {
  useEffect(cb, [cb]);
}

export function Redirect({ href }: { href: string }) {
  useEffect(() => router.replace(href), [href]);
  return null;
}
