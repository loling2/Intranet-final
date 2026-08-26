-- Part 2: RLS policies for Gerontalia-scoped roles
-- id_sociedad is UUID; id_sociedad_secundaria is TEXT; society_id varies by table.

-- empleados (id_sociedad UUID)
DROP POLICY IF EXISTS "gerontalia_select_empleados" ON empleados;
CREATE POLICY "gerontalia_select_empleados" ON empleados FOR SELECT TO authenticated
  USING (is_gerontalia_scoped() AND id_sociedad = my_scope_society_id());
DROP POLICY IF EXISTS "gerontalia_insert_empleados" ON empleados;
CREATE POLICY "gerontalia_insert_empleados" ON empleados FOR INSERT TO authenticated
  WITH CHECK (is_gerontalia_scoped() AND id_sociedad = my_scope_society_id());
DROP POLICY IF EXISTS "gerontalia_update_empleados" ON empleados;
CREATE POLICY "gerontalia_update_empleados" ON empleados FOR UPDATE TO authenticated
  USING (is_gerontalia_scoped() AND id_sociedad = my_scope_society_id())
  WITH CHECK (is_gerontalia_scoped() AND id_sociedad = my_scope_society_id());
DROP POLICY IF EXISTS "gerontalia_delete_empleados" ON empleados;
CREATE POLICY "gerontalia_delete_empleados" ON empleados FOR DELETE TO authenticated
  USING (is_gerontalia_scoped() AND id_sociedad = my_scope_society_id());

-- centros (id_sociedad UUID)
DROP POLICY IF EXISTS "gerontalia_select_centros" ON centros;
CREATE POLICY "gerontalia_select_centros" ON centros FOR SELECT TO authenticated
  USING (is_gerontalia_scoped() AND id_sociedad = my_scope_society_id());
DROP POLICY IF EXISTS "gerontalia_insert_centros" ON centros;
CREATE POLICY "gerontalia_insert_centros" ON centros FOR INSERT TO authenticated
  WITH CHECK (is_gerontalia_scoped() AND id_sociedad = my_scope_society_id());
DROP POLICY IF EXISTS "gerontalia_update_centros" ON centros;
CREATE POLICY "gerontalia_update_centros" ON centros FOR UPDATE TO authenticated
  USING (is_gerontalia_scoped() AND id_sociedad = my_scope_society_id())
  WITH CHECK (is_gerontalia_scoped() AND id_sociedad = my_scope_society_id());
DROP POLICY IF EXISTS "gerontalia_delete_centros" ON centros;
CREATE POLICY "gerontalia_delete_centros" ON centros FOR DELETE TO authenticated
  USING (is_gerontalia_scoped() AND id_sociedad = my_scope_society_id());

-- fichajes (join via empleado_id)
DROP POLICY IF EXISTS "gerontalia_select_fichajes" ON fichajes;
CREATE POLICY "gerontalia_select_fichajes" ON fichajes FOR SELECT TO authenticated
  USING (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM empleados e WHERE e.id = fichajes.empleado_id AND e.id_sociedad = my_scope_society_id()));
DROP POLICY IF EXISTS "gerontalia_insert_fichajes" ON fichajes;
CREATE POLICY "gerontalia_insert_fichajes" ON fichajes FOR INSERT TO authenticated
  WITH CHECK (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM empleados e WHERE e.id = fichajes.empleado_id AND e.id_sociedad = my_scope_society_id()));
DROP POLICY IF EXISTS "gerontalia_update_fichajes" ON fichajes;
CREATE POLICY "gerontalia_update_fichajes" ON fichajes FOR UPDATE TO authenticated
  USING (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM empleados e WHERE e.id = fichajes.empleado_id AND e.id_sociedad = my_scope_society_id()))
  WITH CHECK (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM empleados e WHERE e.id = fichajes.empleado_id AND e.id_sociedad = my_scope_society_id()));
DROP POLICY IF EXISTS "gerontalia_delete_fichajes" ON fichajes;
CREATE POLICY "gerontalia_delete_fichajes" ON fichajes FOR DELETE TO authenticated
  USING (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM empleados e WHERE e.id = fichajes.empleado_id AND e.id_sociedad = my_scope_society_id()));

