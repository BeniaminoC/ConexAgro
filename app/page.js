'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '../src/ui/session.js';
import { InversionistaArt, ProductorArt, TerrenoArt } from './components/Art.js';

const PERFILES = [
  { value: 'PROPIETARIO', etiqueta: 'Propietario', clase: 'role-prop', titulo: 'Tengo Tierra', Art: TerrenoArt,
    texto: 'Registra tu terreno y encuentra quién lo ponga a producir.' },
  { value: 'PRODUCTOR', etiqueta: 'Productor', clase: 'role-prod', titulo: 'Sé Cultivar', Art: ProductorArt,
    texto: 'Muestra tu experiencia y accede a tierra para trabajar.' },
  { value: 'INVERSIONISTA', etiqueta: 'Inversionista', clase: 'role-inv', titulo: 'Quiero Invertir', Art: InversionistaArt,
    texto: 'Define tu capital y apuesta por cultivos de la región.' },
];

export default function Home() {
  const router = useRouter();
  const { session, ready } = useSession();
  useEffect(() => { if (ready && session) router.replace('/oportunidades'); }, [ready, session, router]);

  return (
    <>
      <p className="eyebrow">Crea tu perfil</p>
      <h1>¿Cómo quieres sumarte?</h1>
      <p className="lead">Elige el perfil que mejor te describe. Cada uno tiene un registro distinto y toma pocos minutos.</p>
      <ul className="profiles">
        {PERFILES.map(({ value, etiqueta, clase, titulo, texto, Art }) => (
          <li key={value}>
            <Link href={`/registro?perfil=${value}`} className="profile" aria-label={`${titulo}: registrarme como ${etiqueta.toLowerCase()}`}>
              <div className="profile-art"><Art /></div>
              <p className={`profile-role ${clase}`}>{etiqueta}</p>
              <h2>{titulo}</h2>
              <p>{texto}</p>
              <span className="profile-go" aria-hidden="true">Empezar →</span>
            </Link>
          </li>
        ))}
      </ul>
      <p>¿Ya tienes cuenta? <Link href="/login">Ingresa</Link></p>
    </>
  );
}
