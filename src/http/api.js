import { AppError, notFound, tooLarge } from '../projects/errors.js';
import { MAX_DOC_BYTES } from '../projects/service.js';
import { getService, getAuthService, getRequestService } from '../server/container.js';
import { verifyToken, TokenError } from '../auth/jwt.js';

const MAX_JSON_BYTES = 1_000_000;
const MAX_INT4 = 2_147_483_647;

export const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

// Usuario autenticado a partir de `Authorization: Bearer <accessToken>` (JWT, RI-09). Devuelve null si no hay
// token válido (las rutas responden 401). Un JWT_SECRET ausente o corto es un error de configuración (500).
// SOLO DESARROLLO/PRUEBAS: con ALLOW_DEV_HEADERS=true se aceptan x-user-id / x-user-roles; se ignora en producción.
export function currentUser(request) {
  const m = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') || '');
  if (m) {
    try {
      const c = verifyToken(m[1], { type: 'access' });
      return { id: String(c.sub), roles: Array.isArray(c.roles) ? c.roles : [] };
    } catch (e) {
      if (e instanceof TokenError && e.code !== 'NO_SECRET') return null;
      throw e;
    }
  }
  if (process.env.ALLOW_DEV_HEADERS === 'true' && process.env.NODE_ENV !== 'production') {
    const id = request.headers.get('x-user-id');
    if (!id) return null;
    const roles = String(request.headers.get('x-user-roles') || '')
      .split(',').map((r) => r.trim().toUpperCase()).filter(Boolean);
    return { id: String(id), roles };
  }
  return null;
}

export const maxDocBytes = () => Number(process.env.MAX_DOC_BYTES) || MAX_DOC_BYTES;

// Lee el cuerpo respetando un máximo: rechaza por Content-Length y también mientras llega el flujo.
export async function readLimited(request, limit) {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > limit) throw tooLarge(limit);
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      throw tooLarge(limit);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function readJson(request) {
  const raw = await readLimited(request, MAX_JSON_BYTES);
  if (!raw.length) return {};
  try { return JSON.parse(raw.toString('utf8')); }
  catch { throw new AppError(400, 'BAD_JSON', 'JSON inválido'); }
}

// IDs inexistentes o fuera del rango de INTEGER se tratan como 404 (evita errores 500 de PostgreSQL).
export function parseId(value) {
  const n = Number(value);
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(n) || n < 1 || n > MAX_INT4) throw notFound();
  return n;
}

// Envuelve un manejador de ruta: inyecta usuario/servicio/params y traduce errores a respuestas JSON.
export function route(handler) {
  return async (request, context) => {
    try {
      const params = context?.params ? await context.params : {};
      // `service` y `auth` son perezosos: cada ruta solo instancia el servicio que usa.
      return await handler({
        request, params, user: currentUser(request),
        get service() { return getService(); },
        get auth() { return getAuthService(); },
        get requests() { return getRequestService(); },
      });
    } catch (e) {
      if (e instanceof AppError) return json(e.status, { error: { code: e.code, message: e.message, fields: e.fields } });
      console.error(e);
      return json(500, { error: { code: 'INTERNAL', message: 'Error interno' } });
    }
  };
}
