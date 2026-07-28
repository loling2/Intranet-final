
CREATE POLICY "Prevencion can update vitaly fields on empleados"
  ON empleados FOR UPDATE
  TO authenticated
  USING (is_prevencion() OR is_admin_or_rrhh())
  WITH CHECK (is_prevencion() OR is_admin_or_rrhh());
