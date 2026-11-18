// Repositorio PostgreSQL de solicitudes (RF-07). SQL parametrizado con `pg`.
// `tx(fn)` ejecuta fn con un repositorio ligado a una sola conexión/transacción (RNF-05).
const iso = (v) => (v == null ? v : new Date(v).toISOString());

const toRequest = (r, historial) => r && {
  id: r.id, emisorId: String(r.emisor_id), receptorId: String(r.receptor_id),
  referenciaTipo: r.referencia_tipo, referenciaId: r.referencia_id,
  mensaje: r.mensaje, condiciones: r.condiciones, estado: r.estado, origenId: r.origen_id,
  creadoEn: iso(r.creado_en), actualizadoEn: iso(r.actualizado_en), historial,
};

function build(db) {
  const many = async (t, p) => (await db.query(t, p)).rows;
  const one = async (t, p) => (await many(t, p))[0] ?? null;
  const histories = async (ids) => {
    const map = new Map(ids.map((i) => [i, []]));
    if (!ids.length) return map;
    for (const h of await many('SELECT * FROM solicitud_historial WHERE solicitud_id = ANY($1::int[]) ORDER BY id', [ids])) {
      map.get(h.solicitud_id).push({ estado: h.estado, en: iso(h.en), por: String(h.por) });
    }
    return map;
  };
  const hydrate = async (rows) => {
    const h = await histories(rows.map((r) => r.id));
    return rows.map((r) => toRequest(r, h.get(r.id)));
  };
  const addHistory = (id, e) => db.query(
    'INSERT INTO solicitud_historial (solicitud_id, estado, en, por) VALUES ($1,$2,$3::timestamptz,$4)',
    [id, e.estado, e.en, Number(e.por)]);

  return {
    findUser: (id) => one('SELECT id, roles, activo, correo_verificado FROM usuarios WHERE id = $1', [id]),
    findProject: (id) => one('SELECT id, autor_id, estado FROM proyectos WHERE id = $1', [id]),

    // Solicitudes pendientes entre dos usuarios (cualquier sentido) para una referencia (FA-01).
    async activeBetween(a, b, tipo, refId) {
      return hydrate(await many(
        `SELECT * FROM solicitudes WHERE estado = 'pendiente' AND referencia_tipo = $3 AND referencia_id = $4
           AND ((emisor_id = $1 AND receptor_id = $2) OR (emisor_id = $2 AND receptor_id = $1))`,
        [Number(a), Number(b), tipo, refId]));
    },
    async insert(req, now) {
      const r = await one(
        `INSERT INTO solicitudes (emisor_id, receptor_id, referencia_tipo, referencia_id, mensaje, condiciones,
           estado, origen_id, creado_en, actualizado_en)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$9::timestamptz) RETURNING *`,
        [Number(req.emisorId), Number(req.receptorId), req.referenciaTipo, req.referenciaId, req.mensaje,
          req.condiciones, req.estado, req.origenId, now]);
      for (const e of req.historial) await addHistory(r.id, e);
      return toRequest(r, req.historial);
    },
    // Bloquea la fila para que dos respuestas simultáneas no se pisen (RN-26).
    async lock(id) {
      const r = await one('SELECT * FROM solicitudes WHERE id = $1 FOR UPDATE', [id]);
      return r && (await hydrate([r]))[0];
    },
    async get(id) {
      const r = await one('SELECT * FROM solicitudes WHERE id = $1', [id]);
      return r && (await hydrate([r]))[0];
    },
    async saveResponse(req, now) {
      await db.query('UPDATE solicitudes SET estado = $1, actualizado_en = $2::timestamptz WHERE id = $3',
        [req.estado, now, req.id]);
      await addHistory(req.id, req.historial.at(-1));
    },
    async list(userId, box) {
      const where = box === 'recibidas' ? 'receptor_id = $1' : box === 'enviadas' ? 'emisor_id = $1'
        : '(receptor_id = $1 OR emisor_id = $1)';
      return hydrate(await many(`SELECT * FROM solicitudes WHERE ${where} ORDER BY id DESC`, [Number(userId)]));
    },
  };
}

export function createRequestRepository(db) {
  return { ...build(db), tx: (fn) => db.tx((client) => fn(build(client))) };
}
