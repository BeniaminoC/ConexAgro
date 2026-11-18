-- 001: módulo de proyectos (RF-04, RN-15 a RN-18).
-- autor_id es TEXT sin FK porque el módulo de usuarios/autenticación aún no existe;
-- cuando exista, migrar a una FK hacia usuarios(id).

CREATE TABLE proyectos (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  autor_id TEXT NOT NULL,
  nombre TEXT NOT NULL CHECK (char_length(nombre) BETWEEN 3 AND 120),
  descripcion TEXT NOT NULL CHECK (char_length(descripcion) BETWEEN 1 AND 2000),
  tipo_cultivo TEXT NOT NULL CHECK (char_length(tipo_cultivo) BETWEEN 1 AND 80),
  area_requerida_ha NUMERIC(10,2) NOT NULL CHECK (area_requerida_ha > 0),
  ubicacion_deseada TEXT NOT NULL CHECK (char_length(ubicacion_deseada) BETWEEN 1 AND 200),
  monto_inversion NUMERIC(14,2) NOT NULL CHECK (monto_inversion > 0),
  tiempo_retorno_meses INTEGER NOT NULL CHECK (tiempo_retorno_meses BETWEEN 1 AND 600),
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'cerrado')),
  creado_en TIMESTAMPTZ NOT NULL,
  actualizado_en TIMESTAMPTZ NOT NULL,
  cerrado_en TIMESTAMPTZ
);

CREATE INDEX idx_proyectos_estado ON proyectos (estado);
CREATE INDEX idx_proyectos_autor ON proyectos (autor_id);

-- RN-17: un único documento de soporte (PDF) por proyecto (PK = proyecto_id).
CREATE TABLE proyecto_documentos (
  proyecto_id INTEGER PRIMARY KEY REFERENCES proyectos (id) ON DELETE CASCADE,
  nombre_archivo TEXT NOT NULL,
  tamano INTEGER NOT NULL CHECK (tamano > 0),
  contenido BYTEA NOT NULL,
  subido_en TIMESTAMPTZ NOT NULL
);
