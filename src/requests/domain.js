// Dominio de solicitudes de vinculación (RF-07). Funciones puras: no tocan BD ni red.
// Una solicitud: { id, emisorId, receptorId, referenciaTipo, referenciaId, mensaje, condiciones, estado, origenId, historial[] }
import { AppError, conflict, forbidden, validationError } from '../projects/errors.js';

export const ESTADOS = ['pendiente', 'aceptada', 'rechazada', 'contrapropuesta'];
export const REFERENCIAS = ['terreno', 'proyecto'];
const ACCIONES = { aceptar: 'aceptada', rechazar: 'rechazada', contraproponer: 'contrapropuesta' };

const isAdmin = (u) => u.roles?.includes('ADMINISTRADOR');
const clean = (v) => (typeof v === 'string' ? v.trim() : '');
const iso = (now) => new Date(now).toISOString();

export const isActive = (r) => r.estado === 'pendiente';

// Misma pareja de usuarios (en cualquier sentido) y misma referencia, con solicitud activa. (FA-01)
export function findDuplicate(existing, { emisorId, receptorId, referenciaTipo, referenciaId }) {
  const pair = (r) => (r.emisorId === emisorId && r.receptorId === receptorId)
    || (r.emisorId === receptorId && r.receptorId === emisorId);
  return existing.find((r) => isActive(r) && pair(r)
    && r.referenciaTipo === referenciaTipo && r.referenciaId === referenciaId) ?? null;
}

export function createRequest(sender, input = {}, existing = [], now = Date.now()) {
  if (isAdmin(sender)) throw forbidden('El administrador no puede enviar solicitudes (RN-25)'); // RN-25
  const f = {};
  const receptorId = clean(String(input.receptorId ?? ''));
  const referenciaTipo = clean(input.referenciaTipo);
  const mensaje = clean(input.mensaje);
  if (!receptorId) f.receptorId = 'Obligatorio';
  else if (receptorId === String(sender.id)) f.receptorId = 'No puedes enviarte una solicitud a ti mismo';
  if (!REFERENCIAS.includes(referenciaTipo)) f.referenciaTipo = 'Debe ser terreno o proyecto';
  if (!Number.isInteger(input.referenciaId) || input.referenciaId < 1) f.referenciaId = 'Id de referencia inválido';
  if (mensaje.length < 1 || mensaje.length > 1000) f.mensaje = 'Entre 1 y 1000 caracteres';
  let condiciones = null;
  if (input.condiciones != null && input.condiciones !== '') {
    condiciones = clean(input.condiciones);
    if (!condiciones || condiciones.length > 1000) f.condiciones = 'Máximo 1000 caracteres';
  }
  if (Object.keys(f).length) throw validationError(f);

  const key = { emisorId: String(sender.id), receptorId, referenciaTipo, referenciaId: input.referenciaId };
  if (findDuplicate(existing, key)) throw conflict('Ya existe una solicitud activa entre ustedes para esta referencia');
  return { ...key, mensaje, condiciones, estado: 'pendiente', origenId: null,
    historial: [{ estado: 'pendiente', en: iso(now), por: key.emisorId }] };
}

// Devuelve { solicitud, contrapropuesta } (la segunda solo si la acción es contraproponer). (FA-03)
// SUPOSICIÓN: la contrapropuesta cierra la solicitud original (estado 'contrapropuesta') y genera una
// nueva solicitud pendiente con emisor y receptor invertidos, enlazada por origenId. Confirmar con el docente.
export function respond(request, actor, accion, input = {}, now = Date.now()) {
  if (isAdmin(actor)) throw forbidden('El administrador no puede gestionar solicitudes (RN-25)');
  if (String(actor.id) !== request.receptorId) throw forbidden('Solo el receptor puede responder');
  if (!(accion in ACCIONES)) throw validationError({ accion: 'Debe ser aceptar, rechazar o contraproponer' });
  if (request.estado !== 'pendiente') throw conflict('La solicitud ya está cerrada y no puede modificarse (RN-26)');

  let counter = null;
  if (accion === 'contraproponer') {
    const mensaje = clean(input.mensaje);
    if (mensaje.length < 1 || mensaje.length > 1000) throw validationError({ mensaje: 'Entre 1 y 1000 caracteres' });
    const condiciones = input.condiciones ? clean(input.condiciones).slice(0, 1000) : null;
    counter = { emisorId: request.receptorId, receptorId: request.emisorId,
      referenciaTipo: request.referenciaTipo, referenciaId: request.referenciaId,
      mensaje, condiciones, estado: 'pendiente', origenId: request.id ?? null,
      historial: [{ estado: 'pendiente', en: iso(now), por: request.receptorId }] };
  }
  const estado = ACCIONES[accion];
  const solicitud = { ...request, estado,
    historial: [...request.historial, { estado, en: iso(now), por: String(actor.id) }] }; // RN-28
  return { solicitud, contrapropuesta: counter };
}

// RN-27: cada usuario solo ve las que envió o recibió.
export const visibleTo = (request, user) =>
  String(user.id) === request.emisorId || String(user.id) === request.receptorId;
