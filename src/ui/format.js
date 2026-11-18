// Funciones puras de la interfaz (sin DOM): verificables con `node --test`.
export const IDLE_MS = 30 * 60 * 1000; // RN-09: 30 minutos de inactividad

export const isIdle = (session, now = Date.now()) => !session || now - Number(session.last || 0) > IDLE_MS;

// Texto de error accionable a partir del cuerpo de error de la API.
export function errorText(body, fallback = 'Ocurrió un error. Inténtalo de nuevo.') {
  return body?.error?.message || fallback;
}
export const fieldErrors = (body) => body?.error?.fields || {};

export const ESTADOS = {
  pendiente: 'Pendiente', aceptada: 'Aceptada', rechazada: 'Rechazada', contrapropuesta: 'Contrapropuesta enviada',
};
export const estadoLabel = (e) => ESTADOS[e] || e;

export const fechaHora = (iso) =>
  new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

export const ROLES = [
  { value: 'PROPIETARIO', label: 'Propietario (tengo terrenos)' },
  { value: 'PRODUCTOR', label: 'Productor (tengo un proyecto agrícola)' },
  { value: 'INVERSIONISTA', label: 'Inversionista' },
];

// Validación previa al envío; el servidor valida de nuevo (la UI nunca es la defensa, RBAC en servidor).
export function validateRegistration(f) {
  const e = {};
  if (!f.nombreCompleto?.trim()) e.nombreCompleto = 'Escribe tu nombre completo';
  if (!/^\S+@\S+\.\S+$/.test(f.correo || '')) e.correo = 'Escribe un correo válido';
  if (!f.contrasena || f.contrasena.length < 8 || !/[A-Za-z]/.test(f.contrasena) || !/\d/.test(f.contrasena)) {
    e.contrasena = 'Mínimo 8 caracteres, con al menos una letra y un número';
  }
  if (!f.numeroDocumento?.trim()) e.numeroDocumento = 'Escribe tu número de documento';
  if (!f.telefono?.trim()) e.telefono = 'Escribe tu teléfono';
  if (!f.roles?.length) e.roles = 'Elige al menos un perfil';
  else if (f.roles.length > 2) e.roles = 'Puedes elegir uno o dos perfiles, no los tres';
  if (!f.aceptaTerminos) e.aceptaTerminos = 'Debes aceptar los términos y el tratamiento de datos';
  return e;
}

export const MAX_PDF_BYTES = 4 * 1024 * 1024; // igual que MAX_DOC_BYTES del servidor (suposición, no fijada por el ERS)

export const cop = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

// Convierte «12,5» o «12.5» en número; vacío o inválido → NaN.
const num = (v) => (String(v ?? '').trim() === '' ? NaN : Number(String(v).trim().replace(',', '.')));
const twoDecimals = (v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;

// Valida el formulario de proyecto (RF-04, decisión 3: todos obligatorios) y devuelve { errors, data }.
export function parseProject(f) {
  const e = {};
  const t = (k, min, max, msg) => { const v = String(f[k] ?? '').trim(); if (v.length < min || v.length > max) e[k] = msg; return v; };
  const nombre = t('nombre', 3, 120, 'Entre 3 y 120 caracteres');
  const descripcion = t('descripcion', 1, 2000, 'Obligatoria (máximo 2000 caracteres)');
  const tipoCultivo = t('tipoCultivo', 1, 80, 'Obligatorio (máximo 80 caracteres)');
  const ubicacionDeseada = t('ubicacionDeseada', 1, 200, 'Obligatoria (máximo 200 caracteres)');
  const areaRequeridaHa = num(f.areaRequeridaHa);
  if (!(areaRequeridaHa > 0) || !twoDecimals(areaRequeridaHa)) e.areaRequeridaHa = 'Número mayor que 0, con máximo 2 decimales';
  const montoInversion = num(f.montoInversion);
  if (!(montoInversion > 0) || !twoDecimals(montoInversion)) e.montoInversion = 'Número mayor que 0, con máximo 2 decimales';
  const tiempoRetornoMeses = num(f.tiempoRetornoMeses);
  if (!Number.isInteger(tiempoRetornoMeses) || tiempoRetornoMeses < 1 || tiempoRetornoMeses > 600) e.tiempoRetornoMeses = 'Entero entre 1 y 600 meses';
  return { errors: e, data: { nombre, descripcion, tipoCultivo, areaRequeridaHa, ubicacionDeseada, montoInversion, tiempoRetornoMeses } };
}

// Monto abreviado para tarjetas: 55000000 → «$55 M»; 80500000 → «$80,5 M»; 450000 → «$450 mil».
export function copCorto(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000).toLocaleString('es-CO')} mil`;
  return `$${v.toLocaleString('es-CO')}`;
}

export const fechaCorta = (iso) => new Date(iso).toLocaleDateString('es-CO', { dateStyle: 'medium' });
