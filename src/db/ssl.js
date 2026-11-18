// Configuración de conexión a PostgreSQL gestionado (Aiven, etc.). Módulo puro: sin dependencias.
//
// Variables:
//   PG_CA_CERT  Certificado CA del proveedor (texto PEM; acepta saltos de línea escritos como \n).
//   PG_SSL      'verify' (por defecto si hay CA) | 'no-verify' (cifra sin verificar al servidor) | 'off'.
//
// IMPORTANTE: si la URL trae ?sslmode=..., el driver `pg` la convierte en su propia opción `ssl` y esa
// SOBRESCRIBE la que pasemos aparte. Por eso se quita `sslmode` de la URL y se decide aquí.
export function buildPgConfig(connectionString, env = process.env) {
  let url;
  try { url = new URL(connectionString); } catch { return { connectionString }; } // formato raro: se deja tal cual
  const sslmode = url.searchParams.get('sslmode');
  url.searchParams.delete('sslmode');

  const ca = env.PG_CA_CERT ? env.PG_CA_CERT.replace(/\\n/g, '\n').trim() : '';
  const mode = (env.PG_SSL || '').toLowerCase()
    || (ca ? 'verify' : (sslmode && sslmode !== 'disable' ? 'no-verify' : 'off'));

  const config = { connectionString: url.toString() };
  if (mode === 'verify') {
    if (!ca) throw new Error('PG_SSL=verify requiere PG_CA_CERT (certificado CA del proveedor)');
    config.ssl = { ca, rejectUnauthorized: true };
  } else if (mode === 'no-verify') {
    config.ssl = { rejectUnauthorized: false };
  } else if (mode !== 'off') {
    throw new Error(`PG_SSL inválido: ${mode} (usa verify, no-verify u off)`);
  }
  return config;
}
