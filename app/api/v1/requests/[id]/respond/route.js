import { route, json, parseId, readJson } from '../../../../../../src/http/api.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/v1/requests/:id/respond { accion: aceptar|rechazar|contraproponer, mensaje?, condiciones? }
export const POST = route(async ({ requests, user, params, request }) => {
  const body = await readJson(request);
  return json(200, { data: await requests.respond(user, parseId(params.id), body?.accion, body) });
});