-- prl_documents (society_id UUID)
DROP POLICY IF EXISTS "gerontalia_select_prl_documents" ON prl_documents;
CREATE POLICY "gerontalia_select_prl_documents" ON prl_documents FOR SELECT TO authenticated
  USING (is_gerontalia_scoped() AND society_id = my_scope_society_id());
DROP POLICY IF EXISTS "gerontalia_insert_prl_documents" ON prl_documents;
CREATE POLICY "gerontalia_insert_prl_documents" ON prl_documents FOR INSERT TO authenticated
  WITH CHECK (is_gerontalia_scoped() AND society_id = my_scope_society_id());
DROP POLICY IF EXISTS "gerontalia_update_prl_documents" ON prl_documents;
CREATE POLICY "gerontalia_update_prl_documents" ON prl_documents FOR UPDATE TO authenticated
  USING (is_gerontalia_scoped() AND society_id = my_scope_society_id())
  WITH CHECK (is_gerontalia_scoped() AND society_id = my_scope_society_id());
DROP POLICY IF EXISTS "gerontalia_delete_prl_documents" ON prl_documents;
CREATE POLICY "gerontalia_delete_prl_documents" ON prl_documents FOR DELETE TO authenticated
  USING (is_gerontalia_scoped() AND society_id = my_scope_society_id());

-- nominas (society_id TEXT)
DROP POLICY IF EXISTS "gerontalia_select_nominas" ON nominas;
CREATE POLICY "gerontalia_select_nominas" ON nominas FOR SELECT TO authenticated
  USING (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text);
DROP POLICY IF EXISTS "gerontalia_insert_nominas" ON nominas;
CREATE POLICY "gerontalia_insert_nominas" ON nominas FOR INSERT TO authenticated
  WITH CHECK (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text);
DROP POLICY IF EXISTS "gerontalia_update_nominas" ON nominas;
CREATE POLICY "gerontalia_update_nominas" ON nominas FOR UPDATE TO authenticated
  USING (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text)
  WITH CHECK (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text);
DROP POLICY IF EXISTS "gerontalia_delete_nominas" ON nominas;
CREATE POLICY "gerontalia_delete_nominas" ON nominas FOR DELETE TO authenticated
  USING (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text);

-- bajas_temporales (join via empleado_id)
DROP POLICY IF EXISTS "gerontalia_select_bajas" ON bajas_temporales;
CREATE POLICY "gerontalia_select_bajas" ON bajas_temporales FOR SELECT TO authenticated
  USING (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM empleados e WHERE e.id = bajas_temporales.empleado_id AND e.id_sociedad = my_scope_society_id()));
DROP POLICY IF EXISTS "gerontalia_insert_bajas" ON bajas_temporales;
CREATE POLICY "gerontalia_insert_bajas" ON bajas_temporales FOR INSERT TO authenticated
  WITH CHECK (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM empleados e WHERE e.id = bajas_temporales.empleado_id AND e.id_sociedad = my_scope_society_id()));
DROP POLICY IF EXISTS "gerontalia_update_bajas" ON bajas_temporales;
CREATE POLICY "gerontalia_update_bajas" ON bajas_temporales FOR UPDATE TO authenticated
  USING (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM empleados e WHERE e.id = bajas_temporales.empleado_id AND e.id_sociedad = my_scope_society_id()))
  WITH CHECK (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM empleados e WHERE e.id = bajas_temporales.empleado_id AND e.id_sociedad = my_scope_society_id()));
DROP POLICY IF EXISTS "gerontalia_delete_bajas" ON bajas_temporales;
CREATE POLICY "gerontalia_delete_bajas" ON bajas_temporales FOR DELETE TO authenticated
  USING (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM empleados e WHERE e.id = bajas_temporales.empleado_id AND e.id_sociedad = my_scope_society_id()));

-- sustituciones (join via baja_id)
DROP POLICY IF EXISTS "gerontalia_select_sustituciones" ON sustituciones;
CREATE POLICY "gerontalia_select_sustituciones" ON sustituciones FOR SELECT TO authenticated
  USING (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM bajas_temporales bt JOIN empleados e ON e.id = bt.empleado_id
    WHERE bt.id = sustituciones.baja_id AND e.id_sociedad = my_scope_society_id()));
DROP POLICY IF EXISTS "gerontalia_insert_sustituciones" ON sustituciones;
CREATE POLICY "gerontalia_insert_sustituciones" ON sustituciones FOR INSERT TO authenticated
  WITH CHECK (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM bajas_temporales bt JOIN empleados e ON e.id = bt.empleado_id
    WHERE bt.id = sustituciones.baja_id AND e.id_sociedad = my_scope_society_id()));
