import { validateCreate, validateUpdate } from './validation.js';
import { forbidden, notFound, conflict, unauthorized, validationError, tooLarge, documentNotFound } from './errors.js';

export const ROLES = { PRODUCTOR: 'PRODUCTOR', ADMIN: 'ADMINISTRADOR' };
export const MAX_DOC_BYTES = 4 * 1024 * 1024; // límite por defecto del documento de soporte (4 MB; Vercel admite cuerpos de ~4,5 MB)

// Nombre de archivo seguro para guardar y para la cabecera Content-Disposition.
export function sanitizeFilename(name) {
  const base = String(name ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[\\/]/).pop().replace(/[^\w.\- ]/g, '').trim().slice(0, 100);
  const stem = base.replace(/\.pdf$/i, '').replace(/^\.+/, '');
  return `${stem || 'soporte'}.pdf`;
}

const isAdmin = (u) => u.roles.includes(ROLES.ADMIN);
const canPublish = (u) => u.roles.includes(ROLES.PRODUCTOR) || isAdmin(u); // matriz de permisos 6.3

export function createProjectService(repo, { now = () => new Date().toISOString() } = {}) {
  const requireUser = (u) => {
    if (!u || !u.id) throw unauthorized();
    return u;
  };

  // RN-18: solo el autor o el administrador. Si el proyecto no es visible para el usuario, se oculta su existencia.
  const loadOwned = async (user, id) => {
    const p = await repo.findById(id);
    if (!p) throw notFound();
    if (p.autorId !== user.id && !isAdmin(user)) {
      throw p.estado === 'activo' ? forbidden('Solo el productor autor o el administrador pueden modificar el proyecto') : notFound();
    }
    return p;
  };

  // Decisión 4: un proyecto cerrado queda cerrado (no se edita ni se reabre).
  const get = async (user, id) => {
    requireUser(user);
    const p = await repo.findById(id);
    if (!p) throw notFound();
    if (p.estado !== 'activo' && p.autorId !== user.id && !isAdmin(user)) throw notFound();
    return { ...p, documento: await repo.getDocumentMeta(id) };
  };

  return {
    async create(user, input) {
      requireUser(user);
      if (!canPublish(user)) throw forbidden('Solo productores o administradores pueden publicar proyectos');
      const data = validateCreate(input);
      return repo.insert(user.id, data, now()); // RN-16: estado inicial 'activo'
    },
    async listActive(user) {
      requireUser(user);
      return repo.listActive();
    },
    async listMine(user) {
      requireUser(user);
      return repo.listByAuthor(user.id);
    },
    get,
    async update(user, id, input) {
      requireUser(user);
      const p = await loadOwned(user, id);
      if (p.estado !== 'activo') throw conflict('Un proyecto cerrado no puede editarse');
      const patch = validateUpdate(input);
      return repo.update(id, { ...p, ...patch }, now());
    },
    async close(user, id) {
      requireUser(user);
      const p = await loadOwned(user, id);
      if (p.estado !== 'activo') throw conflict('El proyecto ya está cerrado');
      return repo.close(id, now());
    },

    // RN-17: máximo un documento PDF; subir de nuevo lo reemplaza. Solo autor/admin (RN-18), proyecto activo.
    async attachDocument(user, id, { contenido, nombreArchivo }, { maxBytes = MAX_DOC_BYTES } = {}) {
      requireUser(user);
      const p = await loadOwned(user, id);
      if (p.estado !== 'activo') throw conflict('Un proyecto cerrado no admite cambios en su documento');
      if (!Buffer.isBuffer(contenido) || contenido.length === 0)
        throw validationError({ documento: 'El archivo está vacío' });
      if (contenido.length > maxBytes) throw tooLarge(maxBytes);
      if (contenido.subarray(0, 5).toString('latin1') !== '%PDF-')
        throw validationError({ documento: 'El archivo no es un PDF válido' });
      return repo.saveDocument(id, { nombreArchivo: sanitizeFilename(nombreArchivo), contenido }, now());
    },
    // Decisión 9: cualquier usuario autenticado puede descargar el PDF de un proyecto visible para él.
    async getDocument(user, id) {
      await get(user, id); // misma visibilidad que el detalle del proyecto
      const doc = await repo.getDocument(id);
      if (!doc) throw documentNotFound();
      return doc;
    },
    async removeDocument(user, id) {
      requireUser(user);
      const p = await loadOwned(user, id);
      if (p.estado !== 'activo') throw conflict('Un proyecto cerrado no admite cambios en su documento');
      if (!(await repo.deleteDocument(id))) throw documentNotFound();
      return { eliminado: true };
    },
  };
}
