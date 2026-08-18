/*
# Bajas Vitaly — fecha y motivo de baja en empleados + tabla bajas_vitaly

1. New Columns on `empleados`
- `fecha_baja` (date, nullable) — fecha en la que el empleado fue dado de baja.
  Se rellena al pasar el empleado de activo a inactivo desde el formulario de edicion.
- `motivo_baja` (text, nullable) — motivo libre escrito por el usuario al dar de baja.
- `comentario_baja` (text, nullable) — comentario opcional que anade prevencion al
  finalizar la baja en Vitaly.

2. New Table `bajas_vitaly`
- Registra cada baja creada al inactivar un empleado, para que prevencion la gestione.
- `id` (uuid PK)
- `empleado_id` (uuid FK → empleados.id ON DELETE CASCADE)
- `empleado_nombre` (text) — nombre del empleado en el momento de la baja (denormalizado para listado)
- `fecha_baja` (date) — fecha de la baja
- `motivo` (text) — motivo escrito al dar de baja
- `comentario` (text, nullable) — comentario que prevencion puede anadir antes de finalizar
- `estado` (text, default 'pendiente') — 'pendiente' | 'finalizada'
- `finalizada_at` (timestamptz, nullable) — cuando se finalizo
- `created_by` (uuid, nullable) — usuario que dio de baja
- `created_at` (timestamptz, default now())

3. Security
- RLS enabled on `bajas_vitaly`.
- Policies: admin/rrhh/prevencion/supervisor can SELECT, INSERT, UPDATE.
  Empleados no pueden acceder.
- No changes to existing empleados RLS (already permits admin/rrhh/prevencion/supervisor).
*/

ALTER TABLE empleados
  ADD COLUMN IF NOT EXISTS fecha_baja date;
ALTER TABLE empleados
  ADD COLUMN IF NOT EXISTS motivo_baja text;
ALTER TABLE empleados
  ADD COLUMN IF NOT EXISTS comentario_baja text;

CREATE TABLE IF NOT EXISTS bajas_vitaly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id uuid REFERENCES empleados(id) ON DELETE CASCADE,
  empleado_nombre text NOT NULL,
  fecha_baja date NOT NULL,
  motivo text,
  comentario text,
  estado text NOT NULL DEFAULT 'pendiente',
  finalizada_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bajas_vitaly ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bajas_vitaly_select_staff" ON bajas_vitaly;
CREATE POLICY "bajas_vitaly_select_staff"
ON bajas_vitaly FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = ANY (ARRAY['admin'::text, 'rrhh'::text, 'prevencion'::text, 'supervisor'::text])
  )
);

DROP POLICY IF EXISTS "bajas_vitaly_insert_staff" ON bajas_vitaly;
CREATE POLICY "bajas_vitaly_insert_staff"
ON bajas_vitaly FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = ANY (ARRAY['admin'::text, 'rrhh'::text, 'prevencion'::text, 'supervisor'::text])
  )
);

DROP POLICY IF EXISTS "bajas_vitaly_update_staff" ON bajas_vitaly;
CREATE POLICY "bajas_vitaly_update_staff"
ON bajas_vitaly FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = ANY (ARRAY['admin'::text, 'rrhh'::text, 'prevencion'::text, 'supervisor'::text])
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = ANY (ARRAY['admin'::text, 'rrhh'::text, 'prevencion'::text, 'supervisor'::text])
  )
);

DROP POLICY IF EXISTS "bajas_vitaly_delete_staff" ON bajas_vitaly;
CREATE POLICY "bajas_vitaly_delete_staff"
ON bajas_vitaly FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = ANY (ARRAY['admin'::text, 'rrhh'::text, 'prevencion'::text, 'supervisor'::text])
  )
);
