/*
# Add prevencion_gerontalia role (corrected)

1. Purpose
- Create "prevencion_gerontalia" role with same access as "prevencion" but limited to Gerontalia.
- Existing "prevencion" role is completely unaffected.

2. New role
- "prevencion_gerontalia" in app_roles.

3. Helper function changes
- is_prevencion() includes 'prevencion_gerontalia'.
- my_scope_society_id() includes 'prevencion_gerontalia'.
- is_staff() includes 'prevencion_gerontalia'.

4. Tab permissions
- Copied from 'prevencion' to 'prevencion_gerontalia'.

5. RLS policies
- Gerontalia-scoped policies on all tables prevencion can access.
- nominas.society_id is text, so cast my_scope_society_id() to text.

6. Important notes
- Global "prevencion" role is completely unaffected.
- No data is lost.
*/

-- 1. Register the new role
INSERT INTO app_roles (name, description)
VALUES ('prevencion_gerontalia', 'Prevencion limitado a la sociedad Gerontalia')
ON CONFLICT (name) DO NOTHING;

-- 2. Update is_prevencion()
CREATE OR REPLACE FUNCTION public.is_prevencion()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role IN ('prevencion', 'prevencion_gerontalia')
  );
$$;

-- 3. Update my_scope_society_id()
CREATE OR REPLACE FUNCTION public.my_scope_society_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role IN ('rrhh_gerontalia','administrador_gerontalia','supervisor_gerontalia','prevencion_gerontalia')
    ) THEN '6632d8d1-c4e7-4540-aab7-515b9d7913f7'::uuid
    ELSE NULL
  END;
$$;

-- 4. Update is_staff()
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role IN (
      'admin','rrhh','prevencion','supervisor','administracion','calidad','formacion',
      'administrador_gerontalia','rrhh_gerontalia','supervisor_gerontalia','prevencion_gerontalia'
    )
  );
$$;

-- 5. Copy tab permissions
INSERT INTO role_tab_permissions (role, tab_id, enabled)
SELECT 'prevencion_gerontalia', tab_id, enabled
FROM role_tab_permissions WHERE role = 'prevencion'
ON CONFLICT DO NOTHING;

-- 6. RLS policies

-- empleados
DROP POLICY IF EXISTS "gerontalia_prev_select_empleados" ON empleados;
CREATE POLICY "gerontalia_prev_select_empleados" ON empleados FOR SELECT
  TO authenticated USING (is_gerontalia_scoped() AND id_sociedad = my_scope_society_id());

-- centros
DROP POLICY IF EXISTS "gerontalia_prev_select_centros" ON centros;
CREATE POLICY "gerontalia_prev_select_centros" ON centros FOR SELECT
  TO authenticated USING (is_gerontalia_scoped() AND id_sociedad = my_scope_society_id());

-- prl_documents
DROP POLICY IF EXISTS "gerontalia_prev_select_prl_documents" ON prl_documents;
CREATE POLICY "gerontalia_prev_select_prl_documents" ON prl_documents FOR SELECT
  TO authenticated USING (is_gerontalia_scoped());

-- prl_folders
DROP POLICY IF EXISTS "gerontalia_prev_select_prl_folders" ON prl_folders;
CREATE POLICY "gerontalia_prev_select_prl_folders" ON prl_folders FOR SELECT
  TO authenticated USING (is_gerontalia_scoped());

-- employee_documents
DROP POLICY IF EXISTS "gerontalia_prev_select_employee_documents" ON employee_documents;
CREATE POLICY "gerontalia_prev_select_employee_documents" ON employee_documents FOR SELECT
  TO authenticated USING (
    is_gerontalia_scoped() AND EXISTS (
      SELECT 1 FROM empleados e WHERE e.id = employee_documents.employee_id AND e.id_sociedad = my_scope_society_id()
    )
  );

-- bajas_temporales (empleado_id)
DROP POLICY IF EXISTS "gerontalia_prev_select_bajas" ON bajas_temporales;
CREATE POLICY "gerontalia_prev_select_bajas" ON bajas_temporales FOR SELECT
  TO authenticated USING (
    is_gerontalia_scoped() AND EXISTS (
      SELECT 1 FROM empleados e WHERE e.id = bajas_temporales.empleado_id AND e.id_sociedad = my_scope_society_id()
    )
  );
DROP POLICY IF EXISTS "gerontalia_prev_insert_bajas" ON bajas_temporales;
CREATE POLICY "gerontalia_prev_insert_bajas" ON bajas_temporales FOR INSERT
  TO authenticated WITH CHECK (
    is_gerontalia_scoped() AND EXISTS (
      SELECT 1 FROM empleados e WHERE e.id = bajas_temporales.empleado_id AND e.id_sociedad = my_scope_society_id()
    )
  );
