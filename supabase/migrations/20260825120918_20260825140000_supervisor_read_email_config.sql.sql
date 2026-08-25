-- Allow supervisors to read email_plantillas and email_cuentas
-- so they can send access emails from the SupervisorEmpleados view.

CREATE POLICY "supervisor_select_email_plantillas" ON email_plantillas
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'supervisor' AND activo = true
    )
  );

CREATE POLICY "supervisor_select_email_cuentas" ON email_cuentas
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'supervisor' AND activo = true
    )
  );
