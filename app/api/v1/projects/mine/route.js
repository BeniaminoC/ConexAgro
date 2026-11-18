import { route, json } from '../../../../../src/http/api.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/projects/mine — todos los proyectos del autor (incluye cerrados)
export const GET = route(async ({ service, user }) => json(200, { data: await service.listMine(user) }));
