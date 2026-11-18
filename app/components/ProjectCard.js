import Link from 'next/link';
import { PinIcon, SproutArt } from './Art.js';
import { copCorto, fechaCorta } from '../../src/ui/format.js';

// Paleta de la ilustración según el cultivo (estable entre renders).
const tono = (txt = '') => [...txt].reduce((a, c) => a + c.charCodeAt(0), 0) % 4;
const ha = (n) => `${Number(n).toLocaleString('es-CO')} ha`;

export default function ProjectCard({ p, propio = false }) {
  const cerrado = p.estado === 'cerrado';
  return (
    <li className="opp">
      <div className="opp-art">
        <SproutArt tone={tono(p.tipoCultivo)} />
        <span className="tag">{cerrado ? 'Cerrado' : 'Proyecto'}</span>
      </div>
      <div className="opp-body">
        <h2 className="opp-title">{p.nombre}</h2>
        <p className="opp-loc"><PinIcon /> {p.ubicacionDeseada}</p>
        <div className="opp-stats">
          <div><span>Capital requerido</span><strong>{copCorto(p.montoInversion)}</strong></div>
          <div><span>Retorno estimado</span><strong>{p.tiempoRetornoMeses} meses</strong></div>
        </div>
        <ul className="chips">
          <li className="chip">{ha(p.areaRequeridaHa)}</li>
          <li className="chip chip-warn">{p.tipoCultivo}</li>
          {propio && <li className="chip">Tu proyecto</li>}
        </ul>
        <div className="opp-foot">
          <span><small>Publicado</small><strong>{fechaCorta(p.creadoEn)}</strong></span>
          <Link className="opp-link" href={`/proyectos/${p.id}`} aria-label={`Ver detalle de ${p.nombre}`}>Ver detalle →</Link>
        </div>
      </div>
    </li>
  );
}
