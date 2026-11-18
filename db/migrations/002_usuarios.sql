-- NO EJECUTADA todavía (sesión 4 sin PostgreSQL). Revisar y probar con `npm run migrate` + pruebas de BD.
CREATE TABLE usuarios (
  id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre_completo     TEXT        NOT NULL,
  correo              TEXT        NOT NULL,
  contrasena_hash     TEXT        NOT NULL,
  tipo_documento      TEXT        NOT NULL CHECK (tipo_documento IN ('CC','CE','TI','PASAPORTE','NIT')),
  numero_documento    TEXT        NOT NULL,
  telefono            TEXT        NOT NULL,
  roles               TEXT[]      NOT NULL CHECK (cardinality(roles) BETWEEN 1 AND 2
                                    AND roles <@ ARRAY['PROPIETARIO','PRODUCTOR','INVERSIONISTA','ADMINISTRADOR']),
  activo              BOOLEAN     NOT NULL DEFAULT TRUE,
  correo_verificado   BOOLEAN     NOT NULL DEFAULT FALSE,
  intentos_fallidos   INTEGER     NOT NULL DEFAULT 0,
  bloqueado_hasta     TIMESTAMPTZ,
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- RN-01 y RN-02: correo y documento únicos (correo sin distinguir mayúsculas).
CREATE UNIQUE INDEX usuarios_correo_uq ON usuarios (lower(correo));
CREATE UNIQUE INDEX usuarios_documento_uq ON usuarios (numero_documento);

CREATE TABLE verificaciones_correo (
  token_hash  TEXT        PRIMARY KEY,           -- se guarda el hash, no el token
  usuario_id  INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira_en   TIMESTAMPTZ NOT NULL,              -- RN-03: 24 h
  usado_en    TIMESTAMPTZ
);
