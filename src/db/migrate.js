import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Aplica en orden los archivos db/migrations/NNN_*.sql que aún no estén registrados.
// Cada archivo se ejecuta junto con su registro en schema_migrations como un solo script,
// que PostgreSQL trata como una transacción implícita: o se aplica todo o nada.
export async function migrate(db, dir) {
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    nombre TEXT PRIMARY KEY,
    aplicada_en TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  const files = (await readdir(dir)).filter((f) => /^\d+.*\.sql$/.test(f)).sort();
  const done = new Set((await db.query('SELECT nombre FROM schema_migrations')).rows.map((r) => r.nombre));
  const applied = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(join(dir, file), 'utf8');
    const name = file.replace(/'/g, "''");
    await db.exec(`${sql}\n;INSERT INTO schema_migrations (nombre) VALUES ('${name}');`);
    applied.push(file);
  }
  return applied;
}
