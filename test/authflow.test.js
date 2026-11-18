import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestDb, authApi, api, validRegistration, validProject } from './helpers.js';

let ctx;
before(async () => { ctx = await setupTestDb(); });
after(async () => { await ctx.teardown(); });

const lastToken = () => ctx.mail.at(-1).token;
const bearer = (t) => ({ authorization: `Bearer ${t}` });

async function registerAndVerify(over = {}) {
  const body = validRegistration(over);
  const r = await authApi('POST', 'register', { body });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const v = await authApi('POST', 'verify-email', { body: { token: lastToken() } });
  assert.equal(v.status, 200, JSON.stringify(v.body));
  return body;
}

test('registro: crea usuario sin verificar, guarda bcrypt (RN-10) y envía el token solo por correo', async () => {
  const r = await authApi('POST', 'register', { body: validRegistration({ correo: 'Reg@Example.co', numeroDocumento: 'REG0001' }) });
  assert.equal(r.status, 201);
  assert.equal(r.body.data.correoEnviado, true);
  assert.equal(JSON.stringify(r.body).includes(lastToken()), false); // el token no viaja en la respuesta
  const u = (await ctx.db.query("SELECT * FROM usuarios WHERE lower(correo)='reg@example.co'")).rows[0];
  assert.match(u.contrasena_hash, /^\$2[aby]\$(1\d|[2-9]\d)\$/); // bcrypt con >= 10 rondas
  assert.notEqual(u.contrasena_hash, 'Clave12345');
  assert.equal(u.correo_verificado, false);
  const v = (await ctx.db.query('SELECT token_hash FROM verificaciones_correo WHERE usuario_id=$1', [u.id])).rows[0];
  assert.notEqual(v.token_hash, lastToken()); // solo se guarda el hash
});

test('registro: datos inválidos señalan campos; admin y los tres perfiles se rechazan (RN-05)', async () => {
  let r = await authApi('POST', 'register', { body: validRegistration({ correo: 'x', contrasena: '123' }) });
  assert.equal(r.status, 400);
  assert.ok(r.body.error.fields.correo && r.body.error.fields.contrasena);
  r = await authApi('POST', 'register', { body: validRegistration({ roles: ['ADMINISTRADOR'] }) });
  assert.equal(r.status, 400); assert.ok(r.body.error.fields.roles);
  r = await authApi('POST', 'register', { body: validRegistration({ roles: ['PROPIETARIO', 'PRODUCTOR', 'INVERSIONISTA'] }) });
  assert.equal(r.status, 400);
  r = await authApi('POST', 'register', { body: validRegistration({ aceptaTerminos: false }) });
  assert.equal(r.status, 400);
});

test('registro: correo (sin distinguir mayúsculas) y documento únicos → 409 por campo (RN-01/02)', async () => {
  await authApi('POST', 'register', { body: validRegistration({ correo: 'uni@example.co', numeroDocumento: 'UNI0001' }) });
  let r = await authApi('POST', 'register', { body: validRegistration({ correo: 'UNI@example.co', numeroDocumento: 'UNI0002' }) });
  assert.equal(r.status, 409); assert.ok(r.body.error.fields.correo);
  r = await authApi('POST', 'register', { body: validRegistration({ correo: 'otro@example.co', numeroDocumento: 'UNI0001' }) });
  assert.equal(r.status, 409); assert.ok(r.body.error.fields.numeroDocumento);
});

test('login: sin verificar el correo no entra (RN-04); verificado sí y devuelve tokens (RN-08)', async () => {
  const body = validRegistration({ correo: 'nv@example.co', numeroDocumento: 'NV00001' });
  await authApi('POST', 'register', { body });
  let r = await authApi('POST', 'login', { body: { correo: body.correo, contrasena: body.contrasena } });
  assert.equal(r.status, 403); assert.equal(r.body.error.code, 'EMAIL_NOT_VERIFIED');
  await authApi('POST', 'verify-email', { body: { token: lastToken() } });
  r = await authApi('POST', 'login', { body: { correo: 'NV@example.co', contrasena: body.contrasena } });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.expiresIn, 3600);
  assert.deepEqual(r.body.data.user.roles, ['PRODUCTOR']);
  assert.equal('contrasenaHash' in r.body.data.user, false);
});