DROP POLICY IF EXISTS "gerontalia_update_sustituciones" ON sustituciones;
CREATE POLICY "gerontalia_update_sustituciones" ON sustituciones FOR UPDATE TO authenticated
  USING (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM bajas_temporales bt JOIN empleados e ON e.id = bt.empleado_id
    WHERE bt.id = sustituciones.baja_id AND e.id_sociedad = my_scope_society_id()))
  WITH CHECK (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM bajas_temporales bt JOIN empleados e ON e.id = bt.empleado_id
    WHERE bt.id = sustituciones.baja_id AND e.id_sociedad = my_scope_society_id()));
DROP POLICY IF EXISTS "gerontalia_delete_sustituciones" ON sustituciones;
CREATE POLICY "gerontalia_delete_sustituciones" ON sustituciones FOR DELETE TO authenticated
  USING (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM bajas_temporales bt JOIN empleados e ON e.id = bt.empleado_id
    WHERE bt.id = sustituciones.baja_id AND e.id_sociedad = my_scope_society_id()));

-- dispositivos (society_id TEXT)
DROP POLICY IF EXISTS "gerontalia_select_dispositivos" ON dispositivos;
CREATE POLICY "gerontalia_select_dispositivos" ON dispositivos FOR SELECT TO authenticated
  USING (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text);
DROP POLICY IF EXISTS "gerontalia_insert_dispositivos" ON dispositivos;
CREATE POLICY "gerontalia_insert_dispositivos" ON dispositivos FOR INSERT TO authenticated
  WITH CHECK (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text);
DROP POLICY IF EXISTS "gerontalia_update_dispositivos" ON dispositivos;
CREATE POLICY "gerontalia_update_dispositivos" ON dispositivos FOR UPDATE TO authenticated
  USING (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text)
  WITH CHECK (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text);
DROP POLICY IF EXISTS "gerontalia_delete_dispositivos" ON dispositivos;
CREATE POLICY "gerontalia_delete_dispositivos" ON dispositivos FOR DELETE TO authenticated
  USING (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text);

-- incidencias (society_id TEXT)
DROP POLICY IF EXISTS "gerontalia_select_incidencias" ON incidencias;
CREATE POLICY "gerontalia_select_incidencias" ON incidencias FOR SELECT TO authenticated
  USING (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text);
DROP POLICY IF EXISTS "gerontalia_insert_incidencias" ON incidencias;
CREATE POLICY "gerontalia_insert_incidencias" ON incidencias FOR INSERT TO authenticated
  WITH CHECK (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text);
DROP POLICY IF EXISTS "gerontalia_update_incidencias" ON incidencias;
CREATE POLICY "gerontalia_update_incidencias" ON incidencias FOR UPDATE TO authenticated
  USING (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text)
  WITH CHECK (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text);
DROP POLICY IF EXISTS "gerontalia_delete_incidencias" ON incidencias;
CREATE POLICY "gerontalia_delete_incidencias" ON incidencias FOR DELETE TO authenticated
  USING (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text);

-- asignaciones (join via id_empleado)
DROP POLICY IF EXISTS "gerontalia_select_asignaciones" ON asignaciones;
CREATE POLICY "gerontalia_select_asignaciones" ON asignaciones FOR SELECT TO authenticated
  USING (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM empleados e WHERE e.id = asignaciones.id_empleado AND e.id_sociedad = my_scope_society_id()));
DROP POLICY IF EXISTS "gerontalia_insert_asignaciones" ON asignaciones;
CREATE POLICY "gerontalia_insert_asignaciones" ON asignaciones FOR INSERT TO authenticated
  WITH CHECK (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM empleados e WHERE e.id = asignaciones.id_empleado AND e.id_sociedad = my_scope_society_id()));
DROP POLICY IF EXISTS "gerontalia_update_asignaciones" ON asignaciones;
CREATE POLICY "gerontalia_update_asignaciones" ON asignaciones FOR UPDATE TO authenticated
  USING (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM empleados e WHERE e.id = asignaciones.id_empleado AND e.id_sociedad = my_scope_society_id()))
  WITH CHECK (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM empleados e WHERE e.id = asignaciones.id_empleado AND e.id_sociedad = my_scope_society_id()));
