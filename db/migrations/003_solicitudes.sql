-- 003: solicitudes de vinculación (RF-07, RN-25 a RN-28, RNF-05).
-- referencia_id es polimórfico (terreno | proyecto) y por tanto sin FK; el servicio valida que el proyecto exista.
-- Aún no hay tabla de terrenos: el servicio solo acepta referencia 'proyecto' por ahora.
CREATE TABLE solicitudes (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  emisor_id INTEGER NOT NULL REFERENCES usuarios (id),
  receptor_id INTEGER NOT NULL REFERENCES usuarios (id),
  referencia_tipo TEXT NOT NULL CHECK (referencia_tipo IN ('terreno', 'proyecto')),
  referencia_id INTEGER NOT NULL CHECK (referencia_id > 0),
  mensaje TEXT NOT NULL CHECK (char_length(mensaje) BETWEEN 1 AND 1000),
  condiciones TEXT CHECK (condiciones IS NULL OR char_length(condiciones) BETWEEN 1 AND 1000),
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aceptada', 'rechazada', 'contrapropuesta')),
  origen_id INTEGER REFERENCES solicitudes (id),
  creado_en TIMESTAMPTZ NOT NULL,
  actualizado_en TIMESTAMPTZ NOT NULL,
  CHECK (emisor_id <> receptor_id)
);

-- FA-01 garantizado por la BD (atómico ante concurrencia): una sola solicitud pendiente por pareja
-- (en cualquier sentido) y referencia.
CREATE UNIQUE INDEX solicitudes_activa_uq ON solicitudes
  (LEAST(emisor_id, receptor_id), GREATEST(emisor_id, receptor_id), referencia_tipo, referencia_id)
  WHERE estado = 'pendiente';
CREATE INDEX idx_solicitudes_emisor ON solicitudes (emisor_id);
CREATE INDEX idx_solicitudes_receptor ON solicitudes (receptor_id);

-- RN-28: cada cambio de estado con fecha/hora y responsable; el historial no se borra (sin límite de tiempo).
CREATE TABLE solicitud_historial (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  solicitud_id INTEGER NOT NULL REFERENCES solicitudes (id),
  estado TEXT NOT NULL CHECK (estado IN ('pendiente', 'aceptada', 'rechazada', 'contrapropuesta')),
  en TIMESTAMPTZ NOT NULL,
  por INTEGER NOT NULL REFERENCES usuarios (id)
);
CREATE INDEX idx_solicitud_historial_sol ON solicitud_historial (solicitud_id);
