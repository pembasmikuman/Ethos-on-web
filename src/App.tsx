import { useEffect, type ComponentType } from 'react';
import './styles.css';
import { ROUTES } from './routes';
import { matchRoute, setRouteParams, usePathname } from './lib/nav';
import { useScheme, useTheme } from './lib/theme';
import { Dock } from './components/Dock';

export function App() {
  const path = usePathname();
  const t = useTheme();
  const scheme = useScheme();
  useEffect(() => {
    for (const [k, v] of Object.entries(t)) document.documentElement.style.setProperty(`--${k}`, v);
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', t.bg);
    document.documentElement.style.colorScheme = scheme;
  }, [t, scheme]);
  let Screen: ComponentType | null = null;
  for (const [pattern, C] of ROUTES) {
    const p = matchRoute(pattern, path);
    if (p) { setRouteParams(p); Screen = C; break; }
  }
  return (
    <div style={{ height: '100dvh', background: t.bg }}>
      {Screen ? <Screen key={path + location.search} /> : <p style={{ color: t.mute, padding: 24 }}>Not found</p>}
      <Dock />
    </div>
  );
}
