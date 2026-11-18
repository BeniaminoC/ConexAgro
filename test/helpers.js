import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { migrate } from '../src/db/migrate.js';
import { runTx } from '../src/db/pg.js';
import { createUserRepository } from '../src/auth/repository.js';
import { createAuthService } from '../src/auth/service.js';
import { setAuthService, setRequestService } from '../src/server/container.js';
import { createRequestRepository } from '../src/requests/repository.js';
import { createRequestService } from '../src/requests/service.js';
import * as rRoot from '../app/api/v1/requests/route.js';
import * as rById from '../app/api/v1/requests/[id]/route.js';
import * as rRespond from '../app/api/v1/requests/[id]/respond/route.js';
import * as aRegister from '../app/api/v1/auth/register/route.js';
import * as aVerify from '../app/api/v1/auth/verify-email/route.js';
import * as aResend from '../app/api/v1/auth/resend-verification/route.js';
import * as aLogin from '../app/api/v1/auth/login/route.js';
import * as aRefresh from '../app/api/v1/auth/refresh/route.js';
import * as aMe from '../app/api/v1/auth/me/route.js';
import { createProjectRepository } from '../src/projects/repository.js';
import { createProjectService } from '../src/projects/service.js';
import { setService } from '../src/server/container.js';
import * as root from '../app/api/v1/projects/route.js';
import * as mine from '../app/api/v1/projects/mine/route.js';
import * as byId from '../app/api/v1/projects/[id]/route.js';
import * as close from '../app/api/v1/projects/[id]/close/route.js';
import * as document from '../app/api/v1/projects/[id]/document/route.js';

// Entorno de pruebas: secreto JWT fijo y cabeceras de desarrollo habilitadas (las pruebas de proyectos las usan).
process.env.JWT_SECRET ??= 'secreto-de-pruebas-'.padEnd(40, 'x');
process.env.ALLOW_DEV_HEADERS = 'true';

export const MIGRATIONS_DIR = fileURLToPath(new URL('../db/migrations', import.meta.url));

// Crea una base PostgreSQL temporal, aplica las migraciones y registra el servicio que usan las rutas.
export async function setupTestDb() {
  const base = process.env.TEST_DATABASE_URL;
  if (!base) {
    throw new Error(
      'Define TEST_DATABASE_URL con un usuario que pueda crear bases de datos, p. ej. ' +
      'postgres://conexagro:conexagro@localhost:5432/postgres (ver .env.example).',
    );
  }
  const admin = new pg.Client({ connectionString: base });
  await admin.connect();
  const name = `conexagro_test_${randomBytes(4).toString('hex')}`;
  await admin.query(`CREATE DATABASE ${name}`);
  const url = new URL(base);
  url.pathname = `/${name}`;
  const pool = new pg.Pool({ connectionString: url.toString(), max: 5 });
  pool.on('error', () => {}); // al borrar la base con FORCE, el servidor puede cortar conexiones que el pool cierra
  const db = { query: (t, p) => pool.query(t, p), exec: (s) => pool.query(s), tx: (fn) => runTx(pool, fn) };
  await migrate(db, MIGRATIONS_DIR);
  const repo = createProjectRepository(db);
  setService(createProjectService(repo));
  // Correo capturado en memoria y reloj controlable para probar expiraciones sin esperar.
  const mail = [];
  const clock = { now: Date.now() };
  const mailer = { async sendVerification(m) { mail.push(m); } };
  const authService = createAuthService(createUserRepository(db), { mailer, now: () => clock.now });
  setAuthService(authService);
  setRequestService(createRequestService(createRequestRepository(db), { now: () => clock.now }));
  return {
    db,
    repo,
    mail,
    clock,
    authService,
    async teardown() {
      await pool.end();
      await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
      await admin.end();
    },
  };
}

