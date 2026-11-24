/*
# Fix supervisor and coordinador UPDATE access on fichajes_correcciones and fichajes

## Problem
Migration 20260922124945 (gerontalia routing) overwrote the UPDATE policy on
fichajes_correcciones and dropped the supervisor access clauses that migration
20260825111803 had added. Additionally, the fichajes UPDATE policy
(admin_rrhh_update_fichajes) never included supervisor or coordinador roles.

As a result, supervisors and coordinadores could SEE pending correction petitions
but could not approve or reject them — the UPDATE was silently blocked by RLS.

## Changes

### 1. fichajes_correcciones UPDATE policy
Drop and recreate `update_own_or_admin_correcciones` to include:
- Owner (user_id = auth.uid())
- admin
- rrhh (non-gerontalia, i.e. sociedad_id is null or != gerontalia society)
- rrhh_gerontalia (sociedad_id = gerontalia society)
- supervisor: can update corrections for employees assigned to them via
  supervisor_asignaciones (direct) or supervisor_centros (by center)
- coordinador: can update corrections for employees whose supervisor is
  assigned to the coordinador via coordinador_supervisores, then chained
  through supervisor_asignaciones / supervisor_centros

### 2. fichajes UPDATE policy
Drop and recreate `admin_rrhh_update_fichajes` to add:
- supervisor: can update fichajes for employees in their scope
  (supervisor_asignaciones + supervisor_centros)
- coordinador: can update fichajes for employees whose supervisor is
  assigned to them (coordinador_supervisores chain)

### 3. fichajes_correcciones SELECT policy
Drop and recreate `select_own_or_admin_correcciones` to also allow
coordinador to see corrections for employees in their chain (supervisor
already had SELECT access).

## Security
- All clauses use auth.uid() — no caller-supplied parameters.
- Supervisor and coordinador access is scoped to their assigned employees only.
- Gerontalia routing logic is preserved.
- RLS remains enabled; only policies are replaced.
*/

-- ============================================================
-- 1. fichajes_correcciones: UPDATE policy
-- ============================================================
DROP POLICY IF EXISTS "update_own_or_admin_correcciones" ON fichajes_correcciones;

CREATE POLICY "update_own_or_admin_correcciones"
ON fichajes_correcciones FOR UPDATE
TO authenticated
USING (
  (user_id = auth.uid())
  OR (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.activo = true
        AND (
          up.role = 'admin'
          OR (up.role = 'rrhh'
              AND (fichajes_correcciones.sociedad_id IS NULL
                   OR fichajes_correcciones.sociedad_id <> '6632d8d1-c4e7-4540-aab7-515b9d7913f7'::uuid))
          OR (up.role = 'rrhh_gerontalia'
              AND fichajes_correcciones.sociedad_id = '6632d8d1-c4e7-4540-aab7-515b9d7913f7'::uuid)
          OR (up.role = 'supervisor'
              AND (
                EXISTS (
                  SELECT 1 FROM supervisor_asignaciones sa
                  WHERE sa.supervisor_id = up.id
                    AND sa.empleado_id = fichajes_correcciones.empleado_id
                )
                OR EXISTS (
                  SELECT 1 FROM supervisor_centros sc
                  JOIN empleados e ON e.centro_id = sc.centro_id
                  WHERE sc.supervisor_id = up.id
                    AND e.id = fichajes_correcciones.empleado_id
                )
              )
          )
          OR (up.role = 'coordinador'
              AND EXISTS (
                SELECT 1 FROM coordinador_supervisores cs
                JOIN supervisor_asignaciones sa ON sa.supervisor_id = cs.supervisor_id
                WHERE cs.coordinador_id = up.id
                  AND sa.empleado_id = fichajes_correcciones.empleado_id
              )
              OR (up.role = 'coordinador'
                  AND EXISTS (
                    SELECT 1 FROM coordinador_supervisores cs
                    JOIN supervisor_centros sc ON sc.supervisor_id = cs.supervisor_id
                    JOIN empleados e ON e.centro_id = sc.centro_id
                    WHERE cs.coordinador_id = up.id
                      AND e.id = fichajes_correcciones.empleado_id
                  )
              )
          )
        )
    )
  )
)
WITH CHECK (
  (user_id = auth.uid())
  OR (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.activo = true
        AND (
          up.role = 'admin'
          OR (up.role = 'rrhh'
              AND (fichajes_correcciones.sociedad_id IS NULL
                   OR fichajes_correcciones.sociedad_id <> '6632d8d1-c4e7-4540-aab7-515b9d7913f7'::uuid))
          OR (up.role = 'rrhh_gerontalia'
              AND fichajes_correcciones.sociedad_id = '6632d8d1-c4e7-4540-aab7-515b9d7913f7'::uuid)
          OR (up.role = 'supervisor'
              AND (
                EXISTS (
                  SELECT 1 FROM supervisor_asignaciones sa
                  WHERE sa.supervisor_id = up.id
                    AND sa.empleado_id = fichajes_correcciones.empleado_id
                )
                OR EXISTS (
                  SELECT 1 FROM supervisor_centros sc
                  JOIN empleados e ON e.centro_id = sc.centro_id
                  WHERE sc.supervisor_id = up.id
                    AND e.id = fichajes_correcciones.empleado_id
                )
              )
          )
          OR (up.role = 'coordinador'
              AND EXISTS (
                SELECT 1 FROM coordinador_supervisores cs
                JOIN supervisor_asignaciones sa ON sa.supervisor_id = cs.supervisor_id
                WHERE cs.coordinador_id = up.id
                  AND sa.empleado_id = fichajes_correcciones.empleado_id
              )
              OR (up.role = 'coordinador'
                  AND EXISTS (
                    SELECT 1 FROM coordinador_supervisores cs
                    JOIN supervisor_centros sc ON sc.supervisor_id = cs.supervisor_id
                    JOIN empleados e ON e.centro_id = sc.centro_id
                    WHERE cs.coordinador_id = up.id
                      AND e.id = fichajes_correcciones.empleado_id
                  )
              )
          )
        )
    )
  )
);

