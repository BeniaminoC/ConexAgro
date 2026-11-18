import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { migrate } from '../src/db/migrate.js';
import { setupTestDb, MIGRATIONS_DIR } from './helpers.js';

let ctx;
before(async () => { ctx = await setupTestDb(); });
after(async () => { await ctx.teardown(); });

test('las migraciones son idempotentes y quedan registradas', async () => {
  assert.deepEqual(await migrate(ctx.db, MIGRATIONS_DIR), []); // ya aplicadas en setupTestDb
  const { rows } = await ctx.db.query('SELECT nombre FROM schema_migrations ORDER BY nombre');
  assert.deepEqual(rows.map((r) => r.nombre), ['001_proyectos.sql', '002_usuarios.sql', '003_solicitudes.sql']);
});

test('la base de datos también impone las reglas (defensa en profundidad)', async () => {
  const insert = (over) => ctx.db.query(
    `INSERT INTO proyectos (autor_id,nombre,descripcion,tipo_cultivo,area_requerida_ha,ubicacion_deseada,
       monto_inversion,tiempo_retorno_meses,creado_en,actualizado_en)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now(),now())`,
    Object.assign(['x', 'Nombre válido', 'desc', 'Maíz', 1, 'Montería', 100, 6], over),
  );
  await insert({}); // la fila válida entra
  await assert.rejects(insert({ 6: 0 }), /check/i); // monto 0
  await assert.rejects(insert({ 4: -1 }), /check/i); // área negativa
  await assert.rejects(insert({ 1: 'ab' }), /check/i); // nombre muy corto
  await assert.rejects(insert({ 2: null }), /null/i); // descripción obligatoria
  await assert.rejects(
    ctx.db.query("UPDATE proyectos SET estado = 'oculto' WHERE autor_id = 'x'"), /check/i,
  ); // estados fuera del conjunto permitido
});

test('una migración que falla no deja nada a medias', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), 'conexagro-mig-'));
  try {
    await writeFile(join(dir, '001_ok.sql'), 'CREATE TABLE prueba_ok (id INT);');
    await writeFile(join(dir, '002_falla.sql'), 'CREATE TABLE prueba_parcial (id INT); SELECT 1/0;');
    await assert.rejects(migrate(ctx.db, dir), /division by zero/i);
    const reg = (await ctx.db.query("SELECT nombre FROM schema_migrations WHERE nombre LIKE '00%_%'")).rows.map((r) => r.nombre);
    assert.ok(reg.includes('001_ok.sql'));
    assert.ok(!reg.includes('002_falla.sql'));
    const t = await ctx.db.query("SELECT to_regclass('prueba_parcial') AS t");
    assert.equal(t.rows[0].t, null); // la tabla de la migración fallida no existe
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