DROP POLICY IF EXISTS "gerontalia_delete_asignaciones" ON asignaciones;
CREATE POLICY "gerontalia_delete_asignaciones" ON asignaciones FOR DELETE TO authenticated
  USING (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM empleados e WHERE e.id = asignaciones.id_empleado AND e.id_sociedad = my_scope_society_id()));

-- vacation_balances (society_id TEXT)
DROP POLICY IF EXISTS "gerontalia_select_vacation_balances" ON vacation_balances;
CREATE POLICY "gerontalia_select_vacation_balances" ON vacation_balances FOR SELECT TO authenticated
  USING (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text);
DROP POLICY IF EXISTS "gerontalia_insert_vacation_balances" ON vacation_balances;
CREATE POLICY "gerontalia_insert_vacation_balances" ON vacation_balances FOR INSERT TO authenticated
  WITH CHECK (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text);
DROP POLICY IF EXISTS "gerontalia_update_vacation_balances" ON vacation_balances;
CREATE POLICY "gerontalia_update_vacation_balances" ON vacation_balances FOR UPDATE TO authenticated
  USING (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text)
  WITH CHECK (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text);
DROP POLICY IF EXISTS "gerontalia_delete_vacation_balances" ON vacation_balances;
CREATE POLICY "gerontalia_delete_vacation_balances" ON vacation_balances FOR DELETE TO authenticated
  USING (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text);

-- fichajes_correcciones (join via fichaje_id)
DROP POLICY IF EXISTS "gerontalia_select_correcciones" ON fichajes_correcciones;
CREATE POLICY "gerontalia_select_correcciones" ON fichajes_correcciones FOR SELECT TO authenticated
  USING (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM fichajes f JOIN empleados e ON e.id = f.empleado_id
    WHERE f.id = fichajes_correcciones.fichaje_id AND e.id_sociedad = my_scope_society_id()));
DROP POLICY IF EXISTS "gerontalia_insert_correcciones" ON fichajes_correcciones;
CREATE POLICY "gerontalia_insert_correcciones" ON fichajes_correcciones FOR INSERT TO authenticated
  WITH CHECK (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM fichajes f JOIN empleados e ON e.id = f.empleado_id
    WHERE f.id = fichajes_correcciones.fichaje_id AND e.id_sociedad = my_scope_society_id()));
DROP POLICY IF EXISTS "gerontalia_update_correcciones" ON fichajes_correcciones;
CREATE POLICY "gerontalia_update_correcciones" ON fichajes_correcciones FOR UPDATE TO authenticated
  USING (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM fichajes f JOIN empleados e ON e.id = f.empleado_id
    WHERE f.id = fichajes_correcciones.fichaje_id AND e.id_sociedad = my_scope_society_id()))
  WITH CHECK (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM fichajes f JOIN empleados e ON e.id = f.empleado_id
    WHERE f.id = fichajes_correcciones.fichaje_id AND e.id_sociedad = my_scope_society_id()));
DROP POLICY IF EXISTS "gerontalia_delete_correcciones" ON fichajes_correcciones;
CREATE POLICY "gerontalia_delete_correcciones" ON fichajes_correcciones FOR DELETE TO authenticated
  USING (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM fichajes f JOIN empleados e ON e.id = f.empleado_id
    WHERE f.id = fichajes_correcciones.fichaje_id AND e.id_sociedad = my_scope_society_id()));

-- audit_logs (society_id TEXT)
DROP POLICY IF EXISTS "gerontalia_select_audit_logs" ON audit_logs;
CREATE POLICY "gerontalia_select_audit_logs" ON audit_logs FOR SELECT TO authenticated
  USING (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text);
DROP POLICY IF EXISTS "gerontalia_insert_audit_logs" ON audit_logs;
CREATE POLICY "gerontalia_insert_audit_logs" ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text);

-- employee_documents (society_id TEXT)
DROP POLICY IF EXISTS "gerontalia_select_employee_documents" ON employee_documents;
CREATE POLICY "gerontalia_select_employee_documents" ON employee_documents FOR SELECT TO authenticated
  USING (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text);
DROP POLICY IF EXISTS "gerontalia_insert_employee_documents" ON employee_documents;
CREATE POLICY "gerontalia_insert_employee_documents" ON employee_documents FOR INSERT TO authenticated
  WITH CHECK (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text);
