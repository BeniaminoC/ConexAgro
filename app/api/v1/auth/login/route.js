import { route, json, readJson } from '../../../../../src/http/api.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/v1/auth/login { correo, contrasena } — RF-02
export const POST = route(async ({ auth, request }) => json(200, { data: await auth.login(await readJson(request)) }));
