import test from 'node:test';
import assert from 'node:assert/strict';
import { isIdle, IDLE_MS, errorText, validateRegistration, estadoLabel, parseProject, cop } from '../src/ui/format.js';

test('inactividad: expira pasados 30 min (RN-09)', () => {
  const now = 1_000_000_000;
  assert.equal(isIdle({ last: now - IDLE_MS + 1000 }, now), false);
  assert.equal(isIdle({ last: now - IDLE_MS - 1 }, now), true);
  assert.equal(isIdle(null, now), true);
});

test('errorText usa el mensaje de la API o un texto por defecto', () => {
  assert.equal(errorText({ error: { message: 'Hola' } }), 'Hola');
  assert.match(errorText(null), /Inténtalo/);
});

test('validateRegistration: uno o dos perfiles, nunca los tres ni ninguno; términos obligatorios', () => {
  const ok = { nombreCompleto: 'Ana', correo: 'a@b.co', contrasena: 'Clave1234', numeroDocumento: '1', telefono: '3', roles: ['PRODUCTOR'], aceptaTerminos: true };
  assert.deepEqual(validateRegistration(ok), {});
  assert.ok(validateRegistration({ ...ok, roles: [] }).roles);
  assert.ok(validateRegistration({ ...ok, roles: ['PROPIETARIO', 'PRODUCTOR', 'INVERSIONISTA'] }).roles);
  assert.ok(validateRegistration({ ...ok, aceptaTerminos: false }).aceptaTerminos);
  assert.ok(validateRegistration({ ...ok, contrasena: 'sololetras' }).contrasena);
  assert.ok(validateRegistration({ ...ok, correo: 'x' }).correo);
});

test('estadoLabel', () => { assert.equal(estadoLabel('pendiente'), 'Pendiente'); });

test('parseProject: todos obligatorios; área/monto > 0 con 2 decimales; meses entero 1–600; acepta coma decimal', () => {
  const ok = { nombre: 'Maíz', descripcion: 'd', tipoCultivo: 'Maíz', areaRequeridaHa: '12,5', ubicacionDeseada: 'Montería', montoInversion: '80000000', tiempoRetornoMeses: '8' };
  const r = parseProject(ok);
  assert.deepEqual(r.errors, {});
  assert.equal(r.data.areaRequeridaHa, 12.5); assert.equal(r.data.tiempoRetornoMeses, 8);
  for (const [k, v] of [['nombre', 'ab'], ['descripcion', ''], ['areaRequeridaHa', '0'], ['montoInversion', '-5'],
    ['montoInversion', '1.234'], ['tiempoRetornoMeses', '0'], ['tiempoRetornoMeses', '2.5'], ['ubicacionDeseada', ' ']]) {
    assert.ok(parseProject({ ...ok, [k]: v }).errors[k], `${k}=${v} debería fallar`);
  }
  assert.equal(Object.keys(parseProject({}).errors).length, 7);
});
test('cop formatea pesos', () => { assert.match(cop(80000000), /80\.000\.000/); });
