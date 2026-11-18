import { route, json, readJson } from '../../../../src/http/api.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/requests?box=recibidas|enviadas — solicitudes propias (RN-27)
export const GET = route(async ({ requests, user, request }) =>
  json(200, { data: await requests.list(user, new URL(request.url).searchParams.get('box')) }));

// POST /api/v1/requests — enviar solicitud (RF-07)
export const POST = route(async ({ requests, user, request }) =>
  json(201, { data: await requests.create(user, await readJson(request)) }));
