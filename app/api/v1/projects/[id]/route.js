import { route, json, readJson, parseId } from '../../../../../src/http/api.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/projects/:id — detalle (incluye metadatos del documento de soporte)
export const GET = route(async ({ service, user, params }) =>
  json(200, { data: await service.get(user, parseId(params.id)) }));

// PATCH /api/v1/projects/:id — edición parcial (autor o administrador)
export const PATCH = route(async ({ service, user, params, request }) =>
  json(200, { data: await service.update(user, parseId(params.id), await readJson(request)) }));
