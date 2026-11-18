import { createPgDb } from '../db/pg.js';
import { createProjectRepository } from '../projects/repository.js';
import { createProjectService } from '../projects/service.js';
import { createUserRepository } from '../auth/repository.js';
import { createAuthService } from '../auth/service.js';
import { createMailerFromEnv } from '../auth/mailer.js';
import { createRequestRepository } from '../requests/repository.js';
import { createRequestService } from '../requests/service.js';

// Singletons en globalThis: Next.js puede cargar este módulo varias veces (rutas, recarga en desarrollo)
// y no debemos abrir un pool de conexiones por cada copia. Un solo pool compartido por ambos servicios.
const DB = Symbol.for('conexagro.db');
const PROJECTS = Symbol.for('conexagro.projectService');
const AUTH = Symbol.for('conexagro.authService');
const REQUESTS = Symbol.for('conexagro.requestService');

const getDb = () => (globalThis[DB] ??= createPgDb());

export function getService() {
  return (globalThis[PROJECTS] ??= createProjectService(createProjectRepository(getDb())));
}

export function getAuthService() {
  return (globalThis[AUTH] ??= createAuthService(createUserRepository(getDb()), { mailer: createMailerFromEnv() }));
}

export function getRequestService() {
  return (globalThis[REQUESTS] ??= createRequestService(createRequestRepository(getDb())));
}

// Solo para pruebas: inyectan servicios ya construidos (con otra base de datos).
export function setService(service) { globalThis[PROJECTS] = service; }
export function setAuthService(service) { globalThis[AUTH] = service; }
export function setRequestService(service) { globalThis[REQUESTS] = service; }