DROP POLICY IF EXISTS "gerontalia_prev_update_bajas" ON bajas_temporales;
CREATE POLICY "gerontalia_prev_update_bajas" ON bajas_temporales FOR UPDATE
  TO authenticated USING (
    is_gerontalia_scoped() AND EXISTS (
      SELECT 1 FROM empleados e WHERE e.id = bajas_temporales.empleado_id AND e.id_sociedad = my_scope_society_id()
    )
  ) WITH CHECK (
    is_gerontalia_scoped() AND EXISTS (
      SELECT 1 FROM empleados e WHERE e.id = bajas_temporales.empleado_id AND e.id_sociedad = my_scope_society_id()
    )
  );
DROP POLICY IF EXISTS "gerontalia_prev_delete_bajas" ON bajas_temporales;
CREATE POLICY "gerontalia_prev_delete_bajas" ON bajas_temporales FOR DELETE
  TO authenticated USING (
    is_gerontalia_scoped() AND EXISTS (
      SELECT 1 FROM empleados e WHERE e.id = bajas_temporales.empleado_id AND e.id_sociedad = my_scope_society_id()
    )
  );

-- sustituciones (baja_id → bajas_temporales)
DROP POLICY IF EXISTS "gerontalia_prev_select_sustituciones" ON sustituciones;
CREATE POLICY "gerontalia_prev_select_sustituciones" ON sustituciones FOR SELECT
  TO authenticated USING (
    is_gerontalia_scoped() AND EXISTS (
      SELECT 1 FROM bajas_temporales bt WHERE bt.id = sustituciones.baja_id
        AND EXISTS (SELECT 1 FROM empleados e WHERE e.id = bt.empleado_id AND e.id_sociedad = my_scope_society_id())
    )
  );
DROP POLICY IF EXISTS "gerontalia_prev_insert_sustituciones" ON sustituciones;
CREATE POLICY "gerontalia_prev_insert_sustituciones" ON sustituciones FOR INSERT
  TO authenticated WITH CHECK (
    is_gerontalia_scoped() AND EXISTS (
      SELECT 1 FROM bajas_temporales bt WHERE bt.id = sustituciones.baja_id
        AND EXISTS (SELECT 1 FROM empleados e WHERE e.id = bt.empleado_id AND e.id_sociedad = my_scope_society_id())
    )
  );
DROP POLICY IF EXISTS "gerontalia_prev_update_sustituciones" ON sustituciones;
CREATE POLICY "gerontalia_prev_update_sustituciones" ON sustituciones FOR UPDATE
  TO authenticated USING (
    is_gerontalia_scoped() AND EXISTS (
      SELECT 1 FROM bajas_temporales bt WHERE bt.id = sustituciones.baja_id
        AND EXISTS (SELECT 1 FROM empleados e WHERE e.id = bt.empleado_id AND e.id_sociedad = my_scope_society_id())
    )
  ) WITH CHECK (
    is_gerontalia_scoped() AND EXISTS (
      SELECT 1 FROM bajas_temporales bt WHERE bt.id = sustituciones.baja_id
        AND EXISTS (SELECT 1 FROM empleados e WHERE e.id = bt.empleado_id AND e.id_sociedad = my_scope_society_id())
    )
  );
DROP POLICY IF EXISTS "gerontalia_prev_delete_sustituciones" ON sustituciones;
CREATE POLICY "gerontalia_prev_delete_sustituciones" ON sustituciones FOR DELETE
  TO authenticated USING (
    is_gerontalia_scoped() AND EXISTS (
      SELECT 1 FROM bajas_temporales bt WHERE bt.id = sustituciones.baja_id
        AND EXISTS (SELECT 1 FROM empleados e WHERE e.id = bt.empleado_id AND e.id_sociedad = my_scope_society_id())
    )
  );

-- dispositivos
DROP POLICY IF EXISTS "gerontalia_prev_select_dispositivos" ON dispositivos;
CREATE POLICY "gerontalia_prev_select_dispositivos" ON dispositivos FOR SELECT
  TO authenticated USING (is_gerontalia_scoped());

-- incidencias
DROP POLICY IF EXISTS "gerontalia_prev_select_incidencias" ON incidencias;
CREATE POLICY "gerontalia_prev_select_incidencias" ON incidencias FOR SELECT
  TO authenticated USING (is_gerontalia_scoped());

-- fichajes (empleado_id)
DROP POLICY IF EXISTS "gerontalia_prev_select_fichajes" ON fichajes;
CREATE POLICY "gerontalia_prev_select_fichajes" ON fichajes FOR SELECT
  TO authenticated USING (
    is_gerontalia_scoped() AND EXISTS (
      SELECT 1 FROM empleados e WHERE e.id = fichajes.empleado_id AND e.id_sociedad = my_scope_society_id()
    )
  );

-- fichajes_correcciones (empleado_id)
DROP POLICY IF EXISTS "gerontalia_prev_select_fichajes_corr" ON fichajes_correcciones;
CREATE POLICY "gerontalia_prev_select_fichajes_corr" ON fichajes_correcciones FOR SELECT
  TO authenticated USING (
    is_gerontalia_scoped() AND EXISTS (
      SELECT 1 FROM empleados e WHERE e.id = fichajes_correcciones.empleado_id AND e.id_sociedad = my_scope_society_id()
    )
  );

