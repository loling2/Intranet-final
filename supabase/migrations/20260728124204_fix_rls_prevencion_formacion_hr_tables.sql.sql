-- ── calidad_documentos: keep existing select, fix insert/update/delete ──
DROP POLICY IF EXISTS "delete_calidad_documentos" ON calidad_documentos;
DROP POLICY IF EXISTS "insert_calidad_documentos" ON calidad_documentos;
DROP POLICY IF EXISTS "update_calidad_documentos" ON calidad_documentos;
CREATE POLICY "insert_calidad_documentos" ON calidad_documentos FOR INSERT
  TO authenticated WITH CHECK (public.is_admin() OR public.get_my_role() = 'calidad');
CREATE POLICY "update_calidad_documentos" ON calidad_documentos FOR UPDATE
  TO authenticated USING (public.is_admin() OR public.get_my_role() = 'calidad') WITH CHECK (public.is_admin() OR public.get_my_role() = 'calidad');
CREATE POLICY "delete_calidad_documentos" ON calidad_documentos FOR DELETE
  TO authenticated USING (public.is_admin() OR public.get_my_role() = 'calidad');

-- ── departamentos_prl ──
DROP POLICY IF EXISTS "delete_departamentos_prl" ON departamentos_prl;
DROP POLICY IF EXISTS "insert_departamentos_prl" ON departamentos_prl;
DROP POLICY IF EXISTS "select_departamentos_prl" ON departamentos_prl;
DROP POLICY IF EXISTS "update_departamentos_prl" ON departamentos_prl;
CREATE POLICY "select_departamentos_prl" ON departamentos_prl FOR SELECT
  TO authenticated USING (public.is_staff());
CREATE POLICY "insert_departamentos_prl" ON departamentos_prl FOR INSERT
  TO authenticated WITH CHECK (public.is_admin() OR public.is_prevencion());
CREATE POLICY "update_departamentos_prl" ON departamentos_prl FOR UPDATE
  TO authenticated USING (public.is_admin() OR public.is_prevencion()) WITH CHECK (public.is_admin() OR public.is_prevencion());
CREATE POLICY "delete_departamentos_prl" ON departamentos_prl FOR DELETE
  TO authenticated USING (public.is_admin() OR public.is_prevencion());

-- ── empleados_departamentos_prl ──
DROP POLICY IF EXISTS "delete_empleados_departamentos_prl" ON empleados_departamentos_prl;
DROP POLICY IF EXISTS "insert_empleados_departamentos_prl" ON empleados_departamentos_prl;
DROP POLICY IF EXISTS "select_empleados_departamentos_prl" ON empleados_departamentos_prl;
DROP POLICY IF EXISTS "update_empleados_departamentos_prl" ON empleados_departamentos_prl;
CREATE POLICY "select_empleados_departamentos_prl" ON empleados_departamentos_prl FOR SELECT
  TO authenticated USING (public.is_staff());
CREATE POLICY "insert_empleados_departamentos_prl" ON empleados_departamentos_prl FOR INSERT
  TO authenticated WITH CHECK (public.is_admin() OR public.is_prevencion());
CREATE POLICY "update_empleados_departamentos_prl" ON empleados_departamentos_prl FOR UPDATE
  TO authenticated USING (public.is_admin() OR public.is_prevencion()) WITH CHECK (public.is_admin() OR public.is_prevencion());
CREATE POLICY "delete_empleados_departamentos_prl" ON empleados_departamentos_prl FOR DELETE
  TO authenticated USING (public.is_admin() OR public.is_prevencion());

-- ── prl_folder_departamentos ──
DROP POLICY IF EXISTS "delete_prl_folder_departamentos" ON prl_folder_departamentos;
DROP POLICY IF EXISTS "insert_prl_folder_departamentos" ON prl_folder_departamentos;
DROP POLICY IF EXISTS "select_prl_folder_departamentos" ON prl_folder_departamentos;
DROP POLICY IF EXISTS "update_prl_folder_departamentos" ON prl_folder_departamentos;
CREATE POLICY "select_prl_folder_departamentos" ON prl_folder_departamentos FOR SELECT
  TO authenticated USING (public.is_staff());
