/*
# Scope empleados SELECT to supervisor/coordinador assigned employees

## Problem
The `empleados` table had no SELECT policy for supervisors or coordinadores.
Supervisors could only see their own empleado record (via the "own record"
policy), so the "Mis Empleados Asignados" panel showed ~1 employee even though
`get_supervisor_empleados` correctly returned all their assigned employees.

## Changes

### 1. empleados: new SELECT policy (supervisor_coordinador_select_empleados)
- supervisor: employees assigned directly via supervisor_asignaciones plus
  employees whose centro_id matches a centro in supervisor_centros.
- coordinador: same scope, reached through coordinador_supervisores
  (coordinador → supervisors → employees/centros).

## Security
- All clauses use auth.uid() — no caller-supplied parameters.
- Scope matches the existing admin_rrhh_select_fichajes policy pattern.
- RLS remains enabled; read-only (SELECT only).
*/

DROP POLICY IF EXISTS "supervisor_coordinador_select_empleados" ON empleados;

CREATE POLICY "supervisor_coordinador_select_empleados"
ON empleados FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
      AND up.activo = true
      AND (
        (
          up.role = 'supervisor'
          OR (up.roles IS NOT NULL AND 'supervisor' = ANY (up.roles))
        )
        AND (
          EXISTS (
            SELECT 1 FROM supervisor_asignaciones sa
            WHERE sa.supervisor_id = up.id
              AND sa.empleado_id = empleados.id
          )
          OR EXISTS (
            SELECT 1 FROM supervisor_centros sc
            WHERE sc.supervisor_id = up.id
              AND sc.centro_id = empleados.centro_id
          )
        )
      )
      OR (
        (
          up.role = 'coordinador'
          OR (up.roles IS NOT NULL AND 'coordinador' = ANY (up.roles))
        )
        AND (
          EXISTS (
            SELECT 1 FROM coordinador_supervisores cs
            JOIN supervisor_asignaciones sa ON sa.supervisor_id = cs.supervisor_id
            WHERE cs.coordinador_id = up.id
              AND sa.empleado_id = empleados.id
          )
          OR EXISTS (
            SELECT 1 FROM coordinador_supervisores cs
            JOIN supervisor_centros sc ON sc.supervisor_id = cs.supervisor_id
            WHERE cs.coordinador_id = up.id
              AND sc.centro_id = empleados.centro_id
          )
        )
      )
  )
);
