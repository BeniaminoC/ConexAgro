// Tokens de verificación de correo (RF-01, RN-03: expira en 24 h). Se guarda solo el hash.
import { createHash, randomBytes } from 'node:crypto';

export const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
export const hashToken = (token) => createHash('sha256').update(String(token)).digest('hex');

export function generateVerification(now = Date.now()) {
  const token = randomBytes(32).toString('base64url'); // se envía por correo
  return { token, tokenHash: hashToken(token), expiraEn: new Date(now + VERIFY_TTL_MS) };
}

// registro = { expiraEn: Date, usadoEn: Date|null } (fila encontrada por hashToken(token))
export function checkVerification(registro, now = Date.now()) {
  if (!registro) return 'invalido';
  if (registro.usadoEn) return 'usado';
  return now >= new Date(registro.expiraEn).getTime() ? 'expirado' : 'valido'; // expirado -> reenviar (FA-03)
}
