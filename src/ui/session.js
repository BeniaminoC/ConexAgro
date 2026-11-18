'use client';
// Sesión en el navegador. DECISIÓN (RI-09 admite «httpOnly cookies o secure localStorage»): tokens en
// localStorage, para poder cerrar sesión en todas las pestañas (evento `storage`) y aplicar los 30 min de
// inactividad (RN-09) en el cliente. Riesgo conocido: un XSS podría leerlos; mitigado por React (escapa
// el texto) y por la sanitización del servidor. Migrar a cookies httpOnly si el equipo lo prefiere.
import { useEffect, useState } from 'react';
import { isIdle } from './format.js';

const KEY = 'conexagro.session';
const EVENT = 'conexagro:session';

export function getSession() {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function write(s) {
  try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch {}
  window.dispatchEvent(new Event(EVENT));
}
export const saveSession = (s) => write({ ...s, last: Date.now() });
export const clearSession = () => write(null);

// Registra actividad (como mucho cada 10 s) para el contador de inactividad.
function touch() {
  const s = getSession();
  if (s && Date.now() - s.last > 10_000) { try { localStorage.setItem(KEY, JSON.stringify({ ...s, last: Date.now() })); } catch {} }
}

// Hook: { session, ready }. `ready` evita parpadeos antes de leer localStorage (SSR).
export function useSession() {
  const [state, setState] = useState({ session: null, ready: false });
  useEffect(() => {
    const read = () => {
      const s = getSession();
      if (s && isIdle(s)) { clearSession(); return; }
      setState({ session: s, ready: true });
    };
    read();
    window.addEventListener(EVENT, read);
    window.addEventListener('storage', (e) => { if (e.key === KEY || e.key === null) read(); });
    const events = ['click', 'keydown', 'touchstart'];
    events.forEach((n) => window.addEventListener(n, touch, { passive: true }));
    const timer = setInterval(read, 30_000);
    return () => {
      window.removeEventListener(EVENT, read);
      events.forEach((n) => window.removeEventListener(n, touch));
      clearInterval(timer);
    };
  }, []);
  return state;
}

// fetch a /api/v1 con Bearer; si el acceso expiró (401) renueva una vez con el refresh token.
// Opciones: `raw` (cuerpo binario tal cual, con `headers`) y `blob` (devuelve el archivo en `blob`).
export async function apiFetch(path, { method = 'GET', body, auth = true, raw, headers = {}, blob = false } = {}) {
  const call = (token) => fetch(`/api/v1${path}`, {
    method,
    headers: { ...headers, ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body),
  });
  let s = auth ? getSession() : null;
  let res = await call(s?.accessToken);
  if (auth && res.status === 401 && s?.refreshToken) {
    const r = await fetch('/api/v1/auth/refresh', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: s.refreshToken }),
    });
    if (r.ok) {
      const d = (await r.json()).data;
      s = { ...s, accessToken: d.accessToken, user: d.user };
      saveSession(s);
      res = await call(s.accessToken);
    } else clearSession();
  }
  if (blob && res.ok) return { ok: true, status: res.status, body: null, blob: await res.blob() };
  const text = await res.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch {}
  return { ok: res.ok, status: res.status, body: json };
}
