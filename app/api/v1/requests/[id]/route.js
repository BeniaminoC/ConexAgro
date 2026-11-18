import { route, json, parseId } from '../../../../../src/http/api.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/requests/:id — detalle con historial (solo emisor o receptor)
export const GET = route(async ({ requests, user, params }) =>
  json(200, { data: await requests.get(user, parseId(params.id)) }));
