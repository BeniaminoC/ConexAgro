import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeFilename } from '../src/projects/service.js';
import { setupTestDb, api, USERS, validProject } from './helpers.js';

process.env.MAX_DOC_BYTES = '2048'; // límite pequeño para probar el 413 sin cuerpos enormes

const { PROD1, PROD2, INV, ADMIN } = USERS;
let ctx;
before(async () => { ctx = await setupTestDb(); });
after(async () => { await ctx.teardown(); });

const pdf = (text = 'uno') => Buffer.from(`%PDF-1.4\n% ${text}\n%%EOF\n`, 'latin1');
const PDF_HEADERS = { 'content-type': 'application/pdf' };

async function createProject(headers = PROD1) {
  return (await api('POST', '', { headers, body: validProject })).body.data.id;
}
const put = (id, headers, body, extra = {}) =>
  api('PUT', `/${id}/document`, { headers: { ...PDF_HEADERS, ...headers, ...extra }, body });
const getDoc = (id, headers) => api('GET', `/${id}/document`, { headers });
const del = (id, headers) => api('DELETE', `/${id}/document`, { headers });

test('el autor sube un PDF; se descarga idéntico y el detalle muestra los metadatos', async () => {
  const id = await createProject();
  const file = pdf('contenido-1');
  const r = await put(id, PROD1, file, { 'x-filename': 'plan de negocio.pdf' });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.nombreArchivo, 'plan de negocio.pdf');
  assert.equal(r.body.data.tamano, file.length);

  const d = await getDoc(id, INV); // decisión 9: cualquier usuario autenticado descarga (proyecto activo)
  assert.equal(d.status, 200);
  assert.equal(d.headers.get('content-type'), 'application/pdf');
  assert.match(d.headers.get('content-disposition'), /filename="plan de negocio\.pdf"/);
  assert.deepEqual(d.buffer, file);

  const detail = await api('GET', `/${id}`, { headers: INV });
  assert.equal(detail.body.data.documento.tamano, file.length);
});

test('un segundo PDF reemplaza al primero (máximo uno, RN-17)', async () => {
  const id = await createProject();
  await put(id, PROD1, pdf('primero'));
  const second = pdf('segundo-documento');
  assert.equal((await put(id, PROD1, second)).status, 200);
  assert.deepEqual((await getDoc(id, PROD1)).buffer, second);
  const { rows } = await ctx.db.query('SELECT count(*)::int AS n FROM proyecto_documentos WHERE proyecto_id = $1', [id]);
  assert.equal(rows[0].n, 1);
});

test('rechaza archivos que no son PDF, vacíos o con Content-Type incorrecto', async () => {
  const id = await createProject();
  let r = await put(id, PROD1, Buffer.from('esto no es un pdf'));
  assert.equal(r.status, 400);
  assert.ok(r.body.error.fields.documento);
  assert.equal((await put(id, PROD1, Buffer.alloc(0))).status, 400);
  assert.equal((await put(id, { ...PROD1, 'content-type': 'text/plain' }, pdf())).status, 415);
  assert.equal((await getDoc(id, PROD1)).status, 404); // nada se guardó
});

test('rechaza archivos por encima del límite (413), por Content-Length o por tamaño real', async () => {
  const id = await createProject();
  const big = Buffer.concat([pdf(), Buffer.alloc(4000, 0x20)]);
  let r = await put(id, PROD1, big);
  assert.equal(r.status, 413);
  assert.equal(r.body.error.code, 'TOO_LARGE');
  r = await put(id, PROD1, pdf(), { 'content-length': '999999' }); // declarado como enorme
  assert.equal(r.status, 413);
  assert.equal((await getDoc(id, PROD1)).status, 404);
});

test('permisos: sin sesión 401; otro productor e inversionista 403; admin sí puede', async () => {
  const id = await createProject();
  assert.equal((await put(id, {}, pdf())).status, 401);
  assert.equal((await put(id, PROD2, pdf())).status, 403);
  assert.equal((await put(id, INV, pdf())).status, 403);
  assert.equal((await put(id, ADMIN, pdf('admin'))).status, 200);
  assert.equal((await del(id, PROD2)).status, 403);
  assert.equal((await getDoc(id, {})).status, 401);
});

test('eliminar: autor borra, luego 404 al descargar y al borrar de nuevo', async () => {
  const id = await createProject();
  await put(id, PROD1, pdf());
  assert.equal((await del(id, PROD1)).status, 200);
  assert.equal((await getDoc(id, PROD1)).status, 404);
  assert.equal((await del(id, PROD1)).status, 404);
  assert.equal((await api('GET', `/${id}`, { headers: PROD1 })).body.data.documento, null);
});

test('proyecto cerrado: no admite cambios (409) y su documento solo lo ven autor/admin', async () => {
  const id = await createProject();
  await put(id, PROD1, pdf('antes-de-cerrar'));
  await api('POST', `/${id}/close`, { headers: PROD1 });
  assert.equal((await put(id, PROD1, pdf())).status, 409);
  assert.equal((await del(id, PROD1)).status, 409);
  assert.equal((await getDoc(id, INV)).status, 404);
  assert.equal((await getDoc(id, PROD1)).status, 200);
  assert.equal((await getDoc(id, ADMIN)).status, 200);
});

test('proyecto inexistente: 404', async () => {
  assert.equal((await put(99999, PROD1, pdf())).status, 404);
  assert.equal((await getDoc(99999, PROD1)).status, 404);
});

test('sanitizeFilename neutraliza rutas y caracteres peligrosos', () => {
  assert.equal(sanitizeFilename('../../etc/passwd'), 'passwd.pdf');
  assert.equal(sanitizeFilename('C:\\docs\\plan.PDF'), 'plan.pdf');
  assert.equal(sanitizeFilename('a"b\r\nc.pdf'), 'abc.pdf');
  assert.equal(sanitizeFilename(undefined), 'soporte.pdf');
  assert.equal(sanitizeFilename('....'), 'soporte.pdf');
});

test('nombre de archivo: la interfaz lo envía codificado; tildes se normalizan y rutas se descartan', async () => {
  const { sanitizeFilename } = await import('../src/projects/service.js');
  assert.equal(sanitizeFilename('Plan económico ñandú.pdf'), 'Plan economico nandu.pdf');
  assert.equal(sanitizeFilename('../../etc/passwd'), 'passwd.pdf');
});
