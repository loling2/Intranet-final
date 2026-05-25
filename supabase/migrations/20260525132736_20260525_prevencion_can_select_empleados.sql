/*
  # Allow prevencion role to read all employees

  The prevention team needs to see all employees to assign PRL tags.
  Adds a SELECT policy for users with role = 'prevencion'.
  Also allows prevencion to read/write etiquetado (tag assignments).
*/

CREATE POLICY "Prevencion can view all empleados"
  ON empleados FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'prevencion'
      AND user_profiles.activo = true
    )
  );

CREATE POLICY "Prevencion can insert etiquetado"
  ON etiquetado FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('prevencion', 'admin', 'rrhh')
      AND user_profiles.activo = true
    )
  );

CREATE POLICY "Prevencion can delete etiquetado"
  ON etiquetado FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('prevencion', 'admin', 'rrhh')
      AND user_profiles.activo = true
    )
  );

CREATE POLICY "Prevencion can view etiquetado"
  ON etiquetado FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('prevencion', 'admin', 'rrhh')
      AND user_profiles.activo = true
    )
  );
