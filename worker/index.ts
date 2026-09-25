export interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/api/health') return new Response('ok');
    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
