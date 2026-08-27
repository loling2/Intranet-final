/*
# Ampliar seguros con categoria, matricula, descripcion y vinculo a vehiculo
# Crear tabla vehiculos_mantenimiento (historico de mantenimiento)

1. Cambios en tabla `seguros`
   - `categoria` (text) — 'local' | 'responsabilidad_civil' | 'vehiculo' | 'otro' (por compatibilidad con lo existente)
   - `matricula` (text, nullable) — matricula del vehiculo cuando categoria = 'vehiculo'
   - `vehiculo_id` (uuid, nullable, FK a vehicles) — vinculo opcional al vehiculo concreto
   - `descripcion` (text, nullable) — descripcion libre del seguro
   - `numero_asistencia` (text, nullable) — numero de telefono de asistencia en carretera

2. Nueva tabla: `vehiculos_mantenimiento`
   - `id` (uuid, PK)
   - `vehiculo_id` (uuid, FK a vehicles)
   - `tipo` (text) — tipo de intervencion: aceite, frenos, neumaticos, ITV, revision, taller, otro
   - `titulo` (text) — titulo corto descriptivo
   - `descripcion` (text, nullable) — detalle del trabajo realizado
   - `fecha` (date) — fecha de la intervencion
   - `kilometros` (integer, nullable) — kilometros en el momento
   - `taller` (text, nullable) — nombre del taller o proveedor
   - `importe` (numeric, nullable) — coste
   - `proxima_fecha` (date, nullable) — fecha sugerida para proxima intervencion
   - `proxima_revision_km` (integer, nullable) — km sugeridos para proxima revision
   - `created_at` (timestamptz)
   - `updated_at` (timestamptz)

3. Seguridad
   - RLS en `vehiculos_mantenimiento`: solo admin (via is_current_user_admin()) puede CRUD.
   - Las politicas de seguros ya restringen a admin; no se modifican.
*/

-- Añadir columnas a seguros
ALTER TABLE seguros ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'otro';
ALTER TABLE seguros ADD COLUMN IF NOT EXISTS matricula text;
ALTER TABLE seguros ADD COLUMN IF NOT EXISTS vehiculo_id uuid REFERENCES vehicles(id) ON DELETE SET NULL;
ALTER TABLE seguros ADD COLUMN IF NOT EXISTS descripcion text;
ALTER TABLE seguros ADD COLUMN IF NOT EXISTS numero_asistencia text;

-- Indice para busqueda por matricula y categoria
CREATE INDEX IF NOT EXISTS seguros_categoria_idx ON seguros (categoria);
CREATE INDEX IF NOT EXISTS seguros_matricula_idx ON seguros (matricula);
CREATE INDEX IF NOT EXISTS seguros_vehiculo_id_idx ON seguros (vehiculo_id);

-- Tabla de mantenimiento de vehiculos
CREATE TABLE IF NOT EXISTS vehiculos_mantenimiento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehiculo_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'otro',
  titulo text NOT NULL DEFAULT '',
  descripcion text,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  kilometros integer,
  taller text,
  importe numeric(12,2),
  proxima_fecha date,
  proxima_revision_km integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vehiculos_mantenimiento_vehiculo_id_idx ON vehiculos_mantenimiento (vehiculo_id);
CREATE INDEX IF NOT EXISTS vehiculos_mantenimiento_fecha_idx ON vehiculos_mantenimiento (fecha);

ALTER TABLE vehiculos_mantenimiento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_vehiculos_mantenimiento" ON vehiculos_mantenimiento;
CREATE POLICY "admin_select_vehiculos_mantenimiento"
ON vehiculos_mantenimiento FOR SELECT
TO authenticated
USING (is_current_user_admin());

DROP POLICY IF EXISTS "admin_insert_vehiculos_mantenimiento" ON vehiculos_mantenimiento;
CREATE POLICY "admin_insert_vehiculos_mantenimiento"
ON vehiculos_mantenimiento FOR INSERT
TO authenticated
WITH CHECK (is_current_user_admin());

DROP POLICY IF EXISTS "admin_update_vehiculos_mantenimiento" ON vehiculos_mantenimiento;
CREATE POLICY "admin_update_vehiculos_mantenimiento"
ON vehiculos_mantenimiento FOR UPDATE
TO authenticated
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

DROP POLICY IF EXISTS "admin_delete_vehiculos_mantenimiento" ON vehiculos_mantenimiento;
CREATE POLICY "admin_delete_vehiculos_mantenimiento"
ON vehiculos_mantenimiento FOR DELETE
TO authenticated
USING (is_current_user_admin());

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_vehiculos_mantenimiento_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vehiculos_mantenimiento_updated_at ON vehiculos_mantenimiento;
CREATE TRIGGER vehiculos_mantenimiento_updated_at
BEFORE UPDATE ON vehiculos_mantenimiento
FOR EACH ROW
EXECUTE FUNCTION update_vehiculos_mantenimiento_updated_at();