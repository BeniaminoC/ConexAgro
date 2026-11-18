import { route, json, readJson } from '../../../../../src/http/api.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/v1/auth/verify-email { token } — confirma el correo (RF-01 pasos 6-7)
export const POST = route(async ({ auth, request }) => json(200, { data: await auth.verifyEmail(await readJson(request)) }));
