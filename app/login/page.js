'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Field } from '../components/Field.js';
import { apiFetch, saveSession } from '../../src/ui/session.js';
import { errorText, fieldErrors } from '../../src/ui/format.js';

export default function Login() {
  const router = useRouter();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [code, setCode] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setFormError(''); setInfo(''); setCode('');
    const local = {};
    if (!correo.trim()) local.correo = 'Escribe tu correo';
    if (!contrasena) local.contrasena = 'Escribe tu contraseña';
    setErrors(local);
    if (Object.keys(local).length) return;
    setBusy(true);
    const r = await apiFetch('/auth/login', { method: 'POST', auth: false, body: { correo, contrasena } });
    setBusy(false);
    if (r.ok) { saveSession(r.body.data); router.push('/oportunidades'); return; }
    setErrors(fieldErrors(r.body));
    setCode(r.body?.error?.code || '');
    setFormError(errorText(r.body));
  }

  async function resend() {
    setInfo('');
    const r = await apiFetch('/auth/resend-verification', { method: 'POST', auth: false, body: { correo } });
    setInfo(r.ok ? 'Si la cuenta existe y falta verificarla, te enviamos un nuevo enlace.' : errorText(r.body));
  }

  return (
    <section>
      <p className="eyebrow">Bienvenido de nuevo</p>
      <h1>Ingresa a tu cuenta</h1>
      {formError && <p className="alert" role="alert">{formError}</p>}
      {code === 'EMAIL_NOT_VERIFIED' && <p><button type="button" className="btn btn-sec" onClick={resend}>Reenviar correo de verificación</button></p>}
      {info && <p className="ok" role="status">{info}</p>}
      <form onSubmit={submit} noValidate className="card" style={{ maxWidth: '28rem' }}>
        <Field id="correo" label="Correo electrónico" error={errors.correo}>
          {(a) => <input id="correo" type="email" autoComplete="email" value={correo} onChange={(e) => setCorreo(e.target.value)} {...a} />}
        </Field>
        <Field id="contrasena" label="Contraseña" error={errors.contrasena}>
          {(a) => <input id="contrasena" type="password" autoComplete="current-password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} {...a} />}
        </Field>
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
      </form>
      <p>¿No tienes cuenta? <Link href="/registro">Regístrate</Link></p>
    </section>
  );
}
