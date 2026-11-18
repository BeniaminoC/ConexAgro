'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch, useSession } from '../../../src/ui/session.js';
import { MAX_PDF_BYTES, cop, errorText, fechaHora } from '../../../src/ui/format.js';
import { PinIcon, SproutArt } from '../../components/Art.js';

export default function DetalleProyecto() {
  const { id } = useParams();
  const router = useRouter();
  const { session, ready } = useSession();
  const [p, setP] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [confirmClose, setConfirmClose] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (ready && !session) router.replace('/login'); }, [ready, session, router]);

  const load = useCallback(async () => {
    const r = await apiFetch(`/projects/${id}`);
    if (r.ok) { setP(r.body.data); setError(''); } else setError(errorText(r.body));
  }, [id]);
  useEffect(() => { if (ready && session) load(); }, [ready, session, load]);

  if (!ready || !session) return <p>Cargando…</p>;
  if (error) return <section><h1>Proyecto</h1><p className="alert" role="alert">{error}</p><p><Link className="back" href="/oportunidades">← Volver a oportunidades</Link></p></section>;
  if (!p) return <p>Cargando proyecto…</p>;

  const esAutor = String(p.autorId) === String(session.user.id) || session.user.roles?.includes('ADMINISTRADOR');
  const editable = esAutor && p.estado === 'activo';
  const ok = (text) => setMsg({ type: 'ok', text });
  const fail = (text) => setMsg({ type: 'alert', text });

  async function subir(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMsg({ type: '', text: '' });
    if (file.size > MAX_PDF_BYTES) return fail('El archivo supera el máximo de 4 MB.');
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return fail('Solo se admiten archivos PDF.');
    setBusy(true);
    const r = await apiFetch(`/projects/${p.id}/document`, {
      method: 'PUT', raw: file, headers: { 'content-type': 'application/pdf', 'x-filename': encodeURIComponent(file.name) } });
    setBusy(false);
    if (r.ok) { ok('Documento guardado.'); load(); } else fail(r.body?.error?.fields?.documento || errorText(r.body));
  }
  async function descargar() {
    const r = await apiFetch(`/projects/${p.id}/document`, { blob: true });
    if (!r.ok) return fail(errorText(r.body));
    const url = URL.createObjectURL(r.blob);
    const a = document.createElement('a');
    a.href = url; a.download = p.documento.nombreArchivo; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
  async function quitar() {
    setBusy(true);
    const r = await apiFetch(`/projects/${p.id}/document`, { method: 'DELETE' });
    setBusy(false);
    if (r.ok) { ok('Documento eliminado.'); load(); } else fail(errorText(r.body));
  }
  async function cerrar() {
    setBusy(true);
    const r = await apiFetch(`/projects/${p.id}/close`, { method: 'POST' });
    setBusy(false); setConfirmClose(false);
    if (r.ok) { ok('Proyecto cerrado.'); load(); } else fail(errorText(r.body));
  }

  return (
    <section>
      <Link className="back" href={esAutor ? '/proyectos' : '/oportunidades'}>← {esAutor ? 'Volver a mis proyectos' : 'Volver a oportunidades'}</Link>
      <div className="hero">
        <div className="hero-art"><SproutArt tone={[...p.tipoCultivo].reduce((x, c) => x + c.charCodeAt(0), 0) % 4} /></div>
        <div>
          <p className="eyebrow">Proyecto</p>
          <h1>{p.nombre} <span className={`badge ${p.estado === 'cerrado' ? 'badge-rechazada' : 'badge-aceptada'}`}>{p.estado === 'activo' ? 'Activo' : 'Cerrado'}</span></h1>
          <p className="opp-loc"><PinIcon /> {p.ubicacionDeseada}</p>
          <p>{p.descripcion}</p>
          <dl className="stats">
            <div><dt>Capital requerido</dt><dd>{cop(p.montoInversion)}</dd></div>
            <div><dt>Retorno estimado</dt><dd>{p.tiempoRetornoMeses} meses</dd></div>
            <div><dt>Área requerida</dt><dd>{Number(p.areaRequeridaHa).toLocaleString('es-CO')} ha</dd></div>
            <div><dt>Cultivo o actividad</dt><dd>{p.tipoCultivo}</dd></div>
            <div><dt>Publicado</dt><dd>{fechaHora(p.creadoEn)}</dd></div>
          </dl>
        </div>
      </div>

      <h2>Documento de soporte</h2>
      <div className="card" aria-live="polite">
        {msg.text && <p className={msg.type} role={msg.type === 'alert' ? 'alert' : 'status'}>{msg.text}</p>}
        {p.documento ? (
          <>
            <p>{p.documento.nombreArchivo} ({Math.ceil(p.documento.tamano / 1024)} KB)</p>
            <p className="actions">
              <button type="button" className="btn" onClick={descargar}>Descargar PDF</button>
              {editable && <button type="button" className="btn btn-sec" disabled={busy} onClick={quitar}>Eliminar documento</button>}
            </p>
          </>
        ) : <p>Este proyecto no tiene documento de soporte.</p>}
        {editable && (
          <div className="field">
            <label htmlFor="pdf">{p.documento ? 'Reemplazar documento (PDF, máx. 4 MB)' : 'Adjuntar documento (PDF, máx. 4 MB)'}</label>
            <input id="pdf" type="file" accept="application/pdf,.pdf" onChange={subir} disabled={busy} />
          </div>
        )}
      </div>

      {editable && (
        <div className="card">
          <h2>Cerrar proyecto</h2>
          <p>Un proyecto cerrado deja de mostrarse y no puede reabrirse ni editarse.</p>
          {!confirmClose
            ? <button type="button" className="btn btn-sec" onClick={() => setConfirmClose(true)}>Cerrar proyecto…</button>
            : (
              <div role="alertdialog" aria-labelledby="cc-t" className="alert">
                <p id="cc-t"><strong>¿Cerrar «{p.nombre}» de forma definitiva?</strong></p>
                <p className="actions">
                  <button type="button" className="btn" disabled={busy} onClick={cerrar}>Sí, cerrar</button>
                  <button type="button" className="btn btn-sec" onClick={() => setConfirmClose(false)}>Cancelar</button>
                </p>
              </div>
            )}
        </div>
      )}
    </section>
  );
}
