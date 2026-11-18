import { validationError } from './errors.js';

// Decisión 3 (2026-11-17): TODOS los campos del proyecto son obligatorios.
const REQUIRED = [
  'nombre', 'descripcion', 'tipoCultivo', 'areaRequeridaHa',
  'ubicacionDeseada', 'montoInversion', 'tiempoRetornoMeses',
];

const MAX_AREA_HA = 99_999_999; // NUMERIC(10,2)
const MAX_MONTO = 999_999_999_999; // NUMERIC(14,2)

const isBlank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
const twoDecimals = (v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;
const text = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;

function checkField(key, v, errors) {
  switch (key) {
    case 'nombre':
      if (!text(v, 3, 120)) errors.nombre = 'Debe tener entre 3 y 120 caracteres';
      break;
    case 'descripcion':
      if (!text(v, 1, 2000)) errors.descripcion = 'Es obligatoria (máx. 2000 caracteres)';
      break;
    case 'tipoCultivo':
      if (!text(v, 1, 80)) errors.tipoCultivo = 'Es obligatorio (máx. 80 caracteres)';
      break;
    case 'ubicacionDeseada':
      if (!text(v, 1, 200)) errors.ubicacionDeseada = 'Es obligatoria (máx. 200 caracteres)';
      break;
    case 'areaRequeridaHa':
      if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || v > MAX_AREA_HA || !twoDecimals(v))
        errors.areaRequeridaHa = 'Debe ser un número mayor que 0, con máximo 2 decimales';
      break;
    case 'montoInversion': // FA-02: negativo o cero es inválido
      if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || v > MAX_MONTO || !twoDecimals(v))
        errors.montoInversion = 'Debe ser un número mayor que 0, con máximo 2 decimales';
      break;
    case 'tiempoRetornoMeses':
      if (!Number.isInteger(v) || v < 1 || v > 600) errors.tiempoRetornoMeses = 'Debe ser un entero entre 1 y 600 (meses)';
      break;
  }
}

function clean(input, { partial }) {
  if (input === null || typeof input !== 'object' || Array.isArray(input))
    throw validationError({ _body: 'Se esperaba un objeto JSON' });
  const errors = {};
  const out = {};
  for (const key of REQUIRED) {
    const v = input[key];
    if (isBlank(v)) {
      // En creación falta el campo; en edición solo es error si se envió vacío.
      if (!partial || key in input) errors[key] = 'Campo obligatorio';
      continue;
    }
    checkField(key, v, errors);
    out[key] = typeof v === 'string' ? v.trim() : v;
  }
  if (Object.keys(errors).length) throw validationError(errors);
  if (partial && Object.keys(out).length === 0) throw validationError({ _body: 'No hay campos para actualizar' });
  return out;
}

export const validateCreate = (input) => clean(input, { partial: false });
export const validateUpdate = (input) => clean(input, { partial: true });