CREATE POLICY "insert_prl_folder_departamentos" ON prl_folder_departamentos FOR INSERT
  TO authenticated WITH CHECK (public.is_admin() OR public.is_prevencion());
CREATE POLICY "update_prl_folder_departamentos" ON prl_folder_departamentos FOR UPDATE
  TO authenticated USING (public.is_admin() OR public.is_prevencion()) WITH CHECK (public.is_admin() OR public.is_prevencion());
CREATE POLICY "delete_prl_folder_departamentos" ON prl_folder_departamentos FOR DELETE
  TO authenticated USING (public.is_admin() OR public.is_prevencion());

-- ── examenes: drop old true policies, keep is_admin_or_rrhh ones, add formacion ──
DROP POLICY IF EXISTS "formacion_delete_examenes" ON examenes;
DROP POLICY IF EXISTS "formacion_insert_examenes" ON examenes;
DROP POLICY IF EXISTS "formacion_select_examenes" ON examenes;
DROP POLICY IF EXISTS "formacion_update_examenes" ON examenes;
DROP POLICY IF EXISTS "exam_select_auth" ON examenes;
-- Keep exam_insert_admin, exam_update_admin, exam_delete_admin (already use is_admin_or_rrhh)
-- Add formacion access
CREATE POLICY "formacion_select_examenes" ON examenes FOR SELECT
  TO authenticated USING (public.is_staff());
CREATE POLICY "formacion_insert_examenes" ON examenes FOR INSERT
  TO authenticated WITH CHECK (public.is_admin() OR public.get_my_role() = 'formacion' OR public.is_admin_or_rrhh());
CREATE POLICY "formacion_update_examenes" ON examenes FOR UPDATE
  TO authenticated USING (public.is_admin() OR public.get_my_role() = 'formacion' OR public.is_admin_or_rrhh()) WITH CHECK (public.is_admin() OR public.get_my_role() = 'formacion' OR public.is_admin_or_rrhh());
CREATE POLICY "formacion_delete_examenes" ON examenes FOR DELETE
  TO authenticated USING (public.is_admin() OR public.get_my_role() = 'formacion' OR public.is_admin_or_rrhh());

-- ── examen_asignaciones ──
DROP POLICY IF EXISTS "formacion_delete_asignaciones" ON examen_asignaciones;
DROP POLICY IF EXISTS "formacion_insert_asignaciones" ON examen_asignaciones;
DROP POLICY IF EXISTS "formacion_select_asignaciones" ON examen_asignaciones;
DROP POLICY IF EXISTS "formacion_update_asignaciones" ON examen_asignaciones;
CREATE POLICY "select_examen_asignaciones" ON examen_asignaciones FOR SELECT
  TO authenticated USING (public.is_staff());
CREATE POLICY "insert_examen_asignaciones" ON examen_asignaciones FOR INSERT
  TO authenticated WITH CHECK (public.is_admin() OR public.get_my_role() = 'formacion' OR public.is_admin_or_rrhh());
CREATE POLICY "update_examen_asignaciones" ON examen_asignaciones FOR UPDATE
  TO authenticated USING (public.is_admin() OR public.get_my_role() = 'formacion' OR public.is_admin_or_rrhh()) WITH CHECK (public.is_admin() OR public.get_my_role() = 'formacion' OR public.is_admin_or_rrhh());
CREATE POLICY "delete_examen_asignaciones" ON examen_asignaciones FOR DELETE
  TO authenticated USING (public.is_admin() OR public.get_my_role() = 'formacion' OR public.is_admin_or_rrhh());

-- ── bajas_temporales ──
DROP POLICY IF EXISTS "delete_bajas_temporales" ON bajas_temporales;
DROP POLICY IF EXISTS "insert_bajas_temporales" ON bajas_temporales;
DROP POLICY IF EXISTS "select_bajas_temporales" ON bajas_temporales;
DROP POLICY IF EXISTS "update_bajas_temporales" ON bajas_temporales;
CREATE POLICY "select_bajas_temporales" ON bajas_temporales FOR SELECT
  TO authenticated USING (public.is_admin_or_supervisor() OR public.is_prevencion());
