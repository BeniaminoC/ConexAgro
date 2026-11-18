'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field } from '../components/Field.js';
import { apiFetch, useSession } from '../../src/ui/session.js';
import { errorText, fieldErrors, estadoLabel, fechaHora } from '../../src/ui/format.js';

function Tarjeta({ s, box, onRespond }) {
  const [counter, setCounter] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [condiciones, setCondiciones] = useState('');
  const [err, setErr] = useState({});
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const titulo = `${s.referenciaTipo === 'proyecto' ? 'Proyecto' : 'Terreno'} n.º ${s.referenciaId}`;

  async function act(accion, extra = {}) {
    setBusy(true); setMsg(''); setErr({});
    const r = await apiFetch(`/requests/${s.id}/respond`, { method: 'POST', body: { accion, ...extra } });
    setBusy(false);
    if (r.ok) { onRespond(); return; }
    setErr(fieldErrors(r.body)); setMsg(errorText(r.body));
  }

  return (
    <li className="card" aria-labelledby={`sol-${s.id}`}>
      <h2 id={`sol-${s.id}`}>{titulo} <span className={`badge badge-${s.estado}`}>{estadoLabel(s.estado)}</span></h2>
      <p>{s.mensaje}</p>
      {s.condiciones && <p><strong>Condiciones o monto:</strong> {s.condiciones}</p>}
      <p className="hint">{box === 'recibidas' ? 'Recibida' : 'Enviada'} el {fechaHora(s.creadoEn)}{s.origenId ? ` · contrapropuesta de la solicitud n.º ${s.origenId}` : ''}</p>
      <details>
        <summary>Historial ({s.historial.length})</summary>
        <ul>{s.historial.map((h, i) => <li key={i}>{estadoLabel(h.estado)} — {fechaHora(h.en)}</li>)}</ul>
      </details>
      {msg && <p className="alert" role="alert">{msg}</p>}
      {box === 'recibidas' && s.estado === 'pendiente' && !counter && (
        <p className="actions">
          <button type="button" className="btn" disabled={busy} onClick={() => act('aceptar')}>Aceptar</button>
          <button type="button" className="btn btn-sec" disabled={busy} onClick={() => act('rechazar')}>Rechazar</button>
          <button type="button" className="btn btn-sec" disabled={busy} onClick={() => setCounter(true)}>Contraproponer</button>
        </p>
      )}
      {counter && (
        <form noValidate onSubmit={(e) => { e.preventDefault(); act('contraproponer', { mensaje, condiciones }); }}>
          <Field id={`cm-${s.id}`} label="Mensaje de la contrapropuesta" error={err.mensaje}>
            {(a) => <textarea id={`cm-${s.id}`} rows={3} value={mensaje} onChange={(e) => setMensaje(e.target.value)} {...a} />}
          </Field>
          <Field id={`cc-${s.id}`} label="Condiciones o monto (opcional)" error={err.condiciones}>
            {(a) => <input id={`cc-${s.id}`} value={condiciones} onChange={(e) => setCondiciones(e.target.value)} {...a} />}
          </Field>
          <p className="actions">
            <button className="btn" type="submit" disabled={busy}>Enviar contrapropuesta</button>
            <button className="btn btn-sec" type="button" onClick={() => setCounter(false)}>Cancelar</button>
          </p>
        </form>
      )}
    </li>
  );
}

