import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestDb, api, USERS, validProject as valid } from './helpers.js';

const { PROD1, PROD2, OWNER, INV, ADMIN } = USERS;
let ctx;
before(async () => { ctx = await setupTestDb(); });
after(async () => { await ctx.teardown(); });

test('productor publica un proyecto: 201 y estado inicial activo (RN-16)', async () => {
  const r = await api('POST', '', { headers: PROD1, body: valid });
  assert.equal(r.status, 201);
  assert.equal(r.body.data.estado, 'activo');
  assert.equal(r.body.data.autorId, 'p1');
  assert.equal(r.body.data.montoInversion, 80000000); // NUMERIC vuelve como número
  assert.equal(r.body.data.areaRequeridaHa, 12.5);
  assert.ok(Number.isInteger(r.body.data.id));
  assert.ok(!Number.isNaN(Date.parse(r.body.data.creadoEn)));
});

test('todos los campos son obligatorios (decisión 3): cada ausencia da 400 con su campo', async () => {
  for (const key of Object.keys(valid)) {
    const { [key]: _omit, ...incompleto } = valid;
    const r = await api('POST', '', { headers: PROD1, body: incompleto });
    assert.equal(r.status, 400, `sin ${key}`);
    assert.ok(r.body.error.fields[key], `debe señalar ${key}`);
  }
  const r = await api('POST', '', { headers: PROD1, body: { ...valid, descripcion: '   ' } });
  assert.equal(r.status, 400);
});

test('monto o área en cero, negativos, texto, con demasiados decimales o fuera de rango son inválidos (FA-02)', async () => {
  for (const monto of [0, -5, '100', 1.234, 1e15]) {
    const r = await api('POST', '', { headers: PROD1, body: { ...valid, montoInversion: monto } });
    assert.equal(r.status, 400, `monto=${monto}`);
    assert.ok(r.body.error.fields.montoInversion);
  }
  for (const area of [0, -1, 2.555, 1e9]) {
    const r = await api('POST', '', { headers: PROD1, body: { ...valid, areaRequeridaHa: area } });
    assert.equal(r.status, 400, `area=${area}`);
  }
  for (const meses of [0, 1.5, 601]) {
    const r = await api('POST', '', { headers: PROD1, body: { ...valid, tiempoRetornoMeses: meses } });
    assert.equal(r.status, 400, `meses=${meses}`);
  }
});

test('JSON inválido devuelve 400', async () => {
  const r = await api('POST', '', { headers: PROD1, body: '{no es json' });
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, 'BAD_JSON');
});

test('sin autenticación 401; propietario e inversionista no publican 403 (matriz de permisos)', async () => {
  assert.equal((await api('POST', '', { body: valid })).status, 401);
  assert.equal((await api('POST', '', { headers: OWNER, body: valid })).status, 403);
  assert.equal((await api('POST', '', { headers: INV, body: valid })).status, 403);
});

test('el administrador puede publicar', async () => {
  assert.equal((await api('POST', '', { headers: ADMIN, body: valid })).status, 201);
});

test('solo autor o admin editan (RN-18); otro productor recibe 403', async () => {
  const { body } = await api('POST', '', { headers: PROD1, body: valid });
  const id = body.data.id;
  assert.equal((await api('PATCH', `/${id}`, { headers: PROD2, body: { nombre: 'Hackeado' } })).status, 403);
  let r = await api('PATCH', `/${id}`, { headers: PROD1, body: { nombre: 'Maíz v2', montoInversion: 90000000 } });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.nombre, 'Maíz v2');
  assert.equal(r.body.data.montoInversion, 90000000);
  assert.equal(r.body.data.areaRequeridaHa, 12.5); // campos no enviados se conservan
  r = await api('PATCH', `/${id}`, { headers: ADMIN, body: { tipoCultivo: 'Sorgo' } });
  assert.equal(r.status, 200);
  assert.equal((await api('PATCH', `/${id}`, { headers: PROD1, body: { montoInversion: 0 } })).status, 400);
  assert.equal((await api('PATCH', `/${id}`, { headers: PROD1, body: { descripcion: '' } })).status, 400); // no se puede vaciar
  assert.equal((await api('PATCH', `/${id}`, { headers: PROD1, body: {} })).status, 400);
});

test('cerrar: solo autor/admin, una sola vez, y queda cerrado: no se edita ni se reabre (decisión 4)', async () => {
  const { body } = await api('POST', '', { headers: PROD1, body: valid });
  const id = body.data.id;
  assert.equal((await api('POST', `/${id}/close`, { headers: PROD2 })).status, 403);
  const r = await api('POST', `/${id}/close`, { headers: PROD1 });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.estado, 'cerrado');
  assert.ok(r.body.data.cerradoEn);
  assert.equal((await api('POST', `/${id}/close`, { headers: PROD1 })).status, 409);
  assert.equal((await api('PATCH', `/${id}`, { headers: PROD1, body: { nombre: 'x yz' } })).status, 409);
  assert.equal((await api('PATCH', `/${id}`, { headers: ADMIN, body: { nombre: 'x yz' } })).status, 409);
});

test('listado público solo incluye activos; /mine incluye cerrados del autor', async () => {
  const a = (await api('POST', '', { headers: PROD2, body: { ...valid, nombre: 'Proyecto abierto' } })).body.data;
  const c = (await api('POST', '', { headers: PROD2, body: { ...valid, nombre: 'Proyecto cerrado' } })).body.data;
  await api('POST', `/${c.id}/close`, { headers: PROD2 });

  const list = (await api('GET', '', { headers: INV })).body.data;
  assert.ok(list.some((p) => p.id === a.id));
  assert.ok(!list.some((p) => p.id === c.id));
  assert.ok(list.every((p) => p.estado === 'activo'));

  const mine = (await api('GET', '/mine', { headers: PROD2 })).body.data;
  assert.ok(mine.some((p) => p.id === c.id) && mine.some((p) => p.id === a.id));
  assert.ok(mine.every((p) => p.autorId === 'p2'));
});

test('detalle: activo visible a todos; cerrado solo autor/admin (404 para los demás)', async () => {
  const { body } = await api('POST', '', { headers: PROD1, body: valid });
  const id = body.data.id;
  assert.equal((await api('GET', `/${id}`, { headers: INV })).status, 200);
  await api('POST', `/${id}/close`, { headers: PROD1 });
  assert.equal((await api('GET', `/${id}`, { headers: INV })).status, 404);
  assert.equal((await api('GET', `/${id}`, { headers: PROD1 })).status, 200);
  assert.equal((await api('GET', `/${id}`, { headers: ADMIN })).status, 200);
});

test('IDs inexistentes, no numéricos o fuera de rango dan 404 (no 500)', async () => {
  for (const id of ['99999', 'abc', '0', '-1', '99999999999999999999']) {
    assert.equal((await api('GET', `/${id}`, { headers: PROD1 })).status, 404, `id=${id}`);
  }
});
