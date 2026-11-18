import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestDb, authApi, api, reqApi, validRegistration, validProject } from './helpers.js';

let ctx;
before(async () => { ctx = await setupTestDb(); });
after(async () => { await ctx.teardown(); });

let n = 0;
// Registra, verifica y entra: devuelve { id, token }.
async function user(roles) {
  n += 1;
  const body = validRegistration({ correo: `u${n}@example.co`, numeroDocumento: `RQ${1000 + n}`, roles });
  await authApi('POST', 'register', { body });
  await authApi('POST', 'verify-email', { body: { token: ctx.mail.at(-1).token } });
  const r = await authApi('POST', 'login', { body: { correo: body.correo, contrasena: body.contrasena } });
  return { id: r.body.data.user.id, token: r.body.data.accessToken };
}
async function admin() {
  n += 1;
  await ctx.authService.createAdmin({ nombreCompleto: 'Admin', correo: `adm${n}@example.co`, contrasena: 'Admin12345',
    tipoDocumento: 'CC', numeroDocumento: `ADM${1000 + n}`, telefono: '3000000000' });
  const r = await authApi('POST', 'login', { body: { correo: `adm${n}@example.co`, contrasena: 'Admin12345' } });
  return { id: r.body.data.user.id, token: r.body.data.accessToken };
}
async function project(author) {
  const r = await api('POST', '', { headers: { authorization: `Bearer ${author.token}` }, body: validProject });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.data.id;
}
const send = (u, body) => reqApi('POST', '', { token: u.token, body });

test('sin sesión → 401', async () => {
  assert.equal((await reqApi('GET', '')).status, 401);
  assert.equal((await reqApi('POST', '', { body: {} })).status, 401);
});