DROP POLICY IF EXISTS "gerontalia_update_employee_documents" ON employee_documents;
CREATE POLICY "gerontalia_update_employee_documents" ON employee_documents FOR UPDATE TO authenticated
  USING (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text)
  WITH CHECK (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text);
DROP POLICY IF EXISTS "gerontalia_delete_employee_documents" ON employee_documents;
CREATE POLICY "gerontalia_delete_employee_documents" ON employee_documents FOR DELETE TO authenticated
  USING (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text);

-- kiosk_devices (join via centro_id)
DROP POLICY IF EXISTS "gerontalia_select_kiosk_devices" ON kiosk_devices;
CREATE POLICY "gerontalia_select_kiosk_devices" ON kiosk_devices FOR SELECT TO authenticated
  USING (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM centros c WHERE c.id = kiosk_devices.centro_id AND c.id_sociedad = my_scope_society_id()));
DROP POLICY IF EXISTS "gerontalia_insert_kiosk_devices" ON kiosk_devices;
CREATE POLICY "gerontalia_insert_kiosk_devices" ON kiosk_devices FOR INSERT TO authenticated
  WITH CHECK (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM centros c WHERE c.id = kiosk_devices.centro_id AND c.id_sociedad = my_scope_society_id()));
DROP POLICY IF EXISTS "gerontalia_update_kiosk_devices" ON kiosk_devices;
CREATE POLICY "gerontalia_update_kiosk_devices" ON kiosk_devices FOR UPDATE TO authenticated
  USING (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM centros c WHERE c.id = kiosk_devices.centro_id AND c.id_sociedad = my_scope_society_id()))
  WITH CHECK (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM centros c WHERE c.id = kiosk_devices.centro_id AND c.id_sociedad = my_scope_society_id()));
DROP POLICY IF EXISTS "gerontalia_delete_kiosk_devices" ON kiosk_devices;
CREATE POLICY "gerontalia_delete_kiosk_devices" ON kiosk_devices FOR DELETE TO authenticated
  USING (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM centros c WHERE c.id = kiosk_devices.centro_id AND c.id_sociedad = my_scope_society_id()));

-- vehicles (society_id TEXT)
DROP POLICY IF EXISTS "gerontalia_select_vehicles" ON vehicles;
CREATE POLICY "gerontalia_select_vehicles" ON vehicles FOR SELECT TO authenticated
  USING (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text);
DROP POLICY IF EXISTS "gerontalia_insert_vehicles" ON vehicles;
CREATE POLICY "gerontalia_insert_vehicles" ON vehicles FOR INSERT TO authenticated
  WITH CHECK (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text);
DROP POLICY IF EXISTS "gerontalia_update_vehicles" ON vehicles;
CREATE POLICY "gerontalia_update_vehicles" ON vehicles FOR UPDATE TO authenticated
  USING (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text)
  WITH CHECK (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text);
DROP POLICY IF EXISTS "gerontalia_delete_vehicles" ON vehicles;
CREATE POLICY "gerontalia_delete_vehicles" ON vehicles FOR DELETE TO authenticated
  USING (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text);

-- vehicle_logs (join via vehicle_id)
DROP POLICY IF EXISTS "gerontalia_select_vehicle_logs" ON vehicle_logs;
CREATE POLICY "gerontalia_select_vehicle_logs" ON vehicle_logs FOR SELECT TO authenticated
  USING (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM vehicles v WHERE v.id = vehicle_logs.vehicle_id AND v.society_id = my_scope_society_id()::text));
DROP POLICY IF EXISTS "gerontalia_insert_vehicle_logs" ON vehicle_logs;
CREATE POLICY "gerontalia_insert_vehicle_logs" ON vehicle_logs FOR INSERT TO authenticated
  WITH CHECK (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM vehicles v WHERE v.id = vehicle_logs.vehicle_id AND v.society_id = my_scope_society_id()::text));
DROP POLICY IF EXISTS "gerontalia_update_vehicle_logs" ON vehicle_logs;
CREATE POLICY "gerontalia_update_vehicle_logs" ON vehicle_logs FOR UPDATE TO authenticated
  USING (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM vehicles v WHERE v.id = vehicle_logs.vehicle_id AND v.society_id = my_scope_society_id()::text))
  WITH CHECK (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM vehicles v WHERE v.id = vehicle_logs.vehicle_id AND v.society_id = my_scope_society_id()::text));
