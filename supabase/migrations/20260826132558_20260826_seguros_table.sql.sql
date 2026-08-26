/*
# Crear tabla seguros (solo admin)

1. Nueva tabla: `seguros`
   - `id` (uuid, PK)
   - `sociedad_id` (uuid, opcional, FK a sociedades)
   - `tipo` (text) — tipo de seguro: Responsabilidad Civil, Hogar, Vehiculo, Salud, etc.
   - `compania` (text) — compania aseguradora
   - `numero_poliza` (text) — numero de poliza
   - `fecha_inicio` (date) — fecha de inicio de cobertura
   - `fecha_vencimiento` (date) — fecha de vencimiento
   - `importe_anual` (numeric) — prima anual
   - `estado` (text) — activo / vencido / cancelado
   - `beneficiario` (text, opcional)
   - `cobertura` (text, opcional) — descripcion de la cobertura
   - `observaciones` (text, opcional)
   - `created_at` (timestamptz)
   - `updated_at` (timestamptz)

2. Seguridad (RLS)
   - Activar RLS en `seguros`.
   - Solo el rol `admin` (verificado via `user_profiles.role = 'admin'`) puede hacer CRUD.
   - Ningun otro rol (rrhh, prevencion, supervisor, employee, etc.) puede leer ni escribir.
   - Las politicas usan una subconsulta a `user_profiles` para comprobar que el usuario autenticado es admin.
*/

CREATE TABLE IF NOT EXISTS seguros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedad_id uuid REFERENCES sociedades(id) ON DELETE SET NULL,
  tipo text NOT NULL DEFAULT 'Otro',
  compania text NOT NULL DEFAULT '',
  numero_poliza text NOT NULL DEFAULT '',
  fecha_inicio date,
  fecha_vencimiento date,
  importe_anual numeric(12,2),
  estado text NOT NULL DEFAULT 'activo',
  beneficiario text,
  cobertura text,
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indice para busquedas frecuentes
CREATE INDEX IF NOT EXISTS seguros_sociedad_id_idx ON seguros (sociedad_id);
CREATE INDEX IF NOT EXISTS seguros_estado_idx ON seguros (estado);
CREATE INDEX IF NOT EXISTS seguros_fecha_vencimiento_idx ON seguros (fecha_vencimiento);

ALTER TABLE seguros ENABLE ROW LEVEL SECURITY;

-- Funcion helper: ¿el usuario autenticado actual es admin?
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Solo admin puede leer
DROP POLICY IF EXISTS "admin_select_seguros" ON seguros;
CREATE POLICY "admin_select_seguros"
ON seguros FOR SELECT
TO authenticated
USING (is_current_user_admin());

-- Solo admin puede insertar
DROP POLICY IF EXISTS "admin_insert_seguros" ON seguros;
CREATE POLICY "admin_insert_seguros"
ON seguros FOR INSERT
TO authenticated
WITH CHECK (is_current_user_admin());

-- Solo admin puede actualizar
DROP POLICY IF EXISTS "admin_update_seguros" ON seguros;
CREATE POLICY "admin_update_seguros"
ON seguros FOR UPDATE
TO authenticated
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- Solo admin puede eliminar
DROP POLICY IF EXISTS "admin_delete_seguros" ON seguros;
CREATE POLICY "admin_delete_seguros"
ON seguros FOR DELETE
TO authenticated
USING (is_current_user_admin());

-- Trigger para actualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_seguros_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seguros_updated_at ON seguros;
CREATE TRIGGER seguros_updated_at
BEFORE UPDATE ON seguros
FOR EACH ROW
EXECUTE FUNCTION update_seguros_updated_at();