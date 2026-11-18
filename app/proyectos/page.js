'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch, useSession } from '../../src/ui/session.js';
import { cop, errorText, fechaHora } from '../../src/ui/format.js';

export default function MisProyectos() {
  const router = useRouter();
  const { session, ready } = useSession();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const puede = session?.user?.roles?.some((r) => r === 'PRODUCTOR' || r === 'ADMINISTRADOR');

  useEffect(() => { if (ready && !session) router.replace('/login'); }, [ready, session, router]);
  useEffect(() => {
    if (!ready || !session || !puede) return;
    apiFetch('/projects/mine').then((r) => {
      if (r.ok) setItems(r.body.data); else { setItems([]); setError(errorText(r.body)); }
    });
  }, [ready, session, puede]);

  if (!ready || !session) return <p>Cargando…</p>;
  if (!puede) return <section><h1>Mis proyectos</h1><p className="alert">Solo los productores publican proyectos.</p></section>;

  return (
    <section>
      <h1>Mis proyectos</h1>
      <p><Link className="btn" href="/proyectos/nuevo">Publicar nuevo proyecto</Link></p>
      <div aria-live="polite">
        {error && <p className="alert" role="alert">{error}</p>}
        {items === null && <p>Cargando proyectos…</p>}
        {items && !items.length && !error && <p>Aún no has publicado proyectos.</p>}
        {items && items.length > 0 && (
          <ul className="list">
            {items.map((p) => (
              <li key={p.id} className="card">
                <h2><Link href={`/proyectos/${p.id}`}>{p.nombre}</Link> <span className={`badge ${p.estado === 'cerrado' ? 'badge-rechazada' : 'badge-aceptada'}`}>{p.estado === 'activo' ? 'Activo' : 'Cerrado'}</span></h2>
                <p>{p.tipoCultivo} · {p.areaRequeridaHa} ha · {cop(p.montoInversion)}</p>
                <p className="hint">Publicado el {fechaHora(p.creadoEn)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
