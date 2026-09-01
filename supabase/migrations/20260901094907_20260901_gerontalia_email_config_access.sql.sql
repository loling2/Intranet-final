-- Allow gerontalia-scoped roles (rrhh_gerontalia, prevencion_gerontalia, supervisor_gerontalia)
-- to read email configuration (cuentas SMTP, plantillas, notificaciones).
-- These are privileged staff users who need to manage email for their society scope.

-- ── email_cuentas: SELECT for gerontalia roles ──
DROP POLICY IF EXISTS "gerontalia_select_email_cuentas" ON email_cuentas;
CREATE POLICY "gerontalia_select_email_cuentas" ON email_cuentas
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('rrhh_gerontalia', 'prevencion_gerontalia', 'supervisor_gerontalia')
        AND user_profiles.activo = true
    )
  );

-- ── email_plantillas: full CRUD for gerontalia roles ──
DROP POLICY IF EXISTS "gerontalia_select_email_plantillas" ON email_plantillas;
CREATE POLICY "gerontalia_select_email_plantillas" ON email_plantillas
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('rrhh_gerontalia', 'prevencion_gerontalia', 'supervisor_gerontalia')
        AND user_profiles.activo = true
    )
  );

DROP POLICY IF EXISTS "gerontalia_insert_email_plantillas" ON email_plantillas;
CREATE POLICY "gerontalia_insert_email_plantillas" ON email_plantillas
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('rrhh_gerontalia', 'prevencion_gerontalia')
        AND user_profiles.activo = true
    )
  );

DROP POLICY IF EXISTS "gerontalia_update_email_plantillas" ON email_plantillas;
CREATE POLICY "gerontalia_update_email_plantillas" ON email_plantillas
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('rrhh_gerontalia', 'prevencion_gerontalia')
        AND user_profiles.activo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('rrhh_gerontalia', 'prevencion_gerontalia')
        AND user_profiles.activo = true
    )
  );

DROP POLICY IF EXISTS "gerontalia_delete_email_plantillas" ON email_plantillas;
CREATE POLICY "gerontalia_delete_email_plantillas" ON email_plantillas
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('rrhh_gerontalia', 'prevencion_gerontalia')
        AND user_profiles.activo = true
    )
  );

-- ── email_notificaciones: full CRUD for gerontalia roles ──
DROP POLICY IF EXISTS "gerontalia_select_email_notificaciones" ON email_notificaciones;
CREATE POLICY "gerontalia_select_email_notificaciones" ON email_notificaciones
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('rrhh_gerontalia', 'prevencion_gerontalia', 'supervisor_gerontalia')
        AND user_profiles.activo = true
    )
  );

DROP POLICY IF EXISTS "gerontalia_insert_email_notificaciones" ON email_notificaciones;
CREATE POLICY "gerontalia_insert_email_notificaciones" ON email_notificaciones
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('rrhh_gerontalia', 'prevencion_gerontalia')
        AND user_profiles.activo = true
    )
  );

DROP POLICY IF EXISTS "gerontalia_update_email_notificaciones" ON email_notificaciones;
CREATE POLICY "gerontalia_update_email_notificaciones" ON email_notificaciones
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('rrhh_gerontalia', 'prevencion_gerontalia')
        AND user_profiles.activo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('rrhh_gerontalia', 'prevencion_gerontalia')
        AND user_profiles.activo = true
    )
  );

DROP POLICY IF EXISTS "gerontalia_delete_email_notificaciones" ON email_notificaciones;
CREATE POLICY "gerontalia_delete_email_notificaciones" ON email_notificaciones
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('rrhh_gerontalia', 'prevencion_gerontalia')
        AND user_profiles.activo = true
    )
  );
