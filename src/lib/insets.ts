type Insets = { top: number; bottom: number; left: number; right: number };
let cached: Insets | null = null;

/** Read env(safe-area-inset-*) once through a hidden probe. The notch doesn't move in portrait. */
export function useSafeAreaInsets(): Insets {
  if (cached) return cached;
  const p = document.createElement('div');
  p.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.append(p);
  const s = getComputedStyle(p);
  cached = { top: parseFloat(s.paddingTop), right: parseFloat(s.paddingRight), bottom: parseFloat(s.paddingBottom), left: parseFloat(s.paddingLeft) };
  p.remove();
  return cached;
}
