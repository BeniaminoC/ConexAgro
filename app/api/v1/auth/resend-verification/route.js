import { route, json, readJson } from '../../../../../src/http/api.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/v1/auth/resend-verification { correo } — reenvío del enlace (FA-03)
export const POST = route(async ({ auth, request }) => json(200, { data: await auth.resendVerification(await readJson(request)) }));
