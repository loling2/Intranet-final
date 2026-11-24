/*
# Fix supervisor employee visibility without recursive RLS policies

## Problem
The supervisor employee SELECT policy directly queried `user_profiles` while
some `user_profiles` policies query `empleados`. Supabase detected the
cross-table policy cycle as error 42P17 and blocked employee and CRM reads.

## Changes

### 1. Authorization helper
Create `supervisor_coordinador_puede_ver_empleado(uuid)` as a SECURITY DEFINER
helper. It checks the authenticated user's active supervisor or coordinator
role and verifies direct employee assignments or assigned-center access. The
coordinator path follows `coordinador_supervisores` to the supervisor's direct
assignments and centers.

### 2. empleados SELECT policy
Replace the recursive policy expression with a single call to the helper.
The policy remains limited to authenticated users and the same employee scope.

## Security
- The helper uses `auth.uid()` and ignores any caller-supplied user identity.
- The helper has an explicit `search_path` and disables nested RLS evaluation
  only inside the server-owned authorization check to prevent policy recursion.
- EXECUTE is revoked from PUBLIC and anon and granted only to authenticated.
- No employee write permissions are changed.
*/

CREATE OR REPLACE FUNCTION supervisor_coordinador_puede_ver_empleado(p_empleado_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
SELECT EXISTS (
  SELECT 1
  FROM user_profiles up
  WHERE up.id = auth.uid()
    AND up.activo = true
    AND (
      (
        (up.role = 'supervisor' OR 'supervisor' = ANY(COALESCE(up.roles, ARRAY[]::text[])))
        AND (
          EXISTS (
            SELECT 1
            FROM supervisor_asignaciones sa
            WHERE sa.supervisor_id = up.id
              AND sa.empleado_id = p_empleado_id
          )
          OR EXISTS (
            SELECT 1
            FROM supervisor_centros sc
            JOIN empleados e ON e.centro_id = sc.centro_id
            WHERE sc.supervisor_id = up.id
              AND e.id = p_empleado_id
          )
        )
      )
      OR (
        (up.role = 'coordinador' OR 'coordinador' = ANY(COALESCE(up.roles, ARRAY[]::text[])))
        AND (
          EXISTS (
            SELECT 1
            FROM coordinador_supervisores cs
            JOIN supervisor_asignaciones sa ON sa.supervisor_id = cs.supervisor_id
            WHERE cs.coordinador_id = up.id
              AND sa.empleado_id = p_empleado_id
          )
          OR EXISTS (
            SELECT 1
            FROM coordinador_supervisores cs
            JOIN supervisor_centros sc ON sc.supervisor_id = cs.supervisor_id
            JOIN empleados e ON e.centro_id = sc.centro_id
            WHERE cs.coordinador_id = up.id
              AND e.id = p_empleado_id
          )
        )
      )
    )
);
$$;

REVOKE EXECUTE ON FUNCTION supervisor_coordinador_puede_ver_empleado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION supervisor_coordinador_puede_ver_empleado(uuid) TO authenticated;

DROP POLICY IF EXISTS "supervisor_coordinador_select_empleados" ON empleados;
CREATE POLICY "supervisor_coordinador_select_empleados"
ON empleados FOR SELECT
TO authenticated
USING (supervisor_coordinador_puede_ver_empleado(id));