-- ============================================================
-- 2. fichajes_correcciones: SELECT policy (add coordinador)
-- ============================================================
DROP POLICY IF EXISTS "select_own_or_admin_correcciones" ON fichajes_correcciones;

CREATE POLICY "select_own_or_admin_correcciones"
ON fichajes_correcciones FOR SELECT
TO authenticated
USING (
  (user_id = auth.uid())
  OR (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.activo = true
        AND (
          up.role = 'admin'
          OR (up.role = 'rrhh'
              AND (fichajes_correcciones.sociedad_id IS NULL
                   OR fichajes_correcciones.sociedad_id <> '6632d8d1-c4e7-4540-aab7-515b9d7913f7'::uuid))
          OR (up.role = 'rrhh_gerontalia'
              AND fichajes_correcciones.sociedad_id = '6632d8d1-c4e7-4540-aab7-515b9d7913f7'::uuid)
          OR (up.role = 'supervisor'
              AND (
                EXISTS (
                  SELECT 1 FROM supervisor_asignaciones sa
                  WHERE sa.supervisor_id = up.id
                    AND sa.empleado_id = fichajes_correcciones.empleado_id
                )
                OR EXISTS (
                  SELECT 1 FROM supervisor_centros sc
                  JOIN empleados e ON e.centro_id = sc.centro_id
                  WHERE sc.supervisor_id = up.id
                    AND e.id = fichajes_correcciones.empleado_id
                )
              )
          )
          OR (up.role = 'coordinador'
              AND (
                EXISTS (
                  SELECT 1 FROM coordinador_supervisores cs
                  JOIN supervisor_asignaciones sa ON sa.supervisor_id = cs.supervisor_id
                  WHERE cs.coordinador_id = up.id
                    AND sa.empleado_id = fichajes_correcciones.empleado_id
                )
                OR EXISTS (
                  SELECT 1 FROM coordinador_supervisores cs
                  JOIN supervisor_centros sc ON sc.supervisor_id = cs.supervisor_id
                  JOIN empleados e ON e.centro_id = sc.centro_id
                  WHERE cs.coordinador_id = up.id
                    AND e.id = fichajes_correcciones.empleado_id
                )
              )
          )
        )
    )
  )
);

-- ============================================================
-- 3. fichajes: UPDATE policy (add supervisor + coordinador)
-- ============================================================
DROP POLICY IF EXISTS "admin_rrhh_update_fichajes" ON fichajes;

CREATE POLICY "admin_rrhh_update_fichajes"
ON fichajes FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
      AND up.activo = true
      AND (
        up.role IN ('admin', 'rrhh')
        OR (up.role = 'supervisor'
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
        OR (up.role = 'coordinador'
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
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
      AND up.activo = true
      AND (
        up.role IN ('admin', 'rrhh')
        OR (up.role = 'supervisor'
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
        OR (up.role = 'coordinador'
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

-- ============================================================
-- 4. fichajes: SELECT policy (add coordinador)
-- Drop the existing admin/supervisor select and recreate with coordinador
-- ============================================================
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
        up.role IN ('admin', 'auditor', 'rrhh', 'supervisor')
        OR (up.role = 'coordinador'
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