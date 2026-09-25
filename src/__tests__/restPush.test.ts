import { beforeAll, expect, test } from 'bun:test';

// Just enough of a subscribed iPhone for rest.ts: permission granted, a service worker that answers after `readyMs`.
const ENDPOINT = 'https://web.push.apple.com/abc';
const sent: { method: string; body: { endpoint: string; seconds?: number } }[] = [];
let postGate: Promise<void> = Promise.resolve();
let readyMs = 0;

beforeAll(() => {
  Object.assign(globalThis, { window: globalThis, PushManager: class {}, Notification: { permission: 'granted' } });
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    get: () => ({ ready: new Promise((r) => setTimeout(() => r({ pushManager: { getSubscription: async () => ({ endpoint: ENDPOINT }) } }), readyMs)) }),
  });
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    sent.push({ method: String(init.method), body });
    if (init.method === 'POST') await postGate;
    return new Response(null, { status: 200 });
  }) as typeof fetch;
});

test('skipping rest before the server has answered the schedule still cancels the alarm', async () => {
  const { ensurePush, scheduleRestDone, cancelRestDone } = await import('../lib/rest');
  sent.length = 0;
  let open!: () => void;
  postGate = new Promise((r) => (open = r));
  ensurePush();
  const scheduled = scheduleRestDone(Date.now() + 90_000);
  await new Promise((r) => setTimeout(r, 20)); // POST is out, no answer yet
  const cancelled = cancelRestDone();
  open();
  await Promise.all([scheduled, cancelled]);
  expect(sent.map((s) => s.method)).toEqual(['POST', 'DELETE']);
  expect(sent[1].body.endpoint).toBe(ENDPOINT);
});

test('the delay sent is what is left when the request goes out, not when rest started', async () => {
  const { ensurePush, scheduleRestDone } = await import('../lib/rest');
  sent.length = 0;
  postGate = Promise.resolve();
  readyMs = 1100; // e.g. the permission prompt stayed up for a second
  ensurePush();
  await scheduleRestDone(Date.now() + 60_000);
  expect(sent[0].body.seconds).toBe(59);
});
