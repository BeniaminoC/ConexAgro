// Servicio de solicitudes (RF-07): permisos, referencias y persistencia atómica sobre src/requests/domain.js.
import { AppError, forbidden, unauthorized, validationError, conflict } from '../projects/errors.js';
import { createRequest, respond, visibleTo, findDuplicate } from './domain.js';

const MAX_INT4 = 2_147_483_647;
const isAdmin = (u) => u.roles?.includes('ADMINISTRADOR');
const notFoundRequest = () => new AppError(404, 'NOT_FOUND', 'Solicitud no encontrada');
const iso = (t) => new Date(t).toISOString();

export function createRequestService(repo, { now = () => Date.now() } = {}) {
  const uid = (user) => {
    if (!user || !/^\d+$/.test(String(user.id))) throw unauthorized();
    return String(user.id);
  };

  return {
    async create(user, input = {}) {
      const me = uid(user);
      const t = now();
      if (isAdmin(user)) createRequest(user, input, [], t); // lanza 403 (RN-25)
      const body = { ...(input && typeof input === 'object' ? input : {}) };

      // SUPOSICIÓN: solo hay referencia a proyectos (aún no existe la tabla de terrenos).
      if (body.referenciaTipo === 'terreno') {
        throw validationError({ referenciaTipo: 'Las solicitudes sobre terrenos aún no están disponibles' });
      }
      // SUPOSICIÓN: en una solicitud sobre un proyecto, una de las partes es su autor. Si quien envía no es el
      // autor, el receptor es el autor (se completa solo); si es el autor, elige a quién ofrecerlo.
      if (body.referenciaTipo === 'proyecto' && Number.isInteger(body.referenciaId)
          && body.referenciaId >= 1 && body.referenciaId <= MAX_INT4) {
        const p = await repo.findProject(body.referenciaId);
        if (!p || p.estado !== 'activo') throw new AppError(404, 'NOT_FOUND', 'Proyecto no disponible');
        if (p.autor_id !== me) {
          if (body.receptorId != null && String(body.receptorId) !== p.autor_id) {
            throw validationError({ receptorId: 'En un proyecto ajeno, el destinatario es su autor' });
          }
          body.receptorId = p.autor_id;
        }
      }
      createRequest(user, body, [], t); // validación de campos

      const rid = String(body.receptorId).trim();
      const receptor = /^\d+$/.test(rid) && rid.length < 10 ? await repo.findUser(Number(rid)) : null;
      if (!receptor || !receptor.activo || !receptor.correo_verificado || receptor.roles.includes('ADMINISTRADOR')) {
        throw validationError({ receptorId: 'Destinatario no disponible' });
      }

      try {
        return await repo.tx(async (r) => {
          const existing = await r.activeBetween(me, rid, body.referenciaTipo, body.referenciaId);
          if (findDuplicate(existing, { emisorId: me, receptorId: rid, referenciaTipo: body.referenciaTipo,
            referenciaId: body.referenciaId })) throw conflict('Ya existe una solicitud activa entre ustedes para esta referencia');
          return r.insert(createRequest(user, body, existing, t), iso(t));
        });
      } catch (e) {
        if (e?.code === '23505') throw conflict('Ya existe una solicitud activa entre ustedes para esta referencia'); // carrera (FA-01)
        throw e;
      }
    },

    async respond(user, id, accion, input = {}) {
      uid(user);
      if (isAdmin(user)) throw forbidden('El administrador no puede gestionar solicitudes (RN-25)');
      const t = now();
      return repo.tx(async (r) => {
        const req = await r.lock(id);
        if (!req || !visibleTo(req, user)) throw notFoundRequest(); // RN-27
        const out = respond(req, user, accion, input && typeof input === 'object' ? input : {}, t);
        await r.saveResponse(out.solicitud, iso(t));
        const contrapropuesta = out.contrapropuesta ? await r.insert({ ...out.contrapropuesta, origenId: req.id }, iso(t)) : null;
        return { solicitud: out.solicitud, contrapropuesta };
      });
    },

    async get(user, id) {
      uid(user);
      if (isAdmin(user)) throw forbidden('El administrador no gestiona solicitudes propias (RN-25)');
      const req = await repo.get(id);
      if (!req || !visibleTo(req, user)) throw notFoundRequest(); // RN-27
      return req;
    },

    async list(user, box) {
      uid(user);
      if (isAdmin(user)) throw forbidden('El administrador no gestiona solicitudes propias (RN-25)');
      if (box != null && !['recibidas', 'enviadas'].includes(box)) {
        throw validationError({ box: 'Debe ser recibidas o enviadas' });
      }
      return repo.list(user.id, box);
    },
  };
}
