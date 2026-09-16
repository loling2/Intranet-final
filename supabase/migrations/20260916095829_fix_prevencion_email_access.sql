-- Allow prevencion role to read email_plantillas and email_cuentas
-- so they can send access emails from the Prevencion panel

CREATE POLICY "prevencion_select_email_plantillas"
  ON email_plantillas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'prevencion'
        AND user_profiles.activo = true
    )
  );

CREATE POLICY "prevencion_select_email_cuentas"
  ON email_cuentas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'prevencion'
        AND user_profiles.activo = true
    )
  );
