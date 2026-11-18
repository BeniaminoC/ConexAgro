// Validación de registro público (RF-01). Función pura; la unicidad de correo/documento la garantizará la BD.
import { validationError } from '../projects/errors.js';

export const PUBLIC_ROLES = ['PROPIETARIO', 'PRODUCTOR', 'INVERSIONISTA'];
// SUPOSICIÓN: el ERS no lista los tipos de documento; se usan los habituales en Colombia. Confirmar.
export const DOC_TYPES = ['CC', 'CE', 'TI', 'PASAPORTE', 'NIT'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const str = (v) => (typeof v === 'string' ? v.trim() : '');

export function validateRegistration(input = {}) {
  const f = {};
  const nombreCompleto = str(input.nombreCompleto);
  if (nombreCompleto.length < 3 || nombreCompleto.length > 120) f.nombreCompleto = 'Entre 3 y 120 caracteres';

  const correo = str(input.correo).toLowerCase();
  if (correo.length > 254 || !EMAIL_RE.test(correo)) f.correo = 'Correo con formato inválido';

  // SUPOSICIÓN: el ERS no define la política de contraseña; mínimo 8, con letra y número.
  const contrasena = typeof input.contrasena === 'string' ? input.contrasena : '';
  if (contrasena.length < 8 || contrasena.length > 72 || !/[A-Za-z]/.test(contrasena) || !/\d/.test(contrasena)) {
    f.contrasena = 'Entre 8 y 72 caracteres, con al menos una letra y un número'; // 72 = límite de bcrypt
  }

  const tipoDocumento = str(input.tipoDocumento).toUpperCase();
  if (!DOC_TYPES.includes(tipoDocumento)) f.tipoDocumento = `Debe ser uno de: ${DOC_TYPES.join(', ')}`;

  const numeroDocumento = str(input.numeroDocumento);
  if (!/^[A-Za-z0-9-]{5,20}$/.test(numeroDocumento)) f.numeroDocumento = 'Entre 5 y 20 caracteres alfanuméricos';

  const telefono = str(input.telefono).replace(/[\s()-]/g, '');
  if (!/^\+?\d{7,15}$/.test(telefono)) f.telefono = 'Teléfono inválido (7 a 15 dígitos)';

  // RF-01 paso 2: "puede ser varios, pero no los tres" -> 1 o 2 perfiles. RN-05: nunca ADMINISTRADOR.
  const roles = Array.isArray(input.roles) ? input.roles.map((r) => String(r).trim().toUpperCase()) : [];
  if (roles.length < 1 || roles.length > 2 || new Set(roles).size !== roles.length
      || roles.some((r) => !PUBLIC_ROLES.includes(r))) {
    f.roles = 'Elige uno o dos perfiles distintos entre propietario, productor e inversionista (no los tres)';
  }

  if (input.aceptaTerminos !== true) f.aceptaTerminos = 'Debes aceptar los términos y condiciones';

  if (Object.keys(f).length) throw validationError(f);
  return { nombreCompleto, correo, contrasena, tipoDocumento, numeroDocumento, telefono, roles };
}
