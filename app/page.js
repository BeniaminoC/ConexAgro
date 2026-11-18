import Link from 'next/link';

export default function Home() {
  return (
    <>
      <h1>ConexAgro</h1>
      <p>
        Plataforma para conectar propietarios de terrenos rurales, productores con proyectos agrícolas
        e inversionistas en Montería, Córdoba.
      </p>
      <p className="actions">
        <Link className="btn" href="/registro">Crear cuenta</Link>
        <Link className="btn btn-sec" href="/login">Ingresar</Link>
      </p>
    </>
  );
}
