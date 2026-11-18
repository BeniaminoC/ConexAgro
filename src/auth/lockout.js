// Política de bloqueo e inactividad. Funciones puras (el estado vive en la tabla usuarios).
// RN-06/RN-07: 5 intentos fallidos -> bloqueo de 30 min. RN-09: sesión expira a los 30 min sin actividad.
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MS = 30 * 60 * 1000;
export const IDLE_MS = 30 * 60 * 1000;

// estado = { intentosFallidos: number, bloqueadoHasta: number|null (ms epoch) }
export const initialState = () => ({ intentosFallidos: 0, bloqueadoHasta: null });

export const isLocked = (state, now = Date.now()) =>
  state.bloqueadoHasta != null && now < state.bloqueadoHasta;

export const lockRemainingMs = (state, now = Date.now()) =>
  isLocked(state, now) ? state.bloqueadoHasta - now : 0;

export function registerFailure(state, now = Date.now()) {
  // Si el bloqueo ya venció, se empieza a contar de nuevo.
  const base = state.bloqueadoHasta != null && now >= state.bloqueadoHasta ? initialState() : state;
  if (isLocked(base, now)) return base; // ya bloqueado: no se extiende
  const intentos = base.intentosFallidos + 1;
  return intentos >= MAX_FAILED_ATTEMPTS
    ? { intentosFallidos: intentos, bloqueadoHasta: now + LOCK_MS }
    : { intentosFallidos: intentos, bloqueadoHasta: null };
}

export const registerSuccess = () => initialState();

export const isIdle = (lastActivityMs, now = Date.now()) => now - lastActivityMs >= IDLE_MS;
