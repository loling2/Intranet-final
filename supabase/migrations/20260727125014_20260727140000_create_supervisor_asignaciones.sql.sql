/*
# Create supervisor_asignaciones table

## Purpose
Allows assigning groups of employees (empleados) to a supervisor user.
A supervisor can have multiple employees assigned, and an employee can be
assigned to multiple supervisors. This is separate from the existing
`asignaciones` table (which assigns employees to centros/work centers
with a role). This new table links employees to supervisor user_profiles.

## New Table: supervisor_asignaciones
- `id` (uuid, primary key)
- `supervisor_id` (uuid, NOT NULL) — references user_profiles(id) ON DELETE CASCADE
- `empleado_id` (uuid, NOT NULL) — references empleados(id) ON DELETE CASCADE
- `created_at` (timestamptz, default now())
- UNIQUE constraint on (supervisor_id, empleado_id) to prevent duplicates

## Security (RLS)
- RLS enabled on supervisor_asignaciones.
- SELECT: authenticated users with role admin, rrhh, or supervisor can read.
  Supervisors can only read their own assignments.
- INSERT: admin and rrhh can insert (assign employees to any supervisor).
- UPDATE: admin and rrhh can update.
- DELETE: admin and rrhh can delete (unassign).

## Notes
1. The supervisor_id references user_profiles(id), which is linked to auth.users(id).
2. The empleado_id references empleados(id).
3. Only users with app role 'supervisor' (in user_profiles.role) should be
   used as supervisor_id, but the FK does not enforce this — the UI filters
   the dropdown to only show supervisor-role users.
*/

CREATE TABLE IF NOT EXISTS supervisor_asignaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  empleado_id uuid NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (supervisor_id, empleado_id)
);

ALTER TABLE supervisor_asignaciones ENABLE ROW LEVEL SECURITY;

-- Helper function: check if current user is admin or rrhh
CREATE OR REPLACE FUNCTION is_admin_or_rrhh()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role IN ('admin', 'rrhh')
  );
$$;

-- SELECT: admin/rrhh see all; supervisors see only their own assignments
DROP POLICY IF EXISTS "select_supervisor_asignaciones" ON supervisor_asignaciones;
CREATE POLICY "select_supervisor_asignaciones"
ON supervisor_asignaciones FOR SELECT
TO authenticated
USING (
  is_admin_or_rrhh() OR supervisor_id = auth.uid()
);

-- INSERT: only admin and rrhh
DROP POLICY IF EXISTS "insert_supervisor_asignaciones" ON supervisor_asignaciones;
CREATE POLICY "insert_supervisor_asignaciones"
ON supervisor_asignaciones FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_rrhh());

-- UPDATE: only admin and rrhh
DROP POLICY IF EXISTS "update_supervisor_asignaciones" ON supervisor_asignaciones;
CREATE POLICY "update_supervisor_asignaciones"
ON supervisor_asignaciones FOR UPDATE
TO authenticated
USING (is_admin_or_rrhh())
WITH CHECK (is_admin_or_rrhh());

-- DELETE: only admin and rrhh
DROP POLICY IF EXISTS "delete_supervisor_asignaciones" ON supervisor_asignaciones;
CREATE POLICY "delete_supervisor_asignaciones"
ON supervisor_asignaciones FOR DELETE
TO authenticated
USING (is_admin_or_rrhh());

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_supervisor_asignaciones_supervisor ON supervisor_asignaciones(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_asignaciones_empleado ON supervisor_asignaciones(empleado_id);
