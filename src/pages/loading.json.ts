import type { APIRoute } from 'astro';
import { LOADING } from '../data/loading';

// Published as a static /loading.json so the hero terminal fetches its command list at
// runtime instead of bundling ~240 DFIR command strings into the page's JavaScript.
export const GET: APIRoute = () =>
  new Response(JSON.stringify(LOADING), {
    headers: { 'Content-Type': 'application/json' },
  });
