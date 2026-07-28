-- ── audit_logs: admin/rrhh can read, any authenticated can insert (for audit trail) ──
DROP POLICY IF EXISTS "Allow all select on audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "Allow all inserts on audit_logs" ON audit_logs;
CREATE POLICY "select_audit_logs" ON audit_logs FOR SELECT
  TO authenticated USING (public.is_admin_or_rrhh());
CREATE POLICY "insert_audit_logs" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- ── email_plantillas: only admin/rrhh ──
DROP POLICY IF EXISTS "select_email_plantillas" ON email_plantillas;
DROP POLICY IF EXISTS "insert_email_plantillas" ON email_plantillas;
DROP POLICY IF EXISTS "update_email_plantillas" ON email_plantillas;
DROP POLICY IF EXISTS "delete_email_plantillas" ON email_plantillas;
CREATE POLICY "select_email_plantillas" ON email_plantillas FOR SELECT
  TO authenticated USING (public.is_admin_or_rrhh());
CREATE POLICY "insert_email_plantillas" ON email_plantillas FOR INSERT
  TO authenticated WITH CHECK (public.is_admin_or_rrhh());
CREATE POLICY "update_email_plantillas" ON email_plantillas FOR UPDATE
  TO authenticated USING (public.is_admin_or_rrhh()) WITH CHECK (public.is_admin_or_rrhh());
CREATE POLICY "delete_email_plantillas" ON email_plantillas FOR DELETE
  TO authenticated USING (public.is_admin_or_rrhh());

-- ── role_tab_permissions: only admin ──
DROP POLICY IF EXISTS "admin_select_role_tab_permissions" ON role_tab_permissions;
CREATE POLICY "admin_select_role_tab_permissions" ON role_tab_permissions FOR SELECT
  TO authenticated USING (public.is_admin());

-- ── custom_profiles: admin/rrhh can read ──
DROP POLICY IF EXISTS "select_custom_profiles" ON custom_profiles;
CREATE POLICY "select_custom_profiles" ON custom_profiles FOR SELECT
  TO authenticated USING (public.is_admin_or_rrhh());

-- ── app_roles: any authenticated can read (reference table) ──
-- This is a reference table, reading is safe. Keep true but scope to authenticated only.
DROP POLICY IF EXISTS "Authenticated users can read roles" ON app_roles;
CREATE POLICY "Authenticated users can read roles" ON app_roles FOR SELECT
  TO authenticated USING (true);

-- ── sociedades: any authenticated can read (reference table) ──
DROP POLICY IF EXISTS "Any authenticated can view sociedades" ON sociedades;
CREATE POLICY "Any authenticated can view sociedades" ON sociedades FOR SELECT
  TO authenticated USING (true);

-- ── tags: any authenticated can read (reference table) ──
DROP POLICY IF EXISTS "Any authenticated can view tags" ON tags;
CREATE POLICY "Any authenticated can view tags" ON tags FOR SELECT
  TO authenticated USING (true);

-- ── departamentos: any authenticated can read (reference table) ──
DROP POLICY IF EXISTS "Authenticated users can view departamentos" ON departamentos;
CREATE POLICY "Authenticated users can view departamentos" ON departamentos FOR SELECT
  TO authenticated USING (true);

-- ── departamento_miembros: any authenticated can read (reference table) ──
DROP POLICY IF EXISTS "Authenticated users can view departamento_miembros" ON departamento_miembros;
CREATE POLICY "Authenticated users can view departamento_miembros" ON departamento_miembros FOR SELECT
  TO authenticated USING (true);

-- ── ui_settings: anyone can read (public config for login page) ──
DROP POLICY IF EXISTS "Anyone can read ui_settings" ON ui_settings;
CREATE POLICY "Anyone can read ui_settings" ON ui_settings FOR SELECT
  TO anon, authenticated USING (true);

-- ── preguntas: any authenticated can read (formacion reference) ──
DROP POLICY IF EXISTS "pregunta_select_auth" ON preguntas;
CREATE POLICY "pregunta_select_auth" ON preguntas FOR SELECT
  TO authenticated USING (true);
