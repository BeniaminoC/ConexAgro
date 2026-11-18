'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Field } from '../../components/Field.js';
import { apiFetch, useSession } from '../../../src/ui/session.js';
import { errorText, fieldErrors, parseProject } from '../../../src/ui/format.js';

const empty = { nombre: '', descripcion: '', tipoCultivo: '', areaRequeridaHa: '', ubicacionDeseada: '', montoInversion: '', tiempoRetornoMeses: '' };

export default function NuevoProyecto() {
  const router = useRouter();
  const { session, ready } = useSession();
  const [f, setF] = useState(empty);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const puede = session?.user?.roles?.some((r) => r === 'PRODUCTOR' || r === 'ADMINISTRADOR');
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  useEffect(() => { if (ready && !session) router.replace('/login'); }, [ready, session, router]);

  async function submit(e) {
    e.preventDefault();
    setFormError('');
    const { errors: local, data } = parseProject(f);
    setErrors(local);
    if (Object.keys(local).length) return;
    setBusy(true);
    const r = await apiFetch('/projects', { method: 'POST', body: data });
    setBusy(false);
    if (r.ok) { router.push(`/proyectos/${r.body.data.id}`); return; }
    setErrors(fieldErrors(r.body)); setFormError(errorText(r.body));
  }

  if (!ready || !session) return <p>Cargando…</p>;
  if (!puede) return <section><h1>Publicar proyecto</h1><p className="alert">Solo los productores publican proyectos.</p></section>;

  return (
    <section>
      <h1>Publicar nuevo proyecto</h1>
      <p>Todos los campos son obligatorios. Después de publicar podrás adjuntar un PDF de soporte.</p>
      {formError && <p className="alert" role="alert">{formError}</p>}
      <form onSubmit={submit} noValidate className="card">
        <Field id="nombre" label="Nombre del proyecto" error={errors.nombre}>
          {(a) => <input id="nombre" value={f.nombre} onChange={set('nombre')} {...a} />}
        </Field>
        <Field id="descripcion" label="Descripción" error={errors.descripcion}>
          {(a) => <textarea id="descripcion" rows={4} value={f.descripcion} onChange={set('descripcion')} {...a} />}
        </Field>
        <Field id="tipoCultivo" label="Tipo de cultivo o actividad" error={errors.tipoCultivo}>
          {(a) => <input id="tipoCultivo" value={f.tipoCultivo} onChange={set('tipoCultivo')} {...a} />}
        </Field>
        <Field id="areaRequeridaHa" label="Área requerida (hectáreas)" hint="Hasta 2 decimales, por ejemplo 12,5." error={errors.areaRequeridaHa}>
          {(a) => <input id="areaRequeridaHa" inputMode="decimal" value={f.areaRequeridaHa} onChange={set('areaRequeridaHa')} {...a} />}
        </Field>
        <Field id="ubicacionDeseada" label="Ubicación deseada" error={errors.ubicacionDeseada}>
          {(a) => <input id="ubicacionDeseada" value={f.ubicacionDeseada} onChange={set('ubicacionDeseada')} {...a} />}
        </Field>
        <Field id="montoInversion" label="Monto de inversión requerido (COP)" hint="Solo números, sin puntos ni símbolos." error={errors.montoInversion}>
          {(a) => <input id="montoInversion" inputMode="decimal" value={f.montoInversion} onChange={set('montoInversion')} {...a} />}
        </Field>
        <Field id="tiempoRetornoMeses" label="Tiempo estimado de retorno (meses)" error={errors.tiempoRetornoMeses}>
          {(a) => <input id="tiempoRetornoMeses" inputMode="numeric" value={f.tiempoRetornoMeses} onChange={set('tiempoRetornoMeses')} {...a} />}
        </Field>
        <p className="actions">
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Publicando…' : 'Publicar proyecto'}</button>
          <Link className="btn btn-sec" href="/proyectos">Cancelar</Link>
        </p>
      </form>
    </section>
  );
}
