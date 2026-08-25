/*
# Supervisor centros assignment + helper function

## Purpose
Allows assigning work centers (centros) to a supervisor. A supervisor will see
all employees assigned to those centers automatically, plus any employees
assigned manually via supervisor_asignaciones.

## New Table: supervisor_centros
- `id` (uuid, primary key)
- `supervisor_id` (uuid, NOT NULL) — references user_profiles(id) ON DELETE CASCADE
- `centro_id` (uuid, NOT NULL) — references centros(id) ON DELETE CASCADE
- `created_at` (timestamptz, default now())
- UNIQUE constraint on (supervisor_id, centro_id)

## New Function: get_supervisor_empleados(p_supervisor_id uuid)
Returns the set of empleado IDs that a supervisor should see:
1. Employees manually assigned via supervisor_asignaciones
2. Employees whose centro_trabajo matches the name of a centro assigned
   via supervisor_centros
Returns a table with column `empleado_id uuid`.

## Security (RLS)
- RLS enabled on supervisor_centros.
- SELECT: admin/rrhh see all; supervisors see only their own assignments.
- INSERT/UPDATE/DELETE: only admin and rrhh.
*/
CREATE TABLE IF NOT EXISTS supervisor_centros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  centro_id uuid NOT NULL REFERENCES centros(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (supervisor_id, centro_id)
);

ALTER TABLE supervisor_centros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_supervisor_centros" ON supervisor_centros;
CREATE POLICY "select_supervisor_centros"
ON supervisor_centros FOR SELECT
TO authenticated
USING (
  is_admin_or_rrhh() OR supervisor_id = auth.uid()
);

DROP POLICY IF EXISTS "insert_supervisor_centros" ON supervisor_centros;
CREATE POLICY "insert_supervisor_centros"
ON supervisor_centros FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_rrhh());

DROP POLICY IF EXISTS "update_supervisor_centros" ON supervisor_centros;
CREATE POLICY "update_supervisor_centros"
ON supervisor_centros FOR UPDATE
TO authenticated
USING (is_admin_or_rrhh())
WITH CHECK (is_admin_or_rrhh());

DROP POLICY IF EXISTS "delete_supervisor_centros" ON supervisor_centros;
CREATE POLICY "delete_supervisor_centros"
ON supervisor_centros FOR DELETE
TO authenticated
USING (is_admin_or_rrhh());

CREATE INDEX IF NOT EXISTS idx_supervisor_centros_supervisor ON supervisor_centros(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_centros_centro ON supervisor_centros(centro_id);

-- Helper function: returns empleado_ids visible to a supervisor
-- (manual assignments + employees from assigned centros)
CREATE OR REPLACE FUNCTION get_supervisor_empleados(p_supervisor_id uuid)
RETURNS TABLE (empleado_id uuid)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- Manual assignments
  SELECT empleado_id FROM supervisor_asignaciones WHERE supervisor_id = p_supervisor_id
  UNION
  -- Employees whose centro_trabajo matches the name of an assigned centro
  SELECT e.id
  FROM empleados e
  INNER JOIN supervisor_centros sc ON sc.supervisor_id = p_supervisor_id
  INNER JOIN centros c ON c.id = sc.centro_id
  WHERE e.centro_trabajo = c.nombre
    AND e.activo = true
  UNION
  -- Employees whose centro_id (if the column exists) matches an assigned centro
  SELECT e.id
  FROM empleados e
  INNER JOIN supervisor_centros sc ON sc.supervisor_id = p_supervisor_id
  WHERE e.centro_id = sc.centro_id
    AND e.activo = true
$$;