CREATE POLICY "insert_bajas_temporales" ON bajas_temporales FOR INSERT
  TO authenticated WITH CHECK (public.is_admin_or_supervisor() OR public.is_prevencion());
CREATE POLICY "update_bajas_temporales" ON bajas_temporales FOR UPDATE
  TO authenticated USING (public.is_admin_or_supervisor() OR public.is_prevencion()) WITH CHECK (public.is_admin_or_supervisor() OR public.is_prevencion());
CREATE POLICY "delete_bajas_temporales" ON bajas_temporales FOR DELETE
  TO authenticated USING (public.is_admin_or_supervisor() OR public.is_prevencion());

-- ── sustituciones ──
DROP POLICY IF EXISTS "delete_sustituciones" ON sustituciones;
DROP POLICY IF EXISTS "insert_sustituciones" ON sustituciones;
DROP POLICY IF EXISTS "select_sustituciones" ON sustituciones;
DROP POLICY IF EXISTS "update_sustituciones" ON sustituciones;
CREATE POLICY "select_sustituciones" ON sustituciones FOR SELECT
  TO authenticated USING (public.is_admin_or_supervisor() OR public.is_prevencion());
CREATE POLICY "insert_sustituciones" ON sustituciones FOR INSERT
  TO authenticated WITH CHECK (public.is_admin_or_supervisor() OR public.is_prevencion());
CREATE POLICY "update_sustituciones" ON sustituciones FOR UPDATE
  TO authenticated USING (public.is_admin_or_supervisor() OR public.is_prevencion()) WITH CHECK (public.is_admin_or_supervisor() OR public.is_prevencion());
CREATE POLICY "delete_sustituciones" ON sustituciones FOR DELETE
  TO authenticated USING (public.is_admin_or_supervisor() OR public.is_prevencion());

-- ── balance_finalizaciones ──
DROP POLICY IF EXISTS "bf_delete" ON balance_finalizaciones;
DROP POLICY IF EXISTS "bf_insert" ON balance_finalizaciones;
DROP POLICY IF EXISTS "bf_select" ON balance_finalizaciones;
DROP POLICY IF EXISTS "bf_update" ON balance_finalizaciones;
CREATE POLICY "bf_select" ON balance_finalizaciones FOR SELECT
  TO authenticated USING (public.is_admin_or_supervisor());
CREATE POLICY "bf_insert" ON balance_finalizaciones FOR INSERT
  TO authenticated WITH CHECK (public.is_admin_or_supervisor());
CREATE POLICY "bf_update" ON balance_finalizaciones FOR UPDATE
  TO authenticated USING (public.is_admin_or_supervisor()) WITH CHECK (public.is_admin_or_supervisor());
CREATE POLICY "bf_delete" ON balance_finalizaciones FOR DELETE
  TO authenticated USING (public.is_admin_or_supervisor());

-- ── liquidaciones_horas ──
DROP POLICY IF EXISTS "liquidaciones_delete" ON liquidaciones_horas;
DROP POLICY IF EXISTS "liquidaciones_insert" ON liquidaciones_horas;
DROP POLICY IF EXISTS "liquidaciones_select" ON liquidaciones_horas;
DROP POLICY IF EXISTS "liquidaciones_update" ON liquidaciones_horas;
CREATE POLICY "liquidaciones_select" ON liquidaciones_horas FOR SELECT
  TO authenticated USING (public.is_admin_or_supervisor());
CREATE POLICY "liquidaciones_insert" ON liquidaciones_horas FOR INSERT
  TO authenticated WITH CHECK (public.is_admin_or_supervisor());
CREATE POLICY "liquidaciones_update" ON liquidaciones_horas FOR UPDATE
  TO authenticated USING (public.is_admin_or_supervisor()) WITH CHECK (public.is_admin_or_supervisor());
CREATE POLICY "liquidaciones_delete" ON liquidaciones_horas FOR DELETE
  TO authenticated USING (public.is_admin_or_supervisor());
