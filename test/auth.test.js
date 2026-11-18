import test from 'node:test';
import assert from 'node:assert/strict';
import { signToken, verifyToken, ACCESS_TTL_S, REFRESH_TTL_S } from '../src/auth/jwt.js';
import * as L from '../src/auth/lockout.js';
import { validateRegistration } from '../src/auth/registration.js';

const secret = 'x'.repeat(40);
const T0 = 1_800_000_000_000;
const user = { sub: 'u1', roles: ['PRODUCTOR'] };

test('JWT: firma y verifica; acceso dura 1 h y refresco 7 días (RN-08)', () => {
  const a = signToken({ ...user, type: 'access' }, { now: T0, secret });
  const c = verifyToken(a, { type: 'access', now: T0 + 1000, secret });
  assert.equal(c.sub, 'u1'); assert.deepEqual(c.roles, ['PRODUCTOR']);
  assert.equal(c.exp - c.iat, ACCESS_TTL_S); assert.equal(ACCESS_TTL_S, 3600);
  const r = signToken({ ...user, type: 'refresh' }, { now: T0, secret });
  assert.equal(verifyToken(r, { now: T0, secret }).exp - Math.floor(T0 / 1000), REFRESH_TTL_S);
  assert.equal(REFRESH_TTL_S, 604800);
});

test('JWT: expirado, firma alterada, alg=none, tipo equivocado y secreto corto se rechazan', () => {
  const a = signToken({ ...user, type: 'access' }, { now: T0, secret });
  assert.throws(() => verifyToken(a, { now: T0 + 3600_000, secret }), { code: 'EXPIRED' });
  assert.throws(() => verifyToken(a, { now: T0, secret: 'y'.repeat(40) }), { code: 'BAD_SIGNATURE' });
  const [h, p, s] = a.split('.');
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url')), roles: ['ADMINISTRADOR'] })).toString('base64url');
  assert.throws(() => verifyToken(`${h}.${forged}.${s}`, { now: T0, secret }), { code: 'BAD_SIGNATURE' });
  const none = Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url');
  assert.throws(() => verifyToken(`${none}.${p}.`, { now: T0, secret }), { code: 'MALFORMED' });
  assert.throws(() => verifyToken(a, { type: 'refresh', now: T0, secret }), { code: 'WRONG_TYPE' });
  assert.throws(() => verifyToken('abc', { secret }), { code: 'MALFORMED' });
  assert.throws(() => verifyToken(undefined, { secret }), { code: 'MALFORMED' });
  assert.throws(() => signToken({ ...user, type: 'access' }, { secret: 'corto' }), { code: 'NO_SECRET' });
});

test('bloqueo: 5 fallos bloquean 30 min; antes del quinto no (RN-06/07)', () => {
  let s = L.initialState();
  for (let i = 1; i <= 4; i++) { s = L.registerFailure(s, T0); assert.equal(L.isLocked(s, T0), false); }
  s = L.registerFailure(s, T0);
  assert.equal(s.intentosFallidos, 5);
  assert.equal(L.isLocked(s, T0 + 29 * 60_000), true);
  assert.equal(L.lockRemainingMs(s, T0 + 29 * 60_000), 60_000);
  assert.equal(L.isLocked(s, T0 + 30 * 60_000), false);
});

test('bloqueo: fallar estando bloqueado no extiende; tras vencer se cuenta de nuevo; el éxito reinicia', () => {
  let s = L.initialState();
  for (let i = 0; i < 5; i++) s = L.registerFailure(s, T0);
  const until = s.bloqueadoHasta;
  assert.equal(L.registerFailure(s, T0 + 60_000).bloqueadoHasta, until);
  const after = L.registerFailure(s, until + 1);
  assert.equal(after.intentosFallidos, 1); assert.equal(after.bloqueadoHasta, null);
  assert.deepEqual(L.registerSuccess(), { intentosFallidos: 0, bloqueadoHasta: null });
});

test('inactividad: 30 min sin actividad cierra la sesión (RN-09)', () => {
  assert.equal(L.isIdle(T0, T0 + 29 * 60_000), false);
  assert.equal(L.isIdle(T0, T0 + 30 * 60_000), true);
});

const ok = {
  nombreCompleto: 'Ana Pérez', correo: ' Ana@Correo.CO ', contrasena: 'clave1234', tipoDocumento: 'cc',
  numeroDocumento: '1067890123', telefono: '+57 300 123 4567', roles: ['productor'], aceptaTerminos: true,
};

test('registro válido: normaliza correo, tipo de documento, teléfono y roles', () => {
  const r = validateRegistration(ok);
  assert.equal(r.correo, 'ana@correo.co'); assert.equal(r.tipoDocumento, 'CC');
  assert.equal(r.telefono, '+573001234567'); assert.deepEqual(r.roles, ['PRODUCTOR']);
  assert.deepEqual(validateRegistration({ ...ok, roles: ['PRODUCTOR', 'PROPIETARIO'] }).roles, ['PRODUCTOR', 'PROPIETARIO']);
});

test('registro: roles 0, 3, repetidos, desconocidos o ADMINISTRADOR dan error (RN-05)', () => {
  const bad = [[], ['PROPIETARIO', 'PRODUCTOR', 'INVERSIONISTA'], ['PRODUCTOR', 'PRODUCTOR'], ['ADMINISTRADOR'], ['PRODUCTOR', 'ADMINISTRADOR'], ['X']];
  for (const roles of bad) {
    assert.throws(() => validateRegistration({ ...ok, roles }), (e) => e.status === 400 && !!e.fields.roles, JSON.stringify(roles));
  }
  assert.throws(() => validateRegistration({ ...ok, roles: 'PRODUCTOR' }), (e) => !!e.fields.roles);
});

test('registro: cada campo inválido se señala por su nombre', () => {
  const cases = {
    nombreCompleto: '  ', correo: 'sin-arroba', contrasena: 'corta1', tipoDocumento: 'XX',
    numeroDocumento: '12', telefono: 'abc', aceptaTerminos: false,
  };
  for (const [k, v] of Object.entries(cases)) {
    assert.throws(() => validateRegistration({ ...ok, [k]: v }), (e) => e.status === 400 && !!e.fields[k], k);
  }
  assert.throws(() => validateRegistration({ ...ok, contrasena: 'sololetras' }), (e) => !!e.fields.contrasena);
  assert.throws(() => validateRegistration({ ...ok, contrasena: 'a1' + 'x'.repeat(71) }), (e) => !!e.fields.contrasena);
  assert.throws(() => validateRegistration(), (e) => Object.keys(e.fields).length === 8);
});
