/*
  # HR Core — Tablas base (parte 1/2)

  Crea las tablas principales sin politicas que dependan entre si.
  Las politicas RLS completas se aplican en la migracion 20260525_hr_core_rls.

  ## Tablas creadas
  - sociedades
  - empleados (con constraint check_dni_nie)
  - centros
  - asignaciones
  - tags
  - etiquetado
  - documentos_centros

  ## Indices
  - Indices en todas las FK para rendimiento optimo
*/

-- ─────────────────────────────────────────────────────────────
-- 1. SOCIEDADES
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sociedades (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sociedades ENABLE ROW LEVEL SECURITY;

INSERT INTO sociedades (nombre) VALUES
  ('Sociedad Alfa'),
  ('Sociedad Beta'),
  ('Sociedad Gamma'),
  ('Sociedad Delta')
ON CONFLICT DO NOTHING;


-- ─────────────────────────────────────────────────────────────
-- 2. EMPLEADOS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS empleados (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  id_sociedad              uuid NOT NULL REFERENCES sociedades(id) ON DELETE RESTRICT,
  -- Datos personales
  nombre                   text NOT NULL DEFAULT '',
  email                    text NOT NULL DEFAULT '',
  dni                      text,
  telefono                 varchar(20),
  fecha_nacimiento         date,
  -- Datos contractuales
  tipo_contrato            varchar(50),
  fecha_alta               date,
  fin_periodo_prueba       date,
  observaciones_contrato   text,
  -- Datos operativos
  turno                    varchar(50),
  puesto                   varchar(100),
  centro_trabajo           varchar(100),
  titulacion_habilitante   text,
  -- Administrativo
  fecha_pago_tasas         date,
  observaciones            text,
  -- Auditoria
  activo                   boolean NOT NULL DEFAULT true,
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now(),
  CONSTRAINT check_dni_nie CHECK (
    dni IS NULL
    OR dni ~ '^[0-9]{8}[A-Z]$'
    OR dni ~ '^[XYZ][0-9]{7}[A-Z]$'
  )
);

CREATE INDEX IF NOT EXISTS idx_empleados_id_sociedad ON empleados(id_sociedad);
CREATE INDEX IF NOT EXISTS idx_empleados_user_id ON empleados(user_id);
CREATE INDEX IF NOT EXISTS idx_empleados_dni ON empleados(dni) WHERE dni IS NOT NULL;

ALTER TABLE empleados ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION update_empleados_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_empleados_updated_at ON empleados;
CREATE TRIGGER trg_empleados_updated_at
  BEFORE UPDATE ON empleados
  FOR EACH ROW EXECUTE FUNCTION update_empleados_updated_at();


-- ─────────────────────────────────────────────────────────────
-- 3. CENTROS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS centros (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL DEFAULT '',
  id_sociedad uuid NOT NULL REFERENCES sociedades(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_centros_id_sociedad ON centros(id_sociedad);

ALTER TABLE centros ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────
-- 4. ASIGNACIONES (movilidad empleado-centro)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS asignaciones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empleado uuid NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  id_centro   uuid NOT NULL REFERENCES centros(id) ON DELETE CASCADE,
  rol         text NOT NULL DEFAULT 'Empleado'
                CHECK (rol IN ('Empleado', 'Supervisor', 'Admin')),
  created_at  timestamptz DEFAULT now(),
  UNIQUE (id_empleado, id_centro)
);

CREATE INDEX IF NOT EXISTS idx_asignaciones_id_empleado ON asignaciones(id_empleado);
CREATE INDEX IF NOT EXISTS idx_asignaciones_id_centro ON asignaciones(id_centro);

ALTER TABLE asignaciones ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────
-- 5. TAGS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tags (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (nombre)
);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

INSERT INTO tags (nombre) VALUES
  ('Electricidad'),
  ('Prevencion'),
  ('Ergonomia'),
  ('Informatica'),
  ('Logistica'),
  ('Administracion'),
  ('Seguridad'),
  ('Mantenimiento')
ON CONFLICT (nombre) DO NOTHING;


-- ─────────────────────────────────────────────────────────────
-- 6. ETIQUETADO (N:M generica — ABAC)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS etiquetado (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id  uuid NOT NULL,
  tag_id      uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (entidad_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_etiquetado_entidad_id ON etiquetado(entidad_id);
CREATE INDEX IF NOT EXISTS idx_etiquetado_tag_id ON etiquetado(tag_id);

ALTER TABLE etiquetado ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────
-- 7. DOCUMENTOS_CENTROS
-- Nombre alternativo para no colisionar con la tabla 'documents' existente
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documentos_centros (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path            text NOT NULL DEFAULT '',
  nombre_archivo  text NOT NULL DEFAULT '',
  id_centro       uuid NOT NULL REFERENCES centros(id) ON DELETE CASCADE,
  tag_id          uuid REFERENCES tags(id) ON DELETE SET NULL,
  fecha_creacion  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documentos_centros_id_centro ON documentos_centros(id_centro);
CREATE INDEX IF NOT EXISTS idx_documentos_centros_tag_id ON documentos_centros(tag_id) WHERE tag_id IS NOT NULL;

ALTER TABLE documentos_centros ENABLE ROW LEVEL SECURITY;
