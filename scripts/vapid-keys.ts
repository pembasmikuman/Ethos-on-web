import { b64u } from '../worker/vapid';

/** Prints a new VAPID key pair as .env lines. Run once. */
const k = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
console.log(`VITE_VAPID_PUBLIC_KEY=${b64u(await crypto.subtle.exportKey('raw', k.publicKey))}`);
console.log(`VAPID_PRIVATE_JWK='${JSON.stringify(await crypto.subtle.exportKey('jwk', k.privateKey))}'`);
