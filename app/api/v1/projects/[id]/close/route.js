import { route, json, parseId } from '../../../../../../src/http/api.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/v1/projects/:id/close — cierre definitivo (autor o administrador)
export const POST = route(async ({ service, user, params }) =>
  json(200, { data: await service.close(user, parseId(params.id)) }));
