'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearSession, useSession } from '../../src/ui/session.js';
import { LogoMark } from './Art.js';

export default function Nav() {
  const { session, ready } = useSession();
  const path = usePathname() || '';
  const router = useRouter();
  const activo = (href) => path === href || path.startsWith(`${href}/`);
  const item = (href, text) => (
    <li><Link href={href} aria-current={activo(href) ? 'page' : undefined}>{text}</Link></li>
  );
  const nombre = session?.user?.nombreCompleto || '';
  return (
    <header className="site-header">
      <nav aria-label="Principal">
        <Link href="/" className="brand"><LogoMark size={34} /> <span>ConexAgro</span></Link>
        <ul className="nav-links">
          {ready && session && item('/oportunidades', 'Oportunidades')}
          {ready && session?.user?.roles?.includes('PRODUCTOR') && item('/proyectos', 'Mis proyectos')}
          {ready && session && item('/solicitudes', 'Solicitudes')}
          {ready && !session && item('/login', 'Ingresar')}
          {ready && !session && item('/registro', 'Registrarse')}
        </ul>
        {ready && session && (
          <div className="nav-user">
            <span className="avatar" aria-hidden="true">{nombre.trim().charAt(0).toUpperCase() || '?'}</span>
            <button type="button" className="btn btn-sec btn-small" onClick={() => { clearSession(); router.push('/login'); }}>
              Salir ({nombre.split(' ')[0]})
            </button>
          </div>
        )}
      </nav>
    </header>
  );
}
