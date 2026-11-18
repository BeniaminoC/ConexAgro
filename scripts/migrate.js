import { fileURLToPath } from 'node:url';
import { createPgDb } from '../src/db/pg.js';
import { migrate } from '../src/db/migrate.js';

const dir = fileURLToPath(new URL('../db/migrations', import.meta.url));
const db = createPgDb();
try {
  const applied = await migrate(db, dir);
  console.log(applied.length ? `Migraciones aplicadas: ${applied.join(', ')}` : 'Base de datos al día (sin migraciones pendientes).');
} catch (e) {
  console.error('Error aplicando migraciones:', e.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
