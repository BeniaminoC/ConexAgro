'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearSession, useSession } from '../../src/ui/session.js';

export default function Nav() {
  const { session, ready } = useSession();
  const path = usePathname();
  const router = useRouter();
  const item = (href, text) => (
    <li><Link href={href} aria-current={path === href ? 'page' : undefined}>{text}</Link></li>
  );
  return (
    <header className="site-header">
      <nav aria-label="Principal">
        <Link href="/" className="brand">ConexAgro</Link>
        <ul>
          {item('/', 'Inicio')}
          {ready && session?.user?.roles?.includes('PRODUCTOR') && item('/proyectos', 'Mis proyectos')}
          {ready && session && item('/solicitudes', 'Solicitudes')}
          {ready && !session && item('/login', 'Ingresar')}
          {ready && !session && item('/registro', 'Registrarse')}
          {ready && session && (
            <li>
              <button type="button" className="link-btn" onClick={() => { clearSession(); router.push('/login'); }}>
                Salir ({session.user?.nombreCompleto?.split(' ')[0]})
              </button>
            </li>
          )}
        </ul>
      </nav>
    </header>
  );
}
