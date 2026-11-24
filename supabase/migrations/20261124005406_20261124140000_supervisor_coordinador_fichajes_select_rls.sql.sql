/*
# Scope fichajes SELECT to supervisor's assigned employees only

## Problem
The `admin_rrhh_select_fichajes` policy on the `fichajes` table allows ANY
supervisor to see ALL fichajes, regardless of which employees or centers are
assigned to them. A supervisor assigned only to "oficinasvf" can see fichajes
from every other center. Coordinadores had no SELECT access at all outside the
gerontalia routing policies.

## Changes

### 1. fichajes: SELECT policy (admin_rrhh_select_fichajes)
Drop and recreate to scope supervisor and coordinador access:
- admin, auditor, rrhh: see all fichajes (unchanged)
- supervisor: only fichajes for employees in their scope
  (supervisor_asignaciones direct + supervisor_centros by center)
- coordinador: only fichajes for employees whose supervisor is assigned to
  them (coordinador_supervisores chain → supervisor_asignaciones /
  supervisor_centros)

### 2. fichajes: UPDATE policy (admin_rrhh_update_fichajes)
No change — already scoped in migration 20261124120000.

## Security
- All clauses use auth.uid() — no caller-supplied parameters.
- Supervisor and coordinador access is scoped to their assigned employees only.
- RLS remains enabled; only the SELECT policy is replaced.
*/

DROP POLICY IF EXISTS "admin_rrhh_select_fichajes" ON fichajes;

CREATE POLICY "admin_rrhh_select_fichajes"
ON fichajes FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
      AND up.activo = true
      AND (
        up.role IN ('admin', 'auditor', 'rrhh')
        OR (
          up.role = 'supervisor'
          AND (
            EXISTS (
              SELECT 1 FROM supervisor_asignaciones sa
              WHERE sa.supervisor_id = up.id
                AND sa.empleado_id = fichajes.empleado_id
            )
            OR EXISTS (
              SELECT 1 FROM supervisor_centros sc
              JOIN empleados e ON e.centro_id = sc.centro_id
              WHERE sc.supervisor_id = up.id
                AND e.id = fichajes.empleado_id
            )
          )
        )
        OR (
          up.role = 'coordinador'
          AND (
            EXISTS (
              SELECT 1 FROM coordinador_supervisores cs
              JOIN supervisor_asignaciones sa ON sa.supervisor_id = cs.supervisor_id
              WHERE cs.coordinador_id = up.id
                AND sa.empleado_id = fichajes.empleado_id
            )
            OR EXISTS (
              SELECT 1 FROM coordinador_supervisores cs
              JOIN supervisor_centros sc ON sc.supervisor_id = cs.supervisor_id
              JOIN empleados e ON e.centro_id = sc.centro_id
              WHERE cs.coordinador_id = up.id
                AND e.id = fichajes.empleado_id
            )
          )
        )
      )
  )
);