test('verificación: token usado, inválido y expirado a las 24 h; el reenvío emite uno nuevo (RN-03, FA-03)', async () => {
  const body = validRegistration({ correo: 'ver@example.co', numeroDocumento: 'VER0001' });
  await authApi('POST', 'register', { body });
  const t1 = lastToken();
  ctx.clock.now += 24 * 3600_000 + 1000; // pasan 24 h
  let r = await authApi('POST', 'verify-email', { body: { token: t1 } });
  assert.equal(r.status, 410); assert.equal(r.body.error.code, 'TOKEN_EXPIRED');
  r = await authApi('POST', 'resend-verification', { body: { correo: body.correo } });
  assert.equal(r.status, 200);
  const t2 = lastToken(); assert.notEqual(t1, t2);
  r = await authApi('POST', 'verify-email', { body: { token: t1 } }); // el anterior fue descartado
  assert.equal(r.status, 400);
  r = await authApi('POST', 'verify-email', { body: { token: t2 } });
  assert.equal(r.status, 200);
  r = await authApi('POST', 'verify-email', { body: { token: t2 } });
  assert.equal(r.status, 409); assert.equal(r.body.error.code, 'TOKEN_USED');
  r = await authApi('POST', 'verify-email', { body: { token: 'basura' } });
  assert.equal(r.status, 400);
});

test('reenvío: misma respuesta exista o no el correo (no revela cuentas) y no envía a desconocidos', async () => {
  const antes = ctx.mail.length;
  const r = await authApi('POST', 'resend-verification', { body: { correo: 'nadie@example.co' } });
  assert.equal(r.status, 200);
  assert.equal(ctx.mail.length, antes);
});

test('login: 5 fallos bloquean 30 min (423), aun con la clave correcta; luego entra y reinicia el contador (RN-06/07)', async () => {
  const body = await registerAndVerify({ correo: 'lock@example.co', numeroDocumento: 'LOCK001' });
  const bad = { correo: body.correo, contrasena: 'incorrecta1' };
  for (let i = 0; i < 4; i++) assert.equal((await authApi('POST', 'login', { body: bad })).status, 401);
  assert.equal((await authApi('POST', 'login', { body: bad })).status, 423); // el 5.º bloquea
  const ok = { correo: body.correo, contrasena: body.contrasena };
  assert.equal((await authApi('POST', 'login', { body: ok })).status, 423);
  ctx.clock.now += 29 * 60_000;
  assert.equal((await authApi('POST', 'login', { body: ok })).status, 423);
  ctx.clock.now += 61_000; // ya pasaron 30 min
  assert.equal((await authApi('POST', 'login', { body: ok })).status, 200);
  const u = (await ctx.db.query("SELECT intentos_fallidos, bloqueado_hasta FROM usuarios WHERE correo=$1", [body.correo])).rows[0];
  assert.equal(u.intentos_fallidos, 0); assert.equal(u.bloqueado_hasta, null);
});

test('login: intentos simultáneos no se saltan el límite (conteo atómico)', async () => {
  const body = await registerAndVerify({ correo: 'race@example.co', numeroDocumento: 'RACE001' });
  const rs = await Promise.all(Array.from({ length: 8 }, () =>
    authApi('POST', 'login', { body: { correo: body.correo, contrasena: 'incorrecta1' } })));
  const u = (await ctx.db.query('SELECT intentos_fallidos, bloqueado_hasta FROM usuarios WHERE correo=$1', [body.correo])).rows[0];
  assert.ok(u.intentos_fallidos >= 5 && u.bloqueado_hasta);
  assert.ok(rs.filter((r) => r.status === 401 || r.status === 423).length === 8);
});

test('login: mensajes genéricos (correo inexistente = clave mala) y cuenta desactivada (RF-02 FA-02)', async () => {
  const body = await registerAndVerify({ correo: 'act@example.co', numeroDocumento: 'ACT0001' });
  const a = await authApi('POST', 'login', { body: { correo: 'noexiste@example.co', contrasena: 'Clave12345' } });
  const b = await authApi('POST', 'login', { body: { correo: body.correo, contrasena: 'Equivocada1' } });
  assert.equal(a.status, 401); assert.deepEqual(a.body, b.body);
  assert.equal((await authApi('POST', 'login', { body: {} })).status, 400);
  await ctx.db.query('UPDATE usuarios SET activo=FALSE WHERE correo=$1', [body.correo]);
  const c = await authApi('POST', 'login', { body: { correo: body.correo, contrasena: body.contrasena } });
  assert.equal(c.status, 403); assert.equal(c.body.error.code, 'ACCOUNT_INACTIVE');
});

