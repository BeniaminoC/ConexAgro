import { route, json, readJson } from '../../../../../src/http/api.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/v1/auth/register — registro público (RF-01)
export const POST = route(async ({ auth, request }) => json(201, { data: await auth.register(await readJson(request)) }));