// Despacha una petición a los mismos manejadores de ruta que usa Next.js, sin levantar servidor HTTP.
const table = [
  [/^$/, root, () => ({})],
  [/^\/mine$/, mine, () => ({})],
  [/^\/([^/]+)\/close$/, close, (m) => ({ id: m[1] })],
  [/^\/([^/]+)\/document$/, document, (m) => ({ id: m[1] })],
  [/^\/([^/]+)$/, byId, (m) => ({ id: m[1] })],
];

export async function api(method, path, { headers = {}, body } = {}) {
  let payload = body;
  const h = { ...headers };
  if (body !== undefined && typeof body === 'object' && !Buffer.isBuffer(body)) {
    payload = JSON.stringify(body);
    h['content-type'] ??= 'application/json';
  }
  const request = new Request(`http://test.local/api/v1/projects${path}`, { method, headers: h, body: payload });
  for (const [re, mod, mkParams] of table) {
    const m = path.match(re);
    if (!m) continue;
    const handler = mod[method];
    if (!handler) return { status: 405, body: null, buffer: Buffer.alloc(0), headers: new Headers() };
    const res = await handler(request, { params: Promise.resolve(mkParams(m)) });
    const buffer = Buffer.from(await res.arrayBuffer());
    const isJson = (res.headers.get('content-type') || '').includes('json');
    return { status: res.status, headers: res.headers, buffer, body: isJson ? JSON.parse(buffer.toString('utf8')) : null };
  }
  return { status: 404, body: null, buffer: Buffer.alloc(0), headers: new Headers() };
}

export const USERS = {
  PROD1: { 'x-user-id': 'p1', 'x-user-roles': 'PRODUCTOR' },
  PROD2: { 'x-user-id': 'p2', 'x-user-roles': 'PRODUCTOR' },
  OWNER: { 'x-user-id': 'o1', 'x-user-roles': 'PROPIETARIO' },
  INV: { 'x-user-id': 'i1', 'x-user-roles': 'INVERSIONISTA' },
  ADMIN: { 'x-user-id': 'a1', 'x-user-roles': 'ADMINISTRADOR' },
};

// Proyecto válido: todos los campos son obligatorios (decisión 3).
export const validProject = {
  nombre: 'Maíz tecnificado',
  descripcion: 'Siembra semestral con riego por goteo',
  tipoCultivo: 'Maíz',
  areaRequeridaHa: 12.5,
  ubicacionDeseada: 'Montería, Córdoba',
  montoInversion: 80000000,
  tiempoRetornoMeses: 8,
};

// Despacha una petición a las rutas /api/v1/auth/* (mismos manejadores que usa Next.js).
const authRoutes = { register: aRegister, 'verify-email': aVerify, 'resend-verification': aResend, login: aLogin, refresh: aRefresh, me: aMe };
export async function authApi(method, name, { headers = {}, body } = {}) {
  const h = { ...headers };
  if (body !== undefined) h['content-type'] ??= 'application/json';
  const request = new Request(`http://test.local/api/v1/auth/${name}`, {
    method, headers: h, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const res = await authRoutes[name][method](request, { params: Promise.resolve({}) });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
}

export const validRegistration = (over = {}) => ({
  nombreCompleto: 'Ana María Pérez', correo: 'ana@example.co', contrasena: 'Clave12345',
  tipoDocumento: 'CC', numeroDocumento: '1067000111', telefono: '3001234567',
  roles: ['PRODUCTOR'], aceptaTerminos: true, ...over,
});

// Despacha una petición a /api/v1/requests/** (mismos manejadores que usa Next.js).
export async function reqApi(method, path, { token, body } = {}) {
  const headers = token ? { authorization: `Bearer ${token}` } : {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  const request = new Request(`http://test.local/api/v1/requests${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  let mod = rRoot; let params = {};
  let m;
  if ((m = path.match(/^\/([^/?]+)\/respond$/))) { mod = rRespond; params = { id: m[1] }; }
  else if ((m = path.match(/^\/([^/?]+)$/))) { mod = rById; params = { id: m[1] }; }
  const res = await mod[method](request, { params: Promise.resolve(params) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}
