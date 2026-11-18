import './globals.css';
import Nav from './components/Nav.js';

export const metadata = {
  title: 'ConexAgro',
  description: 'Plataforma que conecta propietarios, productores e inversionistas rurales en Montería, Córdoba.',
};
export const viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <a href="#contenido" className="skip">Saltar al contenido</a>
        <Nav />
        <main id="contenido" tabIndex={-1}>{children}</main>
      </body>
    </html>
  );
}
