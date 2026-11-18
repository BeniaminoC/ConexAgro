// Repositorio PostgreSQL (SQL parametrizado con `pg`; ORM aún no decidido, ver PROGRESS.md).
// Recibe un objeto `db` con query(texto, params) -> { rows }. Ver src/db/pg.js.
const num = (v) => (v === null || v === undefined ? v : Number(v));
const iso = (v) => (v === null || v === undefined ? v : new Date(v).toISOString());

const toProject = (r) =>
  r && {
    id: r.id,
    autorId: r.autor_id,
    nombre: r.nombre,
    descripcion: r.descripcion,
    tipoCultivo: r.tipo_cultivo,
    areaRequeridaHa: num(r.area_requerida_ha), // NUMERIC llega como string
    ubicacionDeseada: r.ubicacion_deseada,
    montoInversion: num(r.monto_inversion),
    tiempoRetornoMeses: r.tiempo_retorno_meses,
    estado: r.estado,
    creadoEn: iso(r.creado_en),
    actualizadoEn: iso(r.actualizado_en),
    cerradoEn: iso(r.cerrado_en),
  };

const toMeta = (r) =>
  r && { nombreArchivo: r.nombre_archivo, tamano: r.tamano, subidoEn: iso(r.subido_en) };

export function createProjectRepository(db) {
  const one = async (text, params) => (await db.query(text, params)).rows[0] ?? null;
  const many = async (text, params) => (await db.query(text, params)).rows;

  return {
    async insert(autorId, d, now) {
      return toProject(await one(
        `INSERT INTO proyectos
           (autor_id, nombre, descripcion, tipo_cultivo, area_requerida_ha, ubicacion_deseada,
            monto_inversion, tiempo_retorno_meses, estado, creado_en, actualizado_en)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'activo',$9::timestamptz,$9::timestamptz)
         RETURNING *`,
        [autorId, d.nombre, d.descripcion, d.tipoCultivo, d.areaRequeridaHa, d.ubicacionDeseada,
          d.montoInversion, d.tiempoRetornoMeses, now],
      ));
    },
    async findById(id) {
      return toProject(await one('SELECT * FROM proyectos WHERE id = $1', [id]));
    },
    async listActive() {
      return (await many("SELECT * FROM proyectos WHERE estado = 'activo' ORDER BY id DESC")).map(toProject);
    },
    async listByAuthor(autorId) {
      return (await many('SELECT * FROM proyectos WHERE autor_id = $1 ORDER BY id DESC', [autorId])).map(toProject);
    },
    async update(id, d, now) {
      return toProject(await one(
        `UPDATE proyectos SET nombre=$1, descripcion=$2, tipo_cultivo=$3, area_requerida_ha=$4,
           ubicacion_deseada=$5, monto_inversion=$6, tiempo_retorno_meses=$7, actualizado_en=$8::timestamptz
         WHERE id=$9 RETURNING *`,
        [d.nombre, d.descripcion, d.tipoCultivo, d.areaRequeridaHa, d.ubicacionDeseada,
          d.montoInversion, d.tiempoRetornoMeses, now, id],
      ));
    },
    async close(id, now) {
      return toProject(await one(
        `UPDATE proyectos SET estado='cerrado', cerrado_en=$1::timestamptz, actualizado_en=$1::timestamptz
         WHERE id=$2 RETURNING *`,
        [now, id],
      ));
    },

    // RN-17: un solo documento por proyecto; guardar de nuevo lo reemplaza (upsert por PK).
    async saveDocument(id, { nombreArchivo, contenido }, now) {
      return toMeta(await one(
        `INSERT INTO proyecto_documentos (proyecto_id, nombre_archivo, tamano, contenido, subido_en)
         VALUES ($1,$2,$3,$4,$5::timestamptz)
         ON CONFLICT (proyecto_id) DO UPDATE SET
           nombre_archivo = EXCLUDED.nombre_archivo, tamano = EXCLUDED.tamano,
           contenido = EXCLUDED.contenido, subido_en = EXCLUDED.subido_en
         RETURNING nombre_archivo, tamano, subido_en`,
        [id, nombreArchivo, contenido.length, contenido, now],
      ));
    },
    async getDocumentMeta(id) {
      return toMeta(await one(
        'SELECT nombre_archivo, tamano, subido_en FROM proyecto_documentos WHERE proyecto_id = $1', [id],
      ));
    },
    async getDocument(id) {
      const r = await one('SELECT * FROM proyecto_documentos WHERE proyecto_id = $1', [id]);
      return r && { ...toMeta(r), contenido: Buffer.from(r.contenido) };
    },
    async deleteDocument(id) {
      return (await many('DELETE FROM proyecto_documentos WHERE proyecto_id = $1 RETURNING proyecto_id', [id])).length > 0;
    },
  };
}
