import { createRoot } from 'react-dom/client';
import { openWorkerDb } from './db/client';
import { initDb } from './db';
import { loadKv } from './db/kv';

const root = createRoot(document.getElementById('root')!);

(async () => {
  try {
    await initDb(await openWorkerDb());
    await loadKv();
    navigator.storage?.persist?.().catch(() => {});
  } catch (e) {
    root.render(
      <div style={{ padding: 24, color: '#F2F2F0', background: '#0A0A0B', height: '100dvh', fontFamily: 'monospace' }}>
        <p>Ethos is open somewhere else. Close the other tab or window, then reload.</p>
        <p style={{ opacity: 0.5, fontSize: 12 }}>{String(e)}</p>
      </div>,
    );
    return;
  }
  // Stores read kv when their module loads, so the app is imported only after loadKv.
  const { App } = await import('./App');
  root.render(<App />);
})();
