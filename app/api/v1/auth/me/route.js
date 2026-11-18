import { route, json } from '../../../../../src/http/api.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/auth/me — perfil del usuario autenticado
export const GET = route(async ({ auth, user }) => json(200, { data: await auth.me(user) }));
