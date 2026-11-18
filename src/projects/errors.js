export class AppError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}
export const validationError = (fields) => new AppError(400, 'VALIDATION', 'Datos inválidos', fields);
export const unauthorized = () => new AppError(401, 'UNAUTHORIZED', 'Autenticación requerida');
export const forbidden = (msg = 'No tienes permisos para esta acción') => new AppError(403, 'FORBIDDEN', msg);
export const notFound = () => new AppError(404, 'NOT_FOUND', 'Proyecto no encontrado');
export const conflict = (msg) => new AppError(409, 'CONFLICT', msg);
export const tooLarge = (max) => new AppError(413, 'TOO_LARGE', `El archivo supera el máximo permitido (${max} bytes)`);
export const unsupportedMedia = (msg) => new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', msg);
export const documentNotFound = () => new AppError(404, 'NOT_FOUND', 'El proyecto no tiene documento de soporte');