test('refresh: da nuevo acceso con roles actuales; rechaza access, expirado, manipulado y usuario desactivado', async () => {
  const body = await registerAndVerify({ correo: 'ref@example.co', numeroDocumento: 'REF0001' });
  const { data } = (await authApi('POST', 'login', { body: { correo: body.correo, contrasena: body.contrasena } })).body;
  let r = await authApi('POST', 'refresh', { body: { refreshToken: data.refreshToken } });
  assert.equal(r.status, 200); assert.ok(r.body.data.accessToken);
  assert.equal((await authApi('POST', 'refresh', { body: { refreshToken: data.accessToken } })).status, 401); // tipo equivocado
  assert.equal((await authApi('POST', 'refresh', { body: { refreshToken: data.refreshToken + 'x' } })).status, 401);
  assert.equal((await authApi('POST', 'refresh', { body: {} })).status, 400);
  await ctx.db.query("UPDATE usuarios SET roles=ARRAY['INVERSIONISTA'] WHERE correo=$1", [body.correo]);
  r = await authApi('POST', 'refresh', { body: { refreshToken: data.refreshToken } });
  assert.deepEqual(r.body.data.user.roles, ['INVERSIONISTA']); // roles frescos de la BD
  ctx.clock.now += 7 * 24 * 3600_000 + 1000;
  r = await authApi('POST', 'refresh', { body: { refreshToken: data.refreshToken } });
  assert.equal(r.status, 401); assert.equal(r.body.error.code, 'TOKEN_EXPIRED');
  ctx.clock.now = Date.now();
  const d2 = (await authApi('POST', 'login', { body: { correo: body.correo, contrasena: body.contrasena } })).body.data;
  await ctx.db.query('UPDATE usuarios SET activo=FALSE WHERE correo=$1', [body.correo]);
  assert.equal((await authApi('POST', 'refresh', { body: { refreshToken: d2.refreshToken } })).status, 401);
});

test('JWT protege las rutas de proyectos: sin token 401; con token de productor 201; roles reales (RBAC)', async () => {
  const prod = await registerAndVerify({ correo: 'prod@example.co', numeroDocumento: 'PROD001', roles: ['PRODUCTOR'] });
  const inv = await registerAndVerify({ correo: 'inv@example.co', numeroDocumento: 'INV0001', roles: ['INVERSIONISTA'] });
  const tp = (await authApi('POST', 'login', { body: { correo: prod.correo, contrasena: prod.contrasena } })).body.data.accessToken;
  const ti = (await authApi('POST', 'login', { body: { correo: inv.correo, contrasena: inv.contrasena } })).body.data.accessToken;
  assert.equal((await api('POST', '', { body: validProject })).status, 401);
  assert.equal((await api('POST', '', { headers: bearer(ti), body: validProject })).status, 403); // inversionista no publica
  const c = await api('POST', '', { headers: bearer(tp), body: validProject });
  assert.equal(c.status, 201);
  assert.equal(c.body.data.autorId, String((await ctx.db.query('SELECT id FROM usuarios WHERE correo=$1', [prod.correo])).rows[0].id));
  assert.equal((await api('GET', '', { headers: bearer(ti) })).status, 200);
  const me = await authApi('GET', 'me', { headers: bearer(tp) });
  assert.equal(me.status, 200); assert.equal(me.body.data.correo, prod.correo);
});

test('JWT: token alterado, expirado o de refresco no autentica; las cabeceras x-user-* se ignoran si no hay bandera', async () => {
  const body = await registerAndVerify({ correo: 'jwt@example.co', numeroDocumento: 'JWT0001' });
  const d = (await authApi('POST', 'login', { body: { correo: body.correo, contrasena: body.contrasena } })).body.data;
  const [h, p, s] = d.accessToken.split('.');
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url')), roles: ['ADMINISTRADOR'] })).toString('base64url');
  assert.equal((await api('GET', '', { headers: bearer(`${h}.${forged}.${s}`) })).status, 401);
  assert.equal((await api('GET', '', { headers: bearer(d.refreshToken) })).status, 401);
  assert.equal((await authApi('GET', 'me', {})).status, 401);
  const prev = process.env.ALLOW_DEV_HEADERS;
  process.env.ALLOW_DEV_HEADERS = 'false';
  try {
    assert.equal((await api('GET', '', { headers: { 'x-user-id': 'a1', 'x-user-roles': 'ADMINISTRADOR' } })).status, 401);
  } finally { process.env.ALLOW_DEV_HEADERS = prev; }
});

test('createAdmin: crea administrador verificado que puede iniciar sesión; no hay forma pública de serlo (RN-05)', async () => {
  const a = await ctx.authService.createAdmin({
    nombreCompleto: 'Admin Principal', correo: 'admin@example.co', contrasena: 'Admin12345',
    tipoDocumento: 'CC', numeroDocumento: 'ADM0001', telefono: '3000000000',
  });
  assert.deepEqual(a.roles, ['ADMINISTRADOR']);
  const r = await authApi('POST', 'login', { body: { correo: 'admin@example.co', contrasena: 'Admin12345' } });
  assert.equal(r.status, 200); assert.deepEqual(r.body.data.user.roles, ['ADMINISTRADOR']);
});
