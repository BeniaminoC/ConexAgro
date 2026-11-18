import pg from 'pg';
import { buildPgConfig } from './ssl.js';

// Interfaz mínima de base de datos usada por el repositorio y las migraciones:
//   query(texto, parámetros) -> { rows }   (consultas parametrizadas)
//   exec(sql)                -> script de varias sentencias (se ejecuta como una sola transacción implícita)
export function createPgDb(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error('DATABASE_URL no está definida (ej.: postgres://usuario:clave@localhost:5432/conexagro)');
  }
  const pool = new pg.Pool({ ...buildPgConfig(connectionString), max: Number(process.env.PG_POOL_MAX || 10) });
  return {
    query: (text, params) => pool.query(text, params),
    exec: (sql) => pool.query(sql),
    // Transacción: fn recibe { query } ligado a una sola conexión; COMMIT si termina, ROLLBACK si lanza.
    tx: (fn) => runTx(pool, fn),
    end: () => pool.end(),
  };
}

export async function runTx(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn({ query: (t, p) => client.query(t, p) });
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
