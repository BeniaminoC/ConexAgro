import './globals.css';
import Shell from './components/Shell.js';

export const metadata = {
  title: 'ConexAgro',
  description: 'Plataforma que conecta propietarios, productores e inversionistas rurales en Montería, Córdoba.',
};
export const viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body><Shell>{children}</Shell></body>
    </html>
  );
}
