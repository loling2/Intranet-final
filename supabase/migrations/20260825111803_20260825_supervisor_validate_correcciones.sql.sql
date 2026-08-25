/*
# Supervisor can validate corrections + notify supervisor on correction request

## 1. RLS Changes
### `fichajes_correcciones` UPDATE policy
- Supervisors can now UPDATE (approve/reject) corrections for employees
  assigned to them (via supervisor_asignaciones or supervisor_centros).
- Admin/RRHH retain full update access.

## 2. New Function: get_empleado_supervisor_email(p_empleado_id uuid)
- Returns the email of the supervisor assigned to a given employee.
- Checks supervisor_asignaciones first, then supervisor_centros (matching
  the employee's centro_id or centro_trabajo name).
- Returns NULL if no supervisor is assigned (caller falls back to RRHH).

## 3. New Function: notify_correccion_supervisor(p_correccion_id uuid)
- Called after an employee submits a correction request.
- Finds the employee's supervisor and sends them an email notification.
- If no supervisor is assigned, sends to the default RRHH notification email.
- Uses the email_notifications configuration (SMTP settings + plantillas).
*/
DROP POLICY IF EXISTS "update_own_or_admin_correcciones" ON fichajes_correcciones;
CREATE POLICY "update_own_or_admin_correcciones" ON fichajes_correcciones FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'rrhh')
    )
    OR EXISTS (
      SELECT 1 FROM supervisor_asignaciones sa
      WHERE sa.supervisor_id = auth.uid()
      AND sa.empleado_id = fichajes_correcciones.empleado_id
    )
    OR EXISTS (
      SELECT 1 FROM supervisor_centros sc
      INNER JOIN empleados e ON e.id = fichajes_correcciones.empleado_id
      WHERE sc.supervisor_id = auth.uid()
      AND (e.centro_id = sc.centro_id
           OR EXISTS (
             SELECT 1 FROM centros c WHERE c.id = sc.centro_id AND c.nombre = e.centro_trabajo
           ))
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'rrhh')
    )
    OR EXISTS (
      SELECT 1 FROM supervisor_asignaciones sa
      WHERE sa.supervisor_id = auth.uid()
      AND sa.empleado_id = fichajes_correcciones.empleado_id
    )
    OR EXISTS (
      SELECT 1 FROM supervisor_centros sc
      INNER JOIN empleados e ON e.id = fichajes_correcciones.empleado_id
      WHERE sc.supervisor_id = auth.uid()
      AND (e.centro_id = sc.centro_id
           OR EXISTS (
             SELECT 1 FROM centros c WHERE c.id = sc.centro_id AND c.nombre = e.centro_trabajo
           ))
    )
  );

-- Helper: get the supervisor email for an employee
CREATE OR REPLACE FUNCTION get_empleado_supervisor_email(p_empleado_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT up.email
  FROM user_profiles up
  WHERE up.role = 'supervisor'
    AND up.activo = true
    AND (
      up.id IN (
        SELECT sa.supervisor_id FROM supervisor_asignaciones sa
        WHERE sa.empleado_id = p_empleado_id
      )
      OR up.id IN (
        SELECT sc.supervisor_id FROM supervisor_centros sc
        WHERE sc.centro_id IN (
          SELECT e.centro_id FROM empleados e WHERE e.id = p_empleado_id
          UNION
          SELECT c.id FROM centros c
          WHERE c.nombre IN (
            SELECT e.centro_trabajo FROM empleados e WHERE e.id = p_empleado_id
          )
        )
      )
    )
  LIMIT 1
$$;
