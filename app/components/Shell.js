'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Nav from './Nav.js';
import { LogoMark, SideArt } from './Art.js';

// Rutas de acceso y registro: usan el panel lateral verde. El resto, la barra superior.
const AUTH_PATHS = new Set(['/', '/login', '/registro', '/verificar-correo']);

const PASOS = ['Creas tu perfil en pocos minutos', 'Te mostramos perfiles compatibles', 'Acuerdan y la tierra vuelve a producir'];

export default function Shell({ children }) {
  const raw = usePathname() || '/';
  const path = raw.length > 1 ? raw.replace(/\/$/, '') : raw;
  const skip = <a href="#contenido" className="skip">Saltar al contenido</a>;

  if (AUTH_PATHS.has(path)) {
    return (
      <>
        {skip}
        <div className="auth-shell">
          <aside className="auth-side">
            <Link href="/" className="side-brand" aria-label="ConexAgro, ir al inicio">
              <LogoMark size={40} />
              <span><strong>ConexAgro</strong><small>Tierra · Trabajo · Capital</small></span>
            </Link>
            <p className="side-title">Que la tierra ociosa vuelva a producir.</p>
            <p className="side-text">
              Conectamos a quienes tienen tierra, a quienes saben cultivarla y a quienes quieren financiar el campo en Montería.
            </p>
            <div className="side-steps">
              <p className="eyebrow eyebrow-light">Cómo funciona</p>
              <ol>{PASOS.map((t) => <li key={t}>{t}</li>)}</ol>
            </div>
            <SideArt />
          </aside>
          <main id="contenido" tabIndex={-1} className="auth-main">
            <div className="auth-content">{children}</div>
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      {skip}
      <Nav />
      <main id="contenido" tabIndex={-1} className="app-main">{children}</main>
    </>
  );
}