test('propietario envía solicitud a un proyecto ajeno: el receptor es el autor; queda pendiente con historial (RN-28)', async () => {
  const prod = await user(['PRODUCTOR']); const own = await user(['PROPIETARIO']);
  const pid = await project(prod);
  const r = await send(own, { referenciaTipo: 'proyecto', referenciaId: pid, mensaje: 'Tengo 20 ha disponibles' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const s = r.body.data;
  assert.equal(s.estado, 'pendiente'); assert.equal(s.receptorId, String(prod.id)); assert.equal(s.emisorId, String(own.id));
  assert.equal(s.historial.length, 1);
  const d = await ctx.db.query('SELECT estado, por FROM solicitud_historial WHERE solicitud_id=$1', [s.id]);
  assert.equal(d.rows.length, 1);
});

test('un destinatario distinto del autor en proyecto ajeno se rechaza; terreno aún no disponible', async () => {
  const prod = await user(['PRODUCTOR']); const inv = await user(['INVERSIONISTA']); const otro = await user(['PROPIETARIO']);
  const pid = await project(prod);
  let r = await send(inv, { receptorId: String(otro.id), referenciaTipo: 'proyecto', referenciaId: pid, mensaje: 'hola' });
  assert.equal(r.status, 400); assert.ok(r.body.error.fields.receptorId);
  r = await send(inv, { receptorId: String(prod.id), referenciaTipo: 'terreno', referenciaId: 1, mensaje: 'hola' });
  assert.equal(r.status, 400); assert.ok(r.body.error.fields.referenciaTipo);
  r = await send(inv, { referenciaTipo: 'proyecto', referenciaId: 999999, mensaje: 'hola' });
  assert.equal(r.status, 404);
  r = await send(inv, { referenciaTipo: 'proyecto', referenciaId: pid, mensaje: '  ' });
  assert.equal(r.status, 400); assert.ok(r.body.error.fields.mensaje);
});

test('el autor puede ofrecer su proyecto a un inversionista; no a un administrador ni a sí mismo', async () => {
  const prod = await user(['PRODUCTOR']); const inv = await user(['INVERSIONISTA']); const adm = await admin();
  const pid = await project(prod);
  let r = await send(prod, { receptorId: String(inv.id), referenciaTipo: 'proyecto', referenciaId: pid, mensaje: 'Invierta', condiciones: '50 millones' });
  assert.equal(r.status, 201); assert.equal(r.body.data.condiciones, '50 millones');
  r = await send(prod, { receptorId: String(adm.id), referenciaTipo: 'proyecto', referenciaId: pid, mensaje: 'x' });
  assert.equal(r.status, 400);
  r = await send(prod, { receptorId: String(prod.id), referenciaTipo: 'proyecto', referenciaId: pid, mensaje: 'x' });
  assert.equal(r.status, 400);
  r = await send(prod, { receptorId: '99999', referenciaTipo: 'proyecto', referenciaId: pid, mensaje: 'x' });
  assert.equal(r.status, 400);
});

test('proyecto cerrado no admite solicitudes', async () => {
  const prod = await user(['PRODUCTOR']); const inv = await user(['INVERSIONISTA']);
  const pid = await project(prod);
  await api('POST', `/${pid}/close`, { headers: { authorization: `Bearer ${prod.token}` } });
  assert.equal((await send(inv, { referenciaTipo: 'proyecto', referenciaId: pid, mensaje: 'hola' })).status, 404);
});

test('duplicada activa → 409 (FA-01), también en sentido inverso; y con 6 envíos simultáneos solo 1 se crea', async () => {
  const prod = await user(['PRODUCTOR']); const inv = await user(['INVERSIONISTA']);
  const pid = await project(prod);
  const body = { referenciaTipo: 'proyecto', referenciaId: pid, mensaje: 'Me interesa' };
  const rs = await Promise.all(Array.from({ length: 6 }, () => send(inv, body)));
  assert.equal(rs.filter((r) => r.status === 201).length, 1, JSON.stringify(rs.map((r) => r.status)));
  assert.ok(rs.filter((r) => r.status !== 201).every((r) => r.status === 409));
  const rev = await send(prod, { receptorId: String(inv.id), referenciaTipo: 'proyecto', referenciaId: pid, mensaje: 'Yo te escribo' });
  assert.equal(rev.status, 409);
});

test('visibilidad (RN-27): solo emisor y receptor ven la solicitud; listas por bandeja', async () => {
  const prod = await user(['PRODUCTOR']); const inv = await user(['INVERSIONISTA']); const ajeno = await user(['PROPIETARIO']);
  const pid = await project(prod);
  const s = (await send(inv, { referenciaTipo: 'proyecto', referenciaId: pid, mensaje: 'hola' })).body.data;
  assert.equal((await reqApi('GET', `/${s.id}`, { token: ajeno.token })).status, 404);
  assert.equal((await reqApi('GET', `/${s.id}`, { token: inv.token })).status, 200);
  assert.equal((await reqApi('GET', `/${s.id}`, { token: prod.token })).body.data.historial.length, 1);
  assert.deepEqual((await reqApi('GET', '', { token: ajeno.token })).body.data, []);
  assert.equal((await reqApi('GET', '?box=recibidas', { token: prod.token })).body.data.length, 1);
  assert.equal((await reqApi('GET', '?box=enviadas', { token: prod.token })).body.data.length, 0);
  assert.equal((await reqApi('GET', '?box=otra', { token: prod.token })).status, 400);
  assert.equal((await reqApi('GET', '/abc', { token: prod.token })).status, 404);
});

test('responder: solo el receptor; aceptar cierra; no se modifica una cerrada (RN-26); se registra fecha/hora (RN-28)', async () => {
  const prod = await user(['PRODUCTOR']); const inv = await user(['INVERSIONISTA']);
  const pid = await project(prod);
  const s = (await send(inv, { referenciaTipo: 'proyecto', referenciaId: pid, mensaje: 'hola' })).body.data;
  assert.equal((await reqApi('POST', `/${s.id}/respond`, { token: inv.token, body: { accion: 'aceptar' } })).status, 403); // emisor
  assert.equal((await reqApi('POST', `/${s.id}/respond`, { token: prod.token, body: { accion: 'quizas' } })).status, 400);
  ctx.clock.now += 60_000;
  const ok = await reqApi('POST', `/${s.id}/respond`, { token: prod.token, body: { accion: 'aceptar' } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.data.solicitud.estado, 'aceptada');
  const h = (await reqApi('GET', `/${s.id}`, { token: inv.token })).body.data.historial;
  assert.deepEqual(h.map((x) => x.estado), ['pendiente', 'aceptada']);
  assert.ok(new Date(h[1].en) > new Date(h[0].en));
  for (const accion of ['aceptar', 'rechazar']) {
    assert.equal((await reqApi('POST', `/${s.id}/respond`, { token: prod.token, body: { accion } })).status, 409);
  }
});

test('responder en paralelo: solo una respuesta gana (bloqueo de fila)', async () => {
  const prod = await user(['PRODUCTOR']); const inv = await user(['INVERSIONISTA']);
  const pid = await project(prod);
  const s = (await send(inv, { referenciaTipo: 'proyecto', referenciaId: pid, mensaje: 'hola' })).body.data;
  const rs = await Promise.all(['aceptar', 'rechazar', 'aceptar', 'rechazar']
    .map((accion) => reqApi('POST', `/${s.id}/respond`, { token: prod.token, body: { accion } })));
  assert.equal(rs.filter((r) => r.status === 200).length, 1);
  assert.ok(rs.filter((r) => r.status !== 200).every((r) => r.status === 409));
  const n = (await ctx.db.query('SELECT count(*)::int AS n FROM solicitud_historial WHERE solicitud_id=$1', [s.id])).rows[0].n;
  assert.equal(n, 2);
});

test('contraproponer: cierra la original y crea una pendiente invertida enlazada (FA-03); se puede aceptar', async () => {
  const prod = await user(['PRODUCTOR']); const inv = await user(['INVERSIONISTA']);
  const pid = await project(prod);
  const s = (await send(inv, { referenciaTipo: 'proyecto', referenciaId: pid, mensaje: 'Invierto 30M', condiciones: '30M' })).body.data;
  assert.equal((await reqApi('POST', `/${s.id}/respond`, { token: prod.token, body: { accion: 'contraproponer' } })).status, 400); // falta mensaje
  const r = await reqApi('POST', `/${s.id}/respond`, { token: prod.token, body: { accion: 'contraproponer', mensaje: 'Mínimo 50M', condiciones: '50M' } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.data.solicitud.estado, 'contrapropuesta');
  const c = r.body.data.contrapropuesta;
  assert.equal(c.estado, 'pendiente'); assert.equal(c.origenId, s.id);
  assert.equal(c.emisorId, String(prod.id)); assert.equal(c.receptorId, String(inv.id));
  const acc = await reqApi('POST', `/${c.id}/respond`, { token: inv.token, body: { accion: 'aceptar' } });
  assert.equal(acc.status, 200); assert.equal(acc.body.data.solicitud.estado, 'aceptada');
});

test('tras cerrar una solicitud se puede enviar otra nueva sobre la misma referencia', async () => {
  const prod = await user(['PRODUCTOR']); const inv = await user(['INVERSIONISTA']);
  const pid = await project(prod);
  const b = { referenciaTipo: 'proyecto', referenciaId: pid, mensaje: 'hola' };
  const s = (await send(inv, b)).body.data;
  await reqApi('POST', `/${s.id}/respond`, { token: prod.token, body: { accion: 'rechazar' } });
  assert.equal((await send(inv, b)).status, 201);
});

test('administrador no envía, ve ni gestiona solicitudes (RN-25)', async () => {
  const prod = await user(['PRODUCTOR']); const inv = await user(['INVERSIONISTA']); const adm = await admin();
  const pid = await project(prod);
  const s = (await send(inv, { referenciaTipo: 'proyecto', referenciaId: pid, mensaje: 'hola' })).body.data;
  assert.equal((await send(adm, { receptorId: String(prod.id), referenciaTipo: 'proyecto', referenciaId: pid, mensaje: 'x' })).status, 403);
  assert.equal((await reqApi('GET', '', { token: adm.token })).status, 403);
  assert.equal((await reqApi('GET', `/${s.id}`, { token: adm.token })).status, 403);
  assert.equal((await reqApi('POST', `/${s.id}/respond`, { token: adm.token, body: { accion: 'aceptar' } })).status, 403);
});

test('migración 003: la BD rechaza duplicadas, autoenvío y estados inválidos', async () => {
  const a = await user(['PRODUCTOR']); const b = await user(['INVERSIONISTA']);
  const ins = (e, r, estado = 'pendiente') => ctx.db.query(
    `INSERT INTO solicitudes (emisor_id, receptor_id, referencia_tipo, referencia_id, mensaje, estado, creado_en, actualizado_en)
     VALUES ($1,$2,'proyecto',777,'m',$3,now(),now())`, [e, r, estado]);
  await ins(a.id, b.id);
  await assert.rejects(ins(b.id, a.id), { code: '23505' });
  await assert.rejects(ins(a.id, a.id, 'aceptada'), { code: '23514' });
  await assert.rejects(ins(a.id, b.id, 'vencida'), { code: '23514' });
});