function NuevaSolicitud({ userId, onSent }) {
  const [proyectos, setProyectos] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [pid, setPid] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [condiciones, setCondiciones] = useState('');
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch('/projects').then((r) => {
      // Solo proyectos ajenos: en uno propio habría que elegir destinatario (aún sin buscador de usuarios).
      if (r.ok) setProyectos(r.body.data.filter((p) => String(p.autorId) !== String(userId)));
      setLoaded(true);
    });
  }, [userId]);

  async function submit(e) {
    e.preventDefault();
    setMsg(''); setOk('');
    const local = {};
    if (!pid) local.referenciaId = 'Elige un proyecto';
    if (!mensaje.trim()) local.mensaje = 'Escribe un mensaje';
    setErrors(local);
    if (Object.keys(local).length) return;
    setBusy(true);
    const r = await apiFetch('/requests', { method: 'POST', body: {
      referenciaTipo: 'proyecto', referenciaId: Number(pid), mensaje, condiciones: condiciones || undefined } });
    setBusy(false);
    if (r.ok) { setOk('Solicitud enviada.'); setPid(''); setMensaje(''); setCondiciones(''); onSent(); return; }
    setErrors(fieldErrors(r.body)); setMsg(errorText(r.body));
  }

  return (
    <details className="card">
      <summary>Enviar una solicitud</summary>
      {loaded && !proyectos.length && <p>No hay proyectos activos de otros usuarios para solicitar por ahora.</p>}
      {proyectos.length > 0 && (
        <form onSubmit={submit} noValidate>
          {msg && <p className="alert" role="alert">{msg}</p>}
          <Field id="proyecto" label="Proyecto" error={errors.referenciaId}>
            {(a) => (
              <select id="proyecto" value={pid} onChange={(e) => setPid(e.target.value)} {...a}>
                <option value="">Elige un proyecto…</option>
                {proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre} — {p.tipoCultivo}, {p.areaRequeridaHa} ha</option>)}
              </select>
            )}
          </Field>
          <Field id="mensaje" label="Mensaje" error={errors.mensaje}>
            {(a) => <textarea id="mensaje" rows={3} value={mensaje} onChange={(e) => setMensaje(e.target.value)} {...a} />}
          </Field>
          <Field id="condiciones" label="Condiciones o monto (opcional)" error={errors.condiciones}>
            {(a) => <input id="condiciones" value={condiciones} onChange={(e) => setCondiciones(e.target.value)} {...a} />}
          </Field>
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Enviando…' : 'Enviar solicitud'}</button>
        </form>
      )}
      {ok && <p className="ok" role="status">{ok}</p>}
    </details>
  );
}

export default function Solicitudes() {
  const router = useRouter();
  const { session, ready } = useSession();
  const [box, setBox] = useState('recibidas');
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const isAdmin = session?.user?.roles?.includes('ADMINISTRADOR');

  useEffect(() => { if (ready && !session) router.replace('/login'); }, [ready, session, router]);

  const load = useCallback(async () => {
    setError('');
    const r = await apiFetch(`/requests?box=${box}`);
    if (r.ok) setItems(r.body.data); else { setItems([]); setError(errorText(r.body)); }
  }, [box]);

  useEffect(() => { if (ready && session && !isAdmin) { setItems(null); load(); } }, [ready, session, isAdmin, load]);

  if (!ready || !session) return <p>Cargando…</p>;
  if (isAdmin) {
    return <section><h1>Solicitudes</h1><p className="alert">El administrador no envía ni gestiona solicitudes propias.</p></section>;
  }

  return (
    <section>
      <h1>Solicitudes</h1>
      <NuevaSolicitud userId={session.user.id} onSent={() => { if (box === 'enviadas') load(); else setBox('enviadas'); }} />
      <div role="group" aria-label="Bandeja" className="tabs">
        {['recibidas', 'enviadas'].map((b) => (
          <button key={b} type="button" className={`btn ${box === b ? '' : 'btn-sec'}`} aria-pressed={box === b} onClick={() => setBox(b)}>
            {b === 'recibidas' ? 'Recibidas' : 'Enviadas'}
          </button>
        ))}
      </div>
      <div aria-live="polite">
        {error && <p className="alert" role="alert">{error}</p>}
        {items === null && <p>Cargando solicitudes…</p>}
        {items && !items.length && !error && <p>No tienes solicitudes {box}.</p>}
        {items && items.length > 0 && (
          <ul className="list">{items.map((s) => <Tarjeta key={`${box}-${s.id}-${s.estado}`} s={s} box={box} onRespond={load} />)}</ul>
        )}
      </div>
    </section>
  );
}
