type Env = { hasPush: boolean; permission: NotificationPermission; subscribed: boolean };

const hasPush = () => typeof window !== 'undefined' && 'PushManager' in window && 'Notification' in window && 'serviceWorker' in navigator;

function keyBytes(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

let sub: Promise<PushSubscription | null> = Promise.resolve(null);
let subscribed = false;

/** Ask for notification permission and subscribe. iOS only shows the prompt inside a tap, so call this
 *  first thing in the tap handler, before any await. Safe to call on every tap. */
export function ensurePush(): void {
  if (!hasPush() || Notification.permission === 'denied') return;
  const perm = Notification.permission === 'granted' ? Promise.resolve('granted' as const) : Notification.requestPermission();
  sub = perm
    .then(async (p) => {
      if (p !== 'granted') return null;
      // ready never resolves without a registered SW (e.g. `bun run dev`), so give up after 4 s.
      const reg = await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('no service worker')), 4000))]);
      const s = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(import.meta.env.VITE_VAPID_PUBLIC_KEY) }));
      subscribed = true;
      return s;
    })
    .catch(() => null);
}

// One request at a time, in order, so a cancel can never overtake the schedule it is cancelling.
let chain: Promise<unknown> = Promise.resolve();
function post(method: 'POST' | 'DELETE', body: object): Promise<Response> {
  const p = chain.then(() =>
    fetch('/api/rest', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(4000) }),
  );
  chain = p.catch(() => {});
  return p;
}

/** Ask the server to push "Rest done" in `seconds`, replacing any pending one for this device.
 *  Returns the endpoint as the id, or null (no permission, offline, timed out). Never await this in the logging path. */
export async function scheduleRestDone(seconds: number): Promise<string | null> {
  if (seconds < 1) return null;
  const s = await sub;
  if (!s) return null;
  try {
    return (await post('POST', { endpoint: s.endpoint, seconds })).ok ? s.endpoint : null;
  } catch {
    return null;
  }
}

export async function cancelRestDone(id: string | null): Promise<void> {
  if (id) await post('DELETE', { endpoint: id }).catch(() => {});
}

export function alertStatus(env: Env = { hasPush: hasPush(), permission: hasPush() ? Notification.permission : 'default', subscribed }): 'on' | 'off' | 'blocked' | 'unsupported' {
  if (!env.hasPush) return 'unsupported';
  if (env.permission === 'denied') return 'blocked';
  return env.permission === 'granted' ? 'on' : 'off';
}
