'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '../../src/ui/session.js';
import { errorText } from '../../src/ui/format.js';

function Verificar() {
  const token = useSearchParams().get('token');
  const [state, setState] = useState(token ? 'cargando' : 'sin-token');
  const [message, setMessage] = useState('');
  const [code, setCode] = useState('');
  const [correo, setCorreo] = useState('');
  const [info, setInfo] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return; // un solo intento (el modo estricto de React ejecuta dos veces)
    started.current = true;
    apiFetch('/auth/verify-email', { method: 'POST', auth: false, body: { token } }).then((r) => {
      if (r.ok) setState('ok');
      else { setState('error'); setCode(r.body?.error?.code || ''); setMessage(errorText(r.body)); }
    });
  }, [token]);

  async function resend(e) {
    e.preventDefault();
    const r = await apiFetch('/auth/resend-verification', { method: 'POST', auth: false, body: { correo } });
    setInfo(r.ok ? 'Si la cuenta existe y falta verificarla, te enviamos un nuevo enlace.' : errorText(r.body));
  }

  return (
    <section aria-live="polite">
      <h1>Verificación de correo</h1>
      {state === 'cargando' && <p>Verificando tu correo…</p>}
      {state === 'sin-token' && <p className="alert">El enlace no incluye un código de verificación. Abre el enlace completo del correo.</p>}
      {state === 'ok' && (<><p className="ok">¡Listo! Tu correo fue verificado y tu cuenta está activa.</p><p><Link className="btn" href="/login">Iniciar sesión</Link></p></>)}
      {state === 'error' && (
        <>
          <p className="alert" role="alert">{message}</p>
          {code === 'TOKEN_USED' && <p><Link href="/login">Ir a iniciar sesión</Link></p>}
          {code !== 'TOKEN_USED' && (
            <form onSubmit={resend} className="card">
              <div className="field">
                <label htmlFor="correo">Correo para reenviar el enlace</label>
                <input id="correo" type="email" autoComplete="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
              </div>
              <button className="btn" type="submit">Reenviar verificación</button>
              {info && <p className="ok" role="status">{info}</p>}
            </form>
          )}
        </>
      )}
    </section>
  );
}

export default function Page() {
  return <Suspense fallback={<p>Cargando…</p>}><Verificar /></Suspense>;
}
