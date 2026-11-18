// Carga datos de demostración: usuarios ya verificados (no dependen del correo) y dos proyectos.
// Es idempotente: si el correo ya existe, no lo vuelve a crear.
// Uso: DATABASE_URL=... [PG_CA_CERT=...] [DEMO_PASSWORD='Demo12345'] node scripts/seed-demo.js
import bcrypt from 'bcryptjs';
import { createPgDb } from '../src/db/pg.js';
import { createUserRepository } from '../src/auth/repository.js';
import { validateRegistration } from '../src/auth/registration.js';
import { createProjectRepository } from '../src/projects/repository.js';
import { createProjectService } from '../src/projects/service.js';

const contrasena = process.env.DEMO_PASSWORD || 'Demo12345';
const USERS = [
  { nombreCompleto: 'Productor Demo', correo: 'productor@demo.conexagro.co', tipoDocumento: 'CC', numeroDocumento: '1000000001', telefono: '3000000001', roles: ['PRODUCTOR'] },
  { nombreCompleto: 'Propietario Demo', correo: 'propietario@demo.conexagro.co', tipoDocumento: 'CC', numeroDocumento: '1000000002', telefono: '3000000002', roles: ['PROPIETARIO'] },
  { nombreCompleto: 'Inversionista Demo', correo: 'inversionista@demo.conexagro.co', tipoDocumento: 'CC', numeroDocumento: '1000000003', telefono: '3000000003', roles: ['INVERSIONISTA'] },
];
const PROJECTS = [
  { nombre: 'Maíz tecnificado en el Sinú', descripcion: 'Siembra de maíz con riego por goteo en el valle del Sinú.', tipoCultivo: 'Maíz', areaRequeridaHa: 12.5, ubicacionDeseada: 'Montería, Córdoba', montoInversion: 80000000, tiempoRetornoMeses: 8 },
  { nombre: 'Plátano hartón de exportación', descripcion: 'Cultivo de plátano hartón con asistencia técnica y compra asegurada.', tipoCultivo: 'Plátano', areaRequeridaHa: 20, ubicacionDeseada: 'Cereté, Córdoba', montoInversion: 150000000, tiempoRetornoMeses: 12 },
];

const db = createPgDb();
try {
  const users = createUserRepository(db);
  const hash = await bcrypt.hash(contrasena, 10);
  const byEmail = {};
  for (const u of USERS) {
    const d = validateRegistration({ ...u, contrasena, aceptaTerminos: true });
    const existing = await users.findByEmail(d.correo);
    byEmail[d.correo] = existing ?? await users.insertUser({ ...d, contrasenaHash: hash }, { verificado: true });
    console.log(`${existing ? 'Ya existía ' : 'Creado     '} ${d.correo} (${d.roles.join(',')})`);
  }
  const autor = byEmail['productor@demo.conexagro.co'];
  const projects = createProjectService(createProjectRepository(db));
  const { rows } = await db.query('SELECT count(*)::int AS n FROM proyectos WHERE autor_id = $1', [String(autor.id)]);
  if (rows[0].n === 0) {
    for (const p of PROJECTS) await projects.create({ id: String(autor.id), roles: autor.roles }, p);
    console.log(`Creados ${PROJECTS.length} proyectos de ejemplo`);
  } else {
    console.log('Los proyectos de ejemplo ya existían');
  }
  console.log(`\nContraseña de las cuentas demo: ${contrasena}`);
} catch (e) {
  console.error('Error cargando datos de demo:', e.message, e.fields ? JSON.stringify(e.fields) : '');
  process.exitCode = 1;
} finally {
  await db.end();
}
