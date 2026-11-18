import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequest, respond, findDuplicate, visibleTo } from '../src/requests/domain.js';
import { generateVerification, checkVerification, hashToken, VERIFY_TTL_MS } from '../src/auth/verification.js';

const T0 = 1_800_000_000_000;
const prod = { id: 'p1', roles: ['PRODUCTOR'] };
const owner = { id: 'o1', roles: ['PROPIETARIO'] };
const admin = { id: 'a1', roles: ['ADMINISTRADOR'] };
const input = { receptorId: 'o1', referenciaTipo: 'terreno', referenciaId: 7, mensaje: 'Me interesa el predio' };
const mk = () => ({ id: 1, ...createRequest(prod, input, [], T0) });

test('crear solicitud: estado pendiente con historial fechado (RN-28)', () => {
  const r = mk();
  assert.equal(r.estado, 'pendiente'); assert.equal(r.emisorId, 'p1');
  assert.deepEqual(r.historial, [{ estado: 'pendiente', en: new Date(T0).toISOString(), por: 'p1' }]);
});

test('crear: admin no puede (RN-25); datos inválidos señalan campo; no a sí mismo', () => {
  assert.throws(() => createRequest(admin, input, [], T0), { status: 403 });
  for (const [k, v] of Object.entries({ receptorId: '', referenciaTipo: 'x', referenciaId: 0, mensaje: '  ', condiciones: 'y'.repeat(1001) })) {
    assert.throws(() => createRequest(prod, { ...input, [k]: v }, [], T0), (e) => e.status === 400 && !!e.fields[k], k);
  }
  assert.throws(() => createRequest(prod, { ...input, receptorId: 'p1' }, [], T0), (e) => !!e.fields.receptorId);
});

test('duplicada: bloquea si hay activa entre la pareja y referencia (en cualquier sentido); cerrada no bloquea', () => {
  const r = mk();
  assert.throws(() => createRequest(prod, input, [r], T0), { status: 409 });
  const inversa = { ...input, receptorId: 'p1' };
  assert.throws(() => createRequest(owner, inversa, [r], T0), { status: 409 });
  assert.ok(createRequest(prod, { ...input, referenciaId: 8 }, [r], T0));
  const cerrada = respond(r, owner, 'rechazar', {}, T0 + 1).solicitud;
  assert.equal(findDuplicate([cerrada], { emisorId: 'p1', receptorId: 'o1', referenciaTipo: 'terreno', referenciaId: 7 }), null);
  assert.ok(createRequest(prod, input, [cerrada], T0));
});

test('responder: aceptar/rechazar registran fecha y no mutan el original', () => {
  const r = mk();
  const { solicitud, contrapropuesta } = respond(r, owner, 'aceptar', {}, T0 + 5000);
  assert.equal(solicitud.estado, 'aceptada'); assert.equal(contrapropuesta, null);
  assert.equal(solicitud.historial.at(-1).en, new Date(T0 + 5000).toISOString());
  assert.equal(r.estado, 'pendiente'); assert.equal(r.historial.length, 1);
});

test('responder: solo el receptor; admin no; cerrada no se modifica (RN-26); acción inválida', () => {
  const r = mk();
  assert.throws(() => respond(r, prod, 'aceptar'), { status: 403 });
  assert.throws(() => respond(r, admin, 'aceptar'), { status: 403 });
  assert.throws(() => respond(r, owner, 'otra'), (e) => e.status === 400 && !!e.fields.accion);
  const c = respond(r, owner, 'aceptar', {}, T0).solicitud;
  for (const a of ['aceptar', 'rechazar', 'contraproponer']) {
    assert.throws(() => respond(c, owner, a, { mensaje: 'x' }), { status: 409 });
  }
});

test('contrapropuesta: cierra la original y crea una nueva con roles invertidos (FA-03)', () => {
  const r = mk();
  const { solicitud, contrapropuesta: n } = respond(r, owner, 'contraproponer', { mensaje: 'Solo 2 años', condiciones: '2 años' }, T0);
  assert.equal(solicitud.estado, 'contrapropuesta');
  assert.equal(n.estado, 'pendiente'); assert.equal(n.emisorId, 'o1'); assert.equal(n.receptorId, 'p1');
  assert.equal(n.origenId, 1); assert.equal(n.referenciaId, 7);
  assert.throws(() => respond(r, owner, 'contraproponer', {}), (e) => e.status === 400 && !!e.fields.mensaje);
  assert.equal(respond({ ...n, id: 2 }, prod, 'aceptar', {}, T0).solicitud.estado, 'aceptada');
});

test('visibilidad: solo emisor y receptor (RN-27)', () => {
  const r = mk();
  assert.ok(visibleTo(r, prod) && visibleTo(r, owner));
  assert.equal(visibleTo(r, { id: 'x1', roles: ['INVERSIONISTA'] }), false);
});

test('verificación de correo: token aleatorio, solo se guarda el hash, expira a las 24 h (RN-03)', () => {
  const a = generateVerification(T0), b = generateVerification(T0);
  assert.notEqual(a.token, b.token); assert.equal(a.tokenHash, hashToken(a.token));
  assert.notEqual(a.token, a.tokenHash); assert.equal(a.expiraEn.getTime() - T0, VERIFY_TTL_MS);
  const rec = { expiraEn: a.expiraEn, usadoEn: null };
  assert.equal(checkVerification(rec, T0 + VERIFY_TTL_MS - 1), 'valido');
  assert.equal(checkVerification(rec, T0 + VERIFY_TTL_MS), 'expirado');
  assert.equal(checkVerification({ ...rec, usadoEn: new Date() }, T0), 'usado');
  assert.equal(checkVerification(null, T0), 'invalido');
});
