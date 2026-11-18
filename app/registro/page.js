'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Field } from '../components/Field.js';
import { apiFetch } from '../../src/ui/session.js';
import { ROLES, errorText, fieldErrors, validateRegistration } from '../../src/ui/format.js';

const empty = { nombreCompleto: '', correo: '', contrasena: '', tipoDocumento: 'CC', numeroDocumento: '', telefono: '', roles: [], aceptaTerminos: false };

function Registro() {
  // El perfil puede llegar preseleccionado desde la pantalla de inicio (?perfil=PRODUCTOR).
  const perfil = useSearchParams().get('perfil');
  const [f, setF] = useState(() => ({ ...empty, roles: ROLES.some((r) => r.value === perfil) ? [perfil] : [] }));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const toggleRole = (v) => setF((p) => ({ ...p, roles: p.roles.includes(v) ? p.roles.filter((r) => r !== v) : [...p.roles, v] }));

  async function submit(e) {
    e.preventDefault();
    setFormError('');
    const local = validateRegistration(f);
    setErrors(local);
    if (Object.keys(local).length) return;
    setBusy(true);
    const r = await apiFetch('/auth/register', { method: 'POST', auth: false, body: f });
    setBusy(false);
    if (r.ok) { setDone(f.correo); return; }
    setErrors(fieldErrors(r.body));
    setFormError(errorText(r.body));
  }

  if (done) {
    return (
      <section aria-live="polite">
        <p className="eyebrow">Casi listo</p>
        <h1>Revisa tu correo</h1>
        <p>Enviamos un enlace de verificación a <strong>{done}</strong>. Vence en 24 horas y, sin verificarlo, no podrás iniciar sesión.</p>
        <p><Link href="/login">Ir a iniciar sesión</Link></p>
      </section>
    );
  }

  return (
    <section>
      <p className="eyebrow">Crea tu perfil</p>
      <h1>Completa tus datos</h1>
      {formError && <p className="alert" role="alert">{formError}</p>}
      <form onSubmit={submit} noValidate className="card">
        <div className="grid-2">
          <Field id="nombreCompleto" label="Nombre completo" error={errors.nombreCompleto}>
            {(a) => <input id="nombreCompleto" autoComplete="name" value={f.nombreCompleto} onChange={set('nombreCompleto')} {...a} />}
          </Field>
          <Field id="correo" label="Correo electrónico" error={errors.correo}>
            {(a) => <input id="correo" type="email" autoComplete="email" value={f.correo} onChange={set('correo')} {...a} />}
          </Field>
        </div>
        <Field id="contrasena" label="Contraseña" hint="Mínimo 8 caracteres, con al menos una letra y un número." error={errors.contrasena}>
          {(a) => <input id="contrasena" type="password" autoComplete="new-password" value={f.contrasena} onChange={set('contrasena')} {...a} />}
        </Field>
        <div className="grid-2">
        <Field id="tipoDocumento" label="Tipo de documento" error={errors.tipoDocumento}>
          {(a) => (
            <select id="tipoDocumento" value={f.tipoDocumento} onChange={set('tipoDocumento')} {...a}>
              {['CC', 'CE', 'TI', 'PASAPORTE', 'NIT'].map((t) => <option key={t}>{t}</option>)}
            </select>
          )}
        </Field>
        <Field id="numeroDocumento" label="Número de documento" error={errors.numeroDocumento}>
          {(a) => <input id="numeroDocumento" inputMode="numeric" value={f.numeroDocumento} onChange={set('numeroDocumento')} {...a} />}
        </Field>
        </div>
        <Field id="telefono" label="Teléfono" error={errors.telefono}>
          {(a) => <input id="telefono" type="tel" autoComplete="tel" value={f.telefono} onChange={set('telefono')} {...a} />}
        </Field>
        <fieldset aria-describedby={errors.roles ? 'roles-err' : undefined}>
          <legend>Perfil (uno o dos, no los tres)</legend>
          {ROLES.map((r) => (
            <label key={r.value} className="check">
              <input type="checkbox" checked={f.roles.includes(r.value)} onChange={() => toggleRole(r.value)} /> {r.label}
            </label>
          ))}
          {errors.roles && <p id="roles-err" className="error" role="alert">{errors.roles}</p>}
        </fieldset>
        <div className="field">
          <label className="check">
            <input type="checkbox" checked={f.aceptaTerminos} aria-invalid={errors.aceptaTerminos ? 'true' : undefined}
              onChange={(e) => setF((p) => ({ ...p, aceptaTerminos: e.target.checked }))} />
            Acepto los términos y condiciones y el tratamiento de mis datos personales
          </label>
          {errors.aceptaTerminos && <p className="error" role="alert">{errors.aceptaTerminos}</p>}
        </div>
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Enviando…' : 'Registrarme'}</button>
      </form>
      <p>¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link></p>
    </section>
  );
}

export default function Page() {
  return <Suspense fallback={<p>Cargando…</p>}><Registro /></Suspense>;
}