DROP POLICY IF EXISTS "gerontalia_delete_vehicle_logs" ON vehicle_logs;
CREATE POLICY "gerontalia_delete_vehicle_logs" ON vehicle_logs FOR DELETE TO authenticated
  USING (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM vehicles v WHERE v.id = vehicle_logs.vehicle_id AND v.society_id = my_scope_society_id()::text));

-- supervisor_asignaciones (join via empleado_id)
DROP POLICY IF EXISTS "gerontalia_select_supervisor_asignaciones" ON supervisor_asignaciones;
CREATE POLICY "gerontalia_select_supervisor_asignaciones" ON supervisor_asignaciones FOR SELECT TO authenticated
  USING (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM empleados e WHERE e.id = supervisor_asignaciones.empleado_id AND e.id_sociedad = my_scope_society_id()));
DROP POLICY IF EXISTS "gerontalia_insert_supervisor_asignaciones" ON supervisor_asignaciones;
CREATE POLICY "gerontalia_insert_supervisor_asignaciones" ON supervisor_asignaciones FOR INSERT TO authenticated
  WITH CHECK (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM empleados e WHERE e.id = supervisor_asignaciones.empleado_id AND e.id_sociedad = my_scope_society_id()));
DROP POLICY IF EXISTS "gerontalia_update_supervisor_asignaciones" ON supervisor_asignaciones;
CREATE POLICY "gerontalia_update_supervisor_asignaciones" ON supervisor_asignaciones FOR UPDATE TO authenticated
  USING (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM empleados e WHERE e.id = supervisor_asignaciones.empleado_id AND e.id_sociedad = my_scope_society_id()))
  WITH CHECK (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM empleados e WHERE e.id = supervisor_asignaciones.empleado_id AND e.id_sociedad = my_scope_society_id()));
DROP POLICY IF EXISTS "gerontalia_delete_supervisor_asignaciones" ON supervisor_asignaciones;
CREATE POLICY "gerontalia_delete_supervisor_asignaciones" ON supervisor_asignaciones FOR DELETE TO authenticated
  USING (is_gerontalia_scoped() AND EXISTS (
    SELECT 1 FROM empleados e WHERE e.id = supervisor_asignaciones.empleado_id AND e.id_sociedad = my_scope_society_id()));

-- user_profiles (id_sociedad UUID, id_sociedad_secundaria TEXT)
DROP POLICY IF EXISTS "gerontalia_select_user_profiles" ON user_profiles;
CREATE POLICY "gerontalia_select_user_profiles" ON user_profiles FOR SELECT TO authenticated
  USING (is_gerontalia_scoped() AND (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM empleados e WHERE e.user_id = user_profiles.id AND e.id_sociedad = my_scope_society_id())
    OR EXISTS (SELECT 1 FROM empleados e WHERE e.user_id = user_profiles.id AND e.id_sociedad_secundaria = my_scope_society_id()::text)
  ));
DROP POLICY IF EXISTS "gerontalia_update_user_profiles" ON user_profiles;
CREATE POLICY "gerontalia_update_user_profiles" ON user_profiles FOR UPDATE TO authenticated
  USING (is_gerontalia_scoped() AND (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM empleados e WHERE e.user_id = user_profiles.id AND e.id_sociedad = my_scope_society_id())
  ))
  WITH CHECK (is_gerontalia_scoped() AND (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM empleados e WHERE e.user_id = user_profiles.id AND e.id_sociedad = my_scope_society_id())
  ));

-- Seed tab permissions
INSERT INTO role_tab_permissions (role, tab_id, enabled)
SELECT 'rrhh_gerontalia', tab_id, enabled FROM role_tab_permissions WHERE role = 'rrhh'
ON CONFLICT (role, tab_id) DO NOTHING;

INSERT INTO role_tab_permissions (role, tab_id, enabled)
SELECT 'administrador_gerontalia', tab_id, enabled FROM role_tab_permissions WHERE role = 'rrhh'
ON CONFLICT (role, tab_id) DO NOTHING;

INSERT INTO role_tab_permissions (role, tab_id, enabled)
SELECT 'supervisor_gerontalia', tab_id, enabled FROM role_tab_permissions WHERE role = 'supervisor'
ON CONFLICT (role, tab_id) DO NOTHING;
