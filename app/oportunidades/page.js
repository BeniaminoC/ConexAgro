'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, useSession } from '../../src/ui/session.js';
import { copCorto, errorText } from '../../src/ui/format.js';
import ProjectCard from '../components/ProjectCard.js';

const MONTO = [
  { v: '', t: 'Cualquiera' },
  { v: 'a', t: 'Hasta $50 M', ok: (n) => n <= 50e6 },
  { v: 'b', t: '$50 M – $100 M', ok: (n) => n > 50e6 && n <= 100e6 },
  { v: 'c', t: 'Más de $100 M', ok: (n) => n > 100e6 },
];
const AREA = [
  { v: '', t: 'Cualquiera' },
  { v: 'a', t: 'Hasta 10 ha', ok: (n) => n <= 10 },
  { v: 'b', t: '10 – 25 ha', ok: (n) => n > 10 && n <= 25 },
  { v: 'c', t: 'Más de 25 ha', ok: (n) => n > 25 },
];
const ORDEN = {
  recientes: { t: 'Más recientes', cmp: (a, b) => b.id - a.id },
  inversion: { t: 'Menor inversión', cmp: (a, b) => a.montoInversion - b.montoInversion },
  retorno: { t: 'Retorno más corto', cmp: (a, b) => a.tiempoRetornoMeses - b.tiempoRetornoMeses },
};

function Select({ id, label, value, onChange, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>{children}</select>
    </div>
  );
}

export default function Oportunidades() {
  const router = useRouter();
  const { session, ready } = useSession();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [monto, setMonto] = useState('');
  const [area, setArea] = useState('');
  const [cultivo, setCultivo] = useState('');
  const [orden, setOrden] = useState('recientes');

  useEffect(() => { if (ready && !session) router.replace('/login'); }, [ready, session, router]);
  useEffect(() => {
    if (!ready || !session) return;
    apiFetch('/projects').then((r) => {
      if (r.ok) setItems(r.body.data); else { setItems([]); setError(errorText(r.body)); }
    });
  }, [ready, session]);

  const cultivos = useMemo(() => [...new Set((items || []).map((p) => p.tipoCultivo))].sort((a, b) => a.localeCompare(b, 'es')), [items]);
  const visibles = useMemo(() => {
    const m = MONTO.find((x) => x.v === monto)?.ok;
    const a = AREA.find((x) => x.v === area)?.ok;
    return (items || [])
      .filter((p) => (!m || m(p.montoInversion)) && (!a || a(p.areaRequeridaHa)) && (!cultivo || p.tipoCultivo === cultivo))
      .sort(ORDEN[orden].cmp);
  }, [items, monto, area, cultivo, orden]);

  if (!ready || !session) return <p>Cargando…</p>;

  const montos = (items || []).map((p) => p.montoInversion);
  const resumen = items?.length ? [
    `${copCorto(Math.min(...montos))} – ${copCorto(Math.max(...montos))}`,
    ...cultivos.slice(0, 4),
  ] : [];
  const perfil = session.user?.roles?.includes('INVERSIONISTA') ? 'inversionista' : 'perfil';

  return (
    <section>
      <div className="page-head">
        <div>
          <p className="eyebrow">Descubrir</p>
          <h1>Oportunidades para ti</h1>
          <p className="lead">Proyectos agrícolas activos en la región, publicados por productores. Filtra según tu {perfil}.</p>
        </div>
        {resumen.length > 0 && (
          <div className="summary-card">
            <p className="eyebrow">Resumen de oportunidades</p>
            <ul className="chips">{resumen.map((t) => <li key={t} className="chip">{t}</li>)}</ul>
          </div>
        )}
      </div>

      <form className="filters" aria-label="Filtros" onSubmit={(e) => e.preventDefault()}>
        <Select id="f-monto" label="Inversión requerida" value={monto} onChange={setMonto}>
          {MONTO.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
        </Select>
        <Select id="f-area" label="Tamaño del lote" value={area} onChange={setArea}>
          {AREA.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
        </Select>
        <Select id="f-cultivo" label="Tipo de cultivo" value={cultivo} onChange={setCultivo}>
          <option value="">Cualquiera</option>
          {cultivos.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select id="f-orden" label="Ordenar por" value={orden} onChange={setOrden}>
          {Object.entries(ORDEN).map(([k, o]) => <option key={k} value={k}>{o.t}</option>)}
        </Select>
      </form>

      <div aria-live="polite">
        {error && <p className="alert" role="alert">{error}</p>}
        {items === null && <p>Cargando oportunidades…</p>}
        {items && !error && (
          <>
            <div className="toolbar"><p className="count">{visibles.length} de {items.length} proyectos</p></div>
            {!visibles.length
              ? <p className="card">{items.length ? 'Ningún proyecto coincide con los filtros.' : 'Aún no hay proyectos publicados.'}</p>
              : <ul className="opps">{visibles.map((p) => <ProjectCard key={p.id} p={p} propio={String(p.autorId) === String(session.user.id)} />)}</ul>}
          </>
        )}
      </div>
    </section>
  );
}