-- nominas (society_id is text, cast to text)
DROP POLICY IF EXISTS "gerontalia_prev_select_nominas" ON nominas;
CREATE POLICY "gerontalia_prev_select_nominas" ON nominas FOR SELECT
  TO authenticated USING (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text);

-- vacation_balances (employee_id)
DROP POLICY IF EXISTS "gerontalia_prev_select_vacation_balances" ON vacation_balances;
CREATE POLICY "gerontalia_prev_select_vacation_balances" ON vacation_balances FOR SELECT
  TO authenticated USING (
    is_gerontalia_scoped() AND EXISTS (
      SELECT 1 FROM empleados e WHERE e.id = vacation_balances.employee_id AND e.id_sociedad = my_scope_society_id()
    )
  );

-- audit_logs
DROP POLICY IF EXISTS "gerontalia_prev_select_audit_logs" ON audit_logs;
CREATE POLICY "gerontalia_prev_select_audit_logs" ON audit_logs FOR SELECT
  TO authenticated USING (is_gerontalia_scoped());

-- user_profiles
DROP POLICY IF EXISTS "gerontalia_prev_select_user_profiles" ON user_profiles;
CREATE POLICY "gerontalia_prev_select_user_profiles" ON user_profiles FOR SELECT
  TO authenticated USING (
    is_gerontalia_scoped() AND (
      id = auth.uid()
      OR EXISTS (SELECT 1 FROM empleados e WHERE e.user_id = user_profiles.id AND e.id_sociedad = my_scope_society_id())
    )
  );

-- asignaciones (id_empleado)
DROP POLICY IF EXISTS "gerontalia_prev_select_asignaciones" ON asignaciones;
CREATE POLICY "gerontalia_prev_select_asignaciones" ON asignaciones FOR SELECT
  TO authenticated USING (
    is_gerontalia_scoped() AND EXISTS (
      SELECT 1 FROM empleados e WHERE e.id = asignaciones.id_empleado AND e.id_sociedad = my_scope_society_id()
    )
  );

-- kiosk_devices
DROP POLICY IF EXISTS "gerontalia_prev_select_kiosk_devices" ON kiosk_devices;
CREATE POLICY "gerontalia_prev_select_kiosk_devices" ON kiosk_devices FOR SELECT
  TO authenticated USING (is_gerontalia_scoped());

-- vehicles
DROP POLICY IF EXISTS "gerontalia_prev_select_vehicles" ON vehicles;
CREATE POLICY "gerontalia_prev_select_vehicles" ON vehicles FOR SELECT
  TO authenticated USING (is_gerontalia_scoped());

-- vehicle_logs
DROP POLICY IF EXISTS "gerontalia_prev_select_vehicle_logs" ON vehicle_logs;
CREATE POLICY "gerontalia_prev_select_vehicle_logs" ON vehicle_logs FOR SELECT
  TO authenticated USING (is_gerontalia_scoped());

-- bajas_vitaly (empleado_id)
DROP POLICY IF EXISTS "gerontalia_prev_select_bajas_vitaly" ON bajas_vitaly;
CREATE POLICY "gerontalia_prev_select_bajas_vitaly" ON bajas_vitaly FOR SELECT
  TO authenticated USING (
    is_gerontalia_scoped() AND EXISTS (
      SELECT 1 FROM empleados e WHERE e.id = bajas_vitaly.empleado_id AND e.id_sociedad = my_scope_society_id()
    )
  );
DROP POLICY IF EXISTS "gerontalia_prev_insert_bajas_vitaly" ON bajas_vitaly;
CREATE POLICY "gerontalia_prev_insert_bajas_vitaly" ON bajas_vitaly FOR INSERT
  TO authenticated WITH CHECK (
    is_gerontalia_scoped() AND EXISTS (
      SELECT 1 FROM empleados e WHERE e.id = bajas_vitaly.empleado_id AND e.id_sociedad = my_scope_society_id()
    )
  );
DROP POLICY IF EXISTS "gerontalia_prev_update_bajas_vitaly" ON bajas_vitaly;
CREATE POLICY "gerontalia_prev_update_bajas_vitaly" ON bajas_vitaly FOR UPDATE
  TO authenticated USING (
    is_gerontalia_scoped() AND EXISTS (
      SELECT 1 FROM empleados e WHERE e.id = bajas_vitaly.empleado_id AND e.id_sociedad = my_scope_society_id()
    )
  ) WITH CHECK (
    is_gerontalia_scoped() AND EXISTS (
      SELECT 1 FROM empleados e WHERE e.id = bajas_vitaly.empleado_id AND e.id_sociedad = my_scope_society_id()
    )
  );
DROP POLICY IF EXISTS "gerontalia_prev_delete_bajas_vitaly" ON bajas_vitaly;
CREATE POLICY "gerontalia_prev_delete_bajas_vitaly" ON bajas_vitaly FOR DELETE
  TO authenticated USING (
    is_gerontalia_scoped() AND EXISTS (
      SELECT 1 FROM empleados e WHERE e.id = bajas_vitaly.empleado_id AND e.id_sociedad = my_scope_society_id()
    )
  );
