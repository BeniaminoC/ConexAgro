'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch, useSession } from '../../src/ui/session.js';
import { errorText } from '../../src/ui/format.js';
import ProjectCard from '../components/ProjectCard.js';

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
  if (!puede) return <section><p className="eyebrow">Productor</p><h1>Mis proyectos</h1><p className="alert">Solo los productores publican proyectos.</p></section>;

  return (
    <section>
      <div className="page-head">
        <div>
          <p className="eyebrow">Productor</p>
          <h1>Mis proyectos</h1>
          <p className="lead">Los proyectos que has publicado y su estado.</p>
        </div>
        <Link className="btn" href="/proyectos/nuevo">Publicar nuevo proyecto</Link>
      </div>
      <div aria-live="polite">
        {error && <p className="alert" role="alert">{error}</p>}
        {items === null && <p>Cargando proyectos…</p>}
        {items && !items.length && !error && <p className="card">Aún no has publicado proyectos.</p>}
        {items && items.length > 0 && (
          <ul className="opps">{items.map((p) => <ProjectCard key={p.id} p={p} />)}</ul>
        )}
      </div>
    </section>
  );
}
