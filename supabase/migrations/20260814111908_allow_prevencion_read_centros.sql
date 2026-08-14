/*
# Allow Prevencion to read centros (SELECT only)

## Problem
The trazabilidad stats page loads the centros dropdown from the `centros` table,
but the only SELECT policies on `centros` are:
  - "Admin or RRHH can view all centros" (is_admin_or_rrhh)
  - "Employee can view assigned centros" (via asignaciones + auth.uid match)

A user with role `prevencion` is neither admin/rrhh nor an employee with asignaciones,
so they get zero rows from `centros` and the dropdown only shows "Todos".

## Fix
Add a new SELECT policy allowing prevencion users to read centros, consistent with
how they already have SELECT access to prl_folders, prl_documents, empleados, etc.

## Security
- Read-only (SELECT). No INSERT/UPDATE/DELETE granted.
- Scoped to authenticated users with role = 'prevencion'.
*/

DROP POLICY IF EXISTS "Prevencion can view all centros" ON centros;
CREATE POLICY "Prevencion can view all centros"
  ON centros FOR SELECT
  TO authenticated
  USING (is_prevencion());
