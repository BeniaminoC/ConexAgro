import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPgConfig } from '../src/db/ssl.js';

const URL_AIVEN = 'postgres://avnadmin:pw@pg-x.aivencloud.com:12345/defaultdb?sslmode=require';

test('sin CA y con sslmode: cifra sin verificar y quita sslmode de la URL', () => {
  const c = buildPgConfig(URL_AIVEN, {});
  assert.deepEqual(c.ssl, { rejectUnauthorized: false });
  assert.ok(!c.connectionString.includes('sslmode'));
  assert.match(c.connectionString, /aivencloud\.com:12345\/defaultdb/);
});
test('con CA: verifica el certificado y acepta \\n escapados', () => {
  const c = buildPgConfig(URL_AIVEN, { PG_CA_CERT: '-----BEGIN CERTIFICATE-----\\nABC\\n-----END CERTIFICATE-----' });
  assert.equal(c.ssl.rejectUnauthorized, true);
  assert.match(c.ssl.ca, /BEGIN CERTIFICATE-----\nABC\n-----END/);
});
test('local sin sslmode: sin SSL', () => {
  const c = buildPgConfig('postgres://u:p@localhost:5432/db', {});
  assert.equal(c.ssl, undefined);
});
test('PG_SSL=verify sin CA falla; valor inválido falla; off desactiva', () => {
  assert.throws(() => buildPgConfig(URL_AIVEN, { PG_SSL: 'verify' }), /PG_CA_CERT/);
  assert.throws(() => buildPgConfig(URL_AIVEN, { PG_SSL: 'raro' }), /inválido/);
  assert.equal(buildPgConfig(URL_AIVEN, { PG_SSL: 'off' }).ssl, undefined);
});
