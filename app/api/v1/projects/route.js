import { route, json, readJson } from '../../../../src/http/api.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/projects — proyectos activos
export const GET = route(async ({ service, user }) => json(200, { data: await service.listActive(user) }));

// POST /api/v1/projects — publicar proyecto (RF-04)
export const POST = route(async ({ service, user, request }) =>
  json(201, { data: await service.create(user, await readJson(request)) }));
