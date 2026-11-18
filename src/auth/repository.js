// Repositorio de usuarios y verificaciones de correo (SQL parametrizado con `pg`, igual que projects).
// Recibe `db` con query() y tx() (ver src/db/pg.js). Es la única capa de auth que toca SQL.
import { AppError } from '../projects/errors.js';
import { registerFailure, initialState } from './lockout.js';
import { checkVerification } from './verification.js';

const iso = (v) => (v == null ? v : new Date(v).toISOString());

const toUser = (r) =>
  r && {
    id: r.id,
    nombreCompleto: r.nombre_completo,
    correo: r.correo,
    contrasenaHash: r.contrasena_hash,
    tipoDocumento: r.tipo_documento,
    numeroDocumento: r.numero_documento,
    telefono: r.telefono,
    roles: r.roles,
    activo: r.activo,
    correoVerificado: r.correo_verificado,
    intentosFallidos: r.intentos_fallidos,
    bloqueadoHasta: r.bloqueado_hasta ? new Date(r.bloqueado_hasta).getTime() : null,
    creadoEn: iso(r.creado_en),
  };

export function createUserRepository(db) {
  const one = async (text, params) => (await db.query(text, params)).rows[0] ?? null;

  return {
    // RN-01 / RN-02: la unicidad la impone la BD (índices únicos); aquí se traduce a un 409 por campo.
    async insertUser(d, { verificado = false } = {}) {
      try {
        return toUser(await one(
          `INSERT INTO usuarios (nombre_completo, correo, contrasena_hash, tipo_documento,
              numero_documento, telefono, roles, correo_verificado)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [d.nombreCompleto, d.correo, d.contrasenaHash, d.tipoDocumento, d.numeroDocumento,
            d.telefono, d.roles, verificado],
        ));
      } catch (e) {
        if (e.code === '23505') {
          const campo = /documento/.test(e.constraint || '') ? 'numeroDocumento' : 'correo';
          const msg = campo === 'correo' ? 'Ese correo ya está registrado' : 'Ese número de documento ya está registrado';
          throw new AppError(409, 'CONFLICT', msg, { [campo]: msg });
        }
        throw e;
      }
    },

    findByEmail: async (correo) => toUser(await one('SELECT * FROM usuarios WHERE lower(correo) = lower($1)', [correo])),
    findById: async (id) => toUser(await one('SELECT * FROM usuarios WHERE id = $1', [id])),

    // Un solo token vigente por usuario: al emitir uno nuevo se descartan los pendientes (reenvío, FA-03).
    insertVerification: (usuarioId, tokenHash, expiraEn) => db.tx(async (t) => {
      await t.query('DELETE FROM verificaciones_correo WHERE usuario_id = $1 AND usado_en IS NULL', [usuarioId]);
      await t.query(
        'INSERT INTO verificaciones_correo (token_hash, usuario_id, expira_en) VALUES ($1,$2,$3)',
        [tokenHash, usuarioId, expiraEn],
      );
    }),

    // Consume el token de forma atómica. Devuelve 'valido' | 'expirado' | 'usado' | 'invalido'.
    consumeVerification: (tokenHash, now) => db.tx(async (t) => {
      const r = (await t.query(
        'SELECT usuario_id, expira_en, usado_en FROM verificaciones_correo WHERE token_hash = $1 FOR UPDATE',
        [tokenHash],
      )).rows[0];
      const estado = checkVerification(r && { expiraEn: r.expira_en, usadoEn: r.usado_en }, now);
      if (estado === 'valido') {
        await t.query('UPDATE verificaciones_correo SET usado_en = $2 WHERE token_hash = $1', [tokenHash, new Date(now)]);
        await t.query('UPDATE usuarios SET correo_verificado = TRUE WHERE id = $1', [r.usuario_id]);
      }
      return estado;
    }),

    // Conteo de fallos con bloqueo de fila: dos intentos simultáneos no pueden saltarse el límite (RN-06/07).
    recordFailure: (id, now) => db.tx(async (t) => {
      const r = (await t.query('SELECT intentos_fallidos, bloqueado_hasta FROM usuarios WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (!r) return initialState();
      const next = registerFailure({
        intentosFallidos: r.intentos_fallidos,
        bloqueadoHasta: r.bloqueado_hasta ? new Date(r.bloqueado_hasta).getTime() : null,
      }, now);
      await t.query('UPDATE usuarios SET intentos_fallidos = $2, bloqueado_hasta = $3 WHERE id = $1',
        [id, next.intentosFallidos, next.bloqueadoHasta == null ? null : new Date(next.bloqueadoHasta)]);
      return next;
    }),

    resetFailures: (id) => db.query('UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = $1', [id]),
  };
}
