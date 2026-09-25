import { expect, test } from 'bun:test';
import { allowedEndpoint, b64u, vapidAuth } from './vapid';

test('only real push services are allowed', () => {
  expect(allowedEndpoint('https://web.push.apple.com/abc')).toBe(true);
  expect(allowedEndpoint('https://fcm.googleapis.com/fcm/send/x')).toBe(true);
  expect(allowedEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true);
  expect(allowedEndpoint('https://evil.com/web.push.apple.com')).toBe(false);
  expect(allowedEndpoint('https://push.apple.com.evil.com/x')).toBe(false);
  expect(allowedEndpoint('http://web.push.apple.com/x')).toBe(false);
  expect(allowedEndpoint('not a url')).toBe(false);
});

test('vapid header carries a JWT that verifies with the public key', async () => {
  const k = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = b64u(await crypto.subtle.exportKey('raw', k.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', k.privateKey);
  const h = await vapidAuth('https://web.push.apple.com/abc', jwk, pub, 'https://ethos.pembasmikuman.my', 1_000_000_000_000);
  const [, t, kk] = h.match(/^vapid t=([^,]+), k=(.+)$/)!;
  expect(kk).toBe(pub);
  const [head, body, sig] = t.split('.');
  const dec = (s: string) => JSON.parse(atob(s.replace(/-/g, '+').replace(/_/g, '/')));
  expect(dec(head)).toEqual({ typ: 'JWT', alg: 'ES256' });
  expect(dec(body)).toEqual({ aud: 'https://web.push.apple.com', exp: 1_000_000_000 + 12 * 3600, sub: 'https://ethos.pembasmikuman.my' });
  const raw = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  expect(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k.publicKey, raw, new TextEncoder().encode(`${head}.${body}`))).toBe(true);
});
