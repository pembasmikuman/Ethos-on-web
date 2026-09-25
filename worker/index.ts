import { DurableObject } from 'cloudflare:workers';
import { allowedEndpoint, vapidAuth } from './vapid';

export interface Env {
  ASSETS: Fetcher;
  REST: DurableObjectNamespace<RestAlarm>;
  LIMIT: RateLimit;
  VAPID_PRIVATE_JWK: string;
  VAPID_PUBLIC_KEY: string;
}

const MAX_SECONDS = 600;
const SUB = 'https://ethos.pembasmikuman.my';

/** One per push endpoint (per device). Holds at most one pending rest alarm; a new schedule replaces it. */
export class RestAlarm extends DurableObject<Env> {
  async schedule(endpoint: string, seconds: number): Promise<void> {
    await this.ctx.storage.put('endpoint', endpoint);
    await this.ctx.storage.setAlarm(Date.now() + seconds * 1000);
  }
  async cancel(): Promise<void> {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }
  async alarm(): Promise<void> {
    const endpoint = await this.ctx.storage.get<string>('endpoint');
    await this.ctx.storage.deleteAll();
    if (!endpoint) return;
    const auth = await vapidAuth(endpoint, JSON.parse(this.env.VAPID_PRIVATE_JWK), this.env.VAPID_PUBLIC_KEY, SUB);
    await fetch(endpoint, { method: 'POST', headers: { Authorization: auth, TTL: '60', Urgency: 'high' } });
  }
}

const res = (status: number, body?: string) => new Response(body ?? null, { status });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/api/health') return res(200, 'ok');
    if (url.pathname !== '/api/rest') return res(404, 'Not found');
    if (req.method !== 'POST' && req.method !== 'DELETE') return res(405);
    const { success } = await env.LIMIT.limit({ key: req.headers.get('cf-connecting-ip') ?? 'none' });
    if (!success) return res(429, 'Slow down');
    const body = (await req.json().catch(() => ({}))) as { endpoint?: unknown; seconds?: unknown };
    const endpoint = typeof body.endpoint === 'string' ? body.endpoint : '';
    if (!allowedEndpoint(endpoint)) return res(400, 'Bad endpoint');
    const stub = env.REST.get(env.REST.idFromName(endpoint));
    if (req.method === 'DELETE') {
      await stub.cancel();
      return res(204);
    }
    const seconds = Number(body.seconds);
    if (!Number.isFinite(seconds) || seconds < 1 || seconds > MAX_SECONDS) return res(400, 'Bad seconds');
    await stub.schedule(endpoint, Math.round(seconds));
    return res(204);
  },
} satisfies ExportedHandler<Env>;
