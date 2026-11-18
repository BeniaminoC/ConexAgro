import { route, json, readJson } from '../../../../../src/http/api.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/v1/auth/refresh { refreshToken } — nuevo token de acceso (RN-08)
export const POST = route(async ({ auth, request }) => json(200, { data: await auth.refresh(await readJson(request)) }));
