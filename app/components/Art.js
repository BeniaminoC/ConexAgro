// Ilustraciones y logotipo en SVG en línea (decorativos: ocultos para lectores de pantalla).
const deco = { 'aria-hidden': 'true', focusable: 'false' };

export function LogoMark({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" {...deco}>
      <rect width="40" height="40" rx="10" fill="#F2B01E" />
      <path d="M20 30V19" stroke="#123C2E" strokeWidth="3" strokeLinecap="round" />
      <path d="M20 21c0-5-3-8-8-8 0 5 3 8 8 8z" fill="#123C2E" />
      <path d="M20 19c0-4 2.5-7 7-7 0 4-2.5 7-7 7z" fill="#123C2E" />
    </svg>
  );
}

export function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...deco}>
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

// Panel lateral oscuro: sol, palma y olas verdes.
export function SideArt() {
  return (
    <svg viewBox="0 0 330 180" preserveAspectRatio="xMidYMax slice" className="side-art" {...deco}>
      <circle cx="242" cy="104" r="30" fill="#F2B01E" />
      <path d="M0 140 C60 122 120 150 190 134 S300 120 330 132 V180 H0Z" fill="#1F6B42" />
      <g stroke="#2F7D4F" strokeWidth="3" fill="none" strokeLinecap="round">
        <path d="M38 150 C38 132 40 118 44 104" strokeWidth="4" />
        <path d="M44 104 C30 92 14 94 4 104" />
        <path d="M44 104 C58 90 76 92 86 102" />
        <path d="M44 104 C40 88 28 80 16 80" />
        <path d="M44 104 C50 88 62 80 74 82" />
      </g>
      <path d="M0 156 C70 142 130 166 200 152 S300 144 330 152 V180 H0Z" fill="#2E7D4F" />
      <path d="M0 170 C80 160 140 178 220 168 S300 164 330 168 V180 H0Z" fill="#3B8F5C" />
    </svg>
  );
}

const card = { viewBox: '0 0 240 150', preserveAspectRatio: 'xMidYMid slice', width: '100%', ...deco };

// Perfil «Tengo Tierra»: terreno con marcador de ubicación.
export function TerrenoArt() {
  return (
    <svg {...card}>
      <rect width="240" height="150" fill="#FBEAC2" />
      <circle cx="196" cy="42" r="16" fill="#F2B01E" />
      <path d="M0 104 Q60 84 120 96 T240 90 V150 H0Z" fill="#A9D19B" />
      <path d="M0 118 Q70 100 130 108 T240 104 V150 H0Z" fill="#7DB77F" />
      <g stroke="#2F7D4F" strokeWidth="3" strokeLinecap="round">
        <path d="M24 150 L110 112" /><path d="M68 150 L116 112" /><path d="M120 150 L120 112" />
        <path d="M172 150 L124 112" /><path d="M216 150 L130 112" />
      </g>
      <path d="M120 96 C112 84 104 78 104 68 a16 16 0 0 1 32 0 c0 10 -8 16 -16 28z" fill="#123C2E" />
      <circle cx="120" cy="68" r="5" fill="#fff" />
    </svg>
  );
}

// Perfil «Sé Cultivar»: brote sobre la tierra.
export function ProductorArt() {
  return (
    <svg {...card}>
      <rect width="240" height="150" fill="#D9EBCB" />
      <circle cx="46" cy="46" r="17" fill="#F2B01E" />
      <rect y="108" width="240" height="42" fill="#8B4A2B" />
      <g fill="#C48A5E"><circle cx="40" cy="124" r="1.6" /><circle cx="86" cy="132" r="1.6" /><circle cx="170" cy="126" r="1.6" /><circle cx="204" cy="138" r="1.6" /></g>
      <path d="M124 112 V74" stroke="#1E6B45" strokeWidth="6" strokeLinecap="round" />
      <path d="M124 90 C114 72 98 66 82 72 C88 90 106 98 124 90z" fill="#1E6B45" />
      <path d="M124 80 C134 56 158 50 178 58 C170 78 148 88 124 80z" fill="#2A7F52" />
    </svg>
  );
}

// Perfil «Quiero Invertir»: monedas y gráfica ascendente.
export function InversionistaArt() {
  return (
    <svg {...card}>
      <rect width="240" height="150" fill="#F8E3BF" />
      <rect y="112" width="240" height="38" fill="#C9A56A" />
      <g>
        <rect x="44" y="76" width="64" height="40" fill="#E8A91A" />
        <ellipse cx="76" cy="116" rx="32" ry="9" fill="#E8A91A" />
        <ellipse cx="76" cy="96" rx="32" ry="9" fill="#D99A12" opacity=".55" />
        <ellipse cx="76" cy="76" rx="32" ry="9" fill="#F5BE35" />
      </g>
      <path d="M136 108 L158 86 L174 98 L206 58" stroke="#123C2E" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M192 56 L208 54 L206 70" stroke="#123C2E" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M152 112 V102" stroke="#1E6B45" strokeWidth="3" strokeLinecap="round" />
      <path d="M152 104 c0-6-4-8-9-8 0 6 4 8 9 8z" fill="#1E6B45" />
      <path d="M152 102 c0-5 3-7 8-7 0 5-3 7-8 7z" fill="#2A7F52" />
    </svg>
  );
}

const TONES = [
  { bg: '#EBDDC3', sun: '#DCC9A0' },
  { bg: '#F5E7A6', sun: '#F2D26A' },
  { bg: '#E9E4C9', sun: '#DDD5AE' },
  { bg: '#D8EBCB', sun: '#B7DCA4' },
];

// Ilustración de las tarjetas de proyecto; `tone` (0–3) varía la paleta.
export function SproutArt({ tone = 0 }) {
  const t = TONES[Math.abs(tone) % TONES.length];
  return (
    <svg {...card}>
      <rect width="240" height="150" fill={t.bg} />
      <circle cx="186" cy="42" r="54" fill={t.sun} />
      <rect y="108" width="240" height="42" fill="#8B4F30" />
      <path d="M0 108 Q120 98 240 108" stroke="#8B4F30" strokeWidth="2" fill="none" />
      <path d="M120 112 V72" stroke="#1E6B45" strokeWidth="6" strokeLinecap="round" />
      <path d="M120 92 C110 74 94 68 78 74 C84 92 102 100 120 92z" fill="#1E6B45" />
      <path d="M120 82 C130 58 154 52 172 60 C164 80 142 90 120 82z" fill="#2A8A5A" />
    </svg>
  );
}
