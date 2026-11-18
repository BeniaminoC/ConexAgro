// Crea un administrador verificado (RN-05: no se puede registrar por el flujo público).
// Uso: DATABASE_URL=... ADMIN_PASSWORD='Clave1234' node scripts/create-admin.js "Nombre Apellido" correo@dominio.co CC 12345678 3001234567
import { createPgDb } from '../src/db/pg.js';
import { createUserRepository } from '../src/auth/repository.js';
import { createAuthService } from '../src/auth/service.js';

const [nombreCompleto, correo, tipoDocumento, numeroDocumento, telefono] = process.argv.slice(2);
const contrasena = process.env.ADMIN_PASSWORD; // por entorno para no dejarla en el historial del shell
const db = createPgDb();
try {
  const auth = createAuthService(createUserRepository(db), {});
  const u = await auth.createAdmin({ nombreCompleto, correo, contrasena, tipoDocumento, numeroDocumento, telefono });
  console.log(`Administrador creado: id=${u.id} correo=${u.correo}`);
} catch (e) {
  console.error('No se pudo crear el administrador:', e.message, e.fields ? JSON.stringify(e.fields) : '');
  process.exitCode = 1;
} finally {
  await db.end();
}
