// JWT HS256 con node:crypto (sin dependencias). Reglas: RN-08 (acceso 1 h, refresco 7 días).
import { createHmac, timingSafeEqual } from 'node:crypto';

export const ACCESS_TTL_S = 60 * 60;            // 1 hora
export const REFRESH_TTL_S = 7 * 24 * 60 * 60;  // 7 días

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const HEADER = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));

export class TokenError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function secretOf(secret = process.env.JWT_SECRET) {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new TokenError('NO_SECRET', 'JWT_SECRET debe tener al menos 32 caracteres');
  }
  return secret;
}

const sign = (data, secret) => createHmac('sha256', secret).update(data).digest();

export function signToken({ sub, roles = [], type }, { ttl, now = Date.now(), secret } = {}) {
  if (!sub) throw new TokenError('BAD_CLAIMS', 'sub es obligatorio');
  if (type !== 'access' && type !== 'refresh') throw new TokenError('BAD_CLAIMS', 'type inválido');
  const iat = Math.floor(now / 1000);
  const ttlS = ttl ?? (type === 'access' ? ACCESS_TTL_S : REFRESH_TTL_S);
  const payload = b64u(JSON.stringify({ sub: String(sub), roles, type, iat, exp: iat + ttlS }));
  const data = `${HEADER}.${payload}`;
  return `${data}.${b64u(sign(data, secretOf(secret)))}`;
}

export function verifyToken(token, { type, now = Date.now(), secret } = {}) {
  const parts = typeof token === 'string' ? token.split('.') : [];
  if (parts.length !== 3) throw new TokenError('MALFORMED', 'Token mal formado');
  const [h, p, s] = parts;
  if (h !== HEADER) throw new TokenError('MALFORMED', 'Algoritmo no permitido'); // bloquea alg=none y otros
  const expected = sign(`${h}.${p}`, secretOf(secret));
  const given = Buffer.from(s, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new TokenError('BAD_SIGNATURE', 'Firma inválida');
  }
  let claims;
  try { claims = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')); }
  catch { throw new TokenError('MALFORMED', 'Carga inválida'); }
  if (!Number.isInteger(claims.exp) || Math.floor(now / 1000) >= claims.exp) {
    throw new TokenError('EXPIRED', 'Token expirado');
  }
  if (type && claims.type !== type) throw new TokenError('WRONG_TYPE', 'Tipo de token incorrecto');
  return claims;
}